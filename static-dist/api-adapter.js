/**
 * 职引 · 静态版 API 适配器
 * -----------------------------------------------------------------------------
 * 原版前端调用 128 条后端 API（Express + SQLite）。静态部署无后端，
 * 本文件以「本地数据适配器」替代 axios：保持 `http.get/post/put/delete` 与
 * `streamChat` 的调用签名完全不变，视图层零改动。
 *
 * 数据来源：window.ZY_DB（由 data.js 注入，导出自真实数据库 data.sqlite，
 * WAL 已合并）。计分、筛选、推荐、装饰（daysLeft/over/reasons）等业务逻辑
 * 逐条对齐 02-后端源码 的控制器实现，保证口径一致。
 *
 * 用户交互产生的数据（新增规划、打卡、发帖、收藏、签到等）写入 localStorage，
 * 刷新后仍在；AI 类接口返回本地规则生成的演示内容（页面顶部已有「静态演示版」说明）。
 */

const DB = (typeof window !== 'undefined' && window.ZY_DB) || {};

/* ============================== 基础设施 ============================== */
const LS_PREFIX = 'zy_static_';
const store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  write(key, val) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); } catch { /* 隐私模式忽略 */ }
  },
  reset(key) { try { localStorage.removeItem(LS_PREFIX + key); } catch {} },
};

const clone = (v) => JSON.parse(JSON.stringify(v ?? null));
const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const jparse = (s, d = null) => { try { return typeof s === 'string' ? JSON.parse(s) : (s ?? d); } catch { return d; } };

/** 当前登录用户（静态版固定为演示学生，登录页任意账号均可进入） */
function currentUser() {
  const custom = store.read('user', null);
  return custom || DB.user || { id: 5, username: 'student', nickname: '演示学生', major: '金融学', grade: '2024级', role: 'student' };
}

/* ============================== 工具：日期 ============================== */
function isoDays(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Math.round((d - Date.now()) / 86400000);
}
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowStr = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/* ============================== 内容库访问 ============================== */
const colleges = () => DB.colleges || [];
const industries = () => DB.industries || [];
const jobs = () => DB.jobs || [];
const contests = () => DB.contests || [];
const certificates = () => DB.certificates || [];
const questions = () => DB.questions || [];
const curriculums = () => DB.curriculums || [];
const studyPaths = () => DB.studyPaths || [];
const SC = () => DB.studyCenter || {};
const SA = () => DB.studyAbroad || {};

const jobIndustryName = (industryId) => (industries().find((i) => i.id === industryId) || {}).name || '';
const collegeForMajor = (major) => {
  const m = String(major || '').trim();
  if (!m) return null;
  for (const c of colleges()) if ((c.majors || []).includes(m)) return c.name;
  return null;
};
const majorsByCollege = (name) => (colleges().find((c) => c.name === name) || {}).majors || [];

/* ============================== 回复装饰（对齐 contestController） ============================== */
const REASON = {
  college: '你的学院对口', major: '专业直接相关', skill: '技能对口', school: '本校特色',
  grad: '保研·综测加分重点', general: '全国普遍认可', enterprise: '企业赛事', university: '名校赛事',
  bonus: '综测加分相关', professional: '专业类证书',
};
const reasons = (...ks) => [...new Set(ks)].map((k) => REASON[k]).filter(Boolean).slice(0, 3);

function decorateContest(c) { return { ...c, phases: jparse(c.phases, []) }; }
function decorateCard(c) {
  const cd = isoDays(c.deadline);
  return { ...c, daysLeft: cd, over: cd === null ? true : cd <= 0 };
}
const contestText = (c) => [c.name, c.host, c.college, c.note].filter(Boolean).join(' ').toLowerCase();
const certText = (c) => [c.name, c.host, c.category, c.note, c.bonus].filter(Boolean).join(' ').toLowerCase();

/* ============================== 岗位推荐（对齐 recommendJobs.js） ============================== */
const RIASEC_KW = {
  R: ['工程', '技术', '运维', '实施', '操作', '供应链', '物流', '生产', '施工', '设备', '硬件', '测试', '质量', '交付', '现场'],
  I: ['研究', '分析', '数据', '算法', '策略', '风控', '咨询', '建模', '科研', '量化', '评估', '测评', '行研', '投研'],
  A: ['设计', '创意', '文案', '内容', '新媒体', '策划', '编导', '品牌', '影视', '视觉', '广告'],
  S: ['教师', '教育', '人力', '招聘', '培训', '客服', '服务', '辅导', '教务', '社工'],
  E: ['销售', '客户经理', '商务', '市场', '拓展', '管理', '战略', '经营', '经理', '投资', '渠道', 'BD'],
  C: ['会计', '财务', '审计', '行政', '合规', '报表', '报税', '出纳', '税务', '核算', '文员', '档案', '结算'],
};
function jobVector(job) {
  const text = `${job.name || ''} ${job.skills || ''} ${job.jd || ''}`;
  const v = {};
  for (const code of Object.keys(RIASEC_KW)) {
    let hit = 0;
    for (const kw of RIASEC_KW[code]) if (text.includes(kw)) hit++;
    v[code] = hit;
  }
  return v;
}
function recommendJobs({ riasec, major, limit = 6 }) {
  const userVec = {};
  for (const r of riasec) userVec[r.code] = r.value || 0;
  const topCode = [...riasec].sort((a, b) => b.value - a.value)[0]?.code || '';
  const userMajors = [major].filter(Boolean);
  const scored = [];
  for (const job of jobs()) {
    const jm = jparse(job.majors, []) || [];
    const v = jobVector(job);
    const sum = Object.values(v).reduce((a, b) => a + b, 0);
    const nv = {};
    for (const code of Object.keys(RIASEC_KW)) nv[code] = sum ? v[code] / sum : 0;
    let sim = 0;
    for (const code of Object.keys(RIASEC_KW)) sim += (userVec[code] / 100) * (nv[code] || 0);
    let score = Math.max(0, Math.round(sim * 100));
    const jobTop = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
    if (topCode && jobTop && jobTop[0] === topCode && jobTop[1] > 0) score += 15;
    if (userMajors.length && jm.some((m) => userMajors.includes(m))) score += 20;
    if (score === 0) score = 5;
    scored.push({ score, job, majors: jm });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ score, job, majors }) => ({
    id: job.id, name: job.name, industryId: job.industryId,
    skills: jparse(job.skills, []), majors, match: Math.min(100, score),
  }));
}

/* 专业契合度（对齐 recommendMajors.js 的 fitOf 关键词法） */
const HOLLAND_KW = {
  R: ['工程', '技术', '自动化', '机械', '物流', '供应链'],
  I: ['统计', '数学', '数据', '经济', '金融', '研究', '科研', '计算'],
  A: ['新闻', '传播', '设计', '艺术', '中文', '广告'],
  S: ['社会', '教育', '心理', '公共', '人力', '管理'],
  E: ['工商', '市场', '营销', '创业', '商务', '国贸'],
  C: ['会计', '财务', '审计', '税务', '财政', '法'],
};
function majorFitScore(majorName, codes) {
  const text = String(majorName || '');
  let hit = 0;
  for (const c of codes) for (const kw of HOLLAND_KW[c.code] || []) if (text.includes(kw)) hit += c.value / 100;
  return Math.min(100, Math.round(hit * 40));
}
function assessMajorFit({ riasec, major, limit = 3 }) {
  const currs = curriculums();
  if (!currs.length) return { currentMajor: major || '', currentFit: null, verdict: 'none', verdictText: '', alternatives: [] };
  const codes = [...riasec].slice(0, 3);
  const current = major ? currs.find((c) => c.major === major) || currs.find((c) => String(c.major).includes(major)) : null;
  const currentFit = current ? majorFitScore(current.major, codes) : null;
  const scored = currs.map((cv) => ({ college: cv.college, major: cv.major, aiSummary: String(cv.aiSummary || ''), fit: majorFitScore(cv.major, codes) }))
    .filter((s) => s.fit > 0).sort((a, b) => b.fit - a.fit);
  const seen = new Set(); const alternatives = [];
  for (const s of scored) {
    if (seen.has(s.major)) continue;
    seen.add(s.major);
    if (current && s.major === current.major) continue;
    alternatives.push({ college: s.college, major: s.major, aiSummary: s.aiSummary.replace(/\s+/g, ' ').slice(0, 160), fit: s.fit });
    if (alternatives.length >= limit) break;
  }
  let verdict = 'none', verdictText = '';
  if (current && currentFit !== null) {
    if (currentFit >= 70) { verdict = 'high'; verdictText = `你的职业特质与「${current.major}」高度契合（${currentFit} 分），当前专业选择很匹配。可深耕本专业核心能力，若学有余力，辅修${alternatives[0]?.major || '相近方向'}可锦上添花。`; }
    else if (currentFit >= 50) { verdict = 'mid'; verdictText = `你的职业特质与「${current.major}」基本契合（${currentFit} 分），方向可行。若想进一步发挥兴趣优势，可关注辅修${alternatives[0]?.major || '互补方向'}。`; }
    else { verdict = 'low'; verdictText = `你的职业特质与「${current.major}」契合度一般（${currentFit} 分），不必焦虑——专业不等于职业。可考虑辅修${alternatives.slice(0, 2).map((a) => a.major).join('、')}等更契合的方向，或通过实习/社团补足。`; }
  } else if (alternatives.length) {
    verdictText = '你尚未填写当前专业。基于测评画像，以下方向与你的特质更契合，可作为辅修或方向探索的参考。';
  }
  return { currentMajor: current?.major || major || '', currentCollege: current?.college || '', currentFit, verdict, verdictText, alternatives };
}

