import * as THREE from 'three';
import { BRIDGES, TRACES } from '../layout.js';

// 4 · Cruce con tres rutas: rotonda con isla ajardinada, calzadas con bordillo y marcas lima, parterres
// con vegetación y balizas, aparcamiento de servicio (A) y módulo de evaluación de segunda vida (B).
// Referencia: context/ref-cruce-rutas.png (estilo general: context/EcoBat-scroll-world-referencia.png).

// Ejes de las cuatro calzadas: siguen las trazas y las rutas simuladas de world.js.
const AXES = [
  [5.0, -5.4, 12.4, -8.2], // entrada desde el laboratorio
  [15.3, -11.0, 16.9, -19.5], // A · sigue en servicio
  [19.5, -8.2, 27.5, -8.0], // B · evaluación de segunda vida
  [16.9, -5.0, 19.6, 3.6], // C · reciclaje autorizado
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
// sobre ellas. La rosa sabe qué ruta toma cada batería que llega a la rotonda por story.route.
const ROUTES = ['service', 'second', 'recycle'];

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

function iconCar(g, cx, cy, s, col) {
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = 10 * s;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 66 * s, cy + 18 * s);
  g.lineTo(cx - 66 * s, cy - 2 * s);
  g.lineTo(cx - 40 * s, cy - 8 * s);
  g.lineTo(cx - 22 * s, cy - 34 * s);
  g.lineTo(cx + 28 * s, cy - 34 * s);
  g.lineTo(cx + 46 * s, cy - 8 * s);
  g.lineTo(cx + 66 * s, cy - 2 * s);
  g.lineTo(cx + 66 * s, cy + 18 * s);
  g.closePath();
  g.stroke();
  [-36, 38].forEach((dx) => {
    g.beginPath();
    g.arc(cx + dx * s, cy + 22 * s, 13 * s, 0, Math.PI * 2);
    g.fill();
  });
}

