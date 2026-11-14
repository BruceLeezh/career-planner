// 培养方案全量重建 v2：严格区分章节类型，输出预览
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

const norm = (s) => String(s || '').replace(/[\s（）()·]/g, '').replace(/专业$/, '').replace(/方向$/, '');
const stripParen = (s) => String(s || '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');

function kindOf(title, name) {
  const t = String(title || '') + ' ' + String(name || '');
  if (/国际学生|国际班|留学生|港澳台/.test(t)) return 'intl';
  if (/第二学士/.test(t)) return 'second';
  if (/辅修/.test(t)) return 'minor';
  if (/中南大\s*[-—]|3\+1|2\+2|CIMA|CPAC|ACCA|SKEMA|雷恩|卡迪夫|拉夫堡|利兹|长崎|格拉斯哥|兰卡斯特/.test(t)) return 'joint';
  if (/实验班|双学位|拔尖|卓越|英才|试验班/.test(t)) return 'variant';
  return 'normal';
}

/* ---------- 解析章节 ---------- */
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
    const before = text.slice(Math.max(0, a - 900), a).replace(/\s+/g, '');
    const titles = [...before.matchAll(/([^·。]{2,52}?培养方案)/g)]
      .map((m) => m[1])
      .filter((x) => !/^(中南财经政法大学)?(2024版)?(本科专业)?(全程)?培养方案$/.test(x))
      .filter((x) => !/^中南财经政法大学/.test(x) && !/^2024版本科专业/.test(x));
    const title = titles.length ? titles[titles.length - 1] : name + '全程培养方案';
    const inclM = /(?:包括\s*专业|专业\s*包括)(?:[（(]\s*代码\s*[)）])?\s*[：:]\s*([^。]{2,130})/.exec(head);
    const incl = inclM
      ? inclM[1].replace(/\s+/g, ' ')
          .split(/[、，,]/)
          .map((x) => x.replace(/[（(]\s*\d{6}[A-Z]?\s*[)）]?/g, '').replace(/[\d\s()（）]/g, '').trim())
          .filter((x) => x.length >= 2 && x.length <= 24)
      : [];
    const courses = extractCourses(seg);
    sections.push({ book: b.lab, idx: i, name, title, incl, n: courses.length, courses, kind: kindOf(title || name, name), seg });
  }
}

/* ---------- 每专业匹配 ---------- */
function matchFor(major) {
  const nm = norm(major);
  const base = norm(stripParen(major));
  const isVariantMajor = /实验班|双学位|拔尖|卓越|试验班/.test(major);
  const isJointMajor = /中南大|3\+1|2\+2|中外合作/.test(major);
  const cands = [];
  for (const s of sections) {
    if (s.kind === 'intl' || s.kind === 'second' || s.kind === 'minor') continue;
    const sn = norm(s.name);
    const sbase = norm(stripParen(s.name));
    const isClass = /类$/.test(String(s.name).replace(/专业$/, '')) || /类（/.test(String(s.name));
    let score = 0;
    if (s.kind === 'normal') {
      if (sn === nm) score = 100;
      else if (sbase === base && base.length >= 2) score = 90;
      else if (isClass && s.incl.some((x) => norm(x) === nm || norm(stripParen(x)) === base)) score = 95;
    } else if (s.kind === 'variant' && isVariantMajor) {
      if (sn === nm) score = 130;
      else if (sbase === base) score = 125;
    } else if (s.kind === 'joint' && isJointMajor) {
      if (sn === nm || sbase === base) score = 120;
    }
    if (score) cands.push({ s, score });
  }
  cands.sort((x, y) => y.score - x.score || y.s.n - x.s.n);
  return cands;
}

const majorsAll = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));

/* ---------- 预览 ---------- */
const db = new DatabaseSync(ROOT + '/05-工具脚本/_merged.sqlite', { readOnly: true });
const cur = new Map(db.prepare('SELECT major, json_array_length(courses) n, sourceDoc FROM curriculums').all().map((r) => [r.major, r]));
db.close();

console.log('专业数:', majorsAll.length);
console.log('');
let noMatch = [];
let changed = 0;
for (const { college, major } of majorsAll) {
  const c = matchFor(major);
  const best = c[0];
  const now = cur.get(major);
  const nowN = now ? now.n : 0;
  const bestN = best ? best.s.n : 0;
  const flag = !best ? 'NO_MATCH' : Math.abs(nowN - bestN) > 0 ? 'DIFF' : 'OK';
  if (!best) noMatch.push(college + '/' + major);
  if (flag !== 'OK') changed++;
  console.log(
    flag.padEnd(9),
    (college + '/' + major).padEnd(30),
    `现状${String(nowN).padStart(4)} →`,
    best ? `${String(bestN).padStart(4)}门 [${best.score}] ${best.s.title || best.s.name} (${best.s.kind})` : '无匹配'
  );
}
console.log('\n需调整:', changed, '| 无匹配:', noMatch.length);
console.log('无匹配清单:', noMatch.join('、'));