/* ============================== 成长 / 等级 ============================== */
const LEVELS = [
  { level: 1, xp: 0, title: '萌新' }, { level: 2, xp: 100, title: '初学者' }, { level: 3, xp: 250, title: '探索者' },
  { level: 4, xp: 500, title: '进阶者' }, { level: 5, xp: 800, title: '成长中' }, { level: 6, xp: 1200, title: '潜力之星' },
  { level: 7, xp: 1700, title: '学业达人' }, { level: 8, xp: 2300, title: '规划高手' }, { level: 9, xp: 3000, title: '生涯领航员' },
];
function growthState() {
  const g = store.read('growth', null);
  if (g) return g;
  const base = clone(DB.growth || { xp: 0, level: 1, title: '萌新', achievements: [], curve: [], checkin: { checked: false, streak: 0 } });
  store.write('growth', base);
  return base;
}
function levelFor(xp) {
  let hit = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xp) hit = l;
  return hit;
}
function buildGrowth() {
  const g = growthState();
  const xp = g.xp || 0;
  const cur = levelFor(xp);
  const next = LEVELS.find((l) => l.xp > cur.xp);
  const checkin = store.read('checkin', g.checkin || { today: todayStr(), checked: false, streak: 0 });
  return {
    xp, level: cur.level, title: cur.title,
    curXp: cur.xp, rangeXp: next ? next.xp - cur.xp : 0,
    nextTitle: next ? next.title : null, nextXp: next ? next.xp : null,
    toNext: next ? next.xp - xp : 0, reachedMax: !next,
    achievements: g.achievements || [],
    curve: g.curve || [],
    checkin: { today: todayStr(), checked: checkin.checked && checkin.today === todayStr(), streak: checkin.streak || 0 },
  };
}
function grantXp(amount) {
  const g = growthState();
  g.xp = (g.xp || 0) + amount;
  g.level = levelFor(g.xp).level;
  g.title = levelFor(g.xp).title;
  store.write('growth', g);
  return g;
}

/* ============================== 规划 ============================== */
function plansState() {
  const p = store.read('plans', null);
  return p || [];
}
function savePlans(list) { store.write('plans', list); }

/** 用岗位路线图生成计划事项（对齐 careerController.backfillItems 的语义） */
function stagesToItems(stages) {
  const items = [];
  let sort = 0;
  for (const st of stages || []) {
    for (const r of st.resources || []) {
      items.push({ id: 0, planId: 0, stage: st.year || '通用', title: r, note: null, due: null, done: false, sort: sort++, dimension: 'career' });
    }
  }
  return items;
}

function attachPlan(plan) {
  const items = (plan.items || []).map((it) => ({ ...it, done: !!it.done }));
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  return { ...plan, stages: jparse(plan.stages, []), progress, items, stats: { total, done, pending: total - done } };
}

function createPlan(body) {
  const list = plansState();
  const type = body.type === 'study' ? 'study' : body.type === 'curriculum' ? 'curriculum' : body.type === 'cert' ? 'cert' : 'job';
  // 幂等：同类型同目标不重复建
  const existed = list.find((p) => p.type === type && (
    (type === 'job' && String(p.jobId) === String(body.jobId)) ||
    (type === 'study' && p.pathKey === body.pathKey) ||
    (type === 'curriculum' && p.majorKey === `${body.college}|${body.major}`) ||
    (type === 'cert' && p.title === body.title)
  ));
  if (existed) return { plan: attachPlan(existed), existed: true };

  const plan = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    userId: currentUser().id, jobId: body.jobId || null, type,
    pathKey: body.pathKey || null, title: body.title || '我的规划',
    stages: jparse(body.stages, []), progress: 0,
    createdAt: nowStr(), updatedAt: nowStr(),
    majorKey: type === 'curriculum' ? `${body.college}|${body.major}` : null,
    contestId: body.contestId || null, grade: body.grade || null,
    items: [],
  };
  if ((type === 'job' || type === 'study') && Array.isArray(plan.stages) && plan.stages.length) {
    plan.items = stagesToItems(plan.stages).map((it, i) => ({ ...it, id: plan.id * 100 + i, planId: plan.id }));
  }
  if (type === 'cert') {
    const steps = ['确认报名（考试资格核对）', '备考复习', '参加考试', '查询成绩与领证'];
    plan.items = steps.map((t, i) => ({ id: plan.id * 100 + i, planId: plan.id, stage: '证书流程', title: t, note: null, due: null, done: false, sort: i, dimension: 'cert' }));
  }
  if (type === 'curriculum') {
    const cv = curriculums().find((c) => c.major === body.major);
    const core = (cv?.courses || []).filter((c) => String(c.core) === '1' || c.core === 1).slice(0, 12);
    plan.items = core.map((c, i) => ({ id: plan.id * 100 + i, planId: plan.id, stage: c.type || '专业核心课', title: c.name, note: `${c.code}${c.credit ? `　学分 ${c.credit}` : ''}`, due: null, done: false, sort: i, dimension: 'course' }));
  }
  list.push(plan);
  savePlans(list);
  grantXp(10);
  return { plan: attachPlan(plan), existed: false };
}

/* ============================== 帖子 ============================== */
function postsState() {
  const p = store.read('posts', null);
  if (p) return p;
  const base = clone(DB.posts || []);
  store.write('posts', base);
  return base;
}
function commentsState() {
  const c = store.read('comments', null);
  if (c) return c;
  const base = clone(DB.comments || []);
  store.write('comments', base);
  return base;
}
function favoritesState() {
  const f = store.read('favorites', null);
  if (f) return f;
  store.write('favorites', []);
  return [];
}
function withInteractions(post) {
  const favs = favoritesState();
  const likes = store.read('likes', []);
  return {
    ...post,
    favorited: favs.some((x) => String(x.id) === String(post.id)),
    liked: likes.some((x) => String(x.id) === String(post.id)),
    pinned: !!(post.pinnedUntil && Date.parse(String(post.pinnedUntil).replace(' ', 'T')) > Date.now()),
    author: post.author || { username: currentUser().username, nickname: currentUser().nickname, avatar: null, level: buildGrowth().level },
  };
}

/* ============================== 会话 ============================== */
function sessionsState() {
  const s = store.read('chatSessions', null);
  if (s) return s;
  const base = clone(DB.chatSessions || []);
  store.write('chatSessions', base);
  return base;
}
function messagesState() {
  const m = store.read('chatMessages', null);
  if (m) return m;
  const base = clone(DB.chatMessages || {});
  store.write('chatMessages', base);
  return base;
}

/* ============================== 订阅 ============================== */
function subscriptionsState() { return store.read('subscriptions', []); }

/* ============================== 简历 ============================== */
function resumesState() {
  const r = store.read('resumes', null);
  if (r) return r;
  const base = clone(DB.resumes || []);
  store.write('resumes', base);
  return base;
}

/* ============================== AI 本地演绎（静态版） ============================== */
/**
 * 静态部署无法调用大模型。以下函数按后端 prompts/ 的结构约束，
 * 用真实数据 + 规则生成同结构的演示内容，保证页面交互完整。
 * 完整版（02-后端源码 + .env 配置 qwen-plus）走真实 AI。
 */
function localAssessmentReport({ scores, riasec, primary, hollandText, hollandJobs, hrProfile, majorFit, recommended }) {
  const codes = riasec.map((r) => r.code);
  const topCap = primary?.tags?.[0] || '综合能力';
  const strengths = [
    primary ? `职业兴趣主类型为「${primary.label}」，典型特征：${primary.tags.join('、')}` : '已明确初步的职业偏好',
    hrProfile.ability?.highlight ? `能力方向突出：${hrProfile.ability.highlight}` : `整体能力倾向表现相对较好（${scores.ability} 分）`,
    hrProfile.personality?.highlight ? `岗位适应力亮点：${hrProfile.personality.highlight}` : '具备清晰的自我认知与规划意识',
  ];
  const suggestions = [
    '围绕主类型对应的 1-2 个岗位做行业调研与实习体验，验证兴趣是否落地',
    `重点补齐目标岗位所需的硬技能，并围绕「${topCap}」积累可展示的作品或项目`,
    '把测评结果整理成「能力/动机主张」，放入简历的自我评价或面试自我介绍',
  ];
  let studySuggestions;
  if (/^[IC]/.test(codes[0] || '') && scores.ability >= 70) {
    studySuggestions = [
      '研究型 + 高能力倾向，适合保研/读研，尽早进入课题组积累论文与科研经历',
      '可重点关注保研路径：保持高绩点，参加含金量竞赛与夏令营',
      '若想走更深学术（读博），可提前规划暑研、夏校与导师推荐',
    ];
  } else if (/^[IC]/.test(codes[0] || '') || scores.ability >= 65) {
    studySuggestions = [
      '有一定学术潜力，可将考研纳入备选，报考前先确认专业兴趣是否足够持久',
      '建议通过科研训练（大创/进组）检验是否适合长期研究',
      '若纠结就业与深造，可先实习一段再决定，避免盲目考研',
    ];
  } else {
    studySuggestions = [
      '你的特质更偏动手与落地，现阶段更适合直接就业 / 边工作边深造',
      '若有提升学历需求，可考虑在职研或出国读个短周期学位',
      '先聚焦目标岗位的实习与技能积累，深造可作为后续备选',
    ];
  }
  return {
    summary: `你的职业兴趣偏向「${hollandText || '多元'}」。HR 视角看，${hrProfile.ability?.hrLabel || '能力结构清晰'}，${hrProfile.personality?.hrLabel || '岗位适应力良好'}。建议把优势翻译成「可量化的事」来打动招聘方。`,
    strengths, suggestions,
    suitableJobs: hollandJobs.length ? hollandJobs : ['产品经理', '运营专员', '软件研发工程师'],
    studySuggestions,
  };
}

