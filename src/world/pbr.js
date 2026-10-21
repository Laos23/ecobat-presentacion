import * as THREE from 'three';

// Texturas PBR procedurales (color, rugosidad y relieve) generadas en canvas al cargar.
// Todas son repetibles sin costura y se proyectan en coordenadas de mundo (ver bakeStatic).

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Ruido de valor repetible con periodo entero.
function makeNoise(seed, period, periodY = period) {
  const r = rng(seed);
  const g = new Float32Array(period * periodY).map(() => r());
  const at = (x, y) => g[(((y % periodY) + periodY) % periodY) * period + (((x % period) + period) % period)];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function fbm(noise, x, y, oct, base) {
  let v = 0;
  let amp = 0.5;
  let f = base;
  for (let i = 0; i < oct; i++) {
    v += noise(x * f, y * f) * amp;
    amp *= 0.5;
    f *= 2;
  }
  return v;
}

// Distancias a puntos de Voronoi repetibles: base de grietas y celdas.
function makeCells(seed, cells) {
  const r = rng(seed);
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + r()) / cells, (j + r()) / cells]);
  return (u, v) => {
    let f1 = 9;
    let f2 = 9;
    const ci = Math.floor(u * cells);
    const cj = Math.floor(v * cells);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ii = (((ci + di) % cells) + cells) % cells;
        const jj = (((cj + dj) % cells) + cells) % cells;
        const p = pts[jj * cells + ii];
        const px = p[0] + Math.floor((ci + di) / cells);
        const py = p[1] + Math.floor((cj + dj) / cells);
        const d = Math.hypot(u - px, v - py);
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) f2 = d;
      }
    }
    return [f1, f2];
  };
}

function toTexture(data, n, srgb) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  img.data.set(data);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// Altura → mapa de normales (Sobel con envoltura).
function normalFrom(h, n, strength) {
  const out = new Uint8ClampedArray(n * n * 4);
  const H = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      out[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      out[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      out[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

function build(n, fn, normalStrength) {
  const col = new Uint8ClampedArray(n * n * 4);
  const rough = new Uint8ClampedArray(n * n * 4);
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const [r, g, b, ro, he] = fn(x / n, y / n);
      const i = (y * n + x) * 4;
      col[i] = r;
      col[i + 1] = g;
      col[i + 2] = b;
      col[i + 3] = 255;
      rough[i] = rough[i + 1] = rough[i + 2] = ro * 255;
      rough[i + 3] = 255;
      h[y * n + x] = he;
    }
  }
  return {
    map: toTexture(col, n, true),
    roughnessMap: toTexture(rough, n, false),
    normalMap: toTexture(normalFrom(h, n, normalStrength), n, false),
  };
}

// Hormigón: grano fino, poros y juntas cada media tesela.
export function concrete({ seed = 3, base = [143, 139, 131], joints = 2, n = 512 } = {}) {
  // periodos que dividen cada octava: la tesela repite sin costura aunque no haya junta en su borde
  const nz = makeNoise(seed, 16);
  const bl = makeNoise(seed + 5, 4);
  return build(n, (u, v) => {
    const grain = fbm(nz, u * 64, v * 64, 4, 0.25);
    const blot = fbm(bl, u * 64, v * 64, 3, 1 / 16);
    const ju = Math.min((u * joints) % 1, 1 - ((u * joints) % 1));
    const jv = Math.min((v * joints) % 1, 1 - ((v * joints) % 1));
    const joint = joints && Math.min(ju, jv) < 0.0045 ? 1 : 0;
    const k = 0.86 + grain * 0.18 + (blot - 0.5) * 0.12 - joint * 0.35;
    return [base[0] * k, base[1] * k, base[2] * k, 0.78 + grain * 0.14 + joint * 0.1, grain * 0.4 - joint * 1.6];
  }, 1.4);
}

// Roca: celdas con grietas profundas y relieve fractal.
export function rock({ seed = 11, n = 512 } = {}) {
  const nz = makeNoise(seed, 64);
  const cells = makeCells(seed, 6);
  const fine = makeCells(seed + 3, 14);
  return build(n, (u, v) => {
    const [a1, a2] = cells(u, v);
    const [b1, b2] = fine(u, v);
    const crack = Math.min(1, (a2 - a1) * 22);
    const crack2 = Math.min(1, (b2 - b1) * 40);
    const rel = fbm(nz, u * 64, v * 64, 5, 0.06);
    const k = 0.55 + rel * 0.55;
    const c = k * (0.45 + crack * 0.55) * (0.75 + crack2 * 0.25);
    return [92 * c, 87 * c, 78 * c, 0.88 + (1 - crack) * 0.1, rel * 1.2 + crack * 0.8 + crack2 * 0.3 + a1 * 1.5];
  }, 3.2);
}

// Metal cepillado: vetas alargadas en una dirección.
export function brushed({ seed = 5, base = [150, 154, 158], n = 256 } = {}) {
  const nz = makeNoise(seed, 4, 256);
  const sp = makeNoise(seed + 1, 64);
  return build(n, (u, v) => {
    const streak = fbm(nz, u * 4, v * 256, 3, 1);
    const spot = fbm(sp, u * 256, v * 256, 2, 0.25);
    const k = 0.94 + streak * 0.07 + (spot - 0.5) * 0.05;
    return [base[0] * k, base[1] * k, base[2] * k, 0.32 + streak * 0.015 + spot * 0.015, streak * 0.12];
  }, 0.25);
}

// Plástico satinado y caucho: microtextura casi invisible que rompe el brillo uniforme.
export function micro({ seed = 9, base = [40, 42, 44], rough = [0.42, 0.12], bump = 0.5, tint = 0.08, n = 256 } = {}) {
  const nz = makeNoise(seed, 128);
  return build(n, (u, v) => {
    const g = fbm(nz, u * 256, v * 256, 3, 0.5);
    const k = 1 - tint / 2 + g * tint;
    return [base[0] * k, base[1] * k, base[2] * k, rough[0] + g * rough[1], g];
  }, bump);
}

// Manchas radiales para sombras de contacto y charcos de luz cálida.
export function radial(inner = 'rgba(0,0,0,0.55)', outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
