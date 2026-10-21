import * as THREE from 'three';
import * as K from './kit.js';
import * as T from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Alturas de cada plataforma (tapa) y su suelo transitable.
const TOP = { s1: 0, s2: 1, s3: 1, s4: 3, sA: 6, sB: 3, s5: 0.5, s6: 9 };
const F = Object.fromEntries(Object.entries(TOP).map(([k, v]) => [k, v + 0.31]));

// Centros de estación en el mismo sistema de coordenadas.
export const STATIONS = {
  s1: V(-58, F.s1, 14),
  s2: V(-30, F.s2, 4),
  s3: V(-6, F.s3, -2),
  s4: V(16, F.s4, -8),
  sA: V(19, F.sA, -28),
  sB: V(34, F.sB, -9),
  s5: V(38, F.s5, 20),
  s6: V(60, F.s6, -20),
};

function bridge(M, a, b, lamps, width = 3) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const deck = new THREE.Group();
  deck.position.copy(mid);
  deck.lookAt(b);
  deck.add(K.box(width, 0.4, len + 1.2, M.concreteLight, 0, -0.4, 0));
  [-1, 1].forEach((side) => {
    deck.add(K.box(0.3, 0.14, len + 1.2, M.concreteLight, side * (width / 2 - 0.15), 0, 0));
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len + 1.2, 8), M.darkSteel);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * (width / 2 - 0.15), 0.95, 0);
    deck.add(rail);
    for (let i = 0; i <= Math.ceil(len / 1.4); i++) {
      const post = K.cyl(0.035, 0.035, 0.82, M.darkSteel, 6);
      post.position.set(side * (width / 2 - 0.15), 0.55, -len / 2 + i * 1.4);
      deck.add(post);
    }
  });
  g.add(deck);
  // balizas a lo largo del puente
  for (let t = 0.2; t < 0.9; t += 0.3) {
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    const side = new THREE.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(width / 2 - 0.4);
    lamps.push({ x: p.x + side.x, y: p.y - 0.31, z: p.z + side.z });
  }
  const n = Math.max(1, Math.floor(len / 6));
  for (let i = 1; i <= n; i++) {
    const p = new THREE.Vector3().lerpVectors(a, b, i / (n + 1));
    g.add(K.rbox(0.8, p.y + 2.2, 0.8, M.concrete, p.x, -2.6, p.z, 0.06));
  }
  return g;
}

function tube(points, radius, mat, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  const len = curve.getLength();
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(len * 3)), radius, 6, closed), mat);
  return { mesh: m, curve, len };
}

function traceMaterial(color, pulse, scale = 1.45) {
  const map = pulse.clone();
  map.needsUpdate = true;
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(scale), map });
}