function localPositionReport(kind, profile = {}) {
  // 保研
  if (kind === 'baoyan') {
    const tiers = (SC().BAOYAN_CENTER?.tierByRank || []);
    const rk = Number(profile.rankPct) || 15;
    const band = tiers.find((b) => rk >= b.rankMin && rk <= b.rankMax) || tiers[2] || {};
    const T = band.Tier || {};
    return {
      summary: `基于你的成绩排名前 ${profile.rankPct || 15}% 与「${profile.major || '金融学'}」专业背景，具备冲刺${T.冲 ? String(T.冲).split('、')[0] : '头部院校'}的基础条件，建议以「稳」档为主投、冲档少量尝试、保档兜底。`,
      strengths: [
        `成绩排名前 ${profile.rankPct || 15}%，位于可申请推免的竞争力区间`,
        `${profile.major || '金融学'}专业与目标方向对口，课程基础可直接支撑复试专业课`,
        profile.experience ? '已有科研/竞赛经历，材料可支撑个人陈述与面试追问' : '具备跨学科意识，可围绕交叉方向做差异化包装',
      ],
      gaps: [
        profile.experience ? '科研/竞赛成果的量化表述还不够，建议补一段完整的过程与结果' : '科研/竞赛经历未填写，需补充确认并尽快参与一项',
        '英语成绩建议核对目标院校门槛（部分院校六级 550+ / 600+）',
        '建议提前 1 个学期确定 2-3 位意向导师并完成套磁',
      ],
      recommendations: [
        { tier: '冲', school: String(T.冲 || '头部财经院校').split('、')[0], reason: '学科实力强、平台高，与你当前排名匹配度足够支撑一次冲刺尝试，但需材料非常完整。' },
        { tier: '稳', school: String(T.稳 || '头部财经强校').split('、')[0], reason: '与你专业方向、成绩区间最匹配，往年接收推免生规模稳定，属于主要目标档。' },
        { tier: '保', school: String(T.保 || '强势 211').split('、')[0], reason: '接收门槛相对稳妥，可作为兜底志愿，确保推免不落空。' },
      ],
      actions: [
        `把绩点稳定在前 ${Math.max(5, Math.round(rk / 2))}% 以内，优先保证核心专业课成绩`,
        '暑期完成一段与目标方向相关的科研或实习，形成可写进材料的成果',
        '9 月前完成个人陈述、推荐信与套磁邮件，逐校核对申请系统截止时间',
      ],
    };
  }
  // 考研
  if (kind === 'kaoyan') {
    const dirs = DB.studyCenter?.KAOYAN_DIRECTIONS || [];
    const dir = dirs.find((d) => d.major === profile.major) || dirs[0] || {};
    const S = dir.schools || {};
    const pick = (tier, fallback) => (S[tier]?.[0]?.n || fallback);
    return {
      summary: `按「${profile.major || '金融学'}」方向，建议冲/稳/保三档各选 1-2 所，专业课以各校自命题为准，提前锁定参考书目与真题。`,
      recommendations: [
        { tier: '冲', school: pick('high', '头部院校'), reason: '学科实力与平台突出，统考名额少、竞争激烈，需要初试分数明显高于国家线。' },
        { tier: '稳', school: pick('mid', '区域强势院校'), reason: '学科实力与你的基础匹配，报录比相对可控，是主要目标档。' },
        { tier: '保', school: pick('base', '省内双一流'), reason: '统考名额相对充足、调剂空间大，可作为保底选择。' },
      ],
      keyThresholds: '该层次院校通常需要初试总分高于国家线 20-40 分，单科不低于 60/90（具体以当年招生简章为准）',
      warnings: [
        '专业课多为院校自命题，务必以目标院校当年参考书目与真题为准',
        '报录比年度波动较大，避免只盯一年的数据',
        '关注调剂政策与复试差额比例，提前准备备选院校',
      ],
    };
  }
  // 留学
  const regions = SA().STUDY_ABROAD || [];
  const region = regions[0] || {};
  const item = region.items?.[0] || {};
  return {
    summary: `结合你的背景，建议以英国/香港一年制硕士为主申方向，澳洲作为备选；语言与 GPA 是当前最需要补齐的两项。`,
    strengths: [
      '本科院校为 211 双一流，海外院校认可度较高',
      `${profile.major || '金融学'}属于热门商科方向，项目选择面广`,
      '一年制硕士时间成本低，回国认可度稳定',
    ],
    gaps: [
      '语言成绩尚未达标，建议尽快系统备考雅思/托福',
      'GPA 需要稳定在 3.0/4.0 以上，重点提升专业课成绩',
      '实习/科研经历需要补一段与目标专业强相关的',
    ],
    targetTier: `建议冲刺 QS 前 100，稳妥选择 QS 100-200 的项目（${item.name || '英国'}方向）`,
    recommendations: [
      { tier: '冲', school: '英国 G5 / 港三（如 LSE、港大）商科相关硕士', reason: '学术声誉与就业认可度最高，对语言与 GPA 要求严格，需要材料全面。' },
      { tier: '稳', school: '英国罗素集团 / 港中文、港科大商科硕士', reason: '专业匹配度高、录取相对稳定，是主要申请档。' },
      { tier: '保', school: '澳洲八大 / 英国 QS 100-200 院校', reason: '录取门槛相对宽松，可作为兜底选择，确保当年入学。' },
    ],
    actions: [
      '3 个月内完成雅思首考，目标 6.5（单项不低于 6.0）',
      '本学期把 GPA 拉到 3.3 以上，重点课程优先',
      '补充一段与目标专业相关的实习或科研，形成文书素材',
    ],
  };
}

/* ============================== 模拟延迟 + 响应 ============================== */
async function respond(data) { await delay(60); return clone(data); }

/* ============================== 路由表 ============================== */
const routes = [];

/** 注册一条路由：method + 正则（对 path 匹配），handler(ctx) 返回响应体 */
function route(method, path, handler) {
  const re = path instanceof RegExp ? path : new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '([^/]+)') + '$');
  routes.push({ method, re, handler });
}

/* ---------- 认证 ---------- */
route('POST', '/auth/login', async ({ body }) => {
  const u = currentUser();
  const nickname = body.username && body.username !== 'student' ? body.username : (u.nickname || '演示学生');
  const user = { ...u, nickname };
  store.write('user', user);
  return { message: '登录成功', user };
});
route('POST', '/auth/register', async ({ body }) => {
  const user = { ...currentUser(), username: body.username, nickname: body.nickname || body.username, email: body.email || null };
  store.write('user', user);
  return { message: '注册成功', user };
});
route('POST', '/auth/logout', async () => ({ message: '已退出登录' }));
route('GET', '/auth/me', async () => ({ user: currentUser() }));
route('PUT', '/auth/profile', async ({ body }) => {
  const user = { ...currentUser(), ...body };
  store.write('user', user);
  return { user };
});
route('PUT', '/auth/password', async () => ({ message: '密码已更新' }));
route('POST', '/auth/forgot/send-code', async () => ({ message: '验证码已发送（演示环境不发送真实邮件）' }));
route('POST', '/auth/forgot', async () => ({ message: '密码已重置（演示环境）' }));

/* ---------- 首页概览 ---------- */
route('GET', '/dashboard/overview', async () => {
  const plans = plansState();
  const assessments = store.read('assessments', null) || (DB.dashboard?.latestAssessment ? [DB.dashboard.latestAssessment] : []);
  const posts = postsState().filter((p) => p.userId === currentUser().id);
  const g = buildGrowth();
  const todoItems = plans.flatMap((p) => (p.items || []).filter((i) => !i.done).map((i) => ({
    id: i.id, title: i.title, due: i.due, stage: i.stage, dimension: i.dimension,
    planId: p.id, planTitle: p.title, planType: p.type, pathKey: p.pathKey,
  })));
  const today = todayStr();
  return {
    stats: {
      assessmentCount: assessments.length,
      planCount: plans.length,
      postCount: posts.length,
      commentCount: 0,
      avgProgress: plans.length ? Math.round(plans.reduce((s, p) => s + (attachPlan(p).progress || 0), 0) / plans.length) : 0,
    },
    growth: { xp: g.xp, level: g.level, title: g.title },
    latestAssessment: assessments.length ? assessments[assessments.length - 1] : null,
    plans: plans.slice(0, 3).map((p) => ({ ...attachPlan(p) })),
    todo: { total: todoItems.length, overdue: todoItems.filter((i) => i.due && i.due < today).length, list: todoItems },
  };
});

/* ---------- 成长 ---------- */
route('GET', '/growth', async () => buildGrowth());
route('POST', '/growth/checkin', async () => {
  const ck = store.read('checkin', null);
  const today = todayStr();
  if (ck && ck.today === today && ck.checked) return { ...buildGrowth() };
  const streak = ck && ck.today === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? (ck.streak || 0) + 1 : 1;
  store.write('checkin', { today, checked: true, streak });
  grantXp(5);
  return buildGrowth();
});
route('GET', '/points/balance', async () => ({ points: store.read('points', 0) }));
route('GET', '/points/ledger', async () => ({ list: store.read('pointsLedger', []), total: 0 }));

