// 导出原版 Vue 前端（静态化）所需的全部数据 → static-dist/data/db.js
const HOME = process.env.USERPROFILE || process.env.HOME || '';
// 来源：scripts/_merged.sqlite（真实数据库，WAL 已合并）+ 后端静态数据文件，原样搬运
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = HOME + '/Desktop/职引';
const BE = path.join(ROOT, '02-后端源码/src');
const OUT = path.join(ROOT, 'static-dist');
fs.mkdirSync(OUT, { recursive: true });

const db = new DatabaseSync(path.join(ROOT, 'scripts/_merged.sqlite'), { readOnly: true });
const jp = (s, d = null) => { try { return typeof s === 'string' ? JSON.parse(s) : (s ?? d); } catch { return d; } };

// ---------- 用户与个人数据（演示学生 = student 账号真实数据） ----------
const user = db.prepare("SELECT id, username, nickname, email, major, grade, role FROM users WHERE username='student'").get();
const latestAssessmentRow = db.prepare('SELECT * FROM assessments WHERE userId=5 ORDER BY createdAt DESC LIMIT 1').get();
const latestAssessment = latestAssessmentRow ? {
  ...latestAssessmentRow,
  dimensions: jp(latestAssessmentRow.dimensions),
  result: jp(latestAssessmentRow.result),
} : null;

// 成长曲线（同日多条取当日最后一次）
const curveRows = db.prepare('SELECT dimensions, createdAt FROM assessments WHERE userId=5 ORDER BY createdAt ASC').all();
const curveByDate = {};
for (const r of curveRows) {
  const d = jp(r.dimensions, {});
  curveByDate[r.createdAt.slice(0, 10)] = { date: r.createdAt.slice(0, 10), interest: +d.interest || 0, ability: +d.ability || 0, personality: +d.personality || 0, value: +d.value || 0 };
}

// 等级表（与 growth.js LEVELS 一致，截取到 12 级）
const LEVELS = [
  { level: 1, xp: 0, title: '萌新' }, { level: 2, xp: 100, title: '初学者' }, { level: 3, xp: 250, title: '探索者' },
  { level: 4, xp: 500, title: '进阶者' }, { level: 5, xp: 800, title: '成长中' }, { level: 6, xp: 1200, title: '潜力之星' },
  { level: 7, xp: 1700, title: '学业达人' }, { level: 8, xp: 2300, title: '规划高手' }, { level: 9, xp: 3000, title: '生涯领航员' },
];
const g = db.prepare('SELECT * FROM user_growth WHERE userId=5').get();
const xp = g ? g.xp : 0, level = g ? g.level : 1;
const cur = LEVELS.find(l => l.level === level) || LEVELS[0];
const next = LEVELS.find(l => l.xp > cur.xp);
const unlocked = new Set(db.prepare('SELECT code FROM user_achievements WHERE userId=5').all().map(r => r.code));
const ACHIEVEMENTS = [
  { code: 'first_assess', name: '认识自己', desc: '完成首次职业测评' },
  { code: 'first_todo', name: '迈出第一步', desc: '完成首个待办事项' },
  { code: 'todo_ten', name: '规划达人', desc: '累计完成 10 项待办' },
  { code: 'gpa_perfect', name: '绩点之星', desc: '任一专业课成绩达到 3.5' },
  { code: 'first_post', name: '初来乍到', desc: '发布第一条帖子' },
  { code: 'forum_ten', name: '论坛活跃', desc: '发帖与回帖累计 10 条' },
  { code: 'resume_first', name: '简历管理师', desc: '生成第一份简历' },
  { code: 'ai_guide', name: '顾问互动', desc: '与 AI 顾问完成 3 次对话' },
  { code: 'streak_7', name: '持之以恒', desc: '连续签到 7 天' },
  { code: 'contest_first', name: '竞赛新秀', desc: '加入首个学科竞赛到规划' },
  { code: 'contest_five', name: '竞赛达人', desc: '累计规划 5 个竞赛' },
  { code: 'interview_first', name: '面试初体验', desc: '完成第一次模拟面试' },
  { code: 'treehole_first', name: '树洞初体验', desc: '在树洞匿名分享第一条心声' },
];

