const crypto = require('node:crypto');
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

const EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

exports.handler = async (event) => {
  try {
    const environment = getEnvironment();
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    }
    if (!isSameOrigin(event)) return jsonResponse(403, { error: 'This request is not allowed.' });
    if (!isAuthenticated(event, environment.sessionSecret)) {
      return jsonResponse(401, { error: 'Please sign in before uploading artwork.' });
    }

    const body = readJsonBody(event);
    const extension = EXTENSIONS.get(body.contentType);
    if (!extension || typeof body.fileName !== 'string' || body.fileName.length > 255) {
      return jsonResponse(400, { error: 'Choose a JPG, PNG, or WebP image.' });
    }

    const imagePath = `uploads/${crypto.randomUUID()}.${extension}`;
    const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/');
    const endpoint = `${environment.supabaseUrl}/storage/v1/object/upload/sign/artworks/${encodedPath}`;
    const signed = await supabaseJson(endpoint, {
      method: 'POST',
      headers: supabaseHeaders(environment.secretKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ upsert: false }),
    });

    const signedUrl = signed.signedUrl || signed.signedURL || signed.url;
    let uploadUrl =
      typeof signedUrl === 'string'
        ? signedUrl.startsWith('http')
          ? signedUrl
          : `${environment.supabaseUrl}/storage/v1${signedUrl}`
        : typeof signed.token === 'string'
          ? `${environment.supabaseUrl}/storage/v1/object/upload/sign/artworks/${encodedPath}?token=${encodeURIComponent(signed.token)}`
          : null;
    if (!uploadUrl) throw new Error('Supabase did not return a signed upload URL.');
    if (typeof signed.token === 'string') {
      const signedUpload = new URL(uploadUrl);
      if (!signedUpload.searchParams.has('token')) {
        signedUpload.searchParams.set('token', signed.token);
        uploadUrl = signedUpload.toString();
      }
    }

    return jsonResponse(200, {
      uploadUrl,
      publicKey: environment.publishableKey,
      imagePath,
    });
  } catch (error) {
    return logAndRespond(error);
  }
};
