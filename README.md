# Simon Slutskin — Art Gallery

The Angular gallery is hosted on Netlify. Netlify Functions handle the uploader's username/password and artwork metadata; Supabase stores the metadata and artwork images. Netlify builds the app directly from GitHub—**the Netlify CLI is not required**.

## 1. Set up Supabase

1. In Supabase, open **SQL Editor**, create a query, paste in [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the artworks table and a public-read image bucket. Visitors can view the collection; only the server-side Netlify Functions can add artwork.
2. In **Project Settings → API Keys**, copy the project URL and public publishable key.
3. Rotate the Supabase secret key that was shared in chat. Use only its replacement in Netlify’s private environment-variable settings; never commit it or put it in Angular code.

## 2. Deploy using Netlify

1. Push this repository to GitHub and import `Tanhum/simonslutskin` into Netlify.
2. Netlify reads [`netlify.toml`](./netlify.toml) for the build command (`npm run build`), publish folder, and serverless functions. You do not need to configure a separate Node server or install the Netlify CLI.
3. In the Netlify site’s **Environment variables** settings, add:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Public publishable key |
   | `SUPABASE_SECRET_KEY` | Newly rotated Supabase secret key; server-side only |
   | `ADMIN_USERNAME` | Username your dad chooses |
   | `ADMIN_PASSWORD` | Strong, private uploader password |
   | `SESSION_SECRET` | A random secret at least 32 bytes long |

   Generate `SESSION_SECRET` on your computer with `openssl rand -base64 48`; enter it directly in Netlify and do not commit it.

4. Trigger a deploy after adding the variables. Open the deployed site's `/upload` page and sign in using `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

## Local frontend preview

Run `npm install` and `npm run dev` to preview the Angular frontend. The serverless API functions run on the deployed Netlify site; configure the Supabase schema and Netlify environment variables before testing sign-in or uploads on the deployment.

## Upload flow

The uploader signs in at `/upload`. A Netlify Function verifies the username and password and sets an HTTP-only, same-site session cookie. The browser requests a one-time Supabase signed upload URL, then sends a JPG, PNG, or WebP image (up to 10 MB) directly to Supabase Storage. A server-side function stores the artwork details and image path in Supabase. The public gallery reads those records and displays the images.
