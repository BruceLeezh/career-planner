// 培养方案全量重建 v3：目录顺序对齐 → 严格匹配 → 写库
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

const DEPTS = ['哲学院', '经济学院', '财政税务学院', '金融学院', '法学院', '刑事司法学院', '外国语学院',
  '新闻与文化传播学院', '工商管理学院', '会计学院', '公共管理学院', '统计与数学学院', '信息工程学院',
  '中韩新媒体学院', '文澜学院'];
const GROUPS = ['拔尖创新人才实验班全程培养方案', '国际联合教学项目全程培养方案', '双学位实验班全程培养方案',
  '第二学士学位全程培养方案', '国际学生全程培养方案'];

function cleanToc(raw) {
  let x = String(raw).replace(/\s+/g, '');
  x = x.replace(/^目录I?目录/, '').replace(/中南财经政法大学本科专业全程培养方案II?/g, '').replace(/^I+/, '');
  x = x.replace(/^\d+/, '');
  for (const d of DEPTS) if (x.startsWith(d)) { x = x.slice(d.length); break; }
  for (const g of GROUPS) if (x.startsWith(g)) { x = x.slice(g.length); break; }
  return x;
}

const norm = (s) => String(s || '').replace(/[\s（）()·]/g, '').replace(/专业$/, '').replace(/方向$/, '');
const stripParen = (s) => String(s || '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
const baseOf = (s) => norm(stripParen(s)).replace(/[＋]/g, '+').replace(/[、，,]/g, '+').replace(/双学位实验班|双学士学位|双学位|实验班|拔尖创新人才实验班|英才实验班|卓越人才实验班|卓越经管人才实验班|全程培养方案/g, '').replace(/专业$/, '');

function kindOf(title, name) {
  const t = String(title || '') + ' ' + String(name || '');
  if (/国际学生|国际班|留学生|港澳台/.test(t)) return 'intl';
  if (/第二学士/.test(t)) return 'second';
  if (/辅修/.test(t)) return 'minor';
  if (/中南大\s*[-—]|3\+1|2\+2|CIMA|CPAC|ACCA|SKEMA|雷恩|卡迪夫|拉夫堡|利兹|长崎|格拉斯哥|兰卡斯特/.test(t)) return 'joint';
  if (/实验班|双学位|拔尖|卓越|英才|试验班/.test(t)) return 'variant';
  return 'normal';
}

/* ---------- 解析：目录对齐正文锚点 ---------- */
const sections = [];
for (const b of BOOKS) {
  const text = fs.readFileSync(b.p, 'utf8');
  const tocStart = text.search(/目\s*录/);
  const toc = text.slice(tocStart, tocStart + 16000);
  const tocItems = [...toc.matchAll(/([^\n.·]{4,70}?培养方案)\s*[.·]{3,}\s*\d+/g)].map((m) => cleanToc(m[1]));
  const anchors = [...text.matchAll(/一\s*、\s*专业\s*[（(]?\s*类?\s*[)）]?\s*名称/g)].map((m) => m.index);
  if (tocItems.length !== anchors.length) {
    console.log(`!! ${b.lab} 目录 ${tocItems.length} 条 vs 正文 ${anchors.length} 个锚点，不一致`);
  }
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const seg = text.slice(a, i + 1 < anchors.length ? anchors[i + 1] : Math.min(text.length, a + 90000));
    const head = seg.slice(0, 700).replace(/\s+/g, ' ');
    const nm = /专\s*业\s*[（(]?\s*类?\s*[)）]?\s*名\s*称\s*[：:]\s*([^。]{2,40})/.exec(head);
    if (!nm) continue;
    const name = nm[1].replace(/\s+/g, '');
    const title = tocItems[i] || name + '全程培养方案';
    // incl：用代码括号作分隔符
    let incl = [];
    const inclM = /(?:包括\s*专业|专业\s*包括)\s*(?:[（(]\s*代码\s*[)）])?\s*[：:]\s*([^。]{2,140})/.exec(head);
    if (inclM) {
      incl = inclM[1]
        .split(/学制|学位|专业类代码/)[0]
        .replace(/[（(]\s*\d{6}[A-Z]?\s*[)）]?/g, '、')
        .replace(/\s*\d{6}[A-Z]?\s*/g, '、')
        .split(/[、，,]/)
        .map((x) => stripParen(x).replace(/[（）()\s]/g, '').replace(/^\d+/, ''))
        .filter((x) => x.length >= 2 && x.length <= 22 && /[\u4e00-\u9fa5]/.test(x));
    }
    const courses = extractCourses(seg);
    sections.push({ book: b.lab, idx: i, name, title, incl, n: courses.length, courses, kind: kindOf(title, name) });
  }
}

