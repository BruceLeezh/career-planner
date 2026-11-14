// 培养方案抓取器 v1：先用已验证的 5 个学院栏目页验证「列表→详情→课程表」抽取质量
const HOME = process.env.USERPROFILE || process.env.HOME || '';
// 反爬策略：Playwright 打开首页过挑战 → 复用 context.request 带 Cookie 抓内页（快）
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';

const pwPath = HOME + '/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.js';
const exe = HOME + '/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const _pw = await import(pathToFileURL(pwPath).href);
const chromium = _pw.chromium || _pw.default.chromium;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const SEEDS = [
  { college: '金融学院', list: 'https://finance.zuel.edu.cn/1116/list.htm' },
  { college: '经济学院', list: 'https://jjxy.zuel.edu.cn/pyfa/list.htm' },
  { college: '外国语学院', list: 'https://wgyxy.zuel.edu.cn/10476/list.htm' },
  { college: '统计与数学学院', list: 'https://tsxy.zuel.edu.cn/14215/list.htm' },
  { college: '哲学院', list: 'https://zxy.zuel.edu.cn/3264/list.htm' },
];

const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent: UA, locale: 'zh-CN' });

async function solve(host) {
  const p = await ctx.newPage();
  try {
    await p.goto(`https://${host}/`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await p.waitForTimeout(2000);
  } catch { /* 忽略 */ } finally { await p.close(); }
}

/** 带 Cookie 取 HTML；若被挑战（长度短且无正文特征）则用浏览器打开一次再取 */
async function fetchHtml(url) {
  let r = await ctx.request.get(url, { timeout: 25000, headers: { 'User-Agent': UA } });
  let html = await r.text();
  if (html.length < 3000 || !/培养方案|课程|学分/.test(html)) {
    const p = await ctx.newPage();
    try {
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await p.waitForTimeout(1800);
      html = await p.content();
    } catch { /* 忽略 */ } finally { await p.close(); }
  }
  return html;
}

function parseCoursesFromTables($) {
  const rows = [];
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td,th').map((_, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length < 3) return;
    const line = cells.join(' | ');
    if (!/[A-Z]\d{3,}/.test(line) && !/学分/.test(line)) return;
    rows.push(cells);
  });
  return rows;
}

const out = [];
for (const seed of SEEDS) {
  const host = new URL(seed.list).host;
  await solve(host);
  const listHtml = await fetchHtml(seed.list);
  const $ = cheerio.load(listHtml);
  const items = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href');
    const text = ($(a).text() || '').replace(/\s+/g, ' ').trim();
    if (!href || !text) return;
    if (!/培养方案|培养计划|专业/.test(text)) return;
    let abs; try { abs = new URL(href, seed.list).href; } catch { return; }
    if (abs === seed.list) return;
    if (!/page\.htm|\.pdf$|\.docx?$/i.test(abs)) return;
    items.push({ text, href: abs });
  });
  const uniq = [...new Map(items.map((i) => [i.href, i])).values()];
  console.log(`\n=== ${seed.college} 列表页链接 ${uniq.length} 条 ===`);
  for (const it of uniq.slice(0, 8)) console.log('  -', it.text.slice(0, 46), '|', it.href.slice(-40));

  // 抽 2 个详情页验证解析质量
  for (const it of uniq.slice(0, 2)) {
    if (/\.pdf$/i.test(it.href)) { out.push({ college: seed.college, title: it.text, href: it.href, type: 'pdf' }); continue; }
    const html = await fetchHtml(it.href);
    const $$ = cheerio.load(html);
    const title = ($$('title').text() || it.text).replace(/\s+/g, ' ').trim();
    const body = $$('body').text().replace(/\s+/g, ' ').trim();
    const tables = parseCoursesFromTables($$);
    const codes = (body.match(/[A-Z]\d{5,7}/g) || []).length;
    out.push({ college: seed.college, title, href: it.href, type: 'html', len: body.length, tableRows: tables.length, courseCodes: codes, sample: tables.slice(0, 3) });
    console.log(`    详情「${title.slice(0, 34)}」 正文${body.length}字 表格行${tables.length} 课程号${codes}`);
    if (tables.length) console.log('      样例:', JSON.stringify(tables[0]).slice(0, 160));
  }
}

fs.writeFileSync('curriculum-crawl-sample.json', JSON.stringify(out, null, 2), 'utf8');
await browser.close();
console.log('\n写出 curriculum-crawl-sample.json');
