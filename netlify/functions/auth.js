const crypto = require('node:crypto');
const {
  SESSION_LIFETIME_SECONDS,
  clearedSessionCookie,
  getEnvironment,
  isAuthenticated,
  isSameOrigin,
  jsonResponse,
  logAndRespond,
  readJsonBody,
  secureEqual,
  sessionCookieHeader,
  signPayload,
} = require('./_shared');

const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(address) {
  const now = Date.now();
  for (const [key, record] of loginAttempts) {
    if (record.resetAt <= now) loginAttempts.delete(key);
  }
  const record = loginAttempts.get(address);
  if (record && record.resetAt > now) return record.count >= MAX_ATTEMPTS;
  loginAttempts.set(address, { count: 0, resetAt: now + ATTEMPT_WINDOW_MS });
  return false;
}

function recordFailedAttempt(address) {
  const record = loginAttempts.get(address);
  if (record) record.count += 1;
}

exports.handler = async (event) => {
  try {
    const environment = getEnvironment();
    const method = event.httpMethod;
    const action = event.queryStringParameters && event.queryStringParameters.action;

    if (method === 'GET' && !action) {
      return jsonResponse(200, {
        authenticated: isAuthenticated(event, environment.sessionSecret),
      });
    }

    if (method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
    }
    if (!isSameOrigin(event)) return jsonResponse(403, { error: 'This request is not allowed.' });

    if (action === 'logout') {
      return jsonResponse(
        200,
        { authenticated: false },
        { 'Set-Cookie': clearedSessionCookie(event) },
      );
    }
    if (action !== 'login') return jsonResponse(404, { error: 'Authentication route not found.' });

    const headers = Object.fromEntries(
      Object.entries(event.headers || {}).map(([name, value]) => [name.toLowerCase(), value]),
    );
    const address = headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || 'unknown';
    if (isRateLimited(address)) {
      return jsonResponse(429, { error: 'Too many attempts. Please wait before trying again.' });
    }

    const body = readJsonBody(event);
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const usernameMatches = secureEqual(username, environment.username);
    const passwordMatches = secureEqual(password, environment.password);
    if (!usernameMatches || !passwordMatches) {
      recordFailedAttempt(address);
      return jsonResponse(401, { error: 'The username or password was not accepted.' });
    }

    loginAttempts.delete(address);
    const token = signPayload(
      { exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS },
      environment.sessionSecret,
    );
    return jsonResponse(
      200,
      { authenticated: true },
      { 'Set-Cookie': sessionCookieHeader(event, token) },
    );
  } catch (error) {
    return logAndRespond(error);
  }
};
