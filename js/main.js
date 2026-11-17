import { initHero } from './hero.js?v=20261116c';

const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- the blind ----
let hero = null;
try {
  hero = initHero({
    canvas: $('#blind'), heroSection: $('#top'), heroUi: $('#heroUi'), endSection: $('#contact'), endUi: $('#endUi'),
    buttons: $('#blindButtons'), btnOpen: $('#btnOpen'), btnClose: $('#btnClose'), btnLamp: $('#btnLamp'), ws: $('#ws'),
  });
} catch (e) { console.warn('hero unavailable', e); }
if (!hero) document.documentElement.classList.remove('gl', 'px');   // no canvas: the plain text hero and footer show instead

// ---- top bar follows the sheet ----
const bar = $('#bar'), sheet = $('#sheet');
function barTheme() {
  const r = sheet.getBoundingClientRect();
  bar.classList.toggle('on-sheet', r.top <= 28 && r.bottom > 28);
}
addEventListener('scroll', barTheme, { passive: true }); addEventListener('resize', barTheme); barTheme();

// ---- videos play while on screen ----
// Each clip is downloaded whole and played from memory. Safari on iPhone and iPad will not play a video
// from a server that can't send it in pieces, and some hosts can't; this way every clip plays anywhere.
const vids = [...document.querySelectorAll('video')];
const loading = new Map();
function ready(v) {
  if (loading.has(v)) return loading.get(v);
  const src = v.querySelector('source')?.getAttribute('src') || v.getAttribute('src');
  const p = fetch(src)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then(b => URL.createObjectURL(b.type ? b : new Blob([b], { type: 'video/mp4' })))
    .catch(() => src)                                        // if the download fails, let the browser try the file itself
    .then(url => { v.querySelectorAll('source').forEach(s => s.remove()); v.src = url; v.load(); });
  loading.set(v, p); return p;
}
const play = v => ready(v).then(() => v.play()).catch(() => {});
const near = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { near.unobserve(e.target); ready(e.target); } }), { rootMargin: '900px 0px' });
const vio = new IntersectionObserver(es => {
  for (const e of es) {
    const v = e.target;
    if (e.isIntersecting && !v.dataset.userPaused && !reduce) play(v);
    else v.pause();
  }
}, { threshold: 0.35 });
vids.forEach(v => { v.muted = true; v.setAttribute('muted', ''); near.observe(v); vio.observe(v); });
document.querySelectorAll('[data-toggle-video]').forEach(b => {
  const v = b.parentElement.querySelector('video');
  const sync = () => { b.textContent = v.paused ? 'Play' : 'Pause'; };
  b.addEventListener('click', () => {
    if (v.paused) { delete v.dataset.userPaused; play(v); } else { v.dataset.userPaused = '1'; v.pause(); }
  });
  v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
});

// ---- the scoreboard fills to where it really ended ----
document.querySelectorAll('#score .fill').forEach(f => { const w = parseFloat(f.dataset.w) || 0; if (w) f.style.width = w + '%'; else f.hidden = true; });

// ---- 3D drawings load when they come near ----
function lazy(el, load) {
  if (!el) return;
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); load().catch(err => { console.warn(err); const t = el.parentElement.querySelector('.ctl-tip'); if (t) t.textContent = 'The 3D view could not load on this device.'; }); }
  }, { rootMargin: '600px 0px' });
  io.observe(el);
}
lazy($('#driveStage'), async () => {
  const { initDrive } = await import('./drive.js?v=20261116c');
  await initDrive({ stage: $('#driveStage'), canvas: $('#driveCanvas'), balloons: $('#driveBalloons'), slider: $('#driveExplode'), list: $('#driveParts') });
});
lazy($('#robotStage'), async () => {
  const { initRobot } = await import('./robot.js?v=20261116c');
  await initRobot({ stage: $('#robotStage'), canvas: $('#robotCanvas'), tag: $('#robotTag'), slider: $('#robotExplode'), list: $('#robotParts'), wiringToggle: $('#robotWiring'), coverToggle: $('#robotCover') });
});
lazy($('#otvStage'), async () => {
  const { initOtv } = await import('./otv.js?v=20261116c');
  await initOtv({ stage: $('#otvStage'), canvas: $('#otvCanvas'), tag: $('#otvTag'), slider: $('#otvExplode'), list: $('#otvParts'), wiringToggle: $('#otvWiring'), topToggle: $('#otvTop') });
});