/* ---------- 测评 ---------- */
const DIMENSIONS = () => (DB.assessmentQuestions || {}).DIMENSIONS || [];
const RIASEC_DEF = () => (DB.assessmentQuestions || {}).RIASEC || {};
route('GET', '/assessment/questions', async () => ({ dimensions: DIMENSIONS() }));
route('POST', '/assessment/submit', async ({ body }) => {
  const dims = DIMENSIONS();
  const RIASEC = RIASEC_DEF();
  const raw = {}, counts = {}, itemPts = [], perQ = {}, typeSum = {}, typeCnt = {};
  for (const a of body.answers || []) {
    const dim = dims.find((d) => d.key === a.dimension);
    if (!dim) continue;
    const item = dim.questions[a.idx];
    if (!item) continue;
    const val = Math.min(5, Math.max(1, Number(a.value)));
    const pt = item.rev ? 6 - val : val;
    itemPts.push(pt);
    raw[a.dimension] = (raw[a.dimension] || 0) + pt;
    counts[a.dimension] = (counts[a.dimension] || 0) + 1;
    (perQ[a.dimension] = perQ[a.dimension] || []).push(pt);
    if (a.dimension === 'interest' && item.holland) {
      typeSum[item.holland] = (typeSum[item.holland] || 0) + val;
      typeCnt[item.holland] = (typeCnt[item.holland] || 0) + 1;
    }
  }
  const scores = {};
  for (const d of dims) { const n = counts[d.key] || 0; scores[d.key] = n ? Math.round((raw[d.key] / n / 5) * 100) : 0; }
  const mean = itemPts.reduce((s, x) => s + x, 0) / (itemPts.length || 1);
  const stddev = Math.sqrt(itemPts.reduce((s, x) => s + (x - mean) ** 2, 0) / (itemPts.length || 1));
  const distinct = new Set(itemPts).size;
  const tooFlat = stddev < 0.6 || distinct <= 2;
  const validity = {
    valid: !tooFlat, status: tooFlat ? 'low' : 'good',
    note: tooFlat ? '本次作答区分度偏低，可能存在相近勾选或统一作答，结果仅供参考。' : '作答区分度良好，结果可信。',
    stddev: Math.round(stddev * 100) / 100, consistency: [],
  };
  const riasec = Object.keys(RIASEC).map((code) => {
    const n = typeCnt[code] || 0;
    const value = n ? Math.round((typeSum[code] / n / 5) * 100) : 0;
    const def = RIASEC[code] || {};
    return { code, label: def.label || code, value, tags: def.tags || [], jobs: def.jobs || [] };
  }).sort((a, b) => b.value - a.value);
  const codes = riasec.map((r) => r.code).filter((c) => (typeCnt[c] || 0) > 0);
  const hollandText = codes.slice(0, 2).join('');
  const primary = riasec[0];
  const hollandJobs = riasec.slice(0, 2).flatMap((r) => r.jobs).slice(0, 4);
  const hrProfile = {
    interest: { level: '—', hrLabel: primary ? `主类型「${primary.label}」` : '—', tags: [], highlight: primary ? `${primary.label}特征（${primary.tags[0]}）` : null },
    ability: { level: scores.ability >= 75 ? '较高' : scores.ability >= 55 ? '中等' : '较低', hrLabel: scores.ability >= 75 ? '突出（较高）' : '良好（中等）', tags: [], highlight: null },
    personality: { level: scores.personality >= 75 ? '较高' : scores.personality >= 55 ? '中等' : '较低', hrLabel: scores.personality >= 75 ? '突出（较高）' : '良好（中等）', tags: [], highlight: null },
    value: { level: scores.value >= 75 ? '较高' : scores.value >= 55 ? '中等' : '较低', hrLabel: scores.value >= 75 ? '突出（较高）' : '良好（中等）', tags: [], topValues: [] },
  };
  const recommended = recommendJobs({ riasec, major: currentUser().major, limit: 6 });
  const fit = assessMajorFit({ riasec, major: currentUser().major, limit: 3 });
  const base = localAssessmentReport({ scores, riasec, primary, hollandText, hollandJobs, hrProfile, majorFit: fit, recommended });
  const assessment = {
    id: Date.now(), userId: currentUser().id, dimensions: scores,
    result: {
      ...base, hollandType: codes.slice(0, 2).map((c) => RIASEC[c]?.label || c).join('、'),
      riasec, validity, hrProfile, recommendedJobs: recommended, majorFit: fit,
    },
    hollandCode: hollandText,
    createdAt: nowStr(),
  };
  const list = store.read('assessments', null) || (DB.dashboard?.latestAssessment ? [DB.dashboard.latestAssessment] : []);
  list.push(assessment);
  store.write('assessments', list.slice(-10));
  grantXp(30);
  return { assessment };
});
route('GET', '/assessment/mine', async () => ({ list: (store.read('assessments', null) || (DB.dashboard?.latestAssessment ? [DB.dashboard.latestAssessment] : [])).slice().reverse() }));

/* ---------- 行业 / 岗位 ---------- */
route('GET', '/industries', async () => ({ list: industries() }));
route('GET', /^\/jobs(\?.*)?$/, async ({ query }) => {
  const industryId = Number(query.get('industryId') || 0);
  const list = jobs().filter((j) => !industryId || j.industryId === industryId)
    .map((j) => ({ ...j, majors: jparse(j.majors, []), industryName: jobIndustryName(j.industryId) }));
  return { list };
});
route('GET', /^\/jobs\/(\d+)$/, async ({ params }) => {
  const job = jobs().find((j) => String(j.id) === String(params[0]));
  if (!job) throw httpError(404, '岗位不存在');
  return { job: { ...job, majors: jparse(job.majors, []), roadmap: job.roadmap || null } };
});

