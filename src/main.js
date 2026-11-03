// Malam Galau — ASWB promo. 15s, 1080x1920 (IG story / reel).
// Deterministic: window.renderFrame(t) renders the frame at time t (seconds).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const params = new URLSearchParams(location.search);
const SCALE = parseFloat(params.get('scale') || '1');
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);

// ---------------------------------------------------------------- timeline
// Scene cuts (seconds). Tuned to the bridge of "Pulang" — add audio in IG/CapCut.
const T = {
  skyEnd: 4.5,      // tilt down from the moon onto APU at night
  extEnd: 7.5,      // low dolly along the wet road, fly through the main entrance
  topEnd: 11.0,     // atrium from the upper floors, looking down
  balcEnd: 13.5,    // across the void from a balcony, fairy lights in front
  singerEnd: 16.5,  // singer close-up
  bandEnd: 18.5,    // guitarist + drummer
  crowdEnd: 21.0,   // reverse over the singer's shoulder: crowd singing
  walkEnd: 23.5,    // walking through the crowd toward the stage
  wideEnd: 26.0,    // wide finale from the back of the hall
  end: 30.0,        // ASWB logo
};
const CUTS = [T.skyEnd, T.topEnd, T.balcEnd, T.singerEnd, T.bandEnd, T.crowdEnd, T.walkEnd];

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
document.body.appendChild(renderer.domElement);

// ---------------------------------------------------------------- helpers
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeInOut = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeOutBack = (x) => { x = clamp01(x); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...o });
const glowMat = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

const glowTex = (() => {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c, false);
})();

function glowPoints(positions, colors, size, k = 1.5) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const m = new THREE.PointsMaterial({ size, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  m.color.setScalar(k);
  return new THREE.Points(g, m);
}

function sky(top, mid, bottom) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top,mid,bottom; varying vec3 vP;
      void main(){ float h=vP.y; vec3 c = h>0. ? mix(mid,top,pow(clamp(h*1.6,0.,1.),0.6)) : mix(mid,bottom,clamp(-h*6.,0.,1.)); gl_FragColor=vec4(c,1.); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m);
}

function starField(n, seed, radius = 800) {
  const r = rng(seed), p = [], c = [];
  for (let i = 0; i < n; i++) {
    const th = r() * Math.PI * 2, y = 0.08 + r() * 0.92, s = Math.sqrt(1 - y * y);
    p.push(Math.cos(th) * s * radius, y * radius, Math.sin(th) * s * radius);
    const b = 0.4 + r() * 0.8, warm = r() < 0.3;
    c.push(b, b * (warm ? 0.9 : 0.95), b * (warm ? 0.6 : 1.1));
  }
  const pts = glowPoints(p, c, 7, 1.4);
  pts.material.sizeAttenuation = false; pts.material.size = 7 * SCALE;
  return pts;
}

// Building facade with a window grid. Returns standard material with emissive windows.
function facadeMaterial(cols, rows, seed, o = {}) {
  const { wall = '#c9ccd3', glass = '#121a2b', litRatio = 0.5, palette = ['#ffcf86', '#ffe2b0', '#cfe8ff', '#9fd6e8'], cw = 32, ch = 44, frame = 4, emissive = 1.6 } = o;
  const r = rng(seed);
  const [c, x] = canvas(cols * cw, rows * ch), [e, ex] = canvas(cols * cw, rows * ch);
  x.fillStyle = wall; x.fillRect(0, 0, c.width, c.height);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, c.width, c.height);
  for (let j = 0; j < rows; j++) {
    const rowLit = r() < 0.85;
    for (let i = 0; i < cols; i++) {
      const lit = rowLit && r() < litRatio;
      const px = i * cw + frame, py = j * ch + frame * 2, pw = cw - frame * 2, ph = ch - frame * 3;
      x.fillStyle = glass; x.fillRect(px, py, pw, ph);
      if (lit) {
        const col = palette[Math.floor(r() * palette.length)];
        x.fillStyle = col; x.fillRect(px, py, pw, ph);
        ex.fillStyle = col; ex.globalAlpha = 0.5 + r() * 0.5; ex.fillRect(px, py, pw, ph); ex.globalAlpha = 1;
      }
    }
  }
  return mat(0xffffff, { map: tex(c), emissiveMap: tex(e), emissive: new THREE.Color(0xffffff), emissiveIntensity: emissive, flatShading: false, roughness: 0.6 });
}

function tube(points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 4, radius, 5, closed), material);
}

function ellipsePts(rx, rz, y, n = 64) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push(V(Math.cos(a) * rx, y, Math.sin(a) * rz)); }
  return p;
}

function slab(rx, rz, thick, material) {
  const s = new THREE.Shape(); s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.25, bevelSegments: 1, curveSegments: 48 });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, material);
}

// ---------------------------------------------------------------- characters
const SKIN = [0xc68a62, 0xa8724f, 0xd9a07a, 0x8d5a3c, 0xe3b391];

function makePerson(o = {}) {
  const { skin = 0xc68a62, hair = 0x0e0d10, shirt = 0xe9e4da, pants = 0x2b3346, shoes = 0x1a1a1a, sleeve = true } = o;
  const g = new THREE.Group();
  const mSkin = mat(skin, { roughness: 0.7 }), mHair = mat(hair, { roughness: 0.55 }), mShirt = mat(shirt), mPants = mat(pants), mShoe = mat(shoes);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.85, 0.2), mPants); leg.position.set(sx * 0.1, 0.45, 0); g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.3), mShoe); shoe.position.set(sx * 0.1, 0.045, 0.05); g.add(shoe);
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.18, 0.64, 7), mShirt); torso.scale.z = 0.62; torso.position.y = 1.17; g.add(torso);
  const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.14, 7), mPants); hip.scale.z = 0.7; hip.position.y = 0.88; g.add(hip);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 6), mSkin); neck.position.y = 1.52; g.add(neck);

  const head = new THREE.Group(); head.position.y = 1.67; g.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), mSkin); skull.scale.set(0.95, 1.12, 1); head.add(skull);
  // hair: cap + messy fringe
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.152, 1), mHair); cap.scale.set(1.06, 0.85, 1.0); cap.position.set(0, 0.07, -0.045); head.add(cap);
  const hr = rng(7);
  for (let i = 0; i < 9; i++) {
    const a = -0.9 + (i / 8) * 1.8;
    const strand = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 4), mHair);
    strand.position.set(Math.sin(a) * 0.11, 0.135 + hr() * 0.02, Math.cos(a) * 0.075);
    strand.rotation.set(1.35 + hr() * 0.3, a * 0.6, (hr() - 0.5) * 0.4); strand.scale.set(1, 0.75, 1);
    head.add(strand);
  }
  for (let i = 0; i < 7; i++) {
    const a = -1.1 + (i / 6) * 2.2;
    const strand = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 4), mHair);
    strand.position.set(Math.sin(a) * 0.12, 0.07 + hr() * 0.03, -Math.cos(a) * 0.1 - 0.02);
    strand.rotation.set(-2.0 - hr() * 0.3, 0, -Math.sin(a) * 0.5);
    head.add(strand);
  }
  // face: closed eyes, sad brows, nose, singing mouth
  const mDark = mat(0x1a0f0c), mLip = mat(0x5a2420);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.011, 0.012), mDark);
    eye.position.set(sx * 0.052, 0.015, 0.132); eye.rotation.z = sx * -0.15; head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, 0.014), mHair);
    brow.position.set(sx * 0.055, 0.058, 0.13); brow.rotation.z = sx * -0.32; head.add(brow);
    const ear = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), mSkin); ear.position.set(sx * 0.135, 0.0, 0.0); ear.scale.set(0.5, 1, 0.8); head.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 4), mSkin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.012, 0.15); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), mLip); mouth.position.set(0, -0.07, 0.128); head.add(mouth);

  const arm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.27, 1.43, 0); g.add(sh);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.3, 6), sleeve ? mShirt : mSkin); up.position.y = -0.15; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const fo = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.28, 6), mSkin); fo.position.y = -0.14; el.add(fo);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mSkin); hand.position.y = -0.31; el.add(hand);
    return { sh, el };
  };
  return { g, head, mouth, armL: arm(1), armR: arm(-1), torso };
}