// ---------- 内容库（全部用户共享的真实数据） ----------
const colleges = db.prepare('SELECT * FROM colleges ORDER BY sort, id').all()
  .map(c => ({ ...c, majors: jp(c.majors, []), dest: jp(c.dest) }));
const industries = db.prepare('SELECT * FROM industries ORDER BY id').all()
  .map(i => ({ ...i, salary: jp(i.salary) }));
const roadBy = {};
for (const r of db.prepare('SELECT jobId, stages FROM roadmaps').all()) roadBy[r.jobId] = jp(r.stages, []);
const jobs = db.prepare('SELECT * FROM jobs ORDER BY id').all()
  .map(j => ({ ...j, majors: jp(j.majors, []), roadmap: roadBy[j.id] || null }));
const contests = db.prepare('SELECT * FROM contests WHERE enabled=1 ORDER BY sort, id').all()
  .map(c => ({ ...c, phases: jp(c.phases, []) }));
const certificates = db.prepare('SELECT * FROM certificates WHERE enabled=1 ORDER BY sort, id').all()
  .map(c => ({ ...c, majors: jp(c.majors, []) }));
const questions = db.prepare('SELECT * FROM questions ORDER BY id').all();
const curriculums = db.prepare('SELECT * FROM curriculums').all()
  .map(c => ({ ...c, courses: jp(c.courses, []) }));
const posts = db.prepare('SELECT * FROM posts WHERE status=\'approved\' ORDER BY createdAt DESC').all()
  .map(p => ({ ...p, author: { username: user.username, nickname: user.nickname, avatar: null, level }, favorited: false, liked: false, pinned: false }));
const resumes = db.prepare('SELECT * FROM resumes WHERE userId=5 ORDER BY id DESC').all()
  .map(r => ({ ...r, data: jp(r.data) }));
const chatSessions = db.prepare('SELECT * FROM chat_sessions WHERE userId=5 ORDER BY id DESC').all();
const chatMessages = {};
for (const s of chatSessions) {
  chatMessages[s.id] = db.prepare('SELECT * FROM chat_messages WHERE sessionId=? ORDER BY id ASC').all(s.id);
}
const resumeRow = resumes[0] || null;

