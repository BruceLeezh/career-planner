const HOME = process.env.USERPROFILE || process.env.HOME || '';
import { pathToFileURL } from 'node:url';
const pwPath = HOME + '/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.js';
const exe = HOME + '/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const _pw = await import(pathToFileURL(pwPath).href);
const chromium = _pw.chromium || _pw.default.chromium;
const BASE = 'http://127.0.0.1:8805/index.html';

const b = await chromium.launch({ headless: true, executablePath: exe });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGE:' + String(e).slice(0, 110)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('CON:' + m.text().slice(0, 100)); });

await p.goto(BASE + '#/login'); await p.waitForTimeout(1000);
const ins = p.locator('input');
await ins.nth(0).fill('student'); await ins.nth(1).fill('123456');
await p.locator('button:has-text("登录")').last().click(); await p.waitForTimeout(1900);

console.log('=== 1. 页面渲染 ===');
const pages = [
  ['/', '每一段规划'], ['/assessment', '职业画像'], ['/school', '培养方案'],
  ['/study', '深造中心'], ['/study/kaoyan', '考研'], ['/competition', '竞赛中心'],
  ['/certificate', '证书中心'], ['/resume', '简历工作台'], ['/interview', '模拟面试'],
  ['/civil', '考公选调'], ['/resources', '岗位百科'], ['/plans', '我的规划'],
  ['/chat', 'AI 职业顾问'], ['/forum', '社区'], ['/profile', '个人中心'],
];
let okPages = 0;
for (const [r, kw] of pages) {
  await p.goto(BASE + '#' + r); await p.waitForTimeout(1000);
  const t = (await p.textContent('body')).replace(/\s+/g, ' ');
  const ok = t.includes(kw);
  if (ok) okPages++;
  console.log(`  ${r.padEnd(14)} ${ok ? 'OK' : '✗ 缺「' + kw + '」'}`);
}
console.log(`页面通过 ${okPages}/${pages.length}`);

console.log('\n=== 2. 本校资料页 ===');
await p.goto(BASE + '#/school'); await p.waitForTimeout(2000);
let t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('  顶部统计:', (t.match(/(\d+) 个学院 · (\d+) 个专业已录入/) || ['未匹配'])[0]);
console.log('  覆盖提示:', (t.match(/全校覆盖 \d+\/\d+ 个学院/) || ['无'])[0]);
console.log('  学院与专业区:', t.includes('个本科专业') ? 'OK' : '✗');

// 点开法学
const chip = p.locator('.col-card .major-chip:has-text("法学")').first();
if (await chip.count()) { await chip.click(); await p.waitForTimeout(1800); }
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('  法学课程总数:', (t.match(/课程总数\s*(\d+)/) || [])[1] || '✗');
console.log('  数据来源展示:', /数据来源/.test(t) ? 'OK' : '✗');
console.log('  大类提示:', /专业类统一方案/.test(t) ? 'OK' : '（法学类未标大类）');
console.log('  来源文本:', (t.match(/数据来源\s*([^A-Z]{0,60})/) || [])[1]?.trim().slice(0, 55) || '?');
await p.screenshot({ path: '../static-dist/CHECK-法学方案.png' });

// 点开人文科学试验班（空课表）
await p.goto(BASE + '#/school'); await p.waitForTimeout(1600);
const chip2 = p.locator('.col-card .major-chip:has-text("人文科学试验班")').first();
if (await chip2.count()) { await chip2.click(); await p.waitForTimeout(1500); }
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('  人文科学试验班提示:', /该项目不设独立专业课表/.test(t) ? 'OK' : '✗');
await p.screenshot({ path: '../static-dist/CHECK-人文科学试验班.png' });

console.log('\n=== 3. 交互链路 ===');
// 竞赛加入规划
await p.goto(BASE + '#/competition'); await p.waitForTimeout(1300);
const dbtn = p.locator('.el-button:has-text("详情")').first();
if (await dbtn.count()) { await dbtn.click(); await p.waitForTimeout(900); }
const join = p.locator('.el-button:has-text("加入我的规划")').first();
if (await join.count()) { await join.click(); await p.waitForTimeout(1000); console.log('  竞赛加入规划: OK'); }

// 证书
await p.goto(BASE + '#/certificate'); await p.waitForTimeout(1200);
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('  证书库:', (t.match(/(\d+) 本/) || [])[0] || '?', '| 推荐:', /为你推荐|推荐/.test(t) ? 'OK' : '?');

// 简历优化
await p.goto(BASE + '#/resume'); await p.waitForTimeout(1300);
try {
  const opt = p.locator('.el-radio-button:has-text("简历优化")').first();
  if (await opt.count()) { await opt.click(); await p.waitForTimeout(600); }
  const ta = p.locator('textarea:visible').first();
  if (await ta.count()) await ta.fill('负责整理数据并做分析，参与社团活动。');
  const run = p.locator('button:has-text("开始优化")').first();
  if (await run.count()) { await run.click(); await p.waitForTimeout(2000); }
} catch {}
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('  简历优化:', /优化报告|综合评分/.test(t) ? 'OK' : '未出结果');

// 规划页
await p.goto(BASE + '#/plans'); await p.waitForTimeout(1400);
t = (await p.textContent('body')).replace(/\s+/g, ' ');
console.log('  我的规划:', (t.match(/(\d+) 进行中规划/) || [])[0] || '未见统计');

console.log('\n=== 4. 移动端 375px ===');
const mp = await ctx.newPage();
await mp.setViewportSize({ width: 375, height: 812 });
await mp.goto(BASE + '#/login'); await mp.waitForTimeout(900);
const mi = mp.locator('input');
await mi.nth(0).fill('student'); await mi.nth(1).fill('123456');
await mp.locator('button:has-text("登录")').last().click(); await mp.waitForTimeout(1700);
for (const r of ['/', '/school', '/competition', '/study', '/plans', '/resources']) {
  await mp.goto(BASE + '#' + r); await mp.waitForTimeout(1000);
  const of = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`  ${r.padEnd(12)} 溢出 ${of}px`);
}

console.log('\n=== 控制台错误 ===');
console.log([...new Set(errs)].slice(0, 8).join('\n') || 'none');
await b.close();
