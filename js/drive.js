// The blind drive in its window. The printed motor holder and the electronics enclosure are Dom's real STL files;
// the blind, motor, boards and window are modelled from the photos of the prototype. Units are millimetres.
// x runs along the head rail (the drive is at the right-hand end), y is up, z points into the room.
import * as THREE from 'three';
import { makeStage, drawingMaterial, addEdges, blobShadow, smooth, unpack, cadMesh } from './tech.js?v=20261116';

const WHITE = 0xf6f7f7, FRAME = 0xd3d9da, STEEL = 0xb9c3c8, DARK = 0x23292d;
const box = (w, h, d, mat, x = 0, y = 0, z = 0, edges = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (edges) addEdges(m); return m; };
const cylX = (r, len, mat, x, y = 0, seg = 40) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.z = Math.PI / 2; m.position.set(x, y, 0); addEdges(m, 0x111a1f, 0.5, 40); return m; };

export async function initDrive({ stage, canvas, balloons, slider, list }) {
  const { manifest, b64 } = await import('./drive-data.js');
  const cad = Object.fromEntries(unpack(manifest, b64).map(p => [p.name, p]));
  const S = makeStage(stage, canvas, { fov: 24, yaw: 0.56, pitch: 0.2, pitchRange: [-0.45, 0.9] });
  const { turn, camera, st } = S;
  const root = new THREE.Group(); turn.add(root);
  const mats = {};
  const mat = (name, color, o) => (mats[name] = drawingMaterial(color, o));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 9 window frame: the top and the right-hand side of a deep opening, cut away on the left and below.
  //   The blind is an outside mount: its head rail is screwed to the FRONT of the frame, so the slats cover the whole
  //   opening, the button box hangs off to the right, and the opening behind the blind is free for the enclosure.
  const frame = new THREE.Group(); const mFrame = mat('9', FRAME);
  frame.add(box(320, 50, 130, mFrame, -140, 11, -93), box(50, 342, 130, mFrame, -5, -185, -93));
  frame.add(box(22, 24, 8, mFrame, -262, 0, -24), box(22, 24, 8, mFrame, -70, 0, -24));   // the two mounting brackets
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(270, 342), new THREE.MeshBasicMaterial({ color: 0xb9d6e6, transparent: true, opacity: 0.32, depthWrite: false }));
  glass.position.set(-165, -185, -140); frame.add(glass); frame.position.z = -8;

  // 1 the blind: head rail (an open-topped channel, sized to take the printed motor tray), tilt rod, stock tilt mechanism, slats, ladder cords
  const blind = new THREE.Group(); const mRail = mat('1', WHITE);
  blind.add(box(300, 2, 58, mRail, -150, -31, 0), box(300, 52, 2, mRail, -150, -5, 28), box(300, 52, 2, mRail, -150, -5, -28));
  const rod = box(188, 4, 4, drawingMaterial(STEEL, { metalness: 0.3 }), -206, 0, 0, false); blind.add(rod);
  blind.add(box(18, 22, 18, mRail, -142, -3, 0));
  const slats = [];
  for (let i = 0; i < 7; i++) { const s = box(296, 2.6, 50, mRail, -150, -58 - i * 43.5, 0); slats.push(s); blind.add(s); }
  const cordMat = new THREE.LineBasicMaterial({ color: 0x8b979c });
  for (const x of [-250, -70]) for (const z of [-25, 25]) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -32, z * 0.6), new THREE.Vector3(x, -338, z * 0.6)]), cordMat); blind.add(l);
  }

  // 2 hex shaft
  const shaft = new THREE.Group();
  const hex = cylX(5.5, 32, mat('2', 0xd9b56a, { metalness: 0.2, roughness: 0.5 }), -96, 0, 6); shaft.add(hex);
  // 3 gearmotor: the gearbox lies in the tray, the motor's back end sits in the bore of the cap
  const motor = new THREE.Group(); const mMotor = mat('3', STEEL, { metalness: 0.35, roughness: 0.45 });
  motor.add(cylX(8, 6, mMotor, -77, 0, 24), cylX(21.5, 34, mMotor, -57, 0), cylX(20.5, 62, mMotor, -9, 0), cylX(16, 10, drawingMaterial(DARK), 27, 0));
  // 4 the printed motor holder (the real STL): a tray that slides into the rail, a cap that stays outside it,
  //   and the plate that hangs down from the cap with the holes for the two buttons and the LED
  const housing = new THREE.Group(); const mHouse = mat('4', WHITE);
  housing.add(cadMesh(cad.holder, mHouse, { edges: 30 }));
  // 5 buttons and LED, in the holes of the plate
  const ctl = new THREE.Group(); const bez = drawingMaterial(DARK); mat('5', 0x1d9c4f);
  const mkBtn = (m, x) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 4, 32), bez); b.rotation.x = Math.PI / 2; addEdges(b, 0x111a1f, 0.4, 40);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.8, 7, 32), m); c.rotation.x = Math.PI / 2; c.position.z = 5; addEdges(c, 0x111a1f, 0.4, 40);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(7.3, 7.3, 22, 20), bez); stem.rotation.x = Math.PI / 2; stem.position.z = -13;
    g.add(b, c, stem); g.position.set(x, -53.9, 32.2); return g;
  };
  ctl.add(mkBtn(mats['5'], 16.4), mkBtn(drawingMaterial(0xc2332b), 54.5));
  const led = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 7, 16), new THREE.MeshBasicMaterial({ color: 0x6fb6ff })); led.rotation.x = Math.PI / 2; led.position.set(35.5, -69.7, 29); ctl.add(led);

  // 8 electronics enclosure (the real STL), fixed under the top of the opening, behind the blind. It is one box, deep at the
  //   drive end for the Arduino and shallow along the top for the battery pack, closed by an end cap with the cable hole.
  //   6 the two boards, 7 the battery pack.
  const enc = new THREE.Group(); const mEnc = mat('8', WHITE);
  const shell = cadMesh(cad.shell, mEnc, { edges: 30 }), lid = cadMesh(cad.lid, mEnc, { edges: 30 });
  const uno = box(68.6, 1.8, 53.4, mat('6', 0x12808a), -92, -80, -81.2);
  const shield = box(68.6, 1.8, 53.4, drawingMaterial(0x2456a8), -92, -68, -81.2);
  const hdr = drawingMaterial(DARK);
  shield.add(box(48, 9, 2.5, hdr, 2, -5.5, 24, false), box(42, 9, 2.5, hdr, -4, -5.5, -24, false), box(16, 9, 10, drawingMaterial(0x2f6fd0), 22, 5.5, 18));
  uno.add(box(12, 11, 16, drawingMaterial(STEEL, { metalness: 0.4 }), 30, 6, -12), box(9, 11, 14, hdr, 31, 6, 14));
  const batt = box(112, 15, 58, mat('7', DARK), -120, -27, -81.2);
  enc.add(shell, lid, uno, shield, batt);
  // sheathed cable from the hole in the end cap, round the front of the frame behind the blind, to the back of the buttons
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-46, -52.5, -81.8), new THREE.Vector3(-38, -52, -66), new THREE.Vector3(-36, -51, -44), new THREE.Vector3(-26, -50, -32.5), new THREE.Vector3(8, -50, -32), new THREE.Vector3(27, -52, -22), new THREE.Vector3(35, -54, 6)]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 2.6, 8), new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6, transparent: true }));

  root.add(frame, blind, shaft, motor, housing, ctl, enc, cable);
  const shadow = blobShadow(640, 300, 0.12); shadow.position.set(-80, -388, -30); root.add(shadow);
  const home = new THREE.Vector3(86, 152, 30), away = new THREE.Vector3(80, 130, -70);

  // taking it apart: first the blind comes forward out of the window, then the drive slides out of the rail
  const P = (o, a, b) => ({ o, home: o.position.clone(), a: new THREE.Vector3(...a), b: new THREE.Vector3(...b) });
  const moves = [
    P(blind, [0, 0, 196], [0, 0, 0]), P(shaft, [0, 0, 196], [20, 0, 0]), P(motor, [0, 0, 196], [72, 0, 0]),
    P(housing, [0, 0, 196], [196, 0, 0]), P(ctl, [0, 0, 196], [196, 0, 52]),
    P(enc, [0, 0, 0], [-190, -30, 150]), P(shell, [0, 0, 0], [-132, 0, 0]), P(lid, [0, 0, 0], [40, 0, 0]), P(uno, [0, 0, 0], [0, -12, 0]), P(batt, [0, 0, 0], [0, 8, 0]),
  ];

  const B = [
    [1, blind, [-285, -150, 22], [-0.07, 0.06], 0], [2, shaft, [-96, 6, 0], [0.0, -0.15], 0.62], [3, motor, [-20, 21, 0], [0.04, -0.12], 0.62],
    [4, housing, [50, 29, 0], [0.09, -0.09], 0], [5, ctl, [54.5, -54, 40], [0.1, 0.035], 0],
    [6, shield, [30, 1, 27], [0.1, 0.06], 0.78], [7, batt, [50, 8, 29], [0.1, -0.03], 0.78], [8, shell, [-150, -15, -41], [-0.04, -0.11], 0.62],
    [9, frame, [-190, 36, -28], [-0.03, -0.065], 0],
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
      camera.position.set(0, 0, (1130 + 400 * e) / Math.min(1, aspect / 1.45)); camera.lookAt(0, 0, 0);
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
  stage.__view = { S, st, set: v => { auto = false; eT = v; slider.value = v * 100; } };
}
