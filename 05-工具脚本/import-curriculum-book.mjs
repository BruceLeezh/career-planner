// 培养方案合订本 → 数据库 curriculums（2024 版上/下册，本科生院官方发布）
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
const HDR = /([\u4e00-\u9fa5A-Za-z0-9（）()·—\-]{2,26}?(?:类)?专业(?:（[^）]{0,18}）)?)全程培养方案/g;
const NOISE = /^(本科|版本|中南财经政法大学|全程|专业|方案|\d|附件)/;
const norm = (s) => String(s || '').replace(/[\s（）()·]/g, '').replace(/专业$/, '');

/** 大类专业 → 具体专业（本校院系设置口径） */
const FAMILY = {
  管理科学与工程类: ['工程造价', '信息管理与信息系统'],
  公安学类: ['治安学', '侦查学'],
  外国语言文学类: ['英语', '商务英语'],
  新闻传播学类: ['新闻学', '广播电视学', '网络与新媒体'],
  经济与贸易类: ['国际经济与贸易', '贸易经济'],
  公共管理类: ['公共事业管理', '行政管理', '劳动与社会保障', '城市管理'],
  计算机类: ['计算机科学与技术', '信息安全'],
  金融学类: ['金融学', '金融工程', '投资学'],
  财政学类: ['财政学', '税收学'],
  经济学类: ['经济学', '数字经济'],
  工商管理类: ['工商管理', '市场营销', '人力资源管理', '物流管理', '电子商务', '供应链管理'],
  统计学类: ['统计学', '应用统计学', '经济统计学'],
  法学类: ['法学'],
  哲学类: ['哲学'],
  社会学类: ['社会学'],
  政治学类: ['国际政治'],
  中国语言文学类: ['汉语言文学'],
  戏剧与影视学类: ['动画', '电影学'],
  管理科学与工程: ['工程造价', '信息管理与信息系统'],
};
const majorsAll = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));

function resolve(name) {
  const n = norm(name);
  // 1) 精确
  let hit = majorsAll.find((m) => norm(m.major) === n);
  if (hit) return [hit];
  // 2) 去掉「（…）」后再精确/包含
  const base = norm(name.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, ''));
  hit = majorsAll.find((m) => norm(m.major.replace(/（[^）]*）/g, '')) === base);
  if (hit) return [hit];
  // 3) 大类映射
  const famKey = Object.keys(FAMILY).find((k) => base === norm(k) || base.includes(norm(k)));
  if (famKey) {
    return FAMILY[famKey].map((m) => majorsAll.find((x) => x.major === m)).filter(Boolean);
  }
  // 4) 双学位/实验班：拆「+」或去括号后，映射到各基础专业
  const parts = String(name).split(/[+＋]/).map((x) => x.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').replace(/专业.*$/, '').trim()).filter(Boolean);
  if (parts.length > 1) {
    const out = parts.map((p2) => majorsAll.find((m) => norm(m.major) === norm(p2))).filter(Boolean);
    if (out.length) return out;
  }
  // 5) 包含匹配（双向）
  hit = majorsAll.find((m) => norm(m.major).includes(base) || base.includes(norm(m.major)));
  if (hit) return [hit];
  return [];
}

const sections = [];
for (const f of FILES) {
  const text = fs.readFileSync(f.path, 'utf8');
  const hits = [];
  let m; HDR.lastIndex = 0;
  while ((m = HDR.exec(text)) !== null) {
    const name = m[1].replace(/^[\d\s]+/, '');
    if (NOISE.test(name)) continue;
    hits.push({ name, idx: m.index });
  }
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].idx;
    const end = i + 1 < hits.length ? hits[i + 1].idx : Math.min(text.length, start + 80000);
    const courses = extractCourses(text.slice(start, end));
    if (courses.length < 5) continue;
    sections.push({ file: f.label, name: hits[i].name, courses });
  }
}

