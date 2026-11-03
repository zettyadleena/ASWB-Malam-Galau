// Renders a phone-friendly walkthrough (720x1280) of the venue model + one still per view.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), FPS = 25, HOLD = 1.6, MOVE = 2.6;
const ORDER = ['entrance', 'guest', 'stars', 'balcony', 'stage', 'booths', 'plan'];
(async () => {
  const out = path.join(ROOT, 'frames/tour'), stills = path.join(ROOT, 'output/venue-views'); fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(stills, { recursive: true });
  const page = path.join(ROOT, 'frames/tour_page.html');
  fs.writeFileSync(page, '<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}body{margin:0}aside{display:none!important}</style></head><body>' + fs.readFileSync(path.join(__dirname, 'malam-galau-venue.html'), 'utf8') + '</body></html>');
  const fontsDir = path.join(ROOT, 'frames/fonts');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ path: path.join(ROOT, 'node_modules/three', r.request().url().split('three@0.160.0/')[1]), contentType: 'text/javascript' }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(fontsDir, 'fonts.css'), 'utf8'), contentType: 'text/css' }));
  await p.route('https://fonts.gstatic.com/**', (r) => { const h = require('crypto').createHash('md5').update(r.request().url() + '\n').digest('hex').slice(0, 12); r.fulfill({ path: path.join(fontsDir, h + '.woff2'), contentType: 'font/woff2' }); });
  await p.goto('file://' + page); await p.waitForFunction(() => !document.getElementById('loading') && window.__venue, null, { timeout: 90000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  const V = await p.evaluate(() => window.__venue.views);
  const sm = (x) => x * x * (3 - 2 * x), L = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  const shots = [];
  ORDER.forEach((k, i) => {
    for (let f = 0; f < HOLD * FPS; f++) shots.push({ v: V[k], plan: k === 'plan', still: f === Math.floor(HOLD * FPS / 2) ? `${i + 1}-${k}` : null });
    if (i < ORDER.length - 1) { const n = ORDER[i + 1]; for (let f = 1; f <= MOVE * FPS; f++) { const u = sm(f / (MOVE * FPS)); shots.push({ v: { pos: L(V[k].pos, V[n].pos, u), tgt: L(V[k].tgt, V[n].tgt, u), fov: V[k].fov + (V[n].fov - V[k].fov) * u }, plan: n === 'plan' }); } }
  });
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    await p.evaluate(([a, b2, c, d]) => window.__venue.cam(a, b2, c, d), [s.v.pos, s.v.tgt, s.v.fov, s.plan]);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    p.setDefaultTimeout(180000); await p.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
    if (s.still) fs.copyFileSync(`${out}/f${String(i).padStart(4, '0')}.jpg`, `${stills}/${s.still}.jpg`);
    if (i % 50 === 0) console.log(i, '/', shots.length);
  }
  await b.close();
})();