function guitar(kind = 'acoustic', color = 0xb5763a) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.26);
  s.bezierCurveTo(0.24, -0.26, 0.26, -0.02, 0.15, 0.02);
  s.bezierCurveTo(0.2, 0.08, 0.19, 0.25, 0, 0.23);
  s.bezierCurveTo(-0.19, 0.25, -0.2, 0.08, -0.15, 0.02);
  s.bezierCurveTo(-0.26, -0.02, -0.24, -0.26, 0, -0.26);
  const depth = kind === 'acoustic' ? 0.1 : 0.045;
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 16 }), mat(color, { roughness: 0.4, metalness: 0.1 }));
  g.add(body);
  const front = depth + 0.013;
  if (kind === 'acoustic') {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), mat(0x120a06)); hole.position.set(0, 0.08, front); g.add(hole);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.01), mat(0x2a1a10)); bridge.position.set(0, -0.12, front); g.add(bridge);
  } else {
    const guard = new THREE.Mesh(new THREE.CircleGeometry(0.12, 7), mat(0xf2efe6)); guard.position.set(0.03, -0.06, front); g.add(guard);
    for (let i = 0; i < 2; i++) { const pu = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.012), mat(0x111111)); pu.position.set(0, -0.02 - i * 0.08, front + 0.003); g.add(pu); }
  }
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.03), mat(0x5a3a22)); neck.position.set(0, 0.52, depth * 0.6); g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.025), mat(0x1c1410)); head.position.set(0, 0.88, depth * 0.6); head.rotation.x = -0.15; g.add(head);
  const strings = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.95, 0.002), new THREE.MeshBasicMaterial({ color: 0xddd6c8 }));
  strings.position.set(0, 0.36, depth + 0.03); g.add(strings);
  return g;
}

