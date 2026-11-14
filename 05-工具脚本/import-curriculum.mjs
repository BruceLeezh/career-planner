// 把抓取结果写入 data.sqlite 的 curriculums 表（幂等：同 college+major+grade 取课程最多的版本）
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = HOME + '/Desktop/WPS Comate大赛/高级赛道';
const DATA = path.join(ROOT, '05-工具脚本/curriculum-dataset.json');
const DB = path.join(ROOT, '02-后端源码/data.sqlite');

const _sc = await import(pathToFileURL(ROOT + '/02-后端源码/src/schoolColleges.js').href);
const SCHOOL_COLLEGES = _sc.SCHOOL_COLLEGES || _sc.default.SCHOOL_COLLEGES;

const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const db = new DatabaseSync(DB);

const majorsByCollege = Object.fromEntries(SCHOOL_COLLEGES.map((c) => [c.name, c.majors || []]));

/** 从标题里取适用年级（2024级）→ '2024'；没有则不区分版本 */
function gradeOf(title) {
  const m = /20(\d{2})\s*级/.exec(title || '');
  return m ? '20' + m[1] : '';
}

/** 把抓取条目映射到（学院, 专业） */
function mapEntry(e) {
  const out = [];
  const collegeMajors = majorsByCollege[e.college] || [];
  let names = (e.majors && e.majors.length) ? e.majors : [e.guessMajor];
  names = names.map((n) => String(n || '').replace(/专业$/, '').replace(/\s/g, '')).filter(Boolean);
  for (const n of names) {
    // 精确 → 包含 → 去括号再匹配
    let hit = collegeMajors.find((m) => m === n)
      || collegeMajors.find((m) => m.includes(n) || n.includes(m))
      || collegeMajors.find((m) => m.replace(/（[^）]*）/g, '') === n.replace(/（[^）]*）/g, ''));
    if (!hit) {
      // 类专业：如「金融学类」→ 该学院下所有含「金融」的专业
      const base = n.replace(/类$/, '');
      const fam = collegeMajors.filter((m) => m.includes(base));
      if (fam.length) { for (const f of fam) out.push({ college: e.college, major: f, e }); }
      continue;
    }
    out.push({ college: e.college, major: hit, e });
  }
  return out;
}

const mapped = [];
for (const e of dataset) {
  if (!e.courseCount || e.courseCount < 8) continue; // 太少的多为解析失败
  mapped.push(...mapEntry(e));
}

// 同一 (college, major, grade) 取课程最多的一份
const best = new Map();
for (const m of mapped) {
  const grade = gradeOf(m.e.title);
  const key = `${m.college}|${m.major}|${grade}`;
  const prev = best.get(key);
  if (!prev || m.e.courseCount > prev.e.courseCount) best.set(key, { ...m, grade });
}

console.log('抓取文档:', dataset.length, '| 映射到专业:', mapped.length, '| 去重后:', best.size);

const now = new Date().toISOString();
let inserted = 0, updated = 0;
for (const [, v] of best) {
  const courses = v.e.courses.map((c) => ({
    code: c.code, name: c.name, credit: String(c.credit || ''), type: c.type || '通识',
    core: 0, term: c.term ? String(c.term) : '',
  }));
  const payload = {
    college: v.college, major: v.major, grade: v.grade || '',
    anchor: v.major, category: '培养方案',
    courses: JSON.stringify(courses),
    sourceDoc: `本校官网抓取：${v.e.pdf || v.e.url}`,
    updatedAt: now,
  };
  const exist = db.prepare('SELECT id, courses FROM curriculums WHERE college = ? AND major = ? AND grade = ?')
    .all(v.college, v.major, v.grade || '')[0];
  if (exist) {
    // 已有（如金融+法学 61 门人工核实表）：抓取版课程更多才覆盖
    let oldCount = 0;
    try { oldCount = JSON.parse(exist.courses || '[]').length; } catch {}
    if (courses.length > oldCount) {
      db.prepare('UPDATE curriculums SET courses=?, sourceDoc=?, updatedAt=?, anchor=?, category=? WHERE id=?')
        .run(payload.courses, payload.sourceDoc, now, payload.anchor, payload.category, exist.id);
      updated++;
    }
  } else {
    db.prepare('INSERT INTO curriculums (college, major, grade, anchor, category, courses, sourceDoc, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(payload.college, payload.major, payload.grade, payload.anchor, payload.category, payload.courses, payload.sourceDoc, now, now);
    inserted++;
  }
}

const rows = db.prepare('SELECT college, major, grade, courses FROM curriculums ORDER BY college, major').all();
console.log(`写入完成：新增 ${inserted}，更新 ${updated}，库内共 ${rows.length} 条`);
const byCollege = {};
for (const r of rows) {
  let n = 0; try { n = JSON.parse(r.courses || '[]').length; } catch {}
  byCollege[r.college] = byCollege[r.college] || { majors: 0, courses: 0 };
  byCollege[r.college].majors++; byCollege[r.college].courses += n;
}
for (const [c, v] of Object.entries(byCollege)) console.log(`  ${c}: ${v.majors} 个专业 / ${v.courses} 门课`);
db.close();
