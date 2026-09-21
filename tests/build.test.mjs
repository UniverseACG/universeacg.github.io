import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('src/sites.json', root)));
test('all four pages preserve static links, expose named domains, and constrain scripts/probes', async () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  const headers = await readFile(new URL('dist/_headers', root), 'utf8');
  for (const id of ['', 'game', 'ai', 'video']) {
    const html = await readFile(new URL(`dist/${id ? id + '/' : ''}index.html`, root), 'utf8');
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.match(html, /script-src 'self'/);
    assert.match(html, /<script type="module" src="(?:\.\.\/|\.\/)assets\/routes.mjs"><\/script>/);
    assert.doesNotMatch(html, /http-equiv="refresh"|easybuff|备用 [1-4]|(?:game|video|ai)2\.aiacg/);
    for (const site of config.sites.filter(s => !id || s.id === id)) {
      assert.ok(html.includes(`href="${site.main}"`));
      assert.ok(html.includes(`data-product="${site.id}"`));
      assert.ok(html.includes(`data-default`));
      assert.ok(html.includes(`href="https://paradox.uacg.moe/official-apk/UACG-${site.id}.apk"`));
      assert.ok(html.includes('PWA 网页应用'));
      assert.ok(html.includes('Android APK'));
      assert.ok(html.includes('添加到主屏幕'));
      assert.doesNotMatch(html, /\.ipa["?]|\.exe["?]|\.aab["?]|shipsecure\.cc/);

      for (const route of site.routes) {
        assert.ok(html.includes(`href="${route.url}"`));
        assert.ok(html.includes(route.label));
        assert.ok(html.includes(new URL(route.url).hostname));
      }
    }
  }
  const csp = headers.match(/Content-Security-Policy: (.*)/)[1];
  const origins = csp.match(/connect-src ([^;]+)/)[1].split(' ');
  assert.deepEqual(new Set(origins), new Set(config.sites.flatMap(s => s.routes.map(r => r.url))));
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(csp, /unsafe-inline|\*/);
});
