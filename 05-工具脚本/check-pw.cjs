// 验证全局 playwright chromium 可启动
const HOME = process.env.USERPROFILE || process.env.HOME || '';
const path = HOME + '/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.js';
const { chromium } = require(path);
chromium.launch({ headless: true, executablePath: HOME + '/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe' })
  .then(async (b) => { console.log('chromium launch ok', b.version()); await b.close(); })
  .catch((e) => { console.log('LAUNCH FAIL:', e.message.split('\n')[0]); process.exit(1); });
