import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "dist");
const { sites, updatedAt } = JSON.parse(await readFile(path.join(root, "src/sites.json"), "utf8"));
const routeIds = ['telecom', 'mobile', 'unicom', 'cloudfront', 'cloudfront-alias'];
const origins = sites.flatMap(site => site.routes.map(route => route.url));
const csp = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src ${origins.join(' ')}; object-src 'none'; base-uri 'none'`;
const base = new URL(process.env.PUBLIC_SITE_URL || "https://universeacg.github.io/");
if (!base.pathname.endsWith("/")) base.pathname += "/";
if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("PUBLIC_SITE_URL must be a public HTTPS URL");
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
if (sites.length !== 3 || new Set(sites.map((site) => site.id)).size !== 3) throw new Error("Expected three distinct products");
for (const site of sites) {
  if (!/^(game|ai|video)$/.test(site.id)) throw new Error("Unknown product");
  if (JSON.stringify(site.routes.map(route => route.id)) !== JSON.stringify(routeIds)) throw new Error("Expected five fixed routes");
  for (const entry of [site.main, ...site.routes.map(route => route.url)]) {
    const url = new URL(entry);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Invalid site entry");
  }
}
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10M7 17 17 7"/></svg>';
const external = (url, label, cls = "") => `<a href="${esc(url)}" class="${cls}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only">（在新窗口打开）</span></a>`;
function group(site) {
  const routes = [{ id: 'main', label: '主站', url: site.main }, ...site.routes];
  return `<section data-product="${site.id}" data-label="${esc(site.label)}" aria-labelledby="title-${site.id}" class="product">
<h2 id="title-${site.id}">${esc(site.name)}<span>${esc(site.label)}</span></h2>
<a data-default href="${esc(site.main)}" class="entry primary" target="_blank" rel="noopener noreferrer"><span class="entry-title"><span data-visit-label>访问${esc(site.label)} · 主站</span><small data-visit-domain>${esc(new URL(site.main).hostname)}</small></span>${arrow}<span class="sr-only">（在新窗口打开）</span></a>
<p class="route-status" data-status role="status" aria-live="polite">可直接访问任意入口；启用 JavaScript 后自动选择本次测速最快的线路。</p>
<ul>${routes.map(route => `<li class="route-row"><a href="${esc(route.url)}" data-route="${route.id}" data-label="${esc(route.label)}" class="entry" target="_blank" rel="noopener noreferrer"><span class="entry-title">${esc(route.label)}<small>${esc(new URL(route.url).hostname)}</small></span><span class="probe-result" data-result="${route.id}"></span>${arrow}<span class="sr-only">（在新窗口打开）</span></a><button type="button" data-select="${route.id}" hidden aria-label="将${esc(route.label)}设为默认入口" aria-pressed="false">选用</button></li>`).join("")}</ul>
<p class="route-note">线路名称仅作区分；测速由当前浏览器下载同一小文件完成，不代表运营商识别。结果仅在本页使用。</p>
<div class="app-downloads" aria-label="${esc(site.name)} 应用下载"><h3>下载 App</h3>
${external("https://paradox.uacg.moe/official-apk/UACG-" + site.id + ".apk", "下载 Android APK · 官方版", "entry primary")}
<details><summary>PWA 网页应用 · 安装到桌面</summary>
<p>在系统浏览器打开${esc(site.label)}站，选择浏览器菜单中的“安装应用”或“添加到主屏幕”；iPhone / iPad 可从分享菜单添加。</p>
${external(site.main, "打开" + esc(site.label) + "站安装 PWA", "entry")}
<p class="route-note">PWA 无需 APK，安装后仍需要网络。也可进入上方测速推荐的线路，再从侧栏“下载 App”安装。</p>
</details></div></section>`;
}
function render(site) {
  const prefix = site ? "../" : "./";
  const title = site ? `${site.name} ${site.label}入口与备用地址 · 回家的路` : "UACG 官方入口与备用地址 · 回家的路";
  const description = site ? `${site.name} ${site.label}主站与备用入口地址发布页。收藏回家的路，访问主站、备用入口或 UACG Telegram 频道。` : "UACG 地址发布页，汇集 UACG GAMES 游戏、UACG AI 角色对话和 UACG 视频的主站与备用入口。收藏回家的路，方便下次访问。";
  const route = site ? `${site.id}/` : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="google-site-verification" content="YaAspV9E1niy2bfqfDJ4NW_gZcO2cXubI6m06mN0ZCU">
<meta name="msvalidate.01" content="6DBD7C19D09CD7EB475B6F0A082B5A91">
<meta name="yandex-verification" content="0cc74f539be8b917">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff8fa">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111216">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="referrer" content="no-referrer">
<link rel="canonical" href="${esc(new URL(route, base))}">
<meta property="og:type" content="website">
<meta property="og:locale" content="zh_CN">
<meta property="og:site_name" content="UACG 回家的路">
<meta property="og:url" content="${esc(new URL(route, base))}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(new URL("assets/icon-512.png", base))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(new URL("assets/icon-512.png", base))}">
<link rel="icon" href="${prefix}assets/uacg-logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="${prefix}assets/style.css">
<script type="module" src="${prefix}assets/routes.mjs"></script>
</head>
<body>
<a class="skip-link" href="#main">跳到访问入口</a>
<div class="page">
<header><a class="brand" href="${prefix}" aria-label="UACG 回家的路首页"><img src="${prefix}assets/uacg-logo.svg" alt="" width="40" height="40"><span>UACG</span></a><h1>回家的路</h1></header>
<main id="main">${(site ? [site] : sites).map(group).join("\n")}</main>
<footer>${site ? `<nav aria-label="其他发布页"><a href="../">全部入口</a>${sites.filter((s) => s.id !== site.id).map((s) => `<a href="../${s.id}/">${esc(s.label)}</a>`).join("")}</nav>` : ""}${external("https://t.me/ZfIz49SW2tQ0M2E9", "TG 频道")}</footer>
</div>
</body>
</html>`;
}
// Preserve existing generated/verification files; overwrite the files owned by this build.
await mkdir(path.join(out, "assets"), { recursive: true });
await cp(path.join(root, "src/assets"), path.join(out, "assets"), { recursive: true });
await writeFile(path.join(out, "index.html"), render());
for (const site of sites) {
  await mkdir(path.join(out, site.id), { recursive: true });
  await writeFile(path.join(out, site.id, "index.html"), render(site));
}
await writeFile(path.join(out, ".nojekyll"), "");
await writeFile(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", base)}\n`);
await writeFile(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["", ...sites.map((site) => `${site.id}/`)].map((route) => `<url><loc>${esc(new URL(route, base))}</loc><lastmod>${updatedAt}</lastmod></url>`).join("")}</urlset>`);
await writeFile(path.join(out, "_headers"), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: ${csp}; frame-ancestors 'none'\n  Cache-Control: public, max-age=0, must-revalidate\n`);
console.log(`Built ${sites.length + 1} UACG address pages with ${sites.reduce((count, site) => count + site.routes.length + 1, 0)} business entry URLs.`);

await cp(path.join(root, "src/verification"), out, { recursive: true });
const indexNowKey = process.env.INDEXNOW_KEY?.trim();
if (indexNowKey) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(indexNowKey)) throw new Error("Invalid INDEXNOW_KEY");
  await writeFile(path.join(out, `${indexNowKey}.txt`), indexNowKey);
}
