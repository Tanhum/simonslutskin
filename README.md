# Simon Slutskin — Art Gallery

A two-page Angular gallery with a password-protected artist area. Gallery artwork is stored on the server only after the artist uploads it; the existing artwork files in the project folder are not preloaded or copied into the site. The artist portrait is used on the gallery landing page.

## Run locally

Use Node.js 20.19 or newer. Install dependencies with `npm install`, then start the API and Angular development server in separate terminals.

In the first terminal, set a private password and start the API:

```bash
read -s ADMIN_PASSWORD
export ADMIN_PASSWORD
npm run api
```

In the second terminal:

```bash
npm run dev
```

Open [http://localhost:4200](http://localhost:4200). The API listens on `127.0.0.1:3000`; Angular proxies `/api` requests to it. The server refuses to start without `ADMIN_PASSWORD`.

Uploaded images and the artwork index are stored in `gallery-data/`. Set `GALLERY_DATA_DIR` to use a different persistent storage location.

## Production

Build the Angular site with `npm run build`, then start the server with `npm start` and `ADMIN_PASSWORD` set. The server serves the built site and API together on `127.0.0.1:3000`. Put it behind an HTTPS reverse proxy for public hosting; production cookies are marked `Secure`.

The artist password is verified by the server, not included in Angular code. Sign-in is rate-limited, and the session cookie is HTTP-only, same-site, and expires after 12 hours. The public gallery is viewable without signing in; only adding artwork requires the password.

## Add an artwork

Visit `/upload`, sign in, and choose a JPG, PNG, or WebP image (up to 10 MB). Enter the artwork name, artist, size, and style or medium; the description is optional. The new artwork appears in the gallery automatically.
