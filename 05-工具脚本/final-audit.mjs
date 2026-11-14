const HOME = process.env.USERPROFILE || process.env.HOME || '';
import { pathToFileURL } from 'node:url';
const pwPath = HOME + '/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.js';
const exe = HOME + '/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const _pw = await import(pathToFileURL(pwPath).href);
const chromium = _pw.chromium || _pw.default.chromium;
const BASE = 'http://127.0.0.1:8799/index.html';

const b = await chromium.launch({ headless: true, executablePath: exe });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGE:' + String(e).slice(0, 110)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('CON:' + m.text().slice(0, 100)); });

await p.goto(BASE + '#/login'); await p.waitForTimeout(900);
const ins = p.locator('input');
await ins.nth(0).fill('student'); await ins.nth(1).fill('123456');
await p.locator('button:has-text("登录")').last().click(); await p.waitForTimeout(1800);

const pages = [
  ['/', '每一段规划'], ['/assessment', '职业画像'], ['/school', '培养方案'],
  ['/study', '深造中心'], ['/study/kaoyan', '考研'], ['/competition', '竞赛中心'],
  ['/certificate', '证书中心'], ['/resume', '简历工作台'], ['/interview', '模拟面试'],
  ['/civil', '考公选调'], ['/resources', '岗位百科'], ['/plans', '我的规划'],
  ['/chat', 'AI 职业顾问'], ['/forum', '社区'], ['/profile', '个人中心'],
];
console.log('--- 页面渲染 ---');
for (const [r, kw] of pages) {
  await p.goto(BASE + '#' + r); await p.waitForTimeout(1100);
  const t = (await p.textContent('body')).replace(/\s+/g, ' ');
  console.log(`${r.padEnd(14)} ${t.includes(kw) ? 'OK' : '✗ 缺「' + kw + '」'}  len=${t.length}`);
}

// 交互抽查
console.log('\n--- 交互 ---');
// 1) 本校资料：点专业 → 课程数 + AI解读
await p.goto(BASE + '#/school'); await p.waitForTimeout(1500);
const chip = p.locator('.col-card .major-chip').nth(10);
if (await chip.count()) { await chip.click(); await p.waitForTimeout(1800); }
let t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('培养方案详情: 课程总数', (t.match(/课程总数\s*(\d+)/) || [])[1] || '✗', '| AI解读', t.includes('AI 培养方案解读') ? 'OK' : '✗');
// 2) 加入规划
const addBtn = p.locator('.el-button:has-text("加入我的规划")').first();
if (await addBtn.count()) { await addBtn.click(); await p.waitForTimeout(1200); }
// 3) 竞赛详情 + 加入
await p.goto(BASE + '#/competition'); await p.waitForTimeout(1400);
const dbtn = p.locator('.el-button:has-text("详情")').first();
if (await dbtn.count()) { await dbtn.click(); await p.waitForTimeout(1000); }
const join = p.locator('.el-button:has-text("加入我的规划")').first();
if (await join.count()) { await join.click(); await p.waitForTimeout(1000); }
// 4) 证书推荐 + 详情
await p.goto(BASE + '#/certificate'); await p.waitForTimeout(1400);
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('证书库: 推荐', t.includes('为你推荐') || t.includes('推荐') ? 'OK' : '?', '| 条数', (t.match(/(\d+) 本/) || [])[1] || '?');
// 5) 简历：优化报告
await p.goto(BASE + '#/resume'); await p.waitForTimeout(1400);
try {
  const opt = p.locator('.el-tabs__item:has-text("简历优化")').first();
  if (await opt.count()) { await opt.click(); await p.waitForTimeout(700); }
  const ta = p.locator('textarea:visible').first();
  if (await ta.count()) { await ta.fill('负责整理数据并做分析，参与社团活动。'); await p.waitForTimeout(300); }
  const run = p.locator('.el-button:has-text("开始诊断"), .el-button:has-text("诊断")').filter({ visible: true }).last();
  if (await run.count()) { await run.click(); await p.waitForTimeout(2000); }
} catch (e) { console.log('  (简历步骤跳过:', e.message.split('\n')[0].slice(0, 50), ')'); }
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('简历优化: 结果', /总分|简历评分|必改|可打磨/.test(t) ? 'OK' : '未出结果');
// 6) 模拟面试发一句
await p.goto(BASE + '#/interview'); await p.waitForTimeout(1200);
const ita = p.locator('textarea').last();
if (await ita.count()) { await ita.fill('我是金融学专业学生，做过数据分析项目。'); await p.keyboard.press('Enter'); await p.waitForTimeout(2000); }
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('模拟面试: 有回复', t.length > 300 ? 'OK' : '?');
// 7) 规划页统计
await p.goto(BASE + '#/plans'); await p.waitForTimeout(1500);
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('我的规划:', (t.match(/(\d+) 进行中规划/) || [])[0] || '未见统计', '|', (t.match(/(\d+) 今日待办事项/) || [])[0] || '');

// 移动端
console.log('\n--- 375px ---');
await ctx.newPage();
const mp = await ctx.newPage();
await mp.setViewportSize({ width: 375, height: 812 });
await mp.goto(BASE + '#/login'); await mp.waitForTimeout(900);
const mi = mp.locator('input');
await mi.nth(0).fill('student'); await mi.nth(1).fill('123456');
await mp.locator('button:has-text("登录")').last().click(); await mp.waitForTimeout(1800);
for (const r of ['/', '/school', '/competition', '/study', '/plans']) {
  await mp.goto(BASE + '#' + r); await mp.waitForTimeout(1100);
  const of = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${r.padEnd(12)} 溢出 ${of}px`);
}
console.log('\nERRORS:', errs.length ? [...new Set(errs)].slice(0, 6).join('\n  ') : 'none');
await b.close();
