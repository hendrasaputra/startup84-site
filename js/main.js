import * as THREE from 'three';
import { Room, loadIso } from './room.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------------------------
// The hero: a live café on a card that tilts toward the pointer, with cups, beans and coins
// drifting round it.

async function hero(iso) {
  const host = document.getElementById('hero-stage');
  const room = await new Room(iso, 'newyork', { rate: 0.6 }).load();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 10, 6000);
  camera.position.set(0, 0, 1500);

  scene.add(new THREE.HemisphereLight(0xffe7c2, 0x2a1d12, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(-400, 600, 900);
  scene.add(sun);

  // The room card.
  const tex = new THREE.CanvasTexture(room.canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
  const card = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(640, 480), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = 9;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(660, 500, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.6, metalness: 0.1 }));
  const rim = new THREE.Mesh(new THREE.BoxGeometry(672, 512, 4),
    new THREE.MeshStandardMaterial({ color: 0xe8a33d, emissive: 0xb5651d, emissiveIntensity: 0.35, roughness: 0.4 }));
  rim.position.z = -7;
  card.add(rim, slab, face);
  scene.add(card);

  // Things that drift: cups, beans, coins.
  const props = new THREE.Group(); scene.add(props);
  const cupShape = [[0, 0], [34, 0], [40, 6], [44, 60], [46, 64], [0, 64]].map(([x, y]) => new THREE.Vector2(x, y));
  const cupGeo = new THREE.LatheGeometry(cupShape, 28);
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xf4ead5, roughness: 0.35 });
  const coffeeMat = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.2 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0xb5651d, roughness: 0.7 });
  const beanGeo = new THREE.SphereGeometry(16, 20, 14); beanGeo.scale(1, 0.7, 0.55);
  const beanMat = new THREE.MeshStandardMaterial({ color: 0x5a3420, roughness: 0.45 });
  const coinGeo = new THREE.CylinderGeometry(22, 22, 5, 32);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.75, roughness: 0.3 });
  function cup() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(cupGeo, cupMat));
    const top = new THREE.Mesh(new THREE.CircleGeometry(42, 28), coffeeMat);
    top.rotation.x = -Math.PI / 2; top.position.y = 58; g.add(top);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(43.5, 41, 22, 28, 1, true), sleeveMat);
    sleeve.position.y = 32; g.add(sleeve);
    return g;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const drift = [];
  const spots = [[-350, 200], [370, -190], [-370, -170], [350, 190], [-190, -215], [210, 215], [395, 20], [-400, 30], [-40, 225], [90, -225]];
  spots.forEach(([x, y], i) => {
    const m = i % 3 === 0 ? cup() : i % 3 === 1 ? new THREE.Mesh(beanGeo, beanMat) : new THREE.Mesh(coinGeo, coinMat);
    m.position.set(x, y, rnd(40, 220));
    m.scale.setScalar(i % 3 === 0 ? 0.75 : 1.1);
    m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
    props.add(m);
    drift.push({ m, base: m.position.clone(), spin: new THREE.Vector3(rnd(-.4, .4), rnd(-.6, .6), rnd(-.3, .3)), ph: rnd(0, 6) });
  });

  // Fit: the card fills most of the stage, so the pixels stay big.
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const fit = Math.max(660 / (w / h), 500) * 1.04;           // card height in world units to show
    camera.position.z = fit / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();

  const pointer = { x: 0, y: 0 }, tilt = { x: 0, y: 0 };
  addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1; });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);

  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    acc += dt;
    if (!reduce && acc >= 1 / 24) {                          // the room at 24 fps, like the game's pixels
      room.update(acc); room.draw(now); tex.needsUpdate = true; acc = 0;
    }
    const t = now / 1000;
    tilt.x += ((reduce ? 0 : pointer.y * 0.16) - tilt.x) * 0.06;
    tilt.y += ((reduce ? 0 : pointer.x * 0.24) - tilt.y) * 0.06;
    card.rotation.set(-0.08 + tilt.x, -0.12 + tilt.y, 0);
    card.position.y = reduce ? 0 : Math.sin(t * 0.8) * 8;
    for (const d of drift) {
      if (reduce) break;
      d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; d.m.rotation.z += d.spin.z * dt;
      d.m.position.y = d.base.y + Math.sin(t * 0.7 + d.ph) * 18;
      d.m.position.x = d.base.x + pointer.x * -30;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  host.classList.add('ready');
}

// ---------------------------------------------------------------------------------------------
// The cities: each card is a live room in that city's own street and interior, drawn into a plain
// canvas; only the cards on screen move.

const CITIES = [
  ['home', 'Your home town', 'Where it starts. One café on a campus street.', 'Start here'],
  ['jakarta', 'Jakarta', 'The biggest crowds. Coffee stalls on every corner.', 'Good for cafés'],
  ['bandung', 'Bandung', 'A cool highland city known for its bakeries.', 'Good for bakeries'],
  ['yangon', 'Yangon', 'Teashops and snacks. Cheap to enter, slow to build.', 'Good for kiosks'],
  ['newyork', 'New York', 'The most expensive city. Fast to build, most business slots.', 'Good for cake shops'],
  ['boston', 'Boston', 'Brownstones, commuters and students.', 'Good for cafés'],
  ['annarbor', 'Ann Arbor', 'A college town. Six student streets, one business street.', 'Good for kiosks'],
];

async function cities(iso) {
  const track = document.getElementById('city-track');
  const live = [];
  for (const [theme, name, line, tag] of CITIES) {
    const card = document.createElement('article');
    card.className = 'city';
    card.innerHTML = `<div class="city-view"></div><div class="city-text"><span class="tag">${tag}</span><h3>${name}</h3><p>${line}</p></div>`;
    track.appendChild(card);
    const room = await new Room(iso, theme, { rate: 0.35 }).load();
    card.querySelector('.city-view').appendChild(room.canvas);
    const entry = { room, on: false };
    new IntersectionObserver(([e]) => { entry.on = e.isIntersecting; }).observe(card);
    live.push(entry);
  }
  if (reduce) return;
  let last = performance.now();
  (function tick(now) {
    requestAnimationFrame(tick);
    const dt = (now - last) / 1000;
    if (dt < 1 / 20) return;
    last = now;
    for (const e of live) if (e.on) { e.room.update(Math.min(dt, 0.1)); e.room.draw(now); }
  })(last);

  // The row scrolls sideways as the page scrolls down past it.
  const section = document.getElementById('cities');
  const onScroll = () => {
    const r = section.getBoundingClientRect();
    const span = section.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / span));
    const max = track.scrollWidth - track.parentElement.clientWidth;
    track.style.transform = `translate3d(${-p * max}px,0,0)`;
    document.getElementById('city-progress').style.transform = `scaleX(${p})`;
  };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();
}

// ---------------------------------------------------------------------------------------------
// Small motion: things rise into view, and the cash in the CORP/OS window counts.

function reveals() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

function ticker() {
  const el = document.getElementById('cash');
  if (!el) return;
  let cash = 813_883_590.56;
  const fmt = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  el.textContent = fmt(cash);
  if (reduce) return;
  setInterval(() => { cash += 1838.7 + Math.random() * 40; el.textContent = fmt(cash); }, 1000);
}

reveals(); ticker();
const iso = await loadIso();
await document.fonts.load('16px Sysfont');
hero(iso).catch(e => { console.error(e); document.getElementById('hero-stage').classList.add('failed'); });
cities(iso).catch(e => console.error(e));
