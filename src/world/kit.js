import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as T from './textures.js';

// Gramática de materiales compartida por todo el diorama.
export function makeMaterials() {
  const ground = T.groundTexture();
  ground.repeat.set(6, 6);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    concrete: std({ color: '#8f8b83', roughness: 0.92, map: ground }),
    concreteLight: std({ color: '#b9b3a6', roughness: 0.9, map: ground }),
    floor: std({ color: '#d4cdbf', roughness: 0.75 }),
    ivory: std({ color: '#d8d1c3', roughness: 0.88 }),
    graphite: std({ color: '#1f2224', roughness: 0.62, metalness: 0.15 }),
    graphiteLight: std({ color: '#33373a', roughness: 0.55, metalness: 0.3 }),
    metal: std({ color: '#5d6266', roughness: 0.38, metalness: 0.75 }),
    rock: std({ color: '#4a4741', roughness: 1, flatShading: true }),
    rockDark: std({ color: '#2f2d2a', roughness: 1, flatShading: true }),
    foliage: std({ color: '#33502f', roughness: 0.95, flatShading: true }),
    foliageDark: std({ color: '#243b25', roughness: 0.95, flatShading: true }),
    trunk: std({ color: '#3b2f25', roughness: 1 }),
    wood: std({ color: '#8a6a45', roughness: 0.85 }),
    amberMatte: std({ color: '#c99945', roughness: 0.6 }),
    tire: std({ color: '#141516', roughness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#b8c4c4', roughness: 0.08, metalness: 0, transmission: 0, transparent: true, opacity: 0.16,
    }),
    water: std({ color: '#0b0d0e', roughness: 0.55, metalness: 0.1, envMapIntensity: 0.05 }),
    lime: new THREE.MeshStandardMaterial({ color: '#C2F230', emissive: '#C2F230', emissiveIntensity: 1.3, roughness: 0.5 }),
    limeMatte: std({ color: '#b5e02c', roughness: 0.55 }),
    amberGlow: new THREE.MeshStandardMaterial({ color: '#E5AE50', emissive: '#E5AE50', emissiveIntensity: 1.6 }),
    warmGlow: new THREE.MeshStandardMaterial({ color: '#ffe4b8', emissive: '#ffd9a0', emissiveIntensity: 2.6 }),
    ivoryGlow: new THREE.MeshStandardMaterial({ color: '#F1EEE6', emissive: '#F1EEE6', emissiveIntensity: 1.6 }),
    copper: std({ color: '#a8643a', roughness: 0.5, metalness: 0.7 }),
    lead: std({ color: '#7b7f82', roughness: 0.45, metalness: 0.65, flatShading: true }),
    plastic: std({ color: '#2a2c2e', roughness: 0.7, flatShading: true }),
  };
}

const cache = new Map();
let qrShared;
function qrMat() {
  qrShared ||= new THREE.MeshStandardMaterial({ map: T.qrLabelTexture(5), roughness: 0.7, color: '#c9c5bb' });
  return qrShared;
}
function geo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cyl(rt, rb, h, mat, seg = 16) {
  return new THREE.Mesh(geo(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat);
}

// La batería protagonista: carcasa grafito, asa lima, bornes y etiqueta QR.
export function makeBattery(M, opts = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo('batBody', () => new RoundedBoxGeometry(1.6, 1.0, 0.9, 3, 0.07)), M.graphite);
  body.position.y = 0.5;
  g.add(body);
  const lid = new THREE.Mesh(geo('batLid', () => new RoundedBoxGeometry(1.64, 0.14, 0.94, 2, 0.05)), M.graphiteLight);
  lid.position.y = 1.02;
  g.add(lid);
  const stripe = box(1.62, 0.05, 0.92, M.limeMatte, 0, 0.9, 0);
  g.add(stripe);
  [-0.52, 0.52].forEach((x, i) => {
    const t = cyl(0.08, 0.09, 0.14, i ? M.metal : M.amberMatte, 12);
    t.position.set(x, 1.15, 0.22);
    g.add(t);
  });
  const handle = new THREE.Mesh(
    geo('batHandle', () => new THREE.TorusGeometry(0.42, 0.045, 8, 24, Math.PI)),
    opts.glow ? M.lime : M.limeMatte,
  );
  handle.position.set(0, 1.09, -0.12);
  g.add(handle);
  if (opts.label !== false) {
    const lbl = new THREE.Mesh(
      geo('batLabel', () => new THREE.PlaneGeometry(1.36, 0.68)),
      opts.labelMat || new THREE.MeshStandardMaterial({ map: T.batteryLabelTexture(), roughness: 0.6 }),
    );
    lbl.position.set(0, 0.48, 0.452);
    g.add(lbl);
  }
  body.castShadow = true;
  if (opts.scale) g.scale.setScalar(opts.scale);
  return g;
}

