// The hero is live pixel art: a small 2D canvas, scaled up with hard edges.
// At rest: a blind in a dark room, a desk lamp, and the name on the wall in its light.
// Scroll: the slats open, the view flies across the quad and in through the one lit window,
// and lands in the workshop, where each project on the bench is a link.
// The words come from the page itself (the h1, .hero-line, the footer h2 and the link labels),
// so editing index.html is enough to change them.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerpC = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${Math.round(mix(A[0], B[0], t))},${Math.round(mix(A[1], B[1], t))},${Math.round(mix(A[2], B[2], t))})`; };
const wrap = (str, n) => { const out = []; let line = ''; for (const w of str.split(/\s+/)) { if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; } if (line) out.push(line); return out; };
const balance = (str, n) => { let best = wrap(str, n); for (let m = n - 1; m > 6; m--) { const w = wrap(str, m); if (w.length > best.length) break; best = w; } return best; };
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const CLOSED = 1.24;          // slat angle when shut, radians
const FP = 240, HC = 5;       // focal length in art pixels, eye height in metres
const DB = 80, ZEND = 79.55, DWS = 81.2;   // distance to the lit window, where the camera stops, depth of the workshop
const G = HC * FP, PATHX = -9.33;

// Two bitmap fonts. Each glyph is one character per row, read as a base-32 number, one bit per pixel.
const G5 = { A: 'ehhvhhh', B: 'uhhuhhu', C: 'ehggghe', D: 'sihhhis', E: 'vgguggv', F: 'vgguggg', G: 'ehgnhhf', H: 'hhhvhhh', I: 'e44444e', J: '72222ic', K: 'hikokih', L: 'ggggggv', M: 'hrllhhh', N: 'hpljhhh', O: 'ehhhhhe', P: 'uhhuggg', Q: 'ehhhlid', R: 'uhhukih', S: 'fgge11u', T: 'v444444', U: 'hhhhhhe', V: 'hhhhha4', W: 'hhhllla', X: 'hha4ahh', Y: 'hha4444', Z: 'v1248gv', 0: 'ehjlphe', 1: '4c4444e', 2: 'eh1248v', 3: 'v2421he', 4: '26aiv22', 5: 'vgu11he', 6: '68guhhe', 7: 'v124888', 8: 'ehhehhe', 9: 'ehhf12c', '.': '00000cc', ',': '0000c48', "'": '4480000', '-': '000e000', ':': '0cc0cc0', '!': '4444404', '?': 'eh12404' };
const G3 = { A: '25755', B: '65656', C: '34443', D: '65556', E: '74747', F: '74744', G: '34753', H: '55755', I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644', Q: '25573', R: '65765', S: '34216', T: '72222', U: '55557', V: '55522', W: '55775', X: '55255', Y: '55222', Z: '71247', 0: '35556', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757', 9: '75716', '.': '00002', ',': '00024', ':': '02020', '-': '00700', "'": '22000', '!': '22202', '?': '61202', '/': '11244', '>': '22720' };
const mk = (src, w) => { const out = {}; for (const ch in src) { const runs = []; [...src[ch]].forEach((row, y) => { const bits = parseInt(row, 32); for (let x = 0; x < w;) { if (bits >> (w - 1 - x) & 1) { let n = 1; while (x + n < w && (bits >> (w - 1 - x - n) & 1)) n++; runs.push([x, y, n]); x += n; } else x++; } }); out[ch] = runs; } return out; };
const F5 = { w: 5, g: mk(G5, 5) }, F3 = { w: 3, g: mk(G3, 3) };
const RAMP = Array.from({ length: 9 }, (_, i) => lerpC('#5e4a4b', '#ffeccb', i / 8));   // lettering, from shadow to full lamp light
const TREES = [['#a8482c', '#cf6a30', '#eda04a'], ['#b9762a', '#dd9a34', '#f4c55e'], ['#7d2f33', '#a84232', '#d06a3a'], ['#55603c', '#74824a', '#9aa95c']];
const OBJ = [   // across (m), away (m), 0 = lamp post or 1-4 = tree colour, size
  [-30, 62, 1, 1], [-20, 50, 2, 1.1], [-27, 40, 3, 1], [-15, 33, 1, 0.9], [-13, 20, 4, 1], [14, 70, 2, 1], [22, 56, 4, 1.05], [12, 44, 1, 1.1], [19, 32, 3, 1], [9.5, 23, 2, 0.9],
  [-12, 72, 0], [-6.7, 60, 0], [-12, 48, 0], [-6.7, 36, 0], [-12, 25, 0], [-6.7, 15, 0],
].sort((a, b) => b[1] - a[1]);

