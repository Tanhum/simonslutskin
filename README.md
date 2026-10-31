# Simon Slutskin — Art Gallery

The **Angular website is hosted on Netlify**. **Supabase stores the artwork records and images and runs the protected upload functions.** Netlify is static hosting only: it needs no API server, Netlify Functions, Supabase secret, or uploader password.

## 1. Prepare Supabase

1. In the Supabase project's SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). This creates the artwork table and public-read `artworks` Storage bucket.
2. The Supabase secret key shared in chat must be revoked. Rotate it in **Project Settings → API Keys**. Supabase makes its current server-side key available to its Edge Functions; the app does not copy it into the repository or Netlify.
3. In **Supabase → Edge Functions → Secrets**, set only:
   - `ADMIN_USERNAME`: the username you choose for your dad.
   - `ADMIN_PASSWORD`: a strong password you choose for your dad.

   The functions use Supabase's built-in server key for database/storage requests and to sign short-lived login sessions. The key stays inside Supabase.
4. Deploy the three functions in `supabase/functions` to project `iifivunlsbytvvgrlbmi`. One way is with the Supabase CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref iifivunlsbytvvgrlbmi
   npx supabase functions deploy auth --no-verify-jwt
   npx supabase functions deploy artworks --no-verify-jwt
   npx supabase functions deploy upload-url --no-verify-jwt
   ```

   Supabase Edge Functions are the small protected API used by the static website; this does not add a Node server or any API hosting to Netlify.

   For the Edge Function endpoints to respond to the browser's CORS preflight requests, deploy with `--no-verify-jwt` as shown; the functions validate the gallery's signed session themselves.

## 2. Host the Angular website on Netlify

Import `Tanhum/simonslutskin` into Netlify. Its build settings are in [`netlify.toml`](./netlify.toml): `npm run build` publishes `dist/simon-art-gallery/browser`. The Supabase URL and publishable key in `src/app/supabase.config.ts` are public browser configuration. **Do not add private Supabase keys, usernames, or passwords to Netlify.**

When the Netlify site and Supabase functions are deployed, open `/upload` and sign in with the username and password you set in Supabase.

Netlify automatically rebuilds the Angular website when you push to GitHub. Supabase Edge Functions are deployed to Supabase separately with the Supabase CLI commands above; they do not run on Netlify.

## Upload flow

The browser sends the username and password to Supabase's `auth` Edge Function. It returns a short-lived signed session. The browser asks `upload-url` for a one-time Supabase Storage upload URL, then uploads the JPG, PNG, or WebP (up to 10 MB) directly from the browser to Supabase Storage. The `artworks` function saves the artwork details. The gallery reads those records and displays the public images. After signing in to `/upload`, the artist can also remove a work; this deletes its gallery record and stored image.

## Free-plan inactivity

Supabase may pause Free-plan projects after 7 days of low activity. A paused project can be restored from the Supabase dashboard; upgrading to Pro prevents inactivity pauses. Check Supabase's [production availability guidance](https://supabase.com/docs/guides/deployment/going-into-prod#availability) for current plan details.

## Local frontend preview

Run `npm install` and `npm run dev`. The site will use the deployed Supabase functions configured in `src/app/supabase.config.ts`.
