// The blind: a real-time window blind behind the page. Pointer tilts the slats, scroll opens them
// and carries the camera through a gap into daylight. At the end of the page it closes again.
import * as THREE from 'three';

const DAY = [0xED / 255, 0xF1 / 255, 0xF2 / 255];   // must match --day
const ROOM = 0x0B0F12;                               // must match --room
const SLAT_W = 0.05, PITCH = 0.0435, CLOSED = 1.24;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

const slatVert = /* glsl */`
attribute float aJit;
uniform float uTheta, uPitch, uHalfW, uBounce;
varying float vE; varying float vFace; varying vec3 vWorld; varying float vX; varying float vJit;

float cross2(vec2 a, vec2 b){ return a.x*b.y - a.y*b.x; }
// 2D light transport in the (up, toward-room) plane. Slats are parallel strips along direction u.
float vis(vec2 P, vec2 L, vec2 u){
  float den = cross2(L, u); den = abs(den) < 1e-4 ? 1e-4 : den;
  float v = 1.0;
  for (int k = -2; k <= 2; k++) {
    if (k == 0) continue;
    vec2 D = vec2(float(k) * uPitch, 0.0) - P;
    float lam = cross2(D, u) / den;
    float r = cross2(D, L) / den;
    float hit = step(0.0004, lam) * (1.0 - smoothstep(uHalfW - 0.0025, uHalfW + 0.0025, abs(r)));
    v *= 1.0 - hit;
  }
  return v;
}
float direct(vec2 P, vec2 n, vec2 u){
  float E = 0.0;
  for (int i = 0; i < 8; i++) {
    float e = mix(-0.22, 1.36, (float(i) + 0.5) / 8.0);      // elevation of the sky patch
    vec2 L = vec2(sin(e), -cos(e));                           // toward the window
    float w = e < 0.0 ? 0.22 : 0.5 + 0.5 * sin(e);            // ground bounce is weaker than sky
    E += w * max(0.0, dot(n, L)) * vis(P + n * 0.0005, L, u);
  }
  return E / 8.0;
}
float bounce(vec2 P, vec2 n, vec2 u, float k){
  float B = 0.0;
  for (int j = 0; j < 6; j++) {
    float r = ((float(j) + 0.5) / 6.0 * 2.0 - 1.0) * uHalfW;
    vec2 Q = vec2(k * uPitch, 0.0) + r * u;
    vec2 d = Q - P; float dist = max(length(d), 0.004); d /= dist;
    float c = max(0.0, dot(n, d));
    B += direct(Q, -n, u) * c * c / (2.0 * dist) * (2.0 * uHalfW / 6.0);
  }
  return B * uBounce;
}
void main(){
  float th = uTheta + aJit * 0.025;
  float c = cos(th), s = sin(th);
  vec3 p = position;
  vec3 q = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  vec2 u = vec2(-s, c);
  vec2 nTop = vec2(c, s);
  vec2 P = position.z * u;
  float face = normal.y > 0.5 ? 1.0 : (normal.y < -0.5 ? -1.0 : 0.0);
  float E;
  if (face != 0.0) {
    vec2 n = nTop * face;
    E = direct(P, n, u) + bounce(P, n, u, face);
  } else {
    vec2 n = u * sign(normal.z + 0.001);
    E = direct(P, n, u) * 0.8;
  }
  vE = E; vFace = face; vX = position.x; vJit = aJit;
  vec4 wp = modelMatrix * instanceMatrix * vec4(q, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const slatFrag = /* glsl */`
precision highp float;
uniform vec3 uDay; uniform float uHalfLen, uGain, uAmb;
varying float vE; varying float vFace; varying vec3 vWorld; varying float vX; varying float vJit;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float ends = smoothstep(uHalfLen, uHalfLen - 0.06, abs(vX));          // light falls off toward the ends
  float lin = vE * uGain * mix(0.82, 1.0, ends) * (1.0 + vJit * 0.035);
  float amb = uAmb * (vFace > -0.5 ? 1.0 : 0.55);
  vec3 col = vec3(0.94, 0.965, 0.98) * lin + vec3(0.55, 0.68, 0.78) * amb;
  col = 1.0 - exp(-col * 1.7);
  col = pow(col, vec3(1.0 / 2.2));
  col = col * 0.4 * uDay;                     // slats stay in the dark half so the type always reads
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

const windowVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const windowFrag = /* glsl */`
precision highp float;
uniform vec3 uDay; uniform float uFlat; varying vec2 vUv;
void main(){
  vec3 top = uDay * vec3(0.9, 0.94, 0.99);
  vec3 g = mix(uDay, top, smoothstep(0.35, 1.0, vUv.y));
  gl_FragColor = vec4(mix(g, uDay, uFlat), 1.0);
}`;
const haloFrag = /* glsl */`
precision highp float;
uniform vec3 uDay; uniform float uAmt; uniform vec2 uHalf; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  vec2 d = max(abs(p) - uHalf, 0.0) / (1.0 - uHalf);
  float a = exp(-dot(d, d) * 22.0) * uAmt;
  vec3 col = uDay * vec3(0.8, 0.9, 1.0) * a + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

function roundedBox(w, h, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const b = Math.min(r * 0.6, d * 0.2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

export function initHero({ canvas, heroSection, heroUi, heroName, hint, endSection, endUi, buttons, btnOpen, btnClose }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  document.documentElement.classList.add('gl');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ROOM);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.003, 20);

  scene.add(new THREE.AmbientLight(0xbfd6e6, 0.07));
  const fill = new THREE.DirectionalLight(0xcfe2f0, 0.2); fill.position.set(-1.2, 0.9, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(0.2, -0.5, -1); scene.add(rim);

  const dayU = { value: new THREE.Vector3(...DAY) };
  const slatMat = new THREE.ShaderMaterial({
    vertexShader: slatVert, fragmentShader: slatFrag,
    uniforms: { uTheta: { value: CLOSED }, uPitch: { value: PITCH }, uHalfW: { value: SLAT_W / 2 }, uHalfLen: { value: 1 }, uGain: { value: 2.6 }, uAmb: { value: 0.011 }, uBounce: { value: 0.26 }, uDay: dayU },
  });
  const winMat = new THREE.ShaderMaterial({ vertexShader: windowVert, fragmentShader: windowFrag, uniforms: { uDay: dayU, uFlat: { value: 0 } } });
  const haloMat = new THREE.ShaderMaterial({ vertexShader: windowVert, fragmentShader: haloFrag, uniforms: { uDay: dayU, uAmt: { value: 0 }, uHalf: { value: new THREE.Vector2(0.5, 0.5) } } });
  const white = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.7, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: 0.5 });
  const green = new THREE.MeshStandardMaterial({ color: 0x1c9c4e, roughness: 0.35, emissive: 0x16b35a, emissiveIntensity: 0.55 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc2332b, roughness: 0.35, emissive: 0xd0362c, emissiveIntensity: 0.5 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x1a2630 });
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x59646b });

  const rig = new THREE.Group(); scene.add(rig);
  let slats, cords = [], housing, btnG, btnR, led, ledGlow, win, halo;
  let L = {};   // layout: sizes that depend on the viewport

  function build() {
    while (rig.children.length) { const c = rig.children.pop(); c.traverse?.(o => o.geometry?.dispose?.()); }
    cords = [];
    const w = canvas.clientWidth, h = canvas.clientHeight, aspect = w / h;
    const hv = Math.max(1.0, 0.72 / aspect);            // visible height at the blind, metres
    const vw = hv * aspect;
    const cz = hv / 2 / Math.tan(THREE.MathUtils.degToRad(15));
    const hs = aspect < 0.8 ? 1.45 : 1.2;                  // bigger housing on phones
    const over = 0.092 * hs;                             // housing overhang past the rail
    const gut = clamp(w * 0.04, 16, 56);                 // the page gutter, px
    const margin = gut * 0.42 / w * vw;
    const mr = Math.max(margin, 0.02 * hs);
    const W = vw - margin - mr - over;
    const x0 = (margin - mr - over) / 2;
    const railY = hv / 2 - Math.max(0.13, 0.105 * hv);
    const n = Math.ceil((railY + hv / 2) / PITCH) + 3;

    // slats
    const g = new THREE.BoxGeometry(W, 0.0026, SLAT_W, 1, 1, 24);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i) / (SLAT_W / 2); pos.setY(i, pos.getY(i) + 0.0011 * (1 - z * z)); }
    slats = new THREE.InstancedMesh(g, slatMat, n);
    const jit = new Float32Array(n), m = new THREE.Matrix4();
    const ys = [];
    for (let i = 0; i < n; i++) {
      const y = railY - 0.052 - i * PITCH; ys.push(y);
      m.makeTranslation(x0, y, 0); slats.setMatrixAt(i, m);
      { const r = Math.sin(i * 12.9898) * 43758.5453; jit[i] = (r - Math.floor(r)) * 2 - 1; }
    }
    g.setAttribute('aJit', new THREE.InstancedBufferAttribute(jit, 1));
    slats.frustumCulled = false; rig.add(slats);
    slatMat.uniforms.uHalfLen.value = W / 2;

    // ladder cords
    for (const fx of [-0.3, 0.3]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.0008, n * PITCH, 0.0008), cordMat);
      c.position.set(x0 + fx * W, railY - 0.05 - n * PITCH / 2, 0); rig.add(c); cords.push(c);
    }
    // head rail
    const rail = new THREE.Mesh(roundedBox(W + 0.012, 0.046, 0.058, 0.006), white);
    rail.position.set(x0, railY, 0); rig.add(rail);

    // motor housing with the two buttons
    housing = new THREE.Group(); housing.scale.setScalar(hs);
    const sleeve = new THREE.Mesh(roundedBox(0.086, 0.064, 0.074, 0.012), white); sleeve.position.set(0.029, 0, 0);   // the button box sits past the end of the rail; the motor is inside the rail
    const panel = new THREE.Mesh(roundedBox(0.078, 0.082, 0.03, 0.007), white); panel.position.set(0.029, -0.07, 0.022);
    housing.add(sleeve, panel);
    const mkBtn = (mat, x) => {
      const b = new THREE.Group();
      const bez = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.004, 28), dark); bez.rotation.x = Math.PI / 2;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat); cap.rotation.x = Math.PI / 2; cap.scale.set(0.84, 0.5, 0.84);
      b.add(bez, cap); b.userData.cap = cap; b.position.set(x, -0.066, 0.039); housing.add(b); return b;
    };
    btnG = mkBtn(green, 0.012); btnR = mkBtn(red, 0.047);
    led = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 12, 8), ledMat); led.position.set(0.0295, -0.094, 0.0375); housing.add(led);
    ledGlow = new THREE.Mesh(new THREE.CircleGeometry(0.009, 24), new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    ledGlow.position.set(0.0295, -0.094, 0.039); housing.add(ledGlow);
    housing.position.set(x0 + W / 2 + 0.02 * hs, railY, 0); rig.add(housing);

    // the window behind, and its glow on the wall
    const wh = n * PITCH + 0.1;
    win = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.006, wh), winMat);
    win.position.set(x0, railY - 0.02 - wh / 2, -0.045); rig.add(win);
    const hw = W * 2.2, hh = wh * 1.6;
    halo = new THREE.Mesh(new THREE.PlaneGeometry(hw, hh), haloMat);
    halo.position.set(x0, win.position.y, -0.06); rig.add(halo);
    haloMat.uniforms.uHalf.value.set(W / hw, wh / hh);

    // the gap the camera will pass through: the one nearest eye level
    let gi = 0; for (let i = 0; i < n - 1; i++) if (ys[i] > 0.04) gi = i;
    L = { w, h, aspect, hv, vw, cz, W, x0, railY, gapY: (ys[gi] + ys[gi + 1]) / 2 };
    heroUi.style.setProperty('--blind-r', ((mr + over) / vw * w + 14).toFixed(0) + 'px');
    camera.aspect = aspect; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  // ---------------- state ----------------
  const S = { theta: CLOSED, target: 0.62, ptrY: 0.5, ptrX: 0.5, lastInput: -10, manualUntil: -1, lock: null, led: 0, press: { g: 0, r: 0 }, t: 0 };
  let lastW = 0, lastH = 0;

  function onResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === lastW && Math.abs(h - lastH) < 90) return;
    lastW = w; lastH = h; build(); placeButtons(); needs = true;
  }
  const v = new THREE.Vector3();
  function placeButtons() {
    if (!btnG) return;
    rig.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    for (const [mesh, el] of [[btnG, btnOpen], [btnR, btnClose]]) {
      mesh.getWorldPosition(v); v.project(camera);
      el.style.left = ((v.x * 0.5 + 0.5) * L.w).toFixed(1) + 'px';
      el.style.top = ((-v.y * 0.5 + 0.5) * L.h).toFixed(1) + 'px';
    }
  }

  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const y = e.clientY / window.innerHeight, x = e.clientX / window.innerWidth;
    if (S.lock && Math.hypot(e.clientX - S.lock.x, e.clientY - S.lock.y) < 90) return;
    S.lock = null; S.ptrY = y; S.ptrX = x; S.lastInput = S.t; S.mode = 'pointer'; S.idle = false;
  }, { passive: true });
  // phones: a tap on the blind toggles it
  heroSection.addEventListener('click', e => {
    if (!touch || e.target.closest('button,a')) return;
    S.mode = 'manual'; S.target = Math.abs(S.target) < 0.5 ? CLOSED : 0.08; S.lastInput = S.t; S.manualUntil = S.t + 9;
  });
  function press(which, e) {
    S.mode = 'manual'; S.target = which === 'g' ? 0.0 : CLOSED; S.press[which] = 1; S.lastInput = S.t; S.manualUntil = S.t + 9;
    S.lock = e && e.clientX ? { x: e.clientX, y: e.clientY } : null; S.endManual = true; needs = true;
  }
  btnOpen.addEventListener('click', e => press('g', e));
  btnClose.addEventListener('click', e => press('r', e));
  // ---------------- scroll zones ----------------
  let heroLen = 1, endTop = 1e9, vhNow = 1;
  function measure() {
    vhNow = window.innerHeight;
    heroLen = Math.max(1, heroSection.offsetHeight - vhNow);
    endTop = endSection.getBoundingClientRect().top + window.scrollY;
    heroUi.style.setProperty('--hero-len', heroLen + 'px');
  }
  function zone() {
    const y = window.scrollY;
    if (y < heroLen + vhNow) return 'hero';
    if (y + vhNow > endTop) return 'end';
    return 'none';
  }

  let needs = true, raf = 0, last = performance.now(), slow = 0, frames = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; S.t += dt;
    const z = zone();
    if (z === 'none') { if (buttons && !buttons.hidden) buttons.hidden = true; return; }
    const y = window.scrollY;
    const p = z === 'hero' ? clamp(y / heroLen, 0, 1) : 0;
    const q = z === 'end' ? clamp((y + vhNow - endTop) / vhNow, 0, 1) : 0;

    // what the motor is asked to do
    if (z === 'hero') {
      const idle = S.t - S.lastInput > 4.5;
      if (S.mode === 'manual' && S.t > S.manualUntil && !S.endManual) S.mode = null;
      if (reduce) S.target = 0.55;
      else if (S.mode === 'pointer' && !idle) S.target = (S.ptrY - 0.5) * 2 * CLOSED * 1.06;
      else if (S.mode === 'manual' && S.t < S.manualUntil) { /* hold */ }
      else { S.mode = null; S.endManual = false; const lo = L.aspect < 0.8 ? 0.95 : 0.78; S.target = mix(lo, 1.2, 0.5 - 0.5 * Math.cos(S.t * 0.4)); S.idle = true; }
    } else if (!S.endManual) {
      S.target = mix(0.02, CLOSED, smooth(0.25, 0.92, q));
    }
    if (z === 'hero' && S.zoneWas === 'end') S.endManual = false;
    if (z === 'end' && S.zoneWas !== 'end') { S.endManual = false; S.mode = null; }
    S.zoneWas = z;
    S.target = clamp(S.target, -CLOSED, CLOSED);
    // geared motor: rate-limited, with a soft landing
    const err = S.target - S.theta;
    const rate = z === 'end' && !S.endManual ? 9 : (S.idle && S.mode === null ? 0.5 : 2.1);
    S.theta += clamp(err * 6.5, -rate, rate) * dt;
    const running = Math.abs(err) > 0.03 && (S.mode === 'manual' || S.endManual);
    S.led += ((running ? 1 : 0) - S.led) * Math.min(1, dt * 10);

    // scroll takes over: open, then travel through the gap
    const open = smooth(0.0, 0.3, p);
    const theta = mix(S.theta, 0, open);
    slatMat.uniforms.uTheta.value = theta;
    const tt = smooth(0.08, 1.0, p);
    const travel = tt * tt * (3 - 2 * tt) * 0.35 + tt * 0.65;
    const cz = (L.cz + 0.05) * Math.pow(0.018 / (L.cz + 0.05), travel) - 0.05;
    const par = (1 - smooth(0, 0.2, p)) * (reduce ? 0 : 1);
    camera.position.set((S.ptrX - 0.5) * 0.05 * par, mix((0.5 - S.ptrY) * 0.03 * par, L.gapY, smooth(0.02, 0.55, p)), cz);
    camera.lookAt(camera.position.x * 0.3, camera.position.y * mix(0.3, 1, smooth(0.02, 0.55, p)), -1);
    winMat.uniforms.uFlat.value = smooth(0.7, 0.97, p);
    const openness = clamp(1 - Math.abs(Math.sin(theta)) * (SLAT_W / PITCH), 0, 1);
    haloMat.uniforms.uAmt.value = 0.03 + 0.26 * openness;
    for (const c of cords) c.position.z = Math.cos(theta) * SLAT_W / 2 + 0.001;

    // buttons and LED
    for (const k of ['g', 'r']) { S.press[k] = Math.max(0, S.press[k] - dt * 5); }
    btnG.userData.cap.position.z = -0.002 * S.press.g; btnR.userData.cap.position.z = -0.002 * S.press.r;
    ledMat.color.setRGB(0.1 + 0.5 * S.led, 0.15 + 0.75 * S.led, 0.19 + 0.81 * S.led);
    ledGlow.material.opacity = 0.4 * S.led;

    // DOM that follows the scene
    const showBtns = (z === 'hero' && p < 0.04) || (z === 'end' && q > 0.9);
    if (buttons.hidden === showBtns) { buttons.hidden = !showBtns; if (showBtns) placeButtons(); }
    if (z === 'hero') {
      heroUi.style.visibility = 'visible';
      const rel = y > heroLen; if (rel !== S.rel) { S.rel = rel; heroUi.classList.toggle('released', rel); }
      const wd = Math.round(mix(L.aspect < 0.8 ? 76 : 86, L.aspect < 0.8 ? 100 : 116, clamp(1 - Math.abs(theta) / CLOSED, 0, 1)));
      if (wd !== S.wd) { S.wd = wd; heroName.style.setProperty('--name-wdth', wd); }
      hint.style.opacity = (1 - smooth(0.01, 0.08, p)).toFixed(2);
      endUi.style.visibility = 'hidden';
    } else {
      heroUi.style.visibility = 'hidden';
      endUi.style.visibility = 'visible';
      endUi.style.pointerEvents = q > 0.6 ? 'auto' : 'none';
      // white on the closed blind, ink if the reader opens it again
      const al = smooth(0.45, 0.92, q).toFixed(2) + (Math.abs(theta) < 0.5 ? 'k' : 'w');
      if (al !== S.al) { S.al = al; endUi.style.color = `rgba(${al.endsWith('k') ? '17,26,31' : '255,255,255'},${parseFloat(al)})`; }
    }

    renderer.render(scene, camera);

    // keep it fast: drop resolution if frames run long
    if (dt > 0.024) slow++; frames++;
    if (frames >= 90) { if (slow > 45 && dpr > 1) { dpr = Math.max(1, dpr - 0.5); renderer.setPixelRatio(dpr); renderer.setSize(L.w, L.h, false); } slow = 0; frames = 0; }
  }

  if (hint) hint.textContent = touch ? 'Tap the blind to tilt it. Scroll to open it.' : 'Move the pointer to tilt the slats. Green opens, red closes. Scroll to go through.';
  build(); measure(); placeButtons();
  lastW = canvas.clientWidth; lastH = canvas.clientHeight;
  window.addEventListener('resize', () => { onResize(); measure(); });
  new ResizeObserver(measure).observe(document.body);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else { last = performance.now(); raf = requestAnimationFrame(frame); } });
  raf = requestAnimationFrame(frame);
  return { state: S, layout: () => L };
}
