import { startSky } from './sky.js?v=4';
import { Room, loadIso } from './room.js?v=4';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The menu bar's clock is the time of day the page has scrolled to, and the ink follows the light.
const clock = document.getElementById('clock');
let lastMinute = -1, wasNight = null;
function onHour(h, night) {
  const m = Math.floor(h * 60);
  if (m !== lastMinute) {
    lastMinute = m;
    clock.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  const dark = night > 0.4;
  if (dark !== wasNight) { document.body.classList.toggle('night', dark); wasNight = dark; }
}

// Things rise into view as they are reached.
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.2 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

startSky(document.getElementById('sky'), { citySrc: 'assets/world/skyline_newyork.webp', onHour })
  .catch(e => { console.error(e); document.body.classList.add('no-sky'); });

// 09:00 — the café, with labels pointing at its parts. Loaded on its own, so the rest of the page
// does not wait for it.
cafe().catch(e => console.error(e));
async function cafe() {
const iso = await loadIso();
await document.fonts.load('16px Sysfont');
const room = await new Room(iso, 'newyork', { rate: 0.7 }).load();
const stage = document.getElementById('cafe');
const L = iso.layout, [cw, ch] = iso.canvas;

// The café as a diorama: a raised isometric block cut from the room, with earth sides under it.
const SLAB = 22, LIFT = 150;
const block = document.createElement('canvas');
block.width = cw; block.height = ch + SLAB;
const bx = block.getContext('2d'); bx.imageSmoothingEnabled = false;
const [x0, y0, x1, y1] = [-1.2, -1.2, L.width + 1.4, L.depth + 2.4];
const T = room.project(x0, y0), R = room.project(x1, y0), B = room.project(x1, y1), Lf = room.project(x0, y1);
function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
function drawBlock() {
  bx.clearRect(0, 0, block.width, block.height);
  bx.fillStyle = '#5a3a24'; poly(bx, [Lf, B, [B[0], B[1] + SLAB], [Lf[0], Lf[1] + SLAB]]); bx.fill();
  bx.fillStyle = '#3e2718'; poly(bx, [B, R, [R[0], R[1] + SLAB], [B[0], B[1] + SLAB]]); bx.fill();
  bx.fillStyle = '#6e4a2e';                          // a band of topsoil under the pavement
  poly(bx, [Lf, B, [B[0], B[1] + 4], [Lf[0], Lf[1] + 4]]); bx.fill();
  bx.save();
  poly(bx, [[T[0], T[1] - LIFT], [R[0], R[1] - LIFT], R, B, Lf, [Lf[0], Lf[1] - LIFT]]); bx.clip();
  bx.drawImage(room.canvas, 0, 0);
  bx.restore();
}
drawBlock();
stage.prepend(block);
const labels = {
  queue: [L.path[1][0], L.path[1][1] + 3.2, 2.2],
  till: [L.stations[0][0], 3.3, 1.9],
  staff: [L.staff[2][0], L.staff[2][1], 2.3],
  machines: [L.stations[1][0] + 0.6, 0.4, 2.6],
  tables: [L.seats[1][0], L.seats[1][1], 1.3],
};
for (const [id, [x, y, z]] of Object.entries(labels)) {
  const el = stage.querySelector(`[data-at="${id}"]`);
  const [px, py] = room.project(x, y, z);
  el.style.left = (px / cw * 100) + '%';
  el.style.top = (py / (ch + SLAB) * 100) + '%';
}
let on = false;
new IntersectionObserver(([e]) => { on = e.isIntersecting; }, { threshold: 0.05 }).observe(stage);
let last = performance.now();
(function tick(now) {
  requestAnimationFrame(tick);
  const dt = (now - last) / 1000;
  if (!on || reduce || dt < 1 / 24) return;
  last = now;
  room.update(Math.min(dt, 0.1)); room.draw(now); drawBlock();
})(last);
}

// 15:00 — the iPad cycles through its screens while it is in view.
{
  const shots = [...document.querySelectorAll('#ipad-screen img')], names = [...document.querySelectorAll('#screen-names li')];
  let k = 0, seen = false;
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; }).observe(document.getElementById('ipad-screen'));
  const show = i => { shots.forEach((s, j) => s.classList.toggle('on', j === i)); names.forEach((n, j) => n.classList.toggle('on', j === i)); };
  names.forEach((n, i) => n.addEventListener('click', () => { k = i; show(k); }));
  if (!reduce) setInterval(() => { if (seen) { k = (k + 1) % shots.length; show(k); } }, 3800);
}

// 20:00 — the trailer plays itself when the monitor is on screen, silent and looping; a click pauses it.
{
  const v = document.getElementById('trailer-video'), btn = document.getElementById('trailer-play');
  // Nothing of the trailer is fetched until the monitor is close to the screen.
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    v.poster = v.dataset.poster; v.src = v.dataset.src; io.disconnect();
  }, { rootMargin: '800px' }).observe(v);
  const play = () => v.play().then(() => { btn.hidden = true; }).catch(() => { btn.hidden = false; });
  btn.addEventListener('click', play);
  v.addEventListener('click', () => { if (v.paused) play(); else { v.pause(); btn.hidden = false; } });
  if (reduce) btn.hidden = false;
  else new IntersectionObserver(([e]) => { if (e.isIntersecting) play(); else v.pause(); }, { threshold: 0.4 }).observe(v);
}

// Cafetune, the game's music: one recorded loop, fetched only when asked for and looped without a gap
// by Web Audio. Off by default, as in the game; it stops while the page is hidden.
{
  const btn = document.getElementById('music'), label = btn.querySelector('span');
  let ctx, buffer, source, gain, on = false;
  async function start() {
    ctx ??= new AudioContext();
    if (!buffer) {
      label.textContent = 'Loading…';
      buffer = await ctx.decodeAudioData(await (await fetch('assets/audio/cafetune.m4a')).arrayBuffer());
      label.textContent = on ? 'Music on' : 'Music off';
    }
    if (!on || source) return;                       // turned off while it loaded, or already playing
    gain = ctx.createGain(); gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 1.5);
    source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
    source.loopStart = 0; source.loopEnd = Math.min(buffer.duration, 106.66);
    source.connect(gain).connect(ctx.destination); source.start();
    await ctx.resume();
  }
  function stop() { try { source?.stop(); } catch {} source = null; }
  function set(v) {
    on = v; btn.setAttribute('aria-pressed', String(on)); label.textContent = on ? 'Music on' : 'Music off';
    if (on) start().catch(e => { console.error(e); set(false); }); else stop();
  }
  btn.addEventListener('click', () => set(!on));
  document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : on && ctx.resume(); });
}
