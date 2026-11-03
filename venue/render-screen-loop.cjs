// Renders the LED screen loop (20 s, 1920x1080, 30 fps) from the #loop mode of malam-galau-venue.html.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const src = path.join(__dirname, 'malam-galau-venue.html'), tmp = path.join(__dirname, '../frames/loop_page.html'), out = path.join(__dirname, '../frames/loop');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(tmp, '<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + fs.readFileSync(src, 'utf8') + '</body></html>');
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route('https://**', (r) => r.abort());
  await p.goto('file://' + tmp + '#loop'); await p.waitForFunction(() => window.LOOP_READY);
  for (let f = 0; f < 600; f++) { const u = await p.evaluate((t) => window.drawFrame(t), f / 30); fs.writeFileSync(`${out}/f${String(f).padStart(4, '0')}.jpg`, Buffer.from(u.split(',')[1], 'base64')); }
  await b.close();
})();
