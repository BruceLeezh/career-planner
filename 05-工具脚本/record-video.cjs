// 演示视频录屏：9 段 webm → 04-提交材料/video-raw/
// 用法：node scripts/record-video.cjs   （需 5173 dev server 与 3000 后端在线）
// 依赖路径改为环境变量，避免写入本机用户名与绝对路径
const PW = process.env.PLAYWRIGHT_MODULE || 'playwright';
const EXE = process.env.CHROMIUM_PATH || undefined;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) {
  console.error('缺少 DEMO_PASSWORD 环境变量（演示账号 student 的口令）');
  process.exit(2);
}
const { chromium } = require(PW);
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:5173';
const OUT = path.resolve('04-提交材料/video-raw');
const STATE = path.resolve('.tmp-storage.json');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 每段目标时长（旁白长 + 0.8s 缓冲）
const TARGET = { 1: 20.5, 2: 15.6, 3: 36.5, 4: 17.4, 5: 20.2, 6: 25.7, 7: 24.7, 8: 29.2, 9: 9.0 };

async function record(n, fn) {
  const browser = await chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
    storageState: n === 1 ? undefined : STATE,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  try {
    await fn(page);
  } catch (e) {
    console.error(`seg${n} action error:`, e.message.split('\n')[0]);
  }
  // 补足到目标时长
  const wait = TARGET[n] * 1000 - (Date.now() - t0);
  if (wait > 0) await sleep(wait);
  await ctx.close();
  await browser.close();
  // 取最新 webm 重命名
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm') && !/^seg\d+\.webm$/.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(OUT, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  fs.renameSync(path.join(OUT, files[0].f), path.join(OUT, `seg${n}.webm`));
  console.log(`seg${n}.webm done`);
}

async function smoothScroll(page, total, step = 260, interval = 380) {
  let done = 0;
  while (done < total) {
    await page.mouse.wheel(0, step);
    done += step;
    await sleep(interval);
  }
}

async function clickText(page, text, scope = 'button, a, .el-menu-item, .el-tabs__item, label.el-radio') {
  return page.evaluate(([text, scope]) => {
    const els = [...document.querySelectorAll(scope)].filter((e) => e.offsetParent !== null && e.textContent.trim() === text);
    if (!els.length) throw new Error('no element: ' + text);
    els[0].click();
    return true;
  }, [text, scope]);
}

async function setupLogin() {
  const browser = await chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login');
  await page.fill('input[placeholder="用户名"]', 'student');
  await page.fill('input[placeholder="密码"]', DEMO_PASSWORD);
  await clickText(page, '登录', 'button');
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 15000 });
  await sleep(1500);
  // 跳过学业向导（student 已填写过，若弹出则跳过）
  const hasDialog = await page.locator('.el-dialog').count();
  if (hasDialog) {
    const skip = page.locator('.el-dialog button', { hasText: '跳过' });
    if (await skip.count()) await skip.click();
  }
  await ctx.storageState({ path: STATE });
  await browser.close();
  console.log('login state saved');
}

