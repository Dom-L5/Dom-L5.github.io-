// The ENES 100 rover (team H2GO's water-sampling OTV), assembled from the team's real CAD parts.
// Scene units are millimetres: x forward, y up from the ground, z across. The wiring follows Dom's circuit diagram.
import * as THREE from 'three';
import { makeStage, blobShadow, unpack, cadMesh } from './tech.js?v=20261116b';

const COLORS = {
  chassis: 0x2d4a6b, shield: 0x6b4bb0, post: 0x1c1f22, marker: 0xf2efe6, drive: 0x23282c, motor: 0xb9c2c7, wheel: 0x17191c, power: 0x23282c, battery: 0x2f7d4f, switch: 0x8f1f1f,
  mega: 0x1b6f93, hbridge: 0xa62a2a, sensor: 0x6b4bb0, sonar: 0x2456a8, switchbody: 0x15171a, lever: 0xb9c2c7,
  mission: 0x6b4bb0, pinion: 0x3d6fb4, rack: 0x1c1f22, hw: 0xb9c2c7, diaper: 0xf4f2ec, rmotor: 0xe9e6dc,
};
const EDGES = { chassis: 1, shield: 1, post: 1, drive: 1, wheel: 1, power: 1, battery: 1, sensor: 1, mission: 1, pinion: 1, rack: 1, diaper: 1, rmotor: 1, switch: 1 };
const METAL = { motor: 1, lever: 1, hw: 1 };
const HILITE = {
  chassis: ['chassis', 'shield', 'post', 'marker'], drive: ['drive', 'motor', 'wheel'], power: ['power', 'battery', 'switch', 'buck'],
  control: ['mega', 'hbridge', 'wifi'], sensor: ['sensor', 'sonar', 'switchbody', 'lever', 'ldr'], mission: ['mission', 'pinion', 'rack', 'hw', 'diaper', 'rmotor'],
};
const PITCH_R = 7.35;                                        // pinion pitch radius: 14.7 mm pitch circle on the drawing
const A = (x, y, z) => new THREE.Vector3(x - 125, z + 27, 80 - y);   // CAD assembly coordinates -> scene

