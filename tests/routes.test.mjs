import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile(new URL('../src/sites.json', import.meta.url)));
const load = () => import('../src/assets/route-probe.mjs');
const body = 'UACG route probe v1\n' + '0123456789abcdef'.repeat(4096);
const response = (text = body, options = {}) => new Response(text, { headers: { 'content-type': 'text/plain' }, ...options });

test('three products retain their main domain and exactly five named routes', () => {
  const main = { game: 'https://uacg.games', ai: 'https://uacg.ai', video: 'https://uacg.moe' };
  const cf = { game: 'd2jk2nxe3yjxed', ai: 'd6yokos9995d', video: 'dxc4rtyvdpyq6' };
  assert.equal(config.sites.length, 3);
  for (const site of config.sites) {
    assert.equal(site.main, main[site.id]);
    assert.deepEqual(site.routes, [
      { id: 'telecom', label: '电信线路', url: `https://${site.id}-ct.aiacg.org` },
      { id: 'mobile', label: '移动线路', url: `https://${site.id}-cm.aiacg.vip` },
      { id: 'unicom', label: '联通线路', url: `https://${site.id}3.aiacg.xyz` },
      { id: 'cloudfront', label: 'CloudFront（原始域名）', url: `https://${cf[site.id]}.cloudfront.net` },
      { id: 'cloudfront-alias', label: 'CloudFront（自定义域名）', url: `https://${site.id}-app.aiacg.xyz` },
    ]);
  }
});

test('fastest valid result stays independent per product; failures keep main fallback', async () => {
  const { createSelection } = await load();
  const a = createSelection(config.sites[0]);
  const b = createSelection(config.sites[1]);
  a.record({ id: 'telecom', ok: true, elapsedMs: 100 });
  a.record({ id: 'mobile', ok: true, elapsedMs: 50 });
  a.record({ id: 'unicom', ok: false, elapsedMs: 1 });
  a.record({ id: 'cloudfront', ok: true, elapsedMs: NaN });
  a.record({ id: 'cloudfront-alias', ok: true, elapsedMs: -1 });
  assert.equal(a.current().id, 'mobile');
  assert.equal(b.current().url, config.sites[1].main);
  b.record({ id: 'unicom', ok: true, elapsedMs: 80 });
  assert.equal(b.current().id, 'unicom');
  assert.equal(a.current().id, 'mobile');
});

test('manual choice during measurement cannot be overridden and rejects unknown route', async () => {
  const { createSelection } = await load();
  const state = createSelection(config.sites[0]);
  assert.equal(state.select('telecom'), true);
  state.record({ id: 'mobile', ok: true, elapsedMs: 1 });
  assert.equal(state.current().id, 'telecom');
  assert.equal(state.select('https://example.com'), false);
  assert.equal(state.current().id, 'telecom');
  state.select('main');
  state.record({ id: 'unicom', ok: true, elapsedMs: 0.5 });
  assert.equal(state.current().url, config.sites[0].main);
});

test('probe uses identical full content, anonymous fetch and rejects redirects', async () => {
  const { measureRoute } = await load();
  const route = { id: 'telecom', url: 'https://game-ct.aiacg.org' };
  let call;
  const result = await measureRoute(route, { fetcher: async (...args) => { call = args; return response(); } });
  assert.equal(result.ok, true);
  assert.equal(call[0], route.url + '/route-probe.txt');
  assert.equal(call[1].credentials, 'omit');
  assert.equal(call[1].redirect, 'error');
  assert.equal(call[1].cache, 'no-store');
  assert.equal(call[1].referrerPolicy, 'no-referrer');
  for (const bad of [response('wrong'), response(body, { status: 404 }), response(body, { headers: { 'content-type': 'text/html' } }), response(body + 'x')]) {
    assert.equal((await measureRoute(route, { fetcher: async () => bad })).ok, false);
  }
  assert.equal((await measureRoute(route, { fetcher: async () => { throw Error('network'); } })).ok, false);
  const redirected = response();
  Object.defineProperty(redirected, 'redirected', { value: true });
  assert.equal((await measureRoute(route, { fetcher: async () => redirected })).ok, false);
});

test('timeout cancels a stalled request and excludes its result', async () => {
  const { measureRoute } = await load();
  let signal;
  const result = await measureRoute({ id: 'telecom', url: 'https://game-ct.aiacg.org' }, {
    timeoutMs: 10, fetcher: async (_, options) => { signal = options.signal; return new Promise(() => {}); },
  });
  assert.equal(result.ok, false);
  assert.equal(signal.aborted, true);
});

test('queue limits concurrency globally and bounds total stalled time', async () => {
  const { runProbes } = await load();
  let active = 0, peak = 0, calls = 0;
  const jobs = Array.from({ length: 15 }, (_, i) => ({ id: String(i), url: 'https://game-ct.aiacg.org' }));
  const results = await runProbes(jobs, { fetcher: async () => {
    calls++; active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 3)); active--; return response();
  } });
  assert.equal(calls, 15);
  assert.equal(peak, 3);
  assert.equal(results.filter(r => r.ok).length, 15);
  const stalled = await runProbes(jobs, { timeoutMs: 1000, totalTimeoutMs: 15, fetcher: () => new Promise(() => {}) });
  assert.equal(stalled.length, 15);
  assert.equal(stalled.some(r => r.ok), false);
});
