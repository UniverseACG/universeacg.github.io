const SAMPLE = 'UACG route probe v1\n' + '0123456789abcdef'.repeat(4096);
const ROUTE_TIMEOUT_MS = 4000;
const TOTAL_TIMEOUT_MS = 20000;

export function createSelection(site) {
  const main = { id: 'main', label: '主站', url: site.main };
  let selected = main;
  let manual = false;
  let bestMs = Infinity;
  return {
    current: () => ({ ...selected, manual }),
    select(id) {
      const route = id === 'main' ? main : site.routes.find(route => route.id === id);
      if (!route) return false;
      selected = route;
      manual = true;
      return true;
    },
    record(result) {
      const route = site.routes.find(route => route.id === result.id);
      if (!manual && route && result.ok && Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0 && result.elapsedMs < bestMs) {
        selected = route;
        bestMs = result.elapsedMs;
      }
    },
  };
}

export async function measureRoute(route, { fetcher = fetch, timeoutMs = ROUTE_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const started = performance.now();
  let reader;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
  });
  const probe = async () => {
    const response = await fetcher(`${route.url}/route-probe.txt`, {
      credentials: 'omit', redirect: 'error', cache: 'no-store',
      mode: 'cors', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    if (response.status !== 200 || response.redirected || response.type === 'opaque' ||
        !/^text\/plain(?:;|$)/i.test(response.headers.get('content-type') || '') || !response.body) {
      throw new Error('invalid response');
    }
    reader = response.body.getReader();
    const bytes = new Uint8Array(SAMPLE.length);
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > SAMPLE.length) throw new Error('oversized response');
      bytes.set(chunk.value, length - chunk.value.length);
    }
    if (length !== SAMPLE.length || new TextDecoder().decode(bytes) !== SAMPLE) throw new Error('invalid sample');
    return { id: route.id, ok: true, elapsedMs: performance.now() - started };
  };
  try {
    return await Promise.race([probe(), timeout]);
  } catch {
    return { id: route.id, ok: false };
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
  }
}

// One queue is shared by every product on the page: at most three requests total.
export async function runProbes(jobs, { fetcher = fetch, timeoutMs = ROUTE_TIMEOUT_MS, totalTimeoutMs = TOTAL_TIMEOUT_MS, onResult = () => {} } = {}) {
  const deadline = performance.now() + totalTimeoutMs;
  const results = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      const remaining = deadline - performance.now();
      const result = remaining <= 0
        ? { id: jobs[index].id, ok: false }
        : await measureRoute(jobs[index], { fetcher, timeoutMs: Math.min(timeoutMs, remaining) });
      results[index] = result;
      onResult(jobs[index], result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, worker));
  return results;
}
