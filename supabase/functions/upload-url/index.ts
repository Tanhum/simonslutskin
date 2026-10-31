import {
  errorResponse,
  handleOptions,
  isAuthenticated,
  jsonResponse,
  readJson,
  sessionSecret,
  supabaseRequest,
  supabaseSecretHeaders,
  supabaseUrl,
} from '../_shared.ts';

const extensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });
    if (!await isAuthenticated(request, sessionSecret())) {
      return jsonResponse(401, { error: 'Please sign in before uploading artwork.' });
    }

    const body = await readJson(request);
    const extension = typeof body.contentType === 'string' ? extensions.get(body.contentType) : null;
    if (!extension || typeof body.fileName !== 'string' || body.fileName.length > 255) {
      return jsonResponse(400, { error: 'Choose a JPG, PNG, or WebP image.' });
    }

    const imagePath = `uploads/${crypto.randomUUID()}.${extension}`;
    const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/');
    const baseUrl = supabaseUrl();
    const result = await supabaseRequest(
      `${baseUrl}/storage/v1/object/upload/sign/artworks/${encodedPath}`,
      {
        method: 'POST',
        headers: supabaseSecretHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ upsert: false }),
      },
    );
    if (typeof result !== 'object' || result === null || !('url' in result)) {
      throw new Error('Supabase did not return a signed upload URL.');
    }

    const signedResult = result as { url: string; token?: string };
    const signedPath = signedResult.url;
    const uploadUrl = new URL(
      signedPath.startsWith('http') ? signedPath : `${baseUrl}/storage/v1${signedPath}`,
    );
    if (typeof signedResult.token === 'string') {
      uploadUrl.searchParams.set('token', signedResult.token);
    }
    if (!uploadUrl.searchParams.has('token')) {
      throw new Error('Supabase did not return a signed upload token.');
    }
    return jsonResponse(200, { uploadUrl: uploadUrl.toString(), imagePath });
  } catch (error) {
    return errorResponse(error);
  }
});
