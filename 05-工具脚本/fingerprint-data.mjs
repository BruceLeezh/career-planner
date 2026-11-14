// 构建后处理：data.js → data.<hash>.js，并改写 index.html 引用（破 CDN 缓存）
const HOME = process.env.USERPROFILE || process.env.HOME || '';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIST = HOME + '/Desktop/WPS Comate大赛/高级赛道/static-dist/frontend/dist';
const dataPath = path.join(DIST, 'data.js');
const buf = fs.readFileSync(dataPath);
const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const newName = `data.${hash}.js`;
fs.renameSync(dataPath, path.join(DIST, newName));

const htmlPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/\.\/data\.js/g, `./${newName}`);
fs.writeFileSync(htmlPath, html, 'utf8');

console.log(`data.js → ${newName} (${(buf.length / 1024).toFixed(0)} KB)`);
console.log('index.html 引用已更新:', /data\.[a-f0-9]{10}\.js/.test(html));
