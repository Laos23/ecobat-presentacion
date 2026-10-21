import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------
// Coreografía de cámara.
//
// Un único recorrido continuo: una spline de posiciones y otra de puntos de interés (subject)
// comparten los mismos nudos, así que posición, mirada, encuadre y focal varían sin saltos.
// Cada nudo indica además:
//   sx, sy  dónde debe caer el sujeto en pantalla (NDC; sx > 0 → a la derecha, deja sitio al texto)
//   syP     altura del sujeto en pantallas verticales, donde el texto ocupa la mitad inferior (0,2 por defecto)
//   fov     focal vertical para 16:9
//   v       velocidad relativa del tramo (bajo = más scroll por metro: pausas y pasos cerca de objetos)
//   hold    scroll extra sin desplazamiento (zonas para hablar)
//   ch/role capítulo y papel: 'in' / 'anchor' / 'out' delimitan la ventana de lectura del capítulo
// El scroll se reparte por esfuerzo visual (metros recorridos + giro de la mirada) dividido por v,
// de modo que la velocidad cambia de forma continua: sin frenadas repetidas entre capítulos.
// ---------------------------------------------------------------------------------------------

export const KEYS = [
  // 0 · Apertura: el conjunto entero; al empezar a bajar, la cámara gira despacio a la izquierda
  { p: V(-14, 80, 104), s: V(-8, 0, -12), sx: 0.12, sy: -0.1, syP: -0.3, fov: 38, v: 0.6, hold: 6, ch: 0, role: 'anchor' },
  { p: V(-21, 75, 97), s: V(-12, 0, -10), sx: 0.1, sy: -0.08, syP: -0.3, fov: 38, v: 0.8, hold: 3, ch: 0, role: 'out' },
  // descenso en espiral hacia el depósito: primero el depósito, después los palés y la batería
  { p: V(-44, 46, 70), s: V(-50, 0, 12), fov: 38, v: 3.2 },
  { p: V(-70, 20, 40), s: V(-58, 1.5, 13), fov: 40, v: 2.0 },
  { p: V(-64.5, 7.2, 29), s: V(-54, 1.6, 19), fov: 42, v: 0.85 },
  // 1 · Recogida: dentro del patio, aproximación a la carcasa y a la etiqueta QR (el taller, al fondo)
  { p: V(-60.5, 3.9, 25.4), s: V(-51.8, 1.6, 21.9), sx: 0.3, fov: 42, v: 0.45, hold: 3, ch: 1, role: 'in' },
  { p: V(-57.6, 3.4, 24.9), s: V(-51.6, 1.5, 22.0), sx: 0.34, fov: 42, v: 0.3, hold: 5, ch: 1, role: 'anchor' },
  { p: V(-55.6, 2.85, 25.3), s: V(-51.04, 1.45, 22.65), sx: 0.5, sy: 0.0, fov: 42, v: 0.45, hold: 3, ch: 1, role: 'out' },
  // planeo bajo hacia el taller: rodea la carcasa por el sur, cruza el agua y entra por el frente abierto
  { p: V(-49.6, 3.8, 27.0), s: V(-43.5, 2.8, 17.5), fov: 43, v: 0.45 },
  { p: V(-42.6, 3.8, 21.5), s: V(-36.5, 3.0, 12.5), fov: 44, v: 0.6 },
  { p: V(-36.8, 3.85, 11.0), s: V(-31.0, 3.0, 3.5), fov: 46, v: 0.55 },
  { p: V(-33.3, 3.0, 5.0), s: V(-31.2, 2.8, 0.6), fov: 47, v: 0.45 },
  // 2 · Identificación: a la altura del banco, junto al lector QR
  { p: V(-29.6, 3.0, 8.9), s: V(-27.6, 2.7, 6.25), sx: 0.28, fov: 46, v: 0.4, hold: 3, ch: 2, role: 'in' },
  { p: V(-28.6, 2.98, 9.4), s: V(-27.1, 2.7, 6.2), sx: 0.3, fov: 46, v: 0.3, hold: 5, ch: 2, role: 'anchor' },
  { p: V(-27.8, 2.98, 9.6), s: V(-26.6, 3.0, 6.3), sx: 0.28, fov: 46, v: 0.4, hold: 3, ch: 2, role: 'out' },
  // salida lateral al laboratorio: estanterías y ficha a la izquierda, el pilar del frente pasa en primer plano
  { p: V(-22.0, 3.6, 11.8), s: V(-17, 3.1, 1.0), fov: 46, v: 0.7 },
  { p: V(-17.0, 3.8, 8.4), s: V(-8.5, 3.2, -1.5), fov: 46, v: 0.8 },
  { p: V(-11.6, 3.75, 5.4), s: V(-6.0, 2.9, -0.8), fov: 46, v: 0.6 },
  // 3 · Diagnóstico: a la altura del banco, desplazamiento lateral (bornes → sondas → pantalla)
  { p: V(-8.0, 3.25, 1.7), s: V(-6.6, 3.03, -1.42), sx: 0.26, sy: 0.02, fov: 42, v: 0.4, hold: 3, ch: 3, role: 'in' },
  { p: V(-6.9, 3.1, 1.5), s: V(-5.95, 2.8, -1.35), sx: 0.3, sy: -0.04, fov: 41, v: 0.3, hold: 5, ch: 3, role: 'anchor' },
  { p: V(-4.7, 3.1, 1.4), s: V(-5.41, 2.6, -1.27), sx: 0.26, fov: 38, v: 0.4, hold: 3, ch: 3, role: 'out' },
  // ascenso que revela las tres rutas: sube junto al laboratorio y se retira hacia el suroeste mirando al cruce
  { p: V(-3.0, 7.0, 7.5), s: V(10, 3.4, -4.5), fov: 46, v: 0.7 },
  { p: V(-5.0, 12.5, 5.5), s: V(17, 3.3, -6.5), fov: 44, v: 1.1, mark: 'sim' },
  { p: V(-8.0, 22.0, 7.0), s: V(20, 3, -5), sy: 0.15, fov: 43, v: 1.3 },
  // 4 · Clasificación: el cruce desde el suroeste (A al fondo, B a la derecha, C hacia la planta)
  { p: V(-9.5, 30.0, 7.5), s: V(22, 2, -4), sx: 0.05, sy: 0.28, syP: 0.5, fov: 44, v: 0.5, hold: 3, ch: 4, role: 'in' },
  { p: V(-10, 36, 8), s: V(23, 2, -4), sx: 0.05, sy: 0.3, syP: 0.5, fov: 44, v: 0.3, hold: 5, ch: 4, role: 'anchor' },
  { p: V(-8, 35, 10), s: V(24, 2, -2), sx: 0.05, sy: 0.3, syP: 0.5, fov: 44, v: 0.5, hold: 3, ch: 4, role: 'out' },
  // descenso siguiendo la ruta C: su salida de la rotonda, el puente y la llegada a la planta
  { p: V(4, 23, 8), s: V(26, 2, 4), fov: 43, v: 0.75 },
  { p: V(14.5, 10.5, 5.0), s: V(27, 2.2, 7.5), fov: 44, v: 0.75 },
  { p: V(21.4, 5.2, 5.0), s: V(30, 2.0, 8.5), fov: 46, v: 0.8 },
  { p: V(25.6, 4.4, 9.4), s: V(35, 2.4, 14.0), fov: 46, v: 0.75 },
  { p: V(30.4, 4.4, 9.4), s: V(41.5, 2.4, 15.8), fov: 47, v: 0.7 },
  { p: V(34.2, 3.9, 14.4), s: V(43.8, 2.4, 18.4), sx: 0.05, fov: 48, v: 0.55 },
  { p: V(37.0, 4.5, 16.0), s: V(45.0, 2.3, 19.4), sx: 0.1, sy: 0.1, fov: 48, v: 0.5 },
  // 5 · Reciclaje: entre la cinta y los contenedores de materiales separados
  { p: V(38.4, 3.6, 21.3), s: V(43.8, 2.1, 22.6), sx: 0.22, sy: 0.1, fov: 48, v: 0.45, hold: 3, ch: 5, role: 'in' },
  { p: V(39.6, 3.6, 21.9), s: V(45.6, 2.0, 24.6), sx: 0.28, sy: 0.04, fov: 48, v: 0.3, hold: 5, ch: 5, role: 'anchor' },
  { p: V(41.8, 3.9, 22.0), s: V(47.4, 2.4, 22.8), sx: 0.26, fov: 48, v: 0.45, hold: 3, ch: 5, role: 'out' },
  // subida por el puente largo, rozando el andamio y siguiendo el tablero hasta la plaza
  { p: V(49.6, 4.8, 21.0), s: V(54.5, 3.0, 16.5), fov: 46, v: 0.5 },
  { p: V(55.0, 4.6, 13.8), s: V(57.6, 4.2, 5.0), fov: 46, v: 0.7 },
  { p: V(57.6, 6.7, 3.6), s: V(59.6, 7.4, -6.5), fov: 44, v: 0.95 },
  { p: V(61.2, 12.6, -8.2), s: V(59.0, 12.0, -21.3), sy: 0.12, fov: 44, v: 0.45, mark: 'conn' },
  // 6 · Trazabilidad: acercamiento al pasaporte con la plaza, las pantallas y la batería en cuadro
  { p: V(68.5, 13.5, -10.7), s: V(59.0, 12.2, -21.3), sx: 0.32, sy: 0.04, fov: 44, v: 0.45, hold: 3, ch: 6, role: 'in' },
  { p: V(67.3, 13.3, -12.7), s: V(58.9, 12.1, -21.3), sx: 0.32, sy: 0.06, fov: 44, v: 0.3, hold: 5, ch: 6, role: 'anchor' },
  { p: V(66.3, 13.7, -13.9), s: V(58.9, 13.0, -21.3), sx: 0.3, sy: -0.02, fov: 44, v: 0.45, hold: 3, ch: 6, role: 'out' },
  // retirada amplia: las conexiones aparecen sobre todo el mundo
  { p: V(69.5, 17.0, -8.5), s: V(52, 8, -14), fov: 42, v: 1.2 },
  { p: V(72, 34, 18), s: V(36, 3, -10), fov: 40, v: 2.6 },
  // 7 · Cierre: el centro y su emisor en cuadro, con las conexiones hacia todas las estaciones
  { p: V(54, 70, 70), s: V(6, 0, -4), sx: 0, sy: 0.4, syP: 0.55, fov: 42, v: 0.8, hold: 3, ch: 7, role: 'in' },
  { p: V(48.6, 80.3, 75.2), s: V(4, 0, -2), sx: 0, sy: 0.45, syP: 0.6, fov: 42, v: 0.5, hold: 5, ch: 7, role: 'anchor' },
];