export function initHero({ canvas, heroSection, heroUi, endSection, endUi, buttons, btnOpen, btnClose, btnLamp, ws }) {
  let g = canvas.getContext('2d', { alpha: false });
  if (!g) return null;
  const gm = g, rc = document.createElement('canvas'), gr = rc.getContext('2d');   // the room is drawn on its own layer, so the lamp lights the room and not the view outside
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(hover: none)').matches;
  const up = el => (el?.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
  const words = { name: [...heroUi.querySelectorAll('h1 span')].map(up).join(' ') || up(heroUi.querySelector('h1')), line: up(heroUi.querySelector('.hero-line')), end: up(endUi.querySelector('h2')) };
  const LABEL = {}; ws.querySelectorAll('a').forEach(a => { LABEL[a.dataset.k] = (a.dataset.label || a.dataset.k).toUpperCase(); });

  let W = 320, H = 180, s = 4, L = {}, sky = null, stars = [];
  let ox = 0, oy = 0, k = 1;            // the current drawing transform: screen = o + world * k, then rounded to whole pixels
  let z = 0, Fx = 0, Fy = 0;            // camera: how far it has flown, and where the lit window sits on screen
  const S = { t: 0, theta: CLOSED, target: CLOSED, ptrX: 0.5, ptrY: 0.5, lastInput: -10, mode: null, manualUntil: -1, endManual: false, led: 0, pg: 0, pr: 0, lamp: 1, lampT: 1, hot: null, zoneWas: null, lock: null };

  // ---------------------------------------------------------------- drawing primitives
  function R(x, y, w, h, c) { const x0 = Math.round(ox + x * k), y0 = Math.round(oy + y * k), x1 = Math.round(ox + (x + w) * k), y1 = Math.round(oy + (y + h) * k); if (x1 <= x0 || y1 <= y0 || x1 < 0 || y1 < 0 || x0 > W || y0 > H) return; g.fillStyle = c; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
  function R1(x, y, w, h, c) { const x0 = Math.round(ox + x * k), y0 = Math.round(oy + y * k), w1 = Math.max(1, Math.round(ox + (x + w) * k) - x0), h1 = Math.max(1, Math.round(oy + (y + h) * k) - y0); if (x0 + w1 < 0 || y0 + h1 < 0 || x0 > W || y0 > H) return; g.fillStyle = c; g.fillRect(x0, y0, w1, h1); }
  function disc(cx, cy, r, c) {
    const X = ox + cx * k, Y = oy + cy * k, rr = r * k; if (X + rr < 0 || X - rr > W || Y + rr < 0 || Y - rr > H) return;
    g.fillStyle = c; if (rr < 0.8) { g.fillRect(Math.round(X - 0.5), Math.round(Y - 0.5), 1, 1); return; }
    const y0 = Math.max(0, Math.round(Y - rr)), y1 = Math.min(H, Math.round(Y + rr));
    for (let y = y0; y < y1; y++) { const dy = (y + 0.5 - Y) / rr, hw = Math.sqrt(Math.max(0, 1 - dy * dy)) * rr, xa = Math.round(X - hw), xb = Math.round(X + hw); if (xb > xa) g.fillRect(xa, y, xb - xa, 1); }
  }
  function glow(cx, cy, r, rgb, a, op = 'lighter') { if (a <= 0.003) return; g.globalCompositeOperation = op; disc(cx, cy, r, `rgba(${rgb},${a.toFixed(3)})`); g.globalCompositeOperation = 'source-over'; }
  function glyph(f, ch, x, y, sc, c) { const runs = f.g[ch]; if (runs) for (const r of runs) R(x + r[0] * sc, y + r[1] * sc, r[2] * sc, sc, c); }
  function txt(str, x, y, sc, c, f = F3, gap = sc) { for (const ch of str) { glyph(f, ch, x, y, sc, c); x += f.w * sc + gap; } }
  const tw = (str, sc = 1, f = F3, gap = sc) => str.length * (f.w * sc + gap) - gap;

  // ---------------------------------------------------------------- layout, in art pixels
  function layout() {
    canvas.style.width = canvas.style.height = '';
    const vw = canvas.clientWidth || innerWidth, vhh = canvas.clientHeight || innerHeight, port = vw < vhh * 0.8;
    s = Math.max(2, port ? Math.floor(vw / 124) : Math.round(Math.min(vw / 300, vhh / 185)));
    W = Math.ceil(vw / s); H = Math.ceil(vhh / s);
    canvas.width = rc.width = W; canvas.height = rc.height = H; canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
    const mx = port ? 4 : Math.max(10, Math.round(W * 0.045)), hw = port ? 15 : 17;
    const gap = W - 2 * mx >= words.name.length * 12 ? 2 : 1, per = Math.floor((W - 2 * mx + gap) / (10 + gap));
    const name = wrap(words.name, per).slice(0, 3), end = wrap(words.end, per).slice(0, name.length);
    const nameH = name.length * 14 + (name.length - 1) * 3;
    const tx = mx + 1, tagX = tx + 34, tag = balance(words.line, Math.max(12, Math.floor((W - tagX - mx - (port ? 0 : 24) + 1) / 4))).slice(0, 5);
    const sillY = H - (6 + nameH + 5 + tag.length * 7 + 2 + 7 + 3) - 3;
    const wy0 = Math.ceil(60 / s) + 2, wx0 = mx, wx1 = W - mx - hw, P = Math.max(7, Math.round(H / 22));
    const n = Math.ceil((sillY - wy0 - 5) / P), slat0 = wy0 + 5 + P / 2;
    let gi = 0; for (let i = 0; i < n - 1; i++) if (slat0 + (i + 0.5) * P < wy0 + (sillY - wy0) * 0.47) gi = i;
    const yName = sillY + 9, yTag = yName + nameH + 5, hx = wx1 - 1, hy = wy0 - 1;
    L = { port, mx, wx0, wx1, wy0, sillY, P, n, slat0, name, end, gap, tag, tx, tagX, yName, yTag, yHint: yTag + tag.length * 7 + 2, lx: tx + 14, lampTop: yName + nameH + 3,
      F0x: Math.round(wx0 + (wx1 - wx0) * (port ? 0.5 : 0.6)), F0y: slat0 + (gi + 0.5) * P, hx, hy, hw, hh: port ? 36 : 15,
      gx: port ? hx + 7.5 : hx + 5, gy: port ? hy + 12 : hy + 9, rx: port ? hx + 7.5 : hx + 12, ry: port ? hy + 27 : hy + 9, br: port ? 2.5 : 1.5 };
    L.ws = wsLayout(); makeSky(); g.imageSmoothingEnabled = false;
  }
  function wsLayout() {
    const port = W < H * 0.9, size = { blinds: [26, 42], pickypal: [36, 24], challenge: [14, 22], robot: [34, 15], next: [26, 18] }, it = {};
    const tiers = port ? [[Math.round(H * 0.36), ['next', 'challenge']], [Math.round(H * 0.55), ['pickypal']], [Math.round(H * 0.77), ['blinds', 'robot']]] : [[Math.round(H * 0.72), ['blinds', 'pickypal', 'challenge', 'robot', 'next']]];
    const printer = !port && W >= 300, x0 = port ? 12 : Math.round(W * (printer ? 0.19 : 0.06)), x1 = W - (port ? 12 : Math.round(W * 0.05));
    for (const [y, keys] of tiers) keys.forEach((q, i) => { const [w, h] = size[q]; it[q] = { x: Math.round(x0 + (x1 - x0) * (i + 0.5) / keys.length - w / 2), y, w, h }; });
    return { port, tiers, it, printer, x0, x1, by: tiers[tiers.length - 1][0] };
  }
  function makeSky() {
    const M = 48, w = W + 2 * M, h = H + 2 * M, hz = Math.round(L.F0y) + M;
    sky = document.createElement('canvas'); sky.width = w; sky.height = h;
    const q = sky.getContext('2d'), im = q.createImageData(w, h), d = im.data;
    const C = [[21, 19, 46], [34, 27, 72], [58, 37, 96], [98, 48, 110], [152, 60, 110], [208, 86, 100], [240, 132, 94], [255, 186, 120]];
    for (let y = 0; y < h; y++) {
      const v = Math.pow(clamp(y / hz, 0, 1), 1.5) * (C.length - 1.001), i = Math.floor(v), f = v - i;
      for (let x = 0; x < w; x++) { const c = C[Math.min(C.length - 1, i + (f > 0.62 || (f > 0.38 && ((x + y) & 1)) ? 1 : 0))], o = (y * w + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
    }
    q.putImageData(im, 0, 0);
    const rnd = rng(11); stars = [];
    for (let i = 0; i < 46; i++) stars.push([Math.floor(rnd() * w), Math.floor(rnd() * hz * 0.55), rnd() * 6.28, 0.6 + rnd() * 1.6]);
    const mxp = Math.round(w * 0.3), myp = Math.round(hz * 0.4); q.fillStyle = '#fff1c9';
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy <= 25 && (dx - 2.2) ** 2 + (dy + 1) ** 2 > 19) q.fillRect(mxp + dx, myp + dy, 1, 1);
    for (const [cx, cy, cw] of [[0.52, 0.45, 40], [0.8, 0.62, 30], [0.3, 0.72, 26]]) {
      const x = Math.round(w * cx), y = Math.round(hz * cy);
      q.fillStyle = '#7c426f'; q.fillRect(x, y, cw, 2); q.fillRect(x + Math.round(cw * 0.15), y - 2, Math.round(cw * 0.55), 2); q.fillRect(x + Math.round(cw * 0.3), y - 3, Math.round(cw * 0.25), 1);
      q.fillStyle = '#b85a78'; q.fillRect(x + Math.round(cw * 0.15), y - 2, Math.round(cw * 0.55), 1);
    }
  }

  // ---------------------------------------------------------------- the workshop (drawn in final-frame pixels)
  function iBlinds(x, y, t) {
    R(x, y - 2, 7, 2, '#a9743f'); R(x + 19, y - 2, 7, 2, '#a9743f'); R(x + 2, y - 40, 2, 38, '#8a5b36'); R(x + 22, y - 40, 2, 38, '#8a5b36'); R(x + 2, y - 42, 22, 2, '#a9743f');
    R(x + 4, y - 39, 18, 2, '#f4ecdc'); R(x + 19, y - 40, 4, 7, '#fff7e8'); R1(x + 20, y - 36, 1, 1, '#25B862'); R1(x + 21.6, y - 36, 1, 1, '#C2332B');
    const a = 0.5 + 0.5 * Math.sin(t * 0.8); for (let i = 0; i < 9; i++) R1(x + 5, y - 36 + i * 3.5, 14, 1 + 1.9 * a, '#efe4cf');
  }
  function iLaptop(x, y, t) {
    R(x, y - 2, 36, 2, '#c9c2bb'); R(x + 12, y - 2, 12, 1, '#a69f99'); R(x + 3, y - 24, 30, 22, '#2b2530'); R(x + 5, y - 22, 26, 18, '#fff3e4'); R(x + 5, y - 22, 26, 3, '#f7b7c3');
    R(x + 7, y - 17, 10, 6, '#bfe8d2'); R(x + 19, y - 17, 10, 6, '#cdbdf2'); R(x + 7, y - 9, 22, 2, '#eadfd2'); R(x + 7, y - 9, 22 * (0.2 + 0.75 * ((t * 0.12) % 1)), 2, '#7ccf9e'); R(x + 7, y - 6, 12, 1, '#d8cbbb');
  }
  function iPhone(x, y, t) {
    R(x + 1, y - 3, 12, 3, '#6a4330'); R(x + 2, y - 22, 10, 20, '#18141c'); R(x + 3, y - 20, 8, 16, '#241e2e');
    const f = Math.sin(t * 9) > 0 ? 1 : 0; R(x + 6, y - 19 - f, 2, 3 + f, '#ff9b3d'); R(x + 5, y - 17, 4, 3, '#ff7a2a'); R(x + 6, y - 16, 2, 2, '#ffe08a');
    for (let i = 0; i < 9; i++) R(x + 4 + (i % 3) * 2.2, y - 12 + ((i / 3) | 0) * 2.2, 1.4, 1.4, i < 6 ? '#59d08a' : '#4a4358');   // the streak grid, stopped short
  }
  function iRobot(x, y, t) {
    const a = Math.sin(t * 5) > 0 ? 1 : 0, b = 1 - a, D = '#22272c', M = '#2f363c';
    R(x + 7, y - 8 - b, 5, 2, D); R(x + 7, y - 8 - b, 2, 8 - b, D); R(x + 5, y - 2 - 2 * b, 5, 2, D); R(x + 22, y - 8 - a, 5, 2, D); R(x + 25, y - 8 - a, 2, 8 - a, D); R(x + 24, y - 2 - 2 * a, 5, 2, D);
    R(x + 3, y - 10 - a, 8, 2, M); R(x + 2, y - 10 - a, 2, 10 - a, M); R(x, y - 2 - 2 * a, 5, 2, M); R(x + 23, y - 10 - b, 8, 2, M); R(x + 30, y - 10 - b, 2, 10 - b, M); R(x + 29, y - 2 - 2 * b, 5, 2, M);
    R(x + 11, y - 13, 12, 8, '#2a3035'); R(x + 12, y - 15, 10, 2, '#39414a'); R(x + 13, y - 11, 8, 4, '#0c0f11');
    const e = (t % 3.7) < 0.14 ? 1 : 2; R(x + 14, y - 10, 2, e, '#35e0d0'); R(x + 18, y - 10, 2, e, '#35e0d0');
  }
  function iNext(x, y) {
    R(x + 12, y - 18, 12, 8, '#1f7a4d'); R(x + 14, y - 16, 5, 3, '#22282c'); R(x + 20, y - 16, 2, 2, '#b9c2c7'); R(x + 12, y - 11, 12, 1, '#d8b24a');
    R(x, y - 12, 22, 12, '#c18a55'); R(x, y - 12, 22, 2, '#d7a26a'); R(x + 13, y - 12, 4, 12, '#e4c9a0'); txt('V2', x + 3, y - 8, 1, '#5b3a29');
  }
  function iPrinter(x, y, t) {
    R(x, y - 30, 2, 30, '#22282c'); R(x + 28, y - 30, 2, 30, '#22282c'); R(x, y - 32, 30, 3, '#2c3338'); R(x, y - 3, 30, 3, '#2c3338'); R(x + 4, y - 6, 22, 2, '#8d979c');
    R(x + 10, y - 12, 10, 6, '#e08a2e'); R(x + 10, y - 12, 10, 1, '#f3a64b');
    const hx = x + 6 + 14 * (0.5 + 0.5 * Math.sin(t * 2.2)); R(x + 2, y - 17, 26, 1, '#59636a'); R(hx, y - 19, 5, 5, '#3a4248'); R1(hx + 2, y - 14, 1, 1, '#ffd27a');
    disc(x + 15, y - 37, 5, '#e08a2e'); disc(x + 15, y - 37, 2, '#3a2a2e');
  }
  function workshop(t, full) {
    const Q = L.ws, by = Q.by, B = 3000, I = Q.it;
    R(-B, -B, 2 * B, 2 * B, '#4a2f36');
    const sy = Math.ceil(64 / s) + 2, sag = x => 5 * Math.sin((x / W) * Math.PI * 3) ** 2;                    // string lights
    for (let x = -9; x < W + 9; x += 3) R(x, sy + sag(x), 3, 1, '#2b1a20');
    for (let x = 4, i = 0; x < W; x += 13, i++) R(x, sy + 1 + sag(x), 2, 2, Math.sin(t * 1.3 + i * 2.1) > -0.7 ? '#ffd27a' : '#b98a4e');
    const pg = Q.port ? [10, Math.round(H * 0.11), W - 20, Math.round(H * 0.12)] : [Math.round(W * 0.39), Math.round(H * 0.2), Math.round(W * 0.27), Math.round(H * 0.3)];
    R(pg[0], pg[1], pg[2], pg[3], '#a47a52'); R(pg[0], pg[1], pg[2], 1, '#bf9366'); R(pg[0], pg[1] + pg[3] - 1, pg[2], 1, '#7d5a3c');                // pegboard and tools
    if (k > 0.7) for (let y = pg[1] + 3; y < pg[1] + pg[3] - 2; y += 4) for (let x = pg[0] + 3; x < pg[0] + pg[2] - 2; x += 4) R(x, y, 1, 1, '#84603f');
    const tx = pg[0] + 6, ty = pg[1] + 5;
    R(tx + 2, ty + 3, 2, 13, '#5b3a29'); R(tx, ty, 7, 4, '#9aa3a8'); R(tx + 13, ty + 2, 2, 14, '#b9c2c7'); R(tx + 12, ty, 4, 3, '#b9c2c7'); R(tx + 13, ty, 2, 1, '#a47a52');
    R(tx + 22, ty, 3, 7, '#c2332b'); R(tx + 23, ty + 7, 1, 9, '#b9c2c7'); R(tx + 31, ty, 1, 8, '#b9c2c7'); R(tx + 33, ty, 1, 8, '#b9c2c7'); R(tx + 30, ty + 8, 2, 7, '#2f6f73'); R(tx + 33, ty + 8, 2, 7, '#2f6f73');
    disc(tx + 46, ty + 6, 4, '#d9a441'); disc(tx + 46, ty + 6, 1.6, '#a47a52'); R(tx + 56, ty, 2, 16, '#d8d2c4');
    const bp = Q.port ? [W - 46, Math.round(H * 0.6)] : [Math.round(W * 0.72), Math.round(H * 0.22)];                                                  // the robot drawing, pinned up
    R(bp[0], bp[1], 32, 22, '#2d5b88'); R(bp[0] + 1, bp[1] + 1, 30, 20, '#356a9c'); const bl = '#cfe3f5';
    R(bp[0] + 10, bp[1] + 7, 12, 1, bl); R(bp[0] + 10, bp[1] + 12, 12, 1, bl); R(bp[0] + 10, bp[1] + 7, 1, 6, bl); R(bp[0] + 21, bp[1] + 7, 1, 6, bl);
    R(bp[0] + 4, bp[1] + 9, 6, 1, bl); R(bp[0] + 4, bp[1] + 9, 1, 7, bl); R(bp[0] + 22, bp[1] + 9, 6, 1, bl); R(bp[0] + 27, bp[1] + 9, 1, 7, bl); R(bp[0] + 4, bp[1] + 18, 24, 1, '#8fb4d6'); R(bp[0] + 15, bp[1] - 1, 2, 2, '#c2332b');
    if (!Q.port) {                                                                                                                                      // shelf: filament, books, a plant
      const sx = Math.round(W * 0.07), sw = Math.round(W * 0.24), sh = Math.round(H * 0.38);
      R(sx, sh, sw, 3, '#a9743f'); R(sx, sh, sw, 1, '#c79457'); R(sx + 3, sh + 3, 2, 5, '#7a4e32'); R(sx + sw - 5, sh + 3, 2, 5, '#7a4e32');
      disc(sx + 9, sh - 7, 7, '#e08a2e'); disc(sx + 9, sh - 7, 2.5, '#3a2a2e'); disc(sx + 25, sh - 7, 7, '#5fb0a3'); disc(sx + 25, sh - 7, 2.5, '#3a2a2e');
      R(sx + 37, sh - 12, 3, 12, '#8a3d3a'); R(sx + 40, sh - 14, 4, 14, '#d9a441'); R(sx + 44, sh - 11, 3, 11, '#2f6f73'); R(sx + 47, sh - 13, 3, 13, '#e9dcc8');
      R(sx + 55, sh - 6, 8, 6, '#b5613c'); R(sx + 58, sh - 15, 2, 9, '#4f8a5b'); R(sx + 55, sh - 11, 2, 5, '#3d6a4d'); R(sx + 61, sh - 12, 2, 6, '#3d6a4d');
    }
    const lx = W / 2, ly = Q.port ? pg[1] + pg[3] + 2 : Math.round(H * 0.1);                                                                             // pendant lamp
    R(lx - 0.5, -B, 1, B + ly, '#1d1318'); for (let i = 0; i < 7; i++) R(lx - 3 - i * 1.2, ly + i, 6 + i * 2.4, 1, i < 1 ? '#3d8a8e' : '#2f6f73'); R(lx - 2, ly + 7, 4, 2, '#fff1c9');
    Q.tiers.forEach(([y], i) => { if (i < Q.tiers.length - 1) { R(Q.x0 - 6, y, Q.x1 - Q.x0 + 12, 3, '#a9743f'); R(Q.x0 - 6, y, Q.x1 - Q.x0 + 12, 1, '#c79457'); R(Q.x0 + 2, y + 3, 2, 6, '#7a4e32'); R(Q.x1 - 4, y + 3, 2, 6, '#7a4e32'); } });
    R(-B, by, 2 * B, 4, '#b07a48'); R(-B, by, 2 * B, 1, '#d29c60'); R(-B, by + 4, 2 * B, 12, '#7a4e32'); R(-B, by + 16, 2 * B, 2, '#33202a'); R(-B, by + 18, 2 * B, B, '#2b1b23');   // the bench
    R(Q.x0 - 4, by + 16, 4, B, '#5f3d2c'); R(Q.x1, by + 16, 4, B, '#5f3d2c');
    if (Q.printer) iPrinter(14, by, t);
    iBlinds(I.blinds.x, I.blinds.y, t); iLaptop(I.pickypal.x, I.pickypal.y, t); iPhone(I.challenge.x, I.challenge.y, t); iRobot(I.robot.x, I.robot.y, t); iNext(I.next.x, I.next.y);
    R(I.pickypal.x + 39, I.pickypal.y - 6, 5, 6, '#f1e3c6'); R(I.pickypal.x + 44, I.pickypal.y - 5, 1, 3, '#f1e3c6');                                    // a mug by the laptop
    const fl = 1 + 0.01 * Math.sin(t * 6.1), Rw = Math.max(W, H) * fl;
    for (const [r, a] of [[0.85, 0.03], [0.7, 0.03], [0.56, 0.035], [0.44, 0.04], [0.33, 0.045], [0.23, 0.05], [0.14, 0.06], [0.07, 0.08]]) glow(lx, ly + 8, Rw * r, '255,160,84', a);
    glow(I.pickypal.x + 18, I.pickypal.y - 13, 15, '255,236,214', 0.06);
    if (!full) return;
    for (const q in I) {                                                                                                                                // labels and the highlight
      const it = I[q], lab = LABEL[q] || q.toUpperCase(), w = tw(lab), x = Math.round(it.x + it.w / 2 - w / 2), y = it.y + (it.y === by ? 6 : 5), hot = S.hot === q;
      R(x - 2, y, w + 4, 7, hot ? '#25B862' : '#f1e3c6'); txt(lab, x, y + 1, 1, hot ? '#08240f' : '#3a2530');
      if (hot) { const x0 = it.x - 3, y0 = it.y - it.h - 3, x1 = it.x + it.w + 3, c = '#ffe9c2'; R(x0, y0, 4, 1, c); R(x0, y0, 1, 4, c); R(x1 - 4, y0, 4, 1, c); R(x1 - 1, y0, 1, 4, c); }
    }
    balance(touch ? 'TAP A PROJECT OR KEEP SCROLLING' : 'PICK A PROJECT OR KEEP SCROLLING', Math.floor((W - 12) / 4)).forEach((ln, i) => txt(ln, Math.round((W - tw(ln)) / 2), by + 24 + i * 7, 1, '#9a7c6e'));
  }

  // The same sprites again, further down the page: each project section opens with its own, under a wall lamp.
  const ITEM = { blinds: [iBlinds, 26], pickypal: [iLaptop, 36], challenge: [iPhone, 14], robot: [iRobot, 34], next: [iNext, 26] };
  const icons = [...document.querySelectorAll('canvas[data-icon]')].map(c => { c.width = 48; c.height = 62; return { c, x: c.getContext('2d'), it: ITEM[c.dataset.icon], on: false }; });
  const iconSeen = new IntersectionObserver(es => es.forEach(e => { const o = icons.find(i => i.c === e.target); if (o) o.on = e.isIntersecting; }), { rootMargin: '120px' });
  icons.forEach(o => iconSeen.observe(o.c));
  function drawIcons(t) {
    for (const o of icons) {
      if (!o.on || !o.it) continue;
      g = o.x; g.clearRect(0, 0, 48, 62); ox = oy = 0; k = 1;
      R(5, 3, 2, 7, '#1d1318'); R(7, 6, 15, 1, '#1d1318'); R(21, 6, 1, 4, '#1d1318');
      for (let i = 0; i < 4; i++) R(19 - i, 10 + i, 5 + 2 * i, 1, i ? '#2f6f73' : '#3d8a8e');
      R(20, 14, 3, 2, '#fff1c9'); o.it[0](Math.round((48 - o.it[1]) / 2), 62, t);
    }
    g = gm;
  }

  // ---------------------------------------------------------------- the campus at dusk
  function bricks(kb, X0, X1, Y0, Y1) {
    if (kb < 5) return;
    const ch = 0.62, bw = 1.7, th = Math.max(1, Math.round(0.07 * kb));
    const xa = Math.max(X0, -Fx / kb), xb = Math.min(X1, (W - Fx) / kb), ya = Math.max(Y0, -Fy / kb), yb = Math.min(Y1, (H - Fy) / kb); if (xa >= xb || ya >= yb) return;
    const sx0 = Math.round(Fx + xa * kb), sx1 = Math.round(Fx + xb * kb); g.fillStyle = `rgba(46,19,31,${(0.42 * smooth(5, 9, kb)).toFixed(3)})`;
    for (let j = Math.floor(ya / ch); j * ch < yb; j++) {
      const y = Math.round(Fy + j * ch * kb), hgt = Math.round(Fy + (j + 1) * ch * kb) - y, off = (j & 1) * bw / 2; g.fillRect(sx0, y, sx1 - sx0, th);
      for (let i = Math.floor((xa - off) / bw); i * bw + off < xb; i++) { const x = Math.round(Fx + (i * bw + off) * kb); if (x >= sx0 && x < sx1) g.fillRect(x, y, th, hgt); }
    }
  }
  function hall(t, kb) {
    const X0 = -89, X1 = 33, top = -27, gy = 15, cx = -28, CR = '#eadcc6', lit = ['#ffcf70', '#ffb95e', '#ffe3a0'];
    const win = (x, y, h, c) => { if (kb > 2.2) { R(x - 2.2, y - h / 2 - 0.4, 4.4, h + 0.8, CR); R(x - 2.5, y + h / 2 + 0.4, 5, 0.5, '#cdbfae'); } R1(x - 1.8, y - h / 2, 3.6, h, c); if (kb > 3.5) { R(x - 0.15, y - h / 2, 0.3, h, CR); R(x - 1.8, y - 0.15, 3.6, 0.3, CR); } };
    const flank = (xa, xb, ty) => { R(xa, ty - 4, xb - xa, 4, '#332d4a'); R(xa, ty, xb - xa, gy - ty, '#6a3441'); R(xa, ty, xb - xa, 1.5, '#cdbfae'); for (let x = xa + 6, i = 0; x < xb - 3; x += 9, i++) for (const y of [ty + 8, ty + 20, ty + 30]) if (y < gy - 3) win(x, y, 5, (i * 7 + y * 3) % 7 < 1 ? lit[i % 3] : '#2a2748'); };
    flank(-182, -97, -22); flank(46, 150, -24);
    R(X0 + 3, top - 6, X1 - X0 - 6, 6, '#3a3352'); R(X0 + 3, top - 6, X1 - X0 - 6, 1, '#4c4468');                                   // roof, cupola
    disc(cx, top - 18, 5, '#d8cbb8'); R(cx - 5.5, top - 18, 11, 12, CR); R(cx - 6.5, top - 18.5, 13, 1, '#fff3de'); R(cx - 2, top - 15, 4, 6, '#ffd27a'); R1(cx - 0.3, top - 27, 0.6, 4, CR);
    R(X0, top, X1 - X0, gy - top, '#7b3d46'); bricks(kb, X0, X1, top, gy);
    R(X0, gy - 3, X1 - X0, 3, '#5c2d39'); R(X0 - 1, top - 1, X1 - X0 + 2, 2, CR);
    R(cx - 21, -21, 42, 33, '#532935'); R(cx - 3, 0, 6, 12, '#24161f'); R(cx - 3, -3.5, 6, 2.5, '#ffcf70');                         // portico
    R(cx - 22, -24, 44, 3, CR); for (let i = 0; i < 6; i++) R(cx - 22 + i * 3.7, -25 - i, 44 - i * 7.4, 1, i ? CR : '#fff3de');
    for (const x of [cx - 20, cx - 9, cx + 7, cx + 18]) { R1(x, -21, 2, 33, '#f3e8d6'); R(x + 1.4, -21, 0.6, 33, '#cdbfae'); }
    R(cx - 24, 12, 48, 1.5, '#c9bdb0'); R(cx - 26, 13.5, 52, 1.5, '#a89c90');
    for (const x of [-83, -74, -65, -56, 0, 9, 18, 27]) for (const y of [-15, 0, 10.5]) {
      if (x === 0 && y === 0) continue; const h = y > 5 ? 4.4 : 5.4, v = Math.floor(Math.abs(x * 13 + y * 7 + 300)) % 11;
      win(x, y, h, x === -65 && y === -15 ? (Math.sin(t * 3.1) > 0.2 ? '#8fb7e8' : '#7aa0d4') : v < 2 ? lit[v % 3] : '#2a2748');
    }
    const pulse = 0.85 + 0.15 * Math.sin(t * 2), far = 1 - smooth(2.5, 6, kb);                                                      // the one window that matters
    glow(0, 0, 8, '255,190,110', 0.1 * pulse * far); glow(0, 0, 4.5, '255,200,120', 0.16 * pulse * far);
    if (kb > 2.2) { R(-2.3, -3.2, 4.6, 6.4, '#f3e6cf'); R(-2.6, 3.1, 5.2, 0.6, '#cdbfae'); }
    const x0 = Math.round(Fx - 1.8 * kb), x1 = Math.max(x0 + 1, Math.round(Fx + 1.8 * kb)), y0 = Math.round(Fy - 2.7 * kb), y1 = Math.max(y0 + 1, Math.round(Fy + 2.7 * kb));
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    const wk = (DWS - ZEND) / (DWS - z); k = wk; ox = Fx - W / 2 * wk; oy = Fy - H / 2 * wk; workshop(t, false);
    const a = 1 - smooth(0.05, 0.22, wk); if (a > 0) { g.globalAlpha = a; g.fillStyle = pulse > 0.9 ? '#ffd784' : '#ffcf70'; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.globalAlpha = 1; }
    g.restore(); k = kb; ox = Fx; oy = Fy;
  }
  function campus(t, kb) {
    const dx = Math.round(Fx - L.F0x) - 48, dy = Math.round(Fy - L.F0y) - 48;
    if (kb < 9) {
      g.fillStyle = '#15132e'; g.fillRect(0, 0, W, H); g.drawImage(sky, dx, dy);
      for (const st of stars) if (Math.sin(t * st[3] + st[2]) > -0.3) { g.fillStyle = st[3] > 1.6 ? '#fff1c9' : '#b9b3d8'; g.fillRect(st[0] + dx, st[1] + dy, 1, 1); }
      k = 200 / (200 - z); ox = Fx; oy = Fy; const rnd = rng(5);                                                                    // far tree line
      for (let x = -300; x < 300; x += 6) { const h = 3 + rnd() * 6; R(x, 6 - h, 7, h + 2, '#2a2342'); }
    } else { g.fillStyle = '#7b3d46'; g.fillRect(0, 0, W, H); }
    for (let y = Math.max(0, Math.round(Fy) + 1); y < H; y++) {                                                                     // lawn, mown in bands, and the path
      const dz = G / (y + 0.5 - Fy), d = z + dz; g.fillStyle = (Math.floor(d / 7) & 1) ? '#27463c' : '#2c4e41'; g.fillRect(0, y, W, 1);
      if (d < DB) { const kk = FP / dz, xc = Fx + PATHX * kk, hw = 1.6 * kk; g.fillStyle = (Math.floor(d / 3.5) & 1) ? '#b59a78' : '#a88d6e'; g.fillRect(Math.round(xc - hw), y, Math.max(1, Math.round(2 * hw)), 1); }
    }
    k = kb; ox = Fx; oy = Fy; hall(t, kb);
    const wd = 52 + 7 * Math.sin(t * 0.07);
    for (const o of [...OBJ, [PATHX + 0.5, wd, -1]].sort((a, b) => b[1] - a[1])) {
      const dz = o[1] - z; if (dz < 1.5) continue;
      k = FP / dz; ox = Fx + o[0] * k; oy = Fy + HC * k;
      if (o[2] > 0) { const c = TREES[o[2] - 1], q = o[3]; R1(-0.3, -3.2, 0.6, 3.2, '#3a2630'); disc(0, -6.2, 3.3 * q, c[0]); disc(-2.1 * q, -4.9, 2.3 * q, c[0]); disc(2.2 * q, -5.1, 2.4 * q, c[0]); disc(-0.6 * q, -7.1, 2.3 * q, c[1]); disc(-1.3 * q, -7.9, 1.2 * q, c[2]); }
      else if (o[2] === 0) { R1(-0.07, -4, 0.14, 4, '#231b2b'); R1(-0.3, -4.6, 0.6, 0.6, '#ffe2a0'); glow(0, -4.3, 1.9, '255,180,100', 0.14); glow(0, -4.3, 0.9, '255,200,120', 0.2); }
      else { R1(-0.25, -1.5, 0.5, 1.5, '#2b2145'); R1(-0.2, -1.9, 0.4, 0.4, '#e8c3a0'); }                                           // someone walking the path
    }
  }

  // ---------------------------------------------------------------- the room: wall, blind, sill, lamp and the lettering
  function room(t, theta, endMode, p) {
    const fade = 1 - smooth(0, 0.1, p), par = reduce || touch ? 0 : (0.5 - S.ptrX) * fade;
    const kr = 1 / (1 - z), { wx0, wx1, wy0, sillY, P, hx, hy, hw, hh } = L, ww = wx1 - wx0, B = 4000, WALL = '#241925';
    g = gr; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    k = kr; ox = Fx - L.F0x * kr + Math.round(par * 3); oy = Fy - L.F0y * kr;
    R(-B, -B, 2 * B, B + wy0, WALL); R(-B, sillY, 2 * B, B, WALL); R(-B, wy0, B + wx0, sillY - wy0, WALL); R(wx1, wy0, B, sillY - wy0, WALL);
    R(wx0 - 2, wy0 - 2, ww + 4, 2, '#3c2b34'); R(wx0 - 2, wy0, 2, sillY - wy0, '#3c2b34'); R(wx1, wy0, 2, sillY - wy0, '#33242d');
    const a = Math.abs(Math.sin(theta)), band = Math.max(1, P * 1.16 * a), part = a < 0.9;                                           // the slats
    for (let i = 0; i < L.n; i++) {
      const top = L.slat0 + i * P - band / 2; R1(wx0, top, ww, band, band < 1.6 ? '#5f4c57' : '#3a2b35');
      if (band >= 2) { R(wx0, top + band - 1, ww, 1, '#281d26'); if (part) R(wx0, theta > 0 ? top : top + band - 1, ww, 1, '#b56f5e'); }
    }
    R1(wx0 + ww * 0.27, wy0 + 5, 1, sillY - wy0 - 5, '#54434e'); R1(wx0 + ww * 0.73, wy0 + 5, 1, sillY - wy0 - 5, '#54434e');
    R(wx0 - 1, wy0, ww + 2, 5, '#4f3e49'); R(wx0 - 1, wy0, ww + 2, 1, '#6c5864'); R(wx0 - 1, wy0 + 4, ww + 2, 1, '#33262e');           // head rail, then the button box beside it
    R(hx, hy, hw, hh, '#5b4a54'); R(hx, hy, hw, 1, '#7a6672'); R(hx + hw - 1, hy, 1, hh, '#43363f'); R(hx, hy + hh - 1, hw, 1, '#43363f');
    const btn = (x, y, c, d, hi, pr) => { const r = L.br; R(x - r - 0.5, y - r - 0.5, 2 * r + 1, 2 * r + 1, '#1c151b'); R(x - r, y - r, 2 * r, 2 * r, pr > 0.3 ? d : c); if (pr <= 0.3) R1(x - r, y - r, 1, 1, hi); };
    btn(L.gx, L.gy, '#25B862', '#17723c', '#8ff0b6', S.pg); btn(L.rx, L.ry, '#C2332B', '#7d1f1a', '#f08a80', S.pr);
    R1((L.gx + L.rx) / 2 - 0.5, Math.max(L.gy, L.ry) + (L.port ? 6 : 3.5), 1, 1, S.led > 0.5 ? '#9fd8ff' : '#2a3442');
    R(wx0 - 4, sillY, ww + hw + 8, 2, '#6a4c50'); R(wx0 - 4, sillY + 2, ww + hw + 8, 1, '#3a2830');                                    // sill, and what lives on it
    const bx = wx0 + Math.round(ww * 0.06), px = wx0 + Math.round(ww * 0.82), cy = '#35e0d0';
    R(bx, sillY - 3, 16, 3, '#8a3d3a'); R(bx + 1, sillY - 6, 14, 3, '#2f6f73'); R(bx, sillY - 8, 13, 2, '#d9a441'); R(bx + 4, sillY - 13, 5, 5, '#f1e3c6'); R(bx + 9, sillY - 12, 1, 3, '#f1e3c6');
    for (let i = 0; i < 3; i++) R1(bx + 5 + ((i + Math.floor(t * 1.6)) % 2), sillY - 15 - i * 2, 1, 1, 'rgba(241,227,198,.45)');
    R(bx + 22, sillY - 5, 6, 3, '#2a3035'); R1(bx + 23, sillY - 4, 1, 1, cy); R1(bx + 26, sillY - 4, 1, 1, cy); R(bx + 20, sillY - 4, 2, 1, '#22272c'); R(bx + 20, sillY - 4, 1, 4, '#22272c'); R(bx + 28, sillY - 4, 2, 1, '#22272c'); R(bx + 29, sillY - 4, 1, 4, '#22272c');
    R(px, sillY - 6, 8, 6, '#b5613c'); R(px - 1, sillY - 7, 10, 2, '#cf7a4d'); R(px + 3, sillY - 16, 2, 9, '#4f8a5b'); R(px, sillY - 12, 2, 5, '#3d6a4d'); R(px + 6, sillY - 14, 2, 7, '#3d6a4d'); R(px - 2, sillY - 10, 2, 3, '#4f8a5b'); R(px + 8, sillY - 11, 2, 4, '#4f8a5b');
    // the lamp sits nearer than the wall, so it is placed with its own scale; its light is banded, and breathes
    const kf = z < 0.56 ? 0.6 / (0.6 - z) : 0, fox = Fx - L.F0x * kf + Math.round(par * 7), foy = Fy - L.F0y * kf;
    const lsx = fox + L.lx * kf, lsy = foy + (L.lampTop + 5) * kf, lit = S.lamp * (1 - smooth(0.3, 0.55, z));
    const fl = 1 + 0.012 * Math.sin(t * 7.3) + 0.008 * Math.sin(t * 12.7 + 1), Rg = Math.max(W, H) * 0.6 * (kf || 1) * fl, tr = [ox, oy, k];
    ox = oy = 0; k = 1;
    for (const [r, al] of [[1, 0.035], [0.84, 0.035], [0.68, 0.04], [0.54, 0.045], [0.41, 0.05], [0.3, 0.055], [0.2, 0.065], [0.12, 0.075], [0.06, 0.09]]) glow(lsx, lsy, Rg * r, '255,158,78', al * lit * (0.95 + 0.05 * Math.sin(t * 5.1)), 'source-atop');
    [ox, oy, k] = tr;
    const shade = (sx, sy) => Math.round(clamp((clamp(1.1 - Math.hypot(sx - lsx, sy - lsy) / Rg, 0.36, 1)) * lit + 0.36 * (1 - lit), 0, 1) * 8);
    let y = L.yName;
    for (const ln of endMode ? L.end : L.name) {
      let x = L.tx;
      for (const ch of ln) {
        const sx = ox + (x + 5) * k, sy = oy + (y + 7) * k;
        if (lit > 0.05) { g.globalAlpha = 0.6 * lit; glyph(F5, ch, x + (sx > lsx + 8 ? 1 : sx < lsx - 8 ? -1 : 0), y - 1, 2, '#0e0910'); g.globalAlpha = 1; }   // each letter throws its shadow away from the lamp
        glyph(F5, ch, x, y, 2, RAMP[shade(sx, sy)]); x += 10 + L.gap;
      }
      y += 17;
    }
    if (!endMode) {
      L.tag.forEach((ln, i) => { let x = L.tagX; const yy = L.yTag + i * 7; for (const ch of ln) { glyph(F3, ch, x, yy, 1, RAMP[Math.max(3, shade(ox + x * k, oy + yy * k) - 1)]); x += 4; } });
      if (fade > 0.02) { g.globalAlpha = fade; txt('SCROLL TO GO THROUGH', L.tagX, L.yHint, 1, RAMP[2]); if (Math.sin(t * 3) > -0.2) glyph(F3, '>', L.tagX + 84, L.yHint + (Math.sin(t * 3) > 0.5 ? 1 : 0), 1, RAMP[4]); g.globalAlpha = 1; }
    }
    if (kf) {
    k = kf; ox = fox; oy = foy;
    const lx = L.lx, ly = L.lampTop, on = S.lamp, c0 = lerpC('#8f715f', '#ffe7ae', on), c1 = lerpC('#7f6356', '#ffc871', on), c2 = lerpC('#6b534d', '#e89545', on);
    R(lx - 1, ly + 16, 2, 400, '#8a6a3a'); R(lx - 3, ly + 16, 6, 2, '#6f5430');
    for (let i = 0; i < 16; i++) { const h = 8 + i * 0.4; R(lx - h, ly + i, 2 * h, 1, c2); R(lx - h + 3, ly + i, 2 * h - 6, 1, c1); R(lx - h + 7, ly + i, 2 * h - 14, 1, c0); }
    R(lx - 8, ly, 16, 1, lerpC('#5c4741', '#c97b34', on)); R(lx - 14, ly + 15, 28, 1, lerpC('#5c4741', '#fff1c9', on));
    R(lx + 9, ly + 16, 1, 6, '#c9a35a'); R(lx + 8.5, ly + 22, 2, 2, '#e6c37a');
    if (!L.port) {                                                                                                                  // pencil cup at the other corner
      const cx = W - L.mx - 14, cb = H - 11; R(cx + 2, cb - 11, 2, 12, '#e0902e'); R(cx + 2, cb - 13, 2, 2, '#f1e3c6'); R(cx + 6, cb - 14, 2, 15, '#c2332b'); R(cx + 9, cb - 9, 2, 10, '#5fb0a3'); R(cx + 9, cb - 11, 2, 2, '#f1e3c6');
      R(cx, cb, 13, 60, '#34525c'); R(cx, cb, 13, 1, '#4d7682'); R(cx, cb, 2, 60, '#3f626d');
    }
    }
    g = gm; g.drawImage(rc, 0, 0);
  }

  // ---------------------------------------------------------------- input
  const manual = (target, e) => { S.mode = 'manual'; S.target = target; S.lastInput = S.t; S.manualUntil = S.t + 9; S.endManual = true; S.lock = e && e.clientX ? [e.clientX, e.clientY] : null; };
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return; S.ptrX = e.clientX / innerWidth; S.ptrY = e.clientY / innerHeight;
    if (S.lock && Math.hypot(e.clientX - S.lock[0], e.clientY - S.lock[1]) < 90) return; S.lock = null; S.lastInput = S.t; S.mode = 'pointer';
  }, { passive: true });
  heroSection.addEventListener('click', e => { if (touch && scrollY < 40 && !e.target.closest('button,a')) manual(Math.abs(S.target) < 0.5 ? CLOSED : 0.05); });
  btnOpen.addEventListener('click', e => { S.pg = 1; manual(0, e); });
  btnClose.addEventListener('click', e => { S.pr = 1; manual(CLOSED, e); });
  btnLamp.addEventListener('click', () => { S.lampT = 1 - S.lampT; });
  ws.querySelectorAll('a').forEach(a => { const on = () => { S.hot = a.dataset.k; }, off = () => { if (S.hot === a.dataset.k) S.hot = null; }; a.addEventListener('pointerenter', on); a.addEventListener('focus', on); a.addEventListener('pointerleave', off); a.addEventListener('blur', off); });

  // ---------------------------------------------------------------- scroll, camera, frame
  let heroLen = 1, endTop = 1e9, vh = 1, lw = 0, lh = 0, raf = 0, last = performance.now();
  function measure() { vh = innerHeight; heroLen = Math.max(1, heroSection.offsetHeight - vh); endTop = endSection.getBoundingClientRect().top + scrollY; }
  const zone = () => { const y = scrollY; return y < heroLen + vh ? 'hero' : y + vh > endTop ? 'end' : 'none'; };
  function place() {
    const at = (el, x, y) => { el.style.left = x * s + 'px'; el.style.top = y * s + 'px'; };
    at(btnOpen, L.gx, L.gy); at(btnClose, L.rx, L.ry); at(btnLamp, L.lx, L.lampTop + 9);
    ws.querySelectorAll('a').forEach(a => { const it = L.ws.it[a.dataset.k]; if (!it) return; at(a, it.x - 3, it.y - it.h - 3); a.style.width = (it.w + 6) * s + 'px'; a.style.height = (it.h + 16) * s + 'px'; });
    endUi.style.setProperty('--ex', L.tagX * s + 'px'); endUi.style.setProperty('--ey', L.yTag * s + 'px');
  }
  function resize() { const w = innerWidth, h = innerHeight; if (w === lw && Math.abs(h - lh) < 90) return; lw = w; lh = h; layout(); place(); measure(); }
  function camera(p) {
    if (reduce) z = p < 0.5 ? 0 : ZEND;
    else if (p < 0.1) z = 0;
    else if (p < 0.3) { const u = (p - 0.1) / 0.2; z = 1.15 * u * u; }
    else if (p < 0.94) { const u = (p - 0.3) / 0.64, e = mix(u, u * u * (3 - 2 * u), 0.6); z = DB - 78.85 * Math.pow(0.45 / 78.85, e); }
    else z = ZEND;
    const e = reduce ? (p < 0.5 ? 0 : 1) : smooth(0.1, 0.55, p); Fx = mix(L.F0x, W / 2, e); Fy = mix(L.F0y, H / 2, e);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; S.t += dt;
    const t = S.t, zn = zone();
    drawIcons(reduce ? 1 : t);
    if (zn === 'none') { S.zoneWas = zn; if (!buttons.hidden) buttons.hidden = true; if (!ws.hidden) ws.hidden = true; endUi.style.visibility = 'hidden'; return; }
    const y = scrollY, p = zn === 'hero' ? clamp(y / heroLen, 0, 1) : 0, q = zn === 'end' ? clamp((y + vh - endTop) / vh, 0, 1) : 0;
    if (zn === 'hero') {                                           // what the motor is asked to do
      if (S.zoneWas === 'end') S.endManual = false;
      if (reduce) S.target = 0.5;
      else if (S.mode === 'manual' && t < S.manualUntil) { /* hold what the button asked for */ }
      else if (S.mode === 'pointer' && t - S.lastInput < 5) S.target = (S.ptrY - 0.5) * 2 * CLOSED * 1.06;
      else { S.mode = null; S.target = mix(0.3, 1.2, 0.5 + 0.5 * Math.cos(t * 0.45)); }
    } else {
      if (S.zoneWas !== 'end') { S.endManual = false; S.mode = null; }
      if (!S.endManual) S.target = mix(0.02, CLOSED, smooth(0.25, 0.92, q));
    }
    S.zoneWas = zn;
    const err = clamp(S.target, -CLOSED, CLOSED) - S.theta, rate = zn === 'end' && !S.endManual ? 9 : S.mode === null ? 0.5 : 2.1;
    S.theta += clamp(err * 6.5, -rate, rate) * dt;                 // a geared motor: rate-limited, with a soft landing
    S.led += ((Math.abs(err) > 0.03 && S.mode === 'manual' ? 1 : 0) - S.led) * Math.min(1, dt * 10);
    S.pg = Math.max(0, S.pg - dt * 4); S.pr = Math.max(0, S.pr - dt * 4); S.lamp += (S.lampT - S.lamp) * Math.min(1, dt * 7);
    const theta = mix(S.theta, 0, smooth(0, 0.1, p));              // scrolling opens the slats, whatever the motor is doing
    camera(p);

    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const kb = DB / (DB - z), inside = 1.8 * kb > Math.max(Fx, W - Fx) + 1 && 2.7 * kb > Math.max(Fy, H - Fy) + 1;
    if (inside) { const wk = (DWS - ZEND) / (DWS - z); k = wk; ox = Fx - W / 2 * wk; oy = Fy - H / 2 * wk; workshop(t, wk > 0.985); }
    else campus(t, kb);
    if (z < 0.975) room(t, theta, zn === 'end', p);

    const showB = (zn === 'hero' && p < 0.03) || (zn === 'end' && q > 0.9); if (buttons.hidden === showB) buttons.hidden = !showB;
    const showW = zn === 'hero' && p > 0.955; if (ws.hidden === showW) { ws.hidden = !showW; if (!showW) S.hot = null; }
    if (zn === 'end') { endUi.style.visibility = 'visible'; endUi.style.opacity = smooth(0.5, 0.92, q).toFixed(2); endUi.style.pointerEvents = q > 0.6 ? 'auto' : 'none'; }
    else endUi.style.visibility = 'hidden';
  }

  layout(); place(); measure(); lw = innerWidth; lh = innerHeight;
  addEventListener('resize', resize);
  new ResizeObserver(measure).observe(document.body);
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  raf = requestAnimationFrame(frame);
  return (canvas.__hero = { S, layout: () => L });
}
