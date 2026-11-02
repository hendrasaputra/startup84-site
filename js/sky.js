import * as THREE from 'three';

// The world behind the page: a pixel sky that runs through one business day as the page scrolls,
// with the city on the horizon. Rendered at a third of the screen and scaled up with hard pixels,
// so the sky, sun and stars share the skyline art's pixel size.

const KEYS = [   // hour, sky top, sky bottom, city tint, night (0-1)
  [6.0,  [0.42, 0.45, 0.66], [0.98, 0.72, 0.52], [1.00, 0.80, 0.70], 0.15],
  [8.5,  [0.55, 0.68, 0.82], [0.98, 0.88, 0.70], [1.00, 0.95, 0.88], 0.0],
  [13.0, [0.52, 0.70, 0.86], [0.95, 0.92, 0.80], [1.05, 1.02, 0.97], 0.0],
  [17.0, [0.46, 0.46, 0.68], [0.99, 0.66, 0.40], [1.05, 0.80, 0.62], 0.05],
  [19.0, [0.20, 0.18, 0.40], [0.84, 0.40, 0.36], [0.62, 0.48, 0.52], 0.45],
  [21.0, [0.05, 0.06, 0.16], [0.14, 0.13, 0.30], [0.30, 0.30, 0.46], 1.0],
  [23.0, [0.03, 0.04, 0.11], [0.09, 0.09, 0.22], [0.26, 0.26, 0.42], 1.0],
];

function at(hour) {
  let i = 0;
  while (i < KEYS.length - 2 && hour > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (hour - a[0]) / (b[0] - a[0])));
  const mix = (x, y) => x.map((v, k) => v + (y[k] - v) * t);
  return { top: mix(a[1], b[1]), bottom: mix(a[2], b[2]), tint: mix(a[3], b[3]), night: a[4] + (b[4] - a[4]) * t };
}

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 res; uniform float time; uniform float night;
uniform vec3 top, bottom, tint;
uniform sampler2D city; uniform vec4 cityRect; uniform vec2 cityPx;
uniform vec2 sun; uniform vec2 moon;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 px = floor(vUv * res);
  float y = px.y / res.y;
  vec3 col = mix(bottom, top, pow(y, 0.85));
  // Dither the gradient into bands, as the game's own shading does.
  float bayer = hash(mod(px, 4.0)) - 0.5;
  col += bayer * 0.018;

  // Stars, and a slow twinkle.
  float s = hash(px);
  if (s > 0.9965 && y > 0.35) col = mix(col, vec3(1.0, 0.96, 0.86), night * (0.6 + 0.4 * sin(time * 2.0 + s * 90.0)));

  // The sun, then the moon: square-ish pixel discs with a ring of glow.
  float ds = length(px - sun);
  col = mix(col, vec3(1.0, 0.93, 0.70), (1.0 - night) * smoothstep(9.5, 8.5, ds));
  col += (1.0 - night) * vec3(0.30, 0.16, 0.05) * smoothstep(40.0, 9.0, ds) * 0.5;
  float dm = length(px - moon), dc = length(px - moon - vec2(3.0, 2.0));
  col = mix(col, vec3(0.95, 0.93, 0.84), night * smoothstep(7.5, 6.5, dm) * smoothstep(6.0, 7.0, dc));

  // Clouds: blocky noise drifting east, warm by day, pink at dusk, grey at night.
  vec2 cp = floor(px / 2.0) * 2.0;
  float c = noise(cp / vec2(46.0, 14.0) + vec2(time * 0.012, 0.0)) * 0.65 + noise(cp / vec2(18.0, 7.0) + vec2(time * 0.02, 3.0)) * 0.35;
  float cloud = step(0.72, c) * smoothstep(0.5, 0.78, y);
  vec3 cloudCol = mix(vec3(1.0, 0.97, 0.90), bottom * 1.15, 0.35);
  cloudCol = mix(cloudCol, vec3(0.20, 0.22, 0.36), night);
  col = mix(col, cloudCol, cloud * (0.85 - night * 0.45));

  // The city on the horizon.
  vec2 q = (px - cityRect.xy) / cityRect.zw;
  q.x = fract(q.x);
  if (q.y >= 0.0 && q.y <= 1.0) {
    vec4 t = texture2D(city, q);
    if (t.a > 0.5) {
      vec3 b = t.rgb * tint;
      // Windows light up at night: the dark, blue-ish panes of the art, cell by cell.
      vec2 cell = floor(q * cityPx / vec2(5.0, 6.0));
      float lum = dot(t.rgb, vec3(0.3, 0.59, 0.11));
      float pane = step(lum, 0.36) * step(t.r, t.b + 0.08);
      float on = step(0.42, hash(cell + 7.0)) * (0.85 + 0.15 * sin(time * 0.7 + hash(cell) * 40.0));
      b = mix(b, vec3(1.0, 0.78, 0.40), pane * on * night);
      // Haze: the far towers take the colour of the sky near the horizon.
      b = mix(b, bottom, (1.0 - q.y) * 0.0 + smoothstep(0.55, 0.95, q.y) * 0.18);
      col = b;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export async function startSky(canvas, { citySrc, onHour }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tex = await new THREE.TextureLoader().loadAsync(citySrc);
  tex.wrapS = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const u = {
    res: { value: new THREE.Vector2() }, time: { value: 0 }, night: { value: 0 },
    top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, tint: { value: new THREE.Color() },
    city: { value: tex }, cityRect: { value: new THREE.Vector4() },
    cityPx: { value: new THREE.Vector2(tex.image.width, tex.image.height) },
    sun: { value: new THREE.Vector2() }, moon: { value: new THREE.Vector2() },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, fragmentShader: frag,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }' });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const PIX = 3;                                    // screen pixels per sky pixel
  let W = 0, H = 0;
  function resize() {
    W = Math.ceil(innerWidth / PIX); H = Math.ceil(innerHeight / PIX);
    renderer.setSize(W, H, false);
    u.res.value.set(W, H);
    // The city takes the bottom 40% of the screen and repeats sideways to fill a wide one.
    const aspect = tex.image.width / tex.image.height;
    const ch = Math.round(H * (W > H ? 0.42 : 0.34)), cw = ch * aspect;
    u.cityRect.value.set((W - cw) / 2, 0, cw, ch);
  }
  addEventListener('resize', resize); resize();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hour = 6, shown = 6;
  function readScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    hour = 6 + (max > 0 ? scrollY / max : 0) * 17;
  }
  addEventListener('scroll', readScroll, { passive: true }); readScroll();

  function frame(ms) {
    requestAnimationFrame(frame);
    shown += (hour - shown) * (reduce ? 1 : 0.08);
    const k = at(shown);
    u.top.value.setRGB(...k.top); u.bottom.value.setRGB(...k.bottom); u.tint.value.setRGB(...k.tint);
    u.night.value = k.night;
    u.time.value = reduce ? 0 : ms / 1000;
    // The sun crosses from 6:00 to 19:30, the moon rises after.
    const d = Math.min(1, Math.max(0, (shown - 6) / 13.5));
    u.sun.value.set(W * (0.12 + 0.76 * d), H * (0.45 + 0.42 * Math.sin(d * Math.PI)));
    const n = Math.min(1, Math.max(0, (shown - 19) / 4));
    if (n > 0) u.moon.value.set(W * (0.22 + 0.5 * n), H * (0.6 + 0.25 * Math.sin(n * Math.PI * 0.8)));
    else u.moon.value.set(-99, -99);                 // no moon by day
    renderer.render(scene, camera);
    onHour?.(shown, k.night);
  }
  requestAnimationFrame(frame);
}
