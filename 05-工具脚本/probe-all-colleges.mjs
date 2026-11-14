// 全量探测：21 个学院站点的「培养方案」入口（Playwright 过反爬）
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import fs from 'node:fs';
const pwPath = HOME + '/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.js';
const exe = HOME + '/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const { pathToFileURL } = await import('node:url');
const _pw = await import(pathToFileURL(pwPath).href);
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);
const _sc = await import(pathToFileURL(HOME + '/Desktop/WPS Comate大赛/高级赛道/02-后端源码/src/schoolColleges.js').href);
const SCHOOL_COLLEGES = _sc.SCHOOL_COLLEGES || _sc.default.SCHOOL_COLLEGES;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent: UA, locale: 'zh-CN', viewport: { width: 1366, height: 900 } });

const results = [];

async function probe(college) {
  const host = college.host;
  if (!host) return { college: college.name, host: '', hits: [], note: 'no-host' };
  const page = await ctx.newPage();
  const hits = [];
  try {
    await page.goto(`https://${host}/`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2500);
    // 收集站内链接
    const links = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => ({ text: (a.textContent || '').replace(/\s+/g, ' ').trim(), href: a.href })).filter((x) => x.href));
    for (const l of links) {
      if (/培养方案|培养计划|课程设置|教学计划/.test(l.text)) hits.push({ text: l.text.slice(0, 40), href: l.href });
    }
    // 再往「人才培养/本科教育」栏目走一层
    const navs = links.filter((l) => /人才培养|本科教育|教学工作|教育教学|本科生/.test(l.text) && l.href.includes(host)).slice(0, 3);
    for (const n of navs) {
      try {
        await page.goto(n.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1500);
        const ls = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => ({ text: (a.textContent || '').replace(/\s+/g, ' ').trim(), href: a.href })).filter((x) => x.href));
        for (const l of ls) if (/培养方案|培养计划|课程设置|教学计划/.test(l.text)) hits.push({ text: l.text.slice(0, 40), href: l.href });
      } catch { /* 单页失败忽略 */ }
    }
  } catch (e) {
    return { college: college.name, host, hits, note: 'home-fail: ' + e.message.slice(0, 40) };
  } finally { await page.close(); }
  return { college: college.name, host, hits: hits.slice(0, 12) };
}

for (let i = 0; i < SCHOOL_COLLEGES.length; i += 3) {
  const batch = SCHOOL_COLLEGES.slice(i, i + 3);
  const rs = await Promise.all(batch.map((c) => probe(c)));
  results.push(...rs);
  for (const r of rs) console.log(`${r.college}\t${r.host}\thits=${r.hits.length}${r.note ? '  ' + r.note : ''}`);
}

fs.writeFileSync('curriculum-probe.json', JSON.stringify(results, null, 2), 'utf8');
console.log('\n写入 curriculum-probe.json');
await browser.close();
