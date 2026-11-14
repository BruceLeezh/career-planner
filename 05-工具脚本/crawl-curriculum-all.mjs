// 培养方案全量抓取：21 学院 → 栏目页 → 详情页 → PDF → 课程抽取
const HOME = process.env.USERPROFILE || process.env.HOME || '';
// 依赖：Playwright（过反爬，复用 Cookie）+ pdfjs-dist（后端依赖）+ curriculumBuild.extractCourses
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = HOME + '/Desktop/WPS Comate大赛/高级赛道';
const pwPath = HOME + '/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.js';
const exe = HOME + '/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const _pw = await import(pathToFileURL(pwPath).href);
const chromium = _pw.chromium || _pw.default.chromium;
const _sc = await import(pathToFileURL(ROOT + '/02-后端源码/src/schoolColleges.js').href);
const SCHOOL_COLLEGES = _sc.SCHOOL_COLLEGES || _sc.default.SCHOOL_COLLEGES;
const _pdf = await import(pathToFileURL(ROOT + '/02-后端源码/src/crawler/pdf.js').href);
const extractPdfText = _pdf.extractPdfText || _pdf.default.extractPdfText;
const _cb = await import(pathToFileURL(ROOT + '/02-后端源码/src/curriculumBuild.js').href);
const extractCourses = _cb.extractCourses;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent: UA, locale: 'zh-CN' });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function solveHost(host) {
  const p = await ctx.newPage();
  try { await p.goto(`https://${host}/`, { waitUntil: 'domcontentloaded', timeout: 25000 }); await p.waitForTimeout(1800); }
  catch { /* 忽略 */ } finally { await p.close(); }
}

async function getHtml(url, timeout = 25000) {
  try {
    const r = await ctx.request.get(url, { timeout, headers: { 'User-Agent': UA } });
    let html = await r.text();
    if (html.length > 3000 && /<a\s/i.test(html) && !/navigator\.webdriver/.test(html)) return html;
  } catch { /* 走浏览器 */ }
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await p.waitForTimeout(1500);
    return await p.content();
  } catch { return ''; } finally { await p.close(); }
}

/** 在列表页收集详情链接 */
function collectItems(html, base) {
  const $ = cheerio.load(html);
  const items = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href'); const text = ($(a).text() || '').replace(/\s+/g, ' ').trim();
    if (!href || !text) return;
    if (!/培养方案|培养计划/.test(text)) return;
    let abs; try { abs = new URL(href, base).href; } catch { return; }
    if (!/page\.htm|\/info\/|\.pdf$|\.docx?$/i.test(abs)) return;
    items.push({ title: text, href: abs });
  });
  return [...new Map(items.map((i) => [i.href, i])).values()];
}

/** 从详情页找 PDF 地址（iframe viewer 的 file 参数 / 附件链接） */
function findPdf(html, base) {
  const $ = cheerio.load(html);
  let pdf = null;
  $('iframe').each((_, f) => {
    const src = $(f).attr('src') || '';
    const m = /[?&]file=([^&]+)/.exec(src);
    if (m) { try { pdf = new URL(decodeURIComponent(m[1]), base).href; } catch {} }
  });
  if (!pdf) {
    $('a').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (/\.pdf$/i.test(href)) { try { pdf = new URL(href, base).href; } catch {} }
    });
  }
  return pdf;
}

function titleMajor(title) {
  let t = String(title || '')
    .replace(/^\d{4}-\d{2}-\d{2}\s*/, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/20\d{2}\s*(修订版|版)?/g, '')
    .replace(/全程培养方案|培养方案|培养计划/g, '')
    .replace(/适用于.*$/, '')
    .replace(/\s+/g, '')
    .trim();
  return t;
}

/** 从正文里解析「包括专业」列表 */
function listedMajors(text) {
  const m = /包括专业[：:]\s*([^\n]{4,160})/.exec(text);
  if (!m) return [];
  return m[1].split(/[、,，]/).map((s) => s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 16);
}

const results = [];
const allMajors = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));

