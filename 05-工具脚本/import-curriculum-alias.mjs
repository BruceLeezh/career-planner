// 别名补录：把剩余专业按「章节名包含关键字」映射到已解析章节
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const ROOT = HOME + '/Desktop/WPS Comate大赛/高级赛道';
const _sc = await import(pathToFileURL(ROOT + '/02-后端源码/src/schoolColleges.js').href);
const SCHOOL_COLLEGES = _sc.SCHOOL_COLLEGES || _sc.default.SCHOOL_COLLEGES;
const _cb = await import(pathToFileURL(ROOT + '/02-后端源码/src/curriculumBuild.js').href);
const { extractCourses, classifyCourses } = _cb;

const FILES = [{ p: ROOT + '/05-工具脚本/curriculum-shangce.txt', l: '2024版上册' }, { p: ROOT + '/05-工具脚本/curriculum-xiace.txt', l: '2024版下册' }];
const sections = [];
for (const f of FILES) {
  const text = fs.readFileSync(f.p, 'utf8');
  const anchors = [...text.matchAll(/一\s*、\s*专业\s*[（(]?\s*类?\s*[)）]?\s*名称/g)].map((m) => m.index);
  for (let i = 0; i < anchors.length; i++) {
    const seg = text.slice(anchors[i], i + 1 < anchors.length ? anchors[i + 1] : Math.min(text.length, anchors[i] + 90000));
    const nm = /专业名称[：:]\s*([^。\n]{2,30})/.exec(seg);
    if (!nm) continue;
    const courses = extractCourses(seg);
    if (courses.length < 8) continue;
    sections.push({ name: nm[1].replace(/\s+/g, ''), courses, label: f.l });
  }
}

const ALIAS = {
  '保险学': /保险/, '精算学': /精算/, '纪检监察': /纪检监察/, '国际法': /国际法/,
  '大数据管理与应用': /大数据管理与应用/, '审计学': /审计/,
  '人工智能（中外合作办学）': /人工智能/, '会计学（卓越人才实验班）': /会计学（卓越/,
};
const majorsAll = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));
const db = new DatabaseSync(ROOT + '/02-后端源码/data.sqlite');
const cov = new Set(db.prepare('SELECT major FROM curriculums').all().map((r) => r.major));
const now = new Date().toISOString();
let added = 0;
for (const { college, major } of majorsAll) {
  if (cov.has(major)) continue;
  const re = ALIAS[major];
  if (!re) continue;
  const cands = sections.filter((s) => re.test(s.name));
  if (!cands.length) continue;
  const bestS = cands.sort((a, b) => b.courses.length - a.courses.length)[0];
  const courses = classifyCourses(bestS.courses).map((c) => ({ code: c.code, name: c.name.replace(/\s+/g, ''), credit: String(c.credit || ''), type: c.type, core: c.core, term: c.term ? String(c.term) : '' }));
  db.prepare('INSERT INTO curriculums (college, major, grade, anchor, category, courses, sourceDoc, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(college, major, '2024', major, '培养方案', JSON.stringify(courses), `本科生院《${bestS.label}》官方发布（章节：${bestS.name}）`, now, now);
  cov.add(major); added++;
  console.log(`✓ ${college}/${major} ← ${bestS.name} (${courses.length} 门)`);
}
const all = db.prepare('SELECT college, major, courses FROM curriculums').all();
console.log(`\n补录 ${added} 个；总覆盖 ${new Set(all.map((r) => r.major)).size}/88；课程合计 ${all.reduce((s, r) => { try { return s + JSON.parse(r.courses).length; } catch { return s; } }, 0)}`);
console.log('仍未覆盖:', majorsAll.filter((m) => !new Set(all.map((r) => r.major)).has(m.major)).map((m) => m.major).join('、'));
db.close();
