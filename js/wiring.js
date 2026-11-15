// The robot's electronics: Arduino Nano, PCA9685 servo driver, eight servo leads and every wire.
// Routes come from wiring-data.js, which is authored and collision-checked against the printed parts offline.
// Every wire is its own named object inside the group "electronics".
import * as THREE from 'three';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
const box = (w, h, d, mat, x, y, z, name) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (name) m.name = name; return m; };

function pins(positions, len, mat, axis = 'y') {
  const g = new THREE.BoxGeometry(axis === 'y' ? 0.64 : len, axis === 'y' ? len : 0.64, 0.64);
  const im = new THREE.InstancedMesh(g, mat, positions.length), m = new THREE.Matrix4();
  positions.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m); });
  return im;
}

// three bonded conductors, swept along sample points P with width vectors B (brown faces the GND pin)
const COND = [[1.3, 0x6b3f1d], [0, 0xc8322c], [-1.3, 0xe8881a]];
const RING = 6, CR = 0.66;
function ribbon(P, B) {
  const n = P.length / 3, verts = n * 3 * RING;
  const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), col = new Float32Array(verts * 3);
  const idx = [];
  const c = new THREE.Color();
  for (let k = 0; k < 3; k++) {
    c.setHex(COND[k][1]);
    for (let i = 0; i < n; i++) for (let r = 0; r < RING; r++) {
      const v = (k * n + i) * RING + r; col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
      if (i < n - 1) { const a = v, b = (k * n + i) * RING + (r + 1) % RING, d = a + RING, e = b + RING; idx.push(a, d, b, b, d, e); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  fill(g, P, B);
  return g;
}
const cs = Array.from({ length: RING }, (_, r) => [Math.cos(r / RING * Math.PI * 2), Math.sin(r / RING * Math.PI * 2)]);
function fill(g, P, B) {
  const n = P.length / 3, pos = g.attributes.position.array, nor = g.attributes.normal.array;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3;
    let tx = P[b] - P[a], ty = P[b + 1] - P[a + 1], tz = P[b + 2] - P[a + 2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const bx = B[i * 3], by = B[i * 3 + 1], bz = B[i * 3 + 2];
    const nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx;      // thickness direction
    for (let k = 0; k < 3; k++) {
      const o = COND[k][0], cx = P[i * 3] + bx * o, cy = P[i * 3 + 1] + by * o, cz = P[i * 3 + 2] + bz * o;
      for (let r = 0; r < RING; r++) {
        const v = ((k * n + i) * RING + r) * 3, u = cs[r][0], w = cs[r][1];
        const dx = bx * u + nx * w, dy = by * u + ny * w, dz = bz * u + nz * w;
        nor[v] = dx; nor[v + 1] = dy; nor[v + 2] = dz; pos[v] = cx + dx * CR; pos[v + 1] = cy + dy * CR; pos[v + 2] = cz + dz * CR;
      }
    }
  }
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
}

export function buildElectronics(W, legs) {
  const group = new THREE.Group(); group.name = 'electronics';
  const boards = new THREE.Group(); boards.name = 'boards'; const wires = new THREE.Group(); wires.name = 'wires';
  group.add(boards, wires);
  const black = std(0x15171a, { roughness: 0.5 }), gold = std(0xd8b24a, { metalness: 0.7, roughness: 0.35 }), steel = std(0xb9c2c7, { metalness: 0.7, roughness: 0.35 });

  // ---- PCA9685 16-channel servo driver: 62.5 x 25.4 x 1.6 mm
  const pc = W.pca, top = pc.top, pca = new THREE.Group(); pca.name = 'pca9685';
  const blue = std(0x1c4fa6);
  pca.add(box(62.5, 1.6, 25.4, blue, pc.c[0], pc.c[1], pc.c[2]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.7, 16), std(0xcfd6da, { metalness: 0.6 })); h.position.set(pc.c[0] + sx * 28.4, pc.c[1], pc.c[2] + sz * 9.9); pca.add(h); }
  const pp = [];
  for (let b = 0; b < 4; b++) pca.add(box(10.16, 2.5, 7.7, black, (pc.cols[b * 4] + pc.cols[b * 4 + 3]) / 2, top + 1.25, pc.rowsZ[1]));
  for (let c = 0; c < 16; c++) for (const z of pc.rowsZ) pp.push([pc.cols[c], top + 5.5, z]);
  for (const sx of [pc.endX, 2 * pc.c[0] - pc.endX]) { pca.add(box(2.5, 2.5, 15.3, black, sx, top + 1.25, (pc.endZ[0] + pc.endZ[5]) / 2)); for (const z of pc.endZ) pp.push([sx, top + 5.5, z]); }
  pca.add(pins(pp, 6.2, gold));
  const term = box(10, 10, 7.6, std(0x2b6fd0), pc.term[0], top + 5, pc.term[1]); pca.add(term);
  for (const sx of [-2.5, 2.5]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.6, 14), steel); s.position.set(pc.term[0] + sx, top + 10.2, pc.term[1]); pca.add(s); }
  pca.add(box(6, 1.4, 8, black, pc.c[0] - 9, top + 0.7, pc.c[2] + 6.5));
  pca.add(box(1.6, 0.8, 0.9, new THREE.MeshBasicMaterial({ color: 0xff4030 }), pc.c[0] + 21, top + 0.4, pc.c[2] + 9.5));
  boards.add(pca);

  // ---- Arduino Nano R4: 43.2 x 17.8 x 1.6 mm, on its header pins, USB-C toward the back
  const nc = W.nano.c, nano = new THREE.Group(); nano.name = 'arduino_nano_r4';
  const ntop = nc[1] + 0.8;
  nano.add(box(17.8, 1.6, 43.2, std(0x12508f), nc[0], nc[1], nc[2]));
  const np = [];
  for (const sx of [-7.62, 7.62]) {
    nano.add(box(2.5, 2.5, 38.1, black, nc[0] + sx, nc[1] - 0.8 - 1.25, nc[2]));
    for (let k = 0; k < 15; k++) np.push([nc[0] + sx, nc[1] - 0.8 - 4.2, nc[2] + 21.6 - 3.82 - 2.54 * k]);
    for (let k = 0; k < 15; k++) { const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 10), gold); pad.position.set(nc[0] + sx, ntop + 0.05, nc[2] + 21.6 - 3.82 - 2.54 * k); nano.add(pad); }
  }
  nano.add(pins(np, 8.4, gold));
  nano.add(box(7, 1.0, 7, black, nc[0], ntop + 0.5, nc[2] + 2));                                   // main chip
  nano.add(box(9, 3.2, 7.4, steel, nc[0], ntop + 1.6, nc[2] + 18.3));                               // USB-C
  nano.add(box(4.6, 2.9, 4.2, std(0xe9e4d6), nc[0], ntop + 1.45, nc[2] - 19.2));                    // Qwiic
  nano.add(box(2.2, 0.9, 1.4, black, nc[0] - 4, ntop + 0.45, nc[2] - 8), box(1.6, 0.8, 3, std(0x8a6a2a), nc[0] + 4, ntop + 0.4, nc[2] - 10), box(3, 1.1, 3, steel, nc[0] + 0.5, ntop + 0.55, nc[2] - 12.5));
  nano.add(box(1.0, 0.6, 1.0, new THREE.MeshBasicMaterial({ color: 0x57e389 }), nc[0] - 4.5, ntop + 0.3, nc[2] + 10));   // RGB LED
  boards.add(nano);

  // ---- display pin headers on the face
  const ep = [];
  for (const k in W.eyes) for (let i = 0; i < 4; i++) ep.push([W.eyes[k] + (i - 1.5) * 2.54, 31.6, -53.9]);
  const eyePins = pins(ep, 1.6, gold); eyePins.name = 'display_pins'; boards.add(eyePins);

  // ---- wires
  const moving = [];
  let cable = null;
  for (const w of W.wires) {
    let mesh;
    if (w.kind === 'ribbon') {
      const P = Float32Array.from(w.p), B = Float32Array.from(w.b);
      mesh = new THREE.Mesh(ribbon(P, B), std(0xffffff, { vertexColors: true, roughness: 0.55 }));
      const x = W.pca.cols[w.ch]; mesh.add(box(2.5, 14, 7.6, black, x, top + 2.5 + 7, W.pca.rowsZ[1], 'plug_ch' + w.ch));
      if (w.w) { mesh.frustumCulled = false; moving.push({ mesh, P0: P, B0: B, P: P.slice(), B: B.slice(), w: w.w, leg: w.leg }); }
    } else {
      const pts = []; for (let i = 0; i < w.p.length; i += 3) pts.push(new THREE.Vector3(w.p[i], w.p[i + 1], w.p[i + 2]));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 2), w.r, w.kind === 'cable' ? 10 : 6, false), std(w.color, { roughness: w.kind === 'cable' ? 0.7 : 0.5 }));
      if (w.kind === 'cable') {
        cable = mesh;
        const a = new THREE.Vector3(...W.relief[0]), b = new THREE.Vector3(...W.relief[1]), len = a.distanceTo(b);
        const sr = new THREE.Group(); sr.name = 'strain_relief';
        for (let i = 0; i < 5; i++) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.3 - i * 0.22, 3.3 - i * 0.22, len / 5 * 0.72, 14), black); ring.position.y = len / 2 - (i + 0.5) * len / 5; sr.add(ring); }
        sr.add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, len, 12), black));
        sr.position.copy(a).add(b).multiplyScalar(0.5); sr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize()); mesh.add(sr);
      }
    }
    mesh.name = w.name; mesh.userData = { from: w.frm, to: w.to, length: w.len }; wires.add(mesh);
  }
  // ---- blue masking tape holding the bundles
  const tapeMat = std(0x2f74d8, { roughness: 0.95 });
  for (const t of W.tape) { const m = box(t.size[0], t.size[1], t.size[2], tapeMat, t.c[0], t.c[1], t.c[2], t.name); m.rotation.y = t.yaw; wires.add(m); }

  const Yax = new THREE.Vector3(0, 1, 0), q = new THREE.Vector3(), d = new THREE.Vector3();
  return {
    group,
    setCover(on) { if (cable) cable.visible = on; },
    update(k, legs) {
      wires.visible = k < 0.03;                       // wires cannot stretch: they are put away when the robot is taken apart
      if (!wires.visible || !group.visible) return;
      for (const m of moving) {
        const L = legs[m.leg], ang = L.delta || 0, c = Math.cos(ang), s = Math.sin(ang), hx = L.hip.x, hz = L.hip.z;
        const n = m.w.length;
        for (let i = 0; i < n; i++) {
          const w = m.w[i], o = i * 3;
          if (w === 0) continue;
          const x = m.P0[o] - hx, z = m.P0[o + 2] - hz;
          m.P[o] = m.P0[o] + w * (hx + x * c + z * s - m.P0[o]); m.P[o + 2] = m.P0[o + 2] + w * (hz - x * s + z * c - m.P0[o + 2]);
          const bx = m.B0[o], bz = m.B0[o + 2];
          let nx = bx + w * (bx * c + bz * s - bx), nz = bz + w * (-bx * s + bz * c - bz); const by = m.B0[o + 1], l = Math.hypot(nx, by, nz) || 1;
          m.B[o] = nx / l; m.B[o + 1] = by / l; m.B[o + 2] = nz / l;
        }
        fill(m.mesh.geometry, m.P, m.B);
      }
    },
  };
}