const STEPS = 64; // muestras por tramo para repartir el scroll
const ROT_WEIGHT = 12; // 1 rad de giro de mirada ≈ 12 m de recorrido: limita la velocidad angular
const FOV_WEIGHT = 0.08; // por grado
export const UNITS_PER_SCREEN = 24; // unidades de scroll por pantalla

// Pantallas de scroll de cada ventana de lectura y de cada transición (de la ventana i a la i + 1).
// Dentro de cada tramo el reparte sigue el esfuerzo visual; entre tramos la escala se suaviza.
const WINDOW_SCREENS = [1.0, 1.1, 1.1, 1.5, 1.1, 1.1, 1.1, 1.2];
const TRANSIT_SCREENS = [2.8, 3.0, 2.2, 2.8, 3.4, 3.0, 2.6];

// Dirección de mirada compuesta: el sujeto cae en (sx, sy) de la pantalla, horizonte siempre nivelado.
function composeDir(pos, subject, sx, sy, vfov, aspect, out) {
  const hf = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const dx = subject.x - pos.x;
  const dy = subject.y - pos.y;
  const dz = subject.z - pos.z;
  const dist = Math.hypot(dx, dy, dz);
  const yaw = Math.atan2(dx, dz) + Math.atan(Math.tan(hf / 2) * sx);
  let pitch = Math.asin(Math.max(-1, Math.min(1, dy / dist))) - Math.atan(Math.tan(vfov / 2) * sy);
  pitch = Math.max(-1.35, Math.min(1.2, pitch));
  out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  return dist;
}

