// The robot: Dom's real SolidWorks assembly, rigged at its eight servo axes and walking the trot gait.
import * as THREE from 'three';
import { makeStage, blobShadow, smooth, creased } from './tech.js?v=20261116b';
import { buildElectronics } from './wiring.js';

const COLORS = { body: 0x2a3035, cover: 0x30373c, link: 0x2a3035, arm: 0x2a3035, foot: 0x2a3035, servo: 0x171b1e, pcb: 0x1f7a4d, battery: 0x3d6fb4, switch: 0x101214, hw: 0xaab4b9 };
const EDGES = { body: 1, cover: 1, link: 1, arm: 1, foot: 1, servo: 1, battery: 1 };
const HILITE = { body: ['body', 'cover'], pcb: ['pcb', 'switch'], servo: ['servo'], leg: ['link', 'arm', 'foot'] };

export async function initRobot({ stage, canvas, tag, slider, list, wiringToggle, coverToggle }) {
  const [{ manifest, b64 }, { wiring }] = await Promise.all([import('./robot-data.js'), import('./wiring-data.js')]);
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  const S = makeStage(stage, canvas, { fov: 22, yaw: Math.PI - 0.62, pitch: 0.42, pitchRange: [0.05, 1.5] });
  const { turn, camera, st } = S;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const robot = new THREE.Group(); turn.add(robot);
  const bodyG = new THREE.Group(); robot.add(bodyG);

  const mats = {};
  for (const g in COLORS) mats[g] = new THREE.MeshStandardMaterial({ color: COLORS[g], roughness: g === 'hw' ? 0.35 : 0.62, metalness: g === 'hw' ? 0.7 : 0.05, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xb9c8cf, transparent: true, opacity: 0.3 });

  const { lo, span } = manifest;
  const parts = manifest.parts.map(p => {
    const q = new Uint16Array(bin, p.vo, p.vn * 3), pos = new Float32Array(p.vn * 3);
    for (let i = 0; i < p.vn; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = lo[k] + q[i * 3 + k] / 65535 * span[k];
    const idx = p.i32 ? new Uint32Array(bin, p.io, p.tn * 3) : new Uint16Array(bin, p.io, p.tn * 3);
    const mesh = new THREE.Mesh(creased(pos, idx, Math.cos(0.6)), mats[p.group]);
    if (EDGES[p.group]) {
      const ig = new THREE.BufferGeometry(); ig.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ig.setIndex(new THREE.BufferAttribute(idx, 1));
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(ig, 38), edgeMat); mesh.add(e); ig.dispose();
    }
    mesh.matrixAutoUpdate = false; bodyG.add(mesh);
    return { ...p, mesh };
  });

  // eyes: the two OLED displays on the face
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x35e0d0 });
  const eyes = new THREE.Group();
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(8, 9), eyeMat); e.position.set(sx * 9.5, 0, 0); e.rotation.y = Math.PI; eyes.add(e);
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(46, 17), new THREE.MeshStandardMaterial({ color: 0x0c0f11, roughness: 0.3 })); face.rotation.y = Math.PI; face.position.z = 0.4; eyes.add(face);
  eyes.position.set(0, 24, -53.4); bodyG.add(eyes);

  // ---- rig ----
  const Y = new THREE.Vector3(0, 1, 0);
  const legs = manifest.joints.map((j, i) => {
    const hip = new THREE.Vector3(...j.hip), knee = new THREE.Vector3(...j.knee), axis = new THREE.Vector3(...j.kneeAxis).normalize(), tip = new THREE.Vector3(...j.tip);
    const side = Math.sign(hip.x), front = hip.z < 0;
    // even out the CAD pose: same splay left and right
    const cur = Math.atan2(knee.z - hip.z, (knee.x - hip.x) * side);       // + is toward the back
    const want = front ? -0.30 : 0.19;
    const hip0 = -(want - cur) * side;
    // knee angle that puts the foot on the ground, and which way lifts it
    const tipAt = b => tip.clone().sub(knee).applyAxisAngle(axis, b).add(knee);
    const up = tipAt(0.1).y > tip.y ? 1 : -1;
    let a = -0.6, c = 0.6;
    for (let k = 0; k < 30; k++) { const m = (a + c) / 2; (tipAt(m * up).y > 0) ? (c = m) : (a = m); }
    const out = new THREE.Vector3(hip.x, 0, hip.z * 0.55).normalize();
    return { hip, knee, axis, side, front, hip0, knee0: (a + c) / 2 * up, up, out, phase: (i === 0 || i === 3) ? 0 : 0.5, Mh: new THREE.Matrix4(), Mk: new THREE.Matrix4() };
  });
  const T = new THREE.Matrix4(), R = new THREE.Matrix4(), X = new THREE.Matrix4();
  const about = (out, point, axis, angle, shift) => {
    out.makeTranslation(point.x + (shift ? shift.x : 0), point.y + (shift ? shift.y : 0), point.z + (shift ? shift.z : 0));
    R.makeRotationAxis(axis, angle); out.multiply(R); T.makeTranslation(-point.x, -point.y, -point.z); out.multiply(T); return out;
  };

  const shadow = blobShadow(430, 300, 0.2); shadow.position.y = -0.5; robot.add(shadow);
  robot.position.y = -34;

  let aspect = 1.3, zoom = 0;
  // electronics: boards, servo leads and wires (see wiring.js)
  const elec = buildElectronics(wiring, legs); bodyG.add(elec.group);
  const coverParts = parts.filter(p => p.group === 'cover' || p.group === 'battery');
  const refresh = () => {
    elec.group.visible = !wiringToggle || wiringToggle.checked;
    const cov = !coverToggle || coverToggle.checked; coverParts.forEach(p => { p.mesh.visible = cov; }); elec.setCover(cov);
  };
  wiringToggle?.addEventListener('change', refresh); coverToggle?.addEventListener('change', refresh); refresh();
  let e = 0, eT = 0, walk = 1, gaitT = 0, heading = 0, blink = 0, nextBlink = 2;
  slider.addEventListener('input', () => { eT = slider.value / 100; });
  const sh = new THREE.Vector3(), sh2 = new THREE.Vector3();

  list.querySelectorAll('li').forEach(li => {
    const set = on => { for (const g in mats) mats[g].emissive.setHex(on && HILITE[li.dataset.group].includes(g) ? 0x12a152 : 0), mats[g].emissiveIntensity = 0.7; };
    li.addEventListener('pointerenter', () => set(true)); li.addEventListener('pointerleave', () => set(false));
  });

  S.on({
    resize(w, h) { aspect = w / h; },
    frame(dt) {
      e += (eT - e) * Math.min(1, dt * 6);
      const k = e * e * (3 - 2 * e);
      zoom += (((coverToggle && !coverToggle.checked) ? 1 : 0) - zoom) * Math.min(1, dt * 4);
      camera.position.set(0, 0, (800 + 250 * k) * (1 - 0.46 * zoom * (1 - k)) / Math.min(1, aspect / 1.3)); camera.lookAt(0, 0, 0);
      walk += (((k < 0.02 && !reduce) ? 1 : 0) - walk) * Math.min(1, dt * 5);
      gaitT += dt * 1.25 * walk;
      // the robot turns toward the pointer; left alone it looks around slowly
      const want = st.hover && !st.dragging ? st.px * 0.5 : Math.sin(st.t * 0.3) * 0.22;
      heading += (want * walk - heading) * Math.min(1, dt * 2.5);
      robot.rotation.y = heading;
      const bob = Math.sin(gaitT * Math.PI * 4) * 1.1 * walk;
      bodyG.position.y = bob; bodyG.rotation.z = Math.sin(gaitT * Math.PI * 2) * 0.018 * walk;

      for (const L of legs) {
        const ph = (gaitT + L.phase) % 1;
        // stance: foot sweeps back. swing: eased return with a raised-cosine lift.
        let sweep, lift = 0;
        if (ph < 0.5) sweep = 1 - ph * 4;                       //  +1 .. -1
        else { const u = (ph - 0.5) * 2, s = u * u * (3 - 2 * u); sweep = -1 + 2 * s; lift = 0.5 - 0.5 * Math.cos(u * Math.PI * 2); }
        const hipA = L.hip0 * (1 - 0) + L.side * sweep * 0.2 * walk;
        const kneeA = L.knee0 + L.up * lift * 0.34 * walk;
        sh.copy(L.out).multiplyScalar(30 * k);
        L.delta = hipA - L.hip0;
        about(L.Mh, L.hip, Y, hipA, sh);
        sh2.copy(L.out).multiplyScalar(26 * k).setY(0);
        about(X, L.knee, L.axis, kneeA, sh2); L.Mk.multiplyMatrices(L.Mh, X);
      }
      for (const p of parts) {
        const m = p.mesh.matrix;
        if (p.leg < 0) {
          const dy = p.group === 'cover' ? 78 : p.group === 'battery' ? 46 : p.group === 'pcb' ? 14 : 0;
          m.makeTranslation(0, dy * k, p.group === 'switch' ? 0 : 0);
        } else {
          const L = legs[p.leg];
          if (p.level === 0) m.makeTranslation(L.out.x * 12 * k, 26 * k, L.out.z * 12 * k);
          else if (p.level === 1) { m.copy(L.Mh); if (p.group === 'servo') { T.makeTranslation(0, 30 * k, 0); m.premultiply(T); } }
          else { m.copy(L.Mk); if (p.group === 'foot') { T.makeTranslation(L.out.x * 18 * k, 0, L.out.z * 18 * k); m.premultiply(T); } if (p.group === 'hw') { T.makeTranslation(0, 22 * k, 0); m.premultiply(T); } }
        }
        p.mesh.matrixWorldNeedsUpdate = true;
      }
      elec.update(k, legs);
      // blink
      nextBlink -= dt; if (nextBlink < 0) { blink = 1; nextBlink = 2.2 + Math.random() * 3; }
      blink = Math.max(0, blink - dt * 7);
      const lid = 1 - Math.sin(Math.min(1, blink) * Math.PI) * 0.9;
      eyes.children[0].scale.y = eyes.children[1].scale.y = lid;
      shadow.material.opacity = 0.2 * (1 - 0.5 * k);
    },
  });
  tag.textContent = 'The real CAD, walking its trot gait. Drag to turn.';
  stage.__view = { S, set: v => { eT = v; slider.value = v * 100; }, robot, camera };
}
