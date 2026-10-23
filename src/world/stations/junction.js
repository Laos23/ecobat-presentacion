import * as THREE from 'three';
import { BRIDGES, TRACES } from '../layout.js';
import { CH } from '../chapters.js';
import * as A from '../actors.js';

// Cruce (s4, clasificación) y sus dos islas: rotonda con isla ajardinada, calzadas con bordillo y marcas lima,
// parterres con vegetación y balizas. Las baterías de plomo aptas vuelven al oeste, hacia la nave de reutilización
// (s2), por el mismo camino por el que llegaron; la de coche eléctrico sigue al este, al desmontaje (sB); las demás,
// al sureste, al reciclaje (s5). El ramal norte lleva a segunda vida (sA) los módulos que salen del desmontaje.
// Referencia: context/ref-cruce-rutas.png (estilo general: context/EcoBat-scroll-world-referencia.png).

// Ejes de las cuatro calzadas: siguen las trazas de layout.js.
const AXES = [
  [5.0, -5.4, 12.4, -8.2], // oeste: entrada desde el laboratorio y salida de reutilización (doble sentido)
  [15.3, -11.0, 16.9, -19.5], // norte: módulos de segunda vida (sA)
  [19.5, -8.2, 27.5, -8.0], // este: desmontaje de baterías de coche eléctrico (sB)
  [16.9, -5.0, 19.6, 3.6], // sureste: reciclaje de plomo-ácido (s5)
];
const RING = 5.6; // borde exterior del anillo de circulación
const HALF = 1.6; // medio ancho de calzada hasta la cara del bordillo (los puentes miden 3 m)
const RIM = 9.15; // los parterres terminan antes de la barandilla perimetral (r ≈ 9.85)
const KERB = 0.22; // grosor del bordillo de los parterres
const KERB_H = 0.3;
const SOIL_H = 0.24;
// Ensanche pavimentado junto a la entrada: el puesto de validación queda sobre la calzada, al alcance
// del técnico, y bordillo, tierra, líneas, balizas y plantas lo rodean.
const BAY = [9.55, -9.95, 0.8];

const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

function segDist(px, pz, [ax, az, bx, bz]) {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.min(1, Math.max(0, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
}

// Distancia con signo a los parterres (negativa dentro): fuera de calzadas y anillo, dentro del borde.
// Las uniones suaves redondean las esquinas como en la referencia.
export function planterField(cx, cz) {
  return (x, z) => {
    const r = Math.hypot(x - cx, z - cz);
    let road = r - RING;
    for (const a of AXES) road = smin(road, segDist(x, z, a) - HALF, 1.6);
    road = smin(road, Math.hypot(x - BAY[0], z - BAY[1]) - BAY[2], 0.5);
    return -smin(road, RIM - r, 0.9);
  };
}

function bisect(f, lo, hi) {
  let a = lo;
  let b = hi;
  let fa = f(a);
  for (let i = 0; i < 14; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

// Recorre radios desde el centro y agrupa, por ángulo y para cada nivel, el tramo [rIn, rOut] donde
// field < nivel. Cada grupo contiguo de ángulos es un parterre (los cuatro cuadrantes entre calzadas).
// Una sola pasada muestrea el campo para todos los niveles.
export function radialRuns(field, cx, cz, levels, step = 0.5) {
  const out = levels.map(() => []);
  const cur = levels.map(() => null);
  const rIn = new Array(levels.length);
  const rOut = new Array(levels.length);
  const dr = 0.06;
  for (let deg = 0; deg < 360; deg += step) {
    const a = THREE.MathUtils.degToRad(deg);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const f = (r) => field(cx + c * r, cz + s * r);
    rIn.fill(null);
    rOut.fill(null);
    let prev = f(2.4);
    for (let r = 2.4 + dr; r <= 10.4; r += dr) {
      const v = f(r);
      for (let k = 0; k < levels.length; k++) {
        const L = levels[k];
        if (rOut[k] !== null) continue;
        if (rIn[k] === null && prev - L >= 0 && v - L < 0) rIn[k] = bisect((x) => f(x) - L, r - dr, r);
        else if (rIn[k] !== null && prev - L < 0 && v - L >= 0) rOut[k] = bisect((x) => f(x) - L, r - dr, r);
      }
      prev = v;
    }
    for (let k = 0; k < levels.length; k++) {
      if (rIn[k] === null) {
        cur[k] = null;
        continue;
      }
      if (!cur[k]) {
        cur[k] = [];
        out[k].push(cur[k]);
      }
      cur[k].push({ a, rIn: rIn[k], rOut: rOut[k] ?? 10.4 });
    }
  }
  // un parterre que cruza 0° queda partido en dos: se une
  out.forEach((runs, k) => {
    if (runs.length > 1 && runs[0][0].a === 0 && cur[k] === runs[runs.length - 1]) {
      const tail = runs.pop();
      runs[0] = [...tail, ...runs[0].map((p) => ({ ...p, a: p.a + Math.PI * 2 }))];
    }
  });
  return out;
}

const toXZ = (cx, cz, a, r) => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];

// Contorno cerrado de un parterre: borde exterior hacia delante y borde de calzada de vuelta.
function runPolygon(run, cx, cz) {
  const pts = [...run.map((p) => toXZ(cx, cz, p.a, p.rOut)), ...run.slice().reverse().map((p) => toXZ(cx, cz, p.a, p.rIn))];
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.02);
}

// Puntos a intervalos regulares sobre una polilínea [[x, z], ...], dejando un margen en cada extremo.
function along(points, spacing, margin) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    seg.push(l);
    total += l;
  }
  const out = [];
  const usable = total - margin * 2;
  if (usable < 0) return out;
  const n = Math.max(1, Math.floor(usable / spacing) + 1);
  const gap = n > 1 ? usable / (n - 1) : 0;
  let acc = 0;
  let i = 0;
  for (let k = 0; k < n; k++) {
    const target = n > 1 ? margin + gap * k : total / 2;
    while (i < seg.length - 1 && acc + seg[i] < target) acc += seg[i++];
    const t = seg[i] ? (target - acc) / seg[i] : 0;
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
  }
  return out;
}

// Desplaza un punto hacia el interior del parterre siguiendo el gradiente del campo.
function inward(field, [x, z], d) {
  const e = 0.04;
  const gx = field(x + e, z) - field(x - e, z);
  const gz = field(x, z + e) - field(x, z - e);
  const l = Math.hypot(gx, gz) || 1;
  return [x - (gx / l) * d, z - (gz / l) * d];
}

// Banda plana sobre el suelo a lo largo de una polilínea (líneas pintadas).
function ribbon(points, width, y) {
  const n = points.length;
  const pos = new Float32Array(n * 6);
  const nor = new Float32Array(n * 6);
  const idx = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = points[i];
    const [x0, z0] = points[Math.max(0, i - 1)];
    const [x1, z1] = points[Math.min(n - 1, i + 1)];
    const l = Math.hypot(x1 - x0, z1 - z0) || 1;
    const nx = (-(z1 - z0) / l) * (width / 2);
    const nz = ((x1 - x0) / l) * (width / 2);
    pos.set([x + nx, y, z + nz, x - nx, y, z - nz], i * 6);
    nor.set([0, 1, 0, 0, 1, 0], i * 6);
    if (i < n - 1) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

const shapeOf = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));

// ---------- Trazas y rutas de world.js ----------
// Mismos puntos de control que las trazas luminosas de world.js (layout.js): las puntas de flecha se apoyan
// sobre ellas. La rosa sabe qué ruta toma cada batería que llega a la rotonda por story.route; se aceptan los
// nombres de la v1 y los de la v2 (0 reutilización, 1 desmontaje, 2 reciclaje).
const ROUTE_INDEX = {
  reuse: 0, reutilizacion: 0, service: 0,
  ev: 1, desmontaje: 1, disassembly: 1, second: 1, litio: 1,
  recycle: 2, reciclaje: 2,
};

function worldCurves() {
  const cr = (pts) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  return {
    trace: {
      entry: cr(TRACES.main.slice(-4)),
      service: cr(TRACES.service),
      second: cr(TRACES.second),
      recycle: cr(TRACES.recycle),
    },
  };
}

// Puente bajo un punto (plano xz) y cota de su tablero allí, con la misma rasante que edges.js:
// recta entre apoyos más una S de pocos centímetros; los tableros llanos quedan 1,5 cm bajo la tapa.
function bridgeUnder(x, z) {
  for (const [a, b] of BRIDGES) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenH = Math.hypot(dx, dz);
    const along = ((x - a.x) * dx + (z - a.z) * dz) / lenH;
    const off = Math.abs((x - a.x) * dz - (z - a.z) * dx) / lenH;
    if (along > 0.3 && along < lenH - 0.3 && off < 1.6) return { a, b, lenH, dx, dz };
  }
  return null;
}

function deckAt(br, x, z) {
  const { a, b, lenH, dx, dz } = br;
  const rise = b.y - a.y;
  const xb = ((x - a.x) * dx + (z - a.z) * dz) / lenH;
  const s = xb / lenH;
  const flat = Math.abs(rise / lenH) < 1e-3;
  return a.y + (rise / lenH) * xb + (s > 0 && s < 1 ? Math.sign(rise) * s * (1 - s) * (s - 0.33) : 0) - (flat ? 0.015 : 0);
}

// Ruido de valor suave (retícula unidad) para repartir la plantación en manchas en vez de en retícula.
function valueNoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

// ---------- Atlas de rótulos (una sola textura y un solo material para señales, rosa y pantallas fijas) ----------
const PAL = { bg: '#1b1e20', ivory: '#F1EEE6', lime: '#C2F230', amber: '#E5AE50', dim: 'rgba(241,238,230,0.55)' };
const SLOT = 256;