// Muchas baterías baratas: una sola malla instanciada.
export function batteryInstances(M, transforms) {
  const group = new THREE.Group();
  const n = transforms.length;
  const body = new THREE.InstancedMesh(geo('batBodyLow', () => new RoundedBoxGeometry(1.6, 1.0, 0.9, 1, 0.06)), M.graphite, n);
  const handle = new THREE.InstancedMesh(geo('batHandleLow', () => new THREE.BoxGeometry(0.9, 0.06, 0.08)), M.limeMatte, n);
  const label = new THREE.InstancedMesh(geo('batLabelLow', () => new THREE.PlaneGeometry(0.4, 0.4)), qrMat(), n);
  const o = new THREE.Object3D();
  const child = new THREE.Object3D();
  o.add(child);
  transforms.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set(0, t.r || 0, 0);
    o.scale.setScalar(t.s || 1);
    child.position.set(0, 0.5, 0);
    o.updateMatrixWorld(true);
    body.setMatrixAt(i, child.matrixWorld);
    child.position.set(0, 1.04, 0);
    child.updateMatrixWorld(true);
    handle.setMatrixAt(i, child.matrixWorld);
    child.position.set(0.42, 0.5, 0.452);
    child.updateMatrixWorld(true);
    label.setMatrixAt(i, child.matrixWorld);
  });
  body.castShadow = true;
  group.add(body, handle, label);
  return group;
}

// Edificio abierto en sección: suelo, dos muros, techo parcial y luz cálida.
export function makeCutaway(M, { w, d, h, glassFront = false, roofDepth = 0.55 }) {
  const g = new THREE.Group();
  const t = 0.35;
  const slab = box(w + 1.2, 0.5, d + 1.2, M.concreteLight, 0, -0.5, 0);
  slab.receiveShadow = true;
  g.add(slab);
  const floor = box(w, 0.06, d, M.floor, 0, 0, 0);
  floor.receiveShadow = true;
  g.add(floor);
  const back = box(w, h, t, M.ivory, 0, 0, -d / 2);
  const left = box(t, h, d, M.ivory, -w / 2, 0, 0);
  const right = box(t, h * 0.42, d * 0.55, M.ivory, w / 2, 0, -d * 0.225);
  [back, left, right].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  });
  // Techo que solo cubre la parte trasera: la sección queda a la vista.
  const roofD = d * roofDepth;
  const roof = box(w + 0.6, 0.35, roofD, M.graphiteLight, 0, h, -d / 2 + roofD / 2 - 0.2);
  roof.castShadow = true;
  g.add(roof);
  const eave = box(w + 0.8, 0.12, 0.3, M.graphite, 0, h + 0.35, -d / 2 + roofD - 0.2);
  g.add(eave);
  // Tiras de luz bajo el techo.
  for (let i = 0; i < 3; i++) {
    const strip = box(w * 0.7, 0.08, 0.18, M.warmGlow, 0, h - 0.1, -d / 2 + 0.8 + i * (roofD / 3));
    g.add(strip);
  }
  // Pilares delanteros.
  [-w / 2, w / 2].forEach((x) => {
    const p = box(0.3, h, 0.3, M.graphite, x, 0, d / 2);
    p.castShadow = true;
    g.add(p);
  });
  if (glassFront) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
    glass.position.set(0, h / 2, d / 2);
    g.add(glass);
    const mullion = box(w, 0.12, 0.12, M.graphite, 0, h - 0.12, d / 2);
    g.add(mullion);
  }
  // Apliques en la pared trasera.
  for (let i = -1; i <= 1; i++) {
    g.add(box(0.5, 0.12, 0.12, M.warmGlow, i * (w / 3), h * 0.62, -d / 2 + 0.25));
  }
  const light = new THREE.PointLight('#ffcf8a', 15, Math.max(w, d) * 1.5, 1.6);
  light.position.set(0, h - 1, -d * 0.1);
  g.add(light);
  return g;
}

export function makeCar(M, color = '#3a3e42') {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.6 });
  const body = new THREE.Mesh(geo('carBody', () => new RoundedBoxGeometry(4.2, 0.8, 1.8, 3, 0.3)), paint);
  body.position.y = 0.75;
  const cabin = new THREE.Mesh(geo('carCabin', () => new RoundedBoxGeometry(2.3, 0.7, 1.6, 3, 0.28)), paint);
  cabin.position.set(-0.25, 1.4, 0);
  const win = new THREE.Mesh(geo('carWin', () => new RoundedBoxGeometry(2.36, 0.46, 1.62, 2, 0.2)), M.graphite);
  win.position.set(-0.25, 1.46, 0);
  g.add(body, cabin, win);
  [[1.35, 0.85], [1.35, -0.85], [-1.35, 0.85], [-1.35, -0.85]].forEach(([x, z]) => {
    const w = cyl(0.42, 0.42, 0.32, M.tire, 18);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  });
  const head = box(0.06, 0.12, 1.3, M.warmGlow, 2.1, 0.8, 0);
  g.add(head);
  body.castShadow = true;
  cabin.castShadow = true;
  return g;
}

export function makeTree(M, s = 1, dark = false) {
  const g = new THREE.Group();
  const trunk = cyl(0.08 * s, 0.12 * s, 0.8 * s, M.trunk, 6);
  trunk.position.y = 0.4 * s;
  g.add(trunk);
  const crown = new THREE.Mesh(geo('crown', () => new THREE.IcosahedronGeometry(1, 0)), dark ? M.foliageDark : M.foliage);
  crown.scale.set(0.75 * s, 1.0 * s, 0.75 * s);
  crown.position.y = 1.4 * s;
  crown.castShadow = true;
  g.add(crown);
  return g;
}

