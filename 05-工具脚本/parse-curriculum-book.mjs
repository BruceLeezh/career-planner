// 解析培养方案合订本（本科生院 2024 版上/下册）：按「XX专业全程培养方案」切段 → 抽课程 → 映射学院
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = HOME + '/Desktop/WPS Comate大赛/高级赛道';
const _sc = await import(pathToFileURL(ROOT + '/02-后端源码/src/schoolColleges.js').href);
const SCHOOL_COLLEGES = _sc.SCHOOL_COLLEGES || _sc.default.SCHOOL_COLLEGES;
const _cb = await import(pathToFileURL(ROOT + '/02-后端源码/src/curriculumBuild.js').href);
const extractCourses = _cb.extractCourses;

const files = process.argv.slice(2);
const HDR = /([\u4e00-\u9fa5A-Za-z0-9（）()·—\-]{2,22}?(?:类)?专业(?:（[^）]{0,16}）)?)全程培养方案/g;
const NOISE = /^(本科|版本|中南财经政法大学|全程|专业|方案|\d+)/;

const majorsAll = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));
const norm = (s) => String(s || '').replace(/[\s（）()·]/g, '').replace(/专业$/, '');

function collegeOf(majorName) {
  const n = norm(majorName);
  let hit = majorsAll.find((m) => norm(m.major) === n);
  if (hit) return { college: hit.college, major: hit.major, exact: true };
  hit = majorsAll.find((m) => norm(m.major).includes(n) || n.includes(norm(m.major)));
  if (hit) return { college: hit.college, major: hit.major, exact: false };
  return null;
}

const sections = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const hits = [];
  let m;
  HDR.lastIndex = 0;
  while ((m = HDR.exec(text)) !== null) {
    const name = m[1].replace(/^[\d\s]+/, '');
    if (NOISE.test(name)) continue;
    hits.push({ name, idx: m.index });
  }
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].idx;
    const end = i + 1 < hits.length ? hits[i + 1].idx : Math.min(text.length, start + 60000);
    const body = text.slice(start, end);
    const courses = extractCourses(body);
    if (!courses.length) continue;
    sections.push({ file: f.split(/[\\/]/).pop(), major: hits[i].name, courses: courses.length, mapped: collegeOf(hits[i].name), first: courses.slice(0, 3).map((c) => `${c.name}(${c.credit})`) });
  }
}

// 同专业取课程最多的一段
const best = new Map();
for (const s of sections) {
  const key = s.major;
  if (!best.has(key) || s.courses > best.get(key).courses) best.set(key, s);
}

console.log(`段落 ${sections.length} 个，去重专业 ${best.size} 个`);
const matched = [...best.values()].filter((s) => s.mapped);
const unmatched = [...best.values()].filter((s) => !s.mapped);
console.log(`匹配到学院: ${matched.length} | 未匹配: ${unmatched.length}`);
console.log('\n--- 匹配示例（前 25）---');
for (const s of matched.slice(0, 25)) console.log(`  ${s.mapped.college} | ${s.mapped.major} ← ${s.major} | ${s.courses} 门 | ${s.first.join(' ')}`);
console.log('\n--- 未匹配（前 30）---');
console.log(unmatched.slice(0, 30).map((s) => `${s.major}(${s.courses})`).join(' / '));

fs.writeFileSync(ROOT + '/05-工具脚本/curriculum-book-sections.json', JSON.stringify([...best.values()], null, 2), 'utf8');