function iconReuse(g, cx, cy, s, col) {
  // batería de arranque con una flecha circular: vuelve a servicio
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = 10 * s;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeRect(cx - 62 * s, cy - 26 * s, 124 * s, 66 * s);
  [-38, 38].forEach((dx) => g.fillRect(cx + (dx - 9) * s, cy - 40 * s, 18 * s, 12 * s));
  g.beginPath();
  g.arc(cx, cy + 7 * s, 19 * s, -Math.PI * 0.15, Math.PI * 1.45);
  g.stroke();
  g.beginPath();
  g.moveTo(cx + 26 * s, cy - 6 * s);
  g.lineTo(cx + 10 * s, cy - 14 * s);
  g.lineTo(cx + 25 * s, cy + 9 * s);
  g.closePath();
  g.fill();
}

function iconPack(g, cx, cy, s, col) {
  // paquete plano de coche eléctrico abierto por módulos: uno sale hacia arriba
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = 9 * s;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeRect(cx - 70 * s, cy - 4 * s, 140 * s, 44 * s);
  [-35, 0, 35].forEach((dx) => {
    g.beginPath();
    g.moveTo(cx + dx * s, cy - 4 * s);
    g.lineTo(cx + dx * s, cy + 40 * s);
    g.stroke();
  });
  g.fillRect(cx + 4 * s, cy - 46 * s, 27 * s, 30 * s);
  g.beginPath();
  g.moveTo(cx + 17 * s, cy - 54 * s);
  g.lineTo(cx + 17 * s, cy - 62 * s);
  g.stroke();
}

function iconStore(g, cx, cy, s, col) {
  // armario de almacenamiento con módulos apilados y un sol: otro uso, guardar energía
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = 9 * s;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeRect(cx - 62 * s, cy - 30 * s, 84 * s, 74 * s);
  [-12, 8, 28].forEach((dy) => g.fillRect(cx - 50 * s, cy + (dy - 6) * s, 60 * s, 12 * s));
  g.beginPath();
  g.arc(cx + 50 * s, cy - 38 * s, 13 * s, 0, Math.PI * 2);
  g.fill();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + 50 * s + Math.cos(a) * 21 * s, cy - 38 * s + Math.sin(a) * 21 * s);
    g.lineTo(cx + 50 * s + Math.cos(a) * 28 * s, cy - 38 * s + Math.sin(a) * 28 * s);
    g.stroke();
  }
}

function iconRecycle(g, cx, cy, s, col) {
  // tres flechas que se persiguen
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = 11 * s;
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    g.save();
    g.rotate((k * Math.PI * 2) / 3);
    g.beginPath();
    g.moveTo(-34 * s, 34 * s);
    g.lineTo(18 * s, 34 * s);
    g.stroke();
    g.beginPath();
    g.moveTo(44 * s, 34 * s);
    g.lineTo(18 * s, 14 * s);
    g.lineTo(18 * s, 54 * s);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.restore();
}

// Casillas del atlas (4 × 2 de 256 px). Fila 0: señales de las cuatro ramas. Fila 1: rótulos de fachada
// (mitades de 256 × 128), rótulos de ejemplo de sB y los dos monitores fijos del puesto de desmontaje.
function routeAtlas() {
  const c = document.createElement('canvas');
  c.width = SLOT * 4;
  c.height = SLOT * 2;
  const g = c.getContext('2d');
  const slot = (col, row, fn) => {
    g.save();
    g.translate(col * SLOT, row * SLOT);
    g.beginPath();
    g.rect(0, 0, SLOT, SLOT);
    g.clip();
    fn();
    g.restore();
  };
  const font = (w, px) => `${w} ${px}px "Archivo Variable", "Archivo", sans-serif`;
  // ajusta el cuerpo de letra para que el texto quepa en `max` píxeles
  const fit = (text, w, px, max) => {
    let p = px;
    g.font = font(w, p);
    while (g.measureText(text).width > max && p > 10) g.font = font(w, --p);
  };
  const sign = (col, color, icon, label) => slot(col, 0, () => {
    g.fillStyle = PAL.bg;
    g.fillRect(0, 0, SLOT, SLOT);
    g.strokeStyle = color;
    g.lineWidth = 9;
    g.strokeRect(12, 12, SLOT - 24, SLOT - 24);
    icon(g, 128, 104, 1.05, color);
    g.fillStyle = PAL.ivory;
    g.textAlign = 'center';
    fit(label, 800, 31, SLOT - 44);
    g.fillText(label, 128, 212);
  });
  sign(0, PAL.lime, iconReuse, 'REUTILIZACIÓN');
  sign(1, PAL.amber, iconPack, 'DESMONTAJE');
  sign(2, PAL.ivory, iconRecycle, 'RECICLAJE');
  sign(3, PAL.lime, iconStore, 'SEGUNDA VIDA');
  // rótulos apaisados (256 × 128): barra de color, icono, título y subtítulo
  const banner = (col, y0, color, icon, title, sub, note) => slot(col, 1, () => {
    g.translate(0, y0);
    g.fillStyle = PAL.bg;
    g.fillRect(0, 0, SLOT, 128);
    g.fillStyle = color;
    g.fillRect(0, 0, SLOT, 7);
    if (icon) icon(g, 40, 66, 0.42, color);
    const x = icon ? 78 : 16;
    g.textAlign = 'left';
    g.fillStyle = PAL.ivory;
    fit(title, 800, 25, SLOT - x - 10);
    g.fillText(title, x, note ? 52 : 62);
    g.fillStyle = PAL.dim;
    fit(sub, 600, 17, SLOT - x - 10);
    g.fillText(sub, x, note ? 78 : 90);
    if (note) {
      g.fillStyle = color;
      fit(note, 700, 16, SLOT - x - 10);
      g.fillText(note, x, 104);
    }
  });
  banner(0, 0, PAL.amber, iconPack, 'DESMONTAJE', 'baterías de coche eléctrico');
  banner(0, 128, PAL.lime, iconStore, 'SEGUNDA VIDA', 'almacenamiento estacionario');
  banner(1, 0, PAL.lime, null, 'Remanufacturada', 'vuelve a un coche', 'ejemplo');
  banner(1, 128, PAL.ivory, null, 'Reciclador de litio', 'fuera del polígono', 'módulos que no sirven');
  // monitor del puesto de desmontaje: módulos del paquete y su destino (rotulado como ejemplo)
  slot(2, 1, () => {
    g.fillStyle = '#0f1112';
    g.fillRect(0, 48, SLOT, 160);
    g.fillStyle = PAL.ivory;
    g.textAlign = 'left';
    g.font = font(700, 16);
    g.fillText('Módulos del paquete', 14, 72);
    g.fillStyle = PAL.lime;
    g.textAlign = 'right';
    g.font = font(700, 14);
    g.fillText('ejemplo', SLOT - 14, 72);
    const kind = [0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0];
    const cols = [PAL.lime, PAL.amber, 'rgba(241,238,230,0.5)'];
    kind.forEach((k, i) => {
      g.fillStyle = cols[k];
      g.fillRect(16 + (i % 6) * 38, 84 + Math.floor(i / 6) * 34, 32, 26);
    });
    g.textAlign = 'left';
    g.font = font(600, 12);
    [['sigue en el paquete', 0], ['segunda vida', 1], ['reciclador', 2]].forEach(([t, k], i) => {
      const x = 16 + i * 80;
      g.fillStyle = cols[k];
      g.fillRect(x, 166, 10, 10);
      g.fillStyle = PAL.dim;
      g.fillText(t, x + 14, 175, 64);
    });
  });
  // monitor fijo: pasos del trabajo en alta tensión
  slot(3, 1, () => {
    g.fillStyle = '#0f1112';
    g.fillRect(0, 48, SLOT, 160);
    g.fillStyle = PAL.amber;
    g.fillRect(0, 48, SLOT, 6);
    g.fillStyle = PAL.ivory;
    g.textAlign = 'left';
    g.font = font(800, 17);
    g.fillText('Trabajo en alta tensión', 14, 80);
    g.font = font(600, 15);
    ['Desconectado y sin tensión', 'Ausencia de tensión comprobada', 'Apertura por módulos'].forEach((t, i) => {
      const y = 112 + i * 30;
      g.strokeStyle = PAL.lime;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(16, y - 5);
      g.lineTo(21, y);
      g.lineTo(30, y - 11);
      g.stroke();
      g.fillStyle = i < 2 ? PAL.ivory : PAL.lime;
      g.fillText(t, 40, y, SLOT - 52);
    });
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- Rosa de rutas y pantalla del puesto de validación (un lienzo vivo de 256 × 128) ----------
// Mitad izquierda: tapa del marcador central (arriba del lienzo = norte del mundo). Mitad derecha: el
// puesto donde el técnico valida la ruta que propone el software. Se ilumina la misma ruta en ambas.
const ROUTE_STYLE = [
  { color: PAL.lime, rgb: '194,242,48', label: 'Reutilización', icon: iconReuse },
  { color: PAL.amber, rgb: '229,174,80', label: 'Desmontaje', icon: iconPack },
  { color: PAL.ivory, rgb: '241,238,230', label: 'Reciclaje', icon: iconRecycle },
];
// intensidades en 16 pasos con sus colores ya compuestos: redibujar no crea cadenas nuevas
const STEPS = 16;
ROUTE_STYLE.forEach((s) => {
  s.arc = Array.from({ length: STEPS + 1 }, (_, i) => `rgba(${s.rgb},${((0.95 * i) / STEPS).toFixed(3)})`);
  s.row = `rgba(${s.rgb},0.2)`;
});
const ROSE_FONT = (w, px) => `${w} ${px}px "Archivo Variable", "Archivo", sans-serif`;
const FONT_TITLE = ROSE_FONT(800, 14);
const FONT_ROW = ROSE_FONT(600, 12);
const FONT_ROW_ON = ROSE_FONT(700, 12);
const FONT_SMALL = ROSE_FONT(600, 11);

function makeDrawRoutes(dirs) {
  // reutilización sale por donde entró (oeste); desmontaje al este; reciclaje al sureste
  const exits = [dirs.entry, dirs.second, dirs.recycle];
  const northA = Math.atan2(dirs.service[1], dirs.service[0]);
  // st.w: intensidad de cada ruta (0..1); sin estado, las tres encendidas
  return (g, w, h, t, st) => {
    const wOf = (i) => (st ? Math.round(st.w[i] * STEPS) / STEPS : 1);
    g.save();
    g.fillStyle = '#202326';
    g.fillRect(0, 0, 128, 128);
    g.translate(64, 64);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(194,242,48,0.32)';
    g.beginPath();
    g.arc(0, 0, 57, 0, Math.PI * 2);
    g.stroke();
    // ramal norte: módulos de segunda vida que salen del desmontaje (no es una ruta de la clasificación)
    g.save();
    g.rotate(northA);
    g.strokeStyle = 'rgba(194,242,48,0.6)';
    g.lineWidth = 2.5;
    g.strokeRect(15, -3, 20, 6);
    g.beginPath();
    g.moveTo(52, 0);
    g.lineTo(37, -10);
    g.lineTo(37, 10);
    g.closePath();
    g.stroke();
    g.restore();
    exits.forEach(([dx, dz], i) => {
      const k = wOf(i);
      const s = ROUTE_STYLE[i];
      const a = Math.atan2(dz, dx);
      if (k > 0.02) {
        g.strokeStyle = s.arc[Math.round(k * STEPS)];
        g.lineWidth = 6;
        g.beginPath();
        g.arc(0, 0, 57, a - 0.45, a + 0.45);
        g.stroke();
      }
      g.save();
      g.rotate(a);
      g.globalAlpha = 0.22 + 0.78 * k;
      g.fillStyle = s.color;
      g.fillRect(13, -4.5, 25, 9);
      g.beginPath();
      g.moveTo(54, 0);
      g.lineTo(35, -14);
      g.lineTo(35, 14);
      g.closePath();
      g.fill();
      g.restore();
    });
    g.globalAlpha = 1;
    g.fillStyle = PAL.lime;
    g.beginPath();
    g.arc(0, 0, 8, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // ruta propuesta: la única encendida (con las tres a la vez no se destaca ninguna fila)
    let top = -1;
    let lit = 0;
    for (let i = 0; i < 3; i++) {
      if (wOf(i) > 0.5) {
        lit++;
        top = i;
      }
    }
    if (lit !== 1) top = -1;
    g.save();
    g.translate(128, 14);
    g.fillStyle = '#0f1112';
    g.fillRect(0, -14, 128, 128);
    g.textAlign = 'left';
    g.fillStyle = PAL.ivory;
    g.font = FONT_TITLE;
    g.fillText('Ruta propuesta', 8, 16);
    ROUTE_STYLE.forEach((s, i) => {
      const y = 36 + i * 22;
      const on = i === top;
      if (on) {
        g.fillStyle = s.row;
        g.fillRect(4, y - 10, 120, 20);
        g.strokeStyle = s.color;
        g.lineWidth = 2;
        g.strokeRect(4, y - 10, 120, 20);
      }
      s.icon(g, 19, y, 0.13, on ? s.color : 'rgba(241,238,230,0.45)');
      g.fillStyle = on ? PAL.ivory : 'rgba(241,238,230,0.6)';
      g.font = on ? FONT_ROW_ON : FONT_ROW;
      g.fillText(s.label, 36, y + 4);
    });
    g.fillStyle = top >= 0 ? PAL.lime : 'rgba(194,242,48,0.28)';
    g.fillRect(8, 90, 58, 8);
    g.fillStyle = PAL.dim;
    g.font = FONT_SMALL;
    g.fillText('técnico', 74, 98);
    g.restore();
  };
}

// Cubierta vegetal de los parterres: manchas de musgo, hoja y tierra (se repite cada `tile` metros).
const hash = (a, b) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

function groundMaterial(tile) {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = '#272d1d';
  g.fillRect(0, 0, n, n);
  const tones = ['#33401f', '#3c4b25', '#2b391b', '#3a3122', '#2e271c', '#45552a'];
  for (let i = 0; i < 900; i++) {
    const x = hash(i, 1.3) * n;
    const y = hash(i, 7.9) * n;
    const r = 1.5 + hash(i, 3.1) * 5.5;
    g.globalAlpha = 0.45 + hash(i, 5.7) * 0.45;
    g.fillStyle = tones[i % tones.length];
    // copias desplazadas para que la tesela empalme sin costura
    [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]].forEach(([dx, dy]) => {
      g.beginPath();
      g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      g.fill();
    });
  }
  g.globalAlpha = 1;
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1 / tile, 1 / tile);
  map.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: 1 });
  mat.userData.tile = tile;
  return mat;
}

