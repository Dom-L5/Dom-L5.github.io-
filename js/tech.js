// Shared stage for the two live drawings: transparent canvas, drag to turn, renders only while visible.
import * as THREE from 'three';

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeStage(stage, canvas, { fov = 24, yaw = -0.5, pitch = 0.3, pitchRange = [-0.15, 1.0] } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 20, 8000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa8ae, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-0.7, 1.3, 1.0); scene.add(key);
  const back = new THREE.DirectionalLight(0xdfeaf0, 0.7); back.position.set(0.9, 0.4, -1.0); scene.add(back);
  const turn = new THREE.Group(); scene.add(turn);

  const st = { yaw, pitch, yawT: yaw, pitchT: pitch, w: 1, h: 1, visible: false, dragging: false, lastDrag: -100, t: 0, px: 0, py: 0, hover: false };
  const callbacks = [];
  let px = 0, py = 0;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('input,button,a')) return;
    st.dragging = true; px = e.clientX; py = e.clientY; stage.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    st.px = (e.clientX - r.left) / r.width * 2 - 1; st.py = (e.clientY - r.top) / r.height * 2 - 1; st.hover = true;
    if (!st.dragging) return;
    st.yawT += (e.clientX - px) * 0.0085; st.pitchT = Math.min(pitchRange[1], Math.max(pitchRange[0], st.pitchT + (e.clientY - py) * 0.005));
    px = e.clientX; py = e.clientY; st.lastDrag = st.t;
  });
  const end = () => { st.dragging = false; };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('pointerleave', () => { st.hover = false; });

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    st.w = w; st.h = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    callbacks.forEach(c => c.resize?.(w, h));
  };
  new ResizeObserver(resize).observe(stage); resize();
  new IntersectionObserver(es => { st.visible = es[0].isIntersecting; }, { rootMargin: '80px 0px' }).observe(stage);

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!st.visible || document.hidden) return;
    st.t += dt;
    st.yaw += (st.yawT - st.yaw) * Math.min(1, dt * 9); st.pitch += (st.pitchT - st.pitch) * Math.min(1, dt * 9);
    turn.rotation.set(st.pitch, st.yaw, 0, 'XYZ');
    callbacks.forEach(c => c.frame?.(dt, st));
    renderer.render(scene, camera);
    callbacks.forEach(c => c.after?.(dt, st));
  }
  requestAnimationFrame(frame);

  const v = new THREE.Vector3();
  function project(obj, local, out) {
    v.copy(local); obj.localToWorld(v); v.project(camera);
    out.x = (v.x * 0.5 + 0.5) * st.w; out.y = (-v.y * 0.5 + 0.5) * st.h; return out;
  }
  // how far the stage has come up the viewport: 0 entering at the bottom, 1 once centred
  function arrival() {
    const r = stage.getBoundingClientRect(), vh = window.innerHeight;
    return smooth(0.92, 0.5, (r.top + r.height / 2) / vh);
  }
  return { renderer, scene, camera, turn, st, on: c => callbacks.push(c), project, arrival };
}

export function drawingMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...opts });
}
export function addEdges(mesh, color = 0x111a1f, opacity = 0.55, angle = 32) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, angle), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  e.raycast = () => {}; mesh.add(e); return e;
}
export function blobShadow(w, d, opacity = 0.2) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(17,26,31,1)'); grd.addColorStop(0.55, 'rgba(17,26,31,.45)'); grd.addColorStop(1, 'rgba(17,26,31,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}

// ---- real CAD meshes ----
// The STL exports are packed offline into one base64 blob per model: 16-bit positions inside a bounding box, then indices.
export function creased(pos, idx, cosA) {
  // per-corner normals: smooth across shallow angles, sharp across CAD edges
  const nt = idx.length / 3, fn = new Float32Array(nt * 3), nv = pos.length / 3;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const count = new Uint32Array(nv + 1);
  for (let t = 0; t < nt; t++) {
    const i0 = idx[t * 3], i1 = idx[t * 3 + 1], i2 = idx[t * 3 + 2];
    a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3); c.fromArray(pos, i2 * 3);
    n.copy(b).sub(a).cross(c.sub(a)); const area = n.length(); if (area > 0) n.multiplyScalar(1 / area);
    fn[t * 3] = n.x; fn[t * 3 + 1] = n.y; fn[t * 3 + 2] = n.z;
    count[i0 + 1]++; count[i1 + 1]++; count[i2 + 1]++;
  }
  for (let i = 0; i < nv; i++) count[i + 1] += count[i];
  const fill = count.slice(0, nv), adj = new Uint32Array(idx.length);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) adj[fill[idx[t * 3 + k]]++] = t;
  const P = new Float32Array(nt * 9), N = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) {
    const fx = fn[t * 3], fy = fn[t * 3 + 1], fz = fn[t * 3 + 2];
    for (let k = 0; k < 3; k++) {
      const v = idx[t * 3 + k]; let x = 0, y = 0, z = 0;
      for (let j = count[v]; j < count[v + 1]; j++) {
        const o = adj[j] * 3;
        if (fn[o] * fx + fn[o + 1] * fy + fn[o + 2] * fz > cosA) { x += fn[o]; y += fn[o + 1]; z += fn[o + 2]; }
      }
      const l = Math.hypot(x, y, z) || 1, w = (t * 3 + k) * 3;
      N[w] = x / l; N[w + 1] = y / l; N[w + 2] = z / l;
      P[w] = pos[v * 3]; P[w + 1] = pos[v * 3 + 1]; P[w + 2] = pos[v * 3 + 2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}

export function unpack(manifest, b64) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer, { lo, span } = manifest;
  return manifest.parts.map(p => {
    const q = new Uint16Array(bin, p.vo, p.vn * 3), pos = new Float32Array(p.vn * 3);
    for (let i = 0; i < p.vn; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = lo[k] + q[i * 3 + k] / 65535 * span[k];
    const idx = p.i32 ? new Uint32Array(bin, p.io, p.tn * 3) : new Uint16Array(bin, p.io, p.tn * 3);
    return { ...p, pos, idx };
  });
}
// a mesh from one unpacked part, with CAD-style creases and optional outline edges
export function cadMesh(part, material, { crease = 0.6, edges = 0, edgeMat = null } = {}) {
  const mesh = new THREE.Mesh(creased(part.pos, part.idx, Math.cos(crease)), material);
  if (edges) {
    const ig = new THREE.BufferGeometry(); ig.setAttribute('position', new THREE.BufferAttribute(part.pos, 3)); ig.setIndex(new THREE.BufferAttribute(part.idx, 1));
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(ig, edges), edgeMat || new THREE.LineBasicMaterial({ color: 0x111a1f, transparent: true, opacity: 0.55 }));
    e.raycast = () => {}; mesh.add(e); ig.dispose();
  }
  return mesh;
}
