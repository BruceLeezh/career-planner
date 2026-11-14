// 端到端冒烟测试：验证核心 API 链路（注册→登录→测评→资源→规划→AI 对话）
const BASE = process.env.BASE || 'http://localhost:3000';
let cookie = '';
const results = [];
const t0 = Date.now();

async function api(method, path, body, { raw = false } = {}) {
  const t = Date.now();
  const resp = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = resp.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  results.push({ path, method, status: resp.status, ms: Date.now() - t, ok: resp.ok });
  return { status: resp.status, ok: resp.ok, json, text: raw ? text : undefined };
}

function log(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
}

const { randomUUID, randomBytes } = await import('node:crypto');
const username = 'smoke_' + randomUUID().slice(0, 8);
// 冒烟测试使用一次性随机口令，避免仓库出现真实口令
const password = process.env.E2E_SMOKE_PASSWORD || `${randomBytes(9).toString('base64url')}#Aa1`;

// 1. 注册
let r = await api('POST', '/api/auth/register', { username, password, nickname: '冒烟测试' });
log('注册 ' + username, r.ok || r.status === 409, `status=${r.status}`);

// 2. 登录
r = await api('POST', '/api/auth/login', { username, password });
log('登录', r.ok, `status=${r.status}`);
if (!r.ok) { console.log('登录失败，中止'); printSummary(); process.exit(1); }

// 3. 当前用户
r = await api('GET', '/api/auth/me');
log('auth/me', r.ok && r.json?.user?.username === username, `status=${r.status}`);

// 4. 测评题库
r = await api('GET', '/api/assessment/questions');
const dims = r.json?.dimensions || [];
const qCount = dims.reduce((n, d) => n + (d.questions?.length || 0), 0);
log('测评题库', r.ok && dims.length > 0, `dimensions=${dims.length} questions=${qCount}`);

// 5. 提交测评（构造一致性作答：每维按 idx 梯度取值）
const answers = [];
for (const d of dims) {
  (d.questions || []).forEach((q, idx) => {
    answers.push({ dimension: d.key, idx, value: Math.min(5, 3 + (idx % 3) - (idx % 2 ? 1 : 0) + (idx % 4 === 0 ? 1 : 0)) });
  });
}
r = await api('POST', '/api/assessment/submit', { answers });
const taskId = r.json?.taskId || r.json?.task?.id;
log('提交测评', r.ok, `status=${r.status}${taskId ? ' taskId=' + taskId : ''}`);

// 6. 若为异步 AI 任务则轮询
if (taskId) {
  let done = false, last = '';
  for (let i = 0; i < 40; i++) {
    await new Promise((s) => setTimeout(s, 3000));
    const tr = await api('GET', '/api/tasks/' + taskId);
    last = tr.json?.status || '?';
    if (['done', 'completed', 'success', 'failed', 'error'].includes(last)) { done = true; break; }
  }
  log('AI 测评解读任务', done && !['failed', 'error'].includes(last), `status=${last}`);
  if (last === 'failed' || last === 'error') {
    const tr = await api('GET', '/api/tasks/' + taskId);
    console.log('  任务错误详情:', JSON.stringify(tr.json).slice(0, 300));
  }
}

// 7. 职业资源
r = await api('GET', '/api/industries');
const industries = r.json?.industries || r.json || [];
log('行业列表', r.ok, `count=${Array.isArray(industries) ? industries.length : '?'}`);
r = await api('GET', '/api/jobs');
const jobs = r.json?.jobs || r.json || [];
log('岗位列表', r.ok, `count=${Array.isArray(jobs) ? jobs.length : '?'}`);
if (Array.isArray(jobs) && jobs[0]?.id) {
  r = await api('GET', '/api/jobs/' + jobs[0].id);
  log('岗位详情', r.ok, `id=${jobs[0].id}`);
}

// 8. 深造路线
r = await api('GET', '/api/study/paths');
const paths = r.json?.paths || r.json || [];
log('深造路线列表', r.ok, `count=${Array.isArray(paths) ? paths.length : '?'}`);
if (Array.isArray(paths) && paths[0]?.key) {
  r = await api('GET', '/api/study/paths/' + paths[0].key);
  log('深造路线详情', r.ok, `key=${paths[0].key}`);
}

// 9. 竞赛/证书/本校资料
r = await api('GET', '/api/contests');
const contests = r.json?.contests || r.json?.items || r.json || [];
log('竞赛库', r.ok, `count=${Array.isArray(contests) ? contests.length : '?'}`);
r = await api('GET', '/api/certificates');
const certs = r.json?.certificates || r.json?.items || r.json || [];
log('证书库', r.ok, `count=${Array.isArray(certs) ? certs.length : '?'}`);
r = await api('GET', '/api/school/colleges');
log('学院专业', r.ok, `status=${r.status}`);
r = await api('GET', '/api/school/curriculums');
log('培养方案', r.ok, `status=${r.status}`);

// 10. 竞赛加入规划 → 我的规划
if (Array.isArray(contests) && contests[0]?.id) {
  r = await api('POST', `/api/contests/${contests[0].id}/plan`, {});
  log('竞赛加入规划', r.ok, `status=${r.status} ${r.json?.message || ''}`);
}
r = await api('GET', '/api/plans/mine');
log('我的规划', r.ok, `status=${r.status}`);

// 11. 社区/成长/工作台
r = await api('GET', '/api/posts');
log('社区帖子', r.ok, `status=${r.status}`);
r = await api('POST', '/api/growth/checkin', {});
log('每日签到', r.ok, `status=${r.status} ${r.json?.message || ''}`);
r = await api('GET', '/api/growth');
log('成长体系', r.ok, `status=${r.status}`);
r = await api('GET', '/api/dashboard/overview');
log('工作台总览', r.ok, `status=${r.status}`);

// 12. AI 对话（真实调用大模型）
r = await api('POST', '/api/chat/sessions', { title: '冒烟测试对话' });
const sid = r.json?.id || r.json?.session?.id;
log('创建对话会话', r.ok, `status=${r.status} id=${sid}`);
if (sid) {
  const ct = Date.now();
  r = await api('POST', `/api/chat/sessions/${sid}/messages`, { content: '用一句话回答：大二学生想保研，大一应该抓什么？' });
  const reply = r.json?.assistantMessage?.content || r.json?.reply || r.json?.content || '';
  log('AI 对话', r.ok && reply.length > 5, `status=${r.status} ${((Date.now() - ct) / 1000).toFixed(1)}s 回复${reply.length}字: ${reply.slice(0, 60).replace(/\n/g, ' ')}`);
}

printSummary();

function printSummary() {
  const fails = results.filter((x) => !x.ok);
  console.log('\n===== 汇总 =====');
  console.log(`共 ${results.length} 次请求，失败 ${fails.length}，总耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const f of fails) console.log(`FAIL ${f.method} ${f.path} status=${f.status} ${f.ms}ms`);
}