// Árboles, rocas y farolas en instancias para no multiplicar draw calls.
export function scatterTrees(M, points) {
  const g = new THREE.Group();
  const n = points.length;
  const trunks = new THREE.InstancedMesh(geo('trunkI', () => new THREE.CylinderGeometry(0.08, 0.12, 0.8, 5)), M.trunk, n);
  const crowns = new THREE.InstancedMesh(geo('crownI', () => new THREE.IcosahedronGeometry(1, 0)), M.foliage, n);
  const crowns2 = new THREE.InstancedMesh(geo('crownI2', () => new THREE.ConeGeometry(0.8, 1.8, 6)), M.foliageDark, n);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  points.forEach((p, i) => {
    const s = p.s || 1;
    o.position.set(p.x, p.y + 0.4 * s, p.z);
    o.rotation.set(0, p.x * 3.1, 0);
    o.scale.setScalar(s);
    o.updateMatrix();
    trunks.setMatrixAt(i, o.matrix);
    const cone = i % 3 === 0;
    o.position.set(p.x, p.y + (cone ? 1.5 : 1.35) * s, p.z);
    o.scale.set(0.8 * s, (cone ? 1 : 1.05) * s, 0.8 * s);
    o.updateMatrix();
    (cone ? crowns2 : crowns).setMatrixAt(i, o.matrix);
    // ocultar la instancia que no toca
    o.scale.setScalar(0);
    o.updateMatrix();
    (cone ? crowns : crowns2).setMatrixAt(i, o.matrix);
    c.setHSL(0.27 + Math.sin(i) * 0.03, 0.3, 0.2 + (i % 5) * 0.02);
    crowns.setColorAt(i, c);
  });
  crowns.castShadow = crowns2.castShadow = true;
  g.add(trunks, crowns, crowns2);
  return g;
}

export function scatterRocks(M, points) {
  const n = points.length;
  const m = new THREE.InstancedMesh(geo('rockI', () => new THREE.DodecahedronGeometry(1, 0)), M.rock, n);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  points.forEach((p, i) => {
    o.position.set(p.x, p.y, p.z);
    o.rotation.set(i * 1.7, i * 2.3, i * 0.9);
    o.scale.set(p.s * (0.8 + (i % 3) * 0.2), p.s * (0.6 + (i % 4) * 0.15), p.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    c.setHSL(0.08, 0.08, 0.2 + (i % 6) * 0.025);
    m.setColorAt(i, c);
  });
  m.receiveShadow = true;
  return m;
}

export function scatterLamps(M, points) {
  const g = new THREE.Group();
  const n = points.length;
  const posts = new THREE.InstancedMesh(geo('lampPost', () => new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6)), M.graphite, n);
  const bulbs = new THREE.InstancedMesh(geo('lampBulb', () => new THREE.SphereGeometry(0.14, 10, 8)), M.warmGlow, n);
  const o = new THREE.Object3D();
  points.forEach((p, i) => {
    o.position.set(p.x, p.y + 0.8, p.z);
    o.updateMatrix();
    posts.setMatrixAt(i, o.matrix);
    o.position.set(p.x, p.y + 1.66, p.z);
    o.updateMatrix();
    bulbs.setMatrixAt(i, o.matrix);
  });
  g.add(posts, bulbs);
  return g;
}

// Plataforma elevada con borde de roca: la "isla" sobre la que vive cada estación.
export function makePlatform(M, shape, top, opts = {}) {
  const g = new THREE.Group();
  const depth = top + 3;
  const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2, curveSegments: 32 });
  geom.rotateX(-Math.PI / 2);
  const side = new THREE.Mesh(geom, M.rockDark);
  side.position.y = -3;
  side.receiveShadow = true;
  g.add(side);
  const capGeom = new THREE.ShapeGeometry(shape, 32);
  capGeom.rotateX(-Math.PI / 2);
  const cap = new THREE.Mesh(capGeom, opts.capMat || M.concrete);
  cap.position.y = top + 0.31;
  cap.receiveShadow = true;
  g.add(cap);
  // Barandilla en el contorno.
  if (opts.rail !== false) {
    const pts = shape.getSpacedPoints(opts.railCount || 80);
    const railMat = M.graphiteLight;
    const posts = new THREE.InstancedMesh(geo('railPost', () => new THREE.BoxGeometry(0.06, 0.55, 0.06)), railMat, pts.length);
    const o = new THREE.Object3D();
    pts.forEach((p, i) => {
      o.position.set(p.x, top + 0.58, -p.y);
      o.updateMatrix();
      posts.setMatrixAt(i, o.matrix);
    });
    g.add(posts);
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, top + 0.86, -p.y)), true);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.035, 4, true), railMat);
    g.add(rail);
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

export function screen(map, w, h, intensity = 1.4) {
  const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: intensity, roughness: 0.4 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}
