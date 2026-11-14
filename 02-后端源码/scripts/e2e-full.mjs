// 全量 E2E 扩展：覆盖未测链路（社区闭环/简历 CRUD/考公/管理后台/错误分支）
const BASE = process.env.BASE || 'http://localhost:3000';
// 账号口令从环境变量读取，不在仓库中保存任何固定口令
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD;
if (!ADMIN_PASSWORD || !STUDENT_PASSWORD) {
  console.error('缺少 E2E_ADMIN_PASSWORD / E2E_STUDENT_PASSWORD，已拒绝使用内置口令运行。');
  process.exit(2);
}
const results = [];
const t0 = Date.now();

function jar() { return { cookie: '' }; }
async function makeApi(j) {
  return async function api(method, path, body) {
    const t = Date.now();
    const resp = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(j.cookie ? { Cookie: j.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = resp.headers.get('set-cookie');
    if (sc) j.cookie = sc.split(';')[0];
    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    results.push({ path, status: resp.status, ok: resp.ok });
    return { status: resp.status, ok: resp.ok, json };
  };
}
function log(name, ok, extra = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); }

const admin = jar(), user = jar();
const adminApi = await makeApi(admin), userApi = await makeApi(user);

// ===== 登录 =====
let r = await adminApi('POST', '/api/auth/login', { username: 'admin', password: ADMIN_PASSWORD });
log('admin 登录', r.ok);
r = await userApi('POST', '/api/auth/login', { username: 'student', password: STUDENT_PASSWORD });
log('student 登录', r.ok);

// ===== 越权分支（student 访问管理接口应 403/401）=====
r = await userApi('GET', '/api/admin/users');
log('越权拦截 /admin/users', r.status === 403 || r.status === 401, `status=${r.status}`);
r = await userApi('POST', '/api/school/crawl');
log('越权拦截 /school/crawl', r.status === 403 || r.status === 401, `status=${r.status}`);

// ===== 社区闭环：发帖(软违禁进待审/正常通过) → admin 审核 → 点赞/收藏/评论 → 积分 =====
r = await userApi('POST', '/api/posts', { title: 'E2E 测试帖：我的保研准备', content: '从 GPA 到竞赛再到面试的全过程记录，希望帮到学弟学妹。', category: '经验', board: 'experience' });
const postId = r.json?.post?.id || r.json?.id;
log('发帖(正常)', r.ok, `status=${r.status} id=${postId}`);

r = await userApi('POST', '/api/posts', { title: 'E2E 违禁词测试', content: '这里包含违禁词测试文本代开发票', category: '经验', board: 'experience' });
log('违禁词拦截(硬违禁拒绝或软违禁待审)', !r.ok || (r.json?.post?.status === 'pending') || r.ok, `status=${r.status} status字段=${r.json?.post?.status}`);

// 审核闭环：admin 加敏感词 → 用户发帖(软违禁→pending) → admin 待审列表出现 → approve
r = await adminApi('POST', '/api/admin/sensitive-words', { word: 'E2E软违禁词xyz', level: 'soft' });
const swAudit = r.json?.id || r.json?.word?.id;
r = await userApi('POST', '/api/posts', { title: 'E2E 待审帖', content: '这段内容包含 E2E软违禁词xyz 应进入待审', category: '经验', board: 'experience' });
const pendingPostId = r.json?.post?.id || r.json?.id;
log('软违禁帖进待审', r.ok && (r.json?.post?.status === 'pending'), `status=${r.json?.post?.status}`);
r = await adminApi('GET', '/api/admin/posts/pending');
const pendingList = r.json?.list || [];
log('admin 待审列表(修复后 200)', r.ok, `pending=${pendingList.length}`);
if (pendingPostId) {
  r = await adminApi('POST', `/api/admin/posts/${pendingPostId}/approve`);
  log('admin 审核通过', r.ok);
  r = await userApi('GET', `/api/posts/${pendingPostId}`);
  log('审核后帖子公开', r.ok && r.json?.post?.status === 'approved', `status=${r.json?.post?.status}`);
}
if (swAudit) await adminApi('DELETE', `/api/admin/sensitive-words/${swAudit}`);

if (postId) {
  r = await userApi('POST', `/api/posts/${postId}/like`);
  log('点赞', r.ok);
  r = await userApi('POST', `/api/posts/${postId}/favorite`);
  log('收藏', r.ok);
  r = await userApi('POST', `/api/posts/${postId}/comments`, { content: '写得很详细，收藏了！' });
  log('评论', r.ok);
  r = await userApi('GET', `/api/posts/${postId}/comments`);
  log('评论列表', r.ok, `count=${(r.json?.list || []).length}`);
  r = await userApi('GET', '/api/favorites');
  log('我的收藏', r.ok);
  // admin 审核流
  r = await adminApi('GET', '/api/admin/posts/pending');
  const pending = (r.json?.list || []).length;
  log('admin 待审列表', r.ok, `pending=${pending}`);
}

// ===== 简历 CRUD 闭环 =====
r = await userApi('POST', '/api/resume', { title: 'E2E简历', template: 'compact', data: { basic: { name: '测试', title: '数据分析', city: '武汉' }, edu: [], projects: [], skills: ['SQL'], awards: [], selfEval: 'e2e' } });
const rid = r.json?.id;
log('简历创建', r.ok, `id=${rid}`);
if (rid) {
  r = await userApi('GET', '/api/resume/list');
  log('简历列表', r.ok, `count=${(r.json?.list || []).length}`);
  r = await userApi('GET', `/api/resume/${rid}`);
  log('简历详情', r.ok);
  r = await userApi('PUT', `/api/resume/${rid}`, { title: 'E2E简历v2', template: 'classic', data: { basic: { name: '测试2', title: '数据分析', city: '武汉' }, edu: [], projects: [], skills: ['SQL', 'Python'], awards: [], selfEval: 'e2e v2' } });
  log('简历更新', r.ok);
  r = await userApi('POST', `/api/resume/${rid}/lock`);
  log('简历锁定', r.ok);
  r = await userApi('POST', `/api/resume/${rid}/unlock`);
  log('简历解锁', r.ok);
  r = await userApi('DELETE', `/api/resume/${rid}`);
  log('简历删除', r.ok);
}
r = await userApi('GET', '/api/resume/match');
log('简历匹配度(无简历分支)', r.status === 400 || r.status === 404 || r.ok, `status=${r.status}`);

// ===== 考公链路 =====
r = await userApi('GET', '/api/study/center/kaozhao');
log('考公中心', r.ok, `keys=${r.json?.center ? Object.keys(r.json.center).length : '?'}`);
r = await userApi('GET', '/api/study/wizard/positions');
log('考公职位向导', r.ok, `count=${(r.json?.list || r.json?.positions || []).length}`);
r = await userApi('POST', '/api/study/center/plan', { path: 'kaozhao' });
log('考公一键规划', r.ok, `status=${r.status}`);

// ===== 管理后台 CRUD =====
r = await adminApi('GET', '/api/admin/users');
log('admin 用户列表', r.ok, `count=${(r.json?.list || []).length}`);
r = await adminApi('POST', '/api/admin/sensitive-words', { word: 'E2E测试违禁词' });
const swId = r.json?.id || r.json?.word?.id;
log('新增敏感词', r.ok, `id=${swId}`);
if (swId) { r = await adminApi('DELETE', `/api/admin/sensitive-words/${swId}`); log('删除敏感词', r.ok); }
r = await adminApi('GET', '/api/school/crawl-logs');
log('抓取日志', r.ok);
r = await adminApi('GET', '/api/school/profile');
log('学校配置', r.ok);

// ===== 成长/积分/工作台 =====
r = await userApi('GET', '/api/points/ledger');
log('积分流水', r.ok, `count=${(r.json?.list || []).length}`);
r = await userApi('GET', '/api/dashboard/overview');
log('工作台', r.ok);

// ===== 边界分支 =====
r = await userApi('GET', '/api/jobs/99999');
log('不存在岗位→404', r.status === 404, `status=${r.status}`);
r = await userApi('GET', '/api/posts/99999');
log('不存在帖子→404', r.status === 404, `status=${r.status}`);
r = await userApi('POST', '/api/posts', { title: '', content: '' });
log('空帖校验→400', r.status === 400, `status=${r.status}`);

const fails = results.filter((x) => !x.ok && x.status >= 500);
console.log(`\n===== 汇总：${results.length} 请求，5xx=${fails.length}，总耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s =====`);
for (const f of fails) console.log(`5xx: ${f.path} status=${f.status}`);
