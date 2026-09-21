import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "dist");
const { sites, updatedAt } = JSON.parse(await readFile(path.join(root, "src/sites.json"), "utf8"));
const entries = [["main", "主站"], ["entry2", "备用 1"], ["entry3", "备用 2"], ["cdn", "备用 3"], ["cdnAlias", "备用 4"]];
const base = new URL(process.env.PUBLIC_SITE_URL || "https://universeacg.github.io/");
if (!base.pathname.endsWith("/")) base.pathname += "/";
if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("PUBLIC_SITE_URL must be a public HTTPS URL");
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
if (sites.length !== 3 || new Set(sites.map((site) => site.id)).size !== 3) throw new Error("Expected three distinct products");
for (const site of sites) {
  if (!/^(game|ai|video)$/.test(site.id)) throw new Error("Unknown product");
  for (const [key] of entries) {
    const url = new URL(site[key]);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Invalid site entry");
  }
}
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10M7 17 17 7"/></svg>';
const external = (url, label, cls = "") => `<a href="${esc(url)}" class="${cls}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only">（在新窗口打开）</span></a>`;
function group(site) {
  return `<section aria-labelledby="title-${site.id}" class="product"><h2 id="title-${site.id}">${esc(site.name)}<span>${esc(site.label)}</span></h2><ul>${entries.map(([key, label]) => `<li>${external(site[key], `<span class="entry-title">${label}</span>${arrow}`, `entry${key === "main" ? " primary" : ""}`)}</li>`).join("")}</ul></section>`;
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
await rm(out, { recursive: true, force: true });
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
await writeFile(path.join(out, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'\n  Cache-Control: public, max-age=0, must-revalidate\n");
console.log(`Built ${sites.length + 1} UACG address pages with ${sites.length * entries.length} business entry URLs.`);

await cp(path.join(root, "src/verification"), out, { recursive: true });
const indexNowKey = process.env.INDEXNOW_KEY?.trim();
if (indexNowKey) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(indexNowKey)) throw new Error("Invalid INDEXNOW_KEY");
  await writeFile(path.join(out, `${indexNowKey}.txt`), indexNowKey);
}
