import { createSelection, runProbes } from './route-probe.mjs';

const products = [...document.querySelectorAll('[data-product]')].map(section => {
  const links = [...section.querySelectorAll('[data-route]')];
  const routes = links.map(link => ({ id: link.dataset.route, label: link.dataset.label, url: link.getAttribute('href') }));
  const main = routes.find(route => route.id === 'main');
  const site = { main: main.url, routes: routes.filter(route => route.id !== 'main') };
  const state = createSelection(site);
  const visit = section.querySelector('[data-default]');
  const status = section.querySelector('[data-status]');
  let completed = 0;
  function render() {
    const choice = state.current();
    visit.href = choice.url;
    visit.querySelector('[data-visit-label]').textContent = `访问${section.dataset.label} · ${choice.label}`;
    visit.querySelector('[data-visit-domain]').textContent = new URL(choice.url).hostname;
    status.textContent = choice.manual ? `已手选${choice.label}，不会被测速覆盖。`
      : completed < site.routes.length ? `正在测速 ${completed}/${site.routes.length}，可直接访问或手选线路。`
      : choice.id === 'main' ? '测速未成功，默认保留主站；各线路仍可直接访问。'
      : `已选本次最快线路：${choice.label}。`;
    for (const button of section.querySelectorAll('[data-select]')) {
      button.setAttribute('aria-pressed', String(button.dataset.select === choice.id));
    }
  }
  for (const link of links) link.addEventListener('click', () => { state.select(link.dataset.route); render(); });
  for (const button of section.querySelectorAll('[data-select]')) {
    button.hidden = false;
    button.addEventListener('click', () => { state.select(button.dataset.select); render(); });
  }
  // Clicking the current default while probes run also locks that explicit choice.
  visit.addEventListener('click', () => { state.select(state.current().id); render(); });
  render();
  return { site, result(result) {
    completed++;
    state.record(result);
    const output = section.querySelector(`[data-result="${result.id}"]`);
    output.textContent = result.ok ? `${Math.round(result.elapsedMs)} ms` : '未测通';
    render();
  } };
});
// Interleave products so a slow product cannot monopolize the queue.
const jobs = Array.from({ length: 5 }, (_, index) => products.flatMap(product => {
  const route = product.site.routes[index];
  return route ? [{ ...route, product }] : [];
})).flat();
await runProbes(jobs, { onResult: (job, result) => job.product.result(result) });
