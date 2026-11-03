// Renders one 1080x1920 still per view of the venue model (the walkthrough video is built from these).
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), FPS = 25, HOLD = 1.6, MOVE = 2.6;
const ORDER = ['entrance', 'guest', 'stars', 'balcony', 'stage', 'booths', 'plan'];
(async () => {
  const out = path.join(ROOT, 'frames/tour'), stills = path.join(ROOT, 'output/venue-views'); fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(stills, { recursive: true });
  const page = path.join(ROOT, 'frames/tour_page.html');
  fs.writeFileSync(page, '<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}body{margin:0}aside{display:none!important}</style></head><body>' + fs.readFileSync(path.join(__dirname, 'malam-galau-venue.html'), 'utf8') + '</body></html>');
  const fontsDir = path.join(ROOT, 'frames/fonts');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ path: path.join(ROOT, 'node_modules/three', r.request().url().split('three@0.160.0/')[1]), contentType: 'text/javascript' }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(fontsDir, 'fonts.css'), 'utf8'), contentType: 'text/css' }));
  await p.route('https://fonts.gstatic.com/**', (r) => { const h = require('crypto').createHash('md5').update(r.request().url() + '\n').digest('hex').slice(0, 12); r.fulfill({ path: path.join(fontsDir, h + '.woff2'), contentType: 'font/woff2' }); });
  await p.goto('file://' + page); await p.waitForFunction(() => !document.getElementById('loading') && window.__venue, null, { timeout: 90000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  const V = await p.evaluate(() => window.__venue.views);
  p.setDefaultTimeout(240000);
  // one still per view; the walkthrough video is built from these with ffmpeg (slow zoom + crossfade)
  for (let i = 0; i < ORDER.length; i++) {
    const k = ORDER[i];
    const PORTRAIT = { entrance: { pos: [-0.6, 1.8, 24.5], fov: 70 }, booths: { pos: [3.8, 4.6, -4.5], tgt: [13, 0.9, 1.6], fov: 82 }, plan: { fov: 64 } }; // phone framing
    const v = { ...V[k], ...(PORTRAIT[k] || {}) };
    await p.evaluate(([a, b2, c, d]) => window.__venue.cam(a, b2, c, d), [v.pos, v.tgt, v.fov, k === 'plan']);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${stills}/${i + 1}-${k}.jpg`, type: 'jpeg', quality: 92 });
    console.log('still', k);
  }
  await b.close();
})();