// 同专业取课程最多的一段
const best = new Map();
let unmatched = new Set();
for (const s of sections) {
  const targets = resolve(s.name);
  if (!targets.length) { unmatched.add(s.name); continue; }
  for (const t of targets) {
    const key = `${t.college}|${t.major}`;
    const prev = best.get(key);
    if (!prev || s.courses.length > prev.courses.length) best.set(key, { ...t, src: s.name, file: s.file, courses: s.courses });
  }
}

console.log(`段落 ${sections.length} | 覆盖专业 ${best.size} / ${majorsAll.length} | 未识别 ${unmatched.size}`);
console.log('未识别:', [...unmatched].slice(0, 12).join(' / '));

const db = new DatabaseSync(ROOT + '/02-后端源码/data.sqlite');
const now = new Date().toISOString();
let ins = 0, upd = 0, skip = 0;
for (const [key, v] of best) {
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

const rows = db.prepare('SELECT college, major, grade, courses FROM curriculums').all();
const byCollege = {};
for (const r of rows) {
  let n = 0; try { n = JSON.parse(r.courses || '[]').length; } catch {}
  byCollege[r.college] = byCollege[r.college] || { m: 0, c: 0 };
  byCollege[r.college].m++; byCollege[r.college].c += n;
}
console.log(`\n写入：新增 ${ins}，更新 ${upd}，跳过 ${skip}；库内共 ${rows.length} 条`);
for (const [c, v] of Object.entries(byCollege).sort((a, b) => b[1].m - a[1].m)) console.log(`  ${c}: ${v.m} 个专业 / ${v.c} 门课`);
const covered = new Set(rows.filter((r) => r.grade).map((r) => r.major));
console.log(`\n覆盖专业数（去重 major）: ${covered.size} / ${majorsAll.length}`);
const missing = majorsAll.filter((m) => !covered.has(m.major));
console.log('未覆盖:', missing.map((m) => `${m.college}/${m.major}`).join('、') || '无');
db.close();

/* ---------- 第二轮：实验班/双学位变体 → 参照基础专业 ---------- */
{
  const db2 = new DatabaseSync(ROOT + '/02-后端源码/data.sqlite');
  const rows = db2.prepare('SELECT college, major, grade, courses, sourceDoc FROM curriculums').all();
  const covered = new Set(rows.map((r) => r.major));
  const byMajor = new Map(rows.map((r) => [r.major, r]));
  const norm2 = (s) => String(s).replace(/[\s（）()·+＋]/g, '');
  let added = 0;
  for (const { college, major } of majorsAll) {
    if (covered.has(major)) continue;
    // 去掉括号/加号，取基础专业名
    const parts = String(major).split(/[+＋]/).map((x) => x.replace(/（[^）]*）/g, '').trim()).filter(Boolean);
    let base = null;
    for (const p of parts) {
      const hit = rows.find((r) => norm2(r.major) === norm2(p) && r.major !== major);
      if (hit) { base = hit; break; }
    }
    if (!base) continue;
    let courses = []; try { courses = JSON.parse(base.courses || '[]'); } catch { continue; }
    if (!courses.length || courses.length > 120) continue; // 合并章节（如会计 642 门）不套用
    db2.prepare('INSERT INTO curriculums (college, major, grade, anchor, category, courses, sourceDoc, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(college, major, base.grade || '2024', major, '培养方案', base.courses,
        `参照「${base.major}」官方培养方案（${base.grade} 版）· 变体专业（实验班/双学位）课程以学院当年公布为准`, now, now);
    covered.add(major); added++;
  }
  const all = db2.prepare('SELECT college, major, grade, courses FROM curriculums').all();
  const cov = new Set(all.map((r) => r.major));
  console.log(`\n变体补录 ${added} 个；总覆盖 ${cov.size} / ${majorsAll.length}`);
  const miss = majorsAll.filter((m) => !cov.has(m.major));
  console.log('仍未覆盖（' + miss.length + '）:', miss.map((m) => `${m.college}/${m.major}`).join('、'));
  db2.close();
}
