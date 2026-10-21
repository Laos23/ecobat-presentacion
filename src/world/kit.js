import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import * as P from './pbr.js';

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
  const satin = P.micro({ seed: 9, base: [36, 38, 40], rough: [0.4, 0.14], bump: 0.35 });
  const rubber = P.micro({ seed: 13, base: [22, 23, 24], rough: [0.85, 0.12], bump: 1.4 });

  return {
    concrete: withMaps(std({ color: '#ffffff' }), P.concrete({ seed: 3 }), 6),
    concreteLight: withMaps(std({ color: '#ffffff' }), P.concrete({ seed: 33, base: [172, 166, 155], joints: 1 }), 4),
    floor: withMaps(std({ color: '#ffffff' }), P.concrete({ seed: 21, base: [196, 189, 175], joints: 2 }), 5),
    rock: withMaps(std({ color: '#ffffff' }), P.rock({ seed: 11 }), 3.5),
    steel: withMaps(std({ color: '#ffffff', metalness: 0.85, envMapIntensity: 2.4 }), steel, 1.6),
    darkSteel: withMaps(std({ color: '#ffffff', metalness: 0.7, envMapIntensity: 1.6 }), darkSteel, 1.6),
    // plástico satinado de carcasas y armarios
    graphite: withMaps(phys({ color: '#ffffff', clearcoat: 0.25, clearcoatRoughness: 0.5 }), satin, 1.2),
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
    limeLine: std({ color: '#b5e02c', emissive: '#C2F230', emissiveIntensity: 0.45, roughness: 0.4 }),
    limeInsert: std({ color: '#93b52a', emissive: '#C2F230', emissiveIntensity: 0.05, roughness: 0.6 }),
    amberGlow: std({ color: '#E5AE50', emissive: '#E5AE50', emissiveIntensity: 1.3 }),
    warmGlow: std({ color: '#ffe4b8', emissive: '#ffcf8f', emissiveIntensity: 1.8 }),
    copper: std({ color: '#b26c3e', roughness: 0.35, metalness: 0.85, flatShading: true }),
    lead: std({ color: '#9da1a5', roughness: 0.4, metalness: 0.8, flatShading: true }),
    shard: std({ color: '#1d1f21', roughness: 0.45, flatShading: true }),
    qr: std({ map: T.qrLabelTexture(5), roughness: 0.4, metalness: 0.4, color: '#d9dadb' }),
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
  g.add(rbox(1.66, 0.17, 0.96, M.graphite, 0, 0, 0, 0.05));
  g.add(rbox(1.6, 0.66, 0.9, M.graphite, 0, 0.15, 0, 0.06));
  g.add(box(1.615, 0.016, 0.915, M.limeLine, 0, 0.8, 0));
  g.add(rbox(1.63, 0.14, 0.93, M.graphite, 0, 0.82, 0, 0.045));
  g.add(rbox(1.02, 0.04, 0.62, M.panel, 0, 0.95, 0.02, 0.015));
  // asideros rebajados en el zócalo
  [-0.48, 0.48].forEach((x) => g.add(box(0.44, 0.05, 0.02, M.rubber, x, 0.05, 0.475)));
  // bornes de acero sobre su base
  [-0.6, 0.6].forEach((x) => {
    const base = cyl(0.11, 0.12, 0.04, M.panel, 20);
    base.position.set(x, 0.98, -0.24);
    g.add(base);
    const t = cyl(0.075, 0.075, 0.12, M.steel, 20);
    t.position.set(x, 1.06, -0.24);
    g.add(t);
  });
  // asa grafito con inserto lima discreto
  [-0.43, 0.43].forEach((x) => g.add(rbox(0.11, 0.22, 0.13, M.graphite, x, 0.95, 0.02, 0.03)));
  g.add(rbox(0.98, 0.085, 0.14, M.graphite, 0, 1.15, 0.02, 0.035));
  g.add(rbox(0.5, 0.09, 0.145, M.limeInsert, 0, 1.15, 0.02, 0.035));
  if (opts.label !== false) {
    const qr = new THREE.Mesh(geo('batQR', () => new THREE.PlaneGeometry(0.13, 0.13)), M.qr);
    qr.position.set(0.64, 0.27, 0.452);
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
    [geo('biBody', () => new RoundedBoxGeometry(1.6, 0.96, 0.9, 1, 0.06)), M.graphite, 0, 0.48, 0],
    [geo('biLine', () => new THREE.BoxGeometry(1.615, 0.016, 0.915)), M.limeLine, 0, 0.8, 0],
    [geo('biPost', () => new THREE.BoxGeometry(0.95, 0.2, 0.08)), M.panel, 0, 1.04, 0],
    [geo('biHandle', () => new RoundedBoxGeometry(0.98, 0.085, 0.14, 1, 0.03)), M.graphite, 0, 1.17, 0],
    [geo('biInsert', () => new THREE.BoxGeometry(0.5, 0.09, 0.145)), M.limeInsert, 0, 1.17, 0],
    [geo('biQR', () => new THREE.PlaneGeometry(0.13, 0.13)), M.qr, 0.64, 0.27, 0.452],
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
    im.castShadow = mat === M.graphite;
    im.receiveShadow = true;
    group.add(im);
  });
  return group;
}

