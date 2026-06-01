# redirect

Vercel 301 redirect config.

Set the Vercel project Root Directory to `packages/redirect`.

The `public/index.html` file exists only to give Vercel a static output directory; `vercel.json` handles the 301 redirects.

Current config redirects `https://old.example/` to `https://func.witt.im` and `https://old.example/a` to `https://func.witt.im/a`.
