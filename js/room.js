// The isometric room, drawn the way the game draws it: baked art from Tools/bake_iso.py placed with
// the renderer's camera, furniture from the engine's IsoLayout (data/iso.json), and customers who
// walk in, queue, buy and leave.

const SQ2 = Math.SQRT2, SQ3 = Math.sqrt(3);
const imageCache = new Map();

export function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('missing ' + src));
      img.src = src;
    }));
  }
  return imageCache.get(src);
}

export async function loadIso() {
  const r = await fetch('data/iso.json');
  return r.json();
}

const PEOPLE = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

export class Room {
  /** kind: 'cafe' | 'cake' | 'kiosk'. people: whether customers walk. */
  constructor(iso, theme, { kind = 'cafe', people = true, rate = 0.55, price = '+$13.80' } = {}) {
    this.iso = iso; this.theme = theme; this.kind = kind; this.people = people;
    this.rate = rate; this.price = price;
    const [w, h] = iso.canvas;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.customers = []; this.pops = []; this.serving = [];
    this.nextId = 0; this.spawnIn = 0.4;
  }

  async load() {
    const t = this.theme, base = 'assets/iso/';
    const need = {
      back: `${base}iso_${t}_w16_pad.webp`, fore: `${base}iso_${t}_w16_fg_pad.webp`,
      staff: `${base}iso_people_staff${this.kind === 'cafe' ? '' : '_' + this.kind}_pad.webp`,
      manager: `${base}iso_people_manager_pad.webp`,
    };
    PEOPLE.forEach(p => { need[p] = `${base}iso_people_${p}_pad.webp`; });
    this.sprites = this.iso.layout.sprites.map(s => ({ ...s, name: this.pieceName(s.name) }));
    for (const s of this.sprites) {
      need[s.name] = `${base}iso_${s.name}_pad.webp`;
      need[s.name + '_sh'] = `${base}iso_${s.name}_sh_pad.webp`;
    }
    const entries = await Promise.all(Object.entries(need).map(async ([k, v]) => [k, await loadImage(v)]));
    this.img = Object.fromEntries(entries);
    const L = this.iso.layout;
    this.stations = L.stations.map(([x]) => x - L.path[2][0]);
    this.serving = L.stations.map(() => null);
    this.draw(0);
    return this;
  }

  pieceName(base) {
    if (base === 'case') base = this.kind === 'cake' ? 'case_cake' : this.kind === 'kiosk' ? 'case_cookie' : 'case';
    if (base === 'machine' && this.kind !== 'cafe') base = 'oven';
    const themed = `${base}_${this.theme}`;
    return this.iso.pieces[themed] ? themed : base;
  }

  project(x, y, z = 0) {
    const s = this.iso.scale, [ox, oy] = this.iso.origin;
    return [Math.round(ox + (x - y) / SQ2 * s), Math.round(oy + ((x + y) / SQ2 * 0.5 - z * SQ3 / 2) * s)];
  }

  // The path, as the engine gives it: in from the street, along the front counter to the first till.
  // Distance s is measured from the first till back out to the street.
  pointAt(s) {
    const [[sx, sy], [cx, cy], [ex]] = this.iso.layout.path;
    const along = cx - ex;
    if (s <= along) return { x: ex + s, y: cy, alongX: true };
    return { x: cx, y: cy + (s - along), alongX: false, };
  }
  get streetS() {
    const [[, sy], [cx, cy], [ex]] = this.iso.layout.path;
    return (cx - ex) + (sy - cy) + 2.5;
  }

  spawn() {
    const queued = this.customers.filter(c => c.state !== 'leaving').length;
    if (queued >= 7) return;
    this.customers.push({ id: this.nextId++, look: PEOPLE[Math.floor(Math.random() * 6)], s: this.streetS,
      state: 'arriving', walked: 0, served: false, t: 0, row: (Math.random() - 0.5) * 0.3 });
  }

