// The blind drive in its window, modelled from the photos of the prototype. Units are millimetres.
// x runs along the head rail (the drive is at the right-hand end), y is up, z points into the room.
import * as THREE from 'three';
import { makeStage, drawingMaterial, addEdges, blobShadow, smooth } from './tech.js';

const WHITE = 0xf6f7f7, FRAME = 0xd3d9da, STEEL = 0xb9c3c8, DARK = 0x23292d;
const box = (w, h, d, mat, x = 0, y = 0, z = 0, edges = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (edges) addEdges(m); return m; };
const cylX = (r, len, mat, x, y = 0, seg = 40) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.z = Math.PI / 2; m.position.set(x, y, 0); addEdges(m, 0x111a1f, 0.5, 40); return m; };

function capShape(depth) {
  // front profile of the button box's cap: square against the rail, rounded on the outer top edge
  const s = new THREE.Shape(); const x0 = -3, x1 = 70, y0 = -13, y1 = 23, r = 15;
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0, y1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: depth - 3, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -(depth - 3) / 2); return g;
}

export function initDrive({ stage, canvas, balloons, slider, list }) {
  const S = makeStage(stage, canvas, { fov: 24, yaw: 0.56, pitch: 0.2, pitchRange: [-0.45, 0.9] });
  const { turn, camera, st } = S;
  const root = new THREE.Group(); turn.add(root);
  const mats = {};
  const mat = (name, color, o) => (mats[name] = drawingMaterial(color, o));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 9 window frame: the top and the right-hand side of a deep opening, cut away on the left and below
  const frame = new THREE.Group(); const mFrame = mat('9', FRAME);
  frame.add(box(418, 40, 172, mFrame, -91, 44, -44), box(40, 380, 172, mFrame, 98, -166, -44));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(378, 380), new THREE.MeshBasicMaterial({ color: 0xb9d6e6, transparent: true, opacity: 0.32, depthWrite: false }));
  glass.position.set(-111, -166, -120); frame.add(glass);

  // 1 the blind: head rail (an open-topped channel), tilt rod, stock tilt mechanism, slats, ladder cords
  const blind = new THREE.Group(); const mRail = mat('1', WHITE);
  blind.add(box(300, 2, 40, mRail, -150, -16, 0), box(300, 32, 2, mRail, -150, -1, 19), box(300, 32, 2, mRail, -150, -1, -19));
  const rod = box(170, 4, 4, drawingMaterial(STEEL, { metalness: 0.3 }), -215, 4, 0, false); blind.add(rod);
  blind.add(box(18, 20, 18, mRail, -131, 2, 0));
  const slats = [];
  for (let i = 0; i < 7; i++) { const s = box(296, 2.6, 50, mRail, -150, -42 - i * 43.5, 0); slats.push(s); blind.add(s); }
  const cordMat = new THREE.LineBasicMaterial({ color: 0x8b979c });
  for (const x of [-250, -70]) for (const z of [-25, 25]) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -17, z * 0.6), new THREE.Vector3(x, -322, z * 0.6)]), cordMat); blind.add(l);
  }

  // 2 hex shaft
  const shaft = new THREE.Group();
  const hex = cylX(5.5, 32, mat('2', 0xd9b56a, { metalness: 0.2, roughness: 0.5 }), -107, 4, 6); shaft.add(hex);
  // 3 gearmotor, lying in the tray
  const motor = new THREE.Group(); const mMotor = mat('3', STEEL, { metalness: 0.35, roughness: 0.45 });
  motor.add(cylX(7, 5, mMotor, -93.5, 4, 24), cylX(16, 36, mMotor, -73, 4), cylX(15.5, 42, mMotor, -34, 4), cylX(13.5, 10, drawingMaterial(DARK), -8, 4));
  // 4 the printed housing: a motor tray that slides into the rail, and the button box that stays outside
  const housing = new THREE.Group(); const mHouse = mat('4', WHITE);
  housing.add(box(98, 2.4, 33, mHouse, -48, -13.6, 0), box(98, 13, 2, mHouse, -48, -8.2, 16.4), box(98, 13, 2, mHouse, -48, -8.2, -16.4), box(2.4, 13, 33, mHouse, -95.8, -8.2, 0));
  const cap = new THREE.Mesh(capShape(50), mHouse); addEdges(cap, 0x111a1f, 0.55, 25); cap.position.z = 1; housing.add(cap);
  housing.add(box(60, 88, 44, mHouse, 32, -56.5, 1));
  // 5 buttons and LED
  const ctl = new THREE.Group(); const bez = drawingMaterial(DARK); mat('5', 0x1d9c4f);
  const mkBtn = (m, x) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 5, 32), bez); b.rotation.x = Math.PI / 2; addEdges(b, 0x111a1f, 0.4, 40);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 7, 7, 32), m); c.rotation.x = Math.PI / 2; c.position.z = 5; addEdges(c, 0x111a1f, 0.4, 40);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 18, 20), bez); stem.rotation.x = Math.PI / 2; stem.position.z = -11;
    g.add(b, c, stem); g.position.set(x, -62, 25.5); return g;
  };
  ctl.add(mkBtn(mats['5'], 19), mkBtn(drawingMaterial(0xc2332b), 45));
  const led = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 6, 16), new THREE.MeshBasicMaterial({ color: 0x6fb6ff })); led.rotation.x = Math.PI / 2; led.position.set(32, -82, 23.5); ctl.add(led);

  // 8 electronics enclosure, fixed under the top of the frame behind the blind: a long shallow tier for the
  //   battery pack and a deeper tier for the Arduino. 6 the two boards, 7 the battery pack.
  const enc = new THREE.Group(); const mEnc = mat('8', WHITE);
  const shell = new THREE.Group();
  const wall = (w, h, d, x, y, z) => shell.add(box(w, h, d, mEnc, x, y, z));
  wall(152, 24, 2.4, -124, 12, -41.2); wall(152, 24, 2.4, -124, 12, -110.8); wall(2.4, 24, 72, -198.8, 12, -76); wall(60, 2.4, 72, -170, 1.2, -76);   // shallow tier
  wall(92, 50, 2.4, -94, -25, -41.2); wall(92, 50, 2.4, -94, -25, -110.8); wall(2.4, 50, 72, -138.8, -25, -76); wall(2.4, 74, 72, -49.2, -13, -76); wall(92, 2.4, 72, -94, -48.8, -76);   // deep tier
  const lid = box(156, 2.4, 76, mEnc, -124, 22.8, -76);
  const uno = box(68.6, 1.8, 53.4, mat('6', 0x12808a), -94, -40, -76);
  const shield = box(68.6, 1.8, 53.4, drawingMaterial(0x2456a8), -94, -28, -76);
  const hdr = drawingMaterial(DARK);
  shield.add(box(48, 9, 2.5, hdr, 2, -5.5, 24, false), box(42, 9, 2.5, hdr, -4, -5.5, -24, false), box(16, 9, 10, drawingMaterial(0x2f6fd0), 22, 5.5, 18));
  uno.add(box(12, 11, 16, drawingMaterial(STEEL, { metalness: 0.4 }), -30, 6, -12), box(9, 11, 14, hdr, -31, 6, 14));
  const batt = box(112, 15, 58, mat('7', DARK), -128, 13.5, -76);
  enc.add(shell, lid, uno, shield, batt);
  // sheathed cable from the enclosure, behind the blind, to the back of the button box
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-50, 8, -78), new THREE.Vector3(-26, 2, -86), new THREE.Vector3(8, -22, -74), new THREE.Vector3(30, -44, -44), new THREE.Vector3(33, -50, -21)]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 3.2, 8), new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6, transparent: true }));

  root.add(frame, blind, shaft, motor, housing, ctl, enc, cable);
  const shadow = blobShadow(640, 300, 0.12); shadow.position.set(-80, -372, -30); root.add(shadow);
  const home = new THREE.Vector3(86, 127, 30), away = new THREE.Vector3(66, 112, -70);

  // taking it apart: first the blind comes forward out of the window, then the drive slides out of the rail
  const P = (o, a, b) => ({ o, home: o.position.clone(), a: new THREE.Vector3(...a), b: new THREE.Vector3(...b) });
  const moves = [
    P(blind, [0, 0, 196], [0, 0, 0]), P(shaft, [0, 0, 196], [112, 0, 0]), P(motor, [0, 0, 196], [150, 46, 0]),
    P(housing, [0, 0, 196], [150, 0, 0]), P(ctl, [0, 0, 196], [150, 0, 54]),
    P(enc, [0, 0, 0], [-205, -36, 60]), P(shell, [0, 0, 0], [0, -92, 0]), P(uno, [0, 0, 0], [0, -34, 0]), P(shield, [0, 0, 0], [0, -14, 0]), P(batt, [0, 0, 0], [0, -26, 0]),
  ];

  const B = [
    [1, blind, [-285, -129, 22], [-0.07, 0.06], 0], [2, shaft, [-107, 10, 0], [0.0, -0.15], 0.62], [3, motor, [-40, 20, 0], [0.07, -0.09], 0.62],
    [4, housing, [30, 23, 20], [0.09, -0.09], 0], [5, ctl, [45, -62, 34], [0.1, 0.035], 0],
    [6, shield, [-70, -27, -50], [0.11, 0.05], 0.78], [7, batt, [-80, 13, -47], [0.08, -0.03], 0.78], [8, enc, [-190, 24, -45], [-0.03, -0.11], 0.62],
    [9, frame, [-180, 44, 42], [-0.03, -0.065], 0],
  ].map(([n, obj, p, off, min]) => {
    const el = document.createElement('div'); el.className = 'balloon'; el.textContent = n; balloons.appendChild(el);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); balloons.querySelector('svg').appendChild(line);
    return { n, obj, p: new THREE.Vector3(...p), off, min, el, line, a: { x: 0, y: 0 } };
  });

  let e = 0, eT = 0, auto = true, hot = null, aspect = 1.45, spin = 0;
  slider.addEventListener('input', () => { auto = false; eT = slider.value / 100; });
  const setHot = n => {
    hot = n;
    for (const k in mats) mats[k].emissive.setHex(String(n) === k ? 0x0e7c3f : 0x000000), mats[k].emissiveIntensity = 0.55;
    B.forEach(b => b.el.classList.toggle('hot', b.n === n));
    list.querySelectorAll('li').forEach(li => li.classList.toggle('hot', Number(li.dataset.part) === n));
  };
  list.querySelectorAll('li').forEach(li => {
    const n = Number(li.dataset.part);
    li.addEventListener('pointerenter', () => setHot(n)); li.addEventListener('pointerleave', () => setHot(null));
    li.addEventListener('click', () => setHot(hot === n ? null : n));
  });

  S.on({
    resize(w, h) { aspect = w / h; },
    frame(dt) {
      if (auto) { eT = reduce ? 1 : S.arrival(); slider.value = Math.round(eT * 100); }
      e += (eT - e) * Math.min(1, dt * 6);
      const a = smooth(0, 0.5, e), b = smooth(0.4, 1, e);
      for (const m of moves) m.o.position.copy(m.home).addScaledVector(m.a, a).addScaledVector(m.b, b);
      root.position.lerpVectors(home, away, e * e * (3 - 2 * e));
      camera.position.set(0, 0, (1090 + 300 * e) / Math.min(1, aspect / 1.45)); camera.lookAt(0, 0, 0);
      cable.material.opacity = 1 - smooth(0.02, 0.12, e); cable.visible = e < 0.12;
      // assembled, it runs: the motor turns the shaft and rod, and the slats tilt open and closed
      const run = (1 - smooth(0, 0.06, e)) * (reduce ? 0 : 1);
      spin += dt * run;
      const tilt = 0.62 + 0.5 * Math.sin(spin * 0.9) * (run > 0 ? 1 : 0);
      for (const s of slats) s.rotation.x = tilt;
      hex.rotation.x = rod.rotation.x = tilt * 3;
      led.material.color.setHex(run > 0.5 ? 0x6fb6ff : 0x39506a);
      if (!st.dragging && st.t - st.lastDrag > 3 && !reduce) st.yawT += Math.sin(st.t * 0.3) * 0.0005;
    },
    after() {
      const u = Math.min(st.w, st.h);
      for (const bl of B) {
        S.project(bl.obj, bl.p, bl.a);
        const show = e >= bl.min ? 1 : 0;
        const bx = bl.a.x + bl.off[0] * u, by = bl.a.y + bl.off[1] * u;
        bl.el.style.transform = `translate(${bx.toFixed(1)}px,${by.toFixed(1)}px)`; bl.el.style.opacity = show;
        const dx = bl.a.x - bx, dy = bl.a.y - by, len = Math.hypot(dx, dy) || 1;
        bl.line.setAttribute('x1', bx + dx / len * 13); bl.line.setAttribute('y1', by + dy / len * 13);
        bl.line.setAttribute('x2', bl.a.x); bl.line.setAttribute('y2', bl.a.y); bl.line.style.opacity = show ? '' : 0;
      }
    },
  });
  stage.__view = { S, set: v => { auto = false; eT = v; slider.value = v * 100; } };
}