(async () => {
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
  if (!ONLY || !fs.existsSync(STATE)) await setupLogin();

  // seg1 登录页静止
  if (!ONLY || ONLY.includes(1)) await record(1, async (page) => {
    await page.goto(BASE + '/login');
    await sleep(2000);
  });

  // seg2 首页仪表盘
  if (!ONLY || ONLY.includes(2)) await record(2, async (page) => {
    await page.goto(BASE + '/');
    await sleep(2500);
    await smoothScroll(page, 700);
    await sleep(1500);
  });

  // seg3 职业测评全流程
  if (!ONLY || ONLY.includes(3)) await record(3, async (page) => {
    await page.goto(BASE + '/assessment');
    await sleep(1800);
    // 已有报告时页面只展示结果，先点"重新测评一次"进入答题模式
    const hasRetake = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '重新测评一次');
      if (b) { b.click(); return true; }
      return false;
    });
    if (hasRetake) await sleep(1200);
    // 伪随机但有区分度的作答序列（避免触发"区分度偏低"提示）
    const picks = [4, 2, 5, 3, 1, 4, 3, 5, 2, 4, 1, 5, 3, 2, 4, 5, 2, 4, 3, 1, 5, 4, 2, 3, 5, 4, 1, 3, 2, 4, 5];
    const LABELS = { 1: '很不符合', 2: '比较不符合', 3: '一般', 4: '比较符合', 5: '很符合' };
    // 监听提交响应（最可靠的完成信号）
    const submitDone = page.waitForResponse((r) => r.url().includes('/api/assessment/submit') && r.status() === 201, { timeout: 60000 }).catch(() => null);
    for (let i = 0; i < 31; i++) {
      const want = LABELS[picks[i] || 4];
      let clicked = false;
      for (let retry = 0; retry < 3 && !clicked; retry++) {
        clicked = await page.evaluate((want) => {
          const labels = [...document.querySelectorAll('label.el-radio')].filter((l) => l.offsetParent !== null);
          const t = labels.find((l) => l.textContent.trim() === want);
          if (!t) return false;
          t.click();
          return !!t.querySelector('input')?.checked || true;
        }, want);
        if (!clicked) await sleep(500);
      }
      await sleep(260);
      const advanced = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
        const sub = btns.find((b) => b.textContent.trim() === '提交测评' && !b.disabled);
        if (sub) { sub.click(); return 'submit'; }
        const next = btns.find((b) => b.textContent.trim() === '下一题' && !b.disabled);
        if (next) { next.click(); return 'next'; }
        return null;
      });
      if (advanced === 'submit') { console.log(`seg3: submitted at q${i + 1}`); break; }
      if (!clicked || !advanced) console.log(`seg3: q${i + 1} want=${want} clicked=${clicked} advanced=${advanced}`);
      await sleep(320);
    }
    const resp = await submitDone;
    if (!resp) throw new Error('submit response never arrived');
    // 等报告渲染 + 滚动展示
    await sleep(2500);
    await smoothScroll(page, 1600);
    await sleep(1200);
  });

  // seg4 本校资料（进入培养方案详情：课程表 + AI 解读）
  if (!ONLY || ONLY.includes(4)) await record(4, async (page) => {
    await page.goto(BASE + '/school');
    await sleep(2200);
    await page.click('.major-chip');
    await sleep(2200);
    await smoothScroll(page, 500);
  });

  // seg5 深造/竞赛/证书
  if (!ONLY || ONLY.includes(5)) await record(5, async (page) => {
    await page.goto(BASE + '/study');
    await sleep(2400);
    await smoothScroll(page, 400);
    await page.goto(BASE + '/competition');
    await sleep(2400);
    await smoothScroll(page, 400);
    await page.goto(BASE + '/certificate');
    await sleep(2400);
    await smoothScroll(page, 400);
  });

  // seg6 AI 职业顾问（真实 API）
  if (!ONLY || ONLY.includes(6)) await record(6, async (page) => {
    await page.goto(BASE + '/chat');
    await sleep(1800);
    await clickText(page, '新建对话', 'button');
    await sleep(800);
    const box = page.locator('textarea[placeholder*="问"], input[placeholder*="问"]').first();
    await box.fill('我大一绩点3.8，学金融，想毕业进券商投行部，大学四年应该怎么规划？');
    await clickText(page, '发送', 'button');
    // 等 AI 回答写完（文本量稳定）
    let last = -1, stable = 0;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const len = await page.evaluate(() => document.body.textContent.length);
      if (Math.abs(len - last) < 6 && len > 800) { stable++; if (stable >= 2) break; } else stable = 0;
      last = len;
    }
    await smoothScroll(page, 900);
  });

  // seg7 AI 模拟面试（真实 API）
  if (!ONLY || ONLY.includes(7)) await record(7, async (page) => {
    await page.goto(BASE + '/interview');
    await sleep(1600);
    await page.fill('input[placeholder*="目标岗位"]', '软件开发工程师');
    await clickText(page, '开始新面试', 'button');
    // 等开场白
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const has = await page.evaluate(() => document.body.textContent.includes('面试官：'));
      if (has) break;
    }
    await sleep(2000);
    const ans = page.locator('textarea[placeholder*="回答"], input[placeholder*="回答"]').first();
    await ans.fill('面试官您好，我是金融学院大三学生，主修金融学，辅修过Python数据分析，做过一个校园二手书交易小程序，后端用Node.js，想往金融科技后端方向发展。');
    await clickText(page, '发送', 'button');
    // 等追问
    let last = -1, stable = 0;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const len = await page.evaluate(() => document.body.textContent.length);
      if (Math.abs(len - last) < 6 && len > 900) { stable++; if (stable >= 2) break; } else stable = 0;
      last = len;
    }
  });

  // seg8 技术架构字幕卡
  if (!ONLY || ONLY.includes(8)) await record(8, async (page) => {
    await page.goto('file:///' + path.resolve('04-提交材料/tech-card.html').replace(/\\/g, '/'));
    await sleep(2500);
    await smoothScroll(page, 300);
    await sleep(2000);
  });

  // seg9 结尾：回首页
  if (!ONLY || ONLY.includes(9)) await record(9, async (page) => {
    await page.goto(BASE + '/');
    await sleep(2500);
    await smoothScroll(page, 400);
  });

  console.log('ALL DONE');
  fs.rmSync(STATE, { force: true });
})();