// ---------- 测评题库（原样搬自 assessmentController.js） ----------
const ASSESS_DIMENSIONS = [
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
const ASSESS_RIASEC = {
  R: { code: 'R', label: '现实型（R）', desc: '偏好动手实操、使用工具与技术解决问题，关注实际结果。', tags: ['动手实操', '务实落地', '问题解决'], jobs: ['审计/资产评估助理（实操岗）', '税务申报与会计实操', '供应链与物流运营', '法务实务助理'] },
  I: { code: 'I', label: '研究型（I）', desc: '偏好钻研原理、进行实验与数据分析，重视逻辑与探索。', tags: ['数据与研究', '逻辑严谨', '持续学习'], jobs: ['行业/金融研究员', '数据分析师', '高校科研与深造'] },
  A: { code: 'A', label: '艺术型（A）', desc: '偏好创意、审美与内容表达，擅长用新颖方式呈现想法。', tags: ['创意表达', '审美设计', '内容创作'], jobs: ['新媒体运营', '市场策划/品牌内容', '文化创意编导'] },
  S: { code: 'S', label: '社会型（S）', desc: '偏好与人协作、帮助、教育与服务他人,重视联结与关怀。', tags: ['沟通协作', '客户服务意识', '共情'], jobs: ['中小学/高校教师', '人力资源专员', '高校辅导员'] },
  E: { code: 'E', label: '企业型（E）', desc: '偏好影响他人、领导团队与达成目标，关注成就与机会。', tags: ['目标驱动', '影响力', '资源整合'], jobs: ['银行客户经理', '市场营销与商务拓展', '自主创业/综合经营'] },
  C: { code: 'C', label: '常规型（C）', desc: '偏好规则、流程与精确执行，重视秩序、准确与可靠。', tags: ['严谨细致', '执行规范', '数据准确'], jobs: ['财务/会计', '审计', '行政/运营专员'] },
};

// ---------- 后端静态数据文件（原样 import 后再序列化） ----------
const sc = await import(pathToFileURL(path.join(BE, 'studyCenter.js')));
const sa = await import(pathToFileURL(path.join(BE, 'studyAbroad.js')));
const sp = await import(pathToFileURL(path.join(BE, 'studyPaths.js')));

// dashboard/overview 口径（与 dashboardController.overview 一致）
const assessmentCount = db.prepare('SELECT COUNT(*) n FROM assessments WHERE userId=5').get().n;
const planCount = 0, postCount = db.prepare('SELECT COUNT(*) n FROM posts WHERE userId=5').get().n;
const commentCount = db.prepare('SELECT COUNT(*) n FROM comments WHERE userId=5').get().n;
db.close();

const payload = {
  meta: { exportedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), source: 'data.sqlite（真实数据库，WAL 合并）+ 后端静态数据文件，原样导出' },
  user,
  // 测评题库：原样搬自 assessmentController.js（DIMENSIONS 31 题 + RIASEC 六类定义）
  assessmentQuestions: { DIMENSIONS: ASSESS_DIMENSIONS, RIASEC: ASSESS_RIASEC },
  dashboard: {
    stats: { assessmentCount, planCount, postCount, commentCount, avgProgress: 0 },
    growth: { xp, level, title: cur.title },
    latestAssessment,
    plans: [],
    todo: { total: 0, overdue: 0, list: [] },
  },
  growth: {
    xp, level, title: cur.title,
    curXp: cur.xp, rangeXp: next ? next.xp - cur.xp : 0, nextTitle: next ? next.title : null,
    nextXp: next ? next.xp : null, toNext: next ? next.xp - xp : 0, reachedMax: !next,
    achievements: ACHIEVEMENTS.map(a => ({ ...a, unlocked: unlocked.has(a.code) })),
    curve: Object.values(curveByDate),
    checkin: { today: new Date().toISOString().slice(0, 10), checked: false, streak: 0 },
  },
  points: { balance: 0, ledger: [] },
  colleges, industries, jobs, contests, certificates, questions, curriculums, posts, resumes,
  chatSessions, chatMessages,
  latestResume: resumeRow,
  studyPaths: sp.STUDY_PATHS,
  studyCenter: {
    BAOYAN_CENTER: sc.BAOYAN_CENTER,
    KAOYAN_ACADEMIC: sc.KAOYAN_ACADEMIC,
    KAOYAN_DIRECTIONS: sc.KAOYAN_DIRECTIONS,
    KAOZHAO_CENTER: sc.KAOZHAO_CENTER,
    KAOZHAO_WIZARD: sc.KAOZHAO_WIZARD,
    STUDY_CALENDAR: sc.STUDY_CALENDAR,
    STUDY_MATERIALS: sc.STUDY_MATERIALS,
    BONUS_RULES_BY_COLLEGE: sc.BONUS_RULES_BY_COLLEGE,
    COLLEGE_RULE_URLS: sc.COLLEGE_RULE_URLS,
    MAJOR_FAMILY: sc.MAJOR_FAMILY,
  },
  studyAbroad: { CAMPUS_PROJECTS: sa.CAMPUS_PROJECTS, STUDY_ABROAD: sa.STUDY_ABROAD },
  school: { name: '中南财经政法大学', crawl_enabled: 0 },
};

const js = 'window.ZY_DB=' + JSON.stringify(payload) + ';\n';
fs.writeFileSync(path.join(OUT, 'data.js'), js, 'utf8');
console.log('written data.js:', (fs.statSync(path.join(OUT, 'data.js')).size / 1024).toFixed(1) + 'KB');
console.log('counts:', JSON.stringify({
  colleges: colleges.length, industries: industries.length, jobs: jobs.length,
  contests: contests.length, certificates: certificates.length, questions: questions.length,
  curriculums: curriculums.length, posts: posts.length, resumes: resumes.length,
  chatSessions: chatSessions.length, curvePoints: Object.values(curveByDate).length,
}));