for (const college of SCHOOL_COLLEGES) {
  const host = college.host;
  if (!host) { log('跳过（无站点）', college.name); continue; }
  await solveHost(host);
  const home = await getHtml(`https://${host}/`);
  const $h = cheerio.load(home);
  // 找「培养方案」栏目入口：优先 list.htm
  const cands = [];
  $h('a').each((_, a) => {
    const href = $h(a).attr('href'); const text = ($h(a).text() || '').replace(/\s+/g, ' ').trim();
    if (!href || !/培养方案|培养计划|课程设置|教学计划/.test(text)) return;
    let abs; try { abs = new URL(href, `https://${host}/`).href; } catch { return; }
    if (abs.includes(host)) cands.push({ text, href: abs, score: /list\.htm/.test(abs) ? 2 : 1 });
  });
  // 二级导航兜底
  if (!cands.length) {
    const navs = [];
    $h('a').each((_, a) => {
      const href = $h(a).attr('href'); const text = ($h(a).text() || '').trim();
      if (href && /人才培养|本科教育|教学工作|教育教学/.test(text)) { try { navs.push(new URL(href, `https://${host}/`).href); } catch {} }
    });
    for (const n of navs.slice(0, 4)) {
      if (!n.includes(host)) continue;
      const html = await getHtml(n);
      const $n = cheerio.load(html);
      $n('a').each((_, a) => {
        const href = $n(a).attr('href'); const text = ($n(a).text() || '').trim();
        if (!href || !/培养方案|培养计划/.test(text)) return;
        try { const abs = new URL(href, n).href; if (abs.includes(host)) cands.push({ text, href: abs, score: /list\.htm/.test(abs) ? 2 : 1 }); } catch {}
      });
    }
  }
  const listUrl = cands.sort((a, b) => b.score - a.score)[0]?.href;
  if (!listUrl) { log(`✗ ${college.name} 未找到培养方案栏目`); results.push({ college: college.name, host, listUrl: null, items: [] }); continue; }

  const listHtml = await getHtml(listUrl);
  let items = collectItems(listHtml, listUrl);
  // 列表页可能分页：跟进 p 参数（常见 2 页足够）
  if (!items.length) {
    const html2 = await getHtml(listUrl + (listUrl.includes('?') ? '&' : '?') + 'page=1');
    items = collectItems(html2, listUrl);
  }
  log(`→ ${college.name} 栏目 ${listUrl} 详情 ${items.length} 条`);
  results.push({ college: college.name, host, listUrl, items });
}

// 第二阶段：逐条抓 PDF + 抽课程
const dataset = [];
for (const r of results) {
  for (const it of r.items.slice(0, 12)) {
    try {
      let pdfUrl = null, text = '';
      if (/\.pdf$/i.test(it.href)) pdfUrl = it.href;
      else {
        const html = await getHtml(it.href);
        pdfUrl = findPdf(html, it.href);
        if (!pdfUrl) {
          // 网页正文直取
          const $ = cheerio.load(html);
          text = $('.v_news_content, #vsb_content, .wp_articlecontent, article').text().replace(/\s+/g, ' ').trim();
        }
      }
      if (pdfUrl) {
        const resp = await ctx.request.get(pdfUrl, { timeout: 40000, headers: { 'User-Agent': UA } });
        if (resp.ok()) {
          const buf = Buffer.from(await resp.body());
          if (buf.slice(0, 4).toString() === '%PDF') text = await extractPdfText(new Uint8Array(buf));
        }
      }
      const courses = text ? extractCourses(text) : [];
      const majors = listedMajors(text);
      const guess = titleMajor(it.title);
      dataset.push({
        college: r.college, title: it.title, url: it.href, pdf: pdfUrl,
        majors, guessMajor: guess, courseCount: courses.length, courses,
      });
      log(`   ✓ ${r.college} | ${it.title.slice(0, 28)} | 课程 ${courses.length} | 专业 ${majors.join('/') || guess}`);
    } catch (e) {
      log(`   ✗ ${r.college} ${it.title.slice(0, 20)} 失败: ${e.message.slice(0, 40)}`);
    }
  }
}

fs.writeFileSync(ROOT + '/05-工具脚本/curriculum-dataset.json', JSON.stringify(dataset, null, 2), 'utf8');
const totalCourses = dataset.reduce((s, d) => s + d.courseCount, 0);
log(`完成：文档 ${dataset.length} 份，课程合计 ${totalCourses} 门，覆盖专业候选 ${new Set(dataset.flatMap((d) => d.majors.length ? d.majors : [d.guessMajor])).size} 个`);
await browser.close();
