// 培养方案全量审计：解析官方章节 → 计算每专业应有的章节 → 对比数据库现状
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = HOME + '/Desktop/WPS Comate大赛/高级赛道';
const _sc = await import(pathToFileURL(ROOT + '/02-后端源码/src/schoolColleges.js').href);
const SCHOOL_COLLEGES = _sc.SCHOOL_COLLEGES || _sc.default.SCHOOL_COLLEGES;
const { extractCourses, classifyCourses } = await import(pathToFileURL(ROOT + '/02-后端源码/src/curriculumBuild.js').href);

const BOOKS = [
  { p: ROOT + '/05-工具脚本/curriculum-shangce.txt', lab: '2024版上册' },
  { p: ROOT + '/05-工具脚本/curriculum-xiace.txt', lab: '2024版下册' },
];

const norm = (s) => String(s || '').replace(/[\s（）()·]/g, '').replace(/专业$/, '');

/** 章节类型判定 */
function classify(title, name) {
  const t = String(title || '') + ' ' + String(name || '');
  if (/国际学生|国际班|留学生|港澳台/.test(t)) return 'intl';
  if (/第二学士/.test(t)) return 'second';
  if (/辅修/.test(t)) return 'minor';
  if (/中南大\s*[-—]|3\+1|2\+2|CIMA|CPAC|ACCA|SKEMA|雷恩|卡迪夫|拉夫堡|利兹|长崎|格拉斯哥|兰卡斯特/.test(t)) return 'joint';
  if (/实验班|双学位|拔尖|卓越|英才/.test(t)) return 'variant';
  return 'normal';
}

/* ---------- 1. 解析全部章节 ---------- */
const sections = [];
for (const b of BOOKS) {
  const text = fs.readFileSync(b.p, 'utf8');
  const anchors = [...text.matchAll(/一\s*、\s*专业\s*[（(]?\s*类?\s*[)）]?\s*名称/g)].map((m) => m.index);
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const seg = text.slice(a, i + 1 < anchors.length ? anchors[i + 1] : Math.min(text.length, a + 90000));
    const head = seg.slice(0, 700).replace(/\s+/g, ' ');
    const nm = /专业[类]?\s*名称[：:]\s*([^。]{2,36})/.exec(head);
    if (!nm) continue;
    const name = nm[1].replace(/\s+/g, '');
    // 标题：锚点前 700 字内最后一个「XX培养方案」，排除页眉与重复
    const before = text.slice(Math.max(0, a - 700), a).replace(/\s+/g, ' ');
    const titles = [...before.matchAll(/([^ ·]{2,44}?(?:专业|类)(?:（[^）]{0,22}）)?(?:全程)?培养方案)/g)]
      .map((m) => m[1].replace(/\s+/g, ''))
      .filter((x) => !/^中南财经政法大学/.test(x));
    const title = titles.length ? titles[titles.length - 1] : '';
    const inclM = /(?:包括专业|专业包括)[：:]\s*([^。]{2,110})/.exec(head);
    const incl = inclM
      ? inclM[1]
          .replace(/\s+/g, ' ')
          .split(/[、，,]/)
          .map((x) => x.replace(/[（(]\s*\d{6}[A-Z]?\s*[)）]?/g, '').replace(/[\d\s()（）]/g, '').trim())
          .filter((x) => x.length >= 2 && x.length <= 20)
      : [];
    const courses = extractCourses(seg);
    sections.push({
      book: b.lab, idx: i, name, title, incl, courses,
      n: courses.length,
      kind: classify(title || name, name),
    });
  }
}

console.log('=== 章节解析 ===');
console.log('章节总数:', sections.length);
const byKind = {};
for (const s of sections) byKind[s.kind] = (byKind[s.kind] || 0) + 1;
console.log('类型分布:', JSON.stringify(byKind));

/* ---------- 2. 计算每个专业应匹配的章节 ---------- */
const majorsAll = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));

