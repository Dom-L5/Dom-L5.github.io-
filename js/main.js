import { initHero } from './hero.js';

const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- the blind ----
let hero = null;
try {
  hero = initHero({
    canvas: $('#blind'), heroSection: $('#top'), heroUi: $('#heroUi'), heroName: $('#heroName'), hint: $('#heroHint'),
    endSection: $('#contact'), endUi: $('#endUi'), buttons: $('#blindButtons'), btnOpen: $('#btnOpen'), btnClose: $('#btnClose'),
  });
} catch (e) { console.warn('blind unavailable', e); }

// ---- top bar follows the sheet ----
const bar = $('#bar'), sheet = $('#sheet');
function barTheme() {
  const r = sheet.getBoundingClientRect();
  bar.classList.toggle('on-sheet', r.top <= 28 && r.bottom > 28);
}
addEventListener('scroll', barTheme, { passive: true }); addEventListener('resize', barTheme); barTheme();

// ---- videos play while on screen ----
const vids = [...document.querySelectorAll('video')];
const vio = new IntersectionObserver(es => {
  for (const e of es) {
    const v = e.target;
    if (e.isIntersecting && !v.dataset.userPaused && !reduce) v.play().catch(() => {});
    else v.pause();
  }
}, { threshold: 0.35 });
vids.forEach(v => vio.observe(v));
document.querySelectorAll('[data-toggle-video]').forEach(b => {
  const v = b.parentElement.querySelector('video');
  const sync = () => { b.textContent = v.paused ? 'Play' : 'Pause'; };
  b.addEventListener('click', () => {
    if (v.paused) { delete v.dataset.userPaused; v.play().catch(() => {}); } else { v.dataset.userPaused = '1'; v.pause(); }
  });
  v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
});

// ---- PickyPal: the method, step by step ----
const steps = [
  'Completely avoidant.',
  'Just smell it.',
  'One small bite.',
  'A little more with dinner, every night.',
  'Comfortable. On to the next food.',
];
const ladderBtns = [...document.querySelectorAll('#ladder button')], read = $('#ladderRead');
function setStep(i) {
  ladderBtns.forEach((b, k) => b.setAttribute('aria-pressed', k <= i ? 'true' : 'false'));
  read.innerHTML = `<b>Chicken, step ${i + 1} of 5.</b> ${steps[i]}`;
}
ladderBtns.forEach((b, i) => b.addEventListener('click', () => setStep(i)));

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
  const { initDrive } = await import('./drive.js');
  initDrive({ stage: $('#driveStage'), canvas: $('#driveCanvas'), balloons: $('#driveBalloons'), slider: $('#driveExplode'), list: $('#driveParts') });
});
lazy($('#robotStage'), async () => {
  const { initRobot } = await import('./robot.js');
  await initRobot({ stage: $('#robotStage'), canvas: $('#robotCanvas'), tag: $('#robotTag'), slider: $('#robotExplode'), list: $('#robotParts'), wiringToggle: $('#robotWiring'), coverToggle: $('#robotCover') });
});