export function buildWorld(scene) {
  const M = K.makeMaterials();
  const root = new THREE.Group();
  scene.add(root);
  const anim = [];
  const pulse = T.pulseTexture();
  const lamps = [];
  const shadows = []; // sombras de contacto { x, y, z, w, d, r }
  const dyn = (o) => {
    o.userData.dynamic = true;
    return o;
  };

  const water = new THREE.Mesh(new THREE.CircleGeometry(1600, 96), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2.6;
  water.receiveShadow = true;
  root.add(water);

  // ---------- Plataformas y rocas ----------
  const plat = (key, shape, opts) => {
    const p = K.makePlatform(M, shape, TOP[key], opts);
    p.position.set(STATIONS[key].x, 0, STATIONS[key].z);
    root.add(p);
  };
  plat('s1', K.circleShape(13));
  plat('s2', K.roundedRect(22, 18, 2.5));
  plat('s3', K.roundedRect(18, 16, 2.5));
  plat('s4', K.circleShape(10));
  plat('sA', K.roundedRect(12, 8, 1.6));
  plat('sB', K.roundedRect(12, 10, 1.6));
  plat('s5', K.roundedRect(34, 20, 3));
  plat('s6', K.circleShape(10), { railCount: 64 });

  const rocks = [];
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const r = 10.5 + (i % 4) * 0.9;
    rocks.push({ x: 60 + Math.cos(a) * r, y: -1 + (i % 7) * 1.3, z: -20 + Math.sin(a) * r, s: 1.6 + (i % 5) * 0.4 });
  }
  const ring = (cx, cz, rx, rz, n, y0 = -2) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.3;
      rocks.push({ x: cx + Math.cos(a) * rx, y: y0 + (i % 3) * 0.6, z: cz + Math.sin(a) * rz, s: 0.9 + (i % 4) * 0.45 });
    }
  };
  ring(-58, 14, 13.6, 13.6, 40);
  ring(-30, 4, 12, 10, 34);
  ring(-6, -2, 10, 9, 30);
  ring(16, -8, 10.6, 10.6, 30, -1);
  ring(38, 20, 17.6, 10.8, 50);
  ring(19, -28, 6.6, 4.6, 16, 0);
  ring(34, -9, 6.6, 5.6, 16, -1);
  root.add(K.scatterRocks(M, rocks));

  [
    [V(-46.2, F.s1, 9.2), V(-40.6, F.s2, 7.4)],
    [V(-19.2, F.s2, 2), V(-14.8, F.s3, 0)],
    [V(3.2, F.s3, -3.2), V(6.6, F.s4, -6)],
    [V(16.6, F.s4, -17.8), V(18, F.sA, -24.2)],
    [V(25.8, F.s4, -8), V(28.2, F.sB, -8)],
    [V(19, F.s4, 1.6), V(24.8, F.s5, 10.4)],
    [V(54.2, F.s5, 11), V(60.6, F.s6, -10.4)],
  ].forEach(([a, b]) => root.add(bridge(M, a, b, lamps)));

  // ---------- 1 · Depósito de recogida ----------
  const s1 = STATIONS.s1;
  const stacks = [];
  for (let px = 0; px < 4; px++) {
    for (let pz = 0; pz < 3; pz++) {
      const bx = s1.x - 8 + px * 3.6;
      const bz = s1.z - 6 + pz * 3.4;
      root.add(K.box(3, 0.08, 2.6, M.wood, bx, s1.y + 0.14, bz));
      for (let k = -1; k <= 1; k++) root.add(K.box(3, 0.14, 0.2, M.wood, bx, s1.y, bz + k * 1.1));
      shadows.push({ x: bx, y: s1.y, z: bz, w: 3.8, d: 3.4 });
      const layers = 1 + ((px + pz * 2) % 3);
      for (let l = 0; l < layers; l++) {
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) stacks.push({ x: bx - 0.75 + i * 1.5, y: s1.y + 0.22 + l * 1.24, z: bz - 0.55 + j * 1.1, s: 0.88 });
        }
      }
    }
  }
  root.add(K.batteryInstances(M, stacks));
  // jaulas de recogida con marco de acero
  [[-9, 6], [-6, 7.4]].forEach(([dx, dz]) => {
    const c = new THREE.Group();
    [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]].forEach(([x, z]) => c.add(K.box(0.07, 2, 0.07, M.darkSteel, x, 0, z)));
    [0.05, 1, 1.95].forEach((y) => {
      c.add(K.box(2.6, 0.05, 0.05, M.darkSteel, 0, y, -1.1));
      c.add(K.box(2.6, 0.05, 0.05, M.darkSteel, 0, y, 1.1));
      c.add(K.box(0.05, 0.05, 2.2, M.darkSteel, -1.3, y, 0));
      c.add(K.box(0.05, 0.05, 2.2, M.darkSteel, 1.3, y, 0));
    });
    for (let k = -1.1; k <= 1.1; k += 0.28) c.add(K.box(0.02, 1.9, 0.02, M.steel, k, 0.05, 1.1));
    c.position.set(s1.x + dx, s1.y, s1.z + dz);
    root.add(c);
    shadows.push({ x: s1.x + dx, y: s1.y, z: s1.z + dz, w: 3.4, d: 3 });
  });
  // carretilla elevadora
  const fork = new THREE.Group();
  fork.add(K.rbox(1.4, 0.8, 2.2, M.amberMatte, 0, 0.3, 0, 0.12));
  fork.add(K.rbox(1.36, 0.5, 0.7, M.graphite, 0, 1.1, -0.6, 0.08));
  [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.6], [0.6, 0.6]].forEach(([x, z]) => fork.add(K.box(0.06, 1.3, 0.06, M.darkSteel, x, 1.1, z)));
  fork.add(K.box(1.4, 0.06, 1.3, M.darkSteel, 0, 2.4, 0.05));
  fork.add(K.box(0.1, 2.8, 0.1, M.darkSteel, -0.45, 0.2, 1.2));
  fork.add(K.box(0.1, 2.8, 0.1, M.darkSteel, 0.45, 0.2, 1.2));
  fork.add(K.box(0.12, 0.05, 1.2, M.steel, -0.3, 0.32, 1.85));
  fork.add(K.box(0.12, 0.05, 1.2, M.steel, 0.3, 0.32, 1.85));
  [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([x, z]) => {
    const w = K.cyl(0.3, 0.3, 0.24, M.rubber, 18);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.3, z);
    fork.add(w);
  });
  fork.position.set(s1.x + 4.5, s1.y, s1.z + 2);
  fork.rotation.y = -0.8;
  root.add(fork);
  shadows.push({ x: s1.x + 4.5, y: s1.y, z: s1.z + 2.3, w: 2.4, d: 3.6, r: -0.8 });
  // batería protagonista sobre una peana con anillo lima
  const heroPos = V(s1.x + 7, s1.y, s1.z + 7);
  const plinth = K.cyl(2.8, 3, 0.35, M.concreteLight, 64);
  plinth.position.set(heroPos.x, heroPos.y + 0.17, heroPos.z);
  root.add(plinth);
  const heroRing = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.05, 8, 128), M.lime);
  heroRing.rotation.x = Math.PI / 2;
  heroRing.position.set(heroPos.x, heroPos.y + 0.36, heroPos.z);
  root.add(heroRing);
  const hero = K.makeBattery(M, { scale: 2.1 });
  hero.position.set(heroPos.x, heroPos.y + 0.35, heroPos.z);
  hero.rotation.y = 0.55;
  root.add(hero);
  shadows.push({ x: heroPos.x, y: heroPos.y + 0.35, z: heroPos.z, w: 4.4, d: 2.8, r: 0.55 });
  const heroSpot = new THREE.SpotLight('#ffd09a', 120, 18, 0.5, 0.6, 1.5);
  heroSpot.position.set(heroPos.x + 3, heroPos.y + 9, heroPos.z + 5);
  heroSpot.target.position.copy(heroPos);
  root.add(heroSpot, heroSpot.target);

  // ---------- 2 · Taller ----------
  const s2 = STATIONS.s2;
  const shop = K.makeCutaway(M, { w: 16, d: 12, h: 6.5 });
  shop.position.set(s2.x, s2.y, s2.z - 1);
  root.add(shop);
  const car = K.makeCar(M, { hoodOpen: true });
  const lift = K.makeLift(M, car);
  lift.position.set(s2.x - 3.6, s2.y, s2.z - 3);
  root.add(lift);
  shadows.push({ x: s2.x - 3.6, y: s2.y, z: s2.z - 3, w: 5.6, d: 4.4 });
  // pared de herramientas y puesto de trabajo con monitor
  const peg = K.pegboard(M, 4.4, 1.8);
  peg.position.set(s2.x + 3.2, s2.y + 2.2, s2.z - 6.75);
  root.add(peg);
  [1.6, 3.2, 4.8].forEach((dx, i) => {
    const c = K.cabinet(M, { w: 1.5, h: 0.95, d: 0.7, drawers: i === 1 ? 2 : 4, top: M.stoneTop });
    c.position.set(s2.x + dx, s2.y, s2.z - 6.4);
    root.add(c);
  });
  shadows.push({ x: s2.x + 3.2, y: s2.y, z: s2.z - 6.3, w: 5.2, d: 1.3 });
  const mon = K.framedScreen(M, T.gaugeTexture('wave'), 1.3, 0.8);
  mon.position.set(s2.x + 3.2, s2.y + 1.95, s2.z - 6.5);
  root.add(mon);
  // carro de herramientas móvil
  const cart = K.cabinet(M, { w: 1.3, h: 1.0, d: 0.65, drawers: 5, top: M.steel });
  cart.position.set(s2.x - 6.2, s2.y, s2.z + 1.6);
  cart.rotation.y = 0.4;
  root.add(cart);
  shadows.push({ x: s2.x - 6.2, y: s2.y, z: s2.z + 1.6, w: 1.8, d: 1.2, r: 0.4 });
  // banco principal: cajonera, encimera clara, alfombrilla y la batería identificada
  const bench = new THREE.Group();
  const base = K.cabinet(M, { w: 3.6, h: 0.95, d: 1.5, drawers: 3, top: M.stoneTop });
  bench.add(base);
  bench.add(K.box(1.9, 0.015, 1.2, M.rubber, 0.35, 1.11, 0));
  const b2 = K.makeBattery(M, { scale: 0.85 });
  b2.position.set(0.35, 1.125, 0);
  b2.rotation.y = -0.2;
  bench.add(b2);
  // lector QR en su base, con acento lima
  const scanner = new THREE.Group();
  scanner.add(K.rbox(0.36, 0.08, 0.36, M.graphite, 0, 0, 0, 0.03));
  scanner.add(K.rbox(0.14, 0.5, 0.18, M.graphite, 0, 0.06, 0, 0.05));
  scanner.add(K.rbox(0.22, 0.2, 0.42, M.graphite, 0, 0.5, 0.1, 0.06));
  scanner.add(K.box(0.15, 0.05, 0.02, M.limeInsert, 0, 0.58, 0.32));
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(1.3), transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const beam = dyn(new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 24, 1, true), beamMat));
  beam.rotation.x = -Math.PI / 2 + 0.3;
  beam.position.set(0, 0.58, 1.0);
  scanner.add(beam);
  scanner.position.set(-1.25, 1.12, 0.3);
  scanner.rotation.y = 0.85;
  bench.add(scanner);
  bench.position.set(s2.x + 2.6, s2.y, s2.z + 2.2);
  root.add(bench);
  shadows.push({ x: s2.x + 2.6, y: s2.y, z: s2.z + 2.2, w: 4.4, d: 2.2 });
  anim.push((t) => {
    beamMat.opacity = 0.22 + Math.sin(t * 6) * 0.08;
  });
  // ficha digital flotante
  const record = dyn(K.screen(T.recordPanelTexture(), 2.2, 2.75, 0.9));
  record.material.transparent = true;
  record.position.set(s2.x + 5.6, s2.y + 3.4, s2.z + 2.4);
  record.rotation.y = -0.35;
  root.add(record);
  anim.push((t) => {
    record.position.y = s2.y + 3.4 + Math.sin(t * 1.4) * 0.12;
  });
  // neumáticos con llanta y estantería de baterías
  for (let i = 0; i < 3; i++) {
    const tire = new THREE.Mesh(K.geo('shopTire', () => new THREE.TorusGeometry(0.42, 0.17, 12, 28)), M.rubber);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(s2.x + 6.6, s2.y + 0.17 + i * 0.34, s2.z - 2.6);
    root.add(tire);
  }
  shadows.push({ x: s2.x + 6.6, y: s2.y, z: s2.z - 2.6, w: 1.6, d: 1.6 });
  const rack = K.shelf(M, { w: 0.8, h: 3, d: 2.6, levels: 3 });
  rack.position.set(s2.x - 7.3, s2.y, s2.z - 3.6);
  root.add(rack);
  const rackB = [];
  for (let l = 0; l < 3; l++) for (let i = 0; i < 2; i++) rackB.push({ x: s2.x - 7.3, y: s2.y + 0.2 + l, z: s2.z - 4.2 + i * 1.2, r: Math.PI / 2, s: 0.5 });
  root.add(K.batteryInstances(M, rackB));

  // ---------- 3 · Laboratorio de diagnóstico ----------
  const s3 = STATIONS.s3;
  const lab = K.makeCutaway(M, { w: 14, d: 11, h: 6, roofDepth: 0.5 });
  lab.position.set(s3.x, s3.y, s3.z - 1);
  root.add(lab);
  const tb = new THREE.Group();
  [-1.2, 1.2].forEach((x) => {
    const c = K.cabinet(M, { w: 2.3, h: 0.9, d: 1.6, drawers: 3, mat: M.ivoryPanel });
    c.position.x = x;
    tb.add(c);
  });
  tb.add(K.box(4.8, 0.08, 1.75, M.stoneTop, 0, 1.0, 0));
  const b3 = K.makeBattery(M, { scale: 0.85 });
  b3.position.set(-0.9, 1.08, 0.1);
  tb.add(b3);
  // comprobador con pantalla, mando y rejilla
  const tester = new THREE.Group();
  tester.add(K.rbox(1.25, 0.62, 0.75, M.graphite, 0, 0, 0, 0.05));
  const dial = K.screen(T.gaugeTexture('wave'), 0.62, 0.36, 0.95);
  dial.position.set(-0.18, 0.34, 0.38);
  tester.add(dial);
  const knob = K.cyl(0.1, 0.1, 0.06, M.steel, 20);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.4, 0.38, 0.39);
  tester.add(knob);
  const knobRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 24), M.limeInsert);
  knobRing.position.set(0.4, 0.38, 0.39);
  tester.add(knobRing);
  for (let k = 0; k < 5; k++) tester.add(K.box(0.02, 0.32, 0.06, M.panel, -0.635, 0.15, -0.25 + k * 0.12));
  for (let k = 0; k < 3; k++) tester.add(K.box(0.1, 0.06, 0.03, M.panel, 0.25 + k * 0.13, 0.12, 0.38));
  tester.position.set(1.1, 1.08, -0.1);
  tb.add(tester);
  // pinzas: cable ámbar (+) y grafito (−) desde los bornes al comprobador
  [[-1.41, M.amberMatte, 0.62], [-0.39, M.rubber, 0.42]].forEach(([x, mat, sag]) => {
    tb.add(K.pipe([V(x, 2.0, -0.1), V(x * 0.5, 1.6 + sag * 0.3, 0.35), V(0.2, 1.15, 0.3), V(0.55, 1.25, 0.28)], 0.025, mat, 40));
  });
  // lupa con luz
  const lamp = new THREE.Group();
  lamp.add(K.cyl(0.16, 0.2, 0.06, M.darkSteel, 16));
  lamp.add(K.pipe([V(0, 0.03, 0), V(0, 0.9, 0), V(0.6, 1.5, 0.2), V(1.1, 1.3, 0.4)], 0.025, M.darkSteel, 24));
  const ringHead = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 10, 32), M.darkSteel);
  ringHead.rotation.x = Math.PI / 2;
  ringHead.position.set(1.1, 1.25, 0.4);
  lamp.add(ringHead);
  const ringLight = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24), M.warmGlow);
  ringLight.rotation.x = Math.PI / 2;
  ringLight.position.set(1.1, 1.22, 0.4);
  lamp.add(ringLight);
  lamp.position.set(-2.3, 1.04, -0.5);
  tb.add(lamp);
  const lampSpot = new THREE.SpotLight('#ffd7a0', 30, 5, 0.6, 0.7, 1.6);
  lampSpot.position.set(-1.2, 2.3, -0.1);
  lampSpot.target.position.set(-0.9, 1, 0.1);
  tb.add(lampSpot, lampSpot.target);
  tb.position.set(s3.x + 0.5, s3.y, s3.z + 0.6);
  root.add(tb);
  shadows.push({ x: s3.x + 0.5, y: s3.y, z: s3.z + 0.6, w: 5.6, d: 2.4 });
  // pantallas de medición enmarcadas
  const w1 = K.framedScreen(M, T.gaugeTexture('wave'), 3.0, 1.85);
  w1.position.set(s3.x - 2.2, s3.y + 3.6, s3.z - 6.3);
  root.add(w1);
  const w2 = K.framedScreen(M, T.gaugeTexture('dial'), 2.3, 1.45);
  w2.position.set(s3.x + 2.2, s3.y + 3.5, s3.z - 6.3);
  root.add(w2);
  // escritorio con monitor, estantería con baterías en espera y taburete
  const desk = K.cabinet(M, { w: 2.6, h: 0.75, d: 1.1, drawers: 2, top: M.stoneTop });
  desk.position.set(s3.x + 4.4, s3.y, s3.z - 3.6);
  root.add(desk);
  const mon3 = K.framedScreen(M, T.gaugeTexture('bars'), 1.1, 0.66);
  mon3.position.set(s3.x + 4.4, s3.y + 1.55, s3.z - 3.85);
  root.add(mon3);
  shadows.push({ x: s3.x + 4.4, y: s3.y, z: s3.z - 3.6, w: 3.2, d: 1.6 });
  const rack3 = K.shelf(M, { w: 0.8, h: 3.4, d: 4, levels: 3 });
  rack3.position.set(s3.x - 6.2, s3.y, s3.z - 2.2);
  root.add(rack3);
  const shelfB = [];
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3; i++) shelfB.push({ x: s3.x - 6.2, y: s3.y + 0.2 + l * 1.13, z: s3.z - 3.4 + i * 1.2, r: Math.PI / 2, s: 0.52 });
  root.add(K.batteryInstances(M, shelfB));
  const stool = new THREE.Group();
  stool.add(K.cyl(0.3, 0.34, 0.04, M.darkSteel, 18));
  stool.add(K.cyl(0.04, 0.04, 0.7, M.steel, 10).translateY(0.37));
  stool.add(K.cyl(0.32, 0.3, 0.12, M.rubber, 24).translateY(0.76));
  stool.position.set(s3.x + 1.2, s3.y, s3.z + 2.4);
  root.add(stool);

  // ---------- 4 · Cruce con tres rutas ----------
  const s4 = STATIONS.s4;
  root.add(K.cyl(3.2, 3.3, 0.18, M.concreteLight, 64).translateX(s4.x).translateY(s4.y + 0.09).translateZ(s4.z));
  root.add(K.cyl(1.7, 1.75, 0.45, M.concreteLight, 48).translateX(s4.x).translateY(s4.y + 0.22).translateZ(s4.z));
  const sA = STATIONS.sA;
  const canopy = new THREE.Group();
  [[-4, -2.5], [4, -2.5], [-4, 2.5], [4, 2.5]].forEach(([x, z]) => canopy.add(K.rbox(0.25, 3.4, 0.25, M.darkSteel, x, 0, z, 0.04)));
  canopy.add(K.rbox(9.2, 0.25, 6.2, M.panel, 0, 3.4, 0, 0.06));
  canopy.add(K.box(8, 0.05, 0.18, M.warmGlow, 0, 3.36, 0));
  canopy.position.set(sA.x, sA.y, sA.z - 0.5);
  root.add(canopy);
  const carA = K.makeCar(M, { paint: new THREE.MeshPhysicalMaterial({ color: '#5c6166', metalness: 0.55, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }) });
  carA.position.set(sA.x - 1.2, sA.y, sA.z - 0.5);
  carA.rotation.y = 0.15;
  root.add(carA);
  shadows.push({ x: sA.x - 1.2, y: sA.y, z: sA.z - 0.5, w: 5, d: 2.6, r: 0.15 });
  const sB = STATIONS.sB;
  const evalLab = K.makeCutaway(M, { w: 8, d: 6.5, h: 4.2, roofDepth: 0.6, light: 10, glassFront: true });
  evalLab.position.set(sB.x + 0.5, sB.y, sB.z - 0.8);
  root.add(evalLab);
  const rackE = K.shelf(M, { w: 3.4, h: 3.2, d: 0.8, levels: 3 });
  rackE.position.set(sB.x + 2.2, sB.y, sB.z - 3.4);
  root.add(rackE);
  const modB = [];
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3; i++) modB.push({ x: sB.x + 1.1 + i * 1.1, y: sB.y + 0.2 + l * 1.07, z: sB.z - 3.4, s: 0.5 });
  root.add(K.batteryInstances(M, modB));
  const evalBench = K.cabinet(M, { w: 2.4, h: 0.9, d: 1.1, drawers: 3, mat: M.ivoryPanel, top: M.stoneTop });
  evalBench.position.set(sB.x - 1.2, sB.y, sB.z - 1);
  root.add(evalBench);
  const evalScreen = K.framedScreen(M, T.gaugeTexture('wave'), 1.3, 0.8);
  evalScreen.position.set(sB.x - 1.2, sB.y + 1.7, sB.z - 1.4);
  root.add(evalScreen);
  const sign = (kind, x, y, z, ry) => {
    const g = new THREE.Group();
    g.add(K.cyl(0.06, 0.07, 1.7, M.darkSteel, 8).translateY(0.85));
    const face = K.framedScreen(M, T.signTexture(kind), 1.1, 1.1, 0.9);
    face.position.y = 2.25;
    g.add(face);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    root.add(g);
  };
  sign('service', s4.x - 2.6, s4.y, s4.z - 6.6, 0.3);
  sign('second', s4.x + 6.6, s4.y, s4.z - 3.4, -0.5);
  sign('recycle', s4.x + 5.6, s4.y, s4.z + 4.8, -0.2);

  // ---------- 5 · Gestor autorizado de reciclaje ----------
  const s5 = STATIONS.s5;
  root.add(K.box(30, 1.4, 0.4, M.concrete, s5.x, s5.y, s5.z + 9.4));
  root.add(K.box(0.4, 1.4, 18, M.concrete, s5.x + 15.6, s5.y, s5.z));
  const intake = K.makeCutaway(M, { w: 7, d: 6, h: 5, roofDepth: 0.7, light: 12 });
  intake.position.set(s5.x - 11, s5.y, s5.z - 4.5);
  root.add(intake);
  const rsign = K.framedScreen(M, T.recycleWallTexture(), 2.2, 2.2, 0.4);
  rsign.position.set(s5.x - 11, s5.y + 3.2, s5.z - 7.2);
  root.add(rsign);
  // cinta transportadora con rodillos, bastidor y motor
  const belt = new THREE.Group();
  const beltLen = 18;
  belt.add(K.box(beltLen, 0.12, 1.5, M.rubber, 0, 1.06, 0));
  [-0.82, 0.82].forEach((z) => {
    belt.add(K.box(beltLen, 0.26, 0.1, M.darkSteel, 0, 0.88, z));
    belt.add(K.box(beltLen, 0.08, 0.06, M.amberMatte, 0, 1.3, z));
  });
  const rollers = new THREE.InstancedMesh(K.geo('roller', () => new THREE.CylinderGeometry(0.11, 0.11, 1.6, 14).rotateX(Math.PI / 2)), M.steel, 36);
  const ro = new THREE.Object3D();
  for (let i = 0; i < 36; i++) {
    ro.position.set(-beltLen / 2 + 0.25 + i * (beltLen - 0.5) / 35, 0.98, 0);
    ro.updateMatrix();
    rollers.setMatrixAt(i, ro.matrix);
  }
  rollers.castShadow = true;
  belt.add(rollers);
  for (let i = 0; i < 7; i++) {
    const x = -beltLen / 2 + 1 + i * 2.7;
    belt.add(K.box(0.12, 0.85, 0.12, M.darkSteel, x, 0, 0.8));
    belt.add(K.box(0.12, 0.85, 0.12, M.darkSteel, x, 0, -0.8));
    belt.add(K.box(0.1, 0.08, 1.6, M.darkSteel, x, 0.3, 0));
  }
  belt.add(K.rbox(0.8, 0.6, 0.7, M.darkSteel, -beltLen / 2 + 1.2, 0.2, 1.15, 0.05));
  belt.add(K.box(0.18, 0.08, 0.02, M.amberGlow, -beltLen / 2 + 1.2, 0.6, 1.51));
  belt.position.set(s5.x - 1, s5.y, s5.z - 1.5);
  belt.rotation.y = -0.12;
  root.add(belt);
  shadows.push({ x: s5.x - 1, y: s5.y, z: s5.z - 1.5, w: 19, d: 2.4, r: -0.12 });
  const riders = [];
  for (let i = 0; i < 6; i++) {
    const b = dyn(K.compact(K.makeBattery(M, { scale: 0.62, label: false })));
    belt.add(b);
    riders.push(b);
  }
  anim.push((t) => {
    riders.forEach((b, i) => {
      const u = (t * 0.06 + i / riders.length) % 1;
      b.position.set(-beltLen / 2 + 0.8 + u * (beltLen - 3.5), 1.12, 0);
    });
  });
  // trituradora: carcasa de paneles atornillados, boca oscura y tolva
  const tower = new THREE.Group();
  tower.add(K.rbox(4.4, 4.6, 4, M.steel, 0, 0, 0, 0.08));
  for (let x = -1.5; x <= 1.5; x += 1.5) tower.add(K.box(0.03, 4.4, 0.03, M.darkSteel, x, 0.1, 2.01));
  tower.add(K.box(0.03, 0.03, 4.4, M.darkSteel, 2.21, 2.3, 0));
  tower.add(K.box(2.4, 1.2, 0.2, M.panel, -2.0, 0.6, 0).rotateY(Math.PI / 2));
  tower.add(K.box(0.05, 0.1, 2.2, M.warmGlow, -2.22, 1.9, 0));
  tower.add(K.rbox(3, 1.6, 3, M.darkSteel, 0, 4.6, 0, 0.06));
  // andamio ámbar con escalera
  const scaffold = new THREE.Group();
  [[-2.4, -2.2], [2.4, -2.2], [-2.4, 2.2], [2.4, 2.2]].forEach(([x, z]) => scaffold.add(K.box(0.08, 6.6, 0.08, M.amberMatte, x, 0, z)));
  [3, 4.6, 6.6].forEach((y) => {
    scaffold.add(K.box(4.8, 0.06, 0.06, M.amberMatte, 0, y, 2.2));
    scaffold.add(K.box(4.8, 0.06, 0.06, M.amberMatte, 0, y, -2.2));
    scaffold.add(K.box(0.06, 0.06, 4.4, M.amberMatte, 2.4, y, 0));
  });
  for (let y = 0.4; y < 6.4; y += 0.4) scaffold.add(K.box(0.5, 0.04, 0.04, M.amberMatte, 2.62, y, 1.6));
  tower.add(scaffold);
  // tubería de extracción con codos
  tower.add(K.pipe([V(0, 6.2, -1), V(0, 8.2, -1), V(0.6, 8.8, -1.3), V(4, 8.8, -2.2), V(4.6, 8.2, -2.4), V(4.6, 3, -2.4)], 0.42, M.steel, 80));
  tower.add(K.rbox(1.8, 3, 1.8, M.steel, 4.6, 0, -2.4, 0.1));
  tower.position.set(s5.x + 10, s5.y, s5.z - 4.5);
  root.add(tower);
  shadows.push({ x: s5.x + 10, y: s5.y, z: s5.z - 4.5, w: 6.4, d: 6 });
  // contenedores con materiales recuperados, separados
  const fills = [
    ['ingot', M.lead],
    ['chunk', M.copper],
    ['shard', M.shard],
    ['rod', M.steel],
    ['ingot', M.lead],
  ];
  const fillGeo = {
    ingot: () => new THREE.BoxGeometry(0.42, 0.16, 0.2),
    chunk: () => new THREE.DodecahedronGeometry(0.2, 0),
    shard: () => new THREE.TetrahedronGeometry(0.24, 0),
    rod: () => new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8),
  };
  fills.forEach(([kind, mat], i) => {
    const bx = s5.x - 6 + i * 4.2;
    const bz = s5.z + 5.6;
    const bin = new THREE.Group();
    bin.add(K.box(3.4, 0.2, 2.6, M.darkSteel, 0, 0, 0));
    bin.add(K.box(3.4, 1.6, 0.14, M.darkSteel, 0, 0, 1.25));
    bin.add(K.box(3.4, 1.6, 0.14, M.darkSteel, 0, 0, -1.25));
    bin.add(K.box(0.14, 1.6, 2.6, M.darkSteel, 1.63, 0, 0));
    bin.add(K.box(0.14, 1.6, 2.6, M.darkSteel, -1.63, 0, 0));
    bin.add(K.box(3.5, 0.08, 0.2, M.steel, 0, 1.6, 1.25));
    bin.add(K.box(3.5, 0.08, 0.2, M.steel, 0, 1.6, -1.25));
    bin.add(K.box(0.6, 0.12, 0.06, M.steel, 0, 1.05, 1.34));
    const pile = new THREE.InstancedMesh(K.geo(`fill-${kind}`, fillGeo[kind]), mat, 110);
    const o = new THREE.Object3D();
    for (let k = 0; k < 110; k++) {
      const r = Math.sqrt((k * 0.6180339) % 1);
      const a = k * 2.399;
      o.position.set(Math.cos(a) * r * 1.4, 0.55 + (1 - r) * 0.95 + (k % 3) * 0.07, Math.sin(a) * r * 1.05);
      o.rotation.set(k * 0.7, k * 1.3, k * 0.3);
      o.scale.setScalar(0.8 + (k % 4) * 0.12);
      o.updateMatrix();
      pile.setMatrixAt(k, o.matrix);
    }
    pile.castShadow = true;
    bin.add(pile);
    bin.position.set(bx, s5.y, bz);
    root.add(bin);
    shadows.push({ x: bx, y: s5.y, z: bz, w: 4.2, d: 3.4 });
  });
  const plantLight = new THREE.PointLight('#ffc27a', 34, 26, 1.6);
  plantLight.position.set(s5.x + 2, s5.y + 7, s5.z + 3);
  root.add(plantLight);

  // ---------- 6 · Centro de trazabilidad ----------
  const s6 = STATIONS.s6;
  root.add(K.cyl(4.6, 4.8, 0.3, M.concreteLight, 64).translateX(s6.x).translateY(s6.y + 0.15).translateZ(s6.z));
  root.add(K.cyl(3.6, 3.7, 0.3, M.concreteLight, 64).translateX(s6.x).translateY(s6.y + 0.45).translateZ(s6.z));
  const podRing = new THREE.Mesh(new THREE.TorusGeometry(4.75, 0.05, 8, 140), M.lime);
  podRing.rotation.x = Math.PI / 2;
  podRing.position.set(s6.x, s6.y + 0.32, s6.z);
  root.add(podRing);
  // la pantalla mira hacia el este, de cara a la cámara que contempla el mundo detrás
  const FACE = 0.93;
  const lat = V(Math.cos(FACE), 0, -Math.sin(FACE));
  const passport = new THREE.Group();
  passport.add(K.rbox(3.7, 5.8, 0.45, M.darkSteel, 0, 0, 0, 0.08));
  const pscreen = K.screen(T.passportTexture(), 3.2, 4.8, 1.0);
  pscreen.position.set(0, 2.9, 0.23);
  passport.add(pscreen);
  passport.position.set(s6.x - 1.2, s6.y + 0.6, s6.z - 1.4);
  passport.rotation.y = FACE;
  root.add(passport);
  [[-3.3, 'wave', 0.45], [3.3, 'bars', -0.45]].forEach(([dx, kind, ry]) => {
    const g = new THREE.Group();
    g.add(K.cyl(0.08, 0.08, 1.3, M.darkSteel, 8).translateY(0.65));
    const s = K.framedScreen(M, T.gaugeTexture(kind), 2.5, 1.5);
    s.position.y = 2.05;
    g.add(s);
    g.position.set(s6.x - 1.2 + lat.x * dx, s6.y + 0.6, s6.z - 1.4 + lat.z * dx);
    g.rotation.y = FACE + ry;
    root.add(g);
  });
  const b6 = K.makeBattery(M, { scale: 0.9 });
  b6.position.set(s6.x + 1.4, s6.y + 0.6, s6.z + 1.2);
  b6.rotation.y = FACE;
  root.add(b6);
  shadows.push({ x: s6.x + 1.4, y: s6.y + 0.6, z: s6.z + 1.2, w: 1.9, d: 1.2, r: FACE });
  // jardineras con baterías expuestas en el borde de la plaza
  [-0.9, 2.4].forEach((a) => {
    const x = s6.x + Math.cos(a) * 7.2;
    const z = s6.z + Math.sin(a) * 7.2;
    root.add(K.rbox(2.2, 0.55, 1, M.concreteLight, x, s6.y, z, 0.08));
  });
  const hubLight = new THREE.PointLight('#ffd8a0', 18, 20, 1.6);
  hubLight.position.set(s6.x + 3, s6.y + 6, s6.z + 3);
  root.add(hubLight);

  // ---------- Vegetación y balizas ----------
  const trees = [];
  const edge = (cx, cz, rx, rz, n, y, from = 0, to = Math.PI * 2) => {
    for (let i = 0; i < n; i++) {
      const a = from + ((to - from) * i) / n;
      const jitter = Math.sin(i * 12.9) * 0.6;
      trees.push({ x: cx + Math.cos(a) * (rx + jitter), y, z: cz + Math.sin(a) * (rz + jitter), s: 0.8 + ((i * 7) % 5) * 0.12 });
      trees.push({ x: cx + Math.cos(a + 0.07) * (rx + 0.9), y: y - 0.2, z: cz + Math.sin(a + 0.07) * (rz + 0.9), s: 1.2, shrub: true });
      if (i % 3 === 0) lamps.push({ x: cx + Math.cos(a + 0.05) * (rx - 1.2), y, z: cz + Math.sin(a + 0.05) * (rz - 1.2) });
    }
  };
  edge(-58, 14, 11.5, 11.5, 22, F.s1, Math.PI * 0.6, Math.PI * 1.55);
  edge(16, -8, 8.6, 8.6, 18, F.s4, Math.PI * 0.85, Math.PI * 1.35);
  edge(38, 20, 16, 9, 18, F.s5, Math.PI * 0.05, Math.PI * 0.45);
  edge(60, -20, 8.8, 8.8, 20, F.s6, Math.PI * 1.1, Math.PI * 1.95);
  // arbustos en las grietas de las rocas bajo las islas
  for (let i = 0; i < 40; i++) {
    const a = i * 0.71;
    trees.push({ x: 60 + Math.cos(a) * (12 + (i % 3)), y: 0.5 + (i % 6) * 1.2, z: -20 + Math.sin(a) * (12 + (i % 3)), s: 0.9 + (i % 4) * 0.2 });
  }
  [[-58, 14, 13.4], [-30, 4, 12.2], [-6, -2, 10.4], [16, -8, 10.6], [38, 20, 17]].forEach(([cx, cz, r], k) => {
    for (let i = 0; i < 14; i++) {
      const a = i * 0.45 + k;
      trees.push({ x: cx + Math.cos(a) * r, y: -1.4 + (i % 3) * 0.5, z: cz + Math.sin(a) * r * (k === 4 ? 0.62 : 0.85), s: 1.3, shrub: true });
    }
  });
  root.add(K.scatterTrees(M, trees));

  // ---------- Traza luminosa ----------
  const traces = [];
  const mkTrace = (pts, color, r = 0.12) => {
    const t = tube(pts, r, traceMaterial(color, pulse));
    t.mesh.material.map.repeat.set(Math.max(1, t.len / 10), 1);
    root.add(t.mesh);
    traces.push(t);
    return t;
  };
  const y1 = F.s1 + 0.06;
  const y2 = F.s2 + 0.06;
  const y4 = F.s4 + 0.06;
  const y5 = F.s5 + 0.06;
  const yA = F.sA + 0.06;
  const y6 = F.s6 + 0.66;
  const main = mkTrace([
    V(-64, y1, 18), V(-56, y1, 22.5), V(-49.5, y1, 16), V(-46.2, y1, 9.2), V(-40.6, y2, 7.4),
    V(-33, y2, 8.4), V(-26.5, y2, 7.5), V(-22, y2, 4), V(-19.2, y2, 2), V(-14.8, y2, 0),
    V(-9, y2, 2.4), V(-3, y2, 1.6), V(1, y2, -1.8), V(3.2, y2, -3.2), V(6.6, y4, -6), V(11, y4, -7.6),
  ], '#C2F230');
  const ringT = mkTrace(
    Array.from({ length: 24 }, (_, i) => V(s4.x + Math.cos((i / 24) * Math.PI * 2) * 4, y4, s4.z + Math.sin((i / 24) * Math.PI * 2) * 4)),
    '#C2F230', 0.1,
  );
  ringT.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringT.curve.points, true), 96, 0.1, 6, true);
  mkTrace([V(15.5, y4, -12), V(16.2, y4, -16), V(16.6, y4, -17.8), V(18, yA, -24.2), V(18.6, yA, -27)], '#C2F230', 0.16);
  mkTrace([V(20, y4, -8.2), V(23.5, y4, -8), V(25.8, y4, -8), V(28.2, y4, -8), V(31.5, y4, -8.6)], '#E5AE50', 0.16);
  mkTrace([V(17.2, y4, -4.2), V(18.4, y4, -0.6), V(19, y4, 1.6), V(24.8, y5, 10.4), V(28.5, y5, 15), V(33, y5, 17.6)], '#F1EEE6', 0.16);
  mkTrace([V(36, y5, 16.4), V(44, y5, 14.5), V(50.5, y5, 12.6), V(54.2, y5, 11), V(60.6, F.s6 + 0.06, -10.4), V(60, F.s6 + 0.06, -14.6), V(60, y6, -15.8)], '#C2F230');

  const arrowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(1.4) });
  const arrowGeo = new THREE.ConeGeometry(0.32, 0.8, 3);
  arrowGeo.rotateX(Math.PI / 2);
  [0.18, 0.42, 0.66, 0.9].forEach((u) => {
    const p = main.curve.getPointAt(u);
    const tan = main.curve.getTangentAt(u);
    const a = new THREE.Mesh(arrowGeo, arrowMat);
    a.position.copy(p).add(V(0, 0.15, 0));
    a.lookAt(p.clone().add(tan));
    root.add(a);
  });
  anim.push((t) => {
    traces.forEach((tr, i) => {
      tr.mesh.material.map.offset.x = -t * 0.35 - i * 0.2;
    });
  });

  // ---------- Simulación del capítulo 4 (hipotética: 2 / 1 / 7) ----------
  const entry = [V(5, y2, -4.6), V(8, y4, -7.2), V(11.6, y4, -8)];
  const routeCurves = {
    // cada ruta termina en un tramo visible desde el encuadre del capítulo 4
    service: new THREE.CatmullRomCurve3([...entry, V(14.6, y4, -10.6), V(15.5, y4, -12), V(16.2, y4, -16), V(16.6, y4, -17.8), V(17.3, y4 + 1.4, -21)]),
    second: new THREE.CatmullRomCurve3([...entry, V(16, y4, -11.8), V(19.2, y4, -9.6), V(20, y4, -8.2), V(23.5, y4, -8), V(26.8, y4, -8)]),
    recycle: new THREE.CatmullRomCurve3([...entry, V(13.5, y4, -5.2), V(17.2, y4, -4.2), V(18.4, y4, -0.6), V(19, y4, 1.6), V(20.4, y4 - 0.5, 3.6)]),
  };
  const plan = ['recycle', 'service', 'recycle', 'recycle', 'second', 'recycle', 'service', 'recycle', 'recycle', 'recycle'];
  const counters = { service: 0, second: 0, recycle: 0 };
  const tokens = plan.map((route, i) => {
    const slot = counters[route]++;
    const b = dyn(K.compact(K.makeBattery(M, { scale: 0.72, label: false })));
    root.add(b);
    return { b, route, slot, i };
  });
  function setSimulation(u) {
    // u: 0 → baterías en cola; 1 → cada una en su destino. Devuelve cuántas han llegado por ruta.
    const arrived = { service: 0, second: 0, recycle: 0 };
    tokens.forEach(({ b, route, slot, i }) => {
      const curve = routeCurves[route];
      const local = THREE.MathUtils.clamp((u - i * 0.055) / 0.45, 0, 1);
      const e = local * local * (3 - 2 * local);
      const endGap = (slot * 0.95) / curve.getLength();
      const queued = Math.max(0, 0.1 - i * 0.011);
      const at = THREE.MathUtils.clamp(THREE.MathUtils.lerp(queued, 0.99 - endGap, e), 0, 1);
      const tan = curve.getTangentAt(at);
      curve.getPointAt(at, b.position);
      b.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2;
      if (local >= 1) arrived[route]++;
    });
    return arrived;
  }
  setSimulation(0);

  // ---------- Conexiones del capítulo 6 ----------
  const arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(1.15), transparent: true, opacity: 0.85 });
  const hubTop = V(s6.x - 1.2, s6.y + 6.4, s6.z - 1.4);
  const arcs = [STATIONS.s1, STATIONS.s2, STATIONS.s3, STATIONS.s4, STATIONS.s5].map((s) => {
    const end = s.clone().add(V(0, 3, 0));
    const mid = new THREE.Vector3().lerpVectors(hubTop, end, 0.5).add(V(0, 7 + hubTop.distanceTo(end) * 0.06, 0));
    const geom = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(hubTop, mid, end), 120, 0.065, 6, false);
    const m = new THREE.Mesh(geom, arcMat);
    m.geometry.setDrawRange(0, 0);
    root.add(m);
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), arcMat);
    node.position.copy(end);
    node.scale.setScalar(0.001);
    root.add(node);
    return { m, node, total: geom.index.count };
  });
  function setConnections(u) {
    arcs.forEach(({ m, node, total }, i) => {
      const local = THREE.MathUtils.clamp((u - i * 0.1) / 0.5, 0, 1);
      m.geometry.setDrawRange(0, Math.floor((total * local) / 3) * 3);
      node.scale.setScalar(local >= 1 ? 1 : 0.001);
    });
  }
  setConnections(0);

  root.add(K.scatterLamps(M, lamps));
  root.add(K.contactShadows(shadows));
  // Todo lo fijo se fusiona por material: el detalle nuevo no multiplica las llamadas de dibujo.
  K.bakeStatic(root);

  return {
    update(t, dt) {
      anim.forEach((f) => f(t, dt));
    },
    setSimulation,
    setConnections,
  };
}