  update(dt) {
    if (!this.people) return;
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) { this.spawn(); this.spawnIn = (1 / this.rate) * (0.6 + Math.random() * 0.8); }
    const speed = 1.35;
    // Who is in line, nearest the counter first.
    const line = this.customers.filter(c => c.state === 'arriving' || c.state === 'queueing').sort((a, b) => a.s - b.s);
    const free = this.serving.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    let slot = 0;
    for (const c of line) {
      let target;
      if (c.station === undefined && free.length && c === line[0]) { c.station = free.pop(); this.serving[c.station] = c.id; }
      if (c.station !== undefined) target = this.stations[c.station];
      else { target = this.stations[this.stations.length - 1] + 1.1 + 0.85 * slot; slot++; }
      const d = target - c.s;
      if (Math.abs(d) > 0.02) {
        const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
        c.s += step; c.walked += Math.abs(step); c.moving = true;
      } else {
        c.moving = false;
        if (c.station !== undefined) { c.state = 'ordering'; c.t = 2.2 + Math.random() * 1.2; }
        else c.state = 'queueing';
      }
    }
    for (const c of this.customers) {
      if (c.state === 'ordering') {
        c.t -= dt;
        if (c.t <= 0) {
          c.state = 'leaving'; c.served = true; c.moving = true;
          this.serving[c.station] = null;
          const [px, py] = this.project(this.iso.layout.stations[c.station][0], 3.4, 1.7);
          this.pops.push({ x: px, y: py, age: 0 });
        }
      } else if (c.state === 'leaving') {
        const step = speed * dt;
        c.s += step; c.walked += step;
      }
    }
    this.customers = this.customers.filter(c => c.s < this.streetS + 0.5);
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter(p => p.age < 1.4);
  }

  frameOf(c, now) {
    const p = this.pointAt(c.s);
    const k = Math.floor(c.walked / 1.35 * 8) % 8;
    const E = 0, W = 1, S = 2, N = 3, stand = d => d * 9 + 8;
    const inward = p.alongX ? W : N;
    if (c.state === 'leaving') {
      if (c.served) return p.alongX ? 36 + k : 44 + k;
      return (p.alongX ? E : S) * 9 + k;
    }
    if (c.state === 'ordering') return stand(N);
    if (c.moving) return inward * 9 + k;
    // Someone in the line glances at the street now and then.
    return ((now / 1000 + c.id * 1.7) % 8) < 0.6 ? stand(S) : stand(inward);
  }

  draw(now) {
    const ctx = this.ctx, iso = this.iso, img = this.img;
    const [fw, fh] = iso.frame, [ax, ay] = iso.anchor;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(img.back, 0, 0);
    for (const s of this.sprites) {                         // shadows lie on the floor, under everything
      const [px, py] = this.project(s.x, s.y), info = iso.pieces[s.name];
      ctx.drawImage(img[s.name + '_sh'], px - info.ax, py - info.ay);
    }
    const items = this.sprites.map(s => ({ key: s.key, draw: () => {
      const [px, py] = this.project(s.x, s.y), info = iso.pieces[s.name];
      ctx.drawImage(img[s.name], px - info.ax, py - info.ay);
    } }));
    const L = iso.layout;
    L.staff.forEach(([x, y], i) => {
      const busy = this.serving[i] !== null && this.serving[i] !== undefined;
      const phase = busy ? (now / 1000 + i) % 2.4 : 0;
      const yy = busy && phase < 1.6 ? y - 0.65 : y;
      const f = !busy ? 0 : phase < 1.6 ? (Math.floor(now / 250) % 2 ? 1 : 2) : 3;
      items.push({ key: x + yy, draw: () => {
        const [px, py] = this.project(x, yy);
        ctx.drawImage(img.staff, f * fw, 0, fw, fh, px - ax, py - ay, fw, fh);
      } });
    });
    items.push({ key: L.manager[0] + L.manager[1], draw: () => {
      const [px, py] = this.project(L.manager[0], L.manager[1]);
      ctx.drawImage(img.manager, 0, 0, fw, fh, px - ax, py - ay, fw, fh);
    } });
    for (const c of this.customers) {
      const p = this.pointAt(c.s);
      const x = p.alongX ? p.x : p.x + c.row, y = p.alongX ? p.y + c.row + (c.served ? 0.45 : 0) : p.y;
      const f = this.frameOf(c, now), sheet = img[c.look];
      items.push({ key: x + y, draw: () => {
        const [px, py] = this.project(x, y);
        ctx.fillStyle = 'rgba(40,32,70,.35)';
        ctx.fillRect(px - 9, py - 1, 18, 3);
        ctx.drawImage(sheet, (f % 9) * fw, Math.floor(f / 9) * fh, fw, fh, px - ax, py - ay, fw, fh);
      } });
    }
    items.sort((a, b) => a.key - b.key).forEach(i => i.draw());
    ctx.drawImage(img.fore, 0, 0);
    for (const p of this.pops) {                            // the price rises from the till
      const y = Math.round(p.y - p.age * 18), a = p.age < 0.8 ? 1 : 1 - (p.age - 0.8) / 0.6;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '11px Sysfont, monospace';
      const w = Math.ceil(ctx.measureText(this.price).width) + 8;
      ctx.fillStyle = '#2a2118'; ctx.fillRect(p.x - w / 2 - 1, y - 9, w + 2, 15);
      ctx.fillStyle = '#5fa04e'; ctx.fillRect(p.x - w / 2, y - 8, w, 13);
      ctx.fillStyle = '#f4ead5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.price, p.x, y - 1);
      ctx.globalAlpha = 1;
    }
  }
}
