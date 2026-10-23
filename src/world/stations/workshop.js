import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CH } from '../chapters.js';
import * as A from '../actors.js';

// 4 · Nave de reutilización (el antiguo taller de la isla s2, reaprovechado).
// Las baterías de plomo aptas o reparables siguen una línea: banco de limpieza, banco de reparación (bornes y
// carcasa), estación de carga en línea, banco de nueva comprobación y, en la crujía este, el muelle de expedición con
// el camión que las devuelve al mercado con su historial. Reparación y expedición son el mismo proceso: el muelle es
// solo la salida. Al fondo, estanterías de carga con cargadores y LED de estado; delante, el palé de entrada y el palé
// «Al reciclaje» con las que no superan la nueva comprobación.
// Rendimiento: solo materiales de M (los rótulos usan un atlas con los mismos parámetros que los del depósito, que
// comparte su programa), dos focos con alcance de 8 m, los LED en dos mallas fusionadas (lima y ámbar) que solo
// cambian su rango de dibujo, y la batería que se mueve es una instancia más del juego de baterías.

const FONT = '"Archivo Variable", "Archivo", system-ui, sans-serif';
const PAL = { plate: '#1b1e20', ivory: '#F1EEE6', lime: '#C2F230', amber: '#E5AE50' };

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

// Estantería de largueros (largo en x, fondo en z, frente hacia +z).
function rack(ctx, { bays = 1, bayLen = 1.8, depth = 0.55, levels = [0.1, 0.72, 1.34, 1.96], height = 2.5 } = {}) {
  const { K, M } = ctx;
  const g = new THREE.Group();
  const len = bays * bayLen;
  for (let b = 0; b <= bays; b++) {
    const x = -len / 2 + b * bayLen;
    [-1, 1].forEach((s) => g.add(K.box(0.06, height, 0.05, M.darkSteel, x, 0, s * (depth / 2 - 0.025))));
    for (let y = 0.35; y < height - 0.1; y += 0.8) g.add(K.box(0.02, 0.02, depth - 0.06, M.darkSteel, x, y, 0));
    g.add(K.box(0.12, 0.012, 0.12, M.darkSteel, x, 0, depth / 2 - 0.03));
  }
  levels.forEach((ly) => {
    [-1, 1].forEach((s) => g.add(K.box(len, 0.07, 0.04, M.graphite, 0, ly, s * (depth / 2 - 0.02))));
    g.add(K.box(len - 0.04, 0.012, depth - 0.06, M.steel, 0, ly + 0.07, 0));
    // etiquetas de carga ámbar en el larguero frontal
    for (let b = 0; b < bays; b++) g.add(K.box(0.1, 0.035, 0.005, M.amberMatte, -len / 2 + (b + 0.5) * bayLen, ly + 0.017, depth / 2 + 0.001));
  });
  return g;
}

// ---------- rótulos: un atlas dibujado una vez ----------
const AW = 1024;
const AH = 384;
const CELLS = {
  reu: [0, 0, 1024, 96],
  muelle: [0, 96, 1024, 96],
  recic: [0, 192, 512, 128],
  entrada: [512, 192, 512, 128],
  limp: [0, 320, 256, 64],
  repa: [256, 320, 256, 64],
  carga: [512, 320, 256, 64],
  comp: [768, 320, 256, 64],
};

