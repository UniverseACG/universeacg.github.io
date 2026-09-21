# UACG address pages

`src/sites.json` is the source for the home page and `/game/`, `/ai/`, `/video/`.
Each product keeps its main address and five named routes. Every direct link works
without JavaScript. The main address is the initial/default fallback; successful
browser measurements update only that product's default visit button. The page
never navigates automatically. Selecting any route locks the choice for this page
visit, including while probes are running.

## Probe contract

All 15 route origins must anonymously serve `/route-probe.txt` with HTTP 200,
`Content-Type: text/plain`, `Access-Control-Allow-Origin: *`, and this exact body:

```js
'UACG route probe v1\n' + '0123456789abcdef'.repeat(4096)
```

The decoded body is 65,556 bytes. Every route downloads one identical sample.
Redirects, non-200 status, unexpected content types, wrong/truncated/oversized
bodies and timeouts are excluded. Fetch omits credentials and referrers. The
measurement covers the complete fetch and body read; it is a single current
browser observation, not an operator identity or a sustained bandwidth estimate.
There are at most three active probes across the entire page, four seconds per
probe and twenty seconds overall. The queue interleaves products. Results stay
in memory in the page; no analytics or result reporting is sent.

## Validation and publication

Use Node 22 or newer; there are no npm dependencies:

```sh
npm test
npm run build
```

Tests cover the product/route matrix, independent fastest-success selection,
manual-choice priority, failure filtering, deadline cancellation, global
concurrency and all four generated HTML pages/CSP. Browser integration should
also be checked against the actual deployed probe endpoints before release.

The existing GitHub Pages workflow tests and builds on `main`, then publishes
`dist/`. Its canonical origin defaults to `https://universeacg.github.io/`.
For the existing Cloudflare Pages publication, build with the alternate origin:

```sh
PUBLIC_SITE_URL=https://uacg.pages.dev/ npm run build
```

Publish that generated directory through the existing Cloudflare Pages release
procedure. Do not commit `dist/` or `.wrangler/`. Source assets are copied to
`dist/assets/`; the build overwrites owned outputs and preserves other existing
verification files. CSP is included in HTML (GitHub Pages) and `_headers`
(Cloudflare Pages), permitting same-origin scripts and only the 15 exact probe
origins. `_headers` additionally denies framing.

## App downloads

Each product page and the combined home expose only PWA installation guidance and the corresponding official Android APK. APK links use the fixed public R2 path `https://paradox.uacg.moe/official-apk/UACG-{video,game,ai}.apk`; they do not require GitLab login. The release procedure verifies the signed CI artifact hash and embedded official/production metadata, uploads an immutable version under `official-apk/releases/<revision>/`, then updates the fixed file (five-minute cache). Keep previous immutable versions for rollback. PWA installation takes place on the business site, never on this address directory itself.
