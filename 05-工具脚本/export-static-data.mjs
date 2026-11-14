// 从合并后的 data.sqlite 导出静态版全部数据 → 05-上架包/data/*.js
const HOME = process.env.USERPROFILE || process.env.HOME || '';
// 数据来源：data.sqlite（WAL 已合并）+ src/studyPaths.js + assessmentController.js 题库（原样搬运）
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = HOME + '/Desktop/职引';
const OUT = path.join(ROOT, '05-上架包', 'data');
fs.mkdirSync(OUT, { recursive: true });

const db = new DatabaseSync(path.join(ROOT, 'scripts', '_merged.sqlite'), { readOnly: true });
const jparse = (s, d = null) => { try { return typeof s === 'string' ? JSON.parse(s) : (s ?? d); } catch { return d; } };
const write = (name, obj) => {
  fs.writeFileSync(path.join(OUT, name), `window.ZY_DATA=window.ZY_DATA||{};ZY_DATA.${name.replace('.js', '')}=${JSON.stringify(obj)};\n`, 'utf8');
  console.log('written:', name, (fs.statSync(path.join(OUT, name)).size / 1024).toFixed(1) + 'KB');
};

// ---------- 1) 测评题库（原样来自 assessmentController.js DIMENSIONS/RIASEC） ----------
const DIMENSIONS = [
  { key: 'interest', label: '职业兴趣', desc: '参考霍兰德职业兴趣理论（RIASEC）', questions: [
    { q: '我喜欢动手组装、维修电子产品、家具或工具', holland: 'R' },
    { q: '我更愿意做操作性强的工作，比如工程、制造、野外作业', holland: 'R' },
    { q: '我喜欢钻研事物的原理，做实验、查资料或分析数据', holland: 'I' },
    { q: '遇到不懂的问题，我会主动查文献或资料，探索到底', holland: 'I' },
    { q: '我喜欢写作、绘画、音乐、设计等创作活动', holland: 'A' },
    { q: '我常冒出新颖的点子，喜欢用有创意的方式解决问题', holland: 'A' },
    { q: '我乐于帮助他人，喜欢与人交流、分享经验和想法', holland: 'S' },
    { q: '我擅长倾听别人，能协调和化解他人之间的矛盾', holland: 'S' },
    { q: '我喜欢说服别人、领导团队一起达成目标', holland: 'E' },
    { q: '我对管理、销售、商业机会这类事情有浓厚兴趣', holland: 'E' },
    { q: '我喜欢按流程有条理地整理数据、文档和账目', holland: 'C' },
    { q: '我做事细致严谨，注重规则和准确性，讨厌出错', holland: 'C' },
  ] },
  { key: 'ability', label: '能力倾向', desc: '面向 HR 的"可迁移能力"评估',
    HR_TAGS: ['逻辑与数理', '沟通表达', '快速学习', '信息归纳', '组织协同', '执行韧性'], questions: [
    { q: '我擅长逻辑推理和数学计算，能快速理清复杂问题的脉络' },
    { q: '我的语言表达清晰，能顺畅地把想法写成文字' },
    { q: '我动手能力强，学习使用新工具、新软件上手很快' },
    { q: '我善于观察细节，能快速从大量信息中归纳出重点' },
    { q: '我组织协调能力强，能同时推进多项任务而不乱' },
    { q: '遇到困难我会主动找方法推进，而不是轻易放弃' },
  ] },
  { key: 'personality', label: '性格特质', desc: '面向 HR 的"岗位适应力"评估（含反向题，提升信度）',
    HR_TAGS: ['抗压稳定', '团队协作', '计划自律', '理性决策', '沉稳专注'], questions: [
    { q: '我喜欢安静专注，更享受独立完成工作' },
    { q: '我外向健谈，在人多的场合和团队协作中很自在' },
    { q: '面对压力我能保持冷静，仍然按部就班地推进' },
    { q: '我做决定时倾向先理性分析再行动，而不是凭感觉' },
    { q: '我喜欢提前做好规划，按计划推进而不是临时应变' },
    { q: '在有陌生人的场合，我通常避免主动开口交谈', rev: true },
    { q: '一旦事情出了差错，我就会很焦虑、难以专注，无从下手', rev: true },
    { q: '我习惯临场发挥、随遇而安，很少提前做详细计划', rev: true },
  ] },
  { key: 'value', label: '职业价值观', desc: '明确你在工作中看重什么（求职动机结构）',
    HR_TAGS: ['工作生活平衡', '稳定可预期', '持续成长', '助人与社会价值', '薪酬与晋升'], questions: [
    { q: '我重视工作与生活的平衡，不希望长期加班透支生活' },
    { q: '我希望工作稳定、收入可预期，不喜欢频繁变动' },
    { q: '我渴望持续的成长机会，愿意为学习提升投入时间' },
    { q: '我希望工作能对社会和他人产生真正的价值' },
    { q: '我期待较高的薪酬和清晰的晋升空间' },
  ] },
];
const RIASEC = {
  R: { code: 'R', label: '现实型（R）', desc: '偏好动手实操、使用工具与技术解决问题，关注实际结果。', tags: ['动手实操', '务实落地', '问题解决'], jobs: ['审计/资产评估助理（实操岗）', '税务申报与会计实操', '供应链与物流运营', '法务实务助理'] },
  I: { code: 'I', label: '研究型（I）', desc: '偏好钻研原理、进行实验与数据分析，重视逻辑与探索。', tags: ['数据与研究', '逻辑严谨', '持续学习'], jobs: ['行业/金融研究员', '数据分析师', '高校科研与深造'] },
  A: { code: 'A', label: '艺术型（A）', desc: '偏好创意、审美与内容表达，擅长用新颖方式呈现想法。', tags: ['创意表达', '审美设计', '内容创作'], jobs: ['新媒体运营', '市场策划/品牌内容', '文化创意编导'] },
  S: { code: 'S', label: '社会型（S）', desc: '偏好与人协作、帮助、教育与服务他人,重视联结与关怀。', tags: ['沟通协作', '客户服务意识', '共情'], jobs: ['中小学/高校教师', '人力资源专员', '高校辅导员'] },
  E: { code: 'E', label: '企业型（E）', desc: '偏好影响他人、领导团队与达成目标，关注成就与机会。', tags: ['目标驱动', '影响力', '资源整合'], jobs: ['银行客户经理', '市场营销与商务拓展', '自主创业/综合经营'] },
  C: { code: 'C', label: '常规型（C）', desc: '偏好规则、流程与精确执行，重视秩序、准确与可靠。', tags: ['严谨细致', '执行规范', '数据准确'], jobs: ['财务/会计', '审计', '行政/运营专员'] },
};
const REVERSE_TRAIT = { personality: { 5: '团队协作（主动沟通）', 6: '抗压与情绪稳定', 7: '计划与自律' } };
write('assessment.js', { DIMENSIONS, RIASEC, REVERSE_TRAIT });

