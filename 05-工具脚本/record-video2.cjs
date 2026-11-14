// 演示视频录屏 v2：CDP Page.startScreencast 抓帧（连续帧率，观感流畅）
// 用法：node scripts/record-video2.cjs  （需 5173 dev server 与 3000 后端在线；ONLY=N 单段重录）
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
const { execSync } = require('node:child_process');

const BASE = 'http://localhost:5173';
const OUT = path.resolve('04-提交材料/video-raw');
const NAR = path.resolve('04-提交材料/narration');
const MP4 = path.resolve('04-提交材料/video-mp4');
const FRAME_TMP = path.resolve('04-提交材料/.frame-tmp');
const STATE = path.resolve('.tmp-storage.json');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(MP4, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 每段目标时长（旁白长 + 1.3s 缓冲：观感从容，旁白后留静音）
const TARGET = { 1: 21.0, 2: 16.1, 3: 37.0, 4: 17.9, 5: 20.7, 6: 26.2, 7: 25.2, 8: 29.7, 9: 9.5, 10: 19.0 };

// CDP screencast 抓帧录一段 → 直接合成 partN.mp4（按帧时间戳变帧率 → 30fps 恒定输出）
async function record(n, fn) {
  const browser = await chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    storageState: n === 1 ? undefined : STATE,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const fdir = path.join(FRAME_TMP, `seg${n}`);
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });

  const frames = []; // {ts, file}
  let seq = 0;
  cdp.on('Page.screencastFrame', async (e) => {
    const f = path.join(fdir, `f${String(++seq).padStart(6, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(e.data, 'base64'));
    frames.push({ ts: e.metadata.timestamp || 0, file: f });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }); } catch { /* 收尾时忽略 */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 2560, maxHeight: 1440 });

  const t0 = Date.now();
  let err = null;
  try {
    await fn(page);
  } catch (e) {
    err = e;
    console.error(`seg${n} action error:`, e.message.split('\n')[0]);
  }
  // 补足到目标时长（静止段由长 duration 帧覆盖）
  const wait = TARGET[n] * 1000 - (Date.now() - t0);
  if (wait > 0) await sleep(wait);
  await cdp.send('Page.stopScreencast').catch(() => {});
  await ctx.close();
  await browser.close();

  if (!frames.length) throw new Error(`seg${n}: no frames captured`);
  // 按时间戳生成 concat 清单（duration = 相邻帧间隔；静止尾巴用尾帧延续到目标时长）
  frames.sort((a, b) => a.ts - b.ts);
  const span = frames.length > 1 ? frames[frames.length - 1].ts - frames[0].ts : 0;
  const tailDur = Math.max(TARGET[n] - span, 0.5);
  const listFile = path.join(fdir, 'list.txt');
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const dur = i < frames.length - 1 ? (frames[i + 1].ts - frames[i].ts) : tailDur;
    lines.push(`file '${path.basename(frames[i].file)}'`);
    lines.push(`duration ${Math.max(dur, 0.008).toFixed(4)}`);
  }
  lines.push(`file '${path.basename(frames[frames.length - 1].file)}'`);
  fs.writeFileSync(listFile, lines.join('\n'));

  const partOut = path.join(MP4, `part${n}.mp4`);
  execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${listFile}" -vf "fps=30,format=yuv420p" -c:v libx264 -preset fast -crf 21 "${partOut}"`, { stdio: 'inherit' });
  fs.rmSync(fdir, { recursive: true, force: true });
  console.log(`seg${n}: ${frames.length} frames -> part${n}.mp4${err ? ' (action error, see above)' : ''}`);
}

// 平滑滚动：小幅多步连续滚动（60ms/步），不再是滚轮一格一格跳
async function smoothScroll(page, total, step = 30, interval = 55) {
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
    const hasRetake = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '重新测评一次');
      if (b) { b.click(); return true; }
      return false;
    });
    if (hasRetake) await sleep(1200);
    const picks = [4, 2, 5, 3, 1, 4, 3, 5, 2, 4, 1, 5, 3, 2, 4, 5, 2, 4, 3, 1, 5, 4, 2, 3, 5, 4, 1, 3, 2, 4, 5];
    const LABELS = { 1: '很不符合', 2: '比较不符合', 3: '一般', 4: '比较符合', 5: '很符合' };
    const submitDone = page.waitForResponse((r) => r.url().includes('/api/assessment/submit') && r.status() === 201, { timeout: 60000 }).catch(() => null);
    for (let i = 0; i < 31; i++) {
      const want = LABELS[picks[i] || 4];
      // 真实鼠标点击 + checked 确认
      const r = page.locator('label.el-radio', { hasText: want }).first();
      await r.click({ timeout: 4000 });
      const checked = await page.evaluate((want) => {
        const t = [...document.querySelectorAll('label.el-radio')].filter((l) => l.offsetParent !== null)
          .find((l) => l.textContent.trim() === want);
        return !!t && !!t.querySelector('input')?.checked;
      }, want);
      if (!checked) throw new Error(`q${i + 1} radio not checked: ${want}`);
      await sleep(260);
      let advanced = null;
      for (let retry = 0; retry < 3 && !advanced; retry++) {
        advanced = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
          const sub = btns.find((b) => b.textContent.trim() === '提交测评' && !b.disabled);
          if (sub) { sub.click(); return 'submit'; }
          const next = btns.find((b) => b.textContent.trim() === '下一题' && !b.disabled);
          if (next) { next.click(); return 'next'; }
          return null;
        });
        if (!advanced) await sleep(350);
      }
      if (advanced === 'submit') { console.log(`seg3: submitted at q${i + 1}`); break; }
      if (!advanced) console.log(`seg3: q${i + 1} want=${want} advanced=null`);
      await sleep(240);
    }
    const resp = await submitDone;
    if (!resp) throw new Error('submit response never arrived');
    await sleep(2500);
    await smoothScroll(page, 1600);
    await sleep(1200);
  });

  // seg4 本校资料（进入培养方案详情）
  if (!ONLY || ONLY.includes(4)) await record(4, async (page) => {
    await page.goto(BASE + '/school');
    await sleep(2200);
    await page.click('.major-chip');
    await sleep(2200);
    await smoothScroll(page, 500);
  });

  // seg5 深造/竞赛/证书 —— 切页提前 1.2s（2x DPI 渲染慢），让画面先于旁白到位
  if (!ONLY || ONLY.includes(5)) await record(5, async (page) => {
    await page.goto(BASE + '/study');
    await sleep(1100);
    await smoothScroll(page, 1100, 12, 70);  // 慢滚至 ~7.5s
    await sleep(500);
    await page.goto(BASE + '/competition'); // ~8.0s 切竞赛（旁白 9.5s 提竞赛，渲染后 ~9.2s 到位）
    await sleep(900);
    await smoothScroll(page, 750, 12, 75);   // 滚至 ~13.6s
    await sleep(400);
    await page.goto(BASE + '/certificate'); // ~14.0s 切证书（旁白 15.5s 提证书，渲染后 ~15.2s 到位）
    await sleep(900);
    await smoothScroll(page, 750, 12, 75);   // 滚至 ~19.6s
  });

  // seg10 求职准备：简历工作台（进入自动载入最近简历）→ 考公选调 → 职业资源
  // 旁白节点：简历~1.6-6.7s、考公~6.7-12.5s、资源~12.5-17.6s
  if (!ONLY || ONLY.includes(10)) await record(10, async (page) => {
    await page.goto(BASE + '/resume');
    await page.waitForFunction(() => {
      const inp = [...document.querySelectorAll('input')].find((i) => i.placeholder === '张三');
      return !!inp && inp.value === '李明';
    }, { timeout: 12000 }).catch(() => {});
    await sleep(400);
    await smoothScroll(page, 350, 12, 75);   // 滚至 ~5.1s
    await sleep(1600);                        // 停至 6.7s 切考公
    await page.goto(BASE + '/civil');
    await page.waitForSelector('text=报考类型', { timeout: 10000 }).catch(() => {});
    await sleep(300);
    await smoothScroll(page, 400, 12, 80);   // 滚至 ~10.9s
    await sleep(1600);                        // 停至 12.5s 切资源
    await page.goto(BASE + '/resources');
    await page.waitForSelector('text=职业资源', { timeout: 10000 }).catch(() => {});
    await sleep(300);
    await smoothScroll(page, 650, 12, 75);   // 滚至 ~18s
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
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const has = await page.evaluate(() => document.body.textContent.includes('面试官：'));
      if (has) break;
    }
    await sleep(2000);
    const ans = page.locator('textarea[placeholder*="回答"], input[placeholder*="回答"]').first();
    await ans.fill('面试官您好，我是金融学院大三学生，主修金融学，辅修过Python数据分析，做过一个校园二手书交易小程序，后端用Node.js，想往金融科技后端方向发展。');
    await clickText(page, '发送', 'button');
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
    await page.goto('file:///' + path.resolve('04-提交材料/tech-card.html').replace(/\\\\/g, '/'));
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