function markerTexture() {
  // a stand-in for the printed ArUco marker on the top plate (not a real marker ID)
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, 96, 96); g.fillStyle = '#111417'; g.fillRect(12, 12, 72, 72);
  g.fillStyle = '#f7f5ee'; const rows = ['0110', '1001', '0111', '1010'];
  rows.forEach((r, j) => [...r].forEach((b, i) => { if (b === '1') g.fillRect(24 + i * 12, 24 + j * 12, 12, 12); }));
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- electronics that are not in the CAD (buck converter, WiFi module, light sensor) and every wire on the circuit diagram
function buildWiring(mats) {
  const group = new THREE.Group(); group.name = 'electronics';
  const extras = new THREE.Group(), wires = new THREE.Group(); group.add(extras, wires);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
  const box = (w, h, d, mat, p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.copy(p); return m; };
  const cyl = (r, h, mat, p) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat); m.position.copy(p); return m; };
  // buck converter: 12 V in, 5 V out. A potted metal block on the real robot.
  mats.buck = std(0x9aa3a8, { metalness: 0.45, roughness: 0.4 });
  extras.add(box(26, 14, 44, mats.buck, A(132.5, 132, 10)), box(22, 1.2, 18, std(0x15171a), A(132.5, 132, 17.5)));
  // WiFi module on its breakout
  mats.wifi = std(0x1c4fa6);
  extras.add(box(16, 1.6, 25, mats.wifi, A(132.5, 28, 9)), box(10, 2.4, 12, std(0xb9c2c7, { metalness: 0.6, roughness: 0.35 }), A(131, 30, 11)), box(2.5, 8, 10.2, std(0x15171a), A(139.5, 27, 13)));
  for (const y of [20, 36]) extras.add(cyl(1.4, 5, std(0xd8d2c4), A(132.5, y, 5.5)));
  // light sensor: a photoresistor between two LEDs, pointing down through the slot in the mounting board
  mats.ldr = std(0x2f8a4f);
  extras.add(box(26, 1.6, 12, mats.ldr, A(276, 100, 87)));
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff4c9 });
  const leds = [270, 282].map(x => { const l = cyl(2.5, 8, glow, A(x, 100, 82)); extras.add(l); return l; });
  extras.add(cyl(2.6, 3, std(0xc9572a), A(276, 100, 84.5)));

  const COL = { r: 0xc8322c, k: 0x15171a, y: 0xe2b93b, g: 0x2f9e5b, b: 0x2f6fd0, w: 0xe9e4d6, o: 0xe8881a, p: 0x8a4fc9 };
  const wmat = {}; for (const k in COL) wmat[k] = std(COL[k], { roughness: 0.5 });
  let n = 0;
  const wire = (c, pts, r = 0.8) => {
    const j = (n++ % 5 - 2) * 0.9;                           // fan the bundles out so no two wires share a path
    const v = pts.map((p, i) => A(p[0], p[1], p[2]).add(new THREE.Vector3(0, i && i < pts.length - 1 ? j * 0.5 : 0, i && i < pts.length - 1 ? j : 0)));
    wires.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v, false, 'centripetal'), Math.max(16, v.length * 9), r, 6, false), wmat[c]));
  };
  const up = (p, h) => [p[0], p[1], p[2] + h];
  // pins. Mega: digital header on the right-hand edge, analog and power header on the left; USB end toward the front.
  const Z = 15.5, D = k => [146.47 - (k < 8 ? 62.23 - 2.54 * k : 40.6 - 2.54 * (k - 8)), 55.8, Z], An = k => [146.47 - (k < 8 ? 50.8 + 2.54 * k : 73.66 + 2.54 * (k - 8)), 104.06, Z];
  const V5 = [108.4, 104.06, Z], GND = [105.8, 104.06, Z], GND2 = [103.3, 104.06, Z], VIN = [100.75, 104.06, Z];
  // H-bridge 1 drives the wheels, H-bridge 2 the rack motor and the lights. Screw terminals and header, from the L298N layout.
  const h1 = { v12: [183, 51, 14], gnd: [178, 51, 14], in: i => [163 - 2.54 * i, 51, 15], a: i => [190, 38 - 5 * i, 14], b: i => [152, 38 - 5 * i, 14] };
  const h2 = { vin: [159, 109, 14], gnd: [164, 109, 14], in: i => [179 + 2.54 * i, 109, 15], a: i => [152, 122 + 5 * i, 14], b: i => [190, 122 + 5 * i, 14] };
  const batP = [30, 72, 61.5], batN = [30, 88, 61.5], sw = [25, 25, 71.5], HOLE = [187.5, 80, 88];
  // power: battery -> kill switch -> drive H-bridge, Mega VIN and the buck converter; the buck feeds H-bridge 2 with 5 V
  wire('r', [batP, [30, 50, 74], [27, 32, 73], sw], 1.1);
  wire('r', [sw, [32, 16, 60], [62, 9, 36], [122, 8, 32], [152, 8, 24], h1.v12], 1.1);
  wire('r', [h1.v12, [152, 40, 30], [124, 80, 32], [102, 99, 29], VIN]);
  wire('r', [sw, [19, 80, 66], [42, 142, 42], [92, 157, 30], [126, 156, 21], [128, 152, 17]], 1.1);
  wire('k', [batN, [52, 60, 44], [72, 13, 38], [126, 11, 34], [154, 10, 25], h1.gnd], 1.1);
  wire('k', [h1.gnd, [155, 44, 31], [126, 83, 33], [105, 99, 29], GND2]);
  wire('k', [batN, [24, 112, 60], [46, 146, 42], [94, 160, 30], [136, 158, 21], [137, 152, 17]], 1.1);
  wire('r', [[128, 112, 17], [146, 106, 21], [197, 111, 21], [199, 151, 23], h2.vin], 1.0);
  wire('k', [[137, 112, 17], [149, 104, 23], [200, 108, 23], [203, 154, 24], h2.gnd], 1.0);
  // drive: two leads to each wheel motor, six control lines from the Mega
  for (const i of [0, 1]) wire(i ? 'k' : 'r', [h1.a(i), up(h1.a(i), 5), [134, 41, 23], [112, 54 + i * 2, 18], [103 + i * 4, 51.5, 13]]);
  for (const i of [0, 1]) wire(i ? 'k' : 'r', [h1.b(i), up(h1.b(i), 5), [198, 50, 20], [176, 78, 15], [156, 104, 20], [132, 110, 23], [113, 112, 18], [103 + i * 4, 108.5, 13]]);
  ['y', 'g', 'b', 'w', 'o', 'p'].forEach((c, i) => wire(c, [D(2 + i), up(D(2 + i), 7), [134 + i * 2, 44, 31], [174 + i * 2, 17, 27], up(h1.in(i), 5), h1.in(i)]));
  ['y', 'g', 'b'].forEach((c, i) => { const d = [8, 9, 12][i]; wire(c, [D(d), up(D(d), 8), [150, 72, 33], [161, 106, 31], [162 - i * 2, 144, 27], up(h2.in(i), 5), h2.in(i)]); });
  // mission: rack motor and the light sensor on H-bridge 2, up through the hole in the top plate
  for (const i of [0, 1]) wire(i ? 'k' : 'r', [h2.b(i), up(h2.b(i), 6), [150, 124, 42], [178, 90, 76], HOLE, [226, 70, 99], [276, 53, 100], [289 + i * 6, 47, 103]]);
  for (const i of [0, 1]) wire(i ? 'k' : 'o', [h2.a(i), up(h2.a(i), 6), [192, 110, 52], [189, 85, 78], HOLE, [232, 96, 99], [263, 100, 99], [271 + i * 10, 101, 91], [271 + i * 10, 100, 88]]);
  wire('w', [An(1), up(An(1), 8), [124, 96, 50], [180, 83, 78], HOLE, [230, 99, 100], [262, 103, 100], [276, 104, 91], [276, 102, 88]]);
  // sensors: two ultrasonics (5 V, ground, trigger, echo) and three limit switches (signal and ground)
  [[V5, 'r'], [An(11), 'y'], [An(10), 'g'], [GND, 'k']].forEach(([p, c], i) => wire(c, [p, up(p, 9), [152, 94, 46], [200, 83, 72], [221, 77.6 + i * 2.54, 79]]));
  [[V5, 'r'], [An(12), 'b'], [An(13), 'w'], [GND, 'k']].forEach(([p, c], i) => wire(c, [p, up(p, 6), [128, 74, 24], [150, 76 + i * 2.5, 12], [176, 76 + i * 2.5, 6], [186, 76 + i * 2.5, -3], [190, 76 + i * 2.54, -14], [193.5, 76 + i * 2.54, -18]]));
  [[An(0), 'p'], [GND2, 'k']].forEach(([p, c], i) => wire(c, [p, up(p, 7), [150, 98, 31], [186, 84, 14], [198, 78.5 + i * 3, 9]]));
  [[An(15), 'y'], [GND2, 'k']].forEach(([p, c], i) => wire(c, [p, up(p, 10), [120, 94, 52], [180, 81, 78], HOLE, [226, 86, 99], [286, 97, 101], [303 + i * 9, 91, 105]]));
  [[An(14), 'g'], [GND2, 'k']].forEach(([p, c], i) => wire(c, [p, up(p, 10), [122, 92, 54], [181, 79, 78], HOLE, [228, 90, 99], [264, 96, 100], [276, 92, 90], [292, 92, 70], [303 + i * 9, 91, 66]]));
  // WiFi module: 5 V, ground and two serial lines
  [[D(10), 'g'], [D(11), 'y'], [V5, 'r'], [GND, 'k']].forEach(([p, c], i) => wire(c, [p, up(p, 6), i < 2 ? [126, 44, 28] : [128, 72, 33], [140, 23 + i * 2.54, 19], [139.5, 23 + i * 2.54, 15]]));
  return { group, wires, leds };
}

