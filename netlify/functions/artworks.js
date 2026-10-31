const {
  getEnvironment,
  isAuthenticated,
  isSameOrigin,
  jsonResponse,
  logAndRespond,
  readJsonBody,
  supabaseHeaders,
  supabaseJson,
} = require('./_shared');

const FIELDS = ['title', 'description', 'size', 'style', 'artist'];
const FIELD_LIMITS = { title: 120, description: 1000, size: 60, style: 80, artist: 100 };
const IMAGE_PATH_PATTERN = /^uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

function toArtwork(row, supabaseUrl) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    size: row.size,
    style: row.style,
    artist: row.artist,
    imageUrl: `${supabaseUrl}/storage/v1/object/public/artworks/${row.image_path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
    createdAt: row.created_at,
  };
}

exports.handler = async (event) => {
  try {
    const environment = getEnvironment();
    if (event.httpMethod === 'GET') {
      const rows = await supabaseJson(
        `${environment.supabaseUrl}/rest/v1/artworks?select=id,title,description,size,style,artist,image_path,created_at&order=created_at.desc`,
        { headers: supabaseHeaders(environment.secretKey) },
      );
      return jsonResponse(200, rows.map((row) => toArtwork(row, environment.supabaseUrl)));
    }

    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
    }
    if (!isSameOrigin(event)) return jsonResponse(403, { error: 'This request is not allowed.' });
    if (!isAuthenticated(event, environment.sessionSecret)) {
      return jsonResponse(401, { error: 'Please sign in before adding artwork.' });
    }

    const body = readJsonBody(event);
    const artwork = {};
    for (const field of FIELDS) {
      const value = typeof body[field] === 'string' ? body[field].trim() : '';
      if (!value || value.length > FIELD_LIMITS[field]) {
        return jsonResponse(400, { error: 'Complete every artwork detail within the allowed lengths.' });
      }
      artwork[field] = value;
    }
    if (typeof body.imagePath !== 'string' || !IMAGE_PATH_PATTERN.test(body.imagePath)) {
      return jsonResponse(400, { error: 'The uploaded image could not be verified.' });
    }

    const rows = await supabaseJson(`${environment.supabaseUrl}/rest/v1/artworks`, {
      method: 'POST',
      headers: supabaseHeaders(environment.secretKey, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify({ ...artwork, image_path: body.imagePath }),
    });
    return jsonResponse(201, toArtwork(rows[0], environment.supabaseUrl));
  } catch (error) {
    return logAndRespond(error);
  }
};
