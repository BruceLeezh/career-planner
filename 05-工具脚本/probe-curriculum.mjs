// 探测：某学院站点里与「培养方案」相关的链接（HTML/PDF）
import * as cheerio from 'cheerio';

const HOST = process.argv[2] || 'finance.zuel.edu.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36';

async function get(url, timeout = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'follow' });
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: r.ok, status: r.status, url: r.url, buf };
  } catch (e) {
    return { ok: false, status: 0, url, err: e.message };
  } finally { clearTimeout(t); }
}

const seen = new Set();
const hits = [];

async function scan(url, depth) {
  if (seen.has(url) || depth > 1) return;
  seen.add(url);
  const res = await get(url);
  if (!res.ok || !res.buf) return;
  const ct = res.buf.slice(0, 4).toString();
  const isHtml = ct.startsWith('<') || /html/.test(String(url));
  if (!isHtml) return;
  const html = res.buf.toString('utf8');
  const $ = cheerio.load(html);
  const links = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href');
    const text = ($(a).text() || '').replace(/\s+/g, ' ').trim();
    if (!href) return;
    let abs;
    try { abs = new URL(href, url).href; } catch { return; }
    links.push({ abs, text });
  });
  for (const l of links) {
    if (/培养方案|培养计划|课程设置|教学计划/.test(l.text)) hits.push(l);
    if (/\.(pdf|doc|docx)$/i.test(l.abs) && /培养方案|培养计划/.test(l.text)) hits.push(l);
  }
  // 往「人才培养/本科教育/教学」栏目再走一层
  for (const l of links) {
    if (depth < 1 && /人才培养|本科教育|教学工作|教育教学|培养方案/.test(l.text) && l.abs.includes(HOST)) {
      await new Promise((r) => setTimeout(r, 120));
      await scan(l.abs, depth + 1);
    }
  }
}

const base = `https://${HOST}/`;
await scan(base, 0);
console.log(`HOST=${HOST} 扫描页面=${seen.size} 命中=${hits.length}`);
for (const h of hits.slice(0, 25)) console.log(' -', h.text.slice(0, 40), '|', h.abs);