// ================================================================= SCENE A: exterior
function buildExterior() {
  const s = new THREE.Scene();
  s.fog = new THREE.FogExp2(0x0c1030, 0.0042);
  s.add(sky(0x03050f, 0x22204e, 0x090a18));
  s.add(starField(900, 3));
  // moon
  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(16, 2), glowMat(0xfff1cf, 1.6)); moon.position.set(-140, 330, -520); moon.material.fog = false; s.add(moon);
  const halo = glowPoints([-140, 330, -518], [0.9, 0.85, 1.0], 240, 0.9); s.add(halo);
  // soft clouds (poster-style haze)
  const cr = rng(11), cp = [], cc = [];
  for (let i = 0; i < 70; i++) { cp.push((cr() - 0.5) * 900, 120 + cr() * 220, -350 - cr() * 250); const b = 0.05 + cr() * 0.06; cc.push(b * 0.8, b * 0.85, b * 1.4); }
  const clouds = glowPoints(cp, cc, 260, 1); clouds.material.blending = THREE.AdditiveBlending; s.add(clouds);

  s.add(new THREE.HemisphereLight(0x5060b0, 0x0a0a14, 0.9));
  const moonL = new THREE.DirectionalLight(0x9aa8ff, 0.7); moonL.position.set(-1, 2, 1.5); s.add(moonL);

  // ground, road, lawns
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat(0x0d1020, { roughness: 0.3, metalness: 0.35, flatShading: false }));
  ground.rotation.x = -Math.PI / 2; s.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 26), mat(0x0a0b12, { roughness: 0.18, metalness: 0.5, flatShading: false }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, 48); s.add(road);
  for (let i = -20; i <= 20; i++) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.25), glowMat(0xb0b4c8, 0.35)); d.rotation.x = -Math.PI / 2; d.position.set(i * 9, 0.03, 48); s.add(d);
  }
  const lawnM = mat(0x0f2318, { roughness: 1 });
  for (const sx of [-1, 1]) {
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(70, 0.5, 20), lawnM); lawn.position.set(sx * 50, 0.25, 24); s.add(lawn);
  }
  // driveway / plaza to entrance
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(26, 34), mat(0x2a2c36, { roughness: 0.35, metalness: 0.2, flatShading: false }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.03, 20); s.add(plaza);

  // ---- APU main building
  const concrete = mat(0xd5d8de, { roughness: 0.7 });
  const bld = new THREE.Group(); s.add(bld);
  // glowing glass core behind the layered balconies
  const core = new THREE.Mesh(new THREE.BoxGeometry(38, 27, 16), facadeMaterial(24, 6, 21, { wall: '#3a4152', glass: '#1a2a3a', litRatio: 0.6, palette: ['#ffcf86', '#ffd9a0', '#b9e6f0', '#ffb870'], cw: 40, ch: 80, emissive: 0.7 }));
  core.position.set(0, 13.5, -4); bld.add(core);
  // layered curved floor slabs w/ warm LED edges
  const ledM = glowMat(0xffc27a, 1.5), railM = mat(0x8a9099, { metalness: 0.6, roughness: 0.4 });
  for (let i = 1; i <= 5; i++) {
    const y = i * 4.7;
    const rx = 22 + Math.sin(i * 1.3) * 1.6, rz = 10.5 + Math.cos(i * 0.9) * 1.0;
    const sl = slab(rx, rz, 0.55, concrete); sl.position.set(0, y, 0); bld.add(sl);
    const pts = ellipsePts(rx + 0.25, rz + 0.25, y + 0.62, 72).filter((p) => p.z > -4);
    bld.add(tube(pts, 0.07, ledM));
    bld.add(tube(ellipsePts(rx + 0.1, rz + 0.1, y + 1.6, 72).filter((p) => p.z > -4), 0.05, railM));
    // under-slab downlights
    const dl = [], dc = [];
    for (let k = 0; k < 18; k++) { const a = Math.PI * (0.05 + 0.9 * (k / 17)); dl.push(Math.cos(a) * rx * 0.85, y - 0.15, Math.sin(a) * rz * 0.85); dc.push(1, 0.78, 0.5); }
    bld.add(glowPoints(dl, dc, 1.3, 0.8));
  }
  // round columns
  for (let k = 0; k < 8; k++) {
    const a = Math.PI * (0.08 + 0.84 * (k / 7));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 29, 12), mat(0xe2e4e8, { flatShading: false, roughness: 0.6 }));
    col.position.set(Math.cos(a) * 19.5, 14.5, Math.sin(a) * 8.6); bld.add(col);
  }
  // big wavy roof canopy
  const roof = slab(35, 19, 1.4, mat(0xc4c8cf, { metalness: 0.4, roughness: 0.45 }));
  roof.position.set(0, 29.2, -1); roof.scale.set(1, 1, 1); roof.rotation.x = -0.04; bld.add(roof);
  bld.add(tube(ellipsePts(35.3, 19.3, 29.3, 96).map((p) => p.add(V(0, 0, -1))), 0.12, glowMat(0xcfe0ff, 1.6), true));
  const uplight = new THREE.PointLight(0xffc890, 25, 60, 1.2); uplight.position.set(0, 20, 12); s.add(uplight);
  // wings
  for (const sx of [-1, 1]) {
    const facade = facadeMaterial(22, 8, 30 + sx, { litRatio: 0.45 });
    const side = facadeMaterial(10, 8, 40 + sx, { litRatio: 0.35 });
    const plain = mat(0xb9bdc5);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(44, 32, 22), [side, side, plain, plain, facade, plain]);
    wing.position.set(sx * 45, 16, -12); bld.add(wing);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(46, 1.2, 24), mat(0xc4c8cf, { metalness: 0.3 })); cap.position.set(sx * 45, 32.4, -12); bld.add(cap);
  }
  // entrance: glowing glass doors + steps
  const door = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.4), glowMat(0xffd59a, 1.6)); door.position.set(0, 2.2, 4.05); bld.add(door);
  for (let i = 0; i < 5; i++) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 4.4, 0.2), mat(0x20242c)); frame.position.set(-6 + i * 3, 2.2, 4.1); bld.add(frame);
  }
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(22, 0.22, 1.2), mat(0x8f939c, { flatShading: false })); step.position.set(0, 0.11 + i * 0.0, 6 + i * 1.2); step.scale.y = 1 + (3 - i); step.position.y = (1 + (3 - i)) * 0.11; bld.add(step);
  }
  const doorL = new THREE.PointLight(0xffc680, 15, 30, 1.2); doorL.position.set(0, 3, 9); s.add(doorL);

  // street lamps along the road with wet-road reflections
  const lampP = [], lampC = [], reflP = [], reflC = [];
  const poleM = mat(0x2c3038, { metalness: 0.6, roughness: 0.4 });
  for (const z of [36, 60]) for (let x = -84; x <= 84; x += 28) {
    if (Math.abs(x) < 6) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 9, 6), poleM); pole.position.set(x, 4.5, z); s.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), poleM); arm.position.set(x + 0.7, 9, z); s.add(arm);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), glowMat(0xffd08a, 3)); head.position.set(x + 1.4, 8.85, z); s.add(head);
    lampP.push(x + 1.4, 8.8, z); lampC.push(1, 0.75, 0.42);
    for (let k = 0; k < 8; k++) { reflP.push(x + 1.4, 0.06, z + 1 + k * 1.3); const f = 0.18 * (1 - k / 8); reflC.push(f, f * 0.7, f * 0.4); }
  }
  s.add(glowPoints(lampP, lampC, 9, 1.3));
  s.add(glowPoints(reflP, reflC, 3.5, 1.2));
  // trees
  const tr = rng(5), leafM = [mat(0x173524), mat(0x1d4430), mat(0x122a1c)], trunkM = mat(0x2a1d16);
  for (let i = 0; i < 26; i++) {
    const sx = tr() < 0.5 ? -1 : 1, x = sx * (14 + tr() * 70), z = 16 + tr() * 14, sc = 0.8 + tr() * 0.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 5), trunkM); trunk.position.set(x, 1.5 * sc, z); trunk.scale.setScalar(sc); s.add(trunk);
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + tr(), 0), leafM[k % 3]);
      leaf.position.set(x + (tr() - 0.5) * 1.6, (3.4 + tr() * 1.4) * sc, z + (tr() - 0.5) * 1.6); leaf.scale.setScalar(sc); s.add(leaf);
    }
  }
  // distant city silhouettes
  for (let i = 0; i < 16; i++) {
    const r = rng(100 + i), h = 25 + r() * 45, w = 18 + r() * 24;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 20), facadeMaterial(8, Math.round(h / 8), 200 + i, { wall: '#141826', glass: '#0b0f1a', litRatio: 0.25, emissive: 1.0 }));
    b.position.set(-260 + i * 36 + r() * 10, h / 2, -260 - r() * 160); s.add(b);
  }
  const tower = new THREE.Mesh(new THREE.BoxGeometry(26, 120, 20), facadeMaterial(9, 26, 777, { wall: '#1b2030', glass: '#0d1220', litRatio: 0.35 }));
  tower.position.set(-150, 60, -200); s.add(tower);

  // rain
  const N = 2600, rr = rng(9), base = new Float32Array(N * 3), pos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) { base[i * 3] = (rr() - 0.5) * 140; base[i * 3 + 1] = rr() * 70; base[i * 3 + 2] = -10 + rr() * 200; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb2e0, transparent: true, opacity: 0.35, fog: true }));
  rain.frustumCulled = false; s.add(rain);

  const cam = new THREE.PerspectiveCamera(52, W / H, 0.1, 2000);
  const path = new THREE.CatmullRomCurve3([V(34, 1.5, 54), V(18, 1.7, 49), V(4, 2.0, 36), V(0, 2.2, 18), V(0, 2.3, 5.5)]);
  return {
    scene: s, camera: cam, bloom: [0.6, 0.5, 0.75],
    update(t) {
      if (t < T.skyEnd) {
        // start on the moon & stars, tilt down onto the building
        const u = easeInOut(t / T.skyEnd);
        cam.fov = 52; cam.updateProjectionMatrix();
        cam.position.set(lerp(-6, 0, u), lerp(9, 13, u), lerp(110, 88, u));
        cam.lookAt(V(lerp(-110, 0, u), lerp(260, 15, u), lerp(-420, 0, u)));
      } else {
        // low along the wet road, swing toward the entrance and fly in
        const p = clamp01((t - T.skyEnd) / (T.extEnd - T.skyEnd));
        const u = 0.5 * p + 0.5 * p * p * p;
        cam.fov = 58; cam.updateProjectionMatrix();
        cam.position.copy(path.getPoint(u));
        cam.lookAt(V(lerp(-6, 0, smooth(u * 1.4)), lerp(6, 2.2, u), lerp(10, -10, u)));
      }
      for (let i = 0; i < N; i++) {
        const y = (((base[i * 3 + 1] - t * 48) % 70) + 70) % 70;
        const x = base[i * 3], z = base[i * 3 + 2];
        pos.set([x, y, z, x + 0.25, y + 1.7, z], i * 6);
      }
      rg.attributes.position.needsUpdate = true;
    },
  };
}