const kinds = {};
for (const s of sections) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
console.log('章节:', sections.length, JSON.stringify(kinds));

/* ---------- 匹配 ---------- */
function matchFor(major) {
  const nm = norm(major);
  const base = baseOf(major);
  const isVariantMajor = /实验班|双学位|双学士学位|拔尖|卓越|试验班/.test(major);
  const isJointMajor = /中南大|3\+1|2\+2|中外合作/.test(major);
  const out = [];
  for (const s of sections) {
    if (s.kind === 'intl' || s.kind === 'second' || s.kind === 'minor') continue;
    const sn = norm(s.name);
    const sbase = baseOf(s.name);
    const isClass = /类$/.test(String(s.name).replace(/专业$/, '')) || /类（/.test(String(s.name)) || s.incl.length >= 2;
    let score = 0;
    if (s.kind === 'normal') {
      if (sn === nm) score = 100;
      else if (sbase === base && base.length >= 2) score = 90;
      else if (isClass && s.incl.some((x) => norm(x) === nm || baseOf(x) === base || norm(stripParen(x)) === nm)) score = 95;
    } else if (s.kind === 'variant' && isVariantMajor) {
      if (sn === nm) score = 130;
      else if (sbase === base) score = 125;
    } else if (s.kind === 'joint' && isJointMajor) {
      if (sn === nm || sbase === base) score = 120;
    }
    if (score) out.push({ s, score });
  }
  out.sort((x, y) => y.score - x.score || y.s.n - x.s.n);
  return out;
}

/* ---------- 特殊：无官方独立方案的专业 ---------- */
const REFERENCE = {
  '供应链管理': { ref: '工商管理类', note: '2025 年新增本科专业，官方 2024 版培养方案未收录；课程参照工商管理类方案，具体以学院当年公布为准' },
  '纪检监察': { ref: '法学类', note: '2025 年新增本科专业（纳入法学类招生），官方 2024 版培养方案未单列；课程参照法学类方案' },
  '人工智能': { ref: '计算机类', note: '官方 2024 版培养方案未单列人工智能专业；课程参照计算机类方案，方向课以信息工程学院当年公布为准' },
  '人工智能（中外合作办学）': { ref: '计算机类', note: '2025 年新增中外合作办学项目（与罗马第一大学），官方 2024 版方案未收录；课程参照计算机类方案' },
  '金融学+法学双学位': { ref: '金融学', note: '2026 年新增双学士学位项目，官方 2024 版方案未收录；课程参照金融学专业方案' },
  '国际经济与贸易+国际法（双学士学位）': { ref: '国际经济与贸易', note: '2025 年新增双学士学位项目，官方 2024 版方案未收录；课程参照国际经济与贸易专业方案' },
  '国际法': { ref: '法学', note: '国际法学院为 2024 年新设学院，官方 2024 版方案仅有「国际法（拔尖人才实验班）」；普通国际法专业课程参照法学专业方案' },
  '大数据管理与应用': { ref: '管理科学与工程类', note: '官方 2024 版方案仅有「大数据管理与应用+金融工程」双学位；普通专业课程参照管理科学与工程类方案' },
};

