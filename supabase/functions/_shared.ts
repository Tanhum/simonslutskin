export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export function handleOptions(request: Request): Response | null {
  return request.method === 'OPTIONS'
    ? new Response('ok', { headers: corsHeaders })
    : null;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 16 * 1024) {
    throw new RequestError(413, 'Request body is too large.');
  }
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Expected an object.');
    }
    return body as Record<string, unknown>;
  } catch {
    throw new RequestError(400, 'Request body must be a JSON object.');
  }
}

export class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function requiredSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Supabase function secret: ${name}`);
  return value;
}

export function sessionSecret(): string {
  return `${supabaseSecretKey()}:gallery-session-v1`;
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const decoded = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    decoded[index] = binary.charCodeAt(index);
  }
  return decoded;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createSession(secret: string): Promise<string> {
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60 })),
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function isAuthenticated(request: Request, secret: string): Promise<boolean> {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlDecode(token.slice(separator + 1));
  } catch {
    return false;
  }
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signature,
    new TextEncoder().encode(payload),
  );
  if (!valid) return false;
  try {
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return typeof claims.exp === 'number' && claims.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function supabaseUrl(): string {
  const value = Deno.env.get('SUPABASE_URL');
  if (!value) throw new Error('Supabase did not provide its project URL to the Edge Function.');
  return value.replace(/\/+$/, '');
}

function supabaseSecretKey(): string {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    const keys: Record<string, string> = JSON.parse(secretKeys);
    const secret = keys.default || Object.values(keys)[0];
    if (secret) return secret;
  }
  const legacySecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacySecret) return legacySecret;
  throw new Error('Supabase did not provide a server-side API key to the Edge Function.');
}

export function supabaseSecretHeaders(extra: Record<string, string> = {}): HeadersInit {
  const secret = supabaseSecretKey();
  const authorization = secret.startsWith('eyJ') ? { Authorization: `Bearer ${secret}` } : {};
  return {
    apikey: secret,
    ...authorization,
    ...extra,
  };
}

export async function supabaseRequest(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String(body.message)
        : 'Supabase rejected the request.';
    throw new RequestError(response.status, message);
  }
  return body;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof RequestError) return jsonResponse(error.status, { error: error.message });
  console.error('Supabase gallery function failed:', error);
  return jsonResponse(500, { error: 'The gallery could not complete the request. Check function configuration.' });
}
