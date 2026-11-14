// 敏感信息全量扫描（仅扫描 git 已跟踪/已暂存文件）
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const ROOT = 'D:/AAA比赛资料/WPS Comate大赛/高级赛道';
process.chdir(ROOT);

const files = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
  .split('\n').map((s) => s.trim()).filter(Boolean);

const RULES = [
  { name: 'API Key (sk-)', re: /\bsk-[A-Za-z0-9]{16,}/g, level: 'P0' },
  { name: '智谱/OpenAI 风格 Key', re: /["']?api[_-]?key["']?\s*[:=]\s*["'][A-Za-z0-9_\-\.]{16,}["']/gi, level: 'P0' },
  { name: 'JWT Secret 赋值', re: /JWT_SECRET\s*[:=]\s*['"]?[^\s'"]{8,}/gi, level: 'P0' },
  { name: 'SMTP 密码', re: /SMTP_(PASS|PASSWORD)\s*[:=]\s*['"]?[^\s'"]{4,}/gi, level: 'P0' },
  { name: '数据库密码', re: /(DB_PASS|MYSQL_PWD|DB_PASSWORD)\s*[:=]\s*['"]?[^\s'"]{4,}/gi, level: 'P0' },
  { name: 'GitHub Token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g, level: 'P0' },
  { name: '私钥块', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g, level: 'P0' },
  { name: '手机号', re: /(?<!\d)1[3-9]\d{9}(?!\d)/g, level: 'P1' },
  { name: '身份证号', re: /(?<!\d)\d{17}[\dXx](?!\d)/g, level: 'P0' },
  { name: '学工号(2025xxxxxxx)', re: /(?<!\d)2025\d{8}(?!\d)/g, level: 'P1' },
  { name: '公网 IP', re: /(?<!\d)(?:(?:106|118|119|121|47|39|120)\.\d{1,3}\.\d{1,3}\.\d{1,3})(?!\d)/g, level: 'P1' },
  { name: '内网 IP', re: /(?<!\d)(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?!\d)/g, level: 'P2' },
  { name: '邮箱', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, level: 'P1' },
  { name: '中文姓名+学号组合', re: /[\u4e00-\u9fa5]{2,4}\s*20\d{8}/g, level: 'P1' },
  { name: '数据库连接串', re: /(?:mysql|postgres|mongodb):\/\/[^\s'"]+/gi, level: 'P0' },
];

const hits = new Map(); // rule -> [{file, sample}]
const skipExt = /\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|pdf|mp4|zip|xlsx?|docx?|pptx?)$/i;
let scanned = 0;

for (const f of files) {
  if (skipExt.test(f)) continue;
  let text;
  try {
    const st = fs.statSync(f);
    if (st.size > 6 * 1024 * 1024) continue; // 跳过超大文本
    text = fs.readFileSync(f, 'utf8');
  } catch { continue; }
  scanned++;
  for (const r of RULES) {
    r.re.lastIndex = 0;
    const m = text.match(r.re);
    if (!m) continue;
    if (!hits.has(r.name)) hits.set(r.name, { level: r.level, items: [] });
    const arr = hits.get(r.name).items;
    for (const v of [...new Set(m)].slice(0, 6)) {
      arr.push({ file: f, value: String(v).slice(0, 90) });
    }
  }
}

console.log(`扫描文件: ${scanned} / 跟踪总数 ${files.length}\n`);
for (const [name, { level, items }] of [...hits].sort()) {
  console.log(`\n[${level}] ${name} — 命中 ${items.length} 处`);
  const byFile = {};
  for (const it of items) {
    byFile[it.file] = byFile[it.file] || [];
    if (byFile[it.file].length < 2) byFile[it.file].push(it.value);
  }
  for (const [f, vs] of Object.entries(byFile).slice(0, 10)) {
    console.log(`  ${f}: ${vs.join(' | ')}`);
  }
  if (Object.keys(byFile).length > 10) console.log(`  …共 ${Object.keys(byFile).length} 个文件`);
}
if (!hits.size) console.log('未命中任何规则');