// Interpolación cúbica monótona (sin rebotes) para valores escalares por nudo.
function pchip(values) {
  const n = values.length;
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) d[i] = values[i + 1] - values[i];
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (k) => {
    const i = Math.min(Math.max(Math.floor(k), 0), n - 2);
    const t = Math.min(Math.max(k - i, 0), 1);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * values[i] + (t3 - 2 * t2 + t) * m[i] + (-2 * t3 + 3 * t2) * values[i + 1] + (t3 - t2) * m[i + 1];
  };
}

export function buildTimeline() {
  const n = KEYS.length;
  const pos = new THREE.CatmullRomCurve3(KEYS.map((k) => k.p), false, 'centripetal');
  const subj = new THREE.CatmullRomCurve3(KEYS.map((k) => k.s), false, 'centripetal');
  const f = {
    sx: pchip(KEYS.map((k) => k.sx ?? 0)),
    sy: pchip(KEYS.map((k) => k.sy ?? 0)),
    syP: pchip(KEYS.map((k) => k.syP ?? 0.2)),
    fov: pchip(KEYS.map((k) => k.fov ?? 40)),
    v: pchip(KEYS.map((k) => k.v ?? 1)),
    hold: pchip(KEYS.map((k) => k.hold ?? 0)),
  };
  const total = (n - 1) * STEPS;
  // densidad de scroll por muestra: movimiento (esfuerzo visual / velocidad) y pausa (hold), por separado
  const eff = new Float64Array(total + 1);
  const hld = new Float64Array(total + 1);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const d = new THREE.Vector3();
  const deg = THREE.MathUtils.degToRad;
  const prevP = pos.getPoint(0);
  const prevD = new THREE.Vector3();
  composeDir(prevP, subj.getPoint(0), f.sx(0), f.sy(0), deg(f.fov(0)), 16 / 9, prevD);
  let prevF = f.fov(0);
  for (let i = 1; i <= total; i++) {
    const k = i / STEPS;
    const p = pos.getPoint(k / (n - 1), a);
    const fov = f.fov(k);
    // el giro se mide con la mirada ya compuesta (incluye los cambios de encuadre)
    composeDir(p, subj.getPoint(k / (n - 1), b), f.sx(k), f.sy(k), deg(fov), 16 / 9, d);
    const effort = p.distanceTo(prevP) + ROT_WEIGHT * Math.acos(Math.min(1, Math.max(-1, d.dot(prevD)))) + FOV_WEIGHT * Math.abs(fov - prevF);
    const km = k - 0.5 / STEPS;
    eff[i] = effort / Math.max(0.05, f.v(km)) + 1e-5;
    hld[i] = Math.max(0, f.hold(km)) / STEPS;
    prevP.copy(p);
    prevD.copy(d);
    prevF = fov;
  }
  // tramos alternos: ventana de lectura (w) y transición (t)
  const keyOf = (ch, role) => KEYS.findIndex((key) => key.ch === ch && key.role === role);
  const kIn = (c) => (keyOf(c, 'in') >= 0 ? keyOf(c, 'in') : keyOf(c, 'anchor'));
  const kOut = (c) => (keyOf(c, 'out') >= 0 ? keyOf(c, 'out') : keyOf(c, 'anchor'));
  const bounds = [];
  for (let c = 0; c < WINDOW_SCREENS.length; c++) {
    bounds.push({ type: 'w', from: kIn(c) * STEPS, to: kOut(c) * STEPS, target: WINDOW_SCREENS[c] * UNITS_PER_SCREEN });
    if (c < TRANSIT_SCREENS.length) bounds.push({ type: 't', from: kOut(c) * STEPS, to: kIn(c + 1) * STEPS, target: TRANSIT_SCREENS[c] * UNITS_PER_SCREEN });
  }
  const regionOf = new Int32Array(total + 1);
  bounds.forEach((r, ri) => {
    for (let i = r.from + 1; i <= r.to; i++) regionOf[i] = ri;
  });
  // La escala del movimiento varía de forma continua (media móvil de ±0,6 nudos) y es la misma
  // dentro de una ventana que en sus transiciones vecinas: salir de una pausa no acelera la cámara.
  // Cada ventana cumple su duración solo con su pausa.
  const effScale = new Float64Array(bounds.length).fill(1);
  const holdScale = new Float64Array(bounds.length).fill(1);
  const radius = Math.round(STEPS * 0.6);
  const smooth = (field) => {
    const out = new Float64Array(total + 1);
    let acc = 0;
    let cnt = 0;
    for (let i = 1; i <= Math.min(total, radius); i++) {
      acc += field[i];
      cnt++;
    }
    for (let i = 1; i <= total; i++) {
      if (i + radius <= total) {
        acc += field[i + radius];
        cnt++;
      }
      if (i - radius - 1 >= 1) {
        acc -= field[i - radius - 1];
        cnt--;
      }
      out[i] = acc / cnt;
    }
    return out;
  };
  let effField = new Float64Array(total + 1).fill(1);
  let holdField = new Float64Array(total + 1).fill(1);
  for (let iter = 0; iter < 8; iter++) {
    // las ventanas heredan la escala media de las transiciones que las rodean
    bounds.forEach((r, ri) => {
      if (r.type === 'w') {
        const nb = [bounds[ri - 1], bounds[ri + 1]].filter(Boolean).map((x) => effScale[bounds.indexOf(x)]);
        effScale[ri] = nb.reduce((s2, v) => s2 + v, 0) / nb.length;
      }
    });
    const raw = new Float64Array(total + 1);
    for (let i = 1; i <= total; i++) raw[i] = effScale[regionOf[i]];
    effField = smooth(raw);
    const rawH = new Float64Array(total + 1);
    for (let i = 1; i <= total; i++) rawH[i] = holdScale[regionOf[i]];
    holdField = smooth(rawH);
    const sumE = new Float64Array(bounds.length);
    const sumH = new Float64Array(bounds.length);
    for (let i = 1; i <= total; i++) {
      sumE[regionOf[i]] += eff[i] * effField[i];
      sumH[regionOf[i]] += hld[i] * holdField[i];
    }
    bounds.forEach((r, ri) => {
      if (r.type === 't') effScale[ri] *= Math.max(0.05, r.target - sumH[ri]) / Math.max(sumE[ri], 1e-6);
      else if (sumH[ri] > 1e-6) holdScale[ri] *= Math.max(0.15 * sumH[ri], r.target - sumE[ri]) / sumH[ri];
    });
  }
  const scaled = new Float64Array(total + 1);
  for (let i = 1; i <= total; i++) scaled[i] = eff[i] * effField[i] + hld[i] * holdField[i];
  const S = new Float64Array(total + 1);
  for (let i = 1; i <= total; i++) S[i] = S[i - 1] + scaled[i];
  const length = S[total];
  const pOfK = (k) => {
    const x = Math.min(Math.max(k * STEPS, 0), total);
    const i = Math.min(Math.floor(x), total - 1);
    return (S[i] + (S[i + 1] - S[i]) * (x - i)) / length;
  };

  // Ventanas de lectura y anclas por capítulo
  const chapters = [];
  KEYS.forEach((key, i) => {
    if (key.ch === undefined) return;
    const c = (chapters[key.ch] ||= { index: key.ch });
    c[key.role] = pOfK(i);
    if (key.role === 'anchor') c.k = i;
  });
  chapters.forEach((c) => {
    c.in ??= c.anchor;
    c.out ??= c.anchor;
  });
  const marks = {};
  KEYS.forEach((key, i) => {
    if (key.mark) marks[key.mark] = pOfK(i);
  });

  return {
    n,
    pos,
    subj,
    f,
    S,
    length,
    screens: length / UNITS_PER_SCREEN,
    chapters,
    anchors: chapters.map((c) => c.anchor),
    marks,
    pOfK,
  };
}