/* ---------- 竞赛 ---------- */
route('GET', /^\/contests(\?.*)?$/, async ({ query }) => {
  const kind = query.get('kind') || '';
  const category = query.get('category') || '';
  const college = query.get('college') || '';
  const q = (query.get('q') || '').trim().toLowerCase();
  let list = contests().filter((c) => c.enabled !== 0).map(decorateContest);
  if (kind) list = list.filter((c) => c.kind === kind);
  if (category) {
    list = category === 'recog' ? list.filter((c) => ['general', 'grad'].includes(c.category)) : list.filter((c) => c.category === category);
  }
  if (college) list = list.filter((c) => c.college === college);
  if (q) list = list.filter((c) => [c.name, c.host, c.college, c.note].some((s) => String(s || '').toLowerCase().includes(q)));
  const collegesList = [...new Set(contests().filter((c) => c.enabled !== 0 && c.college).map((c) => c.college))].sort();
  return { list, colleges: collegesList };
});
route('GET', '/contests/recommend', async ({ query }) => {
  const major = query.get('major') || currentUser().major || '';
  const college = collegeForMajor(major);
  const scored = contests().filter((c) => c.enabled !== 0).map(decorateContest).map((c) => {
    let score = 0; const ks = [];
    const text = contestText(c);
    if (college && c.college === college) { score += 3; ks.push('college'); }
    if (major && text.includes(String(major).toLowerCase())) { score += 2; ks.push('major'); }
    if (c.category === 'school') { score += 1; ks.push('school'); }
    if (c.category === 'grad') { score += 1; ks.push('grad'); }
    if (c.category === 'general') { score += 0.5; ks.push('general'); }
    if (c.category === 'enterprise') { score += 0.5; ks.push('enterprise'); }
    if (c.category === 'university') { score += 0.3; ks.push('university'); }
    const dl = isoDays(c.deadline);
    if (dl !== null && dl <= 0) score -= 0.5;
    return { ...decorateCard(c), score: Math.round(score * 10) / 10, reasons: reasons(...ks) };
  }).filter((x) => x.score > 0 && !(x.daysLeft !== null && x.daysLeft <= 0))
    .sort((a, b) => b.score - a.score).slice(0, 5);
  return { major, college, list: scored };
});
route('GET', '/contests/mine', async () => ({
  list: plansState().filter((p) => p.type === 'contest').map((p) => ({
    planId: p.id, title: p.title, contestId: p.contestId, progress: attachPlan(p).progress,
    createdAt: p.createdAt, done: (p.items || []).filter((i) => i.done).length,
  })),
}));
route('GET', /^\/contests\/(\d+)$/, async ({ params }) => {
  const c = contests().find((x) => String(x.id) === String(params[0]));
  if (!c) throw httpError(404, '竞赛不存在');
  const cText = contestText(c);
  const cMajors = new Set(majorsByCollege(c.college));
  const relatedJobs = jobs().map((j) => {
    let score = 0; const ks = [];
    const jm = jparse(j.majors, []);
    if (jm.some((m) => cMajors.has(m))) { score += 3; ks.push('college'); }
    for (const w of jparse(j.skills, [])) if (cText.includes(String(w).toLowerCase())) { score += 1; if (score <= 2) ks.push('skill'); }
    if (score <= 0) return null;
    return { id: j.id, name: j.name, score: Math.round(score * 10) / 10, reasons: reasons(...ks) };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 4);
  return { contest: decorateContest(c), relatedJobs };
});
route('POST', /^\/contests\/(\d+)\/plan$/, async ({ params }) => {
  const c = contests().find((x) => String(x.id) === String(params[0]));
  if (!c) throw httpError(404, '竞赛不存在');
  const list = plansState();
  const exist = list.find((p) => p.type === 'contest' && String(p.contestId) === String(c.id));
  if (exist) return { planId: exist.id, existed: true };
  const plan = {
    id: Date.now(), userId: currentUser().id, jobId: null, type: 'contest', pathKey: null,
    title: `【竞赛】${c.name}`, stages: [], progress: 0, createdAt: nowStr(), updatedAt: nowStr(),
    majorKey: null, contestId: c.id, grade: null,
    items: [
      { id: 1, planId: 0, stage: '报名与准备', title: '确认报名资格与时间节点', note: c.deadline || null, due: null, done: false, sort: 0, dimension: 'contest' },
      { id: 2, planId: 0, stage: '报名与准备', title: '组队并确定参赛方向', note: null, due: null, done: false, sort: 1, dimension: 'contest' },
      { id: 3, planId: 0, stage: '备赛', title: '制定备赛计划并分工推进', note: null, due: null, done: false, sort: 2, dimension: 'contest' },
      { id: 4, planId: 0, stage: '比赛', title: '提交作品 / 参加现场答辩', note: null, due: null, done: false, sort: 3, dimension: 'contest' },
    ],
  };
  list.push(plan);
  savePlans(list);
  return { planId: plan.id, existed: false };
});

/* ---------- 证书 ---------- */
route('GET', /^\/certificates(\?.*)?$/, async ({ query }) => {
  const type = query.get('type') || '';
  const category = query.get('category') || '';
  const q = (query.get('q') || '').trim().toLowerCase();
  let list = certificates().filter((c) => c.enabled !== 0).map((c) => ({ ...c, majors: jparse(c.majors, []) }));
  if (type) list = list.filter((c) => c.type === type);
  if (category) list = list.filter((c) => c.category === category);
  if (q) list = list.filter((c) => [c.name, c.host, c.category, c.note].some((s) => String(s || '').toLowerCase().includes(q)));
  return { list, policy: '我校综合测评依据《大学生综合素质测评办法》，国家级职业资格证书、外语/计算机等级证书、专业技能证书及学科竞赛获奖等可作为第二课堂/综测加分的证明，具体分值以学院当年细则为准。' };
});
route('GET', '/certificates/recommend', async ({ query }) => {
  const major = query.get('major') || currentUser().major || '';
  const college = collegeForMajor(major);
  const scored = certificates().filter((c) => c.enabled !== 0).map((c) => {
    const majors = jparse(c.majors, []);
    const text = certText(c);
    let score = 0; const ks = [];
    if (majors.includes(major)) { score += 3; ks.push('major'); }
    else if (major && majors.some((m) => m.includes(major) || major.includes(m))) { score += 2.5; ks.push('major'); }
    if (college && majors.some((m) => majorsByCollege(college).includes(m))) { score += 2; ks.push('college'); }
    else if (college && text.includes(college.toLowerCase())) { score += 2; ks.push('college'); }
    if (c.type === 'general') { score += 1; ks.push('general'); }
    if (/综测|加分/.test(c.bonus || '')) { score += 0.5; ks.push('bonus'); }
    if (c.type === 'professional') { score += 0.5; ks.push('professional'); }
    return { ...c, majors, score: Math.round(score * 10) / 10, reasons: reasons(...ks) };
  }).filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  return { major, college, list: scored };
});
route('GET', '/certificates/categories', async () => {
  const buckets = { general: [], professional: [] };
  for (const c of certificates()) {
    if (c.category && buckets[c.type] && !buckets[c.type].includes(c.category)) buckets[c.type].push(c.category);
  }
  return buckets;
});
route('GET', /^\/certificates\/(\d+)$/, async ({ params }) => {
  const c = certificates().find((x) => String(x.id) === String(params[0]));
  if (!c) throw httpError(404, '证书不存在');
  const cM = jparse(c.majors, []);
  const relatedJobs = jobs().map((j) => {
    const jm = jparse(j.majors, []);
    if (cM.length && jm.some((m) => cM.includes(m))) return { id: j.id, name: j.name, score: 3, reasons: ['专业对口'] };
    return null;
  }).filter(Boolean).slice(0, 4);
  return { certificate: { ...c, majors: cM }, relatedJobs };
});
route('POST', /^\/certificates\/(\d+)\/plan$/, async ({ params }) => {
  const c = certificates().find((x) => String(x.id) === String(params[0]));
  if (!c) throw httpError(404, '证书不存在');
  const r = createPlan({ type: 'cert', title: `【证书】${c.name}`, stages: [] });
  return { planId: r.plan.id, existed: r.existed };
});

/* ---------- 学校资料 ---------- */
route('GET', '/school/profile', async () => ({ school: { name: DB.school?.name || '中南财经政法大学', crawl_enabled: 0 } }));
route('GET', /^\/school\/colleges(\?.*)?$/, async () => {
  const list = colleges().map((c) => ({
    id: c.id, name: c.name, host: c.host, majors: jparse(c.majors, []), note: c.note || '',
    dest: jparse(c.dest), docCount: 0,
  }));
  return { list, total: list.length };
});
route('GET', /^\/school\/curriculums(\?.*)?$/, async ({ query }) => {
  const q = (query.get('q') || '').trim();
  const byCollege = {};
  let total = 0;
  for (const r of curriculums()) {
    if (q && !`${r.college} ${r.major} ${r.anchor || ''} ${r.grade || ''}`.includes(q)) continue;
    const list = (byCollege[r.college] = byCollege[r.college] || []);
    let entry = list.find((x) => x.major === r.major);
    if (!entry) { entry = { id: r.id, major: r.major, anchor: r.anchor, grades: [] }; list.push(entry); total++; }
    entry.grades.push({ id: r.id, grade: r.grade, year: r.grade ? String(r.grade).slice(0, 4) : '' });
  }
  return { list: Object.entries(byCollege).map(([name, majors]) => ({ name, majors })), total };
});
route('GET', /^\/school\/curriculums\/(\d+)$/, async ({ params }) => {
  const cv = curriculums().find((c) => String(c.id) === String(params[0]));
  if (!cv) throw httpError(404, '培养方案不存在');
  return {
    curriculum: {
      id: cv.id, college: cv.college, major: cv.major, anchor: cv.anchor,
      grade: cv.grade || '', courseCount: cv.courses.length,
      coreCount: cv.courses.filter((c) => c.core).length,
      courses: cv.courses, aiSummary: cv.aiSummary || '', aiImportant: jparse(cv.aiImportant, []),
    },
  };
});
route('POST', /^\/school\/curriculums\/(\d+)\/interpret$/, async ({ params }) => {
  const cv = curriculums().find((c) => String(c.id) === String(params[0]));
  if (!cv) throw httpError(404, '培养方案不存在');
  if (cv.aiSummary && cv.aiImportant) return { aiSummary: cv.aiSummary, aiImportant: jparse(cv.aiImportant, []), cached: true };
  const important = cv.courses.filter((c) => String(c.core) === '1' || c.core === 1).slice(0, 12)
    .map((c) => ({ code: c.code, name: c.name, credit: c.credit }));
  const summary = `${cv.college}「${cv.major}」（${cv.grade || '现行'} 版）共 ${cv.courses.length} 门课程，其中核心课 ${cv.courses.filter((c) => c.core).length} 门。建议优先保证专业核心课与数理基础课的成绩，这两类课程既是绩点主力，也是保研/考研与岗位笔试的共同底座。`;
  return { aiSummary: summary, aiImportant: important, cached: false };
});
route('GET', /^\/school\/docs(\?.*)?$/, async () => ({ list: [], total: 0 }));
route('GET', '/school/crawl-logs', async () => ({ logs: [] }));

/* ---------- 深造路线 ---------- */
route('GET', '/study/paths', async () => ({ list: studyPaths() }));
route('GET', /^\/study\/paths\/([\w-]+)$/, async ({ params }) => {
  const p = studyPaths().find((x) => x.key === params[0]);
  if (!p) throw httpError(404, '深造路径不存在');
  return { path: p };
});
route('GET', '/study/center/baoyan', async () => {
  const ba = jparse(SC().BAOYAN_CENTER, {});
  const bonusItems = (ba.bonusItems || []).map((it) => {
    const row = { ...it };
    if (row.source === 'cert') {
      const c = row.name ? certificates().find((x) => String(x.name).includes(row.name)) : certificates().find((x) => x.type === (row.type || 'general'));
      if (c) { row.certId = c.id; row.applyTime = c.applyTime; row.examTime = c.examTime; row.linked = true; }
    } else if (row.source === 'contest') {
      const cnt = contests().filter((c) => c.kind === 'academic' && c.category === (row.kind || 'general')).length;
      row.contestCount = cnt; row.linked = cnt > 0;
    } else row.linked = false;
    return row;
  });
  const br = jparse(ba.bonusRules, {});
  // 对齐 enrichBaoyan：collegeNames 取自 BONUS_RULES_BY_COLLEGE；collegeMap 逐学院给出可编辑项与来源
  const rulesByCollege = jparse(SC().BONUS_RULES_BY_COLLEGE, {});
  const ruleUrls = jparse(SC().COLLEGE_RULE_URLS, {});
  const collegeNames = Object.keys(rulesByCollege);
  const myCollege = collegeForMajor(currentUser().major);
  const activeCollege = myCollege && rulesByCollege[myCollege] ? myCollege : null;
  const activeRules = activeCollege ? rulesByCollege[activeCollege] : null;
  return {
    center: {
      ...ba,
      bonusItems,
      materials: jparse(SC().STUDY_MATERIALS, []),
      bonusRules: {
        formula: br.formula, campusCap: br.campusCap, campus: br.campus || [],
        activeCollege, collegeNames,
        collegeMap: Object.fromEntries(collegeNames.map((n) => [n, {
          editable: (rulesByCollege[n] || {}).editable || [],
          source: (rulesByCollege[n] || {}).source || '',
          unpub: !!(rulesByCollege[n] || {}).unpub,
          url: ruleUrls[n] || '',
        }])),
        editable: activeRules ? activeRules.editable : [],
        collegeSource: activeRules ? activeRules.source : (myCollege ? '该学院加分细则未整理，以学院当年公示为准' : '未识别到你的学院，按全校通用加分查看'),
        unpub: activeRules ? !!activeRules.unpub : false,
      },
    },
  };
});
route('GET', /^\/study\/center\/kaoyan(\?.*)?$/, async ({ query }) => {
  const q = (query.get('major') || '').trim();
  const all = jparse(SC().KAOYAN_DIRECTIONS, []);
  const family = jparse(SC().MAJOR_FAMILY, {});
  let directions = all;
  if (q) {
    const key = family[q];
    const hit = key ? all.filter((d) => d.key === key) : all.filter((d) => String(d.major).includes(q) || q.includes(String(d.major)));
    directions = hit.length ? hit : [all[0]];
  }
  return { major: q, academic: jparse(SC().KAOYAN_ACADEMIC, {}), directions, allMajors: colleges().flatMap((c) => jparse(c.majors, [])) };
});
route('GET', '/study/center/kaozhao', async () => ({ center: jparse(SC().KAOZHAO_CENTER, {}) }));
route('GET', '/study/abroad', async () => ({ campusProjects: jparse(SA().CAMPUS_PROJECTS, []), regions: jparse(SA().STUDY_ABROAD, []) }));
route('GET', '/study/calendar', async () => ({ list: jparse(SC().STUDY_CALENDAR, []) }));
route('GET', '/study/profile', async () => ({ profile: store.read('studyProfile', {}) }));
route('PUT', '/study/profile', async ({ body }) => {
  const profile = { ...store.read('studyProfile', {}), ...body };
  store.write('studyProfile', profile);
  return { profile, existed: false };
});
route('GET', '/study/subscriptions', async () => ({ list: subscriptionsState() }));
route('POST', '/study/subscriptions', async ({ body }) => {
  const list = subscriptionsState();
  const sub = { id: Date.now(), school: body.school, tier: body.tier || '稳', stage: body.stage || '准备', deadline: body.deadline || null, pathKey: body.pathKey || null };
  list.push(sub);
  store.write('subscriptions', list);
  return { sub };
});
route('DELETE', /^\/study\/subscriptions\/(\d+)$/, async ({ params }) => {
  const list = subscriptionsState().filter((s) => String(s.id) !== String(params[0]));
  store.write('subscriptions', list);
  return { message: '已删除' };
});
route('POST', /^\/study\/subscriptions\/(\d+)\/to-plan$/, async ({ params }) => {
  const sub = subscriptionsState().find((s) => String(s.id) === String(params[0]));
  const r = createPlan({ type: 'study', pathKey: sub?.pathKey || 'kaoyan', title: `【院校】${sub?.school || '目标院校'}` , stages: [] });
  return { plan: r.plan };
});
route('POST', '/study/center/plan', async ({ body }) => {
  const p = studyPaths().find((x) => x.key === body.path);
  const r = createPlan({ type: 'study', pathKey: body.path, title: `【深造】${p?.label || body.path}`, stages: p?.roadmap || [] });
  return { plan: r.plan, existed: r.existed, added: true };
});
route('POST', /^\/study\/position\/(baoyan|kaoyan|abroad)$/, async ({ params, body }) => {
  const kind = params[0];
  const id = Date.now();
  const profile = { ...store.read('studyProfile', {}), ...(body.profile || {}) };
  const report = localPositionReport(kind, profile);
  store.write('positionTask_' + id, report);
  store.write('positionReports', { ...(store.read('positionReports', {})), [kind === 'baoyan' ? 'baoyanPosition' : kind === 'kaoyan' ? 'kaoyanSchool' : 'abroadPosition']: report });
  return { taskId: id, async: true };
});
route('GET', /^\/tasks\/(\d+)$/, async ({ params }) => {
  const report = store.read('positionTask_' + params[0], null);
  if (!report) throw httpError(404, '任务不存在');
  return { task: { id: Number(params[0]), status: 'done', progress: 100, result: report } };
});
route('GET', /^\/study\/reports\/(\w+)$/, async ({ params }) => {
  const reports = store.read('positionReports', {});
  return { report: reports[params[0]] || null };
});
route('GET', /^\/study\/wizard\/positions(\?.*)?$/, async ({ query }) => {
  const wizard = jparse(SC().KAOZHAO_WIZARD, { positions: [], majorFamilies: [], degrees: [], politics: [], regions: [] });
  const picked = {
    majorFamily: query.get('majorFamily') || undefined,
    degree: query.get('degree') || undefined,
    politics: query.get('politics') || undefined,
    region: query.get('region') || undefined,
  };
  const fit = (arr, v) => !v || (Array.isArray(arr) && (arr.includes(v) || arr.includes('不限')));
  const positions = (wizard.positions || []).filter((p) =>
    fit(p.majorFit, picked.majorFamily) && fit(p.degreeFit, picked.degree) && fit(p.politicFit, picked.politics) && fit(p.regionFit, picked.region));
  return { positions, meta: { majorFamilies: wizard.majorFamilies, degrees: wizard.degrees, politics: wizard.politics, regions: wizard.regions } };
});

/* ---------- 职业顾问 ---------- */
route('GET', '/chat/sessions', async () => ({ list: sessionsState().slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) }));
route('POST', '/chat/sessions', async ({ body }) => {
  const list = sessionsState();
  const session = { id: Date.now(), userId: currentUser().id, title: body.title || '新对话', createdAt: nowStr(), updatedAt: nowStr() };
  list.push(session);
  store.write('chatSessions', list);
  const msgs = messagesState();
  msgs[session.id] = [];
  store.write('chatMessages', msgs);
  return { session };
});
route('DELETE', /^\/chat\/sessions\/(\d+)$/, async ({ params }) => {
  store.write('chatSessions', sessionsState().filter((s) => String(s.id) !== String(params[0])));
  const msgs = messagesState(); delete msgs[params[0]]; store.write('chatMessages', msgs);
  return { message: '删除成功' };
});
route('GET', /^\/chat\/sessions\/(\d+)\/messages$/, async ({ params }) => ({ list: messagesState()[params[0]] || [] }));