const SPECIAL = {
  '人文科学试验班': {
    courses: [],
    source: '2025 年新设创新人才项目：第一学年通识教育（文理兼招，宽口径厚基础），学年末可在全校范围内任选专业；不设独立专业课表，分流后按所选专业培养方案执行',
    grade: '2025',
  },
};

/* ---------- 生成结果 ---------- */
const majorsAll = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));
const result = [];
const unmatched = [];

for (const { college, major } of majorsAll) {
  if (SPECIAL[major]) {
    result.push({ college, major, courses: SPECIAL[major].courses, grade: SPECIAL[major].grade, source: SPECIAL[major].source, kind: 'special' });
    continue;
  }
  const cands = matchFor(major);
  const best = cands[0];
  if (best) {
    const s0 = best.s;
    const isBigClass = s0.incl.length >= 2;
    const extra = isBigClass ? `·大类统一方案，含 ${s0.incl.length} 个专业方向（${s0.incl.slice(0, 6).join('/')}），本专业按其中对应方向修读` : '';
    result.push({ college, major, courses: s0.courses, grade: '2024', source: `本科生院《${s0.book}》官方发布（${s0.title}${extra}）`, kind: 'direct', sectionN: s0.n, score: best.score, isBigClass, inclN: s0.incl.length });
    continue;
  }
  // 参照方案
  const refName = REFERENCE[major]?.ref;
  if (refName) {
    const refCands = matchFor(refName);
    if (refCands[0]) {
      result.push({ college, major, courses: refCands[0].s.courses, grade: '2024', source: REFERENCE[major].note + `（参照《${refCands[0].s.book}》${refCands[0].s.title}）`, kind: 'reference' });
      continue;
    }
  }
  unmatched.push(college + '/' + major);
  const _b = baseOf(major);
  const near = sections.filter(x => x.kind !== 'intl' && x.kind !== 'second' && x.kind !== 'minor' && _b.length >= 2 && (baseOf(x.name).includes(_b) || _b.includes(baseOf(x.name)))).map(x => `${x.name}[${x.kind}]${x.n}`);
  console.log('  未匹配', major, '候选:', near.slice(0,4).join(' | ') || '无');
}

/* ---------- 写库 ---------- */
const db = new DatabaseSync(ROOT + '/02-后端源码/data.sqlite');
db.exec('PRAGMA foreign_keys = OFF');
db.prepare('DELETE FROM curriculums').run();
const now = new Date().toISOString();
const ins = db.prepare('INSERT INTO curriculums (college, major, grade, anchor, category, courses, sourceDoc, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)');
let totalCourses = 0;
for (const r of result) {
  const graded = classifyCourses(r.courses).map((c) => ({
    code: c.code, name: c.name.replace(/\s+/g, ''), credit: String(c.credit || ''),
    type: c.type, core: c.core, term: c.term ? String(c.term) : '',
  }));
  totalCourses += graded.length;
  ins.run(r.college, r.major, r.grade, r.major, '培养方案', JSON.stringify(graded), r.source, now, now);
}
db.exec('VACUUM');
db.close();

console.log('\n写入:', result.length, '条 | 课程合计:', totalCourses, '门');
const byKind = {};
for (const r of result) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
console.log('来源类型:', JSON.stringify(byKind));
if (unmatched.length) console.log('仍未覆盖:', unmatched.join('、'));

console.log('\n=== 重点专业核对 ===');
const db2 = new DatabaseSync(ROOT + '/02-后端源码/data.sqlite', { readOnly: true });
for (const m of ['金融学', '法学', '会计学', '会计学（注册会计师）', '工商管理', '市场营销', '旅游管理', '电影学', '人工智能', '保险学', '精算学', '人文科学试验班']) {
  const row = db2.prepare('SELECT json_array_length(courses) n, sourceDoc FROM curriculums WHERE major=?').get(m);
  if (row) console.log(`  ${m.padEnd(18)} ${String(row.n).padStart(4)}门 | ${row.sourceDoc.slice(0, 78)}`);
}
db2.close();
