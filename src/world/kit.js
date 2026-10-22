import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import * as P from './pbr.js';
import { chunkKeyFor, orderedRuns, consecutiveRuns, mergedBoundingSphere, instancedBoundingSphere, TIE_MARGIN } from './chunks.js';

// Gramática de materiales compartida por todo el diorama.
// `userData.tile` = tamaño en unidades de mundo de una tesela (las UV se proyectan en mundo al fusionar).
function withMaps(mat, maps, tile) {
  Object.assign(mat, maps);
  [mat.map, mat.roughnessMap, mat.normalMap].forEach((t) => t && t.repeat.set(1 / tile, 1 / tile));
  mat.roughness = 1;
  mat.userData.tile = tile;
  return mat;
}

export function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const steel = P.brushed({ seed: 5, base: [158, 162, 166] });
  const darkSteel = P.brushed({ seed: 6, base: [70, 74, 78] });
  const satin = P.micro({ seed: 9, base: [36, 38, 40], rough: [0.44, 0.04], bump: 0.35, tint: 0.025 });
  const rubber = P.micro({ seed: 13, base: [22, 23, 24], rough: [0.85, 0.05], bump: 0.35, tint: 0.03 });

  return {
    concrete: withMaps(std({ color: '#ffffff' }), P.concrete({ seed: 3 }), 6),
    concreteLight: withMaps(std({ color: '#ffffff' }), P.concrete({ seed: 33, base: [172, 166, 155], joints: 1 }), 4),
    plinthConcrete: withMaps(std({ color: '#ffffff' }), P.concrete({ seed: 33, base: [172, 166, 155], joints: 0 }), 4),
    floor: withMaps(std({ color: '#ffffff' }), P.concrete({ seed: 21, base: [196, 189, 175], joints: 2 }), 5),
    rock: withMaps(std({ color: '#ffffff' }), P.rock({ seed: 11 }), 3.5),
    steel: withMaps(std({ color: '#ffffff', metalness: 0.85, envMapIntensity: 2.4 }), steel, 1.6),
    darkSteel: withMaps(std({ color: '#ffffff', metalness: 0.7, envMapIntensity: 1.0 }), darkSteel, 1.6),
    // plástico satinado de armarios y equipos (microtextura muy suave)
    graphite: (() => {
      const m = withMaps(phys({ color: '#ffffff', clearcoat: 0.25, clearcoatRoughness: 0.5 }), satin, 1.2);
      m.normalMap = null;
      return m;
    })(),
    // carcasa de la batería: grafito liso satinado, sin grano (ref-bateria.png)
    casing: phys({ color: '#2a2c2f', roughness: 0.4, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
    graphiteLight: std({ color: '#33373a', roughness: 0.55, metalness: 0.25 }),
    panel: std({ color: '#2a2d30', roughness: 0.5, metalness: 0.2 }),
    rubber: withMaps(std({ color: '#ffffff' }), rubber, 0.8),
    ivory: std({ color: '#cbbea6', roughness: 0.85 }),
    ivoryPanel: std({ color: '#e4dac6', roughness: 0.7 }),
    stoneTop: std({ color: '#cfc8bb', roughness: 0.42 }),
    foliage: std({ color: '#ffffff', roughness: 0.9, vertexColors: true }),
    trunk: std({ color: '#3b2f25', roughness: 1 }),
    wood: std({ color: '#8a6a45', roughness: 0.8 }),
    amberMatte: std({ color: '#c9973f', roughness: 0.5, metalness: 0.15 }),
    paint: phys({ color: '#4b4f53', metalness: 0.55, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 }),
    glass: phys({ color: '#9fb0b2', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, envMapIntensity: 1.4 }),
    darkGlass: phys({ color: '#0f1213', roughness: 0.08, metalness: 0.3, clearcoat: 1 }),
    water: std({ color: '#0a0c0d', roughness: 0.28, metalness: 0.35, envMapIntensity: 0.04 }),
    // la lima solo brilla donde la luz es parte del relato (traza, anillos, pantallas)
    lime: std({ color: '#C2F230', emissive: '#C2F230', emissiveIntensity: 1.1, roughness: 0.5 }),
    limeLine: std({ color: '#b5e02c', emissive: '#C2F230', emissiveIntensity: 0.18, roughness: 0.4 }),
    limeInsert: std({ color: '#93b52a', emissive: '#C2F230', emissiveIntensity: 0.05, roughness: 0.6 }),
    amberGlow: std({ color: '#E5AE50', emissive: '#E5AE50', emissiveIntensity: 1.3 }),
    warmGlow: std({ color: '#ffe4b8', emissive: '#ffcf8f', emissiveIntensity: 1.8 }),
    copper: std({ color: '#b26c3e', roughness: 0.35, metalness: 0.85, flatShading: true }),
    lead: std({ color: '#9da1a5', roughness: 0.4, metalness: 0.8, flatShading: true }),
    shard: std({ color: '#1d1f21', roughness: 0.45, flatShading: true }),
    qr: std({ map: T.qrLabelTexture(5), roughness: 0.4, metalness: 0.4, color: '#d9dadb' }),
    terminal: std({ color: '#b8bcc0', metalness: 0.9, roughness: 0.26, envMapIntensity: 1.8 }),
    batLine: std({ color: '#a9d02b', emissive: '#C2F230', emissiveIntensity: 0.05, roughness: 0.4 }),
    grip: std({ color: '#151617', roughness: 0.75 }),
  };
}

const cache = new Map();
export function geo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// Caja apoyada en y (el origen queda en la base).
export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

// Caja con bisel: los cantos atrapan la luz y dejan de parecer primitivas.
export function rbox(w, h, d, mat, x = 0, y = 0, z = 0, r = Math.min(w, h, d) * 0.12) {
  const m = new THREE.Mesh(geo(`r${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r)), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cyl(rt, rb, h, mat, seg = 16) {
  return new THREE.Mesh(geo(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat);
}

export function pipe(points, r, mat, seg = 48) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.05);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 12), mat);
}

// ---------- Batería (según ref-bateria.png) ----------
// Carcasa grafito lisa, zócalo con asideros, línea lima fina, asa grafito con inserto lima y QR pequeño.
export function makeBattery(M, opts = {}) {
  const g = new THREE.Group();
  g.add(rbox(1.66, 0.15, 0.86, M.casing, 0, 0, 0, 0.02));
  g.add(rbox(1.6, 0.43, 0.8, M.casing, 0, 0.14, 0, 0.025));
  g.add(box(1.604, 0.008, 0.804, M.batLine, 0, 0.564, 0));
  g.add(rbox(1.63, 0.13, 0.83, M.casing, 0, 0.572, 0, 0.03));
  g.add(rbox(1.02, 0.035, 0.55, M.panel, 0, 0.695, 0.02, 0.012));
  [-0.48, 0.48].forEach((x) => g.add(box(0.44, 0.045, 0.02, M.grip, x, 0.05, 0.425)));
  [-0.6, 0.6].forEach((x) => {
    const base = cyl(0.075, 0.08, 0.03, M.panel, 20);
    base.position.set(x, 0.717, -0.21);
    g.add(base);
    const t = cyl(0.05, 0.05, 0.085, M.terminal, 20);
    t.position.set(x, 0.774, -0.21);
    g.add(t);
  });
  // asa: dos tramos grafito a los lados del inserto lima (sin barra debajo del inserto, que asomaba de lejos)
  [-0.4, 0.4].forEach((x) => g.add(rbox(0.1, 0.13, 0.11, M.casing, x, 0.69, 0.02, 0.03)));
  [-0.365, 0.365].forEach((x) => g.add(rbox(0.17, 0.065, 0.12, M.casing, x, 0.8, 0.02, 0.03)));
  g.add(rbox(0.56, 0.07, 0.125, M.limeInsert, 0, 0.8, 0.02, 0.03));
  if (opts.label !== false) {
    const qr = new THREE.Mesh(geo('batQR', () => new THREE.PlaneGeometry(0.095, 0.095)), M.qr);
    qr.position.set(0.66, 0.2, 0.402);
    g.add(qr);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  if (opts.scale) g.scale.setScalar(opts.scale);
  return g;
}

// Une las piezas de un grupo en una malla por material (para objetos animados).
export function compact(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const by = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).premultiply(new THREE.Matrix4().makeScale(group.scale.x, group.scale.y, group.scale.z)));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
  });
  const out = new THREE.Group();
  by.forEach((list, mat) => {
    const m = new THREE.Mesh(mergeGeometries(list), mat);
    m.castShadow = true;
    out.add(m);
  });
  return out;
}

// Muchas baterías baratas: piezas instanciadas con la misma silueta.
export function batteryInstances(M, transforms) {
  const group = new THREE.Group();
  const n = transforms.length;
  const parts = [
    [geo('biBody', () => new RoundedBoxGeometry(1.6, 0.7, 0.8, 1, 0.025)), M.casing, 0, 0.35, 0],
    [geo('biLine', () => new THREE.BoxGeometry(1.604, 0.016, 0.804)), M.batLine, 0, 0.56, 0],
    [geo('biTerms', () => mergeGeometries([-0.6, 0.6].map((x) => new THREE.CylinderGeometry(0.05, 0.05, 0.085, 8).translate(x, 0, -0.21)))), M.terminal, 0, 0.7425, 0],
    [geo('biHandle', () => mergeGeometries([...[-0.365, 0.365].map((x) => new THREE.BoxGeometry(0.17, 0.065, 0.12).toNonIndexed().translate(x, 0, 0)), ...[-0.4, 0.4].map((x) => new THREE.BoxGeometry(0.1, 0.13, 0.11).toNonIndexed().translate(x, -0.0775, 0))])), M.casing, 0, 0.8325, 0.02],
    [geo('biInsert', () => new THREE.BoxGeometry(0.56, 0.07, 0.125)), M.limeInsert, 0, 0.835, 0.02],
    [geo('biQR', () => new THREE.PlaneGeometry(0.095, 0.095)), M.qr, 0.66, 0.2, 0.402],
  ];
  const o = new THREE.Object3D();
  const child = new THREE.Object3D();
  o.add(child);
  parts.forEach(([g, mat, px, py, pz]) => {
    const im = new THREE.InstancedMesh(g, mat, n);
    transforms.forEach((t, i) => {
      o.position.set(t.x, t.y, t.z);
      o.rotation.set(0, t.r || 0, 0);
      o.scale.setScalar(t.s || 1);
      child.position.set(px, py, pz);
      o.updateMatrixWorld(true);
      im.setMatrixAt(i, child.matrixWorld);
    });
    im.castShadow = mat === M.casing;
    im.receiveShadow = true;
    group.add(im);
  });
  return group;
}

// ---------- Edificio abierto en sección ----------
export function makeCutaway(M, { w, d, h, glassFront = false, roofDepth = 0.55, light = 17 }) {
  const g = new THREE.Group();
  const t = 0.35;
  // zócalo 1 cm bajo la tapa de la isla: a ras de ella, las dos caras coplanares parpadeaban
  g.add(box(w + 1.2, 0.5, d + 1.2, M.concreteLight, 0, -0.51, 0));
  g.add(box(w, 0.06, d, M.floor, 0, 0, 0));
  // muros con zócalo oscuro y paneles verticales con junta
  g.add(box(w, h, t, M.ivory, 0, 0, -d / 2));
  g.add(box(t, h, d, M.ivory, -w / 2, 0, 0));
  g.add(box(t, h * 0.42, d * 0.55, M.ivory, w / 2, 0, -d * 0.225));
  g.add(box(w, 0.35, t + 0.04, M.panel, 0, 0, -d / 2));
  g.add(box(t + 0.04, 0.35, d, M.panel, -w / 2, 0, 0));
  for (let x = -w / 2 + 2; x < w / 2; x += 2) g.add(box(0.04, h - 0.4, 0.02, M.graphiteLight, x, 0.35, -d / 2 + t / 2 + 0.01));
  for (let z = -d / 2 + 2; z < d / 2; z += 2) g.add(box(0.02, h - 0.4, 0.04, M.graphiteLight, -w / 2 + t / 2 + 0.01, 0.35, z));
  // techo parcial con canto y viga
  const roofD = d * roofDepth;
  g.add(rbox(w + 0.6, 0.35, roofD, M.panel, 0, h, -d / 2 + roofD / 2 - 0.2, 0.06));
  g.add(box(w + 0.8, 0.12, 0.3, M.darkSteel, 0, h + 0.35, -d / 2 + roofD - 0.2));
  for (let i = 0; i < 3; i++) g.add(box(w * 0.7, 0.06, 0.16, M.warmGlow, 0, h - 0.08, -d / 2 + 0.8 + i * (roofD / 3)));
  // pilares 2 cm más altos que los muros: sus tapas no coinciden con la coronación del muro
  [-w / 2, w / 2].forEach((x) => g.add(rbox(0.32, h + 0.02, 0.32, M.darkSteel, x, 0, d / 2, 0.04)));
  if (glassFront) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
    glass.position.set(0, h / 2, d / 2);
    g.add(glass);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 4) g.add(box(0.08, h, 0.08, M.darkSteel, x, 0, d / 2));
  }
  // tira de luz cálida en la pared del fondo
  g.add(box(w * 0.86, 0.06, 0.08, M.warmGlow, 0, h * 0.64, -d / 2 + 0.22));
  const spot = new THREE.SpotLight('#ffbd6e', light * 2.2, Math.max(w, d) * 2, 1.05, 0.7, 1.4);
  spot.position.set(0, h - 0.3, 0.3);
  spot.target.position.set(0, 0, -d * 0.15);
  g.add(spot, spot.target);
  return g;
}

// ---------- Coche y elevador de dos columnas ----------
export function makeCar(M, { hoodOpen = false, paint } = {}) {
  const g = new THREE.Group();
  const body = paint || M.paint;
  g.add(rbox(4.3, 0.62, 1.84, body, 0, 0.42, 0, 0.26));
  g.add(rbox(2.5, 0.6, 1.64, body, -0.35, 0.98, 0, 0.26));
  g.add(rbox(2.56, 0.44, 1.68, M.darkGlass, -0.35, 1.06, 0, 0.18));
  // capó: abierto en el taller
  const hood = new THREE.Group();
  hood.add(rbox(1.45, 0.06, 1.7, body, 0.72, 0, 0, 0.03));
  hood.position.set(0.95, 1.04, 0);
  if (hoodOpen) hood.rotation.z = 0.75;
  g.add(hood);
  if (hoodOpen) g.add(rbox(1.2, 0.3, 1.4, M.panel, 1.55, 0.72, 0, 0.05));
  // faros, piloto, parrilla y retrovisores
  g.add(box(0.05, 0.07, 1.4, M.warmGlow, 2.16, 0.82, 0));
  g.add(box(0.05, 0.06, 1.5, M.amberGlow, -2.16, 0.86, 0));
  g.add(box(0.06, 0.2, 1.1, M.darkGlass, 2.15, 0.5, 0));
  [0.9, -0.9].forEach((z) => g.add(rbox(0.16, 0.1, 0.22, body, 0.55, 1.12, z * 0.98, 0.03)));
  // ruedas con llanta y radios
  [[1.35, 0.86], [1.35, -0.86], [-1.35, 0.86], [-1.35, -0.86]].forEach(([x, z]) => {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(geo('tire', () => new THREE.TorusGeometry(0.31, 0.13, 12, 28)), M.rubber));
    const rim = cyl(0.25, 0.25, 0.2, M.steel, 24);
    rim.rotation.x = Math.PI / 2;
    w.add(rim);
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(geo('spoke', () => new THREE.BoxGeometry(0.05, 0.4, 0.03)), M.darkSteel);
      s.position.z = Math.sign(z) * 0.11;
      s.rotation.z = (k / 5) * Math.PI;
      w.add(s);
    }
    w.position.set(x, 0.44, z);
    g.add(w);
  });
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

export function makeLift(M, car) {
  const g = new THREE.Group();
  [-1.55, 1.55].forEach((z) => {
    g.add(box(0.9, 0.08, 0.8, M.darkSteel, 0, 0, z));
    g.add(rbox(0.42, 3.9, 0.42, M.graphite, 0, 0.08, z, 0.04));
    g.add(box(0.12, 3.6, 0.06, M.amberMatte, 0, 0.2, z - Math.sign(z) * 0.24));
    g.add(rbox(0.55, 0.5, 0.55, M.amberMatte, 0, 1.6, z, 0.05));
    // brazos que llegan bajo los puntos de apoyo
    [-1.3, 1.3].forEach((x) => {
      g.add(box(Math.abs(x) + 0.1, 0.1, 0.16, M.amberMatte, x / 2, 1.7, z * 0.72));
      const pad = cyl(0.12, 0.12, 0.08, M.rubber, 14);
      pad.position.set(x, 1.84, z * 0.6);
      g.add(pad);
    });
  });
  g.add(box(0.36, 0.25, 3.5, M.graphite, 0, 3.95, 0));
  g.add(box(0.06, 0.06, 3.2, M.amberGlow, 0.2, 3.9, 0));
  car.position.set(0, 1.46, 0);
  g.add(car);
  return g;
}

// ---------- Mobiliario ----------
export function cabinet(M, { w = 1.2, h = 1.1, d = 0.6, drawers = 4, mat, top } = {}) {
  const g = new THREE.Group();
  g.add(rbox(w, h, d, mat || M.graphite, 0, 0.1, 0, 0.03));
  const gap = 0.025;
  const dh = (h - 0.12) / drawers;
  for (let i = 0; i < drawers; i++) {
    const y = 0.16 + i * dh;
    g.add(rbox(w - 0.08, dh - gap, 0.03, M.panel, 0, y, d / 2 + 0.01, 0.01));
    g.add(box(w * 0.5, 0.025, 0.035, M.steel, 0, y + dh - 0.1, d / 2 + 0.035));
  }
  [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]].forEach(([x, z]) => {
    const c = cyl(0.045, 0.045, 0.05, M.rubber, 10);
    c.rotation.x = Math.PI / 2;
    c.position.set(x, 0.05, z);
    g.add(c);
  });
  if (top) g.add(box(w + 0.06, 0.06, d + 0.06, top, 0, h + 0.1, 0));
  return g;
}

export function pegboard(M, w, h) {
  const g = new THREE.Group();
  g.add(box(w, h, 0.05, M.ivoryPanel, 0, 0, 0));
  // herramientas colgadas: llaves, destornilladores y cables enrollados
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 0.35 + i * ((w - 0.7) / 8);
    const len = 0.35 + (i % 3) * 0.1;
    g.add(box(0.05, len, 0.03, i % 4 === 0 ? M.amberMatte : M.steel, x, h - 0.25 - len, 0.05));
    g.add(box(0.1, 0.06, 0.03, M.steel, x, h - 0.28, 0.05));
  }
  [w * 0.32, w * 0.42].forEach((x) => {
    const coil = new THREE.Mesh(geo('coil', () => new THREE.TorusGeometry(0.16, 0.025, 6, 24)), M.rubber);
    coil.position.set(x, h * 0.45, 0.06);
    g.add(coil);
  });
  return g;
}

export function shelf(M, { w = 2.4, h = 2.4, d = 0.6, levels = 3 } = {}) {
  const g = new THREE.Group();
  [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].forEach(([x, z]) => g.add(box(0.06, h, 0.06, M.darkSteel, x, 0, z)));
  for (let i = 0; i < levels; i++) g.add(box(w, 0.05, d, M.darkSteel, 0, 0.15 + i * (h / levels), 0));
  return g;
}

export function screen(map, w, h, intensity = 1.0) {
  const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: intensity, roughness: 0.35 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

// Pantalla con marco metálico biselado; el origen queda en el centro de la pantalla.
export function framedScreen(M, map, w, h, intensity = 0.95) {
  const g = new THREE.Group();
  g.add(rbox(w + 0.16, h + 0.16, 0.12, M.darkSteel, 0, -(h + 0.16) / 2, 0, 0.03));
  const s = screen(map, w, h, intensity);
  s.position.set(0, 0, 0.065);
  g.add(s);
  return g;
}

// ---------- Vegetación, rocas y balizas (instanciadas) ----------
// Ruido de valor 3D determinista para deformar copas y rocas.
function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise3(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const sm = (t) => t * t * (3 - 2 * t);
  const u = sm(x - xi);
  const v = sm(y - yi);
  const w = sm(z - zi);
  const h = (i, j, k) => hash3(xi + i, yi + j, zi + k, seed);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
}

// Copa o mata: uno o dos grumos de núcleo que llenan el volumen y muchos grumos pequeños alrededor
// (silueta irregular a bajo coste). Normales suavizadas hacia el centro y moteadas, color por vértice
// con oclusión en el interior y luz en las puntas. Las UV de cada grumo caen en la mitad superior del
// atlas de hojas: el recorte alfa rompe la silueta y abre huecos entre hojas sin añadir triángulos.
// `small`: grumos menudos en la superficie; `under`: grumos bajos junto al tronco (los árboles dejan de
// ser piruletas sin mover la copa, cuya envolvente usan otras estaciones).
function foliageGeometry(seed, { core = [0, 0, 0], lumps, spread, r, lift = 0, detail = 0, hue = 0.21, squash = 1, small = 0, under = 0 }) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = [];
  const hues = [];
  const v = new THREE.Vector3();
  const nl = new THREE.Vector3();
  const nc = new THREE.Vector3();
  const centre = new THREE.Vector3(0, lift + spread[1] * 0.45, 0);
  const specs = [];
  const cores = [];
  for (let i = 0; i < core[0]; i++) specs.push({ rad: core[1] + rnd() * (core[2] - core[1]), e: 0.25 * i, y: spread[1] * (0.3 + 0.3 * i) });
  for (let i = 0; i < lumps; i++) specs.push({ rad: r[0] + rnd() * (r[1] - r[0]), e: 0.5 + rnd() * 0.5, y: rnd() * spread[1] * 1.1 });
  // (dentro de la envolvente: ningún grumo menudo queda suelto en el aire)
  for (let i = 0; i < small; i++) specs.push({ rad: 0.08 + rnd() * 0.07, e: 0.7 + rnd() * 0.25, y: (0.1 + rnd() * 0.85) * spread[1] * 1.1 });
  for (let i = 0; i < under; i++) specs.push({ rad: r[0] * (0.75 + rnd() * 0.45), e: 0.3 + rnd() * 0.35, y: -lift * (0.14 + rnd() * 0.4) });
  for (let i = 0; i < specs.length; i++) {
    const { rad, e, y } = specs[i];
    const a = rnd() * Math.PI * 2;
    const c = new THREE.Vector3(Math.cos(a) * spread[0] * e, lift + y, Math.sin(a) * spread[2] * e);
    if (i < core[0]) cores.push({ c: c.clone(), rad });
    else if (cores.length) {
      let best = cores[0];
      for (const k of cores) if (k.c.distanceTo(c) - k.rad < best.c.distanceTo(c) - best.rad) best = k;
      const reach = best.rad + rad * 0.35;
      const d = best.c.distanceTo(c);
      if (d > reach) c.sub(best.c).multiplyScalar(reach / d).add(best.c);
    }
    const g = new THREE.IcosahedronGeometry(rad, detail);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 0.505 + uv.getY(k) * 0.49);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const hl = hue + (rnd() - 0.5) * 0.05;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      v.multiplyScalar(1 + (noise3(v.x * 4.5 + i * 3.1, v.y * 4.5, v.z * 4.5, seed) - 0.5) * 0.55);
      nl.copy(v).normalize();
      v.add(c);
      v.y = centre.y + (v.y - centre.y) * squash;
      nc.copy(v).sub(centre).normalize();
      nl.multiplyScalar(0.5).addScaledVector(nc, 0.5);
      // normales moteadas: el sombreado se rompe en manchas, como hojas en vez de un globo liso
      nl.x += (hash3(Math.round(v.x * 97), Math.round(v.y * 97), Math.round(v.z * 97), seed) - 0.5) * 0.9;
      nl.y += (hash3(Math.round(v.y * 89), Math.round(v.z * 89), Math.round(v.x * 89), seed + 1) - 0.5) * 0.9;
      nl.z += (hash3(Math.round(v.z * 83), Math.round(v.x * 83), Math.round(v.y * 83), seed + 2) - 0.5) * 0.9;
      nl.normalize();
      pos.setXYZ(k, v.x, v.y, v.z);
      nor.setXYZ(k, nl.x, nl.y, nl.z);
      hues.push(hl);
    }
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  const pos = merged.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const reach = Math.max(spread[0], spread[2]) + Math.max(r[1], core[2]);
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const up = (v.y - bb.min.y) / Math.max(1e-3, bb.max.y - bb.min.y);
    const out = Math.min(1, Math.hypot(v.x - centre.x, (v.y - centre.y) * 1.4, v.z - centre.z) / reach);
    const tip = noise3(v.x * 9, v.y * 9, v.z * 9, seed + 1);
    // oliva oscuro de las referencias: saturación contenida, puntas algo más claras
    c.setHSL(hues[k] + tip * 0.025, 0.24 + tip * 0.1, 0.07 + up * 0.09 + out * 0.05 + tip * 0.03, THREE.SRGBColorSpace);
    col.set([c.r, c.g, c.b], k * 3);
  }
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return merged;
}

// Mata baja: tarjetas cruzadas en abanico con el ramillete de la mitad inferior del atlas; las normales
// se curvan hacia una cúpula para que se sombree como un volumen y no como planos.
function tuftGeometry(seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  const c = new THREE.Color();
  const nv = new THREE.Vector3();
  const N = 5;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI + (rnd() - 0.5) * 0.4;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const w0 = 0.1 + rnd() * 0.05;
    const w1 = 0.3 + rnd() * 0.1;
    const h = 0.3 + rnd() * 0.14;
    const lean = (rnd() - 0.5) * 0.3;
    const base = pos.length / 3;
    [[-w0, 0], [w0, 0], [-w1, h], [w1, h]].forEach(([x, y]) => {
      const off = (y / h) * lean * h;
      const px = ca * x - sa * off;
      const pz = sa * x + ca * off;
      pos.push(px, y, pz);
      nv.set(px, y + 0.22, pz).normalize();
      nor.push(nv.x, nv.y, nv.z);
      uv.push(0.5 + x / (2 * w1), 0.01 + (y / h) * 0.48);
      c.setHSL(0.21 + rnd() * 0.04, 0.36, 0.05 + (y / h) * 0.12, THREE.SRGBColorSpace);
      col.push(c.r, c.g, c.b);
    });
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// Atlas de hojas 512 × 512 (DataTexture: conserva el color bajo el alfa nulo y no oscurece los bordes).
// Mitad superior: tapiz de hojas menudas (3-6 cm) repetible en horizontal para los grumos. Mitad inferior:
// ramillete en abanico para las matas. Cobertura ≈ 80 %: a media distancia las copas son masas densas
// (sin tramado) y de cerca se abren huecos entre hojas.
function leafAtlas() {
  const N = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const hv = document.createElement('canvas');
  hv.width = hv.height = N;
  const gh = hv.getContext('2d');
  gh.fillStyle = '#000';
  gh.fillRect(0, 0, N, N);
  let s = 77;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // relieve de cada hoja: cúpula radial pre-dibujada una vez y estampada girada (mucho más rápido que un
  // degradado por hoja)
  const dome = document.createElement('canvas');
  dome.width = dome.height = 32;
  const gd = dome.getContext('2d');
  const grd = gd.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.92, 'rgba(90,90,90,1)');
  grd.addColorStop(1, 'rgba(90,90,90,0)');
  gd.fillStyle = grd;
  gd.fillRect(0, 0, 32, 32);
  // `wrap`: ancho de la tesela en la que la hoja se repite al cruzar el borde (0 = sin repetición)
  const leaf = (x, y, len, wid, ang, tone, warm, wrap) => {
    const copies = wrap && x < len + 2 ? [0, wrap] : wrap && x > wrap - len - 2 ? [-wrap, 0] : [0];
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    g.fillStyle = `rgb(${Math.round(tone * (0.94 + warm * 0.1))},${tone},${Math.round(tone * (0.86 - warm * 0.1))})`;
    for (const dx of copies) {
      g.setTransform(ca, sa, -sa, ca, x + dx, y);
      g.beginPath();
      g.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
      g.fill();
      gh.setTransform(ca, sa, -sa, ca, x + dx, y);
      gh.drawImage(dome, -len, -wid, len * 2, wid * 2);
    }
  };
  // tapiz: una tesela de 256 × 128 repetible en horizontal, copiada 2 × 2 (cuatro veces menos trazos)
  const T = N / 2;
  g.save();
  g.beginPath();
  g.rect(0, 0, T, T / 2);
  g.clip();
  gh.save();
  gh.beginPath();
  gh.rect(0, 0, T, T / 2);
  gh.clip();
  for (let i = 0; i < 950; i++) leaf(rnd() * T, rnd() * (T / 2), 4 + rnd() * 3.2, 2.2 + rnd() * 1.6, rnd() * Math.PI, 196 + Math.floor(rnd() * 59), rnd(), T);
  g.restore();
  gh.restore();
  [[T, 0], [0, T / 2], [T, T / 2]].forEach(([dx, dy]) => {
    g.drawImage(cv, 0, 0, T, T / 2, dx, dy, T, T / 2);
    gh.drawImage(hv, 0, 0, T, T / 2, dx, dy, T, T / 2);
  });
  // ramillete: tallos que salen del pie de la tarjeta; hojas redondeadas, mayores a media altura, y una
  // base densa para que la mata no se lea como una roseta
  for (let k = 0; k < 13; k++) {
    const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.1;
    const reach = 150 + rnd() * 90;
    for (let i = 0; i < 26; i++) {
      const t = 0.08 + (i / 26) * 0.92;
      const x = 256 + Math.cos(ang) * reach * t;
      const y = 506 + Math.sin(ang) * reach * t;
      const size = 1 - Math.abs(t - 0.5) * 0.9;
      leaf(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 14, (7 + rnd() * 5) * (0.6 + size * 0.6), (4 + rnd() * 2.5) * (0.6 + size * 0.6), ang + (rnd() - 0.5) * 1.6, 190 + Math.floor(rnd() * 65), rnd(), false);
    }
  }
  for (let i = 0; i < 160; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
    const d = rnd() * 120;
    leaf(256 + Math.cos(a) * d * 1.3, 500 + Math.sin(a) * d * 0.9, 6 + rnd() * 4, 3.5 + rnd() * 2, rnd() * Math.PI, 175 + Math.floor(rnd() * 60), rnd(), false);
  }
  const px = g.getImageData(0, 0, N, N).data;
  const hp = gh.getImageData(0, 0, N, N).data;
  // fila 0 de la DataTexture = v 0 (abajo): se invierte el lienzo
  const map = new Uint8Array(N * N * 4);
  const hgt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const si = ((N - 1 - y) * N + x) * 4;
      const di = (y * N + x) * 4;
      const a = px[si + 3];
      map[di] = a ? px[si] : 150;
      map[di + 1] = a ? px[si + 1] : 150;
      map[di + 2] = a ? px[si + 2] : 132;
      map[di + 3] = a;
      hgt[y * N + x] = hp[si] / 255;
    }
  }
  const nrm = new Uint8Array(N * N * 4);
  const H = (x, y) => hgt[Math.min(N - 1, Math.max(0, y)) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2;
      const dy = (H(x, y + 1) - H(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      nrm[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      nrm[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      nrm[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
    }
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(map, true), normalMap: tex(nrm, false) };
}

// Material de hojas compartido por toda la vegetación: recorte alfa con alpha to coverage (el compositor
// renderiza con MSAA) y doble cara para que por los huecos se vea el interior de la copa.
function leafMaterial() {
  return geo('mat:leaf', () => {
    const { map, normalMap } = leafAtlas();
    return new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.8,
      alphaTest: 0.38,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
    });
  });
}

// Tronco fino con dos ramas que se pierden dentro de la copa.
function trunkGeometry() {
  return mergeGeometries([
    new THREE.CylinderGeometry(0.035, 0.075, 1.35, 6, 1, true).translate(0, 0.675, 0),
    new THREE.CylinderGeometry(0.016, 0.03, 0.55, 5, 1, true).translate(0, 0.27, 0).rotateZ(0.7).translate(0.02, 0.72, 0),
    new THREE.CylinderGeometry(0.015, 0.028, 0.5, 5, 1, true).translate(0, 0.25, 0).rotateZ(-0.6).rotateY(2.1).translate(-0.01, 0.9, 0.01),
  ]);
}

// ---------- Mallas partidas por fragmento ----------
// Cada malla que sale de partir una fusión o una InstancedMesh por fragmento ordena con la esfera del original
// (three la coloca en el puesto del original y, entre las del mismo original, por orden de creación; ver
// chunks.js) pero se recorta con la suya: three llama a `intersectsFrustum` (pase principal y sombra) y un
// tramo fuera del encuadre no tiene ningún fragmento, así que recortarlo no cambia ningún píxel.
const _cullSphere = new THREE.Sphere();
function ownCulling(obj, own) {
  obj.intersectsFrustum = function intersectsFrustum(frustum) {
    return frustum.intersectsSphere(_cullSphere.copy(own).applyMatrix4(this.matrixWorld));
  };
}

// ---------- Instanciado por fragmento ----------
// En lugar de una InstancedMesh para todo el mundo, una por tramo de fragmento: las instancias van en su orden
// original exacto (cada tramo agrupa instancias consecutivas del mismo fragmento: chunks.js · consecutiveRuns) y
// cada malla ordena con la esfera de la que sería la InstancedMesh única. Agrupar instancias no consecutivas que
// no se tocan sería exacto en teoría para las opacas, pero con las rocas cambiaba en la GPU el último bit de la
// mezcla aditiva de algún charco de luz cercano (1/255 en un píxel); en las transparentes el orden de mezcla
// importa además en todo lo que se solapa en pantalla. Las matrices se guardan en Float32Array, como las de
// InstancedMesh, para que esferas e instancias usen exactamente los mismos valores.

// Tramos de instancias: índices de `items` en tramos de instancias consecutivas del mismo fragmento.
function instanceRuns(items, keyOf) {
  return consecutiveRuns(items.map((_, k) => k), (k) => keyOf(items[k]));
}

// Una InstancedMesh por tramo con las matrices de sus instancias, que ordena con la esfera `sphere` de la malla
// única y se recorta con la suya; `decorate(im, j, k)` completa la instancia j (la k del original), p. ej. con su
// color.
function runMeshes(geom, mat, runs, matrices, sphere, decorate) {
  return runs.map(({ chunk, items }) => {
    const im = new THREE.InstancedMesh(geom, mat, items.length);
    items.forEach(([k], j) => {
      im.instanceMatrix.array.set(matrices.subarray(k * 16, k * 16 + 16), j * 16);
      if (decorate) decorate(im, j, k);
    });
    im.computeBoundingSphere();
    ownCulling(im, im.boundingSphere.clone());
    im.boundingSphere = sphere.clone();
    im.userData.chunk = chunk;
    return im;
  });
}

// Árboles pequeños, arbustos y matas. Cada punto: { x, y (base), z, s, kind: 'tree' | 'shrub' | 'low',
// r? (giro), lean? (inclinación hacia +z local), sx?, sz? (estirado en x/z local: setos a lo largo de un
// canto) }; `shrub: true` equivale a kind 'shrub'. Todas las copas comparten el material de hojas.
export function scatterTrees(M, points) {
  const g = new THREE.Group();
  const leaf = leafMaterial();
  const kindOf = (p) => p.kind || (p.shrub ? 'shrub' : 'tree');
  const list = (k) => points.filter((p) => kindOf(p) === k).map((p, i) => [p, i]);
  const o = new THREE.Object3D();
  o.rotation.order = 'YXZ';
  const tint = new THREE.Color();
  // mallas instanciadas por fragmento (la isla de cada planta); el giro por defecto y el tono dependen del
  // índice `i` de la planta en su lista, que el reparto conserva
  const batch = (geom, mat, items, { shadow = true, colour = true, stretch = true } = {}) => {
    if (!items.length) return;
    const matrices = new Float32Array(items.length * 16);
    items.forEach(([p, i], k) => {
      const sc = p.s || 1;
      o.position.set(p.x, p.y, p.z);
      o.rotation.set(p.lean || 0, p.r ?? i * 2.39, 0);
      o.scale.set(sc * (stretch ? p.sx || 1 : 1), sc, sc * (stretch ? p.sz || 1 : 1));
      o.updateMatrix();
      o.matrix.toArray(matrices, k * 16);
    });
    const runs = instanceRuns(items, ([p]) => chunkKeyFor(p.x, p.z));
    const paint = (im, j, k) => {
      const i = items[k][1];
      const h = ((i * 2654435761) >>> 0) / 4294967296;
      const w = ((i * 40503) % 97) / 97;
      const b = 0.75 + h * 0.3;
      tint.setRGB(b * (0.97 + 0.08 * w), b, b * (0.9 - 0.08 * w));
      im.setColorAt(j, tint);
    };
    runMeshes(geom, mat, runs, matrices, instancedBoundingSphere(geom, matrices, items.length), colour ? paint : null).forEach((im) => {
      im.castShadow = shadow;
      im.receiveShadow = true;
      g.add(im);
    });
  };
  const trees = list('tree');
  const shrubs = list('shrub');
  batch(geo('trunkV2', trunkGeometry), M.trunk, trees, { colour: false, stretch: false });
  batch(geo('crownV3A', () => foliageGeometry(7, { core: [2, 0.36, 0.44], lumps: 9, small: 4, under: 3, spread: [0.6, 0.78, 0.52], r: [0.16, 0.3], lift: 0.95, hue: 0.22 })), leaf, trees.filter(([, i]) => i % 2 === 0));
  batch(geo('crownV3B', () => foliageGeometry(19, { core: [2, 0.34, 0.42], lumps: 8, small: 4, under: 3, spread: [0.52, 0.84, 0.58], r: [0.16, 0.3], lift: 1.0, hue: 0.24 })), leaf, trees.filter(([, i]) => i % 2 === 1));
  batch(geo('shrubV3A', () => foliageGeometry(31, { core: [1, 0.3, 0.36], lumps: 5, small: 3, spread: [0.46, 0.24, 0.4], r: [0.14, 0.27], lift: 0.18, hue: 0.21 })), leaf, shrubs.filter(([, i]) => i % 3 !== 2));
  batch(geo('shrubV3B', () => foliageGeometry(43, { core: [1, 0.27, 0.32], lumps: 3, small: 3, spread: [0.34, 0.18, 0.3], r: [0.13, 0.25], lift: 0.18, hue: 0.23 })), leaf, shrubs.filter(([, i]) => i % 3 === 2));
  batch(geo('tuftV3', () => tuftGeometry(57)), leaf, list('low'), { shadow: false });
  g.userData.leaf = leaf;
  return g;
}

// Bloque de roca: volumen irregular recortado por planos de fractura (techo y base casi horizontales como
// los estratos, caras laterales vivas). La geometría no está indexada: el sombreado queda facetado.
function rockGeometry(seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  let s = Math.round(seed * 1000) + 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // bloque macizo: techo y base cerca del centro y caras laterales que cortan el volumen en un prisma
  const cuts = [[0, 1, 0, 0.62 + rnd() * 0.16], [0, -1, 0, 0.56 + rnd() * 0.14]];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.9;
    cuts.push([Math.cos(a), (rnd() - 0.5) * 0.5, Math.sin(a), 0.62 + rnd() * 0.18]);
  }
  const planes = cuts.map(([x, y, z, d]) => [new THREE.Vector3(x, y, z).normalize(), d]);
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const n1 = noise3(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4, 3) - 0.5;
    v.multiplyScalar(1 + n1 * 0.35);
    planes.forEach(([n, d]) => {
      const e = v.dot(n) - d;
      if (e > 0) v.addScaledVector(n, -e);
    });
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // UV de banda horizontal: los estratos de la textura cruzan el bloque
  const uv = g.attributes.uv;
  for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) + pos.getZ(k)) * 0.18 + seed * 0.37, pos.getY(k) * 0.32 + seed * 0.11);
  return g;
}

// Rocas instanciadas. Cada punto: { x, y, z, s, v? (0 y 1 grandes, 2 pequeña), r?, sy? (altura relativa) }.
// `mat`: material propio (los bordes usan la roca estratificada); por defecto, la roca en gris carbón.
export function scatterRocks(M, points, { mat } = {}) {
  const g = new THREE.Group();
  const rockMat = mat || geo('mat:boulder', () => {
    const m = M.rock.clone();
    m.color.setRGB(1.25, 1.38, 1.62);
    m.flatShading = true;
    return m;
  });
  const geoms = [geo('rockV3A', () => rockGeometry(1.3, 1)), geo('rockV3B', () => rockGeometry(4.1, 1)), geo('rockV3C', () => rockGeometry(7.7, 1))];
  const lists = [[], [], []];
  points.forEach((p, i) => lists[p.v ?? i % 3].push([p, i]));
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  // mallas instanciadas por variante y fragmento; giro, escala y tono siguen el índice original `i`
  lists.forEach((list, k) => {
    if (!list.length) return;
    const matrices = new Float32Array(list.length * 16);
    list.forEach(([p, i], q) => {
      o.position.set(p.x, p.y, p.z);
      o.rotation.set((i % 5) * 0.06 - 0.12, p.r ?? i * 2.3, (i % 3) * 0.05 - 0.05);
      o.scale.set(p.s * (0.95 + (i % 3) * 0.18), p.s * (p.sy ?? (0.9 + (i % 4) * 0.1)), p.s * (0.9 + (i % 2) * 0.2));
      o.updateMatrix();
      o.matrix.toArray(matrices, q * 16);
    });
    const runs = instanceRuns(list, ([p]) => chunkKeyFor(p.x, p.z));
    const paint = (m, j, q) => {
      const i = list[q][1];
      const t = 0.78 + (i % 6) * 0.05;
      c.setRGB(t * 1.02, t, t * 0.97);
      m.setColorAt(j, c);
    };
    runMeshes(geoms[k], rockMat, runs, matrices, instancedBoundingSphere(geoms[k], matrices, list.length), paint).forEach((m) => {
      m.receiveShadow = true;
      m.castShadow = true;
      g.add(m);
    });
  });
  return g;
}

// Balizas cuadradas de grafito (placa de anclaje, fuste, difusor cálido enmarcado y tapa) con su charco
// de luz simulado en el suelo, sin coste de luces reales (ref-borde-isla-noche.png).
// Cada punto: { x, y (suelo), z, r? (giro), ox?, oz? (desplazamiento del charco), fy? (cota del charco),
// pool? (diámetro), nrm? (normal del suelo bajo el charco, para tableros en pendiente) }.
export function scatterLamps(M, points) {
  const g = new THREE.Group();
  const body = geo('bollardV2', () => {
    const parts = [
      new THREE.BoxGeometry(0.19, 0.03, 0.19).translate(0, 0.015, 0),
      new THREE.BoxGeometry(0.13, 0.36, 0.13).translate(0, 0.21, 0),
      new THREE.BoxGeometry(0.165, 0.04, 0.165).translate(0, 0.59, 0),
    ];
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([x, z]) => parts.push(new THREE.BoxGeometry(0.022, 0.18, 0.022).translate(x * 0.054, 0.48, z * 0.054)));
    return mergeGeometries(parts);
  });
  const lens = geo('bollardLensV2', () => new THREE.BoxGeometry(0.112, 0.18, 0.112).translate(0, 0.48, 0));
  // el charco queda bajo el canto de la placa de anclaje (la placa lo tapa) y se adelanta en profundidad
  // para no parpadear con el suelo
  const poolMat = new THREE.MeshBasicMaterial({
    map: P.radial('rgba(255,190,110,0.5)', 'rgba(255,170,90,0)'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const poolGeo = geo('poolV2', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const o = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const nv = new THREE.Vector3();
  const n = points.length;
  const postAt = new Float32Array(n * 16);
  const poolAt = new Float32Array(n * 16);
  points.forEach((p, i) => {
    o.position.set(p.x, p.y, p.z);
    o.quaternion.setFromAxisAngle(up, p.r || 0);
    o.scale.setScalar(1);
    o.updateMatrix();
    o.matrix.toArray(postAt, i * 16);
    o.position.set(p.x + (p.ox || 0), (p.fy ?? p.y) + 0.006, p.z + (p.oz || 0));
    if (p.nrm) o.quaternion.setFromUnitVectors(up, nv.set(p.nrm.x, p.nrm.y, p.nrm.z).normalize());
    else o.quaternion.identity();
    o.scale.set(p.pool || 2.3, 1, p.pool || 2.3);
    o.updateMatrix();
    o.matrix.toArray(poolAt, i * 16);
  });
  // fuste, difusor y charco: mallas instanciadas por fragmento (la isla de cada baliza), con los mismos tramos
  // para las tres piezas; como el charco es transparente (mezcla aditiva), los tramos conservan el orden exacto
  // de las balizas. En el grupo van por pieza, como antes: todos los fustes, después los difusores y al final
  // los charcos
  const runs = instanceRuns(points, (p) => chunkKeyFor(p.x, p.z));
  const posts = runMeshes(body, M.graphite, runs, postAt, instancedBoundingSphere(body, postAt, n));
  const glows = runMeshes(lens, M.warmGlow, runs, postAt, instancedBoundingSphere(lens, postAt, n));
  const pools = runMeshes(poolGeo, poolMat, runs, poolAt, instancedBoundingSphere(poolGeo, poolAt, n));
  posts.forEach((m) => (m.castShadow = true));
  pools.forEach((m) => (m.renderOrder = 2));
  if (n) g.add(...posts, ...glows, ...pools);
  return g;
}

// Sombras de contacto: manchas suaves bajo los objetos apoyados. Devuelve un grupo con una malla instanciada
// por tramo de fragmento (la isla de cada mancha).
export function contactShadows(items) {
  // casi a ras del suelo (4 mm) y con desfase de profundidad: oscurece el suelo sin cortar tablas, chapas ni
  // alfombrillas que asoman a 1–2 cm (a 2 cm se cruzaba con ellas y parpadeaba)
  const mat = new THREE.MeshBasicMaterial({ map: P.radial('rgba(8,8,8,0.62)', 'rgba(8,8,8,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const geom = geo('contact', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const g = new THREE.Group();
  const o = new THREE.Object3D();
  const n = items.length;
  const matrices = new Float32Array(n * 16);
  items.forEach((it, i) => {
    o.position.set(it.x, it.y + 0.004, it.z);
    o.rotation.set(0, it.r || 0, 0);
    o.scale.set(it.w, 1, it.d);
    o.updateMatrix();
    o.matrix.toArray(matrices, i * 16);
  });
  // tramos con el orden exacto de las manchas (transparentes: importa el orden de mezcla)
  const runs = instanceRuns(items, (it) => chunkKeyFor(it.x, it.z));
  runMeshes(geom, mat, runs, matrices, instancedBoundingSphere(geom, matrices, n)).forEach((m) => {
    m.renderOrder = 1;
    g.add(m);
  });
  return g;
}

// ---------- Plataformas ----------
// Isla: acantilado de roca estratificada (facetas, cornisas y talud hacia el agua), canto de losa de
// hormigón claro con goterón y tapa transitable. Barandilla, bordillo y balizas se colocan después de
// las estaciones (edges.js) para respetar lo que hay sobre la tapa; `userData.edge` describe el contorno
// (plano xz local, normales hacia fuera) y la superficie del acantilado para plantar sobre ella.
// opts: { seed, notch, cliffMat (UV propias: u ≈ 3 m por tesela alrededor de la isla, v = medio banco de
// estrato), fasciaMat, dripMat, capMat }.
export function makePlatform(M, shape, top, opts = {}) {
  const g = new THREE.Group();
  const seed = opts.seed || 1;
  const L = shape.getLength();
  const n = Math.max(48, Math.round(L / 0.55));
  const raw = shape.getSpacedPoints(n);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: raw[i].x, z: -raw[i].y, s: (i / n) * L });
  let cx = 0;
  let cz = 0;
  pts.forEach((p) => {
    cx += p.x / n;
    cz += p.z / n;
  });
  pts.forEach((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const tl = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    p.tx = (b.x - a.x) / tl;
    p.tz = (b.z - a.z) / tl;
    const sgn = p.tz * (p.x - cx) - p.tx * (p.z - cz) < 0 ? -1 : 1;
    p.nx = p.tz * sgn;
    p.nz = -p.tx * sgn;
  });
  // (abajo × tangente) apunta hacia fuera salvo que el contorno gire al revés
  const flip = -pts[0].tz * pts[0].nx + pts[0].tx * pts[0].nz < 0;
  // rebajes de la tapa (llegada de rampas): tramos s0..s1 del contorno que se sustituyen por un polígono
  const notches = opts.notch ? opts.notch(pts, L) : [];
  const notchAt = (s) => notches.findIndex(({ s0, s1 }) => (s > s0 && s < s1) || (s + L > s0 && s + L < s1));
  const along = (s) => {
    const w = ((s % L) + L) % L;
    const u = (w / L) * n;
    const a = pts[Math.floor(u) % n];
    const b = pts[(Math.floor(u) + 1) % n];
    const f = u - Math.floor(u);
    const nx = a.nx + (b.nx - a.nx) * f;
    const nz = a.nz + (b.nz - a.nz) * f;
    const l = Math.hypot(nx, nz) || 1;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, nx: nx / l, nz: nz / l, s: w };
  };
  const quad = (out, a, b, c, d) => (flip ? out.push(a, b, c, b, d, c) : out.push(a, c, b, b, c, d));

  // ruido de valor periódico a lo largo del contorno: sin costura al cerrar la isla
  const hash = (i, j, k) => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k + seed * 131, 1440662683);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const pn = (x, y, period, k) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = (x - xi) * (x - xi) * (3 - 2 * (x - xi));
    const v = (y - yi) * (y - yi) * (3 - 2 * (y - yi));
    const x0 = ((xi % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const a = hash(x0, yi, k);
    const b = hash(x1, yi, k);
    const c = hash(x0, yi + 1, k);
    const d = hash(x1, yi + 1, k);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  // superficie del acantilado: bancos de estrato ondulados de grosor variable, cada uno con su cara (dos
  // filas que siguen la ondulación), partida en bloques que salen o entran, y una junta estrecha con el
  // banco siguiente que forma repisa o visera; retranqueo bajo el canto y talud hacia el agua
  const yTop = top - 0.34;
  const yBot = -2.95;
  const P1 = Math.max(4, Math.round(L / 2.1));
  const P2 = Math.max(8, Math.round(L / 0.75));
  const P3 = Math.max(3, Math.round(L / 6));
  const P4 = Math.max(3, Math.round(L / 2.7));
  const bandH = 0.75 + (seed % 4) * 0.12;
  const EPS = 0.04; // media altura de la junta entre bancos, en bancos
  const wrapS = (s) => ((s % L) + L) % L;
  const wave = (s) => (pn((wrapS(s) / L) * P3, 0.5, P3, 3) - 0.5) * 1.3;
  const clampY = (y) => Math.min(yTop, Math.max(yBot, y));
  const sstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // pies de banco acumulados desde y = 0 (grosores de 0,55 a 1,45 × bandH) y coordenada de banco b ↔ y
  const KB = 40;
  const foot = new Float32Array(2 * KB + 2);
  const thick = (k) => bandH * (0.55 + 0.9 * hash(k, 5, 23));
  for (let k = 0; k <= KB; k++) foot[KB + k + 1] = foot[KB + k] + thick(k);
  for (let k = -1; k >= -KB; k--) foot[KB + k] = foot[KB + k + 1] - thick(k);
  const yOf = (b) => {
    const i = Math.min(2 * KB, Math.max(0, Math.floor(b) + KB));
    return foot[i] + (b - (i - KB)) * (foot[i + 1] - foot[i]);
  };
  const bandOf = (y) => {
    let lo = 0;
    let hi = 2 * KB + 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (foot[mid] <= y) lo = mid;
      else hi = mid;
    }
    return lo - KB + (y - foot[lo]) / (foot[lo + 1] - foot[lo]);
  };
  // cada banco se parte en bloques de ~2,7 m con su propio retranqueo e inclinación (unos vuelan, otros
  // se retiran) y un salto corto entre ellos: la pared deja de leerse como hiladas regulares
  const blockAt = (k, f, t) => {
    const u = f * P4 + hash(k, 9, 31) * P4;
    const i = Math.floor(u);
    const ia = ((i % P4) + P4) % P4;
    const ib = (ia + 1) % P4;
    const va = hash(k, ia, 37) + (hash(k, ia, 41) - 0.35) * (t - 0.5) * 0.7;
    const vb = hash(k, ib, 37) + (hash(k, ib, 41) - 0.35) * (t - 0.5) * 0.7;
    return va + (vb - va) * sstep(0.74, 1, u - i);
  };
  // retranqueo exacto en un nudo de la malla
  const offRaw = (s, y) => {
    const f = wrapS(s) / L;
    const h = Math.max(0, yTop - y);
    const tuck = Math.min(1, h / 0.5);
    const talus = Math.min(1.7, 0.07 * h + 0.012 * h * h);
    const bp = bandOf(y + wave(s));
    const band = Math.floor(bp);
    const strata = (blockAt(band, f, bp - band) - 0.42) * 0.85;
    const big = (pn(f * P1, y / 1.5, P1, 5) - 0.5) * 0.45;
    const fine = (pn(f * P2, y / 0.55, P2, 9) - 0.5) * 0.08;
    return Math.max(-0.2, -0.05 + tuck * (talus + strata + big + fine));
  };
  // superficie entre nudos tal como la dibuja la malla (lineal entre las filas de cada franja): la
  // vegetación y las rocas se apoyan en ella sin hundirse ni flotar
  const offAt = (s, y) => {
    const yc = clampY(y);
    const w = wave(s);
    const bp = bandOf(yc + w);
    const k = Math.floor(bp);
    const t = bp - k;
    const [a, b] = t < EPS ? [k + EPS, k - EPS] : t > 1 - EPS ? [k + 1 + EPS, k + 1 - EPS] : [k + 1 - EPS, k + EPS];
    const ya = clampY(yOf(a) - w);
    const yb = clampY(yOf(b) - w);
    const oa = offRaw(s, ya);
    const ob = offRaw(s, yb);
    return ya - yb < 1e-4 ? oa : ob + ((oa - ob) * (yc - yb)) / (ya - yb);
  };
  let kLo = Infinity;
  let kHi = -Infinity;
  pts.forEach((p) => {
    const w = wave(p.s);
    kLo = Math.min(kLo, Math.floor(bandOf(yBot + w)) - 1);
    kHi = Math.max(kHi, Math.floor(bandOf(yTop + w)) + 1);
  });
  // franjas de arriba abajo; las filas fuera de [yBot, yTop] se pegan a los extremos (quedan franjas nulas
  // que no se dibujan, y la malla cierra siempre contra el canto y bajo el agua)
  const strips = [];
  for (let k = kHi; k >= kLo; k--) {
    strips.push({ band: k, a: k + 1 - EPS, b: k + EPS });
    if (k > kLo) strips.push({ band: k, a: k + EPS, b: k - EPS });
  }
  // UV propias: u da la vuelta a la isla con un número entero de teselas de ~3 m (columna de costura
  // duplicada) y se desplaza por banco; v sigue al estrato (media tesela por banco)
  const U = Math.max(1, Math.round(L / 3));
  const cPos = [];
  const cNor = [];
  const cUv = [];
  const cIdx = [];
  const ya = new Float32Array(n);
  const yb = new Float32Array(n);
  const PA = new Float32Array(n * 3);
  const PB = new Float32Array(n * 3);
  const NA = new Float32Array(n * 3);
  const NB = new Float32Array(n * 3);
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const fn = new THREE.Vector3();
  const at = (r, i, out) => out.fromArray(r === 0 ? PA : PB, i * 3);
  const addN = (r, i) => {
    const N = r === 0 ? NA : NB;
    N[i * 3] += fn.x;
    N[i * 3 + 1] += fn.y;
    N[i * 3 + 2] += fn.z;
  };
  // triángulo con el mismo orden que quad(): normal ponderada por área en sus tres nudos
  const tri = (a, b, c) => {
    at(a[0], a[1], p0);
    at(b[0], b[1], p1);
    at(c[0], c[1], p2);
    fn.subVectors(p1, p0).cross(p2.sub(p0));
    addN(...a);
    addN(...b);
    addN(...c);
  };
  strips.forEach(({ band, a, b }) => {
    let live = false;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const w = wave(p.s);
      ya[i] = clampY(yOf(a) - w);
      yb[i] = clampY(yOf(b) - w);
      if (ya[i] - yb[i] > 1e-4) live = true;
      const oa = offRaw(p.s, ya[i]);
      const ob = offRaw(p.s, yb[i]);
      PA.set([p.x + p.nx * oa, ya[i], p.z + p.nz * oa], i * 3);
      PB.set([p.x + p.nx * ob, yb[i], p.z + p.nz * ob], i * 3);
    }
    if (!live) return;
    // normales suaves dentro de la franja (con el contorno cerrado); aristas vivas entre franjas
    NA.fill(0);
    NB.fill(0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (flip) {
        tri([0, i], [0, j], [1, i]);
        tri([0, j], [1, j], [1, i]);
      } else {
        tri([0, i], [1, i], [0, j]);
        tri([0, j], [1, i], [1, j]);
      }
    }
    const base = cPos.length / 3;
    const shift = hash(band, 3, 17);
    [[PA, NA, ya], [PB, NB, yb]].forEach(([P, N, Y]) => {
      for (let c = 0; c <= n; c++) {
        const i = c % n;
        const p = pts[i];
        cPos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        fn.fromArray(N, i * 3);
        if (fn.lengthSq() < 1e-12) fn.set(p.nx, 0, p.nz);
        fn.normalize();
        cNor.push(fn.x, fn.y, fn.z);
        cUv.push((c / n) * U + shift, bandOf(Y[i] + wave(p.s)) / 2);
      }
    });
    for (let c = 0; c < n; c++) {
      const j = (c + 1) % n;
      if (ya[c] - yb[c] < 1e-4 && ya[j] - yb[j] < 1e-4) continue;
      quad(cIdx, base + c, base + c + 1, base + n + 1 + c, base + n + 2 + c);
    }
  });
  const cliff = new THREE.BufferGeometry();
  cliff.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3));
  cliff.setAttribute('normal', new THREE.Float32BufferAttribute(cNor, 3));
  cliff.setAttribute('uv', new THREE.Float32BufferAttribute(cUv, 2));
  cliff.setIndex(cIdx);
  // material sin `tile`: bakeStatic conserva estas UV (sin proyección en caja ni saltos por triángulo)
  const cliffMat = opts.cliffMat || geo('mat:cliffRock', () => {
    const mat = M.rock.clone();
    mat.userData = {};
    ['map', 'roughnessMap', 'normalMap'].forEach((k) => {
      if (!mat[k]) return;
      mat[k] = mat[k].clone();
      mat[k].repeat.set(1, 1);
    });
    return mat;
  });
  g.add(new THREE.Mesh(cliff, cliffMat));

  // canto de losa: banda de hormigón claro con chaflán y goterón (queda bajo el bordillo de piezas)
  // (el labio entra bajo la tapa 2,5 cm por debajo de ella: a 8 mm se disputaba la profundidad vista de lejos)
  const prof = [[-0.12, top + 0.285], [0.05, top + 0.285], [0.088, top + 0.262], [0.088, top - 0.215], [0.06, top - 0.285], [-0.22, top - 0.3]];
  // (labio, chaflán y cara con `fasciaMat`; goterón y fondo con `dripMat`, más oscuro: sombra de contacto)
  const fp = [];
  const fnm = [];
  const fi = [];
  const fd = [];
  const ring = pts.filter((_, i) => i % 2 === 0);
  notches.forEach(({ s0, s1 }) => ring.push(along(s0), along(s1)));
  ring.sort((p, q) => p.s - q.s);
  const m = ring.length;
  const cut = ring.map((p, i) => {
    const q = ring[(i + 1) % m];
    return notchAt(((p.s + (q.s < p.s ? q.s + L : q.s)) / 2) % L) >= 0;
  });
  for (let k = 0; k < prof.length - 1; k++) {
    const [o0, y0] = prof[k];
    const [o1, y1] = prof[k + 1];
    const ln = Math.hypot(y1 - y0, o1 - o0);
    const no = -(y1 - y0) / ln;
    const ny = (o1 - o0) / ln;
    const base = fp.length / 3;
    ring.forEach((p) => {
      fp.push(p.x + p.nx * o0, y0, p.z + p.nz * o0, p.x + p.nx * o1, y1, p.z + p.nz * o1);
      fnm.push(p.nx * no, ny, p.nz * no, p.nx * no, ny, p.nz * no);
    });
    const out = k < 3 ? fi : fd;
    for (let i = 0; i < m; i++) if (!cut[i]) quad(out, base + i * 2, base + ((i + 1) % m) * 2, base + i * 2 + 1, base + ((i + 1) % m) * 2 + 1);
  }
  const fPos = new THREE.Float32BufferAttribute(fp, 3);
  const fNor = new THREE.Float32BufferAttribute(fnm, 3);
  [[fi, opts.fasciaMat || M.concreteLight], [fd, opts.dripMat || M.concrete]].forEach(([list, mat]) => {
    const fascia = new THREE.BufferGeometry();
    fascia.setAttribute('position', fPos);
    fascia.setAttribute('normal', fNor);
    fascia.setIndex(list);
    g.add(new THREE.Mesh(fascia, mat));
  });

  // tapa desde el mismo contorno denso (coincide con canto y bordillo), con los rebajes intercalados
  const poly = [];
  const done = new Set();
  pts.forEach((p) => {
    const k = notchAt(p.s);
    if (k < 0) poly.push(new THREE.Vector2(p.x, -p.z));
    else if (!done.has(k)) {
      done.add(k);
      notches[k].poly.forEach(([x, z]) => poly.push(new THREE.Vector2(x, -z)));
    }
  });
  const capGeom = new THREE.ShapeGeometry(new THREE.Shape(poly));
  capGeom.rotateX(-Math.PI / 2);
  const cap = new THREE.Mesh(capGeom, opts.capMat || M.concrete);
  cap.position.y = top + 0.31;
  g.add(cap);
  g.userData.edge = { pts, L, yTop, offAt };
  return g;
}

export function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function circleShape(r) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  return s;
}

// ---------- Fusión estática ----------
// Une las mallas fijas por fragmento y material (menos draw calls) y proyecta UV en coordenadas de mundo para
// que hormigón, roca y metal conserven escala y orientación. `chunkOf(malla)` da el fragmento de cada pieza (ver
// chunks.js); cada malla fusionada lo lleva en `userData.chunk`. Las piezas de un material se reparten en tramos
// de un solo fragmento que conservan el orden de dibujo de la fusión única por material (chunks.js ·
// orderedRuns; casi siempre un tramo por fragmento) y todas llevan la esfera envolvente de esa fusión única:
// three las ordena como a ella y ningún píxel cambia; cada tramo se recorta con su propia esfera (ownCulling).
// Por defecto todo va a 'resto': una malla por material, como sin fragmentos.
export function bakeStatic(root, chunkOf = () => 'resto') {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const remove = [];
  const isDynamic = (o) => {
    for (let p = o; p; p = p.parent) if (p.userData.dynamic) return true;
    return false;
  };
  const n = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || isDynamic(o) || Array.isArray(o.material) || o.material.transparent) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
    const uv = g.attributes.uv;
    if (o.material.userData.tile) {
      for (let i = 0; i < pos.count; i++) {
        n.fromBufferAttribute(nor, i);
        const ax = Math.abs(n.x);
        const ay = Math.abs(n.y);
        const az = Math.abs(n.z);
        if (ay >= ax && ay >= az) uv.setXY(i, pos.getX(i), pos.getZ(i));
        else if (ax >= az) uv.setXY(i, pos.getZ(i), pos.getY(i));
        else uv.setXY(i, pos.getX(i), pos.getY(i));
      }
    }
    const key = o.material.uuid;
    if (!groups.has(key)) groups.set(key, { mat: o.material, list: [], chunks: [] });
    const group = groups.get(key);
    group.list.push(g);
    group.chunks.push(chunkOf(o));
    remove.push(o);
  });
  remove.forEach((o) => o.parent.remove(o));
  const out = new THREE.Group();
  groups.forEach(({ mat, list, chunks }) => {
    const sphere = mergedBoundingSphere(list);
    const runs = orderedRuns(list.map((_, k) => k), (k) => chunks[k], (k) => new THREE.Box3().setFromBufferAttribute(list[k].attributes.position).expandByScalar(TIE_MARGIN));
    runs.forEach(({ chunk, items }) => {
      const geometry = mergeGeometries(items.map(([k]) => list[k]));
      const m = new THREE.Mesh(geometry, mat);
      ownCulling(m, mergedBoundingSphere([geometry]));
      geometry.boundingSphere = sphere.clone();
      // las piezas luminosas no proyectan sombra
      m.castShadow = !(mat.isMeshBasicMaterial || mat.emissiveIntensity > 0.3);
      m.receiveShadow = true;
      m.userData.chunk = chunk;
      out.add(m);
    });
  });
  root.add(out);
  return out;
}