// Progreso global p → parámetro de nudo k (búsqueda binaria en la tabla acumulada).
export function kOfP(tl, p) {
  const target = Math.min(Math.max(p, 0), 1) * tl.length;
  const S = tl.S;
  let lo = 0;
  let hi = S.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (S[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = S[hi] - S[lo] || 1;
  return (lo + (target - S[lo]) / span) / STEPS;
}

// Encuadre: gira la mirada para que el sujeto caiga en (sx, sy) de la pantalla sin inclinar el horizonte.
const _d = new THREE.Vector3();
export function sample(tl, p, aspect, outPos, outTarget) {
  const k = kOfP(tl, p);
  const t = k / (tl.n - 1);
  tl.pos.getPoint(t, outPos);
  const subject = tl.subj.getPoint(t, outTarget);
  const fov169 = tl.f.fov(k);
  // en pantallas más estrechas que 16:9 se abre la focal para conservar el campo horizontal
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov169) / 2) * (16 / 9));
  let vfov = 2 * Math.atan(Math.tan(hfov / 2) / Math.max(aspect, 0.3));
  vfov = Math.min(Math.max(vfov, THREE.MathUtils.degToRad(fov169)), THREE.MathUtils.degToRad(72));
  // composición: en vertical el texto ocupa la parte baja, así que el sujeto sube y se centra
  const wide = THREE.MathUtils.smoothstep(aspect, 1.0, 1.45);
  const sx = tl.f.sx(k) * wide;
  const sy = tl.f.sy(k) * wide + (1 - wide) * tl.f.syP(k);
  const dist = composeDir(outPos, subject, sx, sy, vfov, aspect, _d);
  outTarget.copy(outPos).addScaledVector(_d, dist);
  return { k, fov: THREE.MathUtils.radToDeg(vfov) };
}

// Capítulo activo, visibilidad del texto y avance local dentro de su ventana de lectura.
export function chapterState(tl, p) {
  const ch = tl.chapters;
  let index = 0;
  let best = Infinity;
  ch.forEach((c, i) => {
    const d = p < c.in ? c.in - p : p > c.out ? p - c.out : 0;
    if (d < best) {
      best = d;
      index = i;
    }
  });
  const c = ch[index];
  let fade;
  if (p < c.in) fade = index > 0 ? (c.in - ch[index - 1].out) * 0.42 : 1;
  else fade = index < ch.length - 1 ? (ch[index + 1].in - c.out) * 0.42 : 1;
  const x = best === 0 ? 1 : Math.max(0, 1 - best / Math.max(fade, 1e-4));
  const vis = x * x * (3 - 2 * x);
  const local = (p - c.in) / Math.max(c.out - c.in, 1e-6);
  return { index, vis, local };
}
