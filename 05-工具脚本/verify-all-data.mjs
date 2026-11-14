// 全量数据核验：培养方案 + 其他数据模块
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import { DatabaseSync } from 'node:sqlite';

const ROOT = HOME + '/Desktop/WPS Comate大赛/高级赛道';
const db = new DatabaseSync(ROOT + '/02-后端源码/data.sqlite', { readOnly: true });
const issues = [];
const add = (level, area, msg) => issues.push({ level, area, msg });

/* ============ 1. 培养方案 ============ */
const rows = db.prepare('SELECT college, major, grade, courses, sourceDoc FROM curriculums').all();
console.log('=== 1. 培养方案 ===');
console.log('条目:', rows.length);

const BAD_SRC = /国际学生|国际班|第二学士|辅修|留学生|港澳台/;
let badSrc = 0, badFirst = 0, badCount = 0, emptyCourses = 0;
const counts = [];
for (const r of rows) {
  let cs = [];
  try { cs = JSON.parse(r.courses || '[]'); } catch { add('P0', '培养方案', `${r.major} courses JSON 解析失败`); continue; }
  counts.push({ major: r.major, n: cs.length });
  if (BAD_SRC.test(r.sourceDoc || '')) { badSrc++; add('P0', '培养方案', `${r.major} 来源含国际学生/第二学士：${r.sourceDoc.slice(0, 50)}`); }
  if (!cs.length) { emptyCourses++; continue; }
  if (/汉语精读|汉语听说|法商汉语|基础汉语|中国文化（/.test(cs[0].name)) { badFirst++; add('P0', '培养方案', `${r.major} 首门课为对外汉语（疑国际学生课表）：${cs[0].name}`); }
  if (cs.length > 160) { badCount++; add('P1', '培养方案', `${r.major} 课程数 ${cs.length} 偏大（疑合并章节）`); }
  if (cs.length < 15 && cs.length > 0) { add('P2', '培养方案', `${r.major} 课程数仅 ${cs.length}`); }
  // 字段完整性
  const noCredit = cs.filter((c) => !c.credit).length;
  const noTerm = cs.filter((c) => !c.term).length;
  if (noCredit > cs.length * 0.5) add('P2', '培养方案', `${r.major} ${noCredit}/${cs.length} 门缺学分`);
  if (noTerm > cs.length * 0.5) add('P2', '培养方案', `${r.major} ${noTerm}/${cs.length} 门缺学期`);
  // 课程名异常
  const badName = cs.filter((c) => !c.name || c.name.length > 40 || /^[\d\s.]+$/.test(c.name)).length;
  if (badName) add('P1', '培养方案', `${r.major} ${badName} 门课程名异常`);
}
counts.sort((a, b) => b.n - a.n);
console.log('课程数 Top5:', counts.slice(0, 5).map((x) => `${x.major}${x.n}`).join(' / '));
console.log('课程数 Bottom5:', counts.slice(-5).map((x) => `${x.major}${x.n}`).join(' / '));
console.log(`来源异常 ${badSrc} | 对外汉语课表 ${badFirst} | 超大课程数 ${badCount} | 空课表 ${emptyCourses}`);
console.log('课程合计:', counts.reduce((s, x) => s + x.n, 0), '门');

/* ============ 2. 学院专业 ============ */
console.log('\n=== 2. 学院与专业 ===');
const jobs = db.prepare('SELECT COUNT(*) n FROM jobs').get().n;
const contests = db.prepare('SELECT COUNT(*) n FROM contests').get().n;
const certs = db.prepare('SELECT COUNT(*) n FROM certificates').get().n;
const colleges = db.prepare('SELECT COUNT(*) n FROM colleges').get().n;
const questions = db.prepare('SELECT COUNT(*) n FROM questions').get().n;
console.log(`学院 ${colleges} | 岗位 ${jobs} | 竞赛 ${contests} | 证书 ${certs} | 面试题 ${questions}`);
if (colleges !== 21) add('P1', '学院', `学院数 ${colleges}，应为 21`);