/* ---------- 计划 ---------- */
route('GET', '/plans/mine', async () => ({ list: plansState().map(attachPlan).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) }));
route('POST', '/plans', async ({ body }) => createPlan(body));
route('PUT', /^\/plans\/(\d+)$/, async ({ params, body }) => {
  const list = plansState();
  const p = list.find((x) => String(x.id) === String(params[0]));
  if (!p) throw httpError(404, '规划不存在');
  Object.assign(p, body, { updatedAt: nowStr() });
  savePlans(list);
  return { plan: attachPlan(p) };
});
route('DELETE', /^\/plans\/(\d+)$/, async ({ params }) => {
  savePlans(plansState().filter((p) => String(p.id) !== String(params[0])));
  return { ok: true };
});
route('POST', /^\/plans\/(\d+)\/items$/, async ({ params, body }) => {
  const list = plansState();
  const p = list.find((x) => String(x.id) === String(params[0]));
  if (!p) throw httpError(404, '规划不存在');
  p.items = p.items || [];
  const item = { id: Date.now(), planId: p.id, stage: body.stage || '通用', title: body.title, note: body.note || null, due: body.due || null, done: false, sort: p.items.length, dimension: body.dimension || 'career' };
  p.items.push(item);
  p.updatedAt = nowStr();
  savePlans(list);
  return { item };
});
route('PUT', /^\/plans\/items\/(\d+)$/, async ({ params, body }) => {
  const list = plansState();
  for (const p of list) {
    const it = (p.items || []).find((i) => String(i.id) === String(params[0]));
    if (it) {
      Object.assign(it, body);
      if (body.done === true && !it.doneAt) it.doneAt = nowStr();
      if (body.done === false) it.doneAt = null;
      p.updatedAt = nowStr();
      savePlans(list);
      return { item: it };
    }
  }
  throw httpError(404, '事项不存在');
});
route('DELETE', /^\/plans\/items\/(\d+)$/, async ({ params }) => {
  const list = plansState();
  for (const p of list) p.items = (p.items || []).filter((i) => String(i.id) !== String(params[0]));
  savePlans(list);
  return { ok: true };
});
route('POST', /^\/plans\/items\/(\d+)\/review$/, async ({ params }) => {
  const list = plansState();
  for (const p of list) {
    const it = (p.items || []).find((i) => String(i.id) === String(params[0]));
    if (it) {
      const done = it.done;
      return {
        review: done
          ? `「${it.title}」已经完成，说明你在执行上是有节奏的。下一步建议把它转成可展示的成果（写进简历的一条经历，或放进作品集），避免做完就散。同时回看这条事项是否还服务于当前目标，若目标已变化，及时调整后续事项。`
          : `「${it.title}」还没完成。先判断是「不会做」还是「没时间」：不会做就拆成一个 30 分钟能启动的最小动作；没时间就把它挪到本周固定时段。别追求一次做完，先让它动起来。`,
        item: it,
      };
    }
  }
  throw httpError(404, '事项不存在');
});