// ================================================================= SCENE B/C: atrium
function buildAtrium() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x04050c);
  s.fog = new THREE.FogExp2(0x0b0f2a, 0.02);
  s.add(new THREE.HemisphereLight(0x3b4a9a, 0x0b0b14, 0.5));

  const VOID = 10, LEN = 50, FLOORS = 6, FH = 5;
  // floor tiles
  const [fc, fx] = canvas(512, 512);
  fx.fillStyle = '#1b1d25'; fx.fillRect(0, 0, 512, 512);
  fx.strokeStyle = '#0d0e14'; fx.lineWidth = 3;
  for (let i = 0; i <= 8; i++) { fx.beginPath(); fx.moveTo(i * 64, 0); fx.lineTo(i * 64, 512); fx.stroke(); fx.beginPath(); fx.moveTo(0, i * 64); fx.lineTo(512, i * 64); fx.stroke(); }
  const ft = tex(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(10, 25);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 100), mat(0xffffff, { map: ft, roughness: 0.25, metalness: 0.3, flatShading: false }));
  floor.rotation.x = -Math.PI / 2; s.add(floor);

  // railing bars texture
  const [bc, bx] = canvas(256, 64);
  bx.clearRect(0, 0, 256, 64); bx.fillStyle = '#fff';
  for (let i = 0; i < 256; i += 10) bx.fillRect(i, 0, 3, 64);
  bx.fillRect(0, 0, 256, 5); bx.fillRect(0, 59, 256, 5);
  const bt = tex(bc); bt.wrapS = THREE.RepeatWrapping; bt.repeat.set(40, 1);
  const railM = new THREE.MeshStandardMaterial({ color: 0x5c626d, alphaMap: bt, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
  const slabM = mat(0x9da1aa, { roughness: 0.8 }), colM = mat(0xc9ccd2, { flatShading: false, roughness: 0.6 });
  const downP = [], downC = [];
  for (const sx of [-1, 1]) {
    for (let f = 1; f <= FLOORS; f++) {
      const y = f * FH;
      const sl = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, LEN * 2), slabM); sl.position.set(sx * (VOID + 6), y, 0); s.add(sl);
      const rail = new THREE.Mesh(new THREE.PlaneGeometry(LEN * 2, 1.15), railM); rail.rotation.y = Math.PI / 2; rail.position.set(sx * VOID, y + 0.88, 0); s.add(rail);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, LEN * 2), mat(0x3a3f48, { metalness: 0.5 })); hand.position.set(sx * VOID, y + 1.47, 0); s.add(hand);
      for (let z = -LEN + 2; z < LEN; z += 4) { downP.push(sx * (VOID + 2.5), y - 0.35, z); downC.push(0.9, 0.85, 0.75); }
    }
    // office glass walls behind the balconies, all floors
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(LEN * 2, FLOORS * FH + FH), facadeMaterial(50, 7, 300 + sx, { wall: '#2a2f3a', glass: '#0f1c24', litRatio: 0.55, palette: ['#8fd8e0', '#bfeaf0', '#ffd49a', '#6fb8c8'], cw: 48, ch: 90, frame: 3, emissive: 0.9 }));
    wall.rotation.y = -sx * Math.PI / 2; wall.position.set(sx * (VOID + 10), (FLOORS * FH + FH) / 2, 0); s.add(wall);
    for (let z = -LEN + 5; z < LEN; z += 10) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, FLOORS * FH + FH, 14), colM); col.position.set(sx * (VOID + 0.9), (FLOORS * FH + FH) / 2, z); s.add(col);
    }
  }
  s.add(glowPoints(downP, downC, 1.4, 1.2));
  // roof with skylights
  const roof = new THREE.Mesh(new THREE.BoxGeometry(40, 1, LEN * 2), mat(0x15171f)); roof.position.y = FLOORS * FH + FH + 0.5; s.add(roof);
  // end walls
  const endM = mat(0x1a1d26);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), endM); back.position.set(0, 20, -36); s.add(back);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), endM); front.rotation.y = Math.PI; front.position.set(0, 20, LEN); s.add(front);

  // flags (like the APU atrium) — generic colourful stripes
  const fr = rng(42), flagMats = [];
  const pal = ['#c8102e', '#ffffff', '#003da5', '#ffcd00', '#009639', '#000000', '#ff7f00', '#00a3e0', '#7a1fa2'];
  for (let k = 0; k < 10; k++) {
    const [c, x] = canvas(96, 64), a = pal[Math.floor(fr() * 9)], b = pal[Math.floor(fr() * 9)], d = pal[Math.floor(fr() * 9)];
    const kind = k % 4;
    if (kind === 0) { x.fillStyle = a; x.fillRect(0, 0, 32, 64); x.fillStyle = b; x.fillRect(32, 0, 32, 64); x.fillStyle = d; x.fillRect(64, 0, 32, 64); }
    else if (kind === 1) { x.fillStyle = a; x.fillRect(0, 0, 96, 22); x.fillStyle = b; x.fillRect(0, 22, 96, 21); x.fillStyle = d; x.fillRect(0, 43, 96, 21); }
    else if (kind === 2) { x.fillStyle = a; x.fillRect(0, 0, 96, 64); x.fillStyle = b; x.beginPath(); x.arc(48, 32, 16, 0, 7); x.fill(); }
    else { x.fillStyle = a; x.fillRect(0, 0, 96, 64); x.fillStyle = b; x.fillRect(30, 0, 12, 64); x.fillRect(0, 26, 96, 12); }
    flagMats.push(new THREE.MeshStandardMaterial({ map: tex(c), side: THREE.DoubleSide, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex(c), emissiveIntensity: 0.18 }));
  }
  const flagG = new THREE.PlaneGeometry(1.5, 1.0);
  for (let i = 0; i < 26; i++) { // row across the far end above the crowd
    const f = new THREE.Mesh(flagG, flagMats[i % 10]); f.position.set(-9.4 + i * 0.75, 4.1 + (i % 2) * 0.05, 30); f.rotation.y = (fr() - 0.5) * 0.3; s.add(f);
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 40; i++) {
    const f = new THREE.Mesh(flagG, flagMats[(i * 3 + (sx > 0 ? 1 : 0)) % 10]); f.rotation.y = Math.PI / 2; f.position.set(sx * (VOID + 0.2), 3.8, -38 + i * 2.2); s.add(f);
  }

  // fairy lights strung across the void
  const bulbP = [], bulbC = [], wires = [];
  for (let k = 0; k < 9; k++) {
    const z0 = -20 + k * 5.5, y0 = 9 + (k % 3) * 2.5, sag = 2.2;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40, x = lerp(-VOID, VOID, u), z = z0 + Math.sin(u * Math.PI) * 1.5 * (k % 2 ? 1 : -1), y = y0 - Math.sin(u * Math.PI) * sag;
      pts.push(V(x, y, z));
      if (i % 2 === 0) { bulbP.push(x, y - 0.12, z); const w = 0.9 + 0.1 * Math.sin(i + k); bulbC.push(1 * w, 0.72 * w, 0.38 * w); }
    }
    wires.push(new THREE.CatmullRomCurve3(pts));
  }
  const wireG = new THREE.BufferGeometry().setFromPoints(wires.flatMap((c) => { const p = c.getPoints(60); const out = []; for (let i = 0; i < p.length - 1; i++) out.push(p[i], p[i + 1]); return out; }));
  s.add(new THREE.LineSegments(wireG, new THREE.LineBasicMaterial({ color: 0x1a1612 })));
  const bulbs = glowPoints(bulbP, bulbC, 0.7, 1.0); s.add(bulbs);
  const bulbs2 = glowPoints(bulbP, bulbC, 0.18, 2.2); s.add(bulbs2);

  // ---- stage
  const STAGE_Z = -28;
  const stage = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 9), mat(0x101116)); stage.position.set(0, 0.6, STAGE_Z - 1); s.add(stage);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(18, 0.06, 0.06), glowMat(0x8a6bff, 2.5)); lip.position.set(0, 1.18, STAGE_Z + 3.52); s.add(lip);
  // LED screen: rainy night sky with crescent moon & stars (poster vibe, no text)
  const [sc, sxc] = canvas(1024, 512);
  const grd = sxc.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#0b1240'); grd.addColorStop(0.6, '#2a2470'); grd.addColorStop(1, '#5a2f80');
  sxc.fillStyle = grd; sxc.fillRect(0, 0, 1024, 512);
  const sr = rng(77);
  for (let i = 0; i < 160; i++) { sxc.fillStyle = `rgba(255,240,200,${0.3 + sr() * 0.7})`; sxc.beginPath(); sxc.arc(sr() * 1024, sr() * 400, sr() * 2.2 + 0.5, 0, 7); sxc.fill(); }
  const star5 = (cx, cy, r, col) => { sxc.fillStyle = col; sxc.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; sxc.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } sxc.closePath(); sxc.fill(); };
  for (const [x, y, r] of [[120, 90, 22], [880, 140, 18], [700, 60, 12], [260, 330, 14], [940, 380, 16], [420, 70, 10]]) star5(x, y, r, '#ffd84a');
  sxc.fillStyle = '#fff4d0'; sxc.beginPath(); sxc.arc(512, 210, 110, 0, 7); sxc.fill();
  sxc.fillStyle = '#1a1a55'; sxc.beginPath(); sxc.arc(560, 180, 100, 0, 7); sxc.fill();
  sxc.strokeStyle = 'rgba(180,200,255,0.25)'; sxc.lineWidth = 2;
  for (let i = 0; i < 220; i++) { const x = sr() * 1024, y = sr() * 512; sxc.beginPath(); sxc.moveTo(x, y); sxc.lineTo(x - 6, y + 30); sxc.stroke(); }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: tex(sc), color: new THREE.Color(0.9, 0.9, 0.9) }));
  screen.position.set(0, 6.2, STAGE_Z - 5.4); s.add(screen);
  const frameM = mat(0x0b0b0e);
  const sf = new THREE.Mesh(new THREE.BoxGeometry(16.6, 8.6, 0.3), frameM); sf.position.set(0, 6.2, STAGE_Z - 5.6); s.add(sf);
  // truss + speakers
  const trussM = mat(0x2a2c33, { metalness: 0.7, roughness: 0.4 });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(19, 0.4, 0.4), trussM); truss.position.set(0, 11.2, STAGE_Z + 1.5); s.add(truss);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 11.2, 0.4), trussM); leg.position.set(sx * 9.3, 5.6, STAGE_Z + 1.5); s.add(leg);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.1), mat(0x0c0c0f)); sp.position.set(sx * 10.6, 0.7 + k * 1.42, STAGE_Z + 2.5); s.add(sp); }
  }
  // stage beams (fake volumetric)
  const beamMat = (col) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { color: { value: new THREE.Color(col) }, k: { value: 0.22 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 color; uniform float k; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=abs(dot(normalize(vN),normalize(vV))); float a=pow(vUv.y,1.6)*pow(f,1.5)*k; gl_FragColor=vec4(color*a,1.); }`,
  });
  const beams = [];
  const beamCols = [0xffb85c, 0x6f7bff, 0xffb85c, 0xb070ff, 0xffb85c, 0x6f7bff];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); g.position.set(-7.5 + i * 3, 11, STAGE_Z + 1.5); s.add(g);
    const h = 16, cone = new THREE.ConeGeometry(2.4, h, 24, 1, true); cone.translate(0, -h / 2, 0);
    g.add(new THREE.Mesh(cone, beamMat(beamCols[i])));
    const headM = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 10), glowMat(beamCols[i], 3)); g.add(headM);
    beams.push(g);
  }
  // lights
  const key = new THREE.SpotLight(0xffc489, 4, 30, 0.3, 0.7, 0); key.position.set(2.5, 10, STAGE_Z + 8); key.target.position.set(0, 2, STAGE_Z + 0.5); s.add(key, key.target);
  const rim = new THREE.SpotLight(0x6c74ff, 5, 30, 0.6, 0.6, 0); rim.position.set(-1, 9, STAGE_Z - 4); rim.target.position.set(0, 1.8, STAGE_Z + 1); s.add(rim, rim.target);
  const crowdL = new THREE.SpotLight(0xff9e6a, 1.3, 60, 0.75, 0.8, 0); crowdL.position.set(0, 12, STAGE_Z + 1); crowdL.target.position.set(0, 0, 0); s.add(crowdL, crowdL.target);
  const fill = new THREE.PointLight(0x7a5cff, 1.2, 40, 0); fill.position.set(0, 6, STAGE_Z - 2); s.add(fill);
  for (const [x, z, col] of [[-4.2, -0.6, 0xffb36a], [4.2, -0.6, 0xffb36a], [0, -2.4, 0xd070ff]]) {
    const sp = new THREE.SpotLight(col, 3.5, 25, 0.28, 0.7, 0); sp.position.set(x * 0.6, 10, STAGE_Z + z + 6); sp.target.position.set(x, 2, STAGE_Z + z); s.add(sp, sp.target);
  }
  const hall = new THREE.PointLight(0xffb070, 0.6, 40, 0); hall.position.set(0, 10, 0); s.add(hall);

  // ---- band
  const band = new THREE.Group(); band.position.set(0, 1.2, STAGE_Z); s.add(band);
  const singer = makePerson({ skin: 0xc68a62, hair: 0x0b0a0d, shirt: 0xe8e2d6, pants: 0x2a3550 });
  singer.g.position.set(0, 0, 0.8); band.add(singer.g);
  const sg = guitar('acoustic', 0xb87838); sg.position.set(-0.04, 1.08, 0.13); sg.rotation.set(0.05, 0.1, -1.15); sg.scale.setScalar(1.05); singer.g.add(sg);
  // mic
  const micM = mat(0x18181c, { metalness: 0.7, roughness: 0.3 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.52, 6), micM); stand.position.set(0, 0.76, 1.22); band.add(stand);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), micM); base.position.set(0, 0.015, 1.22); band.add(base);
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.18, 8), micM); mic.rotation.x = 1.25; mic.position.set(0, 1.56, 1.13); band.add(mic);
  const micHead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 1), mat(0x555a62, { metalness: 0.8, roughness: 0.3 })); micHead.position.set(0, 1.585, 1.05); band.add(micHead);
  // guitarist + bassist
  const gtr = makePerson({ skin: 0xa8724f, hair: 0x3a2a1c, shirt: 0x7a2a22, pants: 0x1f2433 }); gtr.g.position.set(-4.2, 0, -0.6); gtr.g.rotation.y = 0.35; band.add(gtr.g);
  const eg = guitar('electric', 0x15161c); eg.position.set(-0.04, 1.06, 0.13); eg.rotation.set(0.05, 0.1, -1.2); gtr.g.add(eg);
  const bas = makePerson({ skin: 0xd9a07a, hair: 0x6a5232, shirt: 0x3d6b4a, pants: 0x262b38 }); bas.g.position.set(4.2, 0, -0.6); bas.g.rotation.y = -0.35; band.add(bas.g);
  const bg = guitar('electric', 0x8a1e1e); bg.position.set(-0.04, 1.06, 0.13); bg.rotation.set(0.05, 0.1, -1.25); bg.scale.set(1, 1.15, 1); bas.g.add(bg);
  for (const p of [singer, gtr, bas]) {
    p.armL.sh.rotation.set(-1.0, 0, 0.55); p.armL.el.rotation.set(-0.9, 0, -0.3);
    p.armR.sh.rotation.set(-0.45, 0, 0.35); p.armR.el.rotation.set(-1.25, 0, 0.2);
  }
  // drums on a riser
  const riser = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.6, 3), mat(0x16171d)); riser.position.set(0, 0.3, -2.8); band.add(riser);
  const kit = new THREE.Group(); kit.position.set(0, 0.6, -2.4); band.add(kit);
  const shellM = mat(0xa3201e, { roughness: 0.35, metalness: 0.2 }), headM = mat(0xeee8dc), cymM = mat(0xd4a634, { metalness: 0.85, roughness: 0.3 });
  const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.45, 16), shellM); kick.rotation.x = Math.PI / 2; kick.position.set(0, 0.42, 0.4); kit.add(kick);
  const kickF = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), headM); kickF.position.set(0, 0.42, 0.63); kit.add(kickF);
  for (const [x, y, z, r] of [[-0.45, 0.75, 0.55, 0.2], [0.3, 0.95, 0.35, 0.16], [-0.1, 0.95, 0.3, 0.16], [0.7, 0.55, 0.3, 0.24]]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 14), shellM); d.position.set(x, y, z); d.rotation.x = 0.35; kit.add(d);
    const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 14), headM); top.rotation.x = -Math.PI / 2 + 0.35; top.position.set(x, y + 0.1, z + 0.03); kit.add(top);
  }
  const cyms = [];
  for (const [x, y, z] of [[-0.9, 1.25, 0.4], [0.95, 1.35, 0.2], [-0.65, 1.0, 0.75]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, y, 5), micM); st.position.set(x, y / 2, z); kit.add(st);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.012, 16), cymM); c.position.set(x, y, z); c.rotation.x = 0.25; kit.add(c); cyms.push(c);
  }
  const drm = makePerson({ skin: 0x8d5a3c, hair: 0x0e0d10, shirt: 0x2c4a7a, pants: 0x1c2030 });
  drm.g.position.set(0, -0.35, -0.35); kit.add(drm.g);
  drm.armL.sh.rotation.set(-1.0, 0, 0.35); drm.armR.sh.rotation.set(-1.0, 0, -0.35);
  const sticks = [];
  for (const p of [drm.armL, drm.armR]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.42, 5), mat(0xe6cf9a)); st.position.set(0, -0.32, 0.18); st.rotation.x = 1.3; p.el.add(st); sticks.push(st); }

  // ---- crowd (instanced)
  const cr = rng(2026);
  const people = [];
  for (let z = -22.5; z <= 14; z += 1.1) for (let x = -9.0; x <= 9.0; x += 1.0) {
    if (cr() < 0.18 || Math.abs(x) < 0.6) continue;
    people.push({
      x: x + (cr() - 0.5) * 0.4, z: z + (cr() - 0.5) * 0.4, s: 0.9 + cr() * 0.18, ry: (cr() - 0.5) * 0.4,
      phase: cr() * 6.28, raised: cr() < 0.45, side: cr() < 0.5 ? -1 : 1, hijab: cr() < 0.35,
      skin: SKIN[Math.floor(cr() * SKIN.length)], shirt: new THREE.Color().setHSL(cr(), 0.25 + cr() * 0.3, 0.18 + cr() * 0.35),
      hair: new THREE.Color().setHSL(0.07, 0.3, 0.03 + cr() * 0.1), scarf: new THREE.Color().setHSL(cr() < 0.5 ? 0.05 + cr() * 0.08 : 0.55 + cr() * 0.3, 0.25, 0.35 + cr() * 0.3),
    });
  }
  const NP = people.length;
  const mk = (geo, m, n) => { const im = new THREE.InstancedMesh(geo, m, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; s.add(im); return im; };
  const bodyG = new THREE.CylinderGeometry(0.22, 0.17, 0.66, 6); bodyG.scale(1, 1, 0.65);
  const legG = new THREE.BoxGeometry(0.32, 0.85, 0.2);
  const headG = new THREE.IcosahedronGeometry(0.14, 1);
  const hairG = new THREE.IcosahedronGeometry(0.152, 1); hairG.scale(1.04, 0.95, 1.05);
  const hijabG = new THREE.IcosahedronGeometry(0.17, 1); hijabG.scale(1, 1.1, 1);
  const drapeG = new THREE.CylinderGeometry(0.14, 0.28, 0.32, 7); drapeG.scale(1, 1, 0.8);
  const mouthG = new THREE.BoxGeometry(0.05, 0.035, 0.02);
  const armG = new THREE.CylinderGeometry(0.045, 0.05, 0.62, 5); armG.translate(0, 0.31, 0);
  const phoneG = new THREE.BoxGeometry(0.075, 0.14, 0.012);
  const white = mat(0xffffff);
  const iBody = mk(bodyG, white, NP), iLeg = mk(legG, mat(0x1d2230), NP), iHead = mk(headG, white, NP);
  const nHijab = people.filter((p) => p.hijab).length;
  const iHair = mk(hairG, white, NP - nHijab), iHijab = mk(hijabG, white, nHijab), iDrape = mk(drapeG, white, nHijab);
  const iMouth = mk(mouthG, mat(0x3a1414), NP);
  const nRaised = people.filter((p) => p.raised).length;
  const iArm = mk(armG, white, nRaised), iPhone = mk(phoneG, glowMat(0xdfe8ff, 0.9), nRaised);
  {
    let h = 0, j = 0, a = 0; const c = new THREE.Color();
    people.forEach((p, i) => {
      iBody.setColorAt(i, p.shirt); iHead.setColorAt(i, c.set(p.skin));
      if (p.hijab) { iHijab.setColorAt(h, p.scarf); iDrape.setColorAt(h, p.scarf); p.hi = h++; } else { iHair.setColorAt(j, p.hair); p.hj = j++; }
      if (p.raised) { iArm.setColorAt(a, c.set(p.skin)); p.ai = a++; }
    });
    for (const im of [iBody, iHead, iHair, iHijab, iDrape, iArm]) if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
  const flashCore = glowPoints(new Array(nRaised * 3).fill(0), new Array(nRaised * 3).fill(1), 0.14, 2.5);
  const flashHalo = glowPoints(new Array(nRaised * 3).fill(0), new Array(nRaised * 3).fill(0).map((_, k) => [0.8, 0.85, 1][k % 3]), 0.9, 0.35);
  flashCore.frustumCulled = flashHalo.frustumCulled = false; s.add(flashCore, flashHalo);

  // floating dust / embers (poster sparks)
  const er = rng(8), eP = [], eC = [], eBase = [];
  for (let i = 0; i < 500; i++) { const p = [(er() - 0.5) * 20, er() * 22, -30 + er() * 46]; eBase.push(p, er() * 6.28); eP.push(...p); const w = er() < 0.5; eC.push(w ? 1 : 0.6, w ? 0.55 : 0.6, w ? 0.25 : 1); }
  const embers = glowPoints(eP, eC, 0.12, 1.6); embers.frustumCulled = false; s.add(embers);

  const dummy = new THREE.Object3D(), m4 = new THREE.Matrix4(), tmpV = new THREE.Vector3();
  const SWAY = (2 * Math.PI) / 2.6; // slow ballad sway

  function updateCrowd(t) {
    const cp = flashCore.geometry.attributes.position.array, hp = flashHalo.geometry.attributes.position.array;
    people.forEach((p, i) => {
      const sway = Math.sin(t * SWAY + p.x * 0.18 + p.z * 0.05) * 0.09 + Math.sin(t * 1.3 + p.phase) * 0.02;
      const base = new THREE.Object3D(); base.position.set(p.x, 0, p.z); base.rotation.set(0, Math.PI + p.ry, 0); base.scale.setScalar(p.s); base.updateMatrix();
      const place = (im, idx, lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
        dummy.position.set(lx, ly, lz); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
        m4.multiplyMatrices(base.matrix, dummy.matrix); im.setMatrixAt(idx, m4); return m4;
      };
      place(iLeg, i, 0, 0.43, 0);
      // upper body sways around the hips
      const hx = Math.sin(sway) * 0.6, hy = 0.85;
      place(iBody, i, hx * 0.5, 1.18, 0, 0, 0, sway);
      const headX = hx * 1.3, headY = 1.68 - Math.abs(sway) * 0.1, tilt = -0.25 + Math.sin(t * 2.4 + p.phase) * 0.08; // heads tilted up singing
      place(iHead, i, headX, headY, 0, tilt, 0, sway * 1.4);
      if (p.hijab) { place(iHijab, p.hi, headX, headY + 0.015, -0.035, tilt, 0, sway * 1.4); place(iDrape, p.hi, hx * 0.8, 1.47, -0.01, 0, 0, sway); }
      else place(iHair, p.hj, headX, headY + 0.04, -0.03, tilt, 0, sway * 1.4);
      const open = 0.5 + 0.9 * Math.abs(Math.sin(t * 5.2 + p.phase));
      place(iMouth, i, headX, headY - 0.065, 0.125, tilt, 0, sway * 1.4, 1, open, 1);
      if (p.raised) {
        const ax = p.side * 0.25 + hx * 0.9, ay = 1.42;
        const az = Math.sin(t * SWAY + p.x * 0.18 + p.z * 0.05 + 0.4) * 0.45 - p.side * 0.15;
        const mArm = place(iArm, p.ai, ax, ay, 0, 0.35, 0, az);
        // phone at the top of the arm
        dummy.position.set(0, 0.68, 0.0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        const mPhone = new THREE.Matrix4().multiplyMatrices(mArm, dummy.matrix); iPhone.setMatrixAt(p.ai, mPhone);
        tmpV.setFromMatrixPosition(mPhone);
        cp[p.ai * 3] = hp[p.ai * 3] = tmpV.x; cp[p.ai * 3 + 1] = hp[p.ai * 3 + 1] = tmpV.y; cp[p.ai * 3 + 2] = hp[p.ai * 3 + 2] = tmpV.z;
      }
    });
    for (const im of [iBody, iLeg, iHead, iHair, iHijab, iDrape, iMouth, iArm, iPhone]) im.instanceMatrix.needsUpdate = true;
    flashCore.geometry.attributes.position.needsUpdate = true; flashHalo.geometry.attributes.position.needsUpdate = true;
  }

  function updateBand(t) {
    // singer: sways, leans into mic, mouth sings, strums
    const sway = Math.sin(t * SWAY) * 0.05;
    singer.g.rotation.set(0.04, 0, sway);
    singer.head.rotation.set(0.05 + Math.sin(t * 1.1) * 0.05, Math.sin(t * 0.8) * 0.08, -sway * 1.5 + 0.06);
    singer.mouth.scale.y = 0.4 + 1.4 * Math.abs(Math.sin(t * 4.1)) * (0.6 + 0.4 * Math.sin(t * 1.7));
    singer.armR.el.rotation.x = -1.25 + Math.sin(t * 9) * 0.18;
    gtr.armR.el.rotation.x = -1.25 + Math.sin(t * 9 + 1) * 0.15;
    bas.armR.el.rotation.x = -1.2 + Math.sin(t * 4.6) * 0.12;
    gtr.g.rotation.z = Math.sin(t * SWAY + 1) * 0.04; bas.g.rotation.z = Math.sin(t * SWAY + 2) * 0.04;
    gtr.head.rotation.x = 0.25 + Math.sin(t * 4.6) * 0.1; bas.head.rotation.x = 0.2 + Math.sin(t * 4.6 + 1) * 0.1;
    const hit = (ph) => Math.pow(Math.abs(Math.sin(t * 4.6 + ph)), 6);
    drm.armL.el.rotation.x = -0.6 - hit(0) * 0.7; drm.armR.el.rotation.x = -0.6 - hit(1.57) * 0.7;
    drm.head.rotation.x = 0.15 + Math.sin(t * 4.6) * 0.08;
    cyms.forEach((c, i) => { c.rotation.z = Math.sin(t * 9 + i) * 0.04 * (1 + hit(i)); });
    beams.forEach((b, i) => { b.rotation.set(Math.sin(t * 0.5 + i) * 0.25 + 0.55, 0, Math.sin(t * 0.6 + i * 1.3) * 0.45); });
    // embers drift
    const ep = embers.geometry.attributes.position.array;
    for (let i = 0; i < eBase.length / 2; i++) {
      const b = eBase[i * 2], ph = eBase[i * 2 + 1];
      ep[i * 3] = b[0] + Math.sin(t * 0.4 + ph) * 0.8; ep[i * 3 + 1] = (b[1] + t * 0.5) % 22; ep[i * 3 + 2] = b[2] + Math.cos(t * 0.3 + ph) * 0.8;
    }
    embers.geometry.attributes.position.needsUpdate = true;
  }

  const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 400);
  const SZ = STAGE_Z + 0.8; // singer z
  return {
    scene: s, camera: cam, bloom: [0.55, 0.5, 0.8],
    update(t) {
      updateCrowd(t); updateBand(t);
      const shot = (a, b) => easeInOut((t - a) / (b - a));
      cam.up.set(0, 1, 0);
      if (t < T.topEnd) {
        // from the upper floor railing, looking straight down, descending toward the stage
        const u = shot(T.extEnd, T.topEnd);
        cam.fov = lerp(82, 55, u); cam.updateProjectionMatrix();
        cam.position.set(lerp(-7.5, 1.5, u), lerp(33, 7.5, u), lerp(10, -12, u));
        const look = V(lerp(-2, 0, u), lerp(0, 2.6, u), lerp(-4, SZ, u));
        if (u < 0.3) cam.up.set(0, 0, -1);
        else cam.up.set(0, 0, -1).lerp(V(0, 1, 0), smooth((u - 0.3) / 0.5)).normalize();
        cam.lookAt(look);
      } else if (t < T.balcEnd) {
        // standing on a 2nd-floor balcony behind the railing, sliding along, fairy lights in front
        const u = shot(T.topEnd, T.balcEnd);
        cam.fov = 60; cam.updateProjectionMatrix();
        cam.position.set(-10.35, 12.0, lerp(8, -4, u));
        cam.lookAt(lerp(3, 1, u), lerp(0, 1.5, u), lerp(-10, -22, u));
      } else if (t < T.singerEnd) {
        const u = shot(T.balcEnd, T.singerEnd);
        cam.fov = 38; cam.updateProjectionMatrix();
        cam.position.set(lerp(2.1, 1.05, u), lerp(2.3, 2.75, u), SZ + lerp(4.4, 2.2, u));
        cam.lookAt(lerp(-0.1, -0.05, u), lerp(2.45, 2.8, u), SZ);
      } else if (t < T.bandEnd) {
        // low on the stage, orbiting the guitarist (drums behind him)
        const u = shot(T.singerEnd, T.bandEnd);
        cam.fov = 50; cam.updateProjectionMatrix();
        const gx = -4.2, gz = STAGE_Z - 0.6, ang = lerp(0.15, -0.55, u), rad = lerp(3.0, 2.5, u);
        cam.position.set(gx + Math.sin(ang) * rad, lerp(1.7, 2.0, u), gz + Math.cos(ang) * rad);
        cam.lookAt(gx + 0.5, 2.35, gz - 0.3);
      } else if (t < T.crowdEnd) {
        // reverse: over the singer's shoulder onto the crowd
        const u = shot(T.bandEnd, T.crowdEnd);
        cam.fov = 50; cam.updateProjectionMatrix();
        cam.position.set(lerp(-1.4, -0.6, u), lerp(3.2, 3.6, u), SZ - lerp(1.6, 0.9, u));
        cam.lookAt(lerp(-0.6, 0.4, u), lerp(0.9, 1.3, u), 6);
      } else if (t < T.walkEnd) {
        // walking up the aisle through the crowd, phones all around
        const u = shot(T.crowdEnd, T.walkEnd);
        cam.fov = 62; cam.updateProjectionMatrix();
        cam.position.set(Math.sin(t * 2.2) * 0.04, 1.85 + Math.sin(t * 6) * 0.015, lerp(10, -8, u));
        cam.lookAt(0, 3.4, STAGE_Z);
      } else {
        // wide finale: from the back of the hall, craning up over everyone
        const u = shot(T.walkEnd, T.wideEnd);
        cam.fov = 58; cam.updateProjectionMatrix();
        cam.position.set(lerp(-3, 2, u), lerp(3, 20, u), lerp(44, 40, u));
        cam.lookAt(0, lerp(5, 2, u), STAGE_Z);
      }
    },
  };
}

// ================================================================= SCENE D: logo
async function buildLogo() {
  const s = new THREE.Scene();
  s.add(sky(0x050a22, 0x10183a, 0x050814));
  const texL = await new THREE.TextureLoader().loadAsync('/assets/aswb-logo.png');
  texL.colorSpace = THREE.SRGBColorSpace; texL.anisotropy = 8;
  const aspect = texL.image.height / texL.image.width;
  const logo = new THREE.Group(); s.add(logo);
  const geo = new THREE.PlaneGeometry(4.6, 4.6 * aspect);
  // stacked copies give a coin-like thickness when it turns
  for (let i = 8; i >= 1; i--) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texL, transparent: true, alphaTest: 0.5, color: new THREE.Color(0.35, 0.08, 0.08), toneMapped: false }));
    m.position.z = -i * 0.025; logo.add(m);
  }
  const face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texL, transparent: true, toneMapped: false, color: new THREE.Color(0.93, 0.93, 0.93) }));
  logo.add(face);
  // glow behind
  const halo = glowPoints([0, 0, -0.6], [1, 0.45, 0.25], 11, 0.6); s.add(halo);
  const halo2 = glowPoints([0, 0, -1], [0.35, 0.4, 1], 22, 0.5); s.add(halo2);
  // light rays
  const [rc, rx] = canvas(512, 512);
  rx.translate(256, 256);
  for (let i = 0; i < 24; i++) {
    rx.rotate((Math.PI * 2) / 24);
    const g = rx.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,220,160,0.5)'); g.addColorStop(1, 'rgba(255,220,160,0)');
    rx.fillStyle = g; rx.beginPath(); rx.moveTo(0, 0); rx.lineTo(256, -10 - (i % 3) * 6); rx.lineTo(256, 10 + (i % 3) * 6); rx.closePath(); rx.fill();
  }
  const rays = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: tex(rc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  rays.position.z = -1.2; rays.visible = false; s.add(rays);
  // poster stars
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starG = new THREE.ExtrudeGeometry(starShape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
  const starM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.25, 0.35) });
  const stars = [], sr = rng(19);
  const spots = [[-3.3, 5.6], [3.6, 4.6], [-3.9, -1.2], [3.8, -2.6], [-2.4, -5.4], [2.2, 6.6], [0.6, -6.6], [-4.2, 2.6], [4.3, 1.4]];
  spots.forEach(([x, y], i) => { const m = new THREE.Mesh(starG, starM); m.position.set(x, y, -0.5 - sr() * 2); const sc = 0.22 + sr() * 0.22; m.scale.setScalar(sc); m.userData = { sc, ph: sr() * 6.28, rz: sr() }; s.add(m); stars.push(m); });
  s.add(starField(500, 33, 600));
  // rising embers + gentle rain
  const er = rng(4), eb = [], eP = [], eC = [];
  for (let i = 0; i < 160; i++) { const b = [(er() - 0.5) * 12, (er() - 0.5) * 22, -2 + er() * 4]; eb.push(b); eP.push(...b); eC.push(1, 0.55, 0.22); }
  const emb = glowPoints(eP, eC, 0.12, 2.5); s.add(emb);
  const NR = 500, rb = [], rpos = new Float32Array(NR * 6);
  for (let i = 0; i < NR; i++) rb.push([(er() - 0.5) * 16, er() * 26, -6 + er() * 5]);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x7f92c8, transparent: true, opacity: 0.25 })); rain.frustumCulled = false; s.add(rain);

  const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 2000);
  return {
    scene: s, camera: cam, bloom: [0.45, 0.5, 0.95],
    update(t) {
      const lt = t - T.wideEnd;
      const a = easeOutBack((lt - 0.2) / 1.1);
      const sc = lerp(0.35, 1, a);
      logo.scale.setScalar(Math.max(0.001, sc));
      logo.rotation.y = lerp(-1.3, 0, easeOut((lt - 0.2) / 1.4)) + Math.sin(lt * 1.2) * 0.06;
      logo.rotation.x = Math.sin(lt * 0.9) * 0.04;
      logo.position.y = 0.3 + Math.sin(lt * 1.4) * 0.08;
      logo.visible = lt > 0.2;
      const ap = clamp01((lt - 0.3) / 0.8);
      halo.material.opacity = ap; halo2.material.opacity = ap; rays.material.opacity = 0.12 * ap;
      rays.rotation.z = lt * 0.15;
      stars.forEach((m, i) => { const k = clamp01((lt - 0.4 - i * 0.08) / 0.5); m.scale.setScalar(m.userData.sc * easeOutBack(k) * (1 + 0.15 * Math.sin(lt * 3 + m.userData.ph))); m.rotation.z = m.userData.rz + lt * 0.3; m.visible = k > 0; });
      const ep = emb.geometry.attributes.position.array;
      eb.forEach((b, i) => { ep[i * 3] = b[0] + Math.sin(lt + i) * 0.2; ep[i * 3 + 1] = ((b[1] + lt * 1.2 + 11) % 22) - 11; ep[i * 3 + 2] = b[2]; });
      emb.geometry.attributes.position.needsUpdate = true;
      rb.forEach((b, i) => { const y = (((b[1] - lt * 14) % 26) + 26) % 26 - 13; rpos.set([b[0], y, b[2], b[0] + 0.12, y + 0.9, b[2]], i * 6); });
      rg.attributes.position.needsUpdate = true;
      cam.position.set(0, 0, lerp(18, 15.5, easeOut(lt / 3.5)));
      cam.lookAt(0, 0.1, 0);
    },
  };
}

// ================================================================= compositing
const ext = buildExterior();
const atr = buildAtrium();
const lgo = await buildLogo();

const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, H);
const rp = new RenderPass(ext.scene, ext.camera); composer.addPass(rp);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.6, 0.6); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uFade: { value: 0 }, uFadeColor: { value: new THREE.Color(0, 0, 0) }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uFade; uniform vec3 uFadeColor; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 d = vUv-0.5; float r2 = dot(d,d);
      float ca = 0.006*r2*4.;
      vec3 c = vec3(texture2D(tDiffuse, vUv - d*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d*ca).b);
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(c, c*vec3(0.9,0.97,1.15) + vec3(0.0,0.004,0.02), 1.0-smoothstep(0.0,0.45,l));   // blue shadows
      c = mix(c, c*vec3(1.07,1.0,0.88), smoothstep(0.45,1.0,l));                              // warm highlights
      float v = smoothstep(0.95, 0.3, length(d*vec2(1.25,0.85)));
      c *= mix(0.55, 1.0, v);
      c += (hash(vUv*uRes + fract(uTime)*91.7) - 0.5) * 0.04;
      c = mix(c, uFadeColor, clamp(uFade,0.,1.));
      gl_FragColor = vec4(c, 1.);
    }`,
});
composer.addPass(grade);