// Reasigna las UV de una geometría (cuadrado unidad) a una casilla del atlas; crop en píxeles de la casilla.
function toSlot(geo, col, row, [x0, y0, x1, y1] = [0, 0, SLOT, SLOT]) {
  const uv = geo.attributes.uv;
  const uA = (col * SLOT + x0) / (SLOT * 4);
  const uB = (col * SLOT + x1) / (SLOT * 4);
  const vT = 1 - (row * SLOT + y0) / (SLOT * 2);
  const vB = 1 - (row * SLOT + y1) / (SLOT * 2);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uA + uv.getX(i) * (uB - uA), vB + uv.getY(i) * (vT - vB));
  return geo;
}

// Reasigna las UV (cuadrado unidad) al rectángulo [u0, v0]–[u1, v1] de una textura.
function toRect(geo, u0, v0, u1, v1) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return geo;
}

export function buildJunction(ctx) {
  const { K, M, T, STATIONS } = ctx;
  const s4 = STATIONS.s4;
  const y4 = s4.y;
  const soilY = y4 + SOIL_H;
  const field = planterField(s4.x, s4.z);
  const trees = [];
  const rocks = [];
  const occupied = [];
  const free = (x, z, d) => occupied.every(([ox, oz, od]) => Math.hypot(x - ox, z - oz) > d + od);
  const claim = (x, z, d) => occupied.push([x, z, d]);

  const dir = ([ax, az, bx, bz]) => {
    const l = Math.hypot(bx - ax, bz - az);
    return [(bx - ax) / l, (bz - az) / l];
  };
  const dirs = { entry: dir(AXES[0]).map((v) => -v), service: dir(AXES[1]), second: dir(AXES[2]), recycle: dir(AXES[3]) };
  const atlas = routeAtlas();
  const signMat = new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: '#ffffff', emissiveIntensity: 0.62, roughness: 0.45 });
  const ground = groundMaterial(2.4);
  // rosa y puesto de validación comparten un lienzo vivo pequeño: solo se redibuja cuando cambia la ruta
  const routeLive = T.liveScreen(256, 128, makeDrawRoutes(dirs), 12);
  const routeMat = new THREE.MeshStandardMaterial({ map: routeLive.texture, emissiveMap: routeLive.texture, emissive: '#ffffff', emissiveIntensity: 0.62, roughness: 0.45 });

  // ---------- Parterres entre calzadas: bordillo, tierra y su orden de plantación ----------
  // niveles: cara exterior del bordillo, borde de la tierra, línea lima y eje del bordillo (balizas)
  const [outerRuns, soilRuns, lineRuns, lampRuns] = radialRuns(field, s4.x, s4.z, [0, -KERB, 0.35, -KERB / 2]);
  const planters = outerRuns.map((run) => {
    const mid = run[Math.floor(run.length / 2)].a;
    const soil = soilRuns.find((r) => r[0].a <= mid && r[r.length - 1].a >= mid);
    const outline = runPolygon(run, s4.x, s4.z);
    const hole = runPolygon(soil, s4.x, s4.z);
    const shape = shapeOf(outline);
    shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    const kerb = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: KERB_H, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2), M.concreteLight);
    kerb.position.y = y4;
    const top = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(hole)).rotateX(-Math.PI / 2), ground);
    top.position.y = soilY;
    // piezas bajas y extensas: su caja envolvente no debe vetar el bordillo y la barandilla perimetrales
    [kerb, top].forEach((m) => {
      m.userData.noCollide = true;
      ctx.add(m);
    });
    const deg = THREE.MathUtils.radToDeg(mid) % 360;
    return { soil, mid: deg, road: soil.map((p) => toXZ(s4.x, s4.z, p.a, p.rIn)) };
  });
  const quadrant = (deg) => planters.find((p) => Math.abs(((p.mid - deg + 540) % 360) - 180) < 30);

  // ---------- Relieve: lomas bajas de tierra alargadas según el arco de cada parterre ----------
  // Los parterres miden unos 3 m de ancho: la loma es una elipse (radial ≤ 1,5 m, tangencial hasta 2,4 m)
  // con perfil coseno que nace bajo la tierra; árboles, matas, rocas y postes se elevan con ella.
  const mounds = [];
  const moundGeo = K.geo('jMound', () => {
    const prof = [];
    for (let i = 0; i <= 10; i++) {
      const d = 1 - i / 10;
      prof.push(new THREE.Vector2(d, 0.5 + 0.5 * Math.cos(Math.PI * d)));
    }
    return new THREE.LatheGeometry(prof, 28);
  });
  const lift = (x, z) => {
    let h = 0;
    for (const m of mounds) {
      const dx = x - m.x;
      const dz = z - m.z;
      const d = Math.hypot((dx * m.c + dz * m.s) / m.ra, (dz * m.c - dx * m.s) / m.rb);
      if (d < 1) h = Math.max(h, (m.h + 0.03) * (0.5 + 0.5 * Math.cos(Math.PI * d)) - 0.03);
    }
    return h;
  };
  const mound = (deg, frac, h) => {
    const p = quadrant(deg);
    if (!p) return;
    const { a, rIn, rOut } = p.soil[Math.round((p.soil.length - 1) * frac)];
    const [x, z] = toXZ(s4.x, s4.z, a, (rIn + rOut) / 2);
    const ra = Math.min(1.5, -field(x, z) - 0.1);
    if (ra < 1.0) return;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // el eje largo crece mientras la elipse (al 85 %) quede dentro de la tierra
    let rb = 2.4;
    const fits = (r) => {
      for (let k = 0; k < 16; k++) {
        const t = (k / 16) * Math.PI * 2;
        const u = Math.cos(t) * ra * 0.85;
        const v = Math.sin(t) * r * 0.85;
        if (field(x + c * u - s * v, z + s * u + c * v) > -KERB) return false;
      }
      return true;
    };
    while (rb > 1.3 && !fits(rb)) rb -= 0.1;
    const m = new THREE.Mesh(moundGeo, ground);
    m.position.set(x, soilY - 0.03, z);
    m.rotation.y = -a;
    m.scale.set(ra, h + 0.03, rb);
    m.userData.noCollide = true;
    ctx.add(m);
    mounds.push({ x, z, c, s, ra, rb, h });
  };
  mound(220, 0.42, 0.48);
  mound(220, 0.74, 0.4);
  mound(315, 0.45, 0.46);
  mound(36, 0.42, 0.42);
  mound(120, 0.3, 0.4);
  mound(120, 0.72, 0.5);
  const onSoil = (x, z) => soilY + lift(x, z);

  // ---------- Marcas viales: bordes lima continuos y puntas de flecha sobre las trazas ----------
  lineRuns.forEach((run) => {
    const pts = run.filter((p) => p.rIn < 9.5).map((p) => toXZ(s4.x, s4.z, p.a, p.rIn));
    if (pts.length < 2) return;
    const line = new THREE.Mesh(ribbon(pts, 0.075, y4 + 0.012), M.limeLine);
    line.userData.noCollide = true;
    ctx.add(line);
  });
  // La traza hace de asta: cada punta se apoya 1,5 cm sobre ella (o sobre el tablero del puente si la traza
  // queda por debajo), con el color de su ruta como señales y tarjetas. Una segunda punta da ritmo en cada
  // rampa o ante la puerta de B, siempre fuera de donde aparcan las baterías simuladas.
  const curves = worldCurves();
  const headShape = new THREE.Shape();
  [[0.5, 0], [-0.25, 0.45], [-0.1, 0], [-0.25, -0.45]].forEach(([x, y], i) => (i ? headShape.lineTo(x, y) : headShape.moveTo(x, y)));
  const headGeo = K.geo('jHead', () => new THREE.ShapeGeometry(headShape).rotateX(-Math.PI / 2));
  const UP = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  // reutilización: punta de salida hacia el oeste en el carril derecho de la calzada de entrada (doble sentido)
  const [ex, ez] = dirs.entry;
  const reuseAt = { p: new THREE.Vector3(8.7 - ez * 0.8, y4, -6.8 + ex * 0.8), hx: ex, hz: ez };
  [
    [curves.trace.entry, 2.93, M.lime],
    [null, reuseAt, M.lime],
    [curves.trace.service, 0.6, M.lime],
    [curves.trace.service, 2.78, M.lime],
    [curves.trace.second, 0.86, M.amberGlow],
    [curves.trace.second, 3.35, M.amberGlow],
    [curves.trace.recycle, 2.5, M.warmGlow],
  ].forEach(([curve, k, mat]) => {
    let p;
    let hx;
    let hz;
    if (curve) {
      const u = k / (curve.points.length - 1);
      p = curve.getPoint(u);
      curve.getTangent(u, tan);
      const hl = Math.hypot(tan.x, tan.z);
      hx = tan.x / hl;
      hz = tan.z / hl;
    } else ({ p, hx, hz } = k);
    const br = bridgeUnder(p.x, p.z);
    let y = y4 + 0.045;
    let grade = 0;
    if (br) {
      y = Math.max(deckAt(br, p.x, p.z), p.y) + 0.03;
      grade = (deckAt(br, p.x + hx * 0.1, p.z + hz * 0.1) - deckAt(br, p.x - hx * 0.1, p.z - hz * 0.1)) / 0.2;
    }
    fwd.set(hx, grade, hz).normalize();
    side.crossVectors(fwd, UP).normalize();
    nrm.crossVectors(side, fwd).normalize();
    basis.makeBasis(fwd, nrm, side);
    const m = new THREE.Mesh(headGeo, mat);
    m.quaternion.setFromRotationMatrix(basis);
    m.position.set(p.x, y, p.z);
    m.userData.noCollide = true;
    ctx.add(m);
  });

  // ---------- Isla central: bordillo, tierra, arbustos bajos y marcador con la rosa de rutas ----------
  const isl = new THREE.Group();
  isl.position.set(s4.x, y4, s4.z);
  const ringShape = new THREE.Shape();
  ringShape.absarc(0, 0, 2.2, 0, Math.PI * 2, false);
  const ringHole = new THREE.Path();
  ringHole.absarc(0, 0, 1.98, 0, Math.PI * 2, true);
  ringShape.holes.push(ringHole);
  isl.add(new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth: 0.26, bevelEnabled: false, curveSegments: 48 }).rotateX(-Math.PI / 2), M.concreteLight));
  const islSoil = new THREE.Mesh(new THREE.CircleGeometry(1.98, 48).rotateX(-Math.PI / 2), ground);
  islSoil.position.y = 0.2;
  isl.add(islSoil);
  // tambor algo mayor que antes: la rosa (1,7 m) es el explicador del capítulo y debe leerse desde lo alto
  const drum = K.cyl(0.9, 0.96, 0.5, M.graphite, 48);
  drum.position.y = 0.45;
  isl.add(drum);
  const rose = new THREE.Mesh(toRect(new THREE.CircleGeometry(0.85, 48), 0, 0, 0.5, 1).rotateX(-Math.PI / 2), routeMat);
  rose.position.y = 0.706;
  isl.add(rose);
  const band = new THREE.Mesh(K.geo('jBand2', () => new THREE.TorusGeometry(0.905, 0.026, 6, 64).rotateX(Math.PI / 2)), M.lime);
  band.position.y = 0.7;
  isl.add(band);
  // pilotos de ruta en el costado del tambor, orientados hacia cada salida
  [[dirs.entry, M.lime], [dirs.second, M.amberGlow], [dirs.recycle, M.warmGlow], [dirs.service, M.limeLine]].forEach(([[dx, dz], mat]) => {
    const chip = K.box(0.24, 0.06, 0.03, mat, dx * 0.95, 0.5, dz * 0.95);
    chip.rotation.y = Math.atan2(dx, dz);
    isl.add(chip);
  });
  ctx.add(isl);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.35;
    trees.push({ x: s4.x + Math.cos(a) * 1.52, y: y4 + 0.2, z: s4.z + Math.sin(a) * 1.52, s: 0.58 + (i % 3) * 0.06, kind: 'shrub', r: a * 3 });
  }
  claim(s4.x, s4.z, 2.3);

  // ---------- Señales de las tres rutas: icono y nombre, poste grafito con zapata ----------
  const signGeo = [0, 1, 2, 3].map((col) => toSlot(new THREE.PlaneGeometry(1.22, 1.22), col, 0));
  const sign = (col, x, z, ry) => {
    const g = new THREE.Group();
    g.add(K.cyl(0.15, 0.18, 0.1, M.graphite, 12).translateY(0.05));
    g.add(K.cyl(0.055, 0.055, 2.5, M.darkSteel, 10).translateY(1.25).translateZ(-0.12));
    g.add(K.rbox(1.36, 1.36, 0.08, M.darkSteel, 0, 1.6, -0.04, 0.03));
    const face = new THREE.Mesh(signGeo[col], signMat);
    face.position.set(0, 2.28, 0.005);
    g.add(face);
    g.position.set(x, field(x, z) < -KERB ? onSoil(x, z) : y4, z);
    g.rotation.y = ry;
    ctx.add(g);
    claim(x, z, 0.45);
  };
  // SEGUNDA VIDA en el ramal norte (módulos que salen del desmontaje hacia sA)
  sign(3, s4.x - 2.6, s4.z - 6.6, 0.3);
  // REUTILIZACIÓN junto a la calzada oeste, por la que las aptas vuelven hacia la nave de reutilización (s2)
  sign(0, 10.6, -4.5, -0.3);
  // DESMONTAJE a 2,5 m del eje este; RECICLAJE en la boca sureste, tras su bordillo, de cara a la entrada
  sign(1, 22.2, -10.6, -0.5);
  sign(2, 20.3, -2.6, -0.7);

  // ---------- Puesto de validación en su ensanche pavimentado (el técnico confirma la ruta propuesta) ----------
  const kiosk = new THREE.Group();
  kiosk.add(K.rbox(0.9, 0.06, 0.7, M.concreteLight, 0, 0, 0, 0.02));
  kiosk.add(K.rbox(0.48, 1.0, 0.34, M.graphite, 0, 0.06, -0.04, 0.04));
  const kHead = new THREE.Group();
  kHead.add(K.rbox(0.56, 0.07, 0.46, M.graphite, 0, -0.035, 0, 0.02));
  // zona útil de la mitad derecha del lienzo: 128 × 100 px (misma proporción que la pantalla)
  const kScreen = new THREE.Mesh(toRect(new THREE.PlaneGeometry(0.46, 0.36), 0.5, 1 - 114 / 128, 1, 1 - 14 / 128).rotateX(-Math.PI / 2), routeMat);
  kScreen.position.y = 0.04;
  kHead.add(kScreen);
  kHead.position.set(0, 1.1, 0.02);
  kHead.rotation.x = 0.62;
  kiosk.add(kHead);
  kiosk.add(K.box(0.05, 0.05, 0.02, M.amberGlow, 0.15, 0.86, 0.14));
  // de cara al flujo que llega por la entrada y a la cámara del capítulo
  kiosk.position.set(BAY[0], y4, BAY[1]);
  kiosk.rotation.y = -0.5;
  ctx.add(kiosk);
  claim(BAY[0], BAY[1], 0.5);
  ctx.shadows.push({ x: BAY[0], y: y4, z: BAY[1], w: 0.9, d: 0.7, r: -0.5 });
  // técnico que valida la ruta propuesta: de espaldas a la cámara, inclinado sobre la pantalla del puesto
  const validator = A.makePerson(M, { role: 'conductor', pose: 'work' });
  validator.position.set(BAY[0] + Math.sin(-0.5) * 0.62, y4, BAY[1] + Math.cos(-0.5) * 0.62);
  validator.rotation.y = -0.5 + Math.PI;
  ctx.add(validator);
  ctx.shadows.push({ x: validator.position.x, y: y4, z: validator.position.z, w: 0.6, d: 0.45, r: -0.5 });

  // ---------- Balizas sobre el bordillo, como en la referencia; su charco de luz cae en la calzada ----------
  lampRuns.forEach((run) => {
    const pts = run.filter((p) => p.rIn < 9.3).map((p) => toXZ(s4.x, s4.z, p.a, p.rIn));
    along(pts, 3.4, 0.8).forEach(([x, z]) => {
      if (!free(x, z, 0.9)) return;
      const gx = field(x + 0.04, z) - field(x - 0.04, z);
      const gz = field(x, z + 0.04) - field(x, z - 0.04);
      const l = Math.hypot(gx, gz) || 1;
      ctx.lamps.push({ x, y: y4 + KERB_H, z, r: Math.atan2(gx, gz), ox: (gx / l) * 0.62, oz: (gz / l) * 0.62, fy: y4 + 0.012 });
      claim(x, z, 0.3);
    });
  });

  // ---------- Plantación: árboles en la parte ancha, seto bajo junto a los bordillos y rocas ----------
  // Si el hueco pedido está ocupado (poste, roca, baliza) o es estrecho, se prueba en torno a él.
  const NUDGE = [[0, 0], [0.06, 0], [-0.06, 0], [0, -0.12], [0.1, -0.08], [-0.1, -0.08], [0.12, 0.06], [-0.12, 0.06]];
  const plant = (deg, frac, depth, s) => {
    const p = quadrant(deg);
    if (!p) return;
    let spot = null;
    for (const [df, dd] of NUDGE) {
      const f = THREE.MathUtils.clamp(frac + df, 0.04, 0.96);
      const { a, rIn, rOut } = p.soil[Math.round((p.soil.length - 1) * f)];
      const [x, z] = toXZ(s4.x, s4.z, a, rIn + (rOut - rIn) * THREE.MathUtils.clamp(depth + dd, 0.25, 0.8));
      if (field(x, z) <= -0.8 && free(x, z, 0.75)) {
        spot = { a, x, z };
        break;
      }
    }
    if (!spot) return;
    const { a, x, z } = spot;
    trees.push({ x, y: onSoil(x, z), z, s, kind: 'tree', r: hash(x, z) * 6.28 });
    // reserva solo el pie del árbol: bajo la copa puede crecer el sotobosque
    claim(x, z, 0.45);
    if (s > 1) return;
    // dos rocas al pie de los árboles pequeños, a los lados en sentido tangencial
    const tx = -Math.sin(a);
    const tz = Math.cos(a);
    [[1.0, 0.44], [-0.9, 0.34]].forEach(([d, rs]) => {
      const rx = x + tx * d;
      const rz = z + tz * d;
      if (field(rx, rz) > -0.45 || !free(rx, rz, 0.3)) return;
      rocks.push({ x: rx, y: onSoil(rx, rz) + 0.04, z: rz, s: rs, v: 2, sy: 0.7, r: hash(rz, rx) * 6.28 });
      claim(rx, rz, rs * 0.9);
    });
  };
  // rocas de porte medio semienterradas en las puntas de los parterres que miran a la cámara: se busca el
  // punto más hondo del tramo de ángulos para que la roca quepa sin pisar el bordillo
  const boulder = (d0, d1, s) => {
    let best = null;
    for (let d = d0; d <= d1; d += 1) {
      const a = THREE.MathUtils.degToRad(d);
      for (let r = 5.8; r <= 9.0; r += 0.1) {
        const [x, z] = toXZ(s4.x, s4.z, a, r);
        const f = field(x, z);
        if (f < -0.5 && free(x, z, 0.6) && (!best || f < best.f)) best = { x, z, f };
      }
    }
    if (!best) return;
    const fit = Math.min(s, (-best.f - 0.22) / 0.95);
    if (fit < 0.8 || !free(best.x, best.z, fit * 0.8)) return;
    rocks.push({ x: best.x, y: onSoil(best.x, best.z) - 0.1 * fit, z: best.z, s: fit, v: 0, sy: 0.72, r: hash(best.x, best.z) * 6.28 });
    // los árboles pueden crecer pegados a la roca, como en los afloramientos de la referencia
    claim(best.x, best.z, fit * 0.55);
  };
  boulder(200, 214, 1.0); // NO, del lado de la entrada
  boulder(86, 98, 1.1); // S, boca de C
  boulder(14, 22, 1.0); // E, boca de B
  // árboles: junto al borde exterior, los más altos (estrato medio entre el seto y el fondo); después, los
  // pequeños en la parte ancha con sus rocas al pie
  plant(315, 0.58, 0.74, 1.25);
  plant(315, 0.12, 0.62, 1.15);
  plant(220, 0.64, 0.74, 1.22);
  // a ambos lados de la salida C: primer plano con paralaje cuando la cámara baja por esa ruta
  plant(120, 0.44, 0.74, 1.18);
  plant(36, 0.62, 0.74, 1.15);
  plant(315, 0.3, 0.6, 0.86);
  plant(36, 0.5, 0.45, 0.8);
  plant(120, 0.66, 0.62, 0.74);
  plant(120, 0.86, 0.5, 0.8);
  planters.forEach((p) => {
    // seto bajo del lado de la calzada: matas estiradas a lo largo del bordillo, casi continuas
    along(p.road, 1.0, 0.45).forEach((q) => {
      const [x, z] = inward(field, q, 0.42);
      if (field(x, z) > -0.5 || !free(x, z, 0.2)) return;
      const gx = field(x + 0.04, z) - field(x - 0.04, z);
      const gz = field(x, z + 0.04) - field(x, z - 0.04);
      const r = Math.atan2(-gx, -gz) + (hash(z, x) - 0.5) * 0.3;
      trees.push({ x, y: onSoil(x, z), z, s: 0.72 + hash(x, z) * 0.22, kind: 'shrub', r, sx: 1.45 });
      claim(x, z, 0.25);
    });
    // grupos de rocas hacia el borde exterior: el parterre gana relieve, como las islas de la referencia
    [0.18, 0.5, 0.82].forEach((f, i) => {
      const { a, rIn, rOut } = p.soil[Math.round((p.soil.length - 1) * f)];
      if (rOut - rIn < 2.2) return;
      const [x, z] = toXZ(s4.x, s4.z, a, rIn + (rOut - rIn) * 0.74);
      if (field(x, z) > -0.7 || !free(x, z, 0.55)) return;
      const tx = -Math.sin(a);
      const tz = Math.cos(a);
      [[0, 0, 0.62 + (i % 2) * 0.12], [0.62, 0.25, 0.38], [-0.55, 0.3, 0.32]].forEach(([d, o, rs]) => {
        const rx = x + tx * d - Math.cos(a) * o;
        const rz = z + tz * d - Math.sin(a) * o;
        if (field(rx, rz) > -0.35) return;
        rocks.push({ x: rx, y: onSoil(rx, rz) + 0.06 * rs, z: rz, s: rs, v: rs > 0.5 ? 0 : 2, sy: 0.75, r: hash(rx, rz) * 6.28 });
      });
      claim(x, z, 0.55);
    });
    // relleno en manchas: matas solo donde un ruido de baja frecuencia (o una loma) lo pide; el resto queda
    // como tierra con musgo y alguna piedra suelta, en vez de una retícula uniforme
    const pts = p.soil.flatMap(({ a, rIn, rOut }) => [toXZ(s4.x, s4.z, a, rIn), toXZ(s4.x, s4.z, a, rOut)]);
    const xs = pts.map((q) => q[0]);
    const zs = pts.map((q) => q[1]);
    for (let gx = Math.min(...xs); gx <= Math.max(...xs); gx += 0.95) {
      for (let gz = Math.min(...zs); gz <= Math.max(...zs); gz += 0.95) {
        const x = gx + (hash(gx, gz) - 0.5) * 0.55;
        const z = gz + (hash(gz, gx) - 0.5) * 0.55;
        const f = field(x, z);
        if (f > -0.45 || !free(x, z, 0.2)) continue;
        const h = lift(x, z);
        const drift = valueNoise(x / 2.6 + 11.3, z / 2.6 + 3.7) + h * 0.7;
        if (drift < 0.47) {
          if (drift < 0.32 && hash(x * 1.7, z) > 0.7) rocks.push({ x, y: soilY + h + 0.02, z, s: 0.2 + hash(z, x * 1.3) * 0.14, v: 2, sy: 0.6, r: hash(x, z) * 6.28 });
          continue;
        }
        // corazón de la mancha con matas de hoja; el borde, con hierba en macolla
        const deep = Math.min(1, -f / 1.6);
        const core = drift > 0.58;
        trees.push({ x, y: soilY + h, z, s: core ? 0.72 + deep * 0.34 : 1.25 + hash(x, z) * 0.45, kind: core ? 'shrub' : 'low', r: hash(x, z) * 6.28 });
        claim(x, z, 0.25);
      }
    }
  });

  // ---------- sA · Segunda vida: almacenamiento estacionario bajo la marquesina solar ----------
  // Los módulos que ya no rinden para mover un coche, pero guardan energía, se montan en un contenedor de
  // almacenamiento conectado a un armario de conversión. Ningún coche ni batería de arranque aquí.
  const sA = STATIONS.sA;
  const yA = sA.y;
  const canopy = new THREE.Group();
  [[-4, -2.5], [4, -2.5], [-4, 2.5], [4, 2.5]].forEach(([x, z]) => canopy.add(K.rbox(0.25, 3.4, 0.25, M.darkSteel, x, 0, z, 0.04)));
  canopy.add(K.rbox(9.2, 0.25, 6.2, M.panel, 0, 3.4, 0, 0.06));
  [-1.7, 0, 1.7].forEach((z) => canopy.add(K.box(8, 0.05, 0.16, M.warmGlow, 0, 3.36, z)));
  canopy.add(K.box(9.22, 0.035, 0.02, M.limeLine, 0, 3.5, 3.112));
  // placas solares sobre la marquesina
  [-1.45, 1.35].forEach((z) => [-3.3, -1.1, 1.1, 3.3].forEach((x) => {
    const pv = new THREE.Group();
    pv.add(K.box(2.0, 0.04, 1.2, M.steel, 0, 0, 0));
    pv.add(K.box(1.92, 0.045, 1.12, M.darkGlass, 0, 0.006, 0));
    pv.position.set(x, 3.76, z);
    pv.rotation.x = 0.17;
    canopy.add(pv);
  }));
  // rótulo de la zona sobre el canto delantero de la marquesina, de cara al puente
  const signA = new THREE.Group();
  [-0.7, 0.7].forEach((x) => signA.add(K.box(0.06, 0.2, 0.06, M.darkSteel, x, 0, 0)));
  signA.add(K.rbox(2.12, 1.1, 0.06, M.darkSteel, 0, 0.18, -0.035, 0.02));
  const signAFace = new THREE.Mesh(toSlot(new THREE.PlaneGeometry(2.0, 1.0), 0, 1, [0, 128, SLOT, 256]), signMat);
  signAFace.position.set(0, 0.73, 0);
  signA.add(signAFace);
  signA.position.set(0, 3.65, 3.0);
  canopy.add(signA);
  canopy.position.set(sA.x, yA, sA.z - 0.5);
  ctx.add(canopy);
  // contenedor de almacenamiento con la puerta abierta y los racks de módulos a la vista
  const bess = A.makeBESS(M, { length: 6, doorOpen: true });
  bess.position.set(18.3, yA, -29.75);
  ctx.add(bess);
  ctx.shadows.push({ x: 18.3, y: yA, z: -29.75, w: 6.3, d: 2.7 });
  // armario de conversión (inversor) entre el contenedor y la red
  const pcs = new THREE.Group();
  pcs.add(K.box(1.3, 0.08, 0.85, M.concreteLight, 0, 0, 0));
  pcs.add(K.rbox(1.2, 2.05, 0.75, M.ivoryPanel, 0, 0.08, 0, 0.03));
  for (let i = 0; i < 5; i++) pcs.add(K.box(0.9, 0.03, 0.02, M.darkSteel, 0, 0.3 + i * 0.09, 0.38));
  pcs.add(K.box(0.36, 0.22, 0.012, M.darkGlass, 0, 1.45, 0.38));
  pcs.add(K.box(0.05, 0.05, 0.02, M.amberGlow, 0.42, 1.95, 0.38));
  pcs.add(K.box(0.05, 0.05, 0.02, M.lime, 0.32, 1.95, 0.38));
  pcs.position.set(23.55, yA, -29.4);
  ctx.add(pcs);
  ctx.shadows.push({ x: 23.55, y: yA, z: -29.4, w: 1.4, d: 0.95 });
  // cableado: bandeja con dos cables del contenedor al armario, bajante de las placas y acometida a la red
  ctx.add(K.box(1.7, 0.07, 0.3, M.darkSteel, 22.1, yA, -29.4));
  [-29.48, -29.32].forEach((z) => ctx.add(K.box(1.7, 0.045, 0.06, M.rubber, 22.1, yA + 0.07, z)));
  ctx.add(K.box(0.08, 1.27, 0.08, M.darkSteel, 23.3, yA + 2.13, -29.55));
  ctx.add(K.box(0.12, 0.5, 0.12, M.darkSteel, 24.25, yA, -29.4));
  // pantalla del ejemplo en un pedestal, de cara al puente
  const storeLive = T.liveScreen(256, 128, drawStore, 6);
  const storeStand = new THREE.Group();
  storeStand.add(K.box(0.5, 0.05, 0.36, M.darkSteel, 0, 0, 0));
  storeStand.add(K.box(0.1, 1.2, 0.1, M.darkSteel, 0, 0.05, -0.05));
  const storeScreen = K.framedScreen(M, storeLive.texture, 1.5, 0.75, 0.9);
  storeScreen.position.set(0, 1.62, 0);
  storeStand.add(storeScreen);
  storeStand.position.set(22.0, yA, -26.55);
  storeStand.rotation.y = -0.35;
  ctx.add(storeStand);
  // técnico especialista con guantes aislantes, de espaldas, revisando los racks por la puerta abierta
  const specialist = A.makePerson(M, { role: 'especialista', pose: 'work' });
  specialist.position.set(19.2, yA, -27.85);
  specialist.rotation.y = Math.PI;
  ctx.add(specialist);
  ctx.shadows.push({ x: 19.2, y: yA, z: -27.85, w: 0.6, d: 0.5 });
  // palé de módulos recién llegados del desmontaje, junto a la llegada del puente
  const palA = A.makePallet(M, { kind: 'modulos' });
  palA.position.set(15.7, yA, -26.95);
  palA.rotation.y = 0.12;
  ctx.add(palA);
  ctx.shadows.push({ x: 15.7, y: yA, z: -26.95, w: 1.4, d: 1.2, r: 0.12 });
  // jardineras a ambos lados de la llegada del puente
  [[15.0, 2.1], [22.0, 3.6]].forEach(([x, w]) => {
    ctx.add(K.rbox(w, 0.42, 0.7, M.concreteLight, x, yA, -24.85, 0.05));
    ctx.add(K.box(w - 0.16, 0.02, 0.54, M.trunk, x, yA + 0.38, -24.85));
    const n = Math.round(w / 0.72);
    for (let i = 0; i < n; i++) trees.push({ x: x - w / 2 + 0.38 + i * ((w - 0.76) / Math.max(1, n - 1)), y: yA + 0.4, z: -24.85, s: 0.58 + (i % 3) * 0.08, kind: i % 2 ? 'low' : 'shrub', r: i * 1.7 });
  });
  const canopySpot = new THREE.SpotLight('#ffcf96', 26, 8, 0.95, 0.6, 1.5);
  canopySpot.position.set(sA.x + 0.9, yA + 3.2, sA.z - 0.5);
  canopySpot.target.position.set(sA.x + 0.9, yA, sA.z - 0.5);
  ctx.add(canopySpot);
  ctx.add(canopySpot.target);

  // ---------- sB · Desmontaje de baterías de coche eléctrico ----------
  // El edificio de cristal es el puesto de alta tensión: mesa elevadora con el paquete abierto, polipasto que saca
  // los módulos, estante de módulos, herramientas aisladas y dos técnicos. Fuera, un paquete remanufacturado que
  // vuelve a un coche y el camión ligero que lleva los módulos que no sirven al reciclador de litio.
  const sB = STATIONS.sB;
  const yB = sB.y;
  const yF = yB + 0.06; // suelo interior
  const BX = 32.9;
  const BZ = -10.1;
  const BW = 5.8;
  const BD = 5.0;
  const BH = 4.0;
  const lab = K.makeCutaway(M, { w: BW, d: BD, h: BH, roofDepth: 0.6, light: 10, glassFront: true });
  lab.position.set(BX, yB, BZ);
  ctx.add(lab);
  const wallX = BX - BW / 2 - 0.175; // cara exterior del muro oeste (mira al cruce)
  // zona de trabajo: alfombra aislante con su cinta ámbar
  const MX = 32.8;
  const MZ = -9.9;
  ctx.add(K.box(4.2, 0.012, 2.8, M.rubber, MX, yF, MZ));
  [[MX, MZ - 1.42, 4.3, 0.05], [MX, MZ + 1.42, 4.3, 0.05], [MX - 2.12, MZ, 0.05, 2.8], [MX + 2.12, MZ, 0.05, 2.8]].forEach(([x, z, w, d]) => ctx.add(K.box(w, 0.008, d, M.amberMatte, x, yF, z)));
  // mesa elevadora de tijera
  const TX = 33.0;
  const TZ = -10.15;
  const tableTop = yF + 0.86;
  ctx.add(K.box(2.1, 0.1, 1.3, M.darkSteel, TX, yF, TZ));
  [-0.55, 0.55].forEach((dz) => [0.351, -0.351].forEach((a) => {
    const arm = K.box(1.92, 0.07, 0.05, M.amberMatte, TX, yF + 0.41, TZ + dz);
    arm.rotation.z = a;
    ctx.add(arm);
  }));
  ctx.add(K.rbox(2.5, 0.08, 1.75, M.darkSteel, TX, yF + 0.78, TZ, 0.02));
  ctx.add(K.box(2.52, 0.03, 0.04, M.amberMatte, TX, yF + 0.8, TZ + 0.88));
  ctx.shadows.push({ x: TX, y: yF, z: TZ, w: 2.6, d: 1.9 });
  // el paquete mide 2,2 m en su z local: girado, queda a lo largo de la mesa con el frente (conector) al este;
  // los dos módulos que faltan son los de la primera fila, bajo el polipasto
  const pack = A.makeEVPack(M, { open: true, modulesOut: 2 });
  pack.position.set(TX, tableTop, TZ);
  pack.rotation.y = Math.PI / 2;
  ctx.add(pack);
  // técnicos de alta tensión: uno de espaldas al cristal y otro de perfil en el extremo oeste de la mesa
  [[32.3, -8.72, Math.PI], [31.15, -10.2, Math.PI / 2]].forEach(([x, z, r]) => {
    const p = A.makePerson(M, { role: 'altaTension', pose: 'work' });
    p.position.set(x, yF, z);
    p.rotation.y = r;
    ctx.add(p);
    ctx.shadows.push({ x, y: yF, z, w: 0.6, d: 0.5, r });
  });
  // vallado de la zona de alta tensión (postes y barra ámbar) con su placa
  [31.0, 33.0, 35.0].forEach((x) => {
    ctx.add(K.cyl(0.12, 0.14, 0.04, M.rubber, 12).translateX(x).translateY(yF + 0.02).translateZ(-8.25));
    ctx.add(K.cyl(0.025, 0.025, 0.95, M.amberMatte, 8).translateX(x).translateY(yF + 0.5).translateZ(-8.25));
  });
  [32.0, 34.0].forEach((x) => ctx.add(K.box(1.95, 0.035, 0.03, M.amberMatte, x, yF + 0.85, -8.25)));
  const hvA = A.makeHVSign(M, { text: 'ALTA TENSIÓN' });
  hvA.position.set(33.0, yF + 0.42, -8.22);
  ctx.add(hvA);
  // estante de módulos contra el muro del fondo
  const modules = [];
  const shelfB = K.shelf(M, { w: 2.6, h: 2.1, d: 0.55, levels: 3 });
  shelfB.position.set(33.95, yF, -12.05);
  ctx.add(shelfB);
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3; i++) for (let k = 0; k < (l === 2 && i === 2 ? 1 : 2); k++) modules.push({ x: 33.15 + i * 0.8, y: yF + 0.2 + l * 0.7 + k * 0.155, z: -12.05 });
  // carro donde el polipasto deja el módulo
  const cartX = 35.0;
  const cartZ = TZ + 0.33;
  ctx.add(K.rbox(0.55, 0.04, 0.74, M.darkSteel, cartX, yF + 0.78, cartZ, 0.012));
  ctx.add(K.rbox(0.55, 0.04, 0.74, M.darkSteel, cartX, yF + 0.22, cartZ, 0.012));
  [[-0.24, -0.33], [0.24, -0.33], [-0.24, 0.33], [0.24, 0.33]].forEach(([dx, dz]) => {
    ctx.add(K.box(0.03, 0.74, 0.03, M.steel, cartX + dx, yF + 0.08, cartZ + dz));
    const wheel = K.cyl(0.045, 0.045, 0.035, M.rubber, 10);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(cartX + dx, yF + 0.045, cartZ + dz);
    ctx.add(wheel);
  });
  modules.push({ x: cartX, y: yF + 0.26, z: cartZ, r: Math.PI / 2 });
  // polipasto: viga colgada del canto del techo; el carro y el módulo se mueven en el capítulo de desmontaje
  const beamY = yB + BH - 0.75;
  ctx.add(K.box(4.0, 0.14, 0.12, M.darkSteel, 33.55, beamY, cartZ));
  [31.9, 35.2].forEach((x) => ctx.add(K.box(0.06, yB + BH - beamY - 0.14 + 0.02, 0.06, M.darkSteel, x, beamY + 0.14, cartZ)));
  const trolley = new THREE.Group();
  trolley.add(K.rbox(0.36, 0.22, 0.3, M.amberMatte, 0, -0.22, 0, 0.03));
  trolley.add(K.box(0.12, 0.08, 0.12, M.darkSteel, 0, -0.3, 0));
  const trolleyMesh = ctx.dyn(K.compact(trolley));
  ctx.add(trolleyMesh);
  const load = new THREE.Group();
  const loadModule = A.makeModule(M);
  loadModule.rotation.y = Math.PI / 2;
  load.add(loadModule);
  load.add(K.box(0.05, 0.03, 0.52, M.darkSteel, 0, 0.27, 0));
  [-0.22, 0.22].forEach((z) => load.add(K.box(0.02, 0.12, 0.02, M.steel, 0, 0.15, z)));
  load.add(K.box(0.1, 0.08, 0.06, M.darkSteel, 0, 0.3, 0));
  const loadMesh = ctx.dyn(K.compact(load));
  ctx.add(loadMesh);
  const cable = ctx.dyn(new THREE.Mesh(K.geo('jCable', () => new THREE.BoxGeometry(0.018, 1, 0.018).translate(0, 0.5, 0)), M.darkSteel));
  ctx.add(cable);
  [trolleyMesh, loadMesh, cable].forEach((o) => (o.userData.noCollide = true));
  const hoist = {
    x0: TX + 0.9, x1: cartX, z: cartZ,
    y0: tableTop + 0.34, // justo sobre el paquete
    up: tableTop + 0.95,
    y1: yF + 0.82, // sobre el carro
    top: beamY - 0.3,
  };
  const setHoist = (x, y) => {
    trolleyMesh.position.set(x, beamY, hoist.z);
    loadMesh.position.set(x, y, hoist.z);
    cable.position.set(x, y + 0.34, hoist.z);
    cable.scale.y = Math.max(0.01, hoist.top - (y + 0.34));
  };
  setHoist(hoist.x1, hoist.y1);
  // puesto de lectura en la esquina del fondo: estado de los módulos y pasos del trabajo en alta tensión
  const desk = new THREE.Group();
  desk.add(K.box(1.5, 0.04, 0.6, M.stoneTop, 0, 0.92, 0));
  [[-0.7, -0.25], [0.7, -0.25], [-0.7, 0.25], [0.7, 0.25]].forEach(([x, z]) => desk.add(K.box(0.04, 0.92, 0.04, M.darkSteel, x, 0, z)));
  [[-0.36, 2], [0.38, 3]].forEach(([x, col]) => {
    desk.add(K.box(0.04, 0.2, 0.04, M.darkSteel, x, 0.96, -0.18));
    desk.add(K.rbox(0.66, 0.43, 0.04, M.darkSteel, x, 1.12, -0.18, 0.012));
    const s = new THREE.Mesh(toSlot(new THREE.PlaneGeometry(0.6, 0.375), col, 1, [0, 48, SLOT, 208]), signMat);
    s.position.set(x, 1.335, -0.156);
    desk.add(s);
  });
  desk.position.set(31.15, yF, -11.95);
  ctx.add(desk);
  // herramientas aisladas en el muro oeste: tablero con mangos ámbar, guantes aislantes y pértiga de rescate
  const tools = new THREE.Group();
  tools.add(K.box(1.3, 0.85, 0.04, M.ivoryPanel, 0, 0, 0));
  for (let i = 0; i < 6; i++) {
    const x = -0.5 + i * 0.2;
    const len = 0.2 + (i % 3) * 0.05;
    tools.add(K.box(0.045, len, 0.03, M.amberMatte, x, 0.55 - len, 0.035));
    tools.add(K.box(0.02, 0.12, 0.02, M.steel, x, 0.55 - len - 0.12, 0.035));
  }
  [-0.38, -0.16].forEach((x) => tools.add(K.rbox(0.13, 0.24, 0.05, M.amberMatte, x, 0.07, 0.04, 0.02)));
  tools.position.set(30.2, yF + 1.0, -9.0);
  tools.rotation.y = Math.PI / 2;
  ctx.add(tools);
  const hook = new THREE.Group();
  hook.add(K.cyl(0.02, 0.02, 1.7, M.ivoryPanel, 8).translateY(0.85));
  hook.add(K.box(0.035, 0.28, 0.035, M.amberMatte, 0.09, 1.62, 0));
  hook.add(K.box(0.16, 0.035, 0.035, M.amberMatte, 0.05, 1.86, 0));
  hook.position.set(30.28, yF, -8.0);
  hook.rotation.y = Math.PI / 2;
  ctx.add(hook);
  // cubierta: climatizador y placas
  const roofY = yB + BH + 0.35;
  ctx.add(K.rbox(1.4, 0.6, 1.0, M.graphiteLight, 31.4, roofY, -11.9, 0.05));
  ctx.add(K.cyl(0.36, 0.36, 0.04, M.darkSteel, 20).translateX(31.4).translateY(roofY + 0.62).translateZ(-11.9));
  [33.2, 34.75].forEach((x) => {
    const pv = new THREE.Group();
    pv.add(K.box(1.45, 0.04, 2.0, M.steel, 0, 0, 0));
    pv.add(K.box(1.38, 0.045, 1.93, M.darkGlass, 0, 0.006, 0));
    pv.position.set(x, roofY + 0.14, -11.5);
    pv.rotation.x = 0.12;
    ctx.add(pv);
  });
  // fachada oeste (la que mira al cruce): puerta por la que entra la traza ámbar, placa de alta tensión y rótulo
  ctx.add(K.box(0.06, 2.2, 1.16, M.darkGlass, wallX - 0.03, yB, -8.4));
  [[-9.02, 0.1], [-7.78, 0.1]].forEach(([z, w]) => ctx.add(K.box(0.1, 2.3, w, M.darkSteel, wallX - 0.05, yB, z)));
  ctx.add(K.box(0.1, 0.1, 1.34, M.darkSteel, wallX - 0.05, yB + 2.25, -8.4));
  ctx.add(K.rbox(0.9, 0.08, 1.6, M.panel, wallX - 0.45, yB + 2.45, -8.4, 0.02));
  ctx.add(K.box(0.24, 0.03, 0.5, M.warmGlow, wallX - 0.4, yB + 2.42, -8.4));
  const hvB = hvA.clone();
  hvB.position.set(wallX - 0.07, yB + 1.3, -8.4);
  hvB.rotation.y = -Math.PI / 2;
  ctx.add(hvB);
  const plate = new THREE.Group();
  plate.add(K.rbox(2.12, 1.12, 0.06, M.darkSteel, 0, -0.56, 0, 0.02));
  const plateFace = new THREE.Mesh(toSlot(new THREE.PlaneGeometry(2.0, 1.0), 0, 1, [0, 0, SLOT, 128]), signMat);
  plateFace.position.z = 0.032;
  plate.add(plateFace);
  plate.position.set(wallX - 0.03, yB + 3.0, -10.9);
  plate.rotation.y = -Math.PI / 2;
  ctx.add(plate);
  // armario eléctrico junto a la puerta
  ctx.add(K.rbox(0.45, 1.4, 0.9, M.graphite, wallX - 0.25, yB, -11.6, 0.03));
  ctx.add(K.box(0.02, 0.05, 0.05, M.amberGlow, wallX - 0.48, yB + 1.2, -11.35));
  // tira cálida bajo el canto delantero de la cubierta
  ctx.add(K.box(BW - 0.8, 0.05, 0.12, M.warmGlow, BX, yB + BH - 0.05, BZ + BD / 2 - 0.3));
  // jardinera en la esquina noroeste
  ctx.add(K.rbox(1.0, 0.45, 0.9, M.concreteLight, 29.25, yB, -12.75, 0.05));
  ctx.add(K.box(0.86, 0.02, 0.76, M.trunk, 29.25, yB + 0.41, -12.75));
  trees.push({ x: 29.25, y: yB + 0.43, z: -12.75, s: 0.62, kind: 'tree', r: 1.2 });
  // fuera, al sur: paquete remanufacturado en su carro, listo para volver a un coche (rótulo de ejemplo)
  const dolly = new THREE.Group();
  dolly.add(K.rbox(2.3, 0.1, 1.6, M.darkSteel, 0, 0.12, 0, 0.02));
  [[-1.0, -0.65], [1.0, -0.65], [-1.0, 0.65], [1.0, 0.65]].forEach(([x, z]) => {
    const w = K.cyl(0.07, 0.07, 0.05, M.rubber, 12);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.07, z);
    dolly.add(w);
  });
  const reman = A.makeEVPack(M, { open: false });
  reman.position.y = 0.22;
  reman.rotation.y = Math.PI / 2;
  dolly.add(reman);
  // fleje lima: revisada y lista para montar
  dolly.add(K.box(0.06, 0.008, 1.56, M.limeLine, 0.55, 0.53, 0));
  dolly.position.set(34.2, yB, -5.95);
  ctx.add(dolly);
  ctx.shadows.push({ x: 34.2, y: yB, z: -5.95, w: 2.4, d: 1.7 });
  // placas de rótulo sobre poste (mitades apaisadas del atlas)
  const placard = (row, x, z, ry, w) => {
    const g = new THREE.Group();
    g.add(K.cyl(0.035, 0.035, 1.1, M.darkSteel, 8).translateY(0.55));
    g.add(K.rbox(w + 0.08, w / 2 + 0.08, 0.04, M.darkSteel, 0, 1.0, -0.025, 0.012));
    const f = new THREE.Mesh(toSlot(new THREE.PlaneGeometry(w, w / 2), 1, 1, [0, row * 128, SLOT, row * 128 + 128]), signMat);
    f.position.set(0, 1.04 + w / 4, 0);
    g.add(f);
    g.position.set(x, yB, z);
    g.rotation.y = ry;
    ctx.add(g);
  };
  placard(0, 34.2, -4.95, 0, 1.2);
  // camión ligero con las cajas de módulos que no sirven: va al reciclador de litio, fuera del polígono
  // (la trasera abierta mira al sur: se ven los palés de módulos que lleva el propio camión)
  const truck = A.makeTruck(M, { kind: 'ligero', loaded: true, doorsOpen: true });
  truck.position.set(37.75, yB, -9.2);
  truck.rotation.y = Math.PI;
  ctx.add(truck);
  ctx.shadows.push({ x: 37.75, y: yB, z: -9.2, w: 2.4, d: 6.2 });
  placard(1, 39.0, -5.55, -0.3, 0.9);
  ctx.add(instanceGroup(K, A.makeModule(M), modules));
  // ---------- Una sola pasada para vegetación y rocas instanciadas ----------
  ctx.add(K.scatterTrees(M, trees));
  if (rocks.length) ctx.add(K.scatterRocks(M, rocks));

  // ---------- Rosa y puesto de validación: qué ruta propone el software a cada batería ----------
  // La simulación de world.js indica en story.route la ruta de la batería que se acerca a la isla. Sin ruta
  // y con la simulación terminada, la rosa repasa reutilización, desmontaje y reciclaje cada 3 s (fundidos de 0,4 s).
  const weights = [1, 1, 1];
  const routeState = { w: weights };
  let clock = 0;
  let lastDraw = -1;
  let drawnKey = -1;
  let still = false;
  // polipasto del desmontaje: saca un módulo del paquete, lo deja en el carro y lo devuelve (ida y vuelta de 10 s)
  const ease = (u) => u * u * (3 - 2 * u);
  const seg = (u, a, b) => ease(THREE.MathUtils.clamp((u - a) / (b - a), 0, 1));
  const hoistAt = (u) => {
    // 0–0,1 sube · 0,1–0,36 va al carro · 0,36–0,46 baja · espera · 0,56–0,66 sube · 0,66–0,92 vuelve · 0,92–1 baja
    const out = seg(u, 0.1, 0.36) - seg(u, 0.66, 0.92);
    const x = hoist.x0 + (hoist.x1 - hoist.x0) * out;
    const y = hoist.y0 + (hoist.up - hoist.y0) * (seg(u, 0, 0.1) - seg(u, 0.92, 1)) + (hoist.y1 - hoist.up) * (seg(u, 0.36, 0.46) - seg(u, 0.56, 0.66));
    setHoist(x, y);
  };
  // solo con ?debug: acceso a los lienzos vivos y al polipasto para las pruebas automáticas
  if (typeof location !== 'undefined' && location.search.includes('debug')) window.__cruce = { routeLive, storeLive, weights, hoistAt };
  ctx.anim((t, dt, story) => {
    if (story.reduced) {
      // movimiento reducido: estado final representativo, sin bucles
      if (!still) {
        weights.fill(1);
        routeLive.update(t, routeState, true);
        storeLive.update(t, story, true);
        setHoist(hoist.x1, hoist.y1);
        drawnKey = -1;
      }
      still = true;
      return;
    }
    still = false;
    if (story.index === CH.segundaVida) storeLive.update(t, story);
    if (story.index === CH.desmontaje) hoistAt((t % 10) / 10);
    if (story.index !== CH.clasificacion) return;
    clock += dt;
    const best = story.route && story.route in ROUTE_INDEX ? ROUTE_INDEX[story.route] : -1;
    const cycle = story.sim >= 0.999 ? Math.floor((t / 3) % 3) : -1;
    const step = dt / 0.4;
    let key = 0;
    for (let r = 0; r < 3; r++) {
      const target = best >= 0 ? +(r === best) : cycle >= 0 ? +(r === cycle) : 1;
      weights[r] += THREE.MathUtils.clamp(target - weights[r], -step, step);
      key = key * 9 + Math.round(weights[r] * 8);
    }
    // solo se redibuja si cambia el estado visible, y a 12 fps como máximo
    if (key !== drawnKey && clock - lastDraw >= 1 / 12) {
      routeLive.update(t, routeState, true);
      drawnKey = key;
      lastDraw = clock;
    }
  });
}