// 学院-专业重复
const colRows = db.prepare('SELECT name, majors FROM colleges').all();
const majorMap = new Map();
let totalMajors = 0;
for (const c of colRows) {
  let ms = [];
  try { ms = JSON.parse(c.majors || '[]'); } catch { add('P0', '学院', `${c.name} majors 解析失败`); }
  totalMajors += ms.length;
  for (const m of ms) {
    if (!majorMap.has(m)) majorMap.set(m, []);
    majorMap.get(m).push(c.name);
  }
}
const dupMajors = [...majorMap.entries()].filter(([, cs]) => cs.length > 1);
console.log('专业总数:', totalMajors, '| 重复专业:', dupMajors.length);
dupMajors.forEach(([m, cs]) => add('P0', '学院', `专业「${m}」重复挂在：${cs.join(' / ')}`));

// 专业与培养方案一致性
const curMajors = new Set(rows.map((r) => r.major));
const missCur = [...majorMap.keys()].filter((m) => !curMajors.has(m));
const extraCur = [...curMajors].filter((m) => !majorMap.has(m));
if (missCur.length) add('P0', '一致性', `专业无培养方案：${missCur.join('、')}`);
if (extraCur.length) add('P1', '一致性', `培养方案有但专业清单无：${extraCur.join('、')}`);
console.log('无培养方案专业:', missCur.length ? missCur.join('、') : '无');

/* ============ 3. 竞赛 ============ */
console.log('\n=== 3. 竞赛库 ===');
const ct = db.prepare('SELECT id, name, deadline, star, category, kind FROM contests').all();
const ctNoName = ct.filter((x) => !x.name || x.name.length < 2);
const ctDup = ct.length - new Set(ct.map((x) => x.name)).size;
const today = new Date().toISOString().slice(0, 10);
const ctExpired = ct.filter((x) => x.deadline && /^\d{4}-\d{2}-\d{2}/.test(x.deadline) && x.deadline.slice(0, 10) < today);
console.log(`总数 ${ct.length} | 重名 ${ctDup} | 无名称 ${ctNoName.length} | 报名已过期 ${ctExpired.length}`);
if (ctDup) add('P2', '竞赛', `${ctDup} 条重名`);
if (ctExpired.length) add('P2', '竞赛', `${ctExpired.length} 条报名截止已过期（应更新或标注）`);

/* ============ 4. 证书 ============ */
console.log('\n=== 4. 证书库 ===');
const ce = db.prepare('SELECT id, name, type, category FROM certificates').all();
const ceDup = ce.length - new Set(ce.map((x) => x.name)).size;
console.log(`总数 ${ce.length} | 重名 ${ceDup}`);
if (ceDup) add('P2', '证书', `${ceDup} 条重名`);

/* ============ 5. 岗位 ============ */
console.log('\n=== 5. 岗位库 ===');
const jb = db.prepare('SELECT id, name, industryId, jd FROM jobs').all();
const jbNoJd = jb.filter((x) => !x.jd || x.jd.length < 20);
const jbDup = jb.length - new Set(jb.map((x) => x.name)).size;
const jbNoInd = jb.filter((x) => !x.industryId);
console.log(`总数 ${jb.length} | 重名 ${jbDup} | 无JD ${jbNoJd.length} | 无行业 ${jbNoInd.length}`);
if (jbDup) add('P2', '岗位', `${jbDup} 条重名`);
if (jbNoInd.length) add('P1', '岗位', `${jbNoInd.length} 条无行业归属`);

/* ============ 6. 面试题 ============ */
console.log('\n=== 6. 面试题库 ===');
const qs = db.prepare('SELECT id, type, content, answer FROM questions').all();
const qNoAns = qs.filter((x) => !x.answer || x.answer.length < 10);
console.log(`总数 ${qs.length} | 无答案 ${qNoAns.length}`);
if (qNoAns.length) add('P1', '面试题', `${qNoAns.length} 题缺答案`);

/* ============ 7. 汇总 ============ */
console.log('\n=== 问题汇总 ===');
const byLevel = { P0: [], P1: [], P2: [] };
for (const it of issues) byLevel[it.level].push(`[${it.area}] ${it.msg}`);
for (const lv of ['P0', 'P1', 'P2']) {
  console.log(`${lv}: ${byLevel[lv].length}`);
  byLevel[lv].slice(0, 12).forEach((m) => console.log('   ', m));
  if (byLevel[lv].length > 12) console.log(`    …另有 ${byLevel[lv].length - 12} 条`);
}

db.close();