function candidatesFor(major) {
  const nm = norm(major);
  const base = norm(String(major).replace(/（[^）]*）/g, ''));
  const out = [];
  for (const s of sections) {
    let score = 0;
    // incl 明示（最权威）
    if (s.incl.some((x) => norm(x) === nm || norm(x) === base)) score = 100;
    // 章节名精确
    if (!score) {
      const sn = norm(s.name);
      const sbase = norm(String(s.name).replace(/（[^）]*）/g, ''));
      if (sn === nm) score = 100;
      else if (sbase === base && base.length >= 2) score = 80;
    }
    if (!score) continue;
    if (s.kind === 'intl' || s.kind === 'second' || s.kind === 'minor') score -= 200; // 强排除
    else if (s.kind === 'joint') score -= 40;
    else if (s.kind === 'variant') score -= 20;
    out.push({ section: s, score });
  }
  return out.sort((x, y) => y.score - x.score || y.section.n - x.section.n);
}

/* ---------- 3. 对比数据库 ---------- */
const db = new DatabaseSync(ROOT + '/05-工具脚本/_merged.sqlite', { readOnly: true });
const rows = db.prepare('SELECT college, major, grade, json_array_length(courses) n, sourceDoc, courses FROM curriculums').all();
const dbMap = new Map(rows.map((r) => [r.major, r]));

console.log('\n=== 逐专业核对 ===');
const problems = [];
for (const { college, major } of majorsAll) {
  const cur = dbMap.get(major);
  const cands = candidatesFor(major);
  const best = cands[0];
  if (!cur) {
    problems.push({ major, type: 'MISSING', detail: cands.length ? `有候选章节 ${best.section.title || best.section.name}(${best.section.n}门)` : '无任何匹配章节' });
    continue;
  }
  if (!best) {
    problems.push({ major, type: 'NO_SOURCE', detail: `库中${cur.n}门，但官方章节无匹配（来源：${(cur.sourceDoc || '').slice(0, 46)}）` });
    continue;
  }
  // 现状来源章节名
  const srcName = (/(?:（)([^）]*)(?:）)\s*$/.exec(cur.sourceDoc || '') || [])[1] || '';
  const curIntl = /国际学生|国际班|第二学士|辅修/.test(cur.sourceDoc || '');
  const bestKind = best.section.kind;
  const diffN = Math.abs(cur.n - best.section.n);
  if (curIntl && best.score >= 90) {
    problems.push({ major, type: 'WRONG_SOURCE_INTL', detail: `现状 ${cur.n}门(国际/第二学士) → 应为 ${best.section.n}门「${best.section.title || best.section.name}」` });
  } else if (best.score >= 90 && diffN > 8) {
    problems.push({ major, type: 'COUNT_MISMATCH', detail: `现状 ${cur.n}门 ← ${srcName || '?'} → 应为 ${best.section.n}门「${best.section.title || best.section.name}」` });
  }
  // 课程首门汉语特征（国际学生）
  let cs = [];
  try { cs = JSON.parse(cur.courses || '[]'); } catch {}
  if (cs.length && /汉语精读|汉语听说|法商汉语|基础汉语|中国文化（/.test(cs[0].name) && bestKind !== 'intl') {
    const already = problems.some((p) => p.major === major);
    if (!already) problems.push({ major, type: 'INTL_COURSES', detail: `课表含国际学生汉语课，应为「${best.section.title || best.section.name}」${best.section.n}门` });
  }
}

console.log('问题条目:', problems.length);
for (const p of problems) console.log(`  [${p.type}] ${p.major} — ${p.detail}`);

/* ---------- 4. 章节使用率（找未被使用的正常章节） ---------- */
const usedTitles = new Set(rows.map((r) => (/(?:（)([^）]*)(?:）)\s*$/.exec(r.sourceDoc || '') || [])[1]).filter(Boolean));
console.log('\n=== 未被任何专业使用的 normal 章节 ===');
for (const s of sections.filter((x) => x.kind === 'normal')) {
  if (!usedTitles.has(s.title) && !usedTitles.has(s.name)) console.log(`  ${s.book}${s.idx} | ${s.name} | ${s.n}门 | ${s.title}`);
}

db.close();
