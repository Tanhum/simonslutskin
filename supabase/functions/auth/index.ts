import {
  constantTimeEqual,
  createSession,
  errorResponse,
  handleOptions,
  isAuthenticated,
  jsonResponse,
  readJson,
  requiredSecret,
  sessionSecret,
} from '../_shared.ts';

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    const signingSecret = sessionSecret();

    if (request.method === 'GET') {
      return jsonResponse(200, { authenticated: await isAuthenticated(request, signingSecret) });
    }
    if (request.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' });
    }

    const url = new URL(request.url);
    if (url.searchParams.get('action') === 'logout') {
      return jsonResponse(200, { authenticated: false });
    }
    if (url.searchParams.get('action') !== 'login') {
      return jsonResponse(404, { error: 'Authentication route not found.' });
    }

    const body = await readJson(request);
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const [usernameMatches, passwordMatches] = await Promise.all([
      constantTimeEqual(username, requiredSecret('ADMIN_USERNAME')),
      constantTimeEqual(password, requiredSecret('ADMIN_PASSWORD')),
    ]);
    if (!usernameMatches || !passwordMatches) {
      return jsonResponse(401, { error: 'The username or password was not accepted.' });
    }

    return jsonResponse(200, {
      authenticated: true,
      token: await createSession(signingSecret),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
