// Usage:
//   node render.cjs                      -> frames/ + output/malam-galau-aswb.mp4 (full 15s @30fps)
//   node render.cjs --stills 1,5,9 --scale 0.5   -> preview stills in frames/preview/
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = __dirname, FPS = 30, DUR = 15;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const scale = parseFloat(arg('scale', '1')), stills = arg('stills', null);
const from = parseInt(arg('from', '0')), to = parseInt(arg('to', String(FPS * DUR)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/src/index.html?scale=${scale}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  const save = async (t, file) => {
    const url = await page.evaluate((t) => window.renderFrame(t), t);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  };
  if (stills) {
    fs.mkdirSync(path.join(ROOT, 'frames/preview'), { recursive: true });
    for (const s of stills.split(',')) { const t = parseFloat(s); await save(t, path.join(ROOT, `frames/preview/t${t.toFixed(2)}.jpg`)); console.log('still', t); }
  } else {
    fs.mkdirSync(path.join(ROOT, 'frames/seq'), { recursive: true });
    const t0 = Date.now();
    for (let f = from; f < to; f++) {
      await save(f / FPS, path.join(ROOT, `frames/seq/f${String(f).padStart(4, '0')}.jpg`));
      if (f % 15 === 0) console.log(`frame ${f}/${to}  ${((Date.now() - t0) / 1000 / (f - from + 1)).toFixed(2)}s/frame`);
    }
  }
  await browser.close(); server.close();
})();