// Piezas repetidas de un objeto del kit de actores (módulos de litio): una InstancedMesh por material.
function instanceGroup(K, src, list) {
  const parts = K.compact(src);
  const out = new THREE.Group();
  const o = new THREE.Object3D();
  parts.children.forEach((m) => {
    const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
    list.forEach((t, i) => {
      o.position.set(t.x, t.y, t.z);
      o.rotation.set(0, t.r || 0, 0);
      o.scale.setScalar(t.s || 1);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    out.add(im);
  });
  return out;
}

// Pantalla de segunda vida (256 × 128, 6 fps solo en su capítulo): energía de las placas → almacenamiento con
// módulos de segunda vida → red. Rotulada como ejemplo y sin cifras: la barra de carga sube y baja despacio.
const SUN_RAYS = Array.from({ length: 8 }, (_, k) => [Math.cos((k / 8) * Math.PI * 2), Math.sin((k / 8) * Math.PI * 2)]);

function drawStore(g, w, h, t, story) {
  const k = !story || story.reduced ? 0.8 : 0.3 + 0.55 * (0.5 - 0.5 * Math.cos((t / 12) * Math.PI * 2));
  g.fillStyle = '#0f1112';
  g.fillRect(0, 0, w, h);
  g.fillStyle = PAL.lime;
  g.fillRect(0, 0, w, 4);
  g.textAlign = 'left';
  g.fillStyle = PAL.ivory;
  g.font = '700 15px "Archivo Variable", "Archivo", sans-serif';
  g.fillText('Almacenamiento con módulos', 10, 24);
  g.font = '600 13px "Archivo Variable", "Archivo", sans-serif';
  g.fillStyle = PAL.lime;
  g.fillText('de segunda vida · ejemplo', 10, 42);
  // sol (placas de la marquesina)
  g.fillStyle = PAL.amber;
  g.strokeStyle = PAL.amber;
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(30, 86, 9, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  SUN_RAYS.forEach(([c, s]) => {
    g.moveTo(30 + c * 13, 86 + s * 13);
    g.lineTo(30 + c * 18, 86 + s * 18);
  });
  g.stroke();
  // flechas
  g.strokeStyle = 'rgba(241,238,230,0.55)';
  g.lineWidth = 2;
  g.beginPath();
  [[54, 76], [184, 206]].forEach(([a, b]) => {
    g.moveTo(a, 86);
    g.lineTo(b, 86);
    g.moveTo(b - 6, 81);
    g.lineTo(b, 86);
    g.lineTo(b - 6, 91);
  });
  g.stroke();
  // almacenamiento: cuatro módulos y su carga
  g.strokeStyle = PAL.ivory;
  g.lineWidth = 2;
  g.strokeRect(84, 68, 92, 36);
  g.fillStyle = PAL.lime;
  g.fillRect(87, 71, 86 * k, 30);
  g.fillStyle = '#0f1112';
  [107, 129, 151].forEach((x) => g.fillRect(x, 69, 2, 34));
  g.fillStyle = PAL.dim;
  g.font = '600 11px "Archivo Variable", "Archivo", sans-serif';
  g.fillText('placas', 12, 118);
  g.fillText('carga', 112, 118);
  g.fillText('red', 214, 118);
  // red: torre eléctrica sencilla
  g.strokeStyle = PAL.ivory;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(214, 104);
  g.lineTo(222, 70);
  g.lineTo(230, 104);
  g.moveTo(212, 80);
  g.lineTo(232, 80);
  g.moveTo(215, 92);
  g.lineTo(229, 92);
  g.stroke();
}
