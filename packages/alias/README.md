# alias

Cloudflare Worker for short Func system error links on `f.witt.im`.

- `GET /EXPECTED_ARRAY_PARAM` redirects with `308` to
  `https://func.witt.im/errors/F_SYSTEM_EXPECTED_ARRAY_PARAM`.
- Aliases are case-insensitive and come from `@func/shared/system-errors`.
- Successful redirects are stored in `caches.default` for seven days.
- Unknown paths and non-`GET` requests return `404` and are stored in
  `caches.default` for 24 hours.