function signAtlas(T) {
  return T.liveScreen(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    const text = (s, x, y, size, col, weight, max, align = 'center') => {
      let px = size;
      g.font = `${weight} ${px}px ${FONT}`;
      while (g.measureText(s).width > max && px > 10) {
        px -= 2;
        g.font = `${weight} ${px}px ${FONT}`;
      }
      g.fillStyle = col;
      g.textAlign = align;
      g.textBaseline = 'middle';
      g.fillText(s, x, y);
    };
    const plate = ([x, y, w, h], bar) => {
      g.fillStyle = PAL.plate;
      g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(241,238,230,0.3)';
      g.lineWidth = 3;
      g.strokeRect(x + 5, y + 5, w - 10, h - 10);
      if (bar) {
        g.fillStyle = bar;
        g.fillRect(x + 22, y + 18, 8, h - 36);
      }
    };
    [['reu', 'REUTILIZACIÓN'], ['muelle', 'MUELLE DE EXPEDICIÓN']].forEach(([k, s]) => {
      const c = CELLS[k];
      plate(c, PAL.lime);
      text(s, c[0] + c[2] / 2 + 12, c[1] + c[3] / 2 + 3, 60, PAL.ivory, 800, c[2] - 120);
    });
    [['recic', 'AL RECICLAJE', 'No superan las pruebas', PAL.amber], ['entrada', 'ENTRADA', 'Aptas o reparables', PAL.lime]].forEach(([k, s, sub, col]) => {
      const c = CELLS[k];
      plate(c, col);
      text(s, c[0] + 50, c[1] + 50, 48, PAL.ivory, 800, c[2] - 76, 'left');
      text(sub, c[0] + 50, c[1] + 94, 30, 'rgba(241,238,230,0.8)', 500, c[2] - 76, 'left');
    });
    [['limp', 'LIMPIEZA'], ['repa', 'REPARACIÓN'], ['carga', 'CARGA'], ['comp', 'COMPROBACIÓN']].forEach(([k, s]) => {
      const c = CELLS[k];
      plate(c);
      text(s, c[0] + c[2] / 2, c[1] + c[3] / 2, 30, PAL.ivory, 700, c[2] - 34);
      g.fillStyle = PAL.lime;
      g.fillRect(c[0] + c[2] / 2 - 28, c[1] + c[3] - 13, 56, 3);
    });
  }, 1);
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
  const bats = []; // todas las baterías sueltas de la nave: un único juego de instancias

  // ---------- rótulos ----------
  const atlas = signAtlas(T);
  // mismos parámetros que los rótulos del depósito: mismo programa de sombreado
  const signMat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.55, metalness: 0.05, alphaTest: 0.5 });
  const sign = (cell, w, h) => {
    const geo = K.geo(`reuSign|${cell}|${w}|${h}`, () => {
      const pg = new THREE.PlaneGeometry(w, h);
      const [cx, cy, cw, ch] = CELLS[cell];
      const uv = pg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i) * cw) / AW, 1 - (cy + (1 - uv.getY(i)) * ch) / AH);
      return pg;
    });
    return new THREE.Mesh(geo, signMat);
  };

  // ---------- envolvente ----------
  const shop = K.makeCutaway(M, { w: 16, d: 12, h: 6.5, light: 11 });
  shop.position.set(s2.x, s2.y, s2.z - 1);
  // muros marfil propios con menos luz de entorno: los gradúan los focos y las tiras
  // (three solo respeta envMapIntensity si el material lleva su propio envMap: se toma el entorno de la escena)
  let sceneRoot = ctx.group;
  while (sceneRoot.parent) sceneRoot = sceneRoot.parent;
  const shopWall = M.ivory.clone();
  if (sceneRoot.environment) {
    shopWall.envMap = sceneRoot.environment;
    shopWall.envMapIntensity = (sceneRoot.environmentIntensity ?? 1) * 0.3;
  }
  // el foco general del edificio (alcance 32 m) se quita: lo sustituyen dos focos de 8 m sobre la línea de bancos
  const drop = [];
  shop.traverse((o) => {
    if (o.isSpotLight) drop.push(o, o.target);
    if (o.isMesh && o.material === M.ivory) o.material = shopWall;
  });
  drop.forEach((o) => o.parent && o.parent.remove(o));
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

  // ---------- línea de bancos (de oeste a este) ----------
  const LZ = s2.z - 3.5; // eje de la línea de bancos
  const TOP = 0.92; // altura de trabajo
  const BS = 0.2; // escala de las baterías de la línea (≈ 0,33 m de largo, como una batería de arranque real)
  const CLEAN_X = s2.x - 5.9;
  const REPAIR_X = s2.x - 3.0;
  const TEST_X = s2.x + 0.2;
  const CONV = [REPAIR_X + 0.83, TEST_X - 0.83];
  const CHARGE_X = (CONV[0] + CONV[1]) / 2;

  // lineales colgadas sobre la línea (solo emisivas: la luz real la ponen los dos focos)
  [-4.8, -1.6, 1.6].forEach((dx) => {
    const lamp = new THREE.Group();
    lamp.add(K.rbox(0.16, 0.07, 1.5, M.graphite, 0, 0, 0, 0.02));
    lamp.add(K.box(0.1, 0.012, 1.42, M.warmGlow, 0, -0.012, 0));
    [-0.6, 0.6].forEach((z) => lamp.add(K.box(0.008, ROOF - 0.28 - 6.37, 0.008, M.darkSteel, 0, 0.07, z)));
    add(lamp, s2.x + dx, 6.3, LZ + 0.3);
  });

  // banco de limpieza: mesa de acero con bandeja, rejilla de escurrido, pulverizador de neutralizante, cepillo y
  // bayetas; debajo, bidón de neutralizante y caja de absorbente
  const clean = new THREE.Group();
  [[-0.74, -0.29], [0.74, -0.29], [-0.74, 0.29], [0.74, 0.29]].forEach(([x, z]) => clean.add(K.box(0.045, TOP - 0.04, 0.045, M.darkSteel, x, 0, z)));
  clean.add(K.box(1.5, 0.025, 0.62, M.darkSteel, 0, 0.16, 0));
  clean.add(K.box(1.6, 0.04, 0.7, M.steel, 0, TOP - 0.04, 0));
  [[0, -0.34, 1.6, 0.02], [0, 0.34, 1.6, 0.02], [-0.79, 0, 0.02, 0.7], [0.79, 0, 0.02, 0.7]].forEach(([x, z, w, d]) => clean.add(K.box(w, 0.05, d, M.steel, x, TOP, z)));
  for (let i = 0; i < 9; i++) clean.add(K.box(0.018, 0.012, 0.34, M.darkSteel, -0.2 + i * 0.05, TOP, 0.02));
  const bottle = K.cyl(0.03, 0.034, 0.17, M.ivoryPanel, 10);
  bottle.position.set(-0.55, TOP + 0.085, -0.14);
  clean.add(bottle);
  clean.add(K.box(0.03, 0.05, 0.07, M.graphite, -0.55, TOP + 0.17, -0.12));
  clean.add(K.box(0.18, 0.03, 0.05, M.graphite, 0.48, TOP, 0.14));
  clean.add(K.box(0.2, 0.025, 0.05, M.wood, 0.48, TOP + 0.03, 0.14));
  clean.add(K.box(0.24, 0.02, 0.2, M.ivoryPanel, 0.5, TOP, -0.16));
  clean.add(K.box(0.24, 0.02, 0.2, M.ivoryPanel, 0.51, TOP + 0.02, -0.15));
  const drum = K.cyl(0.13, 0.13, 0.36, M.amberMatte, 14);
  drum.position.set(-0.42, 0.185 + 0.18, 0);
  clean.add(drum);
  clean.add(sbox(K, 0.4, 0.2, 0.3, M.graphite, 0.35, 0.185, 0, 0.02));
  add(clean, CLEAN_X, FY, LZ);
  shadow(CLEAN_X, LZ, 1.8, 0.9);
  bats.push({ x: CLEAN_X - 0.05, y: FY + TOP + 0.012, z: LZ + 0.02, r: 0.12, s: BS });

  // banco de reparación: bornes nuevos en su bandeja, extractor de bornes y soldador de plástico para la carcasa
  // (las herramientas quedan en la franja del fondo: la batería sale por delante hacia la cinta)
  const repair = new THREE.Group();
  repair.add(K.cabinet(M, { w: 1.6, h: TOP - 0.16, d: 0.7, drawers: 3, top: M.stoneTop }));
  repair.add(sbox(K, 0.28, 0.03, 0.14, M.graphite, -0.5, TOP, -0.22, 0.008));
  for (let i = 0; i < 4; i++) {
    const t = K.cyl(0.013, 0.016, 0.03, M.terminal, 8);
    t.position.set(-0.6 + i * 0.065, TOP + 0.045, -0.22);
    repair.add(t);
  }
  repair.add(K.box(0.16, 0.025, 0.035, M.darkSteel, -0.15, TOP, -0.24));
  repair.add(K.box(0.1, 0.03, 0.04, M.grip, -0.02, TOP, -0.24));
  repair.add(K.box(0.14, 0.04, 0.12, M.darkSteel, 0.45, TOP, -0.22));
  const welder = K.cyl(0.024, 0.03, 0.22, M.graphite, 10);
  welder.rotation.z = Math.PI / 2 - 0.25;
  welder.position.set(0.45, TOP + 0.1, -0.22);
  repair.add(welder);
  const nozzle = K.cyl(0.008, 0.013, 0.06, M.amberMatte, 8);
  nozzle.rotation.z = Math.PI / 2 - 0.25;
  nozzle.position.set(0.32, TOP + 0.13, -0.22);
  repair.add(nozzle);
  [0, 1, 2].forEach((k) => repair.add(K.box(0.28, 0.006, 0.006, M.graphiteLight, 0.66, TOP, -0.12 - k * 0.02)));
  add(repair, REPAIR_X, FY, LZ);
  shadow(REPAIR_X, LZ, 1.8, 0.9);

  // cinta de rodillos entre reparación y comprobación, con la estación de carga en línea en su centro
  const cl = CONV[1] - CONV[0];
  const ccx = (CONV[0] + CONV[1]) / 2;
  [-1, 1].forEach((s) => ctx.add(K.box(cl, 0.06, 0.03, M.darkSteel, ccx, FY + TOP - 0.065, LZ + 0.04 + s * 0.17)));
  for (let x = CONV[0] + 0.05; x < CONV[1] - 0.02; x += 0.08) ctx.add(hcyl(K, 0.022, 0.32, M.steel, 'z', x, FY + TOP - 0.022, LZ + 0.04, 8));
  [-1, 1].forEach((s) => {
    ctx.add(K.box(0.04, TOP - 0.07, 0.04, M.darkSteel, ccx + s * 0.45, FY, LZ + 0.21));
    ctx.add(K.box(0.04, TOP - 0.07, 0.04, M.darkSteel, ccx + s * 0.45, FY, LZ - 0.13));
  });

  // banco de nueva comprobación: comprobador con sus pinzas e impresora de etiquetas (el historial se actualiza)
  const test = new THREE.Group();
  test.add(K.cabinet(M, { w: 1.6, h: TOP - 0.16, d: 0.7, drawers: 3, top: M.stoneTop }));
  test.add(sbox(K, 0.13, 0.19, 0.06, M.graphite, 0.45, TOP, -0.12, 0.012));
  test.add(K.box(0.15, 0.025, 0.12, M.graphite, 0.45, TOP, -0.1));
  test.add(K.box(0.09, 0.055, 0.004, M.darkGlass, 0.45, TOP + 0.1, -0.088));
  test.add(sbox(K, 0.2, 0.12, 0.22, M.ivoryPanel, -0.6, TOP, -0.18, 0.02));
  test.add(K.box(0.13, 0.008, 0.008, M.limeLine, -0.6, TOP + 0.07, -0.066));
  test.add(K.pipe([V(0.41, TOP + 0.04, -0.09), V(0.3, TOP + 0.012, -0.05), V(0.05, TOP + 0.008, -0.12), V(-0.08, TOP + 0.008, -0.16)], 0.006, M.rubber, 8));
  test.add(K.pipe([V(0.49, TOP + 0.04, -0.09), V(0.42, TOP + 0.012, 0.0), V(0.2, TOP + 0.008, -0.07), V(0.1, TOP + 0.008, -0.17)], 0.006, M.amberMatte, 8));
  test.add(K.box(0.05, 0.02, 0.025, M.rubber, -0.1, TOP, -0.17));
  test.add(K.box(0.05, 0.02, 0.025, M.amberMatte, 0.08, TOP, -0.18));
  add(test, TEST_X, FY, LZ);
  shadow(TEST_X, LZ, 1.8, 0.9);

  // ---------- LED de los cargadores y del comprobador ----------
  // Cada LED es una caja en una de dos mallas fusionadas (lima, ámbar), ordenada por el avance `at` del capítulo
  // en que se enciende (lima) o se apaga (ámbar): la animación solo cambia el rango de dibujo de cada malla.
  const LED = { lime: [], amber: [] };
  // cargador (frente +z, origen en la base): `init` segmentos ya encendidos y la carga que termina en `done`
  // (los segmentos restantes se encienden de forma escalonada entre `start` y `done`)
  const charger = (x, y, z, init, done, start = 0) => {
    ctx.add(sbox(K, 0.12, 0.18, 0.16, M.graphite, x, y, z, 0.015));
    const fz = z + 0.08;
    ctx.add(K.box(0.09, 0.13, 0.004, M.panel, x, y + 0.02, fz + 0.001));
    for (let j = 0; j < 4; j++) LED.lime.push({ x, y: y + 0.04 + j * 0.03, z: fz + 0.005, sx: 0.07, sy: 0.022, at: j < init ? -1 : start + ((done - start) * (j - init + 1)) / (4 - init) });
    const st = { x: x + 0.035, y: y + 0.163, z: fz + 0.003, sx: 0.024, sy: 0.022 };
    LED.lime.push({ ...st, at: init >= 4 ? -1 : done });
    if (init < 4) LED.amber.push({ ...st, at: done });
  };

  // ---------- estanterías de carga (muro del fondo) ----------
  const RK = { x: s2.x - 3.8, z: BZ + 0.27, bays: 4, bayLen: 1.5, depth: 0.45, levels: [0.1, 0.55, 1.0, 1.45] };
  const rackLen = RK.bays * RK.bayLen;
  add(rack(ctx, { bays: RK.bays, bayLen: RK.bayLen, depth: RK.depth, levels: RK.levels, height: 1.85 }), RK.x, FY, RK.z);
  shadow(RK.x, RK.z, rackLen + 0.3, 0.7);
  const EMPTY = new Set([4, 13, 22, 31, 41]);
  let id = 0;
  for (let b = 0; b < RK.bays; b++) {
    for (let l = 0; l < RK.levels.length; l++) {
      for (let p = 0; p < 3; p++, id++) {
        if (EMPTY.has(id)) continue;
        const bx = RK.x - rackLen / 2 + b * RK.bayLen + 0.23 + p * 0.46;
        const y = FY + RK.levels[l] + 0.082;
        bats.push({ x: bx, y, z: RK.z + 0.03, r: 0, s: 0.19 });
        const init = id % 7 === 3 ? 4 : (id * 3) % 4;
        charger(bx + 0.24, y, RK.z - 0.02, init, init >= 4 ? -1 : 0.25 + ((id * 0.618) % 1) * 0.7);
        // pinzas: negra al borne cercano y ámbar cruzando la tapa hasta el lejano
        ctx.add(K.box(0.07, 0.008, 0.008, M.rubber, bx + 0.15, y + 0.168, RK.z - 0.01));
        ctx.add(K.box(0.3, 0.008, 0.008, M.amberMatte, bx + 0.03, y + 0.178, RK.z - 0.03));
      }
    }
  }

  // estación de carga en línea: poste detrás de la cinta, cargador con sus pinzas colgando sobre la cinta
  ctx.add(K.box(0.04, 1.4, 0.04, M.darkSteel, CHARGE_X, FY, LZ - 0.21));
  ctx.add(K.box(0.04, 0.03, 0.12, M.darkSteel, CHARGE_X, FY + 1.15, LZ - 0.16));
  charger(CHARGE_X, FY + 1.18, LZ - 0.2, 0, 0.6, 0.22);
  [-1, 1].forEach((s) => ctx.add(K.box(0.008, 0.11, 0.008, s < 0 ? M.amberMatte : M.rubber, CHARGE_X + s * 0.11, FY + 1.08, LZ - 0.07)));
  // piloto del comprobador: ámbar hasta que la batería repasa la prueba
  // (ocupa la pantalla del comprobador: lo que se lee de lejos es el color del resultado)
  const pilot = { x: TEST_X + 0.45, y: FY + TOP + 0.1275, z: LZ - 0.083, sx: 0.08, sy: 0.045 };
  LED.lime.push({ ...pilot, at: 0.88 });
  LED.amber.push({ ...pilot, at: 0.88 });

  const ledMesh = (list, mat, asc) => {
    list.sort((a, b) => (asc ? a.at - b.at : b.at - a.at));
    const parts = list.map((it) => new THREE.BoxGeometry(it.sx, it.sy, 0.006).translate(it.x, it.y, it.z));
    const geo = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    geo.computeBoundingSphere();
    const m = ctx.dyn(new THREE.Mesh(geo, mat));
    m.userData.noCollide = true;
    ctx.add(m);
    return { m, at: list.map((it) => it.at), per: geo.index.count / list.length };
  };
  const limeLeds = ledMesh(LED.lime, M.lime, true);
  const amberLeds = ledMesh(LED.amber, M.amberGlow, false);
  const setLeds = (u) => {
    let n = 0;
    while (n < limeLeds.at.length && limeLeds.at[n] <= u) n++;
    limeLeds.m.geometry.setDrawRange(0, n * limeLeds.per);
    let k = 0;
    while (k < amberLeds.at.length && amberLeds.at[k] > u) k++;
    amberLeds.m.geometry.setDrawRange(0, k * amberLeds.per);
  };

  // ---------- operarios (de espaldas, sobre su banco) ----------
  const person = (x, z, ry, pose, variant) => {
    if (!A.makePerson) return;
    add(A.makePerson(M, { role: 'reutilizacion', pose, variant }), x, FY, z, ry);
    shadow(x, z, 0.6, 0.5);
  };
  person(CLEAN_X + 0.1, LZ + 0.74, Math.PI, 'work', 0);
  person(REPAIR_X - 0.3, LZ + 0.74, Math.PI + 0.18, 'work', 1);
  person(TEST_X + 0.25, LZ + 0.78, Math.PI - 0.22, 'work', 2);

  // ---------- muro del fondo: cuadro de los cargadores, taquilla, extintor, botiquín ----------
  const panelBox = new THREE.Group();
  panelBox.add(K.rbox(0.72, 1.0, 0.22, M.graphite, 0, 0, 0.11, 0.025));
  panelBox.add(K.box(0.01, 0.9, 0.005, M.panel, 0, 0.05, 0.222));
  panelBox.add(K.box(0.03, 0.14, 0.03, M.steel, 0.28, 0.44, 0.23));
  panelBox.add(K.box(0.16, 0.14, 0.006, M.amberMatte, -0.18, 0.72, 0.222));
  [-0.18, 0.18].forEach((x) => panelBox.add(K.box(0.05, ROOF - 1.4 - (FY + 1.35 + 1.0), 0.05, M.darkSteel, x, 1.0, 0.07)));
  add(panelBox, s2.x + 0.05, FY + 1.35, BZ);
  const LKX = s2.x + 1.15;
  ctx.add(K.rbox(0.9, 1.95, 0.5, M.graphite, LKX, FY, BZ + 0.26, 0.02));
  ctx.add(K.box(0.008, 1.85, 0.006, M.panel, LKX, FY + 0.05, BZ + 0.512));
  [-1, 1].forEach((s) => {
    ctx.add(K.box(0.02, 0.18, 0.025, M.steel, LKX + s * 0.06, FY + 1.0, BZ + 0.522));
    for (let k = 0; k < 3; k++) ctx.add(K.box(0.3, 0.012, 0.006, M.panel, LKX + s * 0.22, FY + 1.65 + k * 0.05, BZ + 0.512));
  });
  shadow(LKX, BZ + 0.3, 1.1, 0.7);
  // extintor de CO2 (fuego eléctrico) y botiquín
  const ext = new THREE.Group();
  const extBody = K.cyl(0.08, 0.08, 0.52, M.graphite, 16);
  extBody.position.y = 0.26;
  ext.add(extBody);
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
  add(ext, s2.x + 2.0, FY + 0.95, BZ + 0.1);
  ctx.add(sbox(K, 0.32, 0.32, 0.12, M.ivoryPanel, s2.x + 2.0, FY + 1.62, BZ + 0.06, 0.02));
  ctx.add(K.box(0.05, 0.16, 0.006, M.limeLine, s2.x + 2.0, FY + 1.7, BZ + 0.122));
  ctx.add(K.box(0.16, 0.05, 0.006, M.limeLine, s2.x + 2.0, FY + 1.755, BZ + 0.122));

  // muro oeste: lavaojos junto a la limpieza (manejo de ácido) y kit de derrames
  const eye = new THREE.Group();
  eye.add(K.box(0.06, 0.5, 0.06, M.darkSteel, 0, -0.5, 0));
  eye.add(K.box(0.24, 0.05, 0.14, M.darkSteel, 0, 0, 0));
  const bowl = K.cyl(0.15, 0.1, 0.08, M.steel, 14);
  bowl.position.set(0.13, 0.08, 0);
  eye.add(bowl);
  eye.add(K.box(0.006, 0.24, 0.24, M.limeInsert, -0.12, 0.35, 0));
  add(eye, WX + 0.12, FY + 1.0, LZ - 1.2);
  ctx.add(sbox(K, 0.42, 0.62, 0.42, M.amberMatte, WX + 0.3, FY, LZ + 1.25, 0.03));
  ctx.add(K.box(0.44, 0.04, 0.44, M.graphite, WX + 0.3, FY + 0.62, LZ + 1.25));
  shadow(WX + 0.3, LZ + 1.25, 0.6, 0.6);

  // ---------- conducciones altas: bandeja de cables y ventilación de la zona de carga ----------
  const trayY = ROOF - 1.4;
  ctx.add(K.box(14.4, 0.02, 0.3, M.darkSteel, s2.x, trayY, BZ + 0.18));
  ctx.add(K.box(14.4, 0.07, 0.015, M.darkSteel, s2.x, trayY, BZ + 0.33));
  for (let x = -7; x <= 7.1; x += 1.75) ctx.add(K.box(0.03, 0.03, 0.32, M.darkSteel, s2.x + x, trayY - 0.03, BZ + 0.17));
  [[0.06, M.rubber], [0.12, M.amberMatte], [0.2, M.rubber]].forEach(([dz, mat]) => ctx.add(K.box(14.3, 0.028, 0.03, mat, s2.x, trayY + 0.02, BZ + dz)));
  const ductY = ROOF - 0.62;
  ctx.add(hcyl(K, 0.17, 15.0, M.steel, 'x', s2.x, ductY, BZ + 0.32, 20));
  for (let x = -7; x <= 7.1; x += 2.8) ctx.add(K.box(0.035, ROOF - ductY, 0.035, M.darkSteel, s2.x + x, ductY, BZ + 0.32));
  [-5.6, -2.8, 0, 2.8, 5.6].forEach((x) => {
    ctx.add(K.box(0.16, 0.12, 0.16, M.steel, s2.x + x, ductY - 0.28, BZ + 0.32));
    ctx.add(sbox(K, 0.44, 0.08, 0.44, M.graphite, s2.x + x, ductY - 0.36, BZ + 0.32, 0.015));
    ctx.add(K.box(0.36, 0.006, 0.36, M.panel, s2.x + x, ductY - 0.366, BZ + 0.32));
  });

  // nivel alto del muro, sobre las estanterías: estante de consumibles (cubetas de bornes y pinzas, cajas) sobre
  // separadores, paneles acústicos grafito y un bañador por vano
  const SH = { x0: WX + 0.6, len: 6.4, bays: 4, z0: BZ + 0.12, depth: 0.42, levels: [FY + 3.32, FY + 3.76] };
  const bayLen = SH.len / SH.bays;
  const shz = SH.z0 + SH.depth / 2;
  const shx = SH.x0 + SH.len / 2;
  for (let b = 0; b <= SH.bays; b++) {
    const x = SH.x0 + b * bayLen;
    ctx.add(K.box(0.05, 0.9, 0.03, M.darkSteel, x, FY + 3.15, SH.z0 + 0.015));
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
    ctx.add(K.box(SH.len + 0.06, 0.06, 0.035, M.graphite, shx, ly - 0.035, SH.z0 + SH.depth));
  });
  // cubetas y cajas: instancias sobre el marfil mate común con color por instancia (sin material nuevo)
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
  // colores divididos por el marfil base: grafito, ámbar (consumibles de seguridad) y cartón kraft
  const GRAPHITE_BIN = '#373d4a';
  const AMBER_BIN = '#e2b154';
  const KRAFT = ['#bca27a', '#b39871', '#c4aa82'];
  const binRow = (b, l, c) => {
    const cx = SH.x0 + (b + 0.5) * bayLen;
    const y = SH.levels[l] + 0.012;
    for (let i = 0; i < 6; i++) binList.push({ x: cx + (i - 2.5) * 0.235, y, z: shz, c });
  };
  const cartons = (b, l, n, stack) => {
    const cx = SH.x0 + (b + 0.5) * bayLen;
    const y = SH.levels[l] + 0.012;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * (n === 3 ? 0.52 : 0.62);
      for (let k = 0; k < stack; k++) cartonList.push({ x, y: y + k * 0.132, z: shz, sx: 0.46, sy: 0.13, sz: 0.34, r: ((i * 3 + k) % 3) * 0.02 - 0.02, c: KRAFT[(i + k) % 3] });
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
  const o3 = new THREE.Object3D();
  const col = new THREE.Color();
  [[binGeo, binList], [boxGeo, cartonList]].forEach(([geo, list]) => {
    const im = new THREE.InstancedMesh(geo, M.ivoryPanel, list.length);
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
  const panelW = (SH.len + 2 - 6 * 0.04) / 7;
  for (let i = 0; i < 7; i++) ctx.add(K.box(panelW, 0.74, 0.035, M.panel, SH.x0 - 0.4 + panelW / 2 + i * (panelW + 0.04), FY + 4.22, BZ + 0.0175));
  for (let b = 0; b < SH.bays; b++) {
    const x = SH.x0 + (b + 0.5) * bayLen;
    ctx.add(K.rbox(0.38, 0.06, 0.12, M.graphite, x, FY + 4.9, BZ + 0.095, 0.015));
    ctx.add(K.box(0.32, 0.008, 0.05, M.warmGlow, x, FY + 4.895, BZ + 0.11));
  }

  // ---------- entrada y palé «Al reciclaje» ----------
  const pallet = (x, y, z, ry = 0, opts = { kind: 'plomo' }) => (A.makePallet ? add(A.makePallet(M, opts), x, y, z, ry) : null);
  const outline = (x, z, w, d, mat) => [[0, -d / 2, w, 0.05], [0, d / 2, w, 0.05], [-w / 2, 0, 0.05, d], [w / 2, 0, 0.05, d]].forEach(([dx, dz, ww, dd]) => ctx.add(K.box(ww, 0.006, dd, mat, x + dx, FY, z + dz)));
  const signPost = (cell, x, z, w, h, top) => {
    const g = new THREE.Group();
    g.add(K.box(0.22, 0.02, 0.22, M.darkSteel, 0, 0, 0));
    g.add(K.box(0.05, top, 0.05, M.darkSteel, 0, 0, 0));
    g.add(K.box(w + 0.05, h + 0.05, 0.025, M.graphite, 0, top - h - 0.025, 0.04));
    const s = sign(cell, w, h);
    s.position.set(0, top - h / 2, 0.054);
    g.add(s);
    add(g, x, FY, z);
  };
  // llegan del cruce las aptas o reparables (palé completo, dos capas)
  const IN = { x: s2.x - 6.2, z: s2.z + 0.6 };
  pallet(IN.x, FY, IN.z);
  outline(IN.x, IN.z, 1.6, 1.2, M.limeLine);
  shadow(IN.x, IN.z, 1.4, 1.0);
  signPost('entrada', IN.x + 1.15, IN.z + 0.35, 0.84, 0.21, 1.55);
  // las que no superan la nueva comprobación esperan al tractor que las lleva al reciclaje (una capa)
  const OUT = { x: s2.x - 0.2, z: s2.z + 0.8 };
  pallet(OUT.x, FY, OUT.z, 0, { kind: 'plomo', count: 1 });
  outline(OUT.x, OUT.z, 1.6, 1.2, M.amberMatte);
  shadow(OUT.x, OUT.z, 1.4, 1.0);
  signPost('recic', OUT.x + 1.15, OUT.z + 0.35, 0.84, 0.21, 1.55);
  // línea de paso peatonal delante de los operarios y límite de la crujía del muelle
  ctx.add(K.box(EX - 4.4 - (WX + 0.4), 0.006, 0.06, M.limeLine, (WX + 0.4 + EX - 4.4) / 2, FY, LZ + 1.45));

  // ---------- muelle de expedición (crujía este) ----------
  const DX0 = s2.x + 3.4;
  const DX1 = EX;
  const DZ0 = BZ;
  const DZ1 = s2.z - 4.45;
  const TX = (DX0 + DX1) / 2;
  let Hd = 1.17; // altura del muelle = piso de la caja del camión
  const truck = A.makeTruck ? A.makeTruck(M, { kind: 'expedicion', loaded: true, doorsOpen: true }) : null;
  if (truck) {
    truck.updateMatrixWorld(true);
    const cargo = truck.userData.cargo;
    if (cargo) {
      const p = cargo.getWorldPosition(new THREE.Vector3());
      if (p.y > 0.6 && p.y < 1.8) Hd = p.y;
      // etiqueta QR en la cara de cada palé que mira a las puertas
      cargo.children.forEach((pl) => {
        const q = new THREE.Mesh(K.geo('reuPalletQR', () => new THREE.PlaneGeometry(0.11, 0.11)), M.qr);
        q.position.set(0.3, 0.3, -0.357);
        q.rotation.y = Math.PI;
        pl.add(q);
      });
    }
    const bb = new THREE.Box3().setFromObject(truck);
    // marcha atrás contra los topes: la trasera queda a 13 cm del canto del muelle
    add(truck, TX - (bb.min.x + bb.max.x) / 2, FY, DZ1 + 0.13 - bb.min.z);
    shadow(TX, DZ1 + 0.13 + (bb.max.z - bb.min.z) / 2, 2.7, bb.max.z - bb.min.z);
  }
  const dcx = (DX0 + DX1) / 2;
  ctx.add(K.box(DX1 - DX0, Hd, DZ1 - DZ0, M.concreteLight, dcx, FY, (DZ0 + DZ1) / 2));
  ctx.add(K.box(DX1 - DX0, 0.03, 0.08, M.darkSteel, dcx, FY + Hd - 0.029, DZ1 - 0.04));
  for (let x = DX0 + 0.2; x < DX1 - 0.1; x += 0.4) ctx.add(K.box(0.2, 0.1, 0.01, M.amberMatte, x, FY + Hd - 0.16, DZ1 + 0.005));
  [-1, 1].forEach((s) => ctx.add(K.box(0.16, 0.32, 0.12, M.rubber, TX + s * 1.05, FY + Hd - 0.5, DZ1 + 0.06)));
  // rampa niveladora: chapa en el muelle y labio apoyado en el piso del camión
  ctx.add(K.box(2.0, 0.025, 0.9, M.darkSteel, TX, FY + Hd - 0.02, DZ1 - 0.45));
  ctx.add(K.box(2.0, 0.02, 0.4, M.darkSteel, TX, FY + Hd, DZ1 + 0.2));
  // escalera de tres peldaños en el lado oeste y barandilla al norte de ella
  const SZ = DZ1 - 0.55;
  for (let k = 0; k < 3; k++) ctx.add(K.box(0.28, (Hd * (k + 1)) / 4, 0.9, M.concreteLight, DX0 - 0.14 - (2 - k) * 0.28, FY, SZ));
  [DZ0 + 0.15, SZ - 0.5].forEach((z) => ctx.add(K.box(0.04, 1.0, 0.04, M.darkSteel, DX0 + 0.03, FY + Hd, z)));
  [0.5, 0.98].forEach((y) => ctx.add(K.box(0.04, 0.04, SZ - 0.5 - (DZ0 + 0.15), M.darkSteel, DX0 + 0.03, FY + Hd + y, (DZ0 + 0.15 + SZ - 0.5) / 2)));
  // palés listos con su etiqueta QR; uno, sobre la transpaleta, entra ya en el camión
  const qrTag = (pl) => {
    if (!pl) return;
    const q = new THREE.Mesh(K.geo('reuPalletQR', () => new THREE.PlaneGeometry(0.11, 0.11)), M.qr);
    q.position.set(0.3, 0.3, 0.357);
    pl.add(q);
  };
  const jack = new THREE.Group();
  [-0.17, 0.17].forEach((x) => jack.add(K.box(0.16, 0.05, 1.15, M.darkSteel, x, 0.03, 0.1)));
  jack.add(sbox(K, 0.5, 0.3, 0.22, M.amberMatte, 0, 0.05, -0.6, 0.03));
  jack.add(hcyl(K, 0.08, 0.06, M.rubber, 'x', 0, 0.08, -0.6, 10));
  const handle = new THREE.Group();
  handle.add(K.box(0.04, 0.95, 0.04, M.darkSteel, 0, 0, 0));
  handle.add(K.box(0.34, 0.04, 0.05, M.grip, 0, 0.95, 0));
  handle.position.set(0, 0.32, -0.64);
  handle.rotation.x = -0.32;
  jack.add(handle);
  add(jack, TX - 0.62, FY + Hd, DZ1 - 0.95);
  qrTag(pallet(TX - 0.62, FY + Hd + 0.03, DZ1 - 0.85));
  qrTag(pallet(TX + 0.62, FY + Hd, DZ0 + 0.5));
  qrTag(pallet(DX0 + 0.66, FY + Hd, DZ0 + 0.5));
  // rótulo del muelle sobre la caja del camión
  ctx.add(K.box(3.28, 0.36, 0.03, M.graphite, TX, FY + 4.27, BZ + 0.015));
  const dockSign = sign('muelle', 3.2, 0.3);
  dockSign.position.set(TX, FY + 4.45, BZ + 0.032);
  ctx.add(dockSign);
  // límite pintado de la crujía del muelle
  ctx.add(K.box(0.06, 0.006, s2.z + 4.7 - DZ1, M.limeLine, DX0 - 0.15, FY, (s2.z + 4.7 + DZ1) / 2));

  // ---------- rótulos de la nave ----------
  // en el dintel de la persiana, hacia el exterior: la nave y, sobre la crujía este, el muelle
  [['reu', s2.x - 2.0], ['muelle', TX]].forEach(([cell, x]) => {
    const s = sign(cell, 3.2, 0.3);
    s.position.set(x, ROOF - 0.54, s2.z + 4.936);
    ctx.add(s);
  });
  // rótulos de puesto colgados de la viga sobre la línea
  const hang = (cell, x) => {
    const y = FY + 2.75;
    const z = 1.1;
    ctx.add(K.box(0.88, 0.25, 0.02, M.graphite, x, y - 0.125, z));
    const s = sign(cell, 0.84, 0.21);
    s.position.set(x, y, z + 0.011);
    ctx.add(s);
    [-0.36, 0.36].forEach((dx) => ctx.add(K.box(0.008, ROOF - 0.26 - (y + 0.125), 0.008, M.darkSteel, x + dx, y + 0.125, z)));
  };
  hang('limp', CLEAN_X);
  hang('repa', REPAIR_X - 0.15);
  hang('carga', CHARGE_X + 0.05);
  hang('comp', TEST_X + 0.15);

  // ---------- batería en movimiento: una instancia más del juego de baterías ----------
  const X0 = REPAIR_X + 0.05;
  const X1 = CHARGE_X;
  const X2 = TEST_X - 0.2;
  const MOVE_I = bats.length;
  const MY = FY + TOP;
  const MZ = LZ + 0.04;
  bats.push({ x: X0, y: MY, z: MZ, r: 0, s: BS });
  const batGroup = K.batteryInstances(M, bats);
  ctx.add(batGroup);
  const B = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const sc = new THREE.Vector3(BS, BS, BS);
  const pos = new THREE.Vector3(X0, MY, MZ);
  const inv0 = new THREE.Matrix4().compose(pos, q0, sc).invert();
  const movers = batGroup.children.map((im) => {
    im.getMatrixAt(MOVE_I, tmp);
    return { im, local: inv0.clone().multiply(tmp) };
  });
  const setMove = (x) => {
    pos.set(x, MY, MZ);
    B.compose(pos, q0, sc);
    movers.forEach(({ im, local }) => {
      im.setMatrixAt(MOVE_I, tmp.multiplyMatrices(B, local));
      im.instanceMatrix.needsUpdate = true;
    });
  };
  // esferas de recorte que cubren el trayecto entero
  setMove(X2);
  const spheres = movers.map(({ im }) => {
    im.computeBoundingSphere();
    return im.boundingSphere.clone();
  });
  setMove(X0);
  movers.forEach(({ im }, i) => {
    im.computeBoundingSphere();
    im.boundingSphere.union(spheres[i]);
  });

  // ---------- luces: dos focos pequeños sobre la línea (alcance 8 m) ----------
  [[s2.x - 4.8, s2.x - 4.6, -0.7], [s2.x + 1.6, s2.x + 1.2, -0.9]].forEach(([x, tx, tz]) => {
    const l = new THREE.SpotLight('#ffd6a8', 38, 8, 0.95, 0.6, 1.5);
    l.position.set(x, FY + 4.75, LZ + 1.2);
    l.target.position.set(tx, FY + 0.4, tz);
    ctx.add(l);
    ctx.add(l.target);
  });

  // ---------- fachada oeste: puerta lateral, aplique y pilastras ----------
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

  // canal de desagüe con rejilla en el umbral
  ctx.add(K.box(15.2, 0.012, 0.24, M.panel, s2.x, FY - 0.004, s2.z + 4.78));
  for (let x = -7.5; x <= 7.5; x += 0.25) ctx.add(K.box(0.03, 0.026, 0.22, M.darkSteel, s2.x + x, FY - 0.003, s2.z + 4.78));

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

  // ---------- animación del capítulo de reutilización ----------
  // Avance u (0..1) dentro de la ventana de CH.reutilizacion, guiado por el scroll (sin bucles ni reloj):
  //   0–0,2  la batería reparada sale del banco por la cinta hasta la estación de carga
  //   0,22–0,6  se carga (su barra se llena) mientras terminan las de las estanterías
  //   0,62–0,82  sigue hasta el banco de comprobación; 0,88  el piloto del comprobador pasa de ámbar a lima
  // Antes del capítulo, estado inicial; después y con movimiento reducido, estado final.
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (v) => v * v * (3 - 2 * v);
  const moveX = (u) => {
    if (u < 0.2) return X0 + (X1 - X0) * smooth(u / 0.2);
    if (u < 0.62) return X1;
    if (u < 0.82) return X1 + (X2 - X1) * smooth((u - 0.62) / 0.2);
    return X2;
  };
  let lastU = -1;
  const apply = (u) => {
    lastU = u;
    setMove(moveX(u));
    setLeds(u);
  };
  apply(0);
  ctx.anim((t, dt, story) => {
    if (!story) return;
    const i = story.index;
    const u = story.reduced || i > CH.reutilizacion ? 1 : i < CH.reutilizacion ? 0 : clamp01(story.local / 0.85);
    if (Math.abs(u - lastU) > 1e-4) apply(u);
  });
}