// ---------- Edificio abierto en sección ----------
export function makeCutaway(M, { w, d, h, glassFront = false, roofDepth = 0.55, light = 17 }) {
  const g = new THREE.Group();
  const t = 0.35;
  g.add(box(w + 1.2, 0.5, d + 1.2, M.concreteLight, 0, -0.5, 0));
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
  [-w / 2, w / 2].forEach((x) => g.add(rbox(0.32, h, 0.32, M.darkSteel, x, 0, d / 2, 0.04)));
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
function crownGeometry(seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.IcosahedronGeometry(0.45 + r() * 0.35, 1);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const f = 0.88 + r() * 0.24;
      pos.setXYZ(k, pos.getX(k) * f, pos.getY(k) * f, pos.getZ(k) * f);
    }
    g.translate((r() - 0.5) * 0.9, (r() - 0.3) * 0.7, (r() - 0.5) * 0.9);
    g.deleteAttribute('uv');
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  const col = new Float32Array(merged.attributes.position.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < merged.attributes.position.count; k++) {
    const y = merged.attributes.position.getY(k);
    c.setHSL(0.25 + r() * 0.06, 0.38 + r() * 0.12, 0.07 + Math.max(0, y) * 0.04 + r() * 0.02);
    col.set([c.r, c.g, c.b], k * 3);
  }
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return merged;
}

export function scatterTrees(M, points) {
  const g = new THREE.Group();
  const n = points.length;
  const trees = points.filter((p) => !p.shrub);
  const trunks = new THREE.InstancedMesh(geo('trunkI', () => new THREE.CylinderGeometry(0.06, 0.11, 1.1, 6)), M.trunk, trees.length);
  const halves = [points.filter((_, i) => i % 2 === 0), points.filter((_, i) => i % 2 === 1)];
  const crowns = [crownGeometry(7), crownGeometry(19)].map((cg, k) => new THREE.InstancedMesh(cg, M.foliage, halves[k].length));
  const o = new THREE.Object3D();
  const tint = new THREE.Color();
  trees.forEach((p, i) => {
    const s = p.s || 1;
    o.position.set(p.x, p.y + 0.55 * s, p.z);
    o.rotation.set(0, i * 2.39, 0);
    o.scale.setScalar(s);
    o.updateMatrix();
    trunks.setMatrixAt(i, o.matrix);
  });
  halves.forEach((list, k) => {
    list.forEach((p, i) => {
      const s = p.s || 1;
      const shrub = p.shrub;
      o.position.set(p.x, p.y + (shrub ? 0.3 * s : 1.45 * s), p.z);
      o.rotation.set(0, i * 2.39, 0);
      o.scale.set(s * (shrub ? 0.7 : 1), s * (shrub ? 0.5 : 1.1), s * (shrub ? 0.7 : 1));
      o.updateMatrix();
      crowns[k].setMatrixAt(i, o.matrix);
      tint.setScalar(0.85 + ((i * 37) % 10) * 0.03);
      crowns[k].setColorAt(i, tint);
    });
  });
  crowns.forEach((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
  });
  trunks.castShadow = true;
  g.add(trunks, ...crowns);
  return g;
}

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed) * 0.18 + Math.sin(v.z * 5.3 + seed * 2) * 0.08;
    v.multiplyScalar(1 + n);
    v.y *= 0.8;
    // caras planas de fractura en la parte alta
    if (v.y > 0.55) v.y = 0.55 + (v.y - 0.55) * 0.3;
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv;
  for (let k = 0; k < pos.count; k++) uv.setXY(k, pos.getX(k) * 0.5 + pos.getZ(k) * 0.3, pos.getY(k) * 0.5);
  return g;
}

export function scatterRocks(M, points) {
  const g = new THREE.Group();
  const lists = [0, 1, 2].map((k) => points.map((p, i) => [p, i]).filter(([, i]) => i % 3 === k));
  const meshes = [rockGeometry(1.3), rockGeometry(4.1), rockGeometry(7.7)].map((rg, k) => new THREE.InstancedMesh(rg, M.rock, lists[k].length));
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  lists.forEach((list, k) => {
    list.forEach(([p, i], j) => {
      o.position.set(p.x, p.y, p.z);
      o.rotation.set((i % 5) * 0.2, i * 2.3, (i % 3) * 0.15);
      o.scale.set(p.s * (0.9 + (i % 3) * 0.2), p.s * (0.75 + (i % 4) * 0.15), p.s);
      o.updateMatrix();
      meshes[k].setMatrixAt(j, o.matrix);
      c.setScalar(0.75 + (i % 6) * 0.06);
      meshes[k].setColorAt(j, c);
    });
  });
  meshes.forEach((m) => {
    m.receiveShadow = true;
    m.castShadow = true;
  });
  g.add(...meshes);
  return g;
}

