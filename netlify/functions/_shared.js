const crypto = require('node:crypto');

const SESSION_COOKIE = 'gallery_session';
const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function getEnvironment() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'SESSION_SECRET',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required Netlify environment variables: ${missing.join(', ')}`);
  }
  if (Buffer.byteLength(process.env.SESSION_SECRET) < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  }
  return {
    supabaseUrl: process.env.SUPABASE_URL.replace(/\/+$/, ''),
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    sessionSecret: process.env.SESSION_SECRET,
  };
}

function requestHeaders(event) {
  const headers = {};
  for (const [name, value] of Object.entries(event.headers || {})) {
    if (typeof value === 'string') headers[name.toLowerCase()] = value;
  }
  return headers;
}

function isSameOrigin(event) {
  const headers = requestHeaders(event);
  const origin = headers.origin;
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = headers['x-forwarded-host'] || headers.host;
    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

function readJsonBody(event) {
  if (!event.body) return {};
  if (Buffer.byteLength(event.body, event.isBase64Encoded ? 'base64' : 'utf8') > 16 * 1024) {
    const error = new Error('Request body is too large.');
    error.status = 413;
    throw error;
  }
  const text = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object.');
  }
  return parsed;
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readCookie(event, name) {
  const cookieHeader = requestHeaders(event).cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : '';
}

function isAuthenticated(event, secret) {
  const token = readCookie(event, SESSION_COOKIE);
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;
  const encoded = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!secureEqual(suppliedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function sessionCookieHeader(event, token) {
  const host = requestHeaders(event).host || '';
  const secure = host.includes('localhost') || host.startsWith('127.0.0.1') ? '' : '; Secure';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_LIFETIME_SECONDS}${secure}`;
}

function clearedSessionCookie(event) {
  const host = requestHeaders(event).host || '';
  const secure = host.includes('localhost') || host.startsWith('127.0.0.1') ? '' : '; Secure';
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

function supabaseHeaders(secretKey, extra = {}) {
  return {
    apikey: secretKey,
    ...extra,
  };
}

function supabaseErrorMessage(payload) {
  if (payload && typeof payload.message === 'string') return payload.message;
  if (payload && typeof payload.error === 'string') return payload.error;
  return 'Supabase returned an unexpected response.';
}

async function supabaseJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }
  if (!response.ok) {
    const error = new Error(supabaseErrorMessage(payload));
    error.status = response.status;
    throw error;
  }
  return payload;
}

function logAndRespond(error) {
  console.error('Gallery function error:', error.message);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  const message = status === 500
    ? 'The gallery could not complete the request. Check the function logs and configuration.'
    : error.message;
  return jsonResponse(status, { error: message });
}

module.exports = {
  SESSION_COOKIE,
  SESSION_LIFETIME_SECONDS,
  clearedSessionCookie,
  getEnvironment,
  isAuthenticated,
  isSameOrigin,
  jsonResponse,
  logAndRespond,
  readJsonBody,
  readCookie,
  secureEqual,
  sessionCookieHeader,
  signPayload,
  supabaseHeaders,
  supabaseJson,
};