/* ---------- 简历 ---------- */
function resumeList() { return resumesState(); }
route('GET', '/resume/list', async () => ({
  list: resumeList().map((r) => ({ id: r.id, title: r.title, template: r.template, locked: r.locked, createdAt: r.createdAt, updatedAt: r.updatedAt })),
}));
route('GET', /^\/resume\/(\d+)$/, async ({ params }) => {
  const r = resumeList().find((x) => String(x.id) === String(params[0]));
  if (!r) throw httpError(404, '简历不存在');
  return { resume: { ...r, data: jparse(r.data, {}) } };
});
route('POST', '/resume', async ({ body }) => {
  const list = resumeList();
  const r = { id: Date.now(), userId: currentUser().id, title: body.title || '我的简历', template: body.template || 'classic', data: body.data || {}, locked: 0, createdAt: nowStr(), updatedAt: nowStr() };
  list.push(r);
  store.write('resumes', list);
  return { resume: { ...r } };
});
route('PUT', /^\/resume\/(\d+)$/, async ({ params, body }) => {
  const list = resumeList();
  const r = list.find((x) => String(x.id) === String(params[0]));
  if (!r) throw httpError(404, '简历不存在');
  Object.assign(r, body, { updatedAt: nowStr() });
  store.write('resumes', list);
  return { resume: { ...r } };
});
route('DELETE', /^\/resume\/(\d+)$/, async ({ params }) => {
  store.write('resumes', resumeList().filter((r) => String(r.id) !== String(params[0])));
  return { message: '已删除' };
});
route('POST', /^\/resume\/(\d+)\/(lock|unlock)$/, async ({ params }) => {
  const list = resumeList();
  const r = list.find((x) => String(x.id) === String(params[0]));
  if (!r) throw httpError(404, '简历不存在');
  r.locked = params[1] === 'lock' ? 1 : 0;
  store.write('resumes', list);
  return { resume: { ...r } };
});
route('GET', '/resume/match', async () => {
  const r = resumeList()[0];
  const data = r ? jparse(r.data, {}) : {};
  const skills = [data.basic?.title, ...(String(data.skillsText || '').split(/[,，、\s]+/))].filter(Boolean);
  const list = jobs().map((j) => {
    const js = jparse(j.skills, []);
    const matched = js.filter((s) => skills.some((rs) => String(rs).includes(String(s).slice(0, 2))));
    const gap = js.filter((s) => !matched.includes(s));
    return { id: j.id, name: j.name, industryName: jobIndustryName(j.industryId), score: js.length ? Math.round((matched.length / js.length) * 100) : 0, matched, gap };
  }).sort((a, b) => b.score - a.score).slice(0, 20);
  return { hasResume: !!r, skills, list };
});
route('POST', '/resume/generate', async ({ body }) => {
  const basic = body.basic || {};
  return {
    draft: {
      summary: `${basic.name || '同学'}，${basic.title || '目标岗位'}方向。具备扎实的专业基础与量化分析能力，习惯用数据说话；在校期间参与过课程项目与竞赛，能把复杂问题拆解成可执行的动作。`,
      skills: ['数据分析', '财务报表分析', 'Excel/PPT', 'Python 基础', '行业研究', '沟通协作', '项目管理'],
      projects: [
        { name: '课程研究项目（示例）', role: '组长', desc: '带队完成行业研究，搭建数据口径与估值框架，输出 20 页研究报告，答辩获课程优秀。', tech: 'Excel / Python / Wind' },
        { name: '校园实践项目（示例）', role: '核心成员', desc: '负责数据整理与结论输出，推动方案落地，参与人数覆盖 200+。', tech: 'Excel / 问卷工具' },
      ],
      awards: ['校级学业奖学金', '学科竞赛校级奖项', '社会实践优秀个人'],
      selfEval: '做事偏理性，喜欢先把问题定义清楚再动手；对数字敏感，能长期沉下心做分析类工作。',
    },
  };
});
route('POST', '/resume/polish', async ({ body }) => {
  const text = String(body.text || '').trim();
  const improved = text
    .replace(/负责/g, '主导')
    .replace(/参与/g, '深度参与')
    .replace(/做了/g, '完成')
    .replace(/提升/g, '提升')
    .replace(/[。；]\s*$/, '')
    + '，形成可复用的方法论并沉淀为团队文档。';
  return { text: improved };
});
route('POST', '/resume/optimize', async ({ body }) => {
  const text = String(body.resumeText || '');
  const hasNum = /\d/.test(text);
  const len = text.length;
  const score = Math.max(45, Math.min(88, 55 + (hasNum ? 12 : 0) + Math.min(15, Math.floor(len / 200))));
  return {
    report: {
      score,
      dims: { structure: Math.min(95, score + 5), content: score, quantify: hasNum ? score + 6 : score - 12, ats: score - 3, formatting: score + 2 },
      issues: [
        { severity: 'critical', title: '经历描述缺少量化结果', detail: '把「负责/参与」换成强动作动词，并补上规模、效率、金额等量化指标，例如「覆盖 200+ 用户」「效率提升 30%」。' },
        { severity: 'improve', title: '技能与目标岗位匹配度可提升', detail: '按目标岗位 JD 的高频关键词重排技能顺序，把最相关的 3 项放在最前面。' },
        { severity: 'polish', title: '版式可更紧凑', detail: '控制在 1 页内，条目统一「动词 + 事情 + 结果」句式，去掉与岗位无关的爱好描述。' },
      ],
      rewrites: [
        { original: '负责整理数据并做分析', improved: '独立完成 3 个业务口径的数据清洗与分析，输出结论支撑课程项目决策', why: '动词更强、口径与结果更具体' },
        { original: '参与社团活动', improved: '组织 2 场覆盖 200+ 人的校园活动，统筹物料与志愿者排班', why: '补充规模与职责，体现组织能力' },
      ],
      atsKeywords: ['数据分析', '财务分析', '行业研究', 'Excel', 'Python', '沟通协作', '项目管理'],
      suggestions: [
        '先把「经历」全部改成量化句式，这是提分最快的一项',
        '按目标岗位 JD 调整技能关键词顺序，提升 ATS 命中率',
        '压缩到 1 页，删除与岗位无关的课程罗列',
      ],
    },
  };
});

/* ---------- 面试 ---------- */
route('GET', '/questions', async () => ({ list: questions() }));
route('POST', '/ai/interview', async ({ body }) => {
  const msgs = body.messages || [];
  const userTurns = msgs.filter((m) => m.role === 'user').length;
  const replies = [
    '谢谢你的自我介绍。接下来想请你具体讲一个你最有成就感的项目：你当时负责哪一部分，遇到的最大困难是什么，最后是怎么解决的？',
    '了解。那如果让你重新做一次这个项目，你会在哪个环节做出不同的选择？为什么？',
    '不错的复盘。换个角度：如果团队里有人不配合进度，你会怎么处理？说一个你真实处理过的场景。',
    '最后留一点时间给你：关于这个岗位或团队，你有什么想问我的？',
  ];
  return { reply: replies[Math.min(userTurns - 1, replies.length - 1)] || replies[0] };
});
route('POST', '/ai/resume', async () => ({ result: '建议把经历改成「动词 + 事情 + 量化结果」的句式，并把与岗位最相关的技能放在最前面。' }));

/* ---------- 社区 ---------- */
route('GET', /^\/posts(\?.*)?$/, async ({ query }) => {
  const board = query.get('board') || 'all';
  const category = query.get('category') || '';
  const mine = query.get('mine') === '1';
  let list = postsState().filter((p) => p.status === 'approved');
  if (board !== 'all') list = list.filter((p) => p.board === board);
  if (category && category !== '全部') list = list.filter((p) => p.category === category);
  if (mine) list = list.filter((p) => p.userId === currentUser().id);
  list = list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { list: list.map(withInteractions) };
});
route('GET', /^\/posts\/ranking(\?.*)?$/, async ({ query }) => {
  const period = query.get('period') || 'total';
  const sort = query.get('sort') || 'hot';
  let list = postsState().filter((p) => p.status === 'approved');
  const win = { day: 1, week: 7, month: 30 }[period];
  if (win) {
    const cutoff = Date.now() - win * 86400000;
    list = list.filter((p) => Date.parse(String(p.createdAt).replace(' ', 'T')) >= cutoff);
  }
  const key = sort === 'likes' ? 'likes' : sort === 'favorites' ? 'favoriteCount' : 'hotScore';
  list = list.sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, 20);
  return { list: list.map(withInteractions) };
});
route('GET', /^\/posts\/(\d+)$/, async ({ params }) => {
  const p = postsState().find((x) => String(x.id) === String(params[0]));
  if (!p) throw httpError(404, '帖子不存在');
  return { post: withInteractions(p) };
});
route('POST', '/posts', async ({ body }) => {
  const list = postsState();
  const post = {
    id: Date.now(), userId: currentUser().id, title: body.title, content: body.content,
    category: body.category || '经验', likes: 0, createdAt: nowStr(), updatedAt: nowStr(),
    board: body.board === 'treehole' ? 'treehole' : 'experience', anon: body.anon ? 1 : 0,
    status: 'approved', favoriteCount: 0, commentCount: 0, hotScore: 0,
    pinnedUntil: null, sourceName: body.sourceName || null, sourceUrl: body.sourceUrl || null,
    author: { username: currentUser().username, nickname: body.anon ? '树洞用户' + String(currentUser().id).slice(-4) : currentUser().nickname, avatar: null, level: buildGrowth().level },
  };
  list.unshift(post);
  store.write('posts', list);
  grantXp(15);
  return { post: withInteractions(post) };
});
route('POST', /^\/posts\/(\d+)\/like$/, async ({ params }) => {
  const list = postsState();
  const p = list.find((x) => String(x.id) === String(params[0]));
  if (!p) throw httpError(404, '帖子不存在');
  const likes = store.read('likes', []);
  const on = likes.some((x) => String(x.id) === String(params[0]));
  if (on) { p.likes = Math.max(0, (p.likes || 0) - 1); store.write('likes', likes.filter((x) => String(x.id) !== String(params[0]))); }
  else { p.likes = (p.likes || 0) + 1; likes.push({ id: p.id }); store.write('likes', likes); }
  store.write('posts', list);
  return { liked: !on, likes: p.likes };
});
route('POST', /^\/posts\/(\d+)\/favorite$/, async ({ params }) => {
  const list = postsState();
  const p = list.find((x) => String(x.id) === String(params[0]));
  if (!p) throw httpError(404, '帖子不存在');
  const favs = favoritesState();
  if (!favs.some((x) => String(x.id) === String(params[0]))) {
    favs.push({ ...p, author: p.author });
    store.write('favorites', favs);
    p.favoriteCount = (p.favoriteCount || 0) + 1;
    store.write('posts', list);
  }
  return { favorited: true, favoriteCount: p.favoriteCount || 1 };
});
route('DELETE', /^\/posts\/(\d+)\/favorite$/, async ({ params }) => {
  const favs = favoritesState().filter((x) => String(x.id) !== String(params[0]));
  store.write('favorites', favs);
  const list = postsState();
  const p = list.find((x) => String(x.id) === String(params[0]));
  if (p) { p.favoriteCount = Math.max(0, (p.favoriteCount || 1) - 1); store.write('posts', list); }
  return { favorited: false, favoriteCount: p?.favoriteCount || 0 };
});
route('GET', '/favorites', async () => ({ list: favoritesState().map(withInteractions) }));
route('GET', /^\/posts\/(\d+)\/comments(\?.*)?$/, async ({ params, query }) => {
  const sort = query.get('sort') || 'hot';
  let list = commentsState().filter((c) => String(c.postId) === String(params[0]));
  list = sort === 'new'
    ? list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    : list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  return { list: list.map((c) => ({ ...c, author: { username: currentUser().username, nickname: currentUser().nickname, avatar: null } })) };
});
route('POST', /^\/posts\/(\d+)\/comments$/, async ({ params, body }) => {
  const list = commentsState();
  const c = { id: Date.now(), postId: Number(params[0]), userId: currentUser().id, content: body.content, createdAt: nowStr(), updatedAt: nowStr(), parentId: body.parentId || null, likes: 0, author: { username: currentUser().username, nickname: currentUser().nickname, avatar: null } };
  list.push(c);
  store.write('comments', list);
  const posts = postsState();
  const p = posts.find((x) => String(x.id) === String(params[0]));
  if (p) { p.commentCount = (p.commentCount || 0) + 1; store.write('posts', posts); }
  return { comment: c };
});
route('POST', /^\/comments\/(\d+)\/like$/, async () => ({ liked: true, likes: 1 }));
route('POST', /^\/posts\/(\d+)\/pin$/, async () => ({ ok: true, pinnedUntil: nowStr(), cost: 20, points: store.read('points', 0) }));
route('POST', /^\/posts\/(\d+)\/report$/, async () => ({ reported: true, message: '已举报，等待处理' }));
route('POST', /^\/comments\/(\d+)\/report$/, async () => ({ reported: true, message: '已举报，等待处理' }));
route('POST', /^\/posts\/(\d+)\/favorite$/, async ({ params }) => {
  const list = postsState();
  const p = list.find((x) => String(x.id) === String(params[0]));
  return { favorited: true, favoriteCount: p?.favoriteCount || 1 };
});