function pick(t) {
  if (t < T.extEnd) return ext;
  if (t < T.wideEnd) return atr;
  return lgo;
}

window.renderFrame = (t) => {
  const sc = pick(t);
  sc.update(t);
  rp.scene = sc.scene; rp.camera = sc.camera;
  [bloom.strength, bloom.radius, bloom.threshold] = sc.bloom;
  // transitions
  let fade = 0; const fc = grade.uniforms.uFadeColor.value;
  if (t > T.extEnd - 0.45 && t < T.extEnd + 0.5) { // fly through the doors into warm light
    fc.setRGB(1.0, 0.86, 0.66);
    fade = t < T.extEnd ? smooth((t - (T.extEnd - 0.45)) / 0.45) : 1 - smooth((t - T.extEnd) / 0.5);
  } else if (t < 0.5) { fc.setRGB(0, 0, 0); fade = 1 - smooth(t / 0.5); }
  else if (t > T.wideEnd - 0.45 && t < T.wideEnd + 0.5) { fc.setRGB(0, 0, 0); fade = t < T.wideEnd ? smooth((t - (T.wideEnd - 0.45)) / 0.45) : 1 - smooth((t - T.wideEnd) / 0.5); }
  else if (t > T.end - 0.35) { fc.setRGB(0, 0, 0); fade = smooth((t - (T.end - 0.35)) / 0.35); }
  else for (const c of CUTS) if (Math.abs(t - c) < 0.12) { fc.setRGB(0.02, 0.02, 0.06); fade = Math.max(fade, 1 - Math.abs(t - c) / 0.12); } // dip on the cut
  grade.uniforms.uFade.value = fade;
  grade.uniforms.uTime.value = t;
  composer.render();
  return renderer.domElement.toDataURL('image/jpeg', 0.93);
};
window.READY = true;
