import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TRACES } from '../layout.js';

// 2 · Taller abierto en sección (context/ref-taller.png).
// Elevador con coche y vano motor, banco con la batería y el lector QR, puesto de diagnóstico con monitor,
// panel perforado con herramientas ordenadas, cajoneras móviles, estanterías de baterías, neumáticos con
// llanta y una ficha digital proyectada que se completa con cada lectura del QR.

const FONT = '"Archivo Variable", "Archivo", system-ui, sans-serif';
const LIME = '#C2F230';
const IVORY = '#F1EEE6';
const F_LABEL = `600 22px ${FONT}`;
const F_ID = `800 54px ${FONT}`;
const F_KEY = `500 22px ${FONT}`;
const F_VAL = `600 30px ${FONT}`;
const F_STATE = `600 22px ${FONT}`;
const F_TITLE = `600 19px ${FONT}`;
const F_SMALL = `500 14px ${FONT}`;

// ---------- piezas reutilizables ----------

// Caja biselada ligera (un segmento de bisel) para piezas pequeñas y repetidas.
function sbox(K, w, h, d, mat, x = 0, y = 0, z = 0, r = Math.min(w, h, d) * 0.25) {
  const m = new THREE.Mesh(K.geo(`ws|${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 1, r)), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

// Cilindro tumbado a lo largo de x o de z.
function hcyl(K, r, len, mat, axis, x, y, z, seg = 12) {
  const c = K.cyl(r, r, len, mat, seg);
  if (axis === 'x') c.rotation.z = Math.PI / 2;
  else c.rotation.x = Math.PI / 2;
  c.position.set(x, y, z);
  return c;
}

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Cinta plana sobre el suelo a lo largo de una curva (líneas guía pintadas).
function ribbon(points, width, y) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const n = Math.max(6, Math.round(curve.getLength() * 5));
  const pos = new Float32Array((n + 1) * 6);
  const idx = [];
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, p);
    curve.getTangentAt(i / n, tan);
    const l = Math.hypot(tan.x, tan.z) || 1;
    const nx = (-tan.z / l) * width * 0.5;
    const nz = (tan.x / l) * width * 0.5;
    pos.set([p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz], i * 6);
    if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Cajonera móvil: cuerpo grafito, frentes satinados con tirador de acero a todo lo ancho y ruedas giratorias.
// `drawers` lista las alturas relativas de arriba abajo.
function rollCab(ctx, { w = 1.2, h = 1.0, d = 0.6, drawers = [1, 1, 1.4, 1.4, 2], top = 'steel', wheels = true, side = true } = {}) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  const y0 = wheels ? 0.13 : 0;
  g.add(K.rbox(w, h - y0, d, M.graphite, 0, y0, 0, 0.02));
  const unit = (h - y0 - 0.05) / drawers.reduce((a, b) => a + b, 0);
  let y = y0 + 0.025;
  for (let i = drawers.length - 1; i >= 0; i--) {
    const dh = drawers[i] * unit;
    g.add(sbox(K, w - 0.06, dh - 0.016, 0.02, M.panel, 0, y + 0.008, d / 2 + 0.006, 0.005));
    g.add(K.box(w - 0.2, 0.018, 0.024, M.steel, 0, y + dh - 0.052, d / 2 + 0.026));
    y += dh;
  }
  if (top) g.add(K.box(w + 0.02, 0.03, d + 0.02, top === 'stone' ? M.stoneTop : M.steel, 0, h, 0));
  if (wheels) {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const x = sx * (w / 2 - 0.07);
      const z = sz * (d / 2 - 0.07);
      g.add(K.box(0.06, 0.04, 0.06, M.darkSteel, x, 0.088, z));
      g.add(hcyl(K, 0.042, 0.03, M.rubber, 'x', x, 0.043, z + 0.012, 12));
    });
  }
  if (side) {
    g.add(hcyl(K, 0.014, d * 0.72, M.steel, 'z', w / 2 + 0.05, h - 0.13, 0, 8));
    [-1, 1].forEach((s) => g.add(K.box(0.05, 0.02, 0.02, M.steel, w / 2 + 0.025, h - 0.14, s * d * 0.34)));
  }
  return g;
}

// Neumático de perfil real (eje y), compartido por las ruedas sueltas y las del coche.
function tyreGeo(K) {
  return K.geo('wsTyre', () => {
    const profile = [
      [0.236, -0.104], [0.27, -0.118], [0.33, -0.117], [0.352, -0.104], [0.362, -0.075], [0.364, -0.036],
      [0.357, -0.03], [0.357, -0.012], [0.364, -0.006], [0.364, 0.006], [0.357, 0.012], [0.357, 0.03],
      [0.364, 0.036], [0.362, 0.075], [0.352, 0.104], [0.33, 0.117], [0.27, 0.118], [0.236, 0.104],
    ];
    return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  });
}

// Invierte caras y normales (superficies que se ven por dentro, como los pasos de rueda).
function flipFaces(geo) {
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = a;
  }
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return geo;
}

// Rueda completa tumbada (eje y): neumático de perfil real y llanta de aleación de cinco radios.
function wheel(ctx, face = true) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tyreGeo(K), M.rubber));
  g.add(new THREE.Mesh(K.geo('wsRimBarrel', () => new THREE.CylinderGeometry(0.237, 0.237, 0.2, 28, 1, true)), M.darkSteel));
  if (face) {
    const dish = K.cyl(0.222, 0.222, 0.02, M.darkSteel, 28);
    dish.position.y = 0.055;
    g.add(dish);
    for (let k = 0; k < 5; k++) {
      const arm = new THREE.Group();
      arm.rotation.y = (k / 5) * Math.PI * 2;
      arm.add(K.box(0.05, 0.024, 0.17, M.steel, 0, 0.064, 0.13));
      g.add(arm);
    }
    const hub = K.cyl(0.06, 0.06, 0.035, M.steel, 16);
    hub.position.y = 0.075;
    g.add(hub);
    const lip = new THREE.Mesh(K.geo('wsRimLip', () => new THREE.TorusGeometry(0.232, 0.012, 6, 32)), M.steel);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.094;
    g.add(lip);
  }
  return g;
}

// Estantería de largueros (largo en x, fondo en z, frente hacia +z).
function rack(ctx, { bays = 1, bayLen = 1.8, depth = 0.55, levels = [0.1, 0.72, 1.34, 1.96], height = 2.5 } = {}) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  const len = bays * bayLen;
  for (let b = 0; b <= bays; b++) {
    const x = -len / 2 + b * bayLen;
    [-1, 1].forEach((s) => g.add(K.box(0.06, height, 0.05, M.darkSteel, x, 0, s * (depth / 2 - 0.025))));
    for (let k = 0; k < 3; k++) g.add(K.box(0.02, 0.02, depth - 0.06, M.darkSteel, x, 0.35 + k * 0.8, 0));
    g.add(K.box(0.12, 0.012, 0.12, M.darkSteel, x, 0, depth / 2 - 0.03));
  }
  levels.forEach((ly) => {
    [-1, 1].forEach((s) => g.add(K.box(len, 0.07, 0.04, M.graphite, 0, ly, s * (depth / 2 - 0.02))));
    g.add(K.box(len - 0.04, 0.012, depth - 0.06, M.steel, 0, ly + 0.058, 0));
    // etiquetas de carga ámbar en el larguero frontal
    for (let b = 0; b < bays; b++) g.add(K.box(0.1, 0.035, 0.005, M.amberMatte, -len / 2 + (b + 0.5) * bayLen, ly + 0.017, depth / 2 + 0.001));
  });
  return g;
}

function officeChair(ctx) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 5) * Math.PI * 2;
    arm.add(K.box(0.045, 0.035, 0.3, M.graphite, 0, 0.055, 0.15));
    arm.add(hcyl(K, 0.028, 0.028, M.rubber, 'x', 0, 0.028, 0.29, 10));
    g.add(arm);
  }
  const col = K.cyl(0.024, 0.03, 0.36, M.steel, 12);
  col.position.y = 0.27;
  g.add(col);
  g.add(sbox(K, 0.48, 0.08, 0.46, M.graphite, 0, 0.44, 0, 0.03));
  g.add(K.box(0.05, 0.24, 0.03, M.darkSteel, 0, 0.46, -0.24));
  const back = new THREE.Group();
  back.add(sbox(K, 0.44, 0.5, 0.06, M.graphite, 0, 0, 0, 0.025));
  back.position.set(0, 0.62, -0.24);
  back.rotation.x = -0.12;
  g.add(back);
  [-1, 1].forEach((s) => {
    g.add(K.box(0.03, 0.18, 0.03, M.darkSteel, s * 0.25, 0.5, 0.02));
    g.add(sbox(K, 0.06, 0.03, 0.26, M.graphite, s * 0.25, 0.68, 0.02, 0.01));
  });
  return g;
}

// Gato de carro (frente hacia +x) y camilla de taller con ruedas (larga en z).
function floorJack(ctx) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  g.add(sbox(K, 0.74, 0.13, 0.3, M.amberMatte, 0, 0.05, 0, 0.03));
  g.add(K.box(0.48, 0.045, 0.2, M.darkSteel, 0.06, 0.175, 0));
  const saddle = K.cyl(0.075, 0.07, 0.045, M.darkSteel, 16);
  saddle.position.set(0.31, 0.24, 0);
  g.add(saddle);
  [-0.17, 0.17].forEach((z) => g.add(hcyl(K, 0.05, 0.04, M.darkSteel, 'z', 0.29, 0.05, z, 12)));
  [-0.12, 0.12].forEach((z) => g.add(hcyl(K, 0.04, 0.03, M.rubber, 'z', -0.33, 0.04, z, 10)));
  const lever = K.cyl(0.018, 0.018, 1.0, M.darkSteel, 8);
  lever.position.set(-0.76, 0.47, 0);
  lever.rotation.z = 0.959;
  g.add(lever);
  const grip = K.cyl(0.026, 0.026, 0.16, M.rubber, 10);
  grip.position.set(-1.12, 0.72, 0);
  grip.rotation.z = 0.959;
  g.add(grip);
  return g;
}

function creeper(ctx) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  g.add(sbox(K, 0.46, 0.035, 1.0, M.graphite, 0, 0.075, 0, 0.012));
  g.add(sbox(K, 0.3, 0.05, 0.22, M.rubber, 0, 0.105, -0.36, 0.02));
  [-1, 1].forEach((s) => g.add(K.box(0.03, 0.03, 0.96, M.darkSteel, s * 0.21, 0.06, 0)));
  [[-0.18, -0.42], [0.18, -0.42], [-0.18, 0], [0.18, 0], [-0.18, 0.42], [0.18, 0.42]].forEach(([x, z]) => {
    g.add(K.box(0.04, 0.03, 0.04, M.darkSteel, x, 0.05, z));
    g.add(hcyl(K, 0.026, 0.02, M.rubber, 'x', x, 0.026, z + 0.012, 10));
  });
  return g;
}

// Panel perforado con herramientas ordenadas por familias (origen: centro del borde inferior, frente en z = 0.025).
function toolWall(ctx, pegMat, w = 3.6, h = 1.5) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  const z = 0.025;
  g.add(K.box(w + 0.08, h + 0.08, 0.03, M.darkSteel, 0, -0.04, -0.012));
  g.add(K.box(w, h, 0.02, pegMat, 0, 0, 0.012));
  // llaves combinadas graduadas
  g.add(K.box(0.78, 0.025, 0.03, M.darkSteel, -1.25, 1.33, z + 0.01));
  for (let i = 0; i < 11; i++) {
    const L = 0.14 + i * 0.02;
    const x = -1.58 + i * 0.066;
    const r = 0.018 + i * 0.0013;
    g.add(K.box(0.016 + i * 0.001, L - 0.05, 0.005, M.steel, x, 1.31 - L + 0.025, z + 0.012));
    g.add(hcyl(K, r, 0.007, M.steel, 'z', x, 1.3, z + 0.012, 12));
    g.add(hcyl(K, r * 0.9, 0.007, M.steel, 'z', x, 1.32 - L, z + 0.012, 12));
  }
  // destornilladores con mango lima y ámbar en su soporte
  g.add(K.box(0.7, 0.03, 0.07, M.darkSteel, -0.43, 1.1, z + 0.035));
  for (let i = 0; i < 8; i++) {
    const x = -0.71 + i * 0.08;
    const mat = i % 3 === 0 ? M.limeInsert : i % 3 === 1 ? M.amberMatte : M.graphite;
    const hnd = K.cyl(0.016, 0.014, 0.1, mat, 10);
    hnd.position.set(x, 1.18, z + 0.04);
    g.add(hnd);
    const L = 0.1 + (i % 4) * 0.03;
    const sh = K.cyl(0.0035, 0.0035, L, M.steel, 6);
    sh.position.set(x, 1.1 - L / 2, z + 0.04);
    g.add(sh);
  }
  // alicates colgados
  for (let i = 0; i < 4; i++) {
    const x = 0.06 + i * 0.13;
    const mat = i % 2 ? M.amberMatte : M.limeInsert;
    g.add(K.box(0.03, 0.02, 0.02, M.steel, x, 1.36, z + 0.012));
    g.add(K.box(0.034, 0.07, 0.01, M.steel, x, 1.28, z + 0.012));
    [-1, 1].forEach((s) => {
      const hnd = K.box(0.016, 0.17, 0.012, mat, 0, -0.17, 0);
      const pivot = new THREE.Group();
      pivot.position.set(x + s * 0.008, 1.29, z + 0.014);
      pivot.rotation.z = s * 0.13;
      pivot.add(hnd);
      g.add(pivot);
    });
  }
  // martillo y maza
  g.add(K.box(0.03, 0.3, 0.025, M.graphite, 0.68, 1.02, z + 0.02));
  g.add(K.box(0.12, 0.036, 0.036, M.steel, 0.68, 1.31, z + 0.022));
  g.add(K.box(0.03, 0.28, 0.025, M.wood, 0.86, 1.04, z + 0.02));
  g.add(hcyl(K, 0.035, 0.12, M.rubber, 'x', 0.86, 1.34, z + 0.03, 12));
  // rollos de cable y latiguillos de prueba
  [[1.2, 1.12, 0.13, M.rubber], [1.5, 1.14, 0.1, M.amberMatte], [1.38, 0.72, 0.08, M.limeInsert]].forEach(([x, y, r, mat]) => {
    g.add(K.box(0.02, 0.06, 0.05, M.steel, x, y + r - 0.02, z + 0.02));
    const coil = new THREE.Mesh(K.geo(`wsCoil${r}`, () => new THREE.TorusGeometry(r, 0.018, 6, 28)), mat);
    coil.position.set(x, y, z + 0.035);
    g.add(coil);
  });
  // fila baja: carril de vasos graduados, carracas, llave dinamométrica y nivel
  g.add(K.box(0.92, 0.02, 0.03, M.darkSteel, -1.18, 0.44, z + 0.012));
  for (let i = 0; i < 12; i++) {
    const r = 0.012 + i * 0.0016;
    g.add(hcyl(K, r, 0.04 + i * 0.002, M.steel, 'z', -1.6 + i * 0.077, 0.48 + r, z + 0.03, 12));
  }
  [-0.5, -0.38].forEach((x, i) => {
    g.add(K.box(0.02, 0.2 + i * 0.04, 0.012, M.steel, x, 0.36, z + 0.015));
    g.add(hcyl(K, 0.026, 0.02, M.steel, 'z', x, 0.6 + i * 0.04, z + 0.02, 12));
    g.add(K.box(0.026, 0.09, 0.016, M.graphite, x, 0.36, z + 0.02));
  });
  g.add(K.box(0.024, 0.5, 0.014, M.steel, 0.42, 0.3, z + 0.015));
  g.add(K.box(0.03, 0.14, 0.02, M.graphite, 0.42, 0.3, z + 0.02));
  g.add(K.box(0.6, 0.05, 0.03, M.amberMatte, 1.05, 0.3, z + 0.02));
  g.add(K.box(0.06, 0.02, 0.032, M.limeInsert, 1.05, 0.315, z + 0.022));
  // llaves Allen en abanico, sargentos, flexómetro, sierra de arco y limas
  for (let i = 0; i < 8; i++) {
    const key = new THREE.Group();
    key.position.set(-1.5 + i * 0.05, 0.7, z + 0.014);
    key.rotation.z = -0.25 + i * 0.07;
    key.add(K.box(0.008, 0.1 + i * 0.016, 0.008, M.darkSteel, 0, 0, 0));
    key.add(K.box(0.035, 0.008, 0.008, M.darkSteel, 0.014, 0.1 + i * 0.016, 0));
    g.add(key);
  }
  g.add(K.box(0.42, 0.03, 0.03, M.graphite, -1.33, 0.66, z + 0.015));
  [-0.26, -0.08].forEach((x) => {
    g.add(K.box(0.018, 0.36, 0.01, M.steel, x, 0.64, z + 0.015));
    g.add(K.box(0.09, 0.03, 0.03, M.amberMatte, x + 0.04, 0.96, z + 0.02));
    g.add(K.box(0.09, 0.03, 0.03, M.amberMatte, x + 0.04, 0.72, z + 0.02));
    g.add(K.box(0.012, 0.13, 0.012, M.steel, x + 0.07, 0.58, z + 0.02));
    g.add(K.box(0.03, 0.06, 0.03, M.graphite, x + 0.07, 0.53, z + 0.02));
  });
  g.add(sbox(K, 0.085, 0.085, 0.045, M.amberMatte, 0.2, 0.8, z + 0.03, 0.015));
  g.add(K.box(0.4, 0.012, 0.01, M.darkSteel, 1.02, 0.74, z + 0.015));
  g.add(K.box(0.012, 0.16, 0.01, M.darkSteel, 0.82, 0.58, z + 0.015));
  g.add(K.box(0.012, 0.16, 0.01, M.darkSteel, 1.22, 0.58, z + 0.015));
  g.add(K.box(0.4, 0.014, 0.004, M.steel, 1.02, 0.6, z + 0.015));
  g.add(sbox(K, 0.1, 0.07, 0.03, M.limeInsert, 1.3, 0.58, z + 0.02, 0.01));
  [1.44, 1.51, 1.58].forEach((x, i) => {
    g.add(K.box(0.018, 0.22 + i * 0.03, 0.006, M.darkSteel, x, 0.56 - i * 0.03, z + 0.012));
    g.add(K.box(0.026, 0.1, 0.022, M.graphite, x, 0.78, z + 0.016));
  });
  // estante superior con cajas, botes y tira de luz que baña el panel
  g.add(K.box(w + 0.2, 0.03, 0.3, M.darkSteel, 0, h + 0.1, 0.15));
  [-1.6, 0, 1.6].forEach((x) => g.add(K.box(0.03, 0.12, 0.26, M.darkSteel, x, h - 0.02, 0.13)));
  g.add(K.box(w - 0.1, 0.014, 0.03, M.warmGlow, 0, h + 0.085, 0.27));
  [[-1.45, 0.34], [-1.05, 0.34], [0.95, 0.28], [1.35, 0.28]].forEach(([x, bw]) => g.add(sbox(K, bw, 0.18, 0.24, M.graphite, x, h + 0.13, 0.14, 0.015)));
  [[-0.5, M.amberMatte], [-0.42, M.amberMatte], [-0.3, M.ivoryPanel], [-0.22, M.ivoryPanel], [-0.1, M.graphiteLight]].forEach(([x, mat]) => {
    const can = K.cyl(0.033, 0.033, 0.21, mat, 12);
    can.position.set(x, h + 0.235, 0.12);
    g.add(can);
  });
  return g;
}

// Lector de mano en su base de carga (frente +z). Devuelve el grupo, la pistola y la ventana en coords de la pistola.
function scannerModel(ctx) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  g.add(sbox(K, 0.24, 0.05, 0.3, M.graphite, 0, 0, 0, 0.02));
  g.add(K.box(0.2, 0.01, 0.012, M.limeInsert, 0, 0.026, 0.151));
  // cuna: copa inclinada donde entra la empuñadura
  g.add(sbox(K, 0.15, 0.1, 0.14, M.graphite, 0, 0.04, -0.07, 0.035));
  const gun = new THREE.Group();
  gun.position.set(0, 0.075, -0.06);
  // perfil lateral (x del perfil = adelante, y = arriba): empuñadura inclinada 15° y cabezal que se estrecha atrás
  const prof = new THREE.Shape();
  prof.moveTo(-0.075, 0.0);
  prof.lineTo(-0.02, 0.0);
  prof.lineTo(0.02, 0.15);
  prof.lineTo(0.16, 0.155);
  prof.quadraticCurveTo(0.19, 0.158, 0.19, 0.185);
  prof.lineTo(0.186, 0.23);
  prof.quadraticCurveTo(0.182, 0.255, 0.15, 0.255);
  prof.lineTo(-0.04, 0.235);
  prof.quadraticCurveTo(-0.085, 0.232, -0.085, 0.2);
  prof.lineTo(-0.045, 0.15);
  prof.lineTo(-0.075, 0.0);
  const ext = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 }).rotateY(-Math.PI / 2).translate(depth / 2, 0, 0);
  gun.add(new THREE.Mesh(K.geo('scanGun', () => ext(prof, 0.07)), M.graphite));
  // capuchón lima en la mitad delantera del lomo del cabezal
  const cap = new THREE.Shape();
  cap.moveTo(0.04, 0.2234);
  cap.lineTo(0.04, 0.2464);
  cap.lineTo(0.15, 0.258);
  cap.quadraticCurveTo(0.178, 0.258, 0.183, 0.232);
  cap.lineTo(0.183, 0.215);
  cap.lineTo(0.04, 0.2234);
  gun.add(new THREE.Mesh(K.geo('scanCap', () => ext(cap, 0.074)), M.limeInsert));
  // inserto lima en el canto delantero de la empuñadura (gatillo)
  const trig = sbox(K, 0.05, 0.11, 0.014, M.limeInsert, 0, 0, 0, 0.006);
  trig.position.set(0, 0.075, 0.006);
  trig.rotation.x = 0.26;
  gun.add(trig);
  // ventana ámbar en la nariz
  gun.add(K.box(0.06, 0.035, 0.006, M.amberGlow, 0, 0.1875, 0.2));
  g.add(gun);
  return { group: g, gun, window: new THREE.Vector3(0, 0.205, 0.204) };
}

// Rueda del coche (eje y, cara exterior hacia +y): llanta abierta de cinco radios dobles con el disco de
// freno y la pinza a la vista. `s` es el lado (+1 derecha, -1 izquierda) para dejar la pinza arriba y detrás.
function carWheel(ctx, s) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  // neumático de perfil bajo: el mismo perfil comprimido hacia la llanta (llanta grande de todocamino)
  const tyre = K.geo('wsTyreLow', () => {
    const src = tyreGeo(K).parameters.points;
    return new THREE.LatheGeometry(src.map((v) => new THREE.Vector2(0.27 + (v.x - 0.236) * 0.734, v.y)), 32);
  });
  g.add(new THREE.Mesh(tyre, M.rubber));
  g.add(new THREE.Mesh(K.geo('wsRimBarrelL', () => new THREE.CylinderGeometry(0.271, 0.271, 0.2, 30, 1, true)), M.darkSteel));
  const back = K.cyl(0.27, 0.27, 0.012, M.darkSteel, 30);
  back.position.y = -0.07;
  g.add(back);
  // disco de freno oscuro y pinza: los radios mecanizados destacan sobre fondo oscuro
  const disc = K.cyl(0.19, 0.19, 0.024, M.darkSteel, 28);
  disc.position.y = -0.016;
  g.add(disc);
  g.add(K.box(0.11, 0.07, 0.08, M.graphite, -0.12, -0.045, s * -0.125));
  for (let k = 0; k < 5; k++) {
    const arm = new THREE.Group();
    arm.rotation.y = (k / 5) * Math.PI * 2;
    [-1, 1].forEach((d) => {
      const sp = K.box(0.036, 0.03, 0.21, M.steel, d * 0.026, 0.045, 0.14);
      sp.rotation.y = d * 0.09;
      arm.add(sp);
    });
    g.add(arm);
  }
  const hub = K.cyl(0.06, 0.066, 0.045, M.graphite, 18);
  hub.position.y = 0.06;
  g.add(hub);
  const lip = new THREE.Mesh(K.geo('wsRimLipL', () => new THREE.TorusGeometry(0.266, 0.011, 6, 34)), M.steel);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.094;
  g.add(lip);
  return g;
}

// Todocamino eléctrico grafito sobre el elevador (frente hacia +x; y = 0 en el apoyo de las ruedas).
// Anclajes del elevador y del vano: 4,30 × 1,84 m, bajos a 0,42 sobre los tacos, ejes en x = ±1,35 a 0,44 de
// altura y bisagra del capó en (0,95, 1,04). Carrocería extruida del perfil lateral, invernadero de cristal con
// montantes pintados encima, pasos de rueda negros, frontal con barra de luz diurna y bajos con batería plana.
function evCar(ctx, paint) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  // carrocería: el bisel engorda el contorno 5 cm, así que el perfil se dibuja 5 cm por dentro de la silueta
  const body = K.geo('wsCarBody', () => {
    const s = new THREE.Shape();
    s.moveTo(-2.05, 0.38);
    [[-1.95, 0.355], [-1.86, 0.4], [-1.84, 0.44]].forEach(([x, y]) => s.lineTo(x, y));
    s.absarc(-1.35, 0.44, 0.49, Math.PI, 0, true);
    [[-0.8, 0.47], [0.8, 0.47], [0.86, 0.44]].forEach(([x, y]) => s.lineTo(x, y));
    s.absarc(1.35, 0.44, 0.49, Math.PI, 0, true);
    [
      [1.86, 0.4], [1.97, 0.355], [2.06, 0.37], [2.1, 0.45], [2.1, 0.74], [2.08, 0.83], [2.02, 0.895], [1.85, 0.92],
      [1.4, 0.955], [0.98, 0.98], [0.3, 1.0], [-0.6, 1.015], [-1.5, 1.03], [-1.95, 1.03], [-2.06, 0.98], [-2.09, 0.85],
      [-2.1, 0.62], [-2.09, 0.45],
    ].forEach(([x, y]) => s.lineTo(x, y));
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 3, curveSegments: 12 });
    geo.translate(0, 0, -0.85);
    return geo;
  });
  g.add(new THREE.Mesh(body, paint));
  // invernadero: parabrisas a 28°, techo a 1,58 y luneta inclinada; los montantes A/B/C son placas pintadas con
  // los huecos de las ventanillas, un centímetro por fuera del cristal
  const gh = [[0.93, 0.99], [0.95, 1.03], [-0.04, 1.545], [-0.4, 1.57], [-0.95, 1.578], [-1.38, 1.565], [-1.53, 1.535], [-1.96, 1.12], [-1.97, 0.99]];
  const ghShape = () => {
    const s = new THREE.Shape();
    gh.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
  };
  const glass = K.geo('wsCarGlass', () => {
    const geo = new THREE.ExtrudeGeometry(ghShape(), { depth: 1.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 2 });
    geo.translate(0, 0, -0.7);
    return geo;
  });
  g.add(new THREE.Mesh(glass, M.darkGlass));
  const pillars = K.geo('wsCarPillars', () => {
    const s = ghShape();
    [
      [[0.7, 1.1], [-0.1, 1.505], [-0.36, 1.52], [-0.36, 1.1]],
      [[-0.45, 1.1], [-0.45, 1.522], [-1.12, 1.53], [-1.22, 1.1]],
      [[-1.31, 1.1], [-1.21, 1.52], [-1.4, 1.515], [-1.7, 1.22], [-1.72, 1.1]],
    ].forEach((h) => {
      const p = new THREE.Path();
      h.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      p.closePath();
      s.holes.push(p);
    });
    return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false });
  });
  [0.752, -0.764].forEach((z) => {
    const plate = new THREE.Mesh(pillars, paint);
    plate.position.z = z;
    g.add(plate);
  });
  // capó abierto con su aislante interior
  const hood = new THREE.Group();
  hood.add(K.rbox(1.12, 0.035, 1.66, paint, 0.56, 0, 0, 0.015));
  hood.add(K.box(0.92, 0.012, 1.28, M.graphite, 0.5, -0.012, 0));
  hood.position.set(0.95, 1.04, 0);
  hood.rotation.z = 0.75;
  g.add(hood);
  // frontal: barra de luz diurna a todo lo ancho, grupos ópticos finos, calandra ciega y rejilla inferior
  g.add(K.box(0.03, 0.022, 1.58, M.warmGlow, 2.146, 0.79, 0));
  g.add(K.rbox(0.025, 0.1, 0.86, M.graphite, 2.152, 0.62, 0, 0.01));
  g.add(K.rbox(0.03, 0.18, 1.1, M.darkGlass, 2.148, 0.36, 0, 0.012));
  [0.4, 0.445, 0.49].forEach((y) => g.add(K.box(0.034, 0.01, 1.04, M.darkSteel, 2.15, y, 0)));
  // trasera: piloto continuo
  g.add(K.box(0.02, 0.03, 1.5, M.amberGlow, -2.13, 0.9, 0));
  [-1, 1].forEach((sd) => {
    g.add(K.rbox(0.03, 0.075, 0.32, M.darkGlass, 2.148, 0.665, sd * 0.64, 0.01));
    [0.56, 0.71].forEach((z) => g.add(hcyl(K, 0.024, 0.02, M.steel, 'x', 2.163, 0.702, sd * z, 12)));
    g.add(K.box(0.03, 0.15, 0.13, M.graphite, 2.15, 0.35, sd * 0.79));
    // retrovisores
    g.add(K.box(0.07, 0.035, 0.12, M.graphite, 0.64, 1.07, sd * 0.97));
    g.add(K.rbox(0.13, 0.11, 0.2, paint, 0.62, 1.06, sd * 1.06, 0.035));
    g.add(K.box(0.008, 0.075, 0.15, M.darkGlass, 0.553, 1.077, sd * 1.06));
    // juntas de puertas, tiradores enrasados, moldura inferior y aletines negros
    const z = sd * 0.9215;
    g.add(K.box(0.006, 0.5, 0.004, M.panel, 0.84, 0.54, z));
    g.add(K.box(0.006, 0.52, 0.004, M.panel, -0.41, 0.54, z));
    g.add(K.box(0.006, 0.2, 0.004, M.panel, -1.16, 0.87, z));
    [0.3, -0.9].forEach((x) => g.add(K.box(0.2, 0.026, 0.006, M.darkSteel, x, 0.93, z)));
    g.add(K.box(1.66, 0.12, 0.03, M.graphite, 0, 0.42, sd * 0.925));
    [-1.35, 1.35].forEach((x) => {
      const flare = new THREE.Mesh(K.geo('wsArchFlare', () => new THREE.TorusGeometry(0.455, 0.028, 6, 22, Math.PI)), M.graphite);
      flare.position.set(x, 0.44, sd * 0.915);
      g.add(flare);
    });
  });
  // pasos de rueda negros (por dentro) y bajos: carenado, batería de tracción plana, motores, palieres y brazos
  const liner = K.geo('wsArchLiner', () => flipFaces(new THREE.CylinderGeometry(0.43, 0.43, 1.7, 18, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2)));
  g.add(K.box(1.7, 0.06, 1.36, M.darkSteel, 0, 0.355, 0));
  g.add(K.box(1.62, 0.012, 1.5, M.graphite, 0, 0.408, 0));
  [-1.35, 1.35].forEach((x) => {
    const l = new THREE.Mesh(liner, M.rubber);
    l.position.set(x, 0.44, 0);
    g.add(l);
    g.add(K.rbox(0.42, 0.26, 0.56, M.graphite, x - Math.sign(x) * 0.05, 0.3, 0, 0.04));
    g.add(hcyl(K, 0.028, 1.5, M.darkSteel, 'z', x, 0.44, 0, 10));
    [-1, 1].forEach((sd) => {
      g.add(K.box(0.07, 0.04, 0.42, M.darkSteel, x + 0.1, 0.33, sd * 0.55));
      g.add(K.box(0.07, 0.04, 0.42, M.darkSteel, x - 0.12, 0.35, sd * 0.53));
    });
  });
  // ruedas: el neumático real (0,77 m) queda enrasado con los aletines
  [[1.35, 0.83], [1.35, -0.83], [-1.35, 0.83], [-1.35, -0.83]].forEach(([x, z]) => {
    const s = Math.sign(z);
    const w = carWheel(ctx, s);
    w.rotation.x = (s * Math.PI) / 2;
    w.position.set(x, 0.44, z);
    w.scale.setScalar(1.06);
    g.add(w);
  });
  return g;
}

// Tramo interior de la traza principal del mundo: la losa del taller la tapa, así que se repinta a ras del suelo
// con el mismo trazado, la misma sección y la misma coordenada u (longitud / 10) para que el pulso no salte.
// Devuelve null si el trazado no cruza el taller.
function traceOverlay(ctx, { x0, x1, z0, z1, floorY, mat }) {
  const y2 = ctx.F.s2 + 0.012;
  const curve = new THREE.CatmullRomCurve3(TRACES.main, false, 'catmullrom', 0.5);
  const len = curve.getLength();
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const N = Math.round(len * 20);
  const inside = (q) => q.x > x0 && q.x < x1 && q.z > z0 && q.z < z1;
  // tramo continuo bajo el suelo del taller, más un palmo exterior para bajar el canto de la losa
  let a = -1;
  let b = -1;
  for (let i = 0; i <= N; i++) {
    curve.getPointAt(i / N, p);
    if (inside(p)) {
      if (a < 0) a = i;
      b = i;
    } else if (a >= 0) break;
  }
  if (a < 0) return null;
  b = Math.min(N, b + 3);
  const hw = 0.11;
  const rows = [[-hw - 0.03, 0.0], [-hw, 0.018], [hw, 0.018], [hw + 0.03, 0.0]];
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = a, k = 0; i <= b; i++, k++) {
    const u = i / N;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    side.crossVectors(t, up).normalize();
    const y = inside(p) ? floorY : y2;
    rows.forEach(([o, h]) => {
      pos.push(p.x + side.x * o, y + h, p.z + side.z * o);
      uv.push(u * (len / 10), 0.5);
    });
    // caras hacia arriba (la cinta del mundo usa el orden contrario y queda de espaldas a la cámara)
    if (i < b) {
      const r0 = k * 4;
      for (let j = 0; j < 3; j++) idx.push(r0 + j, r0 + j + 1, r0 + j + 4, r0 + j + 1, r0 + j + 5, r0 + j + 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.userData.noCollide = true;
  return m;
}

export function buildWorkshop(ctx) {
  const { K, M, T, V, STATIONS } = ctx;
  const s2 = STATIONS.s2;
  const FY = s2.y + 0.06; // suelo interior (losa del edificio)
  const BZ = s2.z - 7 + 0.175; // cara interior del muro del fondo
  const WX = s2.x - 8 + 0.175; // cara interior del muro oeste
  const EX = s2.x + 8 - 0.175; // cara interior del muro este (bajo, hasta z = 3.6)
  const ROOF = s2.y + 6.5; // cara inferior del techo
  const add = (o, x, y, z, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    ctx.add(o);
    return o;
  };
  const shadow = (x, z, w, d, r = 0) => ctx.shadows.push({ x, y: FY, z, w, d, r });
  const bats = []; // todas las baterías almacenadas: un único juego de instancias

  // ---------- envolvente ----------
  // foco general más bajo y apuntado al suelo entre el elevador y el banco: el muro del fondo deja de ser el
  // plano más claro y la jerarquía pasa a ser encimera > suelo > muro (ref-taller.png)
  const shop = K.makeCutaway(M, { w: 16, d: 12, h: 6.5, light: 11 });
  shop.position.set(s2.x, s2.y, s2.z - 1);
  // muros marfil propios del taller con menos luz de entorno: el relleno uniforme del entorno era lo que
  // igualaba el muro con la encimera; ahora lo gradúan los focos (bañador del panel, foco general, trabajo)
  // (three solo respeta envMapIntensity si el material lleva su propio envMap: se toma el entorno de la escena)
  let sceneRoot = ctx.group;
  while (sceneRoot.parent) sceneRoot = sceneRoot.parent;
  const shopWall = M.ivory.clone();
  if (sceneRoot.environment) {
    shopWall.envMap = sceneRoot.environment;
    shopWall.envMapIntensity = (sceneRoot.environmentIntensity ?? 1) * 0.3;
  }
  shop.traverse((o) => {
    if (o.isSpotLight) {
      o.angle = 0.75;
      o.target.position.set(1.5, 0, 2.5);
    }
    if (o.isMesh && o.material === M.ivory) o.material = shopWall;
  });
  ctx.add(shop);
  ctx.add(K.box(0.35, 3.77, 6.6, shopWall, s2.x + 8, s2.y + 2.73, s2.z - 1 - 2.7));
  for (let z = -6; z <= -0.4; z += 2) ctx.add(K.box(0.02, 3.6, 0.04, M.graphiteLight, s2.x + 8 - 0.185, s2.y + 2.75, s2.z - 1 + z + 2));
  ctx.add(K.box(0.05, 0.03, 6.4, M.warmGlow, s2.x + 8 - 0.2, s2.y + 4.5, s2.z - 1 - 2.7));
  // la tira cálida del muro (makeCutaway) pasa a ser una luminaria: canal grafito con tapa, labio frontal y testeros
  const stripY = s2.y + 4.16;
  ctx.add(K.box(13.92, 0.015, 0.15, M.graphite, s2.x, stripY + 0.06, BZ + 0.075));
  ctx.add(K.box(13.92, 0.045, 0.014, M.graphite, s2.x, stripY + 0.03, BZ + 0.143));
  [-1, 1].forEach((s) => ctx.add(K.box(0.014, 0.075, 0.15, M.graphite, s2.x + s * 6.95, stripY, BZ + 0.075)));

  // estructura vista: dintel con persiana enrollada, viguetas sobre la mitad abierta y vigas bajo el techo
  ctx.add(K.box(16.3, 0.34, 0.3, M.darkSteel, s2.x, ROOF - 0.34, s2.z + 5));
  ctx.add(K.rbox(15.6, 0.4, 0.42, M.panel, s2.x, ROOF - 0.74, s2.z + 4.72, 0.05));
  [-1, 1].forEach((s) => ctx.add(K.box(0.08, ROOF - 0.74 - FY, 0.1, M.darkSteel, s2.x + s * 7.8, FY, s2.z + 4.84)));
  [-4.8, -1.6, 1.6, 4.8].forEach((dx) => ctx.add(K.box(0.14, 0.28, 5.4, M.darkSteel, s2.x + dx, ROOF - 0.28, s2.z + 2.15)));
  [-1.1, 1.1].forEach((z) => ctx.add(K.box(15.6, 0.26, 0.16, M.darkSteel, s2.x, ROOF - 0.26, z)));
  // lineales colgadas sobre el banco y la ficha
  [1.6, 4.8].forEach((dx) => {
    const lamp = new THREE.Group();
    lamp.add(K.rbox(0.16, 0.07, 1.5, M.graphite, 0, 0, 0, 0.02));
    lamp.add(K.box(0.1, 0.012, 1.42, M.warmGlow, 0, -0.012, 0));
    [-0.6, 0.6].forEach((z) => lamp.add(K.box(0.008, ROOF - 0.28 - 6.37, 0.008, M.darkSteel, 0, 0.07, z)));
    add(lamp, s2.x + dx, 6.3, s2.z + 2.2);
  });

  // ---------- elevador con coche (anclas fijas) ----------
  // pintura grafito propia: poco metal y barniz moderado para que la carrocería no espeje los muros marfil
  const carPaint = new THREE.MeshPhysicalMaterial({ color: '#383c40', metalness: 0.3, roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.16 });
  const car = evCar(ctx, carPaint);
  const lift = K.makeLift(M, car);
  lift.position.set(s2.x - 3.6, s2.y, s2.z - 3);
  ctx.add(lift);
  ctx.shadows.push({ x: s2.x - 3.6, y: FY, z: s2.z - 3, w: 5.6, d: 4.4 });
  const LX = s2.x - 3.6;
  const LZ = s2.z - 3;

  // vano motor bajo el capó abierto (coordenadas del coche, frente hacia +x)
  const engine = new THREE.Group();
  engine.add(K.rbox(0.62, 0.07, 0.66, M.graphite, 1.48, 1.02, 0, 0.025));
  engine.add(K.box(0.36, 0.02, 0.4, M.panel, 1.48, 1.09, 0));
  engine.add(K.box(0.07, 0.05, 1.52, M.darkSteel, 2.06, 1.0, 0));
  [-0.62, 0.62].forEach((z) => {
    const c = K.cyl(0.075, 0.085, 0.07, M.darkSteel, 16);
    c.position.set(1.12, 1.07, z);
    engine.add(c);
  });
  engine.add(K.rbox(0.2, 0.11, 0.15, M.ivoryPanel, 1.9, 1.0, 0.55, 0.03));
  const cap = K.cyl(0.035, 0.035, 0.03, M.amberMatte, 12);
  cap.position.set(1.9, 1.125, 0.55);
  engine.add(cap);
  engine.add(K.rbox(0.24, 0.08, 0.2, M.panel, 1.86, 1.0, -0.52, 0.02));
  engine.add(K.pipe([V(1.2, 1.08, -0.22), V(1.45, 1.11, -0.3), V(1.72, 1.09, -0.42), V(1.84, 1.06, -0.5)], 0.022, M.amberMatte, 16));
  engine.add(K.pipe([V(1.2, 1.08, -0.12), V(1.5, 1.12, -0.16), V(1.8, 1.08, -0.3), V(1.92, 1.06, -0.4)], 0.02, M.amberMatte, 16));
  const rod = K.cyl(0.012, 0.012, 0.72, M.steel, 6);
  rod.position.set(1.845, 1.38, 0.72);
  rod.rotation.z = 0.451;
  engine.add(rod);
  car.add(engine);

  // mando en la columna sur con conducto, latiguillos por las columnas y cubrecables bajo el coche
  const ctrl = new THREE.Group();
  ctrl.add(K.rbox(0.3, 0.46, 0.15, M.graphite, 0, 0, 0, 0.03));
  ctrl.add(K.box(0.24, 0.3, 0.012, M.panel, 0, 0.1, 0.075));
  ctrl.add(hcyl(K, 0.028, 0.03, M.amberMatte, 'z', -0.06, 0.32, 0.085, 14));
  ctrl.add(hcyl(K, 0.028, 0.03, M.graphiteLight, 'z', 0.06, 0.32, 0.085, 14));
  ctrl.add(K.box(0.05, 0.02, 0.012, M.lime, -0.06, 0.18, 0.083));
  ctrl.add(hcyl(K, 0.036, 0.04, M.amberMatte, 'z', 0.06, 0.19, 0.09, 14));
  ctrl.add(K.box(0.035, 0.98, 0.035, M.darkSteel, 0.1, -0.98, 0.02));
  add(ctrl, LX, FY + 1.02, LZ + 1.55 + 0.21 + 0.075);
  [-1, 1].forEach((s) => ctx.add(K.box(0.03, 3.75, 0.03, M.rubber, LX + 0.24, s2.y + 0.15, LZ + s * 1.55 + 0.12)));
  ctx.add(K.box(0.34, 0.035, 2.7, M.darkSteel, LX + 0.45, FY, LZ));
  [-1, 1].forEach((s) => ctx.add(K.box(0.04, 0.036, 2.7, M.amberMatte, LX + 0.45 + s * 0.17, FY, LZ)));
  // zonas de seguridad ámbar en las bases y contorno lima del puesto
  [-1, 1].forEach((s) => {
    const cz = LZ + s * 1.55;
    [[0, 0.6, 1.3, 0.06], [0, -0.6, 1.3, 0.06], [0.65, 0, 0.06, 1.26], [-0.65, 0, 0.06, 1.26]].forEach(([dx, dz, w, d]) => ctx.add(K.box(w, 0.006, d, M.amberMatte, LX + dx, FY, cz + dz)));
  });
  [[0, -2.6, 6.28, 0.08], [0, 2.6, 6.28, 0.08], [-3.1, 0, 0.08, 5.12], [3.1, 0, 0.08, 5.12]].forEach(([dx, dz, w, d]) => ctx.add(K.box(w, 0.006, d, M.limeLine, LX + dx, FY, LZ + dz)));
  // recorrido de la batería: del vano motor al banco
  ctx.add(new THREE.Mesh(ribbon([V(-30.9, 0, 2.3), V(-30.5, 0, 3.7), V(-30.0, 0, 4.9), V(-29.55, 0, 5.75)], 0.08, FY + 0.007), M.limeLine));
  // traza principal: entra por la puerta oeste, barre el paso junto al extremo del banco y sale por el sureste
  const traceMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(LIME).multiplyScalar(1.45), map: T.pulseTexture() });
  const trace = traceOverlay(ctx, { x0: WX + 0.025, x1: s2.x + 8, z0: s2.z - 7, z1: s2.z + 5, floorY: FY + 0.003, mat: traceMat });
  if (trace) ctx.add(trace);

  // camilla y gato junto al coche
  add(creeper(ctx), LX + 2.3, FY, LZ + 2.35, 0.35);
  add(floorJack(ctx), LX + 3.05, FY, LZ + 1.55, 2.36);
  shadow(LX + 2.3, LZ + 2.35, 0.7, 1.2, 0.35);

  // ---------- pared del fondo (de oeste a este) ----------
  // compresor vertical con manómetro
  const comp = new THREE.Group();
  comp.add(K.cyl(0.24, 0.24, 1.0, M.graphite, 20));
  comp.children[0].position.y = 0.62;
  [-1, 1].forEach((s) => comp.add(K.box(0.08, 0.12, 0.4, M.darkSteel, s * 0.15, 0, 0)));
  comp.add(sbox(K, 0.42, 0.26, 0.32, M.darkSteel, 0, 1.12, 0, 0.03));
  comp.add(K.box(0.5, 0.05, 0.02, M.amberMatte, 0, 0.75, 0.24));
  const gauge = hcyl(K, 0.06, 0.03, M.ivoryPanel, 'z', 0.12, 1.25, 0.17, 16);
  comp.add(gauge);
  add(comp, s2.x - 5.55, FY, BZ + 0.36);
  shadow(s2.x - 5.55, BZ + 0.36, 0.8, 0.8);
  // enrollador de aire con manguera ámbar y racor
  const reel = new THREE.Group();
  reel.add(hcyl(K, 0.26, 0.14, M.graphite, 'z', 0, 0, 0.09, 24));
  const hose = new THREE.Mesh(K.geo('wsHoseCoil', () => new THREE.TorusGeometry(0.2, 0.03, 8, 32)), M.amberMatte);
  hose.position.z = 0.17;
  reel.add(hose);
  reel.add(K.pipe([V(0.12, -0.16, 0.18), V(0.2, -0.6, 0.22), V(0.16, -1.0, 0.3), V(0.06, -1.15, 0.32)], 0.022, M.amberMatte, 20));
  reel.add(K.box(0.04, 0.12, 0.04, M.steel, 0.06, -1.27, 0.32));
  add(reel, s2.x - 4.2, FY + 2.15, BZ);
  // cuadro eléctrico con aviso ámbar y conductos hasta la bandeja
  const panelBox = new THREE.Group();
  panelBox.add(K.rbox(0.72, 1.0, 0.22, M.graphite, 0, 0, 0.11, 0.025));
  panelBox.add(K.box(0.01, 0.9, 0.005, M.panel, 0, 0.05, 0.222));
  panelBox.add(K.box(0.03, 0.14, 0.03, M.steel, 0.28, 0.44, 0.23));
  panelBox.add(K.box(0.16, 0.14, 0.006, M.amberMatte, -0.18, 0.72, 0.222));
  [-0.18, 0.18].forEach((x) => panelBox.add(K.box(0.05, ROOF - 1.4 - (FY + 1.35 + 1.0), 0.05, M.darkSteel, x, 1.0, 0.07)));
  add(panelBox, s2.x - 2.6, FY + 1.35, BZ);
  // conducción de aire comprimido con bajantes y bandeja de cables
  ctx.add(hcyl(K, 0.022, 13.8, M.steel, 'x', s2.x - 0.1, FY + 3.65, BZ + 0.08, 10));
  for (let x = -6.8; x <= 6.4; x += 1.8) ctx.add(K.box(0.04, 0.07, 0.1, M.darkSteel, s2.x + x, FY + 3.6, BZ + 0.05));
  ctx.add(K.box(0.04, 3.65 - 2.45, 0.04, M.steel, s2.x - 4.2 + 0.18, FY + 2.45, BZ + 0.08));
  ctx.add(K.box(0.04, 3.65 - 2.3, 0.04, M.steel, s2.x - 1.45, FY + 2.3, BZ + 0.08));
  ctx.add(sbox(K, 0.12, 0.22, 0.1, M.graphite, s2.x - 1.45, FY + 2.1, BZ + 0.1, 0.02));
  ctx.add(hcyl(K, 0.035, 0.02, M.ivoryPanel, 'z', s2.x - 1.45, FY + 2.22, BZ + 0.16, 12));
  const trayY = ROOF - 1.4;
  ctx.add(K.box(14.4, 0.02, 0.3, M.darkSteel, s2.x, trayY, BZ + 0.18));
  ctx.add(K.box(14.4, 0.07, 0.015, M.darkSteel, s2.x, trayY, BZ + 0.33));
  for (let x = -7; x <= 7.1; x += 1.75) ctx.add(K.box(0.03, 0.03, 0.32, M.darkSteel, s2.x + x, trayY - 0.03, BZ + 0.17));
  [[0.06, M.rubber], [0.12, M.amberMatte], [0.2, M.rubber]].forEach(([dz, mat]) => ctx.add(K.box(14.3, 0.028, 0.03, mat, s2.x, trayY + 0.02, BZ + dz)));

  // conducto de ventilación en lo alto del muro, con colgadores y difusores
  const ductY = ROOF - 0.62;
  ctx.add(hcyl(K, 0.17, 15.0, M.steel, 'x', s2.x, ductY, BZ + 0.32, 20));
  for (let x = -7; x <= 7.1; x += 2.8) ctx.add(K.box(0.035, ROOF - ductY, 0.035, M.darkSteel, s2.x + x, ductY, BZ + 0.32));
  [-5.6, -2.8, 0, 2.8, 5.6].forEach((x) => {
    ctx.add(K.box(0.16, 0.12, 0.16, M.steel, s2.x + x, ductY - 0.28, BZ + 0.32));
    ctx.add(sbox(K, 0.44, 0.08, 0.44, M.graphite, s2.x + x, ductY - 0.36, BZ + 0.32, 0.015));
    ctx.add(K.box(0.36, 0.006, 0.36, M.panel, s2.x + x, ductY - 0.366, BZ + 0.32));
  });

  // nivel alto del muro: estante de carga sobre separadores (deja libre la línea de aire) con cubetas rotuladas
  // y cajas de cartón planas; encima de la luminaria, paneles acústicos grafito con juntas de sombra y un
  // bañador por vano bajo la bandeja de cables
  const SH = { x0: s2.x - 1.2, len: 6.6, bays: 4, z0: BZ + 0.12, depth: 0.42, levels: [FY + 3.32, FY + 3.76] };
  const bayLen = SH.len / SH.bays;
  const shz = SH.z0 + SH.depth / 2;
  const shx = SH.x0 + SH.len / 2;
  for (let b = 0; b <= SH.bays; b++) {
    const x = SH.x0 + b * bayLen;
    ctx.add(K.box(0.05, 0.9, 0.03, M.darkSteel, x, FY + 3.15, SH.z0 + 0.015));
    [FY + 3.45, FY + 3.9].forEach((y) => ctx.add(K.box(0.04, 0.04, 0.12, M.darkSteel, x, y, BZ + 0.06)));
    SH.levels.forEach((ly) => {
      ctx.add(K.box(0.03, 0.05, SH.depth, M.darkSteel, x, ly - 0.05, shz));
      const strut = K.box(0.02, 0.02, 0.34, M.darkSteel);
      strut.position.set(x, ly - 0.19, SH.z0 + 0.14);
      strut.rotation.x = -0.6;
      ctx.add(strut);
    });
  }
  SH.levels.forEach((ly) => {
    ctx.add(K.box(SH.len + 0.06, 0.012, SH.depth, M.steel, shx, ly, shz));
    ctx.add(K.box(SH.len + 0.06, 0.06, 0.035, M.graphite, shx, ly - 0.045, SH.z0 + SH.depth));
    for (let b = 0; b < SH.bays; b++) ctx.add(K.box(0.09, 0.03, 0.004, M.amberMatte, SH.x0 + (b + 0.5) * bayLen, ly - 0.03, SH.z0 + SH.depth + 0.019));
  });
  // carga: cubetas de picking (grafito, ámbar para consumibles de seguridad) y cajas de cartón de baterías.
  // Instancias sobre el marfil mate común con el color por instancia compensado (sin material nuevo).
  const storeMat = M.ivoryPanel;
  const binGeo = K.geo('wsBin', () => {
    const s = new THREE.Shape();
    [[0, 0], [0.34, 0], [0.34, 0.1], [0.25, 0.115], [0.13, 0.18], [0, 0.18]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
    return geo.rotateY(-Math.PI / 2).translate(0.1, 0, -0.17);
  });
  const boxGeo = K.geo('wsUnitBox', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const binList = [];
  const cartonList = [];
  // colores divididos por el marfil base: grafito #303337, ámbar #c9973f, cartón kraft #a88a5e y variantes
  const GRAPHITE_BIN = '#373d4a';
  const AMBER_BIN = '#e2b154';
  const KRAFT = ['#bca27a', '#b39871', '#c4aa82'];
  const binRow = (b, l, col) => {
    const cx = SH.x0 + (b + 0.5) * bayLen;
    const y = SH.levels[l] + 0.012;
    for (let i = 0; i < 6; i++) {
      const x = cx + (i - 2.5) * 0.235;
      binList.push({ x, y, z: shz, c: col });
      ctx.add(K.box(0.11, 0.035, 0.004, M.ivoryPanel, x, y + 0.045, shz + 0.181));
    }
  };
  const cartons = (b, l, n, stack) => {
    const cx = SH.x0 + (b + 0.5) * bayLen;
    const y = SH.levels[l] + 0.012;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * (n === 3 ? 0.52 : 0.62);
      for (let k = 0; k < stack; k++) {
        const r = ((i * 3 + k) % 3) * 0.02 - 0.02;
        cartonList.push({ x, y: y + k * 0.132, z: shz, sx: 0.46, sy: 0.13, sz: 0.34, r, c: KRAFT[(i + k) % 3] });
        ctx.add(K.box(0.12, 0.06, 0.004, M.panel, x - 0.1, y + k * 0.132 + 0.035, shz + 0.172));
      }
    }
  };
  binRow(0, 0, GRAPHITE_BIN);
  cartons(0, 1, 2, 2);
  binRow(1, 0, AMBER_BIN);
  binRow(1, 1, GRAPHITE_BIN);
  cartons(2, 0, 3, 1);
  binRow(2, 1, GRAPHITE_BIN);
  binRow(3, 0, GRAPHITE_BIN);
  cartons(3, 1, 2, 2);
  // (las instancias se crean tras el banco: el trapo del banco comparte la caja unitaria)
  // paneles acústicos y bañadores
  const panelW = (SH.len + 2 - 6 * 0.04) / 7;
  for (let i = 0; i < 7; i++) ctx.add(K.box(panelW, 0.74, 0.035, M.panel, SH.x0 - 2 + panelW / 2 + i * (panelW + 0.04), FY + 4.22, BZ + 0.0175));
  for (let b = 0; b < SH.bays; b++) {
    const x = SH.x0 + (b + 0.5) * bayLen;
    ctx.add(K.rbox(0.38, 0.06, 0.12, M.graphite, x, FY + 4.9, BZ + 0.095, 0.015));
    ctx.add(K.box(0.32, 0.008, 0.05, M.warmGlow, x, FY + 4.895, BZ + 0.11));
  }

  // cajonera alta con cofre superior y panel de cubetas encima
  add(rollCab(ctx, { w: 1.5, h: 1.0, d: 0.62, drawers: [1, 1, 1, 1.4, 1.4, 2] }), s2.x - 0.35, FY, BZ + 0.33);
  add(rollCab(ctx, { w: 1.46, h: 0.46, d: 0.5, drawers: [1, 1, 1, 1.3], top: false, wheels: false, side: false }), s2.x - 0.35, FY + 1.03, BZ + 0.27);
  ctx.add(K.rbox(1.48, 0.06, 0.52, M.graphite, s2.x - 0.35, FY + 1.49, BZ + 0.27, 0.02));
  shadow(s2.x - 0.35, BZ + 0.33, 1.7, 0.9);
  ctx.add(K.box(1.5, 0.92, 0.025, M.darkSteel, s2.x - 0.35, FY + 2.12, BZ + 0.012));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const x = s2.x - 0.35 + (c - 2) * 0.28;
      const y = FY + 2.17 + r * 0.29;
      ctx.add(sbox(K, 0.24, 0.13, 0.22, r === 1 && c % 2 ? M.amberMatte : M.graphite, x, y, BZ + 0.14, 0.012));
      ctx.add(K.box(0.12, 0.035, 0.004, M.ivoryPanel, x, y + 0.05, BZ + 0.252));
    }
  }

  // puesto de diagnóstico: mesa con pedestales, monitor con gráfico vivo, impresora de etiquetas QR y silla
  // mesa a altura de trabajo sentado (0,75 m) para la silla de oficina
  const desk = new THREE.Group();
  desk.add(K.box(2.6, 0.05, 0.8, M.stoneTop, 0, 0.7, 0));
  [-1, 1].forEach((s) => {
    const ped = rollCab(ctx, { w: 0.62, h: 0.68, d: 0.72, drawers: [1, 1, 1.6], top: false, wheels: false, side: false });
    ped.position.x = s * 0.96;
    desk.add(ped);
  });
  desk.add(K.box(1.24, 0.42, 0.03, M.panel, 0, 0.26, -0.34));
  desk.add(sbox(K, 0.26, 0.016, 0.18, M.darkSteel, -0.28, 0.75, -0.14, 0.006));
  desk.add(K.box(0.05, 0.3, 0.03, M.darkSteel, -0.28, 0.75, -0.2));
  desk.add(K.box(0.44, 0.018, 0.14, M.graphite, -0.28, 0.75, 0.16));
  desk.add(sbox(K, 0.05, 0.022, 0.08, M.graphite, 0.08, 0.75, 0.16, 0.01));
  desk.add(sbox(K, 0.24, 0.15, 0.28, M.ivoryPanel, 0.72, 0.75, -0.06, 0.025));
  desk.add(K.box(0.07, 0.003, 0.11, M.stoneTop, 0.72, 0.8, 0.13));
  desk.add(K.box(0.18, 0.012, 0.012, M.limeLine, 0.72, 0.86, 0.081));
  const mug = K.cyl(0.04, 0.036, 0.1, M.ivory, 14);
  mug.position.set(0.32, 0.8, 0.18);
  desk.add(mug);
  const graph = { prog: 1 };
  const mon = T.liveScreen(512, 288, (g, w, h) => {
    g.fillStyle = '#0f1112';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(229,174,80,0.16)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 40; x < w; x += 40) {
      g.moveTo(x, 46);
      g.lineTo(x, h - 22);
    }
    for (let y = 46; y < h - 18; y += 36) {
      g.moveTo(40, y);
      g.lineTo(w - 16, y);
    }
    g.stroke();
    g.fillStyle = IVORY;
    g.font = F_TITLE;
    g.fillText('ECB-0427 · tensión en reposo', 16, 30);
    g.fillStyle = 'rgba(241,238,230,0.5)';
    g.font = F_SMALL;
    g.fillText('13 V', 6, 60);
    g.fillText('12 V', 6, 168);
    const n = Math.max(2, Math.floor(graph.prog * 116));
    const px = (i) => 40 + i * ((w - 60) / 116);
    const py = (i) => 96 + Math.sin(i * 0.09) * 16 + i * 0.55 - Math.sin(i * 0.43) * 5;
    g.beginPath();
    g.moveTo(px(0), h - 22);
    for (let i = 0; i <= n; i++) g.lineTo(px(i), py(i));
    g.lineTo(px(n), h - 22);
    g.fillStyle = 'rgba(194,242,48,0.12)';
    g.fill();
    g.beginPath();
    for (let i = 0; i <= n; i++) (i ? g.lineTo(px(i), py(i)) : g.moveTo(px(i), py(i)));
    g.strokeStyle = LIME;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = IVORY;
    g.beginPath();
    g.arc(px(n), py(n), 5, 0, Math.PI * 2);
    g.fill();
  }, 6);
  const monitor = K.framedScreen(M, mon.texture, 0.84, 0.48, 0.9);
  monitor.position.set(-0.28, 1.21, -0.16);
  desk.add(monitor);
  add(desk, s2.x + 2.4, FY, BZ + 0.42);
  shadow(s2.x + 2.4, BZ + 0.42, 2.9, 1.1);
  add(officeChair(ctx), s2.x + 2.75, FY, BZ + 1.45, Math.PI + 0.45);
  shadow(s2.x + 2.75, BZ + 1.45, 0.7, 0.7);
  // panel perforado sobre la mesa
  const pegTex = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#b3a893';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#3f3a33';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        g.beginPath();
        g.arc(16 + i * 32, 16 + j * 32, 5.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  pegTex.wrapS = pegTex.wrapT = THREE.RepeatWrapping;
  pegTex.repeat.set(1 / 0.16, 1 / 0.16);
  const pegMat = new THREE.MeshStandardMaterial({ map: pegTex, roughness: 0.82 });
  pegMat.userData.tile = 0.16;
  add(toolWall(ctx, pegMat), s2.x + 2.4, FY + 1.4, BZ + 0.004);

  // taquilla alta y carro cargador en la esquina
  ctx.add(K.rbox(0.9, 1.95, 0.5, M.graphite, s2.x + 4.85, FY, BZ + 0.26, 0.02));
  ctx.add(K.box(0.008, 1.85, 0.006, M.panel, s2.x + 4.85, FY + 0.05, BZ + 0.512));
  [-1, 1].forEach((s) => {
    ctx.add(K.box(0.02, 0.18, 0.025, M.steel, s2.x + 4.85 + s * 0.06, FY + 1.0, BZ + 0.522));
    for (let k = 0; k < 3; k++) ctx.add(K.box(0.3, 0.012, 0.006, M.panel, s2.x + 4.85 + s * 0.22, FY + 1.65 + k * 0.05, BZ + 0.512));
  });
  ctx.add(K.box(0.2, 0.06, 0.006, M.amberMatte, s2.x + 4.63, FY + 1.35, BZ + 0.512));
  shadow(s2.x + 4.85, BZ + 0.3, 1.1, 0.7);
  add(rollCab(ctx, { w: 1.0, h: 0.92, d: 0.6, drawers: [1, 1, 1.6], top: 'stone' }), s2.x + 6.25, FY, BZ + 0.36);
  const charger = new THREE.Group();
  charger.add(sbox(K, 0.5, 0.3, 0.34, M.graphite, 0, 0, 0, 0.03));
  charger.add(K.box(0.2, 0.1, 0.006, M.darkGlass, -0.1, 0.16, 0.171));
  charger.add(K.box(0.03, 0.03, 0.006, M.lime, 0.12, 0.2, 0.172));
  [0, 1, 2].forEach((k) => charger.add(K.box(0.03, 0.012, 0.006, M.limeLine, 0.12, 0.12 - k * 0.025, 0.172)));
  const cA = new THREE.Mesh(K.geo('wsChargeCoil', () => new THREE.TorusGeometry(0.11, 0.016, 6, 24)), M.amberMatte);
  cA.position.set(0.31, 0.12, 0);
  cA.rotation.y = Math.PI / 2;
  charger.add(cA);
  const cB = new THREE.Mesh(K.geo('wsChargeCoil', () => new THREE.TorusGeometry(0.11, 0.016, 6, 24)), M.rubber);
  cB.position.set(0.34, 0.1, 0.04);
  cB.rotation.y = Math.PI / 2;
  charger.add(cB);
  add(charger, s2.x + 6.15, FY + 0.95, BZ + 0.36, 0.1);
  shadow(s2.x + 6.25, BZ + 0.36, 1.2, 0.8);

  // ---------- estanterías de baterías ----------
  // muro este: tres módulos de cuatro baldas, frente hacia el oeste
  const eastLevels = [0.1, 0.72, 1.34, 1.96];
  const eastRack = rack(ctx, { bays: 3, bayLen: 1.8, levels: eastLevels, height: 2.5 });
  const erx = EX - 0.3;
  const erz = s2.z - 3.65;
  add(eastRack, erx, FY, erz, -Math.PI / 2);
  shadow(erx, erz, 0.8, 5.6);
  const skipE = new Set(['1-3-1', '2-0-0', '0-2-1', '2-3-0']);
  for (let b = 0; b < 3; b++) {
    for (let l = 0; l < 4; l++) {
      for (let k = 0; k < 2; k++) {
        if (skipE.has(`${b}-${l}-${k}`)) continue;
        bats.push({ x: erx + 0.02, y: FY + eastLevels[l] + 0.07, z: erz - 2.7 + b * 1.8 + 0.45 + k * 0.9, r: -Math.PI / 2, s: 0.5 });
      }
    }
  }
  // extintor de CO2 (fuego eléctrico) y botiquín en el extremo libre del muro este
  const ext = new THREE.Group();
  const bottle = K.cyl(0.08, 0.08, 0.52, M.graphite, 16);
  bottle.position.y = 0.26;
  ext.add(bottle);
  const extBand = K.cyl(0.082, 0.082, 0.07, M.amberMatte, 16);
  extBand.position.y = 0.38;
  ext.add(extBand);
  ext.add(K.box(0.04, 0.08, 0.04, M.darkSteel, 0, 0.52, 0));
  ext.add(K.box(0.12, 0.02, 0.03, M.darkSteel, -0.04, 0.58, 0));
  ext.add(K.pipe([V(0.02, 0.56, 0), V(0.1, 0.5, 0.02), V(0.11, 0.3, 0.03), V(0.09, 0.18, 0.03)], 0.012, M.rubber, 12));
  const horn = K.cyl(0.022, 0.045, 0.14, M.rubber, 12);
  horn.position.set(0.09, 0.12, 0.03);
  ext.add(horn);
  ext.add(K.box(0.06, 0.08, 0.1, M.darkSteel, 0, 0.42, -0.08));
  add(ext, EX - 0.1, FY + 0.95, s2.z - 0.72, -Math.PI / 2);
  ctx.add(sbox(K, 0.12, 0.32, 0.32, M.ivoryPanel, EX - 0.06, FY + 1.62, s2.z - 0.72, 0.02));
  ctx.add(K.box(0.006, 0.16, 0.05, M.limeLine, EX - 0.122, FY + 1.7, s2.z - 0.72));
  ctx.add(K.box(0.006, 0.05, 0.16, M.limeLine, EX - 0.122, FY + 1.755, s2.z - 0.72));

  // muro oeste: dos módulos de tres baldas, frente hacia el este
  const westLevels = [0.1, 0.8, 1.5];
  const wrx = WX + 0.3;
  const wrz = s2.z - 3.8;
  add(rack(ctx, { bays: 2, bayLen: 1.8, levels: westLevels, height: 2.1 }), wrx, FY, wrz, Math.PI / 2);
  shadow(wrx, wrz, 0.8, 3.8);
  for (let b = 0; b < 2; b++) {
    for (let l = 0; l < 3; l++) {
      for (let k = 0; k < 2; k++) {
        if ((b + l + k) % 5 === 4) continue;
        bats.push({ x: wrx - 0.02, y: FY + westLevels[l] + 0.07, z: wrz + 1.8 - b * 1.8 - 0.45 - k * 0.9, r: Math.PI / 2, s: 0.5 });
      }
    }
  }

  // ---------- neumáticos con llanta ----------
  const tyreStack = (x, z, n, ry = 0) => {
    for (let i = 0; i < n; i++) {
      const wh = wheel(ctx, i === n - 1);
      add(wh, x + Math.sin(i * 2.1) * 0.02, FY + 0.118 + i * 0.236, z + Math.cos(i * 1.7) * 0.02, ry + i * 0.7);
    }
    shadow(x, z, 0.95, 0.95);
  };
  tyreStack(s2.x + 6.7, s2.z - 1.0, 4);
  tyreStack(s2.x + 6.75, s2.z - 1.85, 3, 0.4);

  // carro plataforma vacío junto a la salida: la batería seguirá hacia el laboratorio
  const cart = new THREE.Group();
  cart.add(sbox(K, 0.62, 0.05, 1.0, M.graphite, 0, 0.16, 0, 0.015));
  cart.add(K.box(0.56, 0.006, 0.94, M.rubber, 0, 0.21, 0));
  [[-0.24, -0.38], [0.24, -0.38], [-0.24, 0.38], [0.24, 0.38]].forEach(([x, z]) => {
    cart.add(K.box(0.06, 0.05, 0.06, M.darkSteel, x, 0.11, z));
    cart.add(hcyl(K, 0.055, 0.035, M.rubber, 'x', x, 0.055, z, 14));
  });
  [-0.26, 0.26].forEach((x) => cart.add(K.box(0.03, 0.72, 0.03, M.darkSteel, x, 0.21, -0.47)));
  cart.add(hcyl(K, 0.018, 0.56, M.darkSteel, 'x', 0, 0.93, -0.47, 10));
  cart.add(hcyl(K, 0.024, 0.28, M.limeInsert, 'x', 0, 0.93, -0.47, 10));
  add(cart, s2.x + 6.65, FY, s2.z + 2.35, Math.PI / 2);
  shadow(s2.x + 6.65, s2.z + 2.35, 1.1, 0.75);
  // canal de desagüe con rejilla en el umbral
  ctx.add(K.box(15.2, 0.012, 0.24, M.panel, s2.x, FY - 0.004, s2.z + 4.78));
  for (let x = -7.5; x <= 7.5; x += 0.25) ctx.add(K.box(0.03, 0.014, 0.22, M.darkSteel, s2.x + x, FY - 0.003, s2.z + 4.78));

  // ---------- frente oeste: cajonera con batería (primer plano de la entrada) ----------
  add(rollCab(ctx, { w: 1.3, h: 1.0, d: 0.62, drawers: [1, 1, 1, 1.5, 1.5] }), s2.x - 6.4, FY, s2.z + 2.0, 0.25);
  bats.push({ x: s2.x - 6.42, y: FY + 1.03, z: s2.z + 2.0, r: 0.25, s: 0.45 });
  shadow(s2.x - 6.4, s2.z + 2.0, 1.6, 0.9, 0.25);

  ctx.add(K.batteryInstances(M, bats));

  // ---------- banco principal (ancla fija): cajonera, encimera clara, alfombrilla, batería y lector ----------
  const bench = new THREE.Group();
  bench.add(K.cabinet(M, { w: 3.6, h: 0.95, d: 1.5, drawers: 3, top: M.stoneTop }));
  bench.add(K.box(1.9, 0.015, 1.2, M.rubber, 0.35, 1.11, 0));
  const b2 = K.makeBattery(M, { scale: 0.62 });
  b2.position.set(0.35, 1.125, 0);
  b2.rotation.y = -0.2;
  bench.add(b2);
  // bandeja de vasos y destornillador lima detrás del lector, trapo doblado en la esquina delantera y maletín
  // cerrado al fondo del extremo izquierdo (la diagnosis con polímetro llega en el capítulo 3)
  const tray = new THREE.Group();
  tray.add(sbox(K, 0.48, 0.045, 0.3, M.graphite, 0, 0, 0, 0.012));
  for (let i = 0; i < 12; i++) {
    const r = 0.014 + (i % 6) * 0.0028;
    const c = K.cyl(r, r, 0.04 + (i % 6) * 0.004, M.steel, 14);
    c.position.set(-0.19 + (i % 6) * 0.076, 0.065, i < 6 ? -0.07 : 0.07);
    tray.add(c);
  }
  tray.position.set(1.45, 1.11, 0.1);
  tray.rotation.y = -0.12;
  bench.add(tray);
  const sd = new THREE.Group();
  sd.add(hcyl(K, 0.018, 0.12, M.limeInsert, 'x', 0, 0.018, 0, 12));
  sd.add(hcyl(K, 0.005, 0.16, M.steel, 'x', 0.14, 0.018, 0, 8));
  sd.position.set(1.3, 1.11, 0.34);
  sd.rotation.y = 0.2;
  bench.add(sd);
  // trapo de algodón gris cálido (#8d8a84) en tres pliegues escalonados: instancias de la caja unitaria
  const BX = s2.x + 2.6;
  const BZB = s2.z + 2.2;
  const ragR = 0.25;
  [[0.34, 0.25, 0, 0, 0], [0.32, 0.235, 0.012, 0.012, -0.004], [0.17, 0.225, 0.075, 0.024, -0.006]].forEach(([w, d, x, y, z]) => {
    const rx = 1.6 + x * Math.cos(ragR) + z * Math.sin(ragR);
    const rz = 0.6 - x * Math.sin(ragR) + z * Math.cos(ragR);
    cartonList.push({ x: BX + rx, y: s2.y + 1.11 + y, z: BZB + rz, sx: w, sy: 0.012, sz: d, r: ragR, c: '#9ea2ab' });
  });
  // maletín cerrado con cierres ámbar y bandejita de piezas (oscuros: no compiten con el titular)
  bench.add(sbox(K, 0.48, 0.11, 0.34, M.graphite, -1.3, 1.11, -0.42, 0.02));
  bench.add(K.box(0.3, 0.03, 0.035, M.darkSteel, -1.3, 1.22, -0.42));
  [-0.15, 0.15].forEach((dx) => bench.add(K.box(0.04, 0.03, 0.01, M.amberMatte, -1.3 + dx, 1.17, -0.247)));
  bench.add(sbox(K, 0.26, 0.035, 0.18, M.graphite, -0.85, 1.11, -0.5, 0.01));

  // lector QR de mano en su base, a la derecha y por delante de la batería, orientado hacia la etiqueta
  b2.updateMatrix();
  const qrLocal = new THREE.Vector3(0.66, 0.2, 0.402);
  const qrBench = qrLocal.clone().applyMatrix4(b2.matrix);
  const sc = scannerModel(ctx);
  const scanner = sc.group;
  scanner.position.set(1.0, 1.115, 0.55);
  scanner.rotation.y = Math.atan2(qrBench.x - scanner.position.x, qrBench.z - scanner.position.z);
  bench.add(scanner);
  // cable del lector: sale por detrás de la base y cae por el canto del banco hacia el cargador
  bench.add(K.pipe([V(1.13, 1.14, 0.64), V(1.19, 1.13, 0.73), V(1.23, 1.1, 0.8), V(1.25, 0.9, 0.815), V(1.26, 0.62, 0.81)], 0.008, M.rubber, 20));

  bench.position.set(BX, s2.y, BZB);
  ctx.add(bench);
  ctx.shadows.push({ x: s2.x + 2.6, y: FY, z: s2.z + 2.2, w: 4.4, d: 2.2 });

  // instancias del estante alto (cubetas, cajas) y del trapo
  const o3 = new THREE.Object3D();
  const col = new THREE.Color();
  [[binGeo, binList], [boxGeo, cartonList]].forEach(([geo, list]) => {
    const im = new THREE.InstancedMesh(geo, storeMat, list.length);
    list.forEach((it, i) => {
      o3.position.set(it.x, it.y, it.z);
      o3.rotation.set(0, it.r || 0, 0);
      o3.scale.set(it.sx || 1, it.sy || 1, it.sz || 1);
      o3.updateMatrix();
      im.setMatrixAt(i, o3.matrix);
      im.setColorAt(i, col.set(it.c));
    });
    im.castShadow = true;
    im.receiveShadow = true;
    ctx.add(im);
  });

  // ---------- lectura breve del QR (dinámica, no sólida) ----------
  scanner.updateMatrix();
  sc.gun.updateMatrix();
  const toB2 = new THREE.Matrix4().copy(b2.matrix).invert();
  const apex = sc.window.clone().applyMatrix4(sc.gun.matrix).applyMatrix4(scanner.matrix).applyMatrix4(toB2);
  const lime = new THREE.Color(LIME);
  const lineTex = canvasTexture(64, 32, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(255,255,255,0)');
    v.addColorStop(0.4, 'rgba(255,255,255,0.22)');
    v.addColorStop(0.5, 'rgba(255,255,255,1)');
    v.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const u = g.createLinearGradient(0, 0, w, 0);
    u.addColorStop(0, 'rgba(0,0,0,0)');
    u.addColorStop(0.14, 'rgba(0,0,0,1)');
    u.addColorStop(0.86, 'rgba(0,0,0,1)');
    u.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = u;
    g.fillRect(0, 0, w, h);
  }, false);
  const bracketTex = canvasTexture(128, 128, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.13)';
    g.fillRect(22, 22, 84, 84);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 7;
    [[10, 10, 1, 1], [118, 10, -1, 1], [10, 118, 1, -1], [118, 118, -1, -1]].forEach(([x, y, sx, sy]) => {
      g.beginPath();
      g.moveTo(x, y + sy * 26);
      g.lineTo(x, y);
      g.lineTo(x + sx * 26, y);
      g.stroke();
    });
  }, false);
  const glowOpts = { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false };
  const lineMat = new THREE.MeshBasicMaterial({ map: lineTex, color: lime.clone().multiplyScalar(1.5), ...glowOpts });
  const bracketMat = new THREE.MeshBasicMaterial({ map: bracketTex, color: lime.clone().multiplyScalar(1.25), ...glowOpts });
  const fanMat = new THREE.MeshBasicMaterial({ color: lime, vertexColors: true, side: THREE.DoubleSide, ...glowOpts });
  const fx = ctx.dyn(new THREE.Group());
  fx.userData.noCollide = true;
  b2.add(fx);
  const QR = { x: qrLocal.x, y: qrLocal.y, z: qrLocal.z + 0.006, s: 0.095 };
  const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.045), lineMat);
  scanLine.position.set(QR.x, QR.y, QR.z + 0.002);
  const brackets = new THREE.Mesh(new THREE.PlaneGeometry(0.155, 0.155), bracketMat);
  brackets.position.set(QR.x, QR.y, QR.z);
  // abanico del láser: pirámide de cuatro caras desde la ventana del lector hasta la línea de barrido, con
  // 1,5 cm de grueso para que nunca se reduzca a una raya
  const FAN_T = 0.012;
  const fanPos = new Float32Array(15);
  const fanCorner = [[-0.06, 1], [0.06, 1], [0.06, -1], [-0.06, -1]];
  fanPos[0] = apex.x;
  fanPos[1] = apex.y;
  fanPos[2] = apex.z;
  const setFan = (y) => {
    for (let i = 0; i < 4; i++) {
      fanPos[3 + i * 3] = QR.x + fanCorner[i][0];
      fanPos[4 + i * 3] = y + fanCorner[i][1] * FAN_T;
      fanPos[5 + i * 3] = QR.z;
    }
  };
  setFan(QR.y);
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPos, 3));
  fanGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.05, 0.05, 0.05, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), 3));
  fanGeo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
  const fan = new THREE.Mesh(fanGeo, fanMat);
  fan.frustumCulled = false;
  fx.add(scanLine, brackets, fan);
  const glow = ctx.dyn(new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.05), lineMat));
  glow.userData.noCollide = true;
  glow.position.set(0, 0.205, 0.205);
  sc.gun.add(glow);

  // ---------- ficha digital proyectada desde el techo ----------
  const qrImg = T.qrLabelTexture(11).image;
  const ROWS = [
    ['Tipo', 'Plomo-ácido 12 V'],
    ['Entrada', 'Taller · 21/10'],
    ['Procedencia', 'Mantenimiento'],
    ['Estado visual', 'Sin fugas'],
    ['Diagnóstico', 'Pendiente'],
  ];
  // fill: campos escritos (0..5); scan: avance del barrido o -1; flash: marco del QR; verify: aviso de relectura
  const rs = { fill: 0, scan: -1, flash: 0, verify: 0 };
  const rec = T.liveScreen(512, 640, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 22);
    g.fillStyle = 'rgba(14,16,17,0.86)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(194,242,48,0.9)';
    g.stroke();
    g.fillStyle = 'rgba(241,238,230,0.62)';
    g.font = F_LABEL;
    g.fillText('FICHA DIGITAL', 36, 64);
    g.fillStyle = LIME;
    g.font = F_ID;
    g.fillText('ECB-0427', 34, 124);
    g.fillStyle = '#f4f2ec';
    g.fillRect(366, 30, 112, 112);
    g.drawImage(qrImg, 370, 34, 104, 104);
    if (rs.flash > 0.01) {
      g.globalAlpha = rs.flash;
      g.strokeStyle = LIME;
      g.lineWidth = 6;
      g.strokeRect(359, 23, 126, 126);
      g.globalAlpha = 1;
    }
    if (rs.verify > 0.01) {
      g.globalAlpha = rs.verify;
      g.fillStyle = LIME;
      g.font = F_STATE;
      g.fillText('QR verificado ✓', 36, 166);
      g.globalAlpha = 1;
    }
    for (let i = 0; i < ROWS.length; i++) {
      const y = 198 + i * 76;
      const f = Math.min(1, Math.max(0, rs.fill - i));
      g.fillStyle = 'rgba(241,238,230,0.5)';
      g.font = F_KEY;
      g.fillText(ROWS[i][0], 36, y);
      if (f > 0) {
        g.save();
        g.beginPath();
        g.rect(34, y + 6, 400 * f, 44);
        g.clip();
        g.fillStyle = IVORY;
        g.font = F_VAL;
        g.fillText(ROWS[i][1], 36, y + 38);
        g.restore();
        if (f >= 1) {
          g.strokeStyle = LIME;
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(444, y + 22);
          g.lineTo(455, y + 33);
          g.lineTo(475, y + 11);
          g.stroke();
        }
      } else {
        g.fillStyle = 'rgba(241,238,230,0.08)';
        g.fillRect(36, y + 14, 230 - i * 16, 22);
      }
      g.fillStyle = 'rgba(241,238,230,0.12)';
      g.fillRect(36, y + 52, 440, 2);
    }
    // pie de estado: una vez completo no vuelve atrás (una relectura solo destella el marco del QR)
    const sy = h - 46;
    g.font = F_STATE;
    if (rs.fill >= ROWS.length) {
      g.fillStyle = LIME;
      g.beginPath();
      g.arc(44, sy - 8, 7, 0, Math.PI * 2);
      g.fill();
      g.fillText('Registro completo', 60, sy);
    } else if (rs.scan >= 0) {
      g.fillStyle = LIME;
      g.fillText('Leyendo QR…', 36, sy);
      g.fillStyle = 'rgba(194,242,48,0.2)';
      g.fillRect(36, sy + 14, 440, 6);
      g.fillStyle = LIME;
      g.fillRect(36, sy + 14, 440 * rs.scan, 6);
    } else if (rs.fill > 0) {
      g.fillStyle = 'rgba(241,238,230,0.62)';
      g.fillText('Registrando campos…', 36, sy);
    } else {
      g.fillStyle = 'rgba(241,238,230,0.42)';
      g.fillText('Pendiente de lectura', 36, sy);
    }
  }, 12);
  // la ficha cuelga de una barra emisora suspendida de la vigueta, arriba a la derecha de la batería
  // (posición calculada para no tocar la batería en ningún encuadre de lectura)
  const REC = { x: s2.x + 5.4, y: s2.y + 2.54, z: s2.z + 0.3, w: 0.9, h: 1.125 };
  const holo = add(new THREE.Group(), REC.x, REC.y, REC.z, -0.665);
  const recMat = new THREE.MeshBasicMaterial({ map: rec.texture, transparent: true, depthWrite: false });
  const recMesh = ctx.dyn(new THREE.Mesh(new THREE.PlaneGeometry(REC.w, REC.h), recMat));
  recMesh.userData.noCollide = true;
  holo.add(recMesh);
  const barY = REC.h / 2 + 0.055;
  holo.add(K.rbox(REC.w + 0.08, 0.05, 0.08, M.graphite, 0, barY, 0, 0.018));
  holo.add(K.box(REC.w - 0.06, 0.008, 0.02, M.lime, 0, barY - 0.006, 0.012));
  ctx.add(K.box(0.025, ROOF - 0.36 - (REC.y + barY + 0.05), 0.025, M.darkSteel, REC.x, REC.y + barY + 0.05, REC.z));
  ctx.add(K.box(0.7, 0.08, 0.08, M.darkSteel, (REC.x + s2.x + 4.8) / 2, ROOF - 0.36, REC.z));

  // luz de trabajo sobre el banco, alineada con la lineal colgada: el charco más claro del taller
  const task = new THREE.SpotLight('#ffd6a8', 30, 9, 0.6, 0.45, 1.5);
  task.position.set(s2.x + 1.6, 6.2, s2.z + 2.5);
  task.target.position.set(s2.x + 2.95, s2.y + 1.3, s2.z + 2.2);
  ctx.add(task);
  ctx.add(task.target);
  // bañador cálido estrecho sobre el panel de herramientas y el puesto: el muro queda graduado, no uniforme
  const wash = new THREE.SpotLight('#ffcf9a', 22, 8, 0.48, 0.6, 1.5);
  wash.position.set(s2.x + 2.4, ROOF - 0.5, BZ + 1.9);
  wash.target.position.set(s2.x + 2.4, FY + 1.9, BZ + 0.05);
  ctx.add(wash);
  ctx.add(wash.target);

  // ---------- fachada oeste: puerta lateral por la que entra la traza, aplique y punto de carga ----------
  const oz = 7.62;
  const outX = s2.x - 8 - 0.175;
  [[outX - 0.012, -1], [WX + 0.012, 1]].forEach(([x, s]) => {
    ctx.add(K.box(0.024, 1.84, 1.0, M.darkGlass, x, s2.y + 0.3, oz));
    [-0.54, 0.54].forEach((dz) => ctx.add(K.box(0.05, 2.2, 0.07, M.darkSteel, x + s * 0.012, s2.y, oz + dz)));
    ctx.add(K.box(0.05, 0.07, 1.15, M.darkSteel, x + s * 0.012, s2.y + 2.14, oz));
    ctx.add(K.box(0.05, 0.05, 1.15, M.darkSteel, x + s * 0.012, s2.y + 0.25, oz));
    ctx.add(K.box(0.03, 0.02, 0.28, M.steel, x + s * 0.03, s2.y + 1.05, oz - 0.28));
  });
  ctx.add(K.box(0.72, 0.06, 1.4, M.darkSteel, outX - 0.36, s2.y + 2.45, oz));
  ctx.add(K.box(0.3, 0.02, 0.5, M.warmGlow, outX - 0.3, s2.y + 2.43, oz));
  for (let z = s2.z - 6; z <= s2.z + 2.5; z += 2) ctx.add(K.box(0.03, 6.1, 0.05, M.graphiteLight, outX - 0.015, s2.y + 0.2, z));
  ctx.add(K.box(0.04, 0.08, 12.0, M.darkSteel, outX - 0.02, s2.y + 3.2, s2.z - 1));
  [s2.z - 4, s2.z].forEach((z) => {
    ctx.add(sbox(K, 0.14, 0.22, 0.3, M.graphite, outX - 0.07, s2.y + 4.0, z, 0.02));
    ctx.add(K.box(0.012, 0.14, 0.22, M.warmGlow, outX - 0.146, s2.y + 4.04, z));
  });
  const wallbox = new THREE.Group();
  wallbox.add(sbox(K, 0.15, 0.42, 0.32, M.graphite, 0, 0, 0, 0.03));
  wallbox.add(K.box(0.006, 0.05, 0.05, M.lime, -0.078, 0.3, 0));
  wallbox.add(new THREE.Mesh(K.geo('wsEvCoil', () => new THREE.TorusGeometry(0.15, 0.022, 8, 28)), M.rubber));
  wallbox.children[2].position.set(-0.1, -0.12, 0);
  wallbox.children[2].rotation.y = Math.PI / 2;
  add(wallbox, outX - 0.08, s2.y + 1.1, s2.z + 1.6);
  ctx.add(K.box(0.04, s2.y + 1.1 - s2.y, 0.04, M.darkSteel, outX - 0.03, s2.y, s2.z + 1.6));

  // ---------- delantal exterior: bolardos que protegen los pilares y balizas ----------
  [s2.x - 8, s2.x + 8].forEach((x) => {
    const b = K.cyl(0.085, 0.085, 0.8, M.amberMatte, 16);
    b.position.set(x, s2.y + 0.4, s2.z + 5.75);
    ctx.add(b);
    const capB = K.cyl(0.09, 0.09, 0.05, M.graphite, 16);
    capB.position.set(x, s2.y + 0.82, s2.z + 5.75);
    ctx.add(capB);
    const band = K.cyl(0.088, 0.088, 0.08, M.graphite, 16);
    band.position.set(x, s2.y + 0.6, s2.z + 5.75);
    ctx.add(band);
  });
  ctx.lamps.push({ x: s2.x - 10.2, y: s2.y, z: s2.z + 5.9 }, { x: s2.x + 4, y: s2.y, z: s2.z + 8.1 }, { x: s2.x + 9.6, y: s2.y, z: s2.z + 5.6 });

  // ---------- animación: lectura breve del QR por eventos, ficha que se completa y gráfico del monitor ----------
  // Solo en el capítulo 2: una lectura de 0,8 s cuando se abre la ventana de lectura y, como mucho, otra de
  // verificación si el visitante se detiene; se rearma al salir del capítulo. Los campos se escriben tras la
  // primera lectura (0,45 s cada uno). Fuera del capítulo la ficha queda vacía (antes) o completa (después).
  // Con el tiempo congelado (capturas fijas del arnés) el estado se deriva del avance dentro de la ventana.
  const SWEEP = 0.8;
  const TYPE = 0.45;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  // done: la ficha ya se completó en esta visita al taller o el visitante vuelve desde el laboratorio
  const sq = { armed: true, done: false, sweeps: 0, start: -1, type: -1, still: 0, flashAt: -9, verifyAt: -9, graph: 0.2 };
  fx.userData.wsState = { sq, rs }; // estado legible por las pruebas de verificación (sin coste)
  let clk = 0;
  let lastT = null;
  let lastP = null;
  let stale = 0;
  let recKey = -1;
  let monKey = -1;
  let recAcc = 1;
  let monAcc = 1;
  let warm = 3; // primeros fotogramas: los efectos se dibujan invisibles para compilar sus shaders en la carga
  [scanLine, brackets, glow].forEach((m) => (m.frustumCulled = false));
  const showSweep = (u) => {
    const on = u >= 0 && u < 1;
    scanLine.visible = fan.visible = glow.visible = on;
    if (!on) return;
    const fade = 1 - Math.pow(Math.abs(2 * u - 1), 6);
    const y = QR.y + QR.s * 0.55 - u * QR.s * 1.1;
    lineMat.opacity = fade;
    fanMat.opacity = 0.32 * fade;
    scanLine.position.y = y;
    setFan(y);
    fanGeo.attributes.position.needsUpdate = true;
  };
  ctx.anim((t, dt, story) => {
    // pulso de la traza interior en fase con la traza principal del mundo (quieto con movimiento reducido)
    if (!story?.reduced) traceMat.map.offset.x = -t * 0.35;
    if (warm > 0) {
      warm--;
      fx.visible = scanLine.visible = brackets.visible = fan.visible = glow.visible = true;
      lineMat.opacity = bracketMat.opacity = fanMat.opacity = 0;
      return;
    }
    // reloj del proceso: avanza con t (también en la grabación fotograma a fotograma); t inmóvil = captura fija
    const step = lastT === null ? 0 : t - lastT;
    stale = step === 0 ? stale + 1 : 0;
    lastT = t;
    const dtc = step > 0 && step < 0.25 ? step : 0;
    clk += dtc;
    const frozen = stale > 20;
    const dp = lastP === null ? 1 : Math.abs(story.p - lastP);
    lastP = story.p;
    recAcc += dt;
    monAcc += dt;
    const idx = story.index;
    let u = -1;
    if (story.reduced) {
      // estado final representativo, sin bucles
      rs.fill = ROWS.length;
      rs.scan = -1;
      rs.flash = rs.verify = 0;
      graph.prog = 1;
    } else if (idx !== 2) {
      sq.armed = true;
      sq.done = idx > 2;
      sq.sweeps = 0;
      sq.start = sq.type = -1;
      sq.still = 0;
      sq.flashAt = sq.verifyAt = -9;
      rs.fill = idx > 2 ? ROWS.length : 0;
      rs.scan = -1;
      rs.flash = rs.verify = 0;
      sq.graph = graph.prog = idx > 2 ? 1 : 0.2;
    } else if (frozen) {
      // guion fijo: barrido al abrirse la ventana, campos hasta la mitad y ficha completa en el ancla
      const l = story.local;
      u = l >= -0.1 && l < 0.15 ? (l + 0.1) / 0.25 : -1;
      rs.fill = clamp01((l - 0.15) / 0.35) * ROWS.length;
      rs.scan = u;
      rs.flash = rs.verify = 0;
      graph.prog = Math.min(1, Math.max(0.2, 0.35 + 0.6 * l));
    } else {
      sq.still = dp < 1e-4 ? sq.still + dtc : 0;
      if (sq.start < 0) {
        if (sq.armed && story.vis >= 0.97) {
          // al volver con la ficha ya completa solo hay una relectura de verificación
          sq.armed = false;
          sq.sweeps = sq.done ? 2 : 1;
          sq.start = clk;
        } else if (sq.sweeps === 1 && rs.fill >= ROWS.length && sq.still >= 0.6 && clk - sq.type > TYPE * ROWS.length + 1) {
          sq.sweeps = 2;
          sq.start = clk;
        }
      }
      if (sq.start >= 0) {
        u = (clk - sq.start) / SWEEP;
        if (u >= 1) {
          u = -1;
          sq.start = -1;
          sq.flashAt = clk;
          if (rs.fill >= ROWS.length) sq.verifyAt = clk;
          else if (sq.type < 0) sq.type = clk;
        }
      }
      // si se cruza la ventana sin detenerse, la ficha queda completa antes de salir del capítulo
      const typed = sq.done ? ROWS.length : sq.type < 0 ? 0 : (clk - sq.type) / TYPE;
      rs.fill = Math.min(ROWS.length, Math.max(typed, clamp01((story.local - 0.7) / 0.25) * ROWS.length));
      rs.scan = u;
      rs.flash = clamp01(1 - (clk - sq.flashAt) / 0.7);
      const v = clk - sq.verifyAt;
      rs.verify = v < 1.4 ? 1 : clamp01(1 - (v - 1.4) / 0.5);
      if (sq.verifyAt < 0) rs.verify = 0;
      sq.graph = Math.min(1, sq.graph + dtc / 14);
      graph.prog = sq.graph;
    }
    const live = idx === 2 && !story.reduced;
    fx.visible = live;
    if (live) {
      showSweep(u);
      bracketMat.opacity = u >= 0 ? 0.5 : rs.flash;
      brackets.visible = bracketMat.opacity > 0.01;
    } else glow.visible = false;
    if (idx < 1 || idx > 3) return;
    // pantallas: la ficha a 12 fps como máximo y el monitor a 6, solo cuando cambia lo que muestran
    const key = Math.round(rs.fill * 8) * 100000 + (u >= 0 ? Math.round(u * 24) : 25) * 1000 + Math.round(rs.flash * 10) * 10 + Math.round(rs.verify * 9);
    if (key !== recKey && (recAcc >= 1 / 12 || story.reduced)) {
      recAcc = 0;
      recKey = key;
      rec.update(t, story, true);
    }
    const mk = Math.floor(graph.prog * 116);
    if (mk !== monKey && (monAcc >= 1 / 6 || story.reduced)) {
      monAcc = 0;
      monKey = mk;
      mon.update(t, story, true);
    }
    recMesh.position.y = story.reduced || frozen ? 0 : Math.sin(t * 0.8) * 0.012;
  });
}
