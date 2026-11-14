// 诊断 /assessment 页面 radio 渲染
// 依赖路径改为环境变量，避免写入本机用户名与绝对路径
const PW = process.env.PLAYWRIGHT_MODULE || 'playwright';
const EXE = process.env.CHROMIUM_PATH || undefined;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) {
  console.error('缺少 DEMO_PASSWORD 环境变量（演示账号 student 的口令）');
  process.exit(2);
}
const { chromium } = require(PW);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await page.goto('http://localhost:5173/login');
  await page.fill('input[placeholder="用户名"]', 'student');
  await page.fill('input[placeholder="密码"]', DEMO_PASSWORD);
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登录').click();
  });
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 15000 });
  await sleep(1200);
  await page.goto('http://localhost:5173/assessment');
  await sleep(3000);
  console.log('URL:', page.url());
  const info = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label.el-radio')];
    const all = [...document.querySelectorAll('label')].map((l) => l.className).slice(0, 8);
    const texts = labels.map((l) => l.textContent.trim());
    const vis = labels.filter((l) => l.offsetParent !== null).map((l) => l.textContent.trim());
    const h1 = document.body.innerText.slice(0, 200).replace(/\n/g, ' | ');
    return { radioCount: labels.length, texts: texts.slice(0, 10), visible: vis.slice(0, 10), otherLabels: all, bodyHead: h1 };
  });
  console.log(JSON.stringify(info, null, 1));
  console.log('HTTP>=400:', errs.slice(0, 8));
  await browser.close();
})();
