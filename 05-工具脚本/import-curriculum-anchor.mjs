// 锚点法解析培养方案合订本：「一、专业（类）名称…专业名称：X」切段 → 抽课程 → 入库
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = HOME + '/Desktop/WPS Comate大赛/高级赛道';
const _sc = await import(pathToFileURL(ROOT + '/02-后端源码/src/schoolColleges.js').href);
const SCHOOL_COLLEGES = _sc.SCHOOL_COLLEGES || _sc.default.SCHOOL_COLLEGES;
const _cb = await import(pathToFileURL(ROOT + '/02-后端源码/src/curriculumBuild.js').href);
const { extractCourses, classifyCourses } = _cb;

const FILES = [
  { path: ROOT + '/05-工具脚本/curriculum-shangce.txt', label: '2024版上册' },
  { path: ROOT + '/05-工具脚本/curriculum-xiace.txt', label: '2024版下册' },
];
const majorsAll = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));
const norm = (s) => String(s || '').replace(/[\s（）()·]/g, '').replace(/专业$/, '');

function resolve(name) {
  const n = norm(name);
  let hit = majorsAll.find((m) => norm(m.major) === n);
  if (hit) return [hit];
  const base = norm(String(name).replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, ''));
  hit = majorsAll.find((m) => norm(m.major.replace(/（[^）]*）/g, '')) === base);
  if (hit) return [hit];
  const parts = String(name).split(/[+＋]/).map((x) => x.replace(/（[^）]*）/g, '').replace(/专业.*$/, '').trim()).filter(Boolean);
  if (parts.length > 1) {
    const out = parts.map((p) => majorsAll.find((m) => norm(m.major) === norm(p))).filter(Boolean);
    if (out.length) return out;
  }
  hit = majorsAll.find((m) => norm(m.major).includes(base) || base.includes(norm(m.major)));
  return hit ? [hit] : [];
}

const sections = [];
for (const f of FILES) {
  const text = fs.readFileSync(f.path, 'utf8');
  const anchors = [...text.matchAll(/一\s*、\s*专业\s*[（(]?\s*类?\s*[)）]?\s*名称/g)].map((m) => m.index);
  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i];
    const end = i + 1 < anchors.length ? anchors[i + 1] : Math.min(text.length, start + 90000);
    const seg = text.slice(start, end);
    const nameM = /专业名称[：:]\s*([^。\n]{2,30})/.exec(seg);
    if (!nameM) continue;
    const name = nameM[1].replace(/\s+/g, '').replace(/。$/, '');
    const courses = extractCourses(seg);
    if (courses.length < 8) continue;
    sections.push({ file: f.label, name, courses, targets: resolve(name) });
  }
}

const best = new Map();
for (const s of sections) {
  if (!s.targets.length) continue;
  for (const t of s.targets) {
    const key = `${t.college}|${t.major}`;
    const prev = best.get(key);
    if (!prev || s.courses.length > prev.courses.length) best.set(key, { ...t, src: s.name, file: s.file, courses: s.courses });
  }
}
console.log(`锚点段落 ${sections.length} | 映射专业 ${best.size}`);

const db = new DatabaseSync(ROOT + '/02-后端源码/data.sqlite');
const now = new Date().toISOString();
let ins = 0, upd = 0, skip = 0;
for (const [, v] of best) {
  const graded = classifyCourses(v.courses).map((c) => ({
    code: c.code, name: c.name.replace(/\s+/g, ''), credit: String(c.credit || ''),
    type: c.type, core: c.core, term: c.term ? String(c.term) : '',
  }));
  const exist = db.prepare('SELECT id, courses FROM curriculums WHERE college = ? AND major = ? AND grade = ?').all(v.college, v.major, '2024')[0];
  if (exist) {
    let old = 0; try { old = JSON.parse(exist.courses || '[]').length; } catch {}
    if (graded.length > old) {
      db.prepare('UPDATE curriculums SET courses=?, sourceDoc=?, updatedAt=?, anchor=?, category=? WHERE id=?')
        .run(JSON.stringify(graded), `本科生院《${v.file}》官方发布（${v.src}）`, now, v.major, '培养方案', exist.id);
      upd++;
    } else skip++;
  } else {
    db.prepare('INSERT INTO curriculums (college, major, grade, anchor, category, courses, sourceDoc, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(v.college, v.major, '2024', v.major, '培养方案', JSON.stringify(graded), `本科生院《${v.file}》官方发布（${v.src}）`, now, now);
    ins++;
  }
}

const all = db.prepare('SELECT college, major, grade, courses FROM curriculums').all();
const cov = new Set(all.map((r) => r.major));
console.log(`入库：新增 ${ins} 更新 ${upd} 跳过 ${skip} | 库内 ${all.length} 条 | 覆盖专业 ${cov.size}/${majorsAll.length}`);
const miss = majorsAll.filter((m) => !cov.has(m.major));
console.log('未覆盖（' + miss.length + '）:', miss.map((m) => m.major).join('、'));
const totCourses = all.reduce((s, r) => { try { return s + JSON.parse(r.courses || '[]').length; } catch { return s; } }, 0);
console.log('课程总数:', totCourses);
db.close();
