const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('Set ADMIN_PASSWORD before starting the gallery server.');
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDirectory = path.resolve(process.env.GALLERY_DATA_DIR || path.join(__dirname, 'gallery-data'));
const uploadDirectory = path.join(dataDirectory, 'uploads');
const manifestPath = path.join(dataDirectory, 'artworks.json');
const sessionCookie = 'gallery_session';
const sessionLifetime = 12 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const production = process.env.NODE_ENV === 'production';
const extensionsByMime = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

fs.mkdirSync(uploadDirectory, { recursive: true });
let artworks = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : [];
if (!Array.isArray(artworks)) {
  throw new Error(`The artwork manifest at ${manifestPath} must contain a JSON array.`);
}

let writeQueue = Promise.resolve();
function saveArtwork(artwork) {
  const write = writeQueue.catch(() => undefined).then(async () => {
    const updatedArtworks = [artwork, ...artworks];
    const temporaryPath = `${manifestPath}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(temporaryPath, JSON.stringify(updatedArtworks, null, 2), 'utf8');
    await fs.promises.rename(temporaryPath, manifestPath);
    artworks = updatedArtworks;
  });
  writeQueue = write;
  return write;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : '';
}

function getSession(request) {
  const token = getCookie(request, sessionCookie);
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuthentication(request, response, next) {
  if (!getSession(request)) {
    response.status(401).json({ error: 'Please sign in to add artwork.' });
    return;
  }
  next();
}

function checkRequestOrigin(request, response, next) {
  const origin = request.get('origin');
  let originHost = '';
  try {
    originHost = origin ? new URL(origin).host : '';
  } catch {
    response.status(403).json({ error: 'This request is not allowed.' });
    return;
  }
  if (originHost && originHost !== request.get('host')) {
    response.status(403).json({ error: 'This request is not allowed.' });
    return;
  }
  next();
}

function getAttemptRecord(address) {
  const now = Date.now();
  for (const [key, record] of loginAttempts) {
    if (record.resetAt <= now) loginAttempts.delete(key);
  }
  let record = loginAttempts.get(address);
  if (!record || record.resetAt <= now) {
    record = { count: 0, resetAt: now + 15 * 60 * 1000 };
    loginAttempts.set(address, record);
  }
  return record;
}

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadDirectory),
  filename: (_request, file, callback) => {
    callback(null, `${crypto.randomUUID()}${extensionsByMime.get(file.mimetype)}`);
  },
});
const receiveImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(null, extensionsByMime.has(file.mimetype));
  },
}).single('image');

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/api/auth', (request, response) => {
  response.json({ authenticated: getSession(request) });
});

app.post('/api/login', checkRequestOrigin, (request, response) => {
  const address = request.ip || 'unknown';
  const attempts = getAttemptRecord(address);
  if (attempts.count >= 8) {
    response.status(429).json({ error: 'Too many attempts. Please wait before trying again.' });
    return;
  }

  const submittedPassword = typeof request.body?.password === 'string' ? request.body.password : '';
  const submittedBuffer = Buffer.from(submittedPassword);
  const expectedBuffer = Buffer.from(password);
  const matches =
    submittedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(submittedBuffer, expectedBuffer);
  if (!matches) {
    attempts.count += 1;
    response.status(401).json({ error: 'The password was not accepted.' });
    return;
  }

  loginAttempts.delete(address);
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { expiresAt: Date.now() + sessionLifetime });
  const secure = production ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetime / 1000}${secure}`,
  );
  response.json({ authenticated: true });
});

app.post('/api/logout', checkRequestOrigin, (request, response) => {
  sessions.delete(getCookie(request, sessionCookie));
  response.setHeader(
    'Set-Cookie',
    `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`,
  );
  response.json({ authenticated: false });
});

app.get('/api/artworks', (_request, response) => {
  response.json(artworks);
});

app.post(
  '/api/artworks',
  checkRequestOrigin,
  requireAuthentication,
  receiveImage,
  async (request, response, next) => {
    if (!request.file) {
      response.status(400).json({ error: 'Please choose a JPG, PNG, or WebP image.' });
      return;
    }

    const fields = ['title', 'description', 'size', 'style', 'artist'];
    const values = {};
    for (const field of fields) {
      const value = request.body[field];
      values[field] = typeof value === 'string' ? value.trim() : '';
    }
    const limits = { title: 120, description: 1000, size: 60, style: 80, artist: 100 };
    const invalidField = fields.find((field) => !values[field] || values[field].length > limits[field]);
    if (invalidField) {
      await fs.promises.unlink(request.file.path);
      response.status(400).json({ error: 'Please complete all required details within the allowed lengths.' });
      return;
    }

    const artwork = {
      id: crypto.randomUUID(),
      ...values,
      imageUrl: `/api/images/${request.file.filename}`,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveArtwork(artwork);
      response.status(201).json(artwork);
    } catch (saveError) {
      try {
        await fs.promises.unlink(request.file.path);
      } catch (cleanupError) {
        console.error('Could not remove an unlisted artwork image:', cleanupError.message);
      }
      next(saveError);
    }
  },
);

app.use('/api/images', express.static(uploadDirectory, { index: false, fallthrough: false }));
app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found.' });
});

const buildDirectory = path.join(__dirname, 'dist', 'simon-art-gallery', 'browser');
if (fs.existsSync(buildDirectory)) {
  app.use(express.static(buildDirectory));
}
app.use((request, response) => {
  const indexPath = path.join(buildDirectory, 'index.html');
  if (request.method === 'GET' && fs.existsSync(indexPath)) {
    response.sendFile(indexPath);
    return;
  }
  response.status(404).send('Build the Angular app with npm run build to serve the website here.');
});

app.use((error, _request, response, _next) => {
  if (response.headersSent) return;
  const isMulterError = error instanceof multer.MulterError;
  const status =
    isMulterError && error.code === 'LIMIT_FILE_SIZE'
      ? 413
      : isMulterError
        ? 400
        : Number.isInteger(error.status) && error.status >= 400 && error.status < 500
          ? error.status
          : 500;
  if (status >= 500) console.error('Gallery request failed:', error.message);
  const message =
    status === 413
      ? 'The image or request is too large.'
      : status === 400
        ? 'The request could not be understood.'
        : 'The request could not be completed. Please try again.';
  response.status(status).json({ error: message });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Gallery API listening at http://127.0.0.1:${port}`);
});
