// 重算每个专业的培养方案：独立章节 > 类专业章节 > 变体(含+)章节；同优先级取课程多的
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const ROOT = HOME + '/Desktop/WPS Comate大赛/高级赛道';
const _sc = await import(pathToFileURL(ROOT + '/02-后端源码/src/schoolColleges.js').href);
const SCHOOL_COLLEGES = _sc.SCHOOL_COLLEGES || _sc.default.SCHOOL_COLLEGES;
const { extractCourses, classifyCourses } = await import(pathToFileURL(ROOT + '/02-后端源码/src/curriculumBuild.js').href);

const BOOKS = [
  { p: ROOT + '/05-工具脚本/curriculum-shangce.txt', label: '2024版上册' },
  { p: ROOT + '/05-工具脚本/curriculum-xiace.txt', label: '2024版下册' },
];
const HDR = /([\u4e00-\u9fa5A-Za-z0-9（）()·—\-]{2,26}?(?:类)?专业(?:（[^）]{0,18}）)?)全程培养方案/g;
const NOISE = /^(本科|版本|中南财经政法大学|全程|专业|方案|\d|附件)/;

const sections = [];
for (const b of BOOKS) {
  const text = fs.readFileSync(b.p, 'utf8');
  // 锚点切分（精确）
  const anchors = [...text.matchAll(/一\s*、\s*专业\s*[（(]?\s*类?\s*[)）]?\s*名称/g)].map((m) => m.index);
  for (let i = 0; i < anchors.length; i++) {
    const seg = text.slice(anchors[i], i + 1 < anchors.length ? anchors[i + 1] : Math.min(text.length, anchors[i] + 90000));
    const nm = /专业名称[：:]\s*([^。\n]{2,30})/.exec(seg); if (!nm) continue;
    const cs = extractCourses(seg); if (cs.length < 10) continue;
    sections.push({ name: nm[1].replace(/\s+/g, ''), courses: cs, label: b.label });
  }
  // 标题切分补充（锚点未覆盖的）
  const hits = []; let m; HDR.lastIndex = 0;
  while ((m = HDR.exec(text)) !== null) {
    const name = m[1].replace(/^[\d\s]+/, ''); if (NOISE.test(name)) continue;
    hits.push({ name, idx: m.index });
  }
  for (let i = 0; i < hits.length; i++) {
    const seg = text.slice(hits[i].idx, i + 1 < hits.length ? hits[i + 1].idx : Math.min(text.length, hits[i].idx + 80000));
    const cs = extractCourses(seg); if (cs.length < 10) continue;
    sections.push({ name: hits[i].name, courses: cs, label: b.label });
  }
}

const majorsAll = SCHOOL_COLLEGES.flatMap((c) => c.majors.map((m) => ({ college: c.name, major: m })));
const norm = (s) => String(s || '').replace(/[\s（）()·]/g, '').replace(/专业$/, '');

/** 大类专业 → 具体专业 */
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
};

/** 返回 [{major, score}]：score 3=独立章节 2=类专业 1=变体 */
function candidates(sectionName) {
  const n = norm(sectionName);
  const base = norm(String(sectionName).replace(/（[^）]*）/g, ''));
  const isVariant = /[+＋]/.test(sectionName) || /实验班|双学位|中外合作|卓越|拔尖|方向|CIMA|ACCA|CPAC/.test(sectionName);
  const isClass = /类$/.test(String(sectionName).replace(/（[^）]*）/g, '').replace(/专业$/, ''));
  const score = isVariant ? 1 : isClass ? 2 : 3;
  const out = [];
  for (const { major } of majorsAll) {
    const nm = norm(major);
    const nbase = norm(String(major).replace(/（[^）]*）/g, ''));
    if (nm === n) out.push({ major, score: 3 });
    else if (nbase === base || nbase === n) out.push({ major, score });
    else if (isClass) {
      const fam = FAMILY[base];
      if (fam && fam.includes(major)) out.push({ major, score: 2 });
    }
  }
  return out;
}

const best = new Map(); // major -> {score, courses, label, src}
const SKIP = /国际学生|国际班|留学生|港澳台|辅修|第二学士|进修|培训班/;
for (const s of sections) {
  if (SKIP.test(s.name)) continue;
  for (const c of candidates(s.name)) {
    const prev = best.get(c.major);
    const cur = { score: c.score, courses: s.courses, label: s.label, src: s.name };
    if (!prev || cur.score > prev.score || (cur.score === prev.score && cur.courses.length > prev.courses.length)) {
      best.set(c.major, cur);
    }
  }
}

const db = new DatabaseSync(ROOT + '/02-后端源码/data.sqlite');
const now = new Date().toISOString();
let upd = 0;
for (const [major, v] of best) {
  const row = db.prepare('SELECT id, grade FROM curriculums WHERE major = ?').all(major)[0];
  if (!row) continue;
  if (row.grade === '2026') continue; // 保留人工核实的 2026 版
  const graded = classifyCourses(v.courses).map((c) => ({
    code: c.code, name: c.name.replace(/\s+/g, ''), credit: String(c.credit || ''),
    type: c.type, core: c.core, term: c.term ? String(c.term) : '',
  }));
  db.prepare('UPDATE curriculums SET courses=?, sourceDoc=?, updatedAt=? WHERE id=?')
    .run(JSON.stringify(graded), `本科生院《${v.label}》官方发布（${v.src}）`, now, row.id);
  upd++;
}
const all = db.prepare('SELECT major, courses, sourceDoc FROM curriculums').all();
const total = all.reduce((s, r) => { try { return s + JSON.parse(r.courses).length; } catch { return s; } }, 0);
console.log(`更新 ${upd} 个专业；共 ${all.length} 条，课程 ${total} 门`);
for (const m of ['金融学', '法学', '会计学', '工商管理', '计算机科学与技术']) {
  const r = all.find((x) => x.major === m);
  if (r) console.log(`  ${m}: ${JSON.parse(r.courses).length} 门 ← ${r.sourceDoc.slice(0, 46)}`);
}
db.close();