// Balizas de suelo con difusor cálido y su charco de luz simulado (sin coste de luces reales).
export function scatterLamps(M, points) {
  const g = new THREE.Group();
  const n = points.length;
  const posts = new THREE.InstancedMesh(geo('bollard', () => new RoundedBoxGeometry(0.2, 0.62, 0.2, 1, 0.03)), M.graphite, n);
  const glow = new THREE.InstancedMesh(geo('bollardGlow', () => new THREE.BoxGeometry(0.16, 0.18, 0.21)), M.warmGlow, n);
  const poolMat = new THREE.MeshBasicMaterial({
    map: P.radial('rgba(255,190,110,0.5)', 'rgba(255,170,90,0)'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pools = new THREE.InstancedMesh(geo('pool', () => new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2)), poolMat, n);
  const o = new THREE.Object3D();
  points.forEach((p, i) => {
    o.position.set(p.x, p.y + 0.31, p.z);
    o.updateMatrix();
    posts.setMatrixAt(i, o.matrix);
    o.position.set(p.x, p.y + 0.5, p.z);
    o.updateMatrix();
    glow.setMatrixAt(i, o.matrix);
    o.position.set(p.x, p.y + 0.03, p.z);
    o.updateMatrix();
    pools.setMatrixAt(i, o.matrix);
  });
  posts.castShadow = true;
  pools.renderOrder = 2;
  g.add(posts, glow, pools);
  return g;
}

// Sombras de contacto: manchas suaves bajo los objetos apoyados.
export function contactShadows(items) {
  const mat = new THREE.MeshBasicMaterial({ map: P.radial('rgba(8,8,8,0.62)', 'rgba(8,8,8,0)'), transparent: true, depthWrite: false });
  const m = new THREE.InstancedMesh(geo('contact', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat, items.length);
  const o = new THREE.Object3D();
  items.forEach((it, i) => {
    o.position.set(it.x, it.y + 0.02, it.z);
    o.rotation.set(0, it.r || 0, 0);
    o.scale.set(it.w, 1, it.d);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.renderOrder = 1;
  return m;
}

// ---------- Plataformas ----------
export function makePlatform(M, shape, top, opts = {}) {
  const g = new THREE.Group();
  const depth = top + 3;
  const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2, curveSegments: 32 });
  geom.rotateX(-Math.PI / 2);
  const side = new THREE.Mesh(geom, M.rock);
  side.position.y = -3;
  g.add(side);
  const capGeom = new THREE.ShapeGeometry(shape, 32);
  capGeom.rotateX(-Math.PI / 2);
  const cap = new THREE.Mesh(capGeom, opts.capMat || M.concrete);
  cap.position.y = top + 0.31;
  g.add(cap);
  // bordillo continuo de hormigón claro
  const pts = shape.getSpacedPoints(opts.railCount || 80);
  const edge = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, top + 0.38, -p.y)), true);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(edge, pts.length * 2, 0.16, 4, true), M.concreteLight));
  if (opts.rail !== false) {
    const posts = new THREE.InstancedMesh(geo('railPost', () => new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6)), M.darkSteel, pts.length);
    const o = new THREE.Object3D();
    pts.forEach((p, i) => {
      o.position.set(p.x * 0.985, top + 0.8, -p.y * 0.985);
      o.updateMatrix();
      posts.setMatrixAt(i, o.matrix);
    });
    posts.castShadow = true;
    g.add(posts);
    const rail = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x * 0.985, top + 1.12, -p.y * 0.985)), true);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(rail, pts.length * 2, 0.045, 6, true), M.darkSteel));
  }
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
// Une las mallas fijas en una malla por material (menos draw calls) y proyecta UV en
// coordenadas de mundo para que hormigón, roca y metal conserven escala y orientación.
export function bakeStatic(root) {
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
    if (!groups.has(key)) groups.set(key, { mat: o.material, list: [] });
    groups.get(key).list.push(g);
    remove.push(o);
  });
  remove.forEach((o) => o.parent.remove(o));
  const out = new THREE.Group();
  groups.forEach(({ mat, list }) => {
    const m = new THREE.Mesh(mergeGeometries(list), mat);
    // las piezas luminosas no proyectan sombra
    m.castShadow = !(mat.isMeshBasicMaterial || mat.emissiveIntensity > 0.3);
    m.receiveShadow = true;
    out.add(m);
  });
  root.add(out);
  return out;
}