// ---------- 2) 学院专业（DB colleges，21 个学院） ----------
const colleges = db.prepare('SELECT id,name,host,majors,note,sort,dest FROM colleges ORDER BY sort,id').all()
  .map(c => ({ id: c.id, name: c.name, host: c.host, majors: jparse(c.majors, []), note: c.note, dest: jparse(c.dest) }));
write('colleges.js', colleges);

// ---------- 3) 行业 + 岗位 + 岗位四年路线（DB industries/jobs/roadmaps） ----------
const inds = db.prepare('SELECT id,name,description,salary FROM industries ORDER BY id').all()
  .map(i => ({ id: i.id, name: i.name, description: i.description, salary: jparse(i.salary) }));
const roads = {};
for (const r of db.prepare('SELECT jobId, stages FROM roadmaps').all()) roads[r.jobId] = jparse(r.stages);
const jobsByInd = {};
for (const j of db.prepare('SELECT id,industryId,name,jd,skills,path,majors FROM jobs ORDER BY id').all()) {
  const job = { id: j.id, name: j.name, jd: j.jd, skills: jparse(j.skills, []), path: j.path, majors: jparse(j.majors, []), roadmap: roads[j.id] || null };
  (jobsByInd[j.industryId] = jobsByInd[j.industryId] || []).push(job);
}
const industries = inds.map(i => ({ ...i, jobs: jobsByInd[i.id] || [] }));
write('industries.js', industries);

// ---------- 4) 竞赛库（DB contests，enabled=1） ----------
const contests = db.prepare('SELECT id,name,kind,category,star,host,college,phases,deadline,website,note FROM contests WHERE enabled=1 ORDER BY sort,id').all()
  .map(c => ({ id: c.id, name: c.name, kind: c.kind, category: c.category, star: c.star, host: c.host, college: c.college, phases: jparse(c.phases, []), deadline: c.deadline, website: c.website, note: c.note }));
write('contests.js', contests);

// ---------- 5) 证书库（DB certificates，enabled=1） ----------
const certificates = db.prepare('SELECT id,name,type,category,host,majors,applyTime,examTime,frequency,bonus,"require",website,note,schoolEligible FROM certificates WHERE enabled=1 ORDER BY sort,id').all()
  .map(c => ({ id: c.id, name: c.name, type: c.type, category: c.category, host: c.host, majors: jparse(c.majors, []), applyTime: c.applyTime, examTime: c.examTime, frequency: c.frequency, bonus: c.bonus, require: c.require, website: c.website, note: c.note, schoolEligible: c.schoolEligible }));
write('certificates.js', certificates);

// ---------- 6) 深造路线（src/studyPaths.js 原样） ----------
const sp = await import(pathToFileURL(path.join(ROOT, '02-后端源码/src/studyPaths.js')));
write('studyPaths.js', sp.STUDY_PATHS);

// ---------- meta ----------
const majorCount = colleges.reduce((s, c) => s + c.majors.length, 0);
write('meta.js', {
  app: '职引 · 为你的大学生涯定方向（静态演示版）',
  school: '中南财经政法大学',
  exportedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  source: '02-后端源码/data.sqlite（WAL 已合并）+ src/studyPaths.js + assessmentController.js 题库，内容原样搬运未改动',
  counts: {
    colleges: colleges.length, majors: majorCount,
    industries: industries.length, jobs: industries.reduce((s, i) => s + i.jobs.length, 0),
    contests: contests.length, certificates: certificates.length,
    studyPaths: sp.STUDY_PATHS.length,
    questions: DIMENSIONS.reduce((s, d) => s + d.questions.length, 0),
  },
});

db.close();
console.log('DONE');
