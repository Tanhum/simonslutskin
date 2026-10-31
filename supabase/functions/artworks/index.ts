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

const fields = ['title', 'description', 'size', 'style', 'artist'] as const;
const limits = { title: 120, description: 1000, size: 60, style: 80, artist: 100 };
const imagePathPattern = /^uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ArtworkRow {
  id: string;
  title: string;
  description: string;
  size: string;
  style: string;
  artist: string;
  image_path: string;
  created_at: string;
}

function toArtwork(row: ArtworkRow) {
  const imagePath = row.image_path.split('/').map(encodeURIComponent).join('/');
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    size: row.size,
    style: row.style,
    artist: row.artist,
    imageUrl: `${supabaseUrl()}/storage/v1/object/public/artworks/${imagePath}`,
    createdAt: row.created_at,
  };
}

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    const baseUrl = supabaseUrl();
    if (request.method === 'GET') {
      const rows = await supabaseRequest(
        `${baseUrl}/rest/v1/artworks?select=id,title,description,size,style,artist,image_path,created_at&order=created_at.desc`,
        { headers: supabaseSecretHeaders() },
      );
      if (!Array.isArray(rows)) throw new Error('Supabase returned an invalid artwork collection.');
      return jsonResponse(200, rows.map((row) => toArtwork(row as ArtworkRow)));
    }
    if (request.method !== 'POST' && request.method !== 'DELETE') {
      return jsonResponse(405, { error: 'Метод запроса не поддерживается.' });
    }
    if (!await isAuthenticated(request, sessionSecret())) {
      return jsonResponse(401, { error: 'Войдите в мастерскую, чтобы управлять работами.' });
    }

    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id') ?? '';
      if (!uuidPattern.test(id)) {
        return jsonResponse(400, { error: 'Не удалось проверить выбранную работу.' });
      }

      const rows = await supabaseRequest(
        `${baseUrl}/rest/v1/artworks?id=eq.${encodeURIComponent(id)}&select=id,image_path`,
        {
          method: 'DELETE',
          headers: supabaseSecretHeaders({
            Prefer: 'return=representation',
          }),
        },
      );
      if (!Array.isArray(rows) || !rows[0]) {
        return jsonResponse(404, { error: 'Эта работа уже отсутствует в галерее.' });
      }

      const imagePath = (rows[0] as Pick<ArtworkRow, 'image_path'>).image_path;
      if (!imagePathPattern.test(imagePath)) {
        throw new Error('Supabase returned an invalid artwork image path.');
      }

      try {
        await supabaseRequest(`${baseUrl}/storage/v1/object/artworks`, {
          method: 'DELETE',
          headers: supabaseSecretHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ prefixes: [imagePath] }),
        });
      } catch (error) {
        console.error('Artwork record was deleted but its image could not be removed:', error);
        return jsonResponse(502, {
          error: 'Работа удалена из галереи, но изображение осталось в хранилище Supabase.',
        });
      }

      return jsonResponse(200, { deleted: true });
    }

    const body = await readJson(request);
    const artwork: Record<string, string> = {};
    for (const field of fields) {
      const value = typeof body[field] === 'string' ? body[field].trim() : '';
      if (!value || value.length > limits[field]) {
        return jsonResponse(400, { error: 'Заполните все поля, соблюдая ограничения по длине.' });
      }
      artwork[field] = value;
    }
    if (typeof body.imagePath !== 'string' || !imagePathPattern.test(body.imagePath)) {
      return jsonResponse(400, { error: 'Не удалось проверить загруженное изображение.' });
    }

    const rows = await supabaseRequest(`${baseUrl}/rest/v1/artworks`, {
      method: 'POST',
      headers: supabaseSecretHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify({ ...artwork, image_path: body.imagePath }),
    });
    if (!Array.isArray(rows) || !rows[0]) {
      throw new Error('Supabase did not return the saved artwork.');
    }
    return jsonResponse(201, toArtwork(rows[0] as ArtworkRow));
  } catch (error) {
    return errorResponse(error);
  }
});