export async function initOtv({ stage, canvas, tag, slider, list, wiringToggle, topToggle }) {
  const { manifest, b64 } = await import('./otv-data.js');
  const S = makeStage(stage, canvas, { fov: 22, yaw: -0.72, pitch: 0.36, pitchRange: [0.02, 1.5] });
  const { turn, camera, st } = S;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rover = new THREE.Group(); turn.add(rover);
  const mats = {};
  for (const g in COLORS) mats[g] = new THREE.MeshStandardMaterial({ color: COLORS[g], roughness: METAL[g] ? 0.35 : 0.62, metalness: METAL[g] ? 0.7 : 0.05, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xb9c8cf, transparent: true, opacity: 0.32 });
  const parts = unpack(manifest, b64).map(p => {
    const mesh = cadMesh(p, mats[p.group], { edges: EDGES[p.group] ? 38 : 0, edgeMat });
    mesh.matrixAutoUpdate = false; rover.add(mesh);
    return { ...p, mesh, ex: new THREE.Vector3(...p.ex) };
  });
  const marker = parts.find(p => p.name === 'aruco marker');
  if (marker) {
    marker.mesh.geometry.computeBoundingBox(); const b = marker.mesh.geometry.boundingBox;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(85, 85), new THREE.MeshBasicMaterial({ map: markerTexture() }));
    m.rotation.x = -Math.PI / 2; m.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.3, (b.min.z + b.max.z) / 2); marker.mesh.add(m);
  }
  const elec = buildWiring(mats); rover.add(elec.group);
  for (const g in mats) if (!mats[g].emissive) delete mats[g];
  const lidParts = parts.filter(p => ['top plate', 'aruco marker', 'kill switch'].includes(p.name));
  const refresh = () => {
    elec.group.visible = !wiringToggle || wiringToggle.checked;
    const on = !topToggle || topToggle.checked; lidParts.forEach(p => { p.mesh.visible = on; });
  };
  wiringToggle?.addEventListener('change', refresh); topToggle?.addEventListener('change', refresh); refresh();

  const shadow = blobShadow(520, 330, 0.2); shadow.position.set(20, -0.5, 0); rover.add(shadow);
  rover.position.set(-32, -82, 0);

  let aspect = 1.3, e = 0, eT = 0, run = 1, t = 0, zoom = 0, roll = 0, drop = 0;
  slider.addEventListener('input', () => { eT = slider.value / 100; });
  list.querySelectorAll('li[data-group]').forEach(li => {
    const set = on => { for (const g in mats) mats[g].emissive.setHex(on && HILITE[li.dataset.group].includes(g) ? 0x12a152 : 0), mats[g].emissiveIntensity = 0.7; };
    li.addEventListener('pointerenter', () => set(true)); li.addEventListener('pointerleave', () => set(false));
  });
  const T = new THREE.Matrix4(), R = new THREE.Matrix4(), v = new THREE.Vector3();
  const ease = x => x * x * (3 - 2 * x), seg = (x, a, b) => ease(Math.min(1, Math.max(0, (x - a) / (b - a))));

  S.on({
    resize(w, h) { aspect = w / h; },
    frame(dt) {
      e += (eT - e) * Math.min(1, dt * 6);
      const k = ease(e);
      zoom += (((topToggle && !topToggle.checked) ? 1 : 0) - zoom) * Math.min(1, dt * 4);
      camera.position.set(0, 0, (840 + 560 * k) * (1 - 0.16 * zoom * (1 - k)) / Math.min(1, aspect / 1.3)); camera.lookAt(0, 0, 0);
      // assembled, it runs its mission on a loop: drive up, lower the diaper into the water, wait, lift it out
      run += (((k < 0.02 && !reduce) ? 1 : 0) - run) * Math.min(1, dt * 5);
      t = (t + dt * run) % 12;
      const driving = 1 - seg(t, 2.6, 3.2) + seg(t, 11.2, 11.8);
      roll += dt * 2.4 * driving * run;
      const down = (seg(t, 3.6, 5.6) - seg(t, 8.4, 10.4)) * run;
      drop = -30 * down;
      for (const p of parts) {
        const m = p.mesh.matrix;
        v.copy(p.ex).multiplyScalar(k); if (p.rack) v.y += drop;
        m.makeTranslation(v.x, v.y, v.z);
        const c = p.spin ? [p.spin[0], p.spin[1], -roll] : p.pin ? [p.pin[0], p.pin[1], drop / PITCH_R] : null;
        if (c) { T.makeTranslation(c[0], c[1], 0); R.makeRotationZ(c[2]); m.multiply(T).multiply(R); T.makeTranslation(-c[0], -c[1], 0); m.multiply(T); }
        p.mesh.matrixWorldNeedsUpdate = true;
      }
      elec.wires.visible = k < 0.03;                           // wires cannot stretch: they are put away when it is taken apart
      elec.group.children[0].visible = k < 0.03;
      const lit = down > 0.5 && run > 0.5; elec.leds.forEach(l => l.material.color.setHex(lit ? 0xfff4c9 : 0x8f8a78));
      shadow.material.opacity = 0.2 * (1 - 0.5 * k);
      if (!st.dragging && st.t - st.lastDrag > 3 && !reduce) st.yawT += Math.sin(st.t * 0.25) * 0.0006;
    },
  });
  tag.textContent = 'The team’s real CAD, running the mission. Drag to turn.';
  stage.__view = { S, st, set: x => { eT = x; slider.value = x * 100; }, rover, camera };
}