function iconScan(g, cx, cy, s, col) {
  // lupa sobre un módulo de batería
  g.strokeStyle = col;
  g.lineWidth = 10 * s;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeRect(cx - 68 * s, cy - 26 * s, 84 * s, 60 * s);
  g.beginPath();
  g.moveTo(cx - 50 * s, cy - 38 * s);
  g.lineTo(cx - 30 * s, cy - 38 * s);
  g.stroke();
  g.beginPath();
  g.arc(cx + 22 * s, cy - 6 * s, 30 * s, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(cx + 44 * s, cy + 16 * s);
  g.lineTo(cx + 68 * s, cy + 42 * s);
  g.stroke();
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
  const sign = (col, color, icon, label) => slot(col, 0, () => {
    g.fillStyle = PAL.bg;
    g.fillRect(0, 0, SLOT, SLOT);
    g.strokeStyle = color;
    g.lineWidth = 9;
    g.strokeRect(12, 12, SLOT - 24, SLOT - 24);
    icon(g, 128, 104, 1.05, color);
    g.fillStyle = PAL.ivory;
    g.font = font(800, label.length > 9 ? 27 : 31);
    g.textAlign = 'center';
    g.fillText(label, 128, 212);
  });
  sign(0, PAL.lime, iconCar, 'SERVICIO');
  sign(1, PAL.amber, iconScan, 'EVALUACIÓN');
  sign(2, PAL.ivory, iconRecycle, 'RECICLAJE');
  // rótulo de fachada del módulo B
  slot(3, 0, () => {
    g.fillStyle = PAL.bg;
    g.fillRect(0, 0, SLOT, SLOT);
    g.fillStyle = PAL.amber;
    g.fillRect(0, 0, SLOT, 10);
    iconScan(g, 128, 88, 0.95, PAL.amber);
    g.fillStyle = PAL.ivory;
    g.textAlign = 'center';
    g.font = font(800, 28);
    g.fillText('EVALUACIÓN', 128, 178);
    g.fillStyle = PAL.dim;
    g.font = font(600, 22);
    g.fillText('segunda vida', 128, 212);
  });
  // monitor del banco de pruebas: la traza de capacidad ya completa (la que avanza está en la fachada)
  slot(0, 1, () => {
    g.fillStyle = '#0f1112';
    g.fillRect(0, 48, SLOT, 160);
    g.strokeStyle = 'rgba(229,174,80,0.16)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 16; x < SLOT; x += 28) {
      g.moveTo(x, 86);
      g.lineTo(x, 196);
    }
    for (let y = 86; y < 200; y += 22) {
      g.moveTo(16, y);
      g.lineTo(SLOT - 16, y);
    }
    g.stroke();
    g.strokeStyle = PAL.amber;
    g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const u = i / 48;
      const x = 16 + u * (SLOT - 32);
      const y = 96 + (1 - Math.exp(-u * 3.2)) * 70;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = PAL.ivory;
    g.font = font(700, 18);
    g.fillText('Capacidad', 16, 74);
    g.fillStyle = PAL.lime;
    g.textAlign = 'right';
    // traza de ejemplo: sin un porcentaje de capacidad que no tiene fuente
    g.fillText('Ejemplo', SLOT - 16, 74);
  });
  // monitores fijos del puesto de evaluación (barras de capacidad y tensión)
  slot(2, 1, () => {
    g.fillStyle = '#0f1112';
    g.fillRect(0, 48, SLOT, 160);
    [0.42, 0.58, 0.51, 0.77, 0.69, 0.86, 0.74].forEach((v, i) => {
      g.fillStyle = i === 5 ? PAL.lime : 'rgba(194,242,48,0.42)';
      g.fillRect(22 + i * 32, 192 - v * 120, 20, v * 120);
    });
    g.fillStyle = PAL.dim;
    g.font = font(600, 16);
    g.fillText('Capacidad · lote 04 · ejemplo', 20, 74);
  });
  slot(3, 1, () => {
    g.fillStyle = '#0f1112';
    g.fillRect(0, 48, SLOT, 160);
    g.lineWidth = 16;
    g.strokeStyle = 'rgba(229,174,80,0.22)';
    g.beginPath();
    g.arc(128, 168, 86, Math.PI, 0);
    g.stroke();
    g.strokeStyle = PAL.amber;
    g.beginPath();
    g.arc(128, 168, 86, Math.PI, Math.PI * 1.68);
    g.stroke();
    g.fillStyle = PAL.ivory;
    g.textAlign = 'center';
    g.font = font(800, 34);
    // lectura de ejemplo: 12,4 V en reposo es en torno al 75 % de carga en una batería inundada (pestaña Datos)
    g.fillText('12,4 V', 128, 168);
    g.fillStyle = PAL.dim;
    g.font = font(600, 15);
    g.fillText('tensión en reposo · ejemplo', 128, 196);
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
  { color: PAL.lime, rgb: '194,242,48', label: 'Servicio', icon: iconCar },
  { color: PAL.amber, rgb: '229,174,80', label: 'Evaluación', icon: iconScan },
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
  const exits = [dirs.service, dirs.second, dirs.recycle];
  const entryA = Math.atan2(dirs.entry[1], dirs.entry[0]);
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
    g.save();
    g.rotate(entryA);
    g.fillStyle = 'rgba(241,238,230,0.4)';
    g.fillRect(35, -4, 18, 8);
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
  const modules = [];
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
  [
    [curves.trace.entry, 2.93, M.lime],
    [curves.trace.service, 0.6, M.lime],
    [curves.trace.service, 2.78, M.lime],
    [curves.trace.second, 0.86, M.amberGlow],
    [curves.trace.second, 3.35, M.amberGlow],
    [curves.trace.recycle, 2.5, M.warmGlow],
  ].forEach(([curve, k, mat]) => {
    const u = k / (curve.points.length - 1);
    const p = curve.getPoint(u);
    curve.getTangent(u, tan);
    const hl = Math.hypot(tan.x, tan.z);
    const hx = tan.x / hl;
    const hz = tan.z / hl;
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
  [[dirs.service, M.lime], [dirs.second, M.amberGlow], [dirs.recycle, M.warmGlow]].forEach(([[dx, dz], mat]) => {
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
  const signGeo = [0, 1, 2].map((col) => toSlot(new THREE.PlaneGeometry(1.22, 1.22), col, 0));
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
  sign(0, s4.x - 2.6, s4.z - 6.6, 0.3);
  // EVALUACIÓN a 2,5 m del eje de B; RECICLAJE en la boca de C, tras su bordillo, de cara a la entrada
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

  // ---------- A · sigue en servicio: plaza cubierta con punto de carga y carro de batería ----------
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
  canopy.position.set(sA.x, yA, sA.z - 0.5);
  ctx.add(canopy);
  const carA = K.makeCar(M, { paint: new THREE.MeshPhysicalMaterial({ color: '#5c6166', metalness: 0.55, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }) });
  carA.position.set(sA.x - 1.2, sA.y, sA.z - 0.5);
  carA.rotation.y = 0.15;
  ctx.add(carA);
  ctx.shadows.push({ x: sA.x - 1.2, y: sA.y, z: sA.z - 0.5, w: 5, d: 2.6, r: 0.15 });
  // plaza pintada, tope de rueda, punto de carga y carro con la batería lista para montar
  const bay = new THREE.Group();
  bay.position.set(sA.x - 1.2, yA, sA.z - 0.5);
  bay.rotation.y = 0.15;
  [-1.42, 1.42].forEach((z) => bay.add(K.box(5.3, 0.012, 0.1, M.ivoryPanel, -0.05, 0, z)));
  bay.add(K.box(0.1, 0.012, 2.94, M.ivoryPanel, 2.6, 0, 0));
  bay.add(K.rbox(0.18, 0.12, 1.5, M.rubber, 2.12, 0, 0, 0.04));
  [-0.45, 0.45].forEach((z) => bay.add(K.box(0.19, 0.03, 0.22, M.amberMatte, 2.12, 0.1, z)));
  const charger = new THREE.Group();
  charger.add(K.box(0.5, 0.04, 0.4, M.darkSteel, 0, 0, 0));
  charger.add(K.rbox(0.34, 1.4, 0.28, M.ivoryPanel, 0, 0.04, 0, 0.05));
  charger.add(K.box(0.22, 0.3, 0.012, M.darkGlass, 0, 0.92, 0.146));
  charger.add(K.box(0.16, 0.035, 0.014, M.lime, 0, 1.2, 0.146));
  charger.add(K.box(0.035, 0.035, 0.014, M.amberGlow, 0.1, 0.8, 0.146));
  charger.position.set(2.95, 0, -1.3);
  charger.rotation.y = -Math.PI / 2;
  bay.add(charger);
  bay.add(K.pipe([new THREE.Vector3(2.8, 0.9, -1.22), new THREE.Vector3(2.72, 0.3, -1.12), new THREE.Vector3(2.4, 0.05, -1.0), new THREE.Vector3(2.0, 0.28, -0.98), new THREE.Vector3(1.86, 0.8, -0.95)], 0.02, M.rubber, 32));
  const cart = new THREE.Group();
  cart.add(K.rbox(0.62, 0.05, 0.95, M.darkSteel, 0, 0.7, 0, 0.02));
  cart.add(K.rbox(0.62, 0.04, 0.95, M.darkSteel, 0, 0.2, 0, 0.02));
  [[-0.27, -0.42], [0.27, -0.42], [-0.27, 0.42], [0.27, 0.42]].forEach(([x, z]) => {
    const leg = K.cyl(0.018, 0.018, 0.62, M.steel, 6);
    leg.position.set(x, 0.44, z);
    cart.add(leg);
    const wheel = K.cyl(0.055, 0.055, 0.04, M.rubber, 12);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.055, z);
    cart.add(wheel);
  });
  cart.add(K.pipe([new THREE.Vector3(-0.26, 0.74, -0.47), new THREE.Vector3(-0.26, 1.02, -0.52), new THREE.Vector3(0.26, 1.02, -0.52), new THREE.Vector3(0.26, 0.74, -0.47)], 0.016, M.steel, 16));
  const cartBat = K.makeBattery(M, { scale: 0.38 });
  cartBat.position.set(0, 0.75, 0.05);
  cartBat.rotation.y = Math.PI / 2;
  cart.add(cartBat);
  cart.position.set(2.6, 0, 1.45);
  bay.add(cart);
  ctx.add(bay);
  // segunda plaza: otro vehículo ya en servicio, de morro hacia el norte; el punto de carga queda entre ambos
  const carB = K.makeCar(M, { paint: new THREE.MeshPhysicalMaterial({ color: '#d9d3c5', metalness: 0.4, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12 }) });
  carB.position.set(sA.x + 3.05, yA, sA.z - 0.5);
  carB.rotation.y = Math.PI / 2;
  ctx.add(carB);
  ctx.shadows.push({ x: sA.x + 3.05, y: yA, z: sA.z - 0.5, w: 2.6, d: 5 });
  ctx.add(K.box(0.1, 0.012, 4.9, M.ivoryPanel, sA.x + 4.33, yA, sA.z - 0.5));
  ctx.add(K.box(2.5, 0.012, 0.1, M.ivoryPanel, sA.x + 3.1, yA, sA.z - 2.92));
  ctx.add(K.rbox(1.5, 0.12, 0.18, M.rubber, sA.x + 3.05, yA, sA.z - 2.43, 0.04));
  [-0.45, 0.45].forEach((x) => ctx.add(K.box(0.22, 0.03, 0.19, M.amberMatte, sA.x + 3.05 + x, yA + 0.1, sA.z - 2.43)));
  const tools = K.cabinet(M, { w: 1.1, h: 0.95, d: 0.55, drawers: 5, mat: M.graphite, top: M.stoneTop });
  tools.position.set(18.6, yA, -31.05);
  ctx.add(tools);
  ctx.shadows.push({ x: 18.6, y: yA, z: -31.05, w: 1.3, d: 0.7 });
  // jardineras a ambos lados de la llegada del puente
  [[15.0, 2.1], [22.0, 3.6]].forEach(([x, w]) => {
    ctx.add(K.rbox(w, 0.42, 0.7, M.concreteLight, x, yA, -24.85, 0.05));
    ctx.add(K.box(w - 0.16, 0.02, 0.54, M.trunk, x, yA + 0.38, -24.85));
    const n = Math.round(w / 0.72);
    for (let i = 0; i < n; i++) trees.push({ x: x - w / 2 + 0.38 + i * ((w - 0.76) / Math.max(1, n - 1)), y: yA + 0.4, z: -24.85, s: 0.58 + (i % 3) * 0.08, kind: i % 2 ? 'low' : 'shrub', r: i * 1.7 });
  });
  const canopySpot = new THREE.SpotLight('#ffcf96', 26, 9, 0.95, 0.6, 1.5);
  canopySpot.position.set(sA.x + 0.9, yA + 3.2, sA.z - 0.5);
  canopySpot.target.position.set(sA.x + 0.9, yA, sA.z - 0.5);
  ctx.add(canopySpot);
  ctx.add(canopySpot.target);

  // ---------- B · evaluación de segunda vida: módulo acristalado con banco de pruebas ----------
  const sB = STATIONS.sB;
  const yB = sB.y;
  const yF = yB + 0.06; // suelo interior del módulo
  const evalLab = K.makeCutaway(M, { w: 8, d: 6.5, h: 4.2, roofDepth: 0.6, light: 10, glassFront: true });
  evalLab.position.set(sB.x + 0.5, yB, sB.z - 0.8);
  ctx.add(evalLab);
  // estantería del fondo con módulos en espera
  const rackE = K.shelf(M, { w: 3.4, h: 3.2, d: 0.8, levels: 3 });
  rackE.position.set(sB.x + 2.2, yB, sB.z - 3.4);
  ctx.add(rackE);
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3; i++) modules.push({ x: sB.x + 1.1 + i * 1.1, y: yB + 0.2 + l * 1.07, z: sB.z - 3.4, s: 0.5 });
  // estantería lateral contra el muro este
  const rackS = K.shelf(M, { w: 3.0, h: 2.3, d: 0.7, levels: 2 });
  rackS.position.set(37.95, yF, -11.25);
  rackS.rotation.y = Math.PI / 2;
  ctx.add(rackS);
  for (let l = 0; l < 2; l++) for (let i = 0; i < 3; i++) modules.push({ x: 37.95, y: yF + 0.2 + l * 1.15, z: -12.25 + i * 1.0, s: 0.45, r: -Math.PI / 2 });
  // banco de pruebas: batería conectada al analizador con sus sondas y monitor con la traza
  const evalBench = K.cabinet(M, { w: 2.4, h: 0.9, d: 1.1, drawers: 3, mat: M.ivoryPanel, top: M.stoneTop });
  evalBench.position.set(35.0, yF, -8.35);
  ctx.add(evalBench);
  ctx.shadows.push({ x: 35.0, y: yF, z: -8.35, w: 2.7, d: 1.4 });
  const benchTop = yF + 1.06;
  const testBat = K.makeBattery(M, { scale: 0.42 });
  testBat.position.set(34.45, benchTop, -8.3);
  ctx.add(testBat);
  ctx.add(K.rbox(0.5, 0.3, 0.34, M.graphite, 35.65, benchTop, -8.42, 0.03));
  ctx.add(K.box(0.3, 0.12, 0.012, M.darkGlass, 35.68, benchTop + 0.14, -8.245));
  ctx.add(K.box(0.18, 0.025, 0.014, M.lime, 35.66, benchTop + 0.19, -8.24));
  [[35.47, M.amberMatte], [35.55, M.rubber]].forEach(([x, mat]) => {
    const jack = K.cyl(0.02, 0.02, 0.03, mat, 10);
    jack.rotation.x = Math.PI / 2;
    jack.position.set(x, benchTop + 0.08, -8.24);
    ctx.add(jack);
  });
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  ctx.add(K.pipe([V3(34.7, benchTop + 0.375, -8.39), V3(34.86, benchTop + 0.5, -8.36), V3(35.2, benchTop + 0.42, -8.28), V3(35.45, benchTop + 0.12, -8.23)], 0.013, M.amberMatte, 32));
  ctx.add(K.pipe([V3(34.2, benchTop + 0.375, -8.39), V3(34.3, benchTop + 0.56, -8.5), V3(34.9, benchTop + 0.6, -8.55), V3(35.3, benchTop + 0.4, -8.4), V3(35.53, benchTop + 0.12, -8.23)], 0.013, M.rubber, 40));
  [[34.7, M.amberMatte], [34.2, M.graphite]].forEach(([x, mat]) => ctx.add(K.rbox(0.07, 0.05, 0.05, mat, x, benchTop + 0.343, -8.39, 0.012)));
  // monitor del banco con la traza ya completa (casilla fija del atlas); la que avanza va en la fachada
  const monitor = new THREE.Group();
  monitor.add(K.rbox(1.06, 0.72, 0.08, M.darkSteel, 0, -0.36, 0, 0.02));
  const monitorFace = new THREE.Mesh(toSlot(new THREE.PlaneGeometry(0.9, 0.56), 0, 1, [0, 48, SLOT, 208]), signMat);
  monitorFace.position.z = 0.042;
  monitor.add(monitorFace);
  monitor.position.set(35.1, benchTop + 0.86, -8.72);
  monitor.rotation.y = -0.3;
  ctx.add(monitor);
  ctx.add(K.cyl(0.025, 0.03, 0.5, M.darkSteel, 8).translateX(35.1).translateY(benchTop + 0.25).translateZ(-8.78));
  ctx.add(K.box(0.3, 0.02, 0.22, M.darkSteel, 35.1, benchTop, -8.78));
  // taburete del técnico y zona de pruebas marcada en ámbar
  const stool = (x, z) => {
    ctx.add(K.cyl(0.22, 0.24, 0.03, M.darkSteel, 16).translateX(x).translateY(yF + 0.015).translateZ(z));
    ctx.add(K.cyl(0.025, 0.025, 0.55, M.steel, 8).translateX(x).translateY(yF + 0.3).translateZ(z));
    ctx.add(K.cyl(0.19, 0.19, 0.06, M.graphite, 20).translateX(x).translateY(yF + 0.6).translateZ(z));
  };
  stool(34.2, -7.4);
  [[35.0, -9.25, 3.0, 0.06], [35.0, -7.0, 3.0, 0.06], [33.5, -8.125, 0.06, 2.25], [36.5, -8.125, 0.06, 2.25]].forEach(([x, z, w, d]) => ctx.add(K.box(w, 0.008, d, M.amberMatte, x, yF, z)));
  // puesto de lectura tras el cristal: dos monitores con capacidad y tensión
  const desk = new THREE.Group();
  desk.add(K.box(1.6, 0.04, 0.7, M.stoneTop, 0, 0.72, 0));
  [[-0.75, -0.3], [0.75, -0.3], [-0.75, 0.3], [0.75, 0.3]].forEach(([x, z]) => desk.add(K.box(0.04, 0.72, 0.04, M.darkSteel, x, 0, z)));
  desk.add(K.rbox(0.45, 0.6, 0.6, M.graphite, 0.5, 0.06, 0, 0.02));
  [[-0.36, 2], [0.38, 3]].forEach(([x, col]) => {
    desk.add(K.box(0.04, 0.2, 0.04, M.darkSteel, x, 0.76, -0.2));
    desk.add(K.rbox(0.62, 0.4, 0.04, M.darkSteel, x, 0.92, -0.2, 0.012));
    const s = new THREE.Mesh(toSlot(new THREE.PlaneGeometry(0.56, 0.35), col, 1, [0, 48, SLOT, 208]), signMat);
    s.position.set(x, 1.12, -0.176);
    desk.add(s);
  });
  desk.position.set(31.85, yF, -7.95);
  ctx.add(desk);
  stool(31.7, -7.2);
  // armarios de cajones en el lado abierto
  [-8.65, -7.55].forEach((z) => {
    const cab = K.cabinet(M, { w: 1.0, h: 0.95, d: 0.6, drawers: 4, mat: M.graphite, top: M.stoneTop });
    cab.position.set(38.0, yF, z);
    cab.rotation.y = -Math.PI / 2;
    ctx.add(cab);
  });
  ctx.shadows.push({ x: 38.0, y: yF, z: -8.1, w: 0.8, d: 2.3 });
  // cubierta: climatizador y placas solares
  const roofY = yB + 4.2 + 0.35;
  ctx.add(K.rbox(1.5, 0.62, 1.05, M.graphiteLight, 32.1, roofY, -11.7, 0.05));
  ctx.add(K.cyl(0.38, 0.38, 0.04, M.darkSteel, 24).translateX(32.1).translateY(roofY + 0.64).translateZ(-11.7));
  ctx.add(K.cyl(0.3, 0.3, 0.05, M.panel, 24).translateX(32.1).translateY(roofY + 0.66).translateZ(-11.7));
  ctx.add(K.cyl(0.11, 0.11, 0.7, M.steel, 12).translateX(33.25).translateY(roofY + 0.35).translateZ(-12.7));
  [-12.45, -10.75].forEach((z) => [34.7, 36.3, 37.9].forEach((x) => {
    const pv = new THREE.Group();
    pv.add(K.box(1.5, 0.04, 1.0, M.steel, 0, 0, 0));
    pv.add(K.box(1.43, 0.045, 0.93, M.darkGlass, 0, 0.006, 0));
    pv.position.set(x, roofY + 0.14, z);
    pv.rotation.x = 0.2;
    ctx.add(pv);
  }));
  // fachada oeste (la que mira al cruce): puerta por la que entra la traza ámbar, rótulo, bandeja de cables
  const wallX = sB.x + 0.5 - 4 - 0.175;
  ctx.add(K.box(0.06, 2.2, 1.16, M.darkGlass, wallX - 0.03, yB, -8.4));
  [[-9.02, 0.1], [-7.78, 0.1]].forEach(([z, w]) => ctx.add(K.box(0.1, 2.3, w, M.darkSteel, wallX - 0.05, yB, z)));
  ctx.add(K.box(0.1, 0.1, 1.34, M.darkSteel, wallX - 0.05, yB + 2.25, -8.4));
  ctx.add(K.box(0.04, 0.5, 0.04, M.steel, wallX - 0.08, yB + 0.85, -8.85));
  ctx.add(K.rbox(0.9, 0.08, 1.8, M.panel, wallX - 0.45, yB + 2.45, -8.4, 0.02));
  ctx.add(K.box(0.24, 0.03, 0.5, M.warmGlow, wallX - 0.4, yB + 2.42, -8.4));
  const plate = new THREE.Group();
  plate.add(K.rbox(1.5, 1.5, 0.06, M.darkSteel, 0, -0.75, 0, 0.02));
  const plateFace = new THREE.Mesh(toSlot(new THREE.PlaneGeometry(1.38, 1.38), 3, 0), signMat);
  plateFace.position.z = 0.032;
  plate.add(plateFace);
  plate.position.set(wallX - 0.03, yB + 2.65, -10.9);
  plate.rotation.y = -Math.PI / 2;
  ctx.add(plate);
  ctx.add(K.box(0.14, 0.08, 5.8, M.darkSteel, wallX - 0.08, yB + 3.55, -9.8));
  for (let z = -12.5; z < -6.9; z += 1.2) ctx.add(K.box(0.18, 0.05, 0.04, M.darkSteel, wallX - 0.09, yB + 3.5, z));
  [-12.32, -12.16, -12.0].forEach((z) => ctx.add(K.cyl(0.03, 0.03, 2.05, M.steel, 8).translateX(wallX - 0.12).translateY(yB + 1.5 + 1.025).translateZ(z)));
  ctx.add(K.rbox(0.5, 1.5, 1.1, M.graphite, wallX - 0.27, yB, -11.9, 0.03));
  ctx.add(K.box(0.02, 0.05, 0.05, M.amberGlow, wallX - 0.53, yB + 1.3, -11.6));
  ctx.add(K.box(0.02, 0.16, 0.16, M.amberMatte, wallX - 0.53, yB + 1.0, -12.2));
  for (let i = 0; i < 4; i++) ctx.add(K.box(0.02, 0.025, 0.5, M.darkSteel, wallX - 0.53, yB + 0.3 + i * 0.07, -11.95));
  ctx.add(K.box(0.05, 0.6, 0.9, M.darkSteel, wallX - 0.03, yB + 2.7, -7.3));
  for (let i = 0; i < 5; i++) ctx.add(K.box(0.06, 0.03, 0.82, M.panel, wallX - 0.05, yB + 2.78 + i * 0.1, -7.3));
  // pantalla de estado sobre la marquesina de la puerta: la prueba de capacidad en curso se lee desde el cruce
  const live = T.liveScreen(288, 128, drawTrace, 12);
  const status = K.framedScreen(M, live.texture, 1.8, 0.8, 0.9);
  status.position.set(wallX - 0.06, yB + 3.02, -8.95);
  status.rotation.y = -Math.PI / 2;
  ctx.add(status);
  // tira cálida bajo el canto delantero de la cubierta: el frente abierto se ilumina desde arriba
  ctx.add(K.box(7, 0.05, 0.12, M.warmGlow, sB.x + 0.5, yB + 4.15, -9.45));
  // antepatio: banco y jardinera
  const bench = new THREE.Group();
  [-0.6, 0.6].forEach((z) => bench.add(K.box(0.42, 0.42, 0.06, M.graphite, 0, 0, z)));
  [-0.13, 0, 0.13].forEach((x) => bench.add(K.box(0.11, 0.035, 1.5, M.wood, x, 0.42, 0)));
  bench.position.set(29.45, yB, -10.3);
  ctx.add(bench);
  ctx.add(K.rbox(1.6, 0.45, 1.0, M.concreteLight, 29.2, yB, -13.0, 0.05));
  ctx.add(K.box(1.44, 0.02, 0.84, M.trunk, 29.2, yB + 0.41, -13.0));
  trees.push({ x: 29.0, y: yB + 0.43, z: -13.0, s: 0.7, kind: 'tree', r: 1.2 });
  trees.push({ x: 29.75, y: yB + 0.43, z: -12.8, s: 0.6, kind: 'shrub', r: 0.4 });
  // palé con módulos que esperan su turno y transpaleta
  ctx.add(K.box(1.7, 0.13, 1.1, M.wood, 36.4, yB, -5.2));
  [[36.03, -5.4], [36.77, -5.4], [36.03, -4.98], [36.77, -4.98]].forEach(([x, z]) => modules.push({ x, y: yB + 0.13, z, s: 0.42 }));
  ctx.shadows.push({ x: 36.4, y: yB, z: -5.2, w: 2.0, d: 1.4 });
  const jack = new THREE.Group();
  [-0.2, 0.2].forEach((z) => jack.add(K.box(1.1, 0.06, 0.16, M.darkSteel, 0, 0.02, z)));
  jack.add(K.rbox(0.28, 0.32, 0.56, M.amberMatte, 0.62, 0.02, 0, 0.04));
  jack.add(K.pipe([V3(0.66, 0.34, 0), V3(0.8, 0.8, 0), V3(0.86, 1.08, 0)], 0.022, M.darkSteel, 12));
  jack.add(K.box(0.05, 0.05, 0.36, M.rubber, 0.86, 1.06, 0));
  jack.position.set(38.3, yB, -5.2);
  ctx.add(jack);

  // ---------- Una sola pasada para vegetación, rocas y módulos instanciados ----------
  ctx.add(K.scatterTrees(M, trees));
  if (rocks.length) ctx.add(K.scatterRocks(M, rocks));
  ctx.add(K.batteryInstances(M, modules));

  // ---------- Rosa y puesto de validación: qué ruta propone el software a cada batería ----------
  // La simulación de world.js indica en story.route la ruta de la batería que está a menos de 3 m del
  // bordillo de la isla. Con las diez ya clasificadas, la rosa repasa A, B y C cada 3 s con fundidos de 0,4 s.
  const weights = [1, 1, 1];
  const routeState = { w: weights };
  // solo con ?debug: acceso a los lienzos vivos para las pruebas automáticas
  if (typeof location !== 'undefined' && location.search.includes('debug')) window.__cruce = { routeLive, live, weights };
  let clock = 0;
  let lastDraw = -1;
  let drawnKey = -1;
  let still = false;
  ctx.anim((t, dt, story) => {
    if (story.reduced) {
      // movimiento reducido: estado final representativo, sin bucles
      if (!still) {
        live.update(t, story, true);
        weights.fill(1);
        routeLive.update(t, routeState, true);
        drawnKey = -1;
      }
      still = true;
      return;
    }
    still = false;
    // la prueba de capacidad solo avanza mientras se lee el capítulo 4 (12 fps como máximo)
    if (story.index === 4) live.update(t, story);
    if (story.index < 3 || story.index > 5) return;
    clock += dt;
    const best = story.route ? ROUTES.indexOf(story.route) : -1;
    const cycle = story.sim >= 0.999 ? Math.floor((t / 3) % 3) : -1;
    const step = dt / 0.4;
    let key = 0;
    for (let r = 0; r < 3; r++) {
      const target = best >= 0 ? +(r === best) : +(r === cycle);
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

// Traza de una prueba de capacidad que avanza: tensión bajo carga que cae y se estabiliza. Pantalla
// exterior apaisada (1,8 × 0,8 m): trazo grueso y rótulos grandes para leerse desde el cruce.
const PCT = Array.from({ length: 101 }, (_, i) => `${i} %`);

function drawTrace(g, w, h, t, story) {
  const k = !story || story.reduced ? 1 : (t % 7) / 7;
  const top = 38;
  const bottom = h - 24;
  g.fillStyle = '#0f1112';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(229,174,80,0.18)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 14; x < w; x += 32) {
    g.moveTo(x, top - 4);
    g.lineTo(x, bottom);
  }
  for (let y = top - 4; y <= bottom; y += 20) {
    g.moveTo(14, y);
    g.lineTo(w - 14, y);
  }
  g.stroke();
  const n = Math.max(1, Math.round(k * 72));
  let px = 14;
  let py = top;
  g.strokeStyle = PAL.amber;
  g.lineWidth = 4;
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = i / 72;
    px = 14 + u * (w - 28);
    py = top + (1 - Math.exp(-u * 3.2)) * (bottom - top - 8) + Math.sin(u * 40) * 1.5;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.stroke();
  g.fillStyle = PAL.lime;
  g.beginPath();
  g.arc(px, py, 5.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PAL.ivory;
  g.font = '800 18px "Archivo Variable", sans-serif';
  g.textAlign = 'left';
  // el porcentaje es el avance de la prueba (como la barra inferior), no una capacidad medida
  g.fillText('Avance de la prueba', 14, 24);
  g.textAlign = 'right';
  g.fillStyle = PAL.lime;
  g.fillText(PCT[Math.round(k * 100)], w - 14, 24);
  g.fillStyle = 'rgba(194,242,48,0.22)';
  g.fillRect(14, h - 14, w - 28, 6);
  g.fillStyle = PAL.lime;
  g.fillRect(14, h - 14, (w - 28) * k, 6);
}