/* ---------- 管理后台（演示学生非管理员，接口保留避免报错） ---------- */
route('GET', '/admin/users', async () => ({ list: [{ id: 5, username: currentUser().username, nickname: currentUser().nickname, major: currentUser().major, role: 'student', createdAt: nowStr() }] }));
route('GET', '/admin/posts/pending', async () => ({ list: [] }));
route('GET', /^\/admin\/reports(\?.*)?$/, async () => ({ list: [] }));
route('GET', '/admin/sensitive-words', async () => ({ list: [] }));
route('POST', '/admin/sensitive-words', async ({ body }) => ({ item: { id: Date.now(), word: body.word, level: body.level || 'soft' } }));
route('DELETE', /^\/admin\/sensitive-words\/(\d+)$/, async () => ({ ok: true }));
route('POST', /^\/admin\/posts\/(\d+)\/(approve|reject)$/, async () => ({ ok: true }));
route('DELETE', /^\/admin\/posts\/(\d+)$/, async () => ({ ok: true }));
route('POST', /^\/admin\/reports\/(\d+)\/handle$/, async () => ({ ok: true }));
route('PUT', /^\/admin\/users\/(\d+)\/role$/, async () => ({ ok: true }));
route('PUT', /^\/admin\/industries\/(\d+)$/, async () => ({ ok: true }));
route('PUT', /^\/admin\/jobs\/(\d+)$/, async () => ({ ok: true }));
route('PUT', /^\/admin\/questions\/(\d+)$/, async () => ({ ok: true }));
route('DELETE', /^\/admin\/industries\/(\d+)$/, async () => ({ ok: true }));
route('DELETE', /^\/admin\/jobs\/(\d+)$/, async () => ({ ok: true }));
route('DELETE', /^\/admin\/questions\/(\d+)$/, async () => ({ ok: true }));
route('DELETE', /^\/admin\/users\/(\d+)$/, async () => ({ ok: true }));
route('POST', /^\/admin\/(industries|jobs|sensitive-words)$/, async () => ({ ok: true }));
route('POST', '/school/crawl', async () => ({ message: '静态演示版不执行抓取' }));
route('PUT', '/school/settings', async () => ({ school: { name: DB.school?.name || '中南财经政法大学' } }));
route('DELETE', /^\/school\/docs\/(\d+)$/, async () => ({ message: '已删除' }));

/* ============================== 分发器 ============================== */
function httpError(status, message) {
  const err = new Error(message);
  err.response = { status, data: { message } };
  return err;
}

function parseUrl(url) {
  const [pathPart, search] = String(url).split('?');
  return { path: pathPart, query: new URLSearchParams(search || '') };
}

async function dispatch(method, url, body) {
  const { path, query } = parseUrl(url);
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (m) {
      const params = m.slice(1).filter((x) => x !== undefined);
      const res = await r.handler({ params, query, body: body || {} });
      return res;
    }
  }
  // 未覆盖的接口：返回空对象，避免页面崩溃（并在控制台提示，便于排查）
  console.warn('[静态适配器] 未实现的接口：', method, url);
  return {};
}

/* ============================== 对外接口（与 axios 版签名一致） ============================== */
const http = {
  get(url, config) {
    const qs = config && config.params ? '?' + new URLSearchParams(config.params).toString() : '';
    return dispatch('GET', url + qs).then(clone);
  },
  post(url, body) { return dispatch('POST', url, body).then(clone); },
  put(url, body) { return dispatch('PUT', url, body).then(clone); },
  delete(url) { return dispatch('DELETE', url).then(clone); },
};

/**
 * 流式对话（静态版）：按字符分片推送，模拟 SSE 打字机效果。
 * 回复内容由真实数据（专业 / 深造路线 / 岗位 / 竞赛）组合生成，非大模型输出。
 */
export async function streamChat(url, body, onDelta) {
  const text = composeAdvisorReply(String(body.content || ''));
  const chunks = text.match(/[\s\S]{1,6}/g) || [text];
  for (const c of chunks) {
    await new Promise((r) => setTimeout(r, 26));
    onDelta && onDelta(c);
  }
  // 落库到本地会话
  const m = String(url).match(/\/chat\/sessions\/(\d+)\/messages\/stream/);
  if (m) {
    const sid = m[1];
    const msgs = messagesState();
    msgs[sid] = msgs[sid] || [];
    msgs[sid].push({ id: Date.now(), sessionId: Number(sid), role: 'user', content: body.content, createdAt: nowStr() });
    msgs[sid].push({ id: Date.now() + 1, sessionId: Number(sid), role: 'assistant', content: text, createdAt: nowStr() });
    store.write('chatMessages', msgs);
    const sessions = sessionsState();
    const s = sessions.find((x) => String(x.id) === String(sid));
    if (s) {
      if (s.title === '新对话') s.title = body.content.slice(0, 20);
      s.updatedAt = nowStr();
      store.write('chatSessions', sessions);
    }
  }
  return { content: text };
}

/** 本地顾问回复：从真实资料库里拼出与问题相关的建议 */
function composeAdvisorReply(q) {
  const major = currentUser().major || '金融学';
  const paths = studyPaths();
  const topJobs = jobs().filter((j) => (jparse(j.majors, []) || []).includes(major)).slice(0, 3);
  const gradContests = contests().filter((c) => c.category === 'grad').slice(0, 2);
  const related = paths.find((p) => q.includes(p.label)) || paths[0];
  const jobLine = topJobs.length ? topJobs.map((j) => `「${j.name}」`).join('、') : '「银行对公客户经理」';
  const contestLine = gradContests.length ? gradContests.map((c) => `「${c.name}」`).join('、') : '';
  return [
    `你问的是「${q.slice(0, 30)}${q.length > 30 ? '…' : ''}」。先把目标说清楚：${major}专业常见的对口方向有 ${jobLine}，深造侧可以走「${related?.label || '考研'}」路线。`,
    '',
    `**先做三件事**  \n- 用职业测评把兴趣与能力定下来（结果会直接影响后面的选择）；  \n- 选 1 个对口岗位，把它要求的技能列成清单，对照自己打分，缺口就是接下来一学期要补的；  \n- 把目标拆到学期：低年级先保绩点与基础课，高年级再上实习与竞赛。`,
    '',
    contestLine ? `**可以关注的竞赛**：${contestLine}。报名时间与层级在「竞赛中心」里能查，建议先加进「我的规划」再逐项推进。` : '',
    '',
    '（说明：静态演示版的这段回复由本地资料库规则生成，不是大模型输出；完整版接入通义千问后，会结合你的测评结果与本校资料给出个性化建议。）',
  ].filter(Boolean).join('\n');
}

export default http;
