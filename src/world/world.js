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

function bridge(M, a, b, width = 3) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.4, len + 1.2), M.concreteLight);
  deck.position.copy(mid).add(V(0, -0.2, 0));
  deck.lookAt(b.clone().add(V(0, -0.2, 0)));
  deck.receiveShadow = true;
  deck.castShadow = true;
  g.add(deck);
  // barandillas laterales
  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len + 1.2), M.graphiteLight);
    rail.position.set(side * (width / 2 - 0.1), 0.55, 0);
    deck.add(rail);
    for (let i = 0; i <= Math.ceil(len / 1.2); i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), M.graphiteLight);
      post.position.set(side * (width / 2 - 0.1), 0.3, -len / 2 + i * 1.2);
      deck.add(post);
    }
  });
  // pilares hasta el agua
  const n = Math.max(1, Math.floor(len / 6));
  for (let i = 1; i <= n; i++) {
    const p = new THREE.Vector3().lerpVectors(a, b, i / (n + 1));
    const h = p.y + 2.6;
    const pil = K.box(0.7, h, 0.7, M.concrete, p.x, -2.6, p.z);
    pil.castShadow = true;
    g.add(pil);
  }
  return g;
}

function tube(points, radius, mat, closed = false, tension = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', tension);
  const len = curve.getLength();
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(len * 3)), radius, 6, closed), mat);
  return { mesh: m, curve, len };
}

function traceMaterial(color, pulse, scale = 1.7) {
  const c = new THREE.Color(color).multiplyScalar(scale);
  const map = pulse.clone();
  map.needsUpdate = true;
  return new THREE.MeshBasicMaterial({ color: c, map, toneMapped: true });
}

export function buildWorld(scene) {
  const M = K.makeMaterials();
  const root = new THREE.Group();
  scene.add(root);
  const anim = []; // funciones (t, dt) llamadas cada frame
  const pulse = T.pulseTexture();

  // Agua oscura bajo todo el mundo.
  const water = new THREE.Mesh(new THREE.CircleGeometry(1600, 96), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2.6;
  water.receiveShadow = true;
  root.add(water);

  // ---------- Plataformas ----------
  const plat = (key, shape, opts) => {
    const p = K.makePlatform(M, shape, TOP[key], opts);
    p.position.set(STATIONS[key].x, 0, STATIONS[key].z);
    root.add(p);
    return p;
  };
  plat('s1', K.circleShape(13));
  plat('s2', K.roundedRect(22, 18, 2.5));
  plat('s3', K.roundedRect(18, 16, 2.5));
  plat('s4', K.circleShape(10));
  plat('sA', K.roundedRect(12, 8, 1.6));
  plat('sB', K.roundedRect(12, 10, 1.6));
  plat('s5', K.roundedRect(34, 20, 3));
  plat('s6', K.circleShape(10), { railCount: 64 });

  // Colina rocosa bajo el centro final.
  const hill = [];
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const r = 10.5 + (i % 4) * 0.9;
    hill.push({ x: 60 + Math.cos(a) * r, y: -1 + (i % 7) * 1.3, z: -20 + Math.sin(a) * r, s: 1.6 + (i % 5) * 0.4 });
  }
  // Rocas alrededor de las demás islas.
  const ring = (cx, cz, rx, rz, n, y0 = -2) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.3;
      hill.push({ x: cx + Math.cos(a) * rx, y: y0 + (i % 3) * 0.6, z: cz + Math.sin(a) * rz, s: 0.9 + (i % 4) * 0.45 });
    }
  };
  ring(-58, 14, 13.6, 13.6, 40);
  ring(-30, 4, 12, 10, 34);
  ring(-6, -2, 10, 9, 30);
  ring(16, -8, 10.6, 10.6, 30, -1);
  ring(38, 20, 17.6, 10.8, 50);
  ring(19, -28, 6.6, 4.6, 16, 0);
  ring(34, -9, 6.6, 5.6, 16, -1);
  root.add(K.scatterRocks(M, hill));

  // ---------- Puentes ----------
  [
    [V(-46.2, F.s1, 9.2), V(-40.6, F.s2, 7.4)],
    [V(-19.2, F.s2, 2), V(-14.8, F.s3, 0)],
    [V(3.2, F.s3, -3.2), V(6.6, F.s4, -6)],
    [V(16.6, F.s4, -17.8), V(18, F.sA, -24.2)],
    [V(25.8, F.s4, -8), V(28.2, F.sB, -8)],
    [V(19, F.s4, 1.6), V(24.8, F.s5, 10.4)],
    [V(54.2, F.s5, 11), V(60.6, F.s6, -10.4)],
  ].forEach(([a, b]) => root.add(bridge(M, a, b)));

  // ---------- 1 · Depósito de recogida ----------
  const s1 = STATIONS.s1;
  const stacks = [];
  for (let px = 0; px < 4; px++) {
    for (let pz = 0; pz < 3; pz++) {
      const bx = s1.x - 8 + px * 3.6;
      const bz = s1.z - 6 + pz * 3.4;
      root.add(K.box(3, 0.22, 2.6, M.wood, bx, s1.y, bz));
      const layers = 1 + ((px + pz * 2) % 3);
      for (let l = 0; l < layers; l++) {
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            stacks.push({ x: bx - 0.75 + i * 1.5, y: s1.y + 0.22 + l * 1.12, z: bz - 0.55 + j * 1.1, r: (l % 2) * 0.04, s: 0.88 });
          }
        }
      }
    }
  }
  root.add(K.batteryInstances(M, stacks));
  // jaulas de recogida
  const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, 2, 2.2)), new THREE.LineBasicMaterial({ color: '#6d7174' }));
  [[-9, 6], [-6, 7.4]].forEach(([dx, dz]) => {
    const c = cage.clone();
    c.position.set(s1.x + dx, s1.y + 1, s1.z + dz);
    root.add(c);
  });
  // carretilla elevadora
  const fork = new THREE.Group();
  fork.add(K.box(1.4, 0.9, 2.2, M.amberMatte, 0, 0.3, 0));
  fork.add(K.box(1.3, 0.9, 0.9, M.graphite, 0, 1.2, -0.4));
  fork.add(K.box(0.08, 2.6, 0.08, M.graphite, -0.5, 0.2, 1.2));
  fork.add(K.box(0.08, 2.6, 0.08, M.graphite, 0.5, 0.2, 1.2));
  fork.add(K.box(1.0, 0.06, 1.2, M.metal, 0, 0.4, 1.8));
  fork.position.set(s1.x + 4.5, s1.y, s1.z + 2);
  fork.rotation.y = -0.8;
  root.add(fork);
  // batería protagonista sobre una peana con anillo lima
  const heroPos = V(s1.x + 7, s1.y, s1.z + 7);
  const plinth = K.cyl(2.8, 3, 0.35, M.graphiteLight, 48);
  plinth.position.set(heroPos.x, heroPos.y + 0.17, heroPos.z);
  root.add(plinth);
  const heroRing = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.06, 8, 96), M.lime);
  heroRing.rotation.x = Math.PI / 2;
  heroRing.position.set(heroPos.x, heroPos.y + 0.36, heroPos.z);
  root.add(heroRing);
  const hero = K.makeBattery(M, { glow: true, scale: 2.1 });
  hero.position.set(heroPos.x, heroPos.y + 0.35, heroPos.z);
  hero.rotation.y = 0.55;
  root.add(hero);
  const heroLight = new THREE.PointLight('#ffd49a', 14, 14, 1.8);
  heroLight.position.set(heroPos.x + 2, heroPos.y + 5, heroPos.z + 3);
  root.add(heroLight);

  // ---------- 2 · Taller abierto en sección ----------
  const s2 = STATIONS.s2;
  const shop = K.makeCutaway(M, { w: 16, d: 12, h: 6.5 });
  shop.position.set(s2.x, s2.y, s2.z - 1);
  root.add(shop);
  // elevador con coche
  const lift = new THREE.Group();
  [[-2.2, -1.3], [-2.2, 1.3], [2.2, -1.3], [2.2, 1.3]].forEach(([x, z]) => lift.add(K.box(0.3, 3.4, 0.3, M.graphiteLight, x, 0, z)));
  lift.add(K.box(4.8, 0.14, 0.3, M.metal, 0, 2.1, -1.3));
  lift.add(K.box(4.8, 0.14, 0.3, M.metal, 0, 2.1, 1.3));
  const car = K.makeCar(M, '#4a4e52');
  car.position.y = 2.24;
  lift.add(car);
  lift.position.set(s2.x - 3.4, s2.y, s2.z - 3.2);
  root.add(lift);
  // banco de trabajo con la batería identificada
  const bench = new THREE.Group();
  bench.add(K.box(3.6, 0.12, 1.6, M.wood, 0, 0.95, 0));
  [[-1.6, -0.65], [-1.6, 0.65], [1.6, -0.65], [1.6, 0.65]].forEach(([x, z]) => bench.add(K.box(0.1, 0.95, 0.1, M.graphite, x, 0, z)));
  const b2 = K.makeBattery(M, { glow: true, scale: 0.85 });
  b2.position.set(0.4, 1.07, 0);
  b2.rotation.y = -0.35;
  bench.add(b2);
  // lector QR con haz
  const scanner = new THREE.Group();
  scanner.add(K.box(0.22, 0.6, 0.22, M.graphite, 0, 0, 0));
  scanner.add(K.box(0.24, 0.22, 0.6, M.graphite, 0, 0.6, 0.15));
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(2), transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.5, 24, 1, true), beamMat);
  beam.rotation.x = -Math.PI / 2 + 0.25;
  beam.position.set(0, 0.62, 1.15);
  scanner.add(beam);
  scanner.position.set(-1.0, 1.07, 0.55);
  scanner.rotation.y = 0.75;
  bench.add(scanner);
  bench.position.set(s2.x + 2.6, s2.y, s2.z + 2.2);
  root.add(bench);
  anim.push((t) => {
    beamMat.opacity = 0.32 + Math.sin(t * 6) * 0.12;
  });
  // ficha digital flotante
  const record = K.screen(T.recordPanelTexture(), 2.2, 2.75, 1.1);
  record.material.transparent = true;
  record.position.set(s2.x + 5.6, s2.y + 3.4, s2.z + 2.4);
  record.rotation.y = -0.35;
  root.add(record);
  anim.push((t) => {
    record.position.y = s2.y + 3.4 + Math.sin(t * 1.4) * 0.12;
  });
  // armarios y neumáticos
  for (let i = 0; i < 4; i++) root.add(K.box(1.2, 1.4, 0.7, i % 2 ? M.graphite : M.graphiteLight, s2.x + 1.5 + i * 1.3, s2.y, s2.z - 6.4));
  for (let i = 0; i < 3; i++) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.18, 10, 20), M.tire);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(s2.x + 6.2, s2.y + 0.18 + i * 0.36, s2.z - 3);
    root.add(tire);
  }

  // ---------- 3 · Laboratorio de diagnóstico ----------
  const s3 = STATIONS.s3;
  const lab = K.makeCutaway(M, { w: 14, d: 11, h: 6, roofDepth: 0.5 });
  lab.position.set(s3.x, s3.y, s3.z - 1);
  root.add(lab);
  const tbench = new THREE.Group();
  tbench.add(K.box(4.2, 0.9, 1.8, M.ivory, 0, 0, 0));
  tbench.add(K.box(4.3, 0.08, 1.9, M.graphite, 0, 0.9, 0));
  const b3 = K.makeBattery(M, { glow: true, scale: 0.85 });
  b3.position.set(0, 0.98, 0.05);
  tbench.add(b3);
  // sondas: cables curvos hasta el comprobador
  const tester = K.box(1.0, 0.7, 0.7, M.graphiteLight, 1.6, 0.98, -0.3);
  tbench.add(tester);
  const dial = K.screen(T.gaugeTexture('dial'), 0.8, 0.5, 1.6);
  dial.position.set(1.6, 1.38, 0.06);
  tbench.add(dial);
  [[-0.44, '#E5AE50'], [0.44, '#9aa0a4']].forEach(([x, col]) => {
    const c = new THREE.CatmullRomCurve3([V(x, 2.0, 0.24), V(x * 0.6 + 0.6, 2.5, 0.2), V(1.4, 1.9, -0.1), V(1.5, 1.5, -0.25)]);
    tbench.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.03, 6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })));
  });
  tbench.position.set(s3.x + 0.5, s3.y, s3.z + 0.6);
  root.add(tbench);
  // pantallas de medición en la pared
  const wave = K.screen(T.gaugeTexture('wave'), 3.2, 2, 1.5);
  wave.position.set(s3.x - 2.2, s3.y + 3.6, s3.z - 6.3);
  root.add(wave);
  const bars = K.screen(T.gaugeTexture('bars'), 2.4, 1.5, 1.4);
  bars.position.set(s3.x + 2.2, s3.y + 3.4, s3.z - 6.3);
  root.add(bars);
  // escritorio y estantería con baterías en espera
  root.add(K.box(2.6, 0.8, 1.2, M.graphite, s3.x + 4.4, s3.y, s3.z - 3.4));
  const mon = K.screen(T.gaugeTexture('bars'), 1.1, 0.7, 1.2);
  mon.position.set(s3.x + 4.4, s3.y + 1.35, s3.z - 3.6);
  root.add(mon);
  const shelfB = [];
  for (let l = 0; l < 3; l++) {
    root.add(K.box(0.6, 0.06, 4, M.graphiteLight, s3.x - 6.1, s3.y + 0.4 + l * 1.3, s3.z - 2));
    for (let i = 0; i < 3; i++) shelfB.push({ x: s3.x - 6.1, y: s3.y + 0.46 + l * 1.3, z: s3.z - 3.3 + i * 1.3, r: Math.PI / 2, s: 0.55 });
  }
  root.add(K.batteryInstances(M, shelfB));

  // ---------- 4 · Cruce con tres rutas ----------
  const s4 = STATIONS.s4;
  const hub4 = K.cyl(3.2, 3.2, 0.2, M.graphiteLight, 48);
  hub4.position.set(s4.x, s4.y + 0.1, s4.z);
  root.add(hub4);
  const island = K.cyl(1.6, 1.6, 0.5, M.foliage, 24);
  island.position.set(s4.x, s4.y + 0.25, s4.z);
  root.add(island);
  // A · sigue en servicio: aparcamiento elevado con coche
  const sA = STATIONS.sA;
  const canopy = new THREE.Group();
  [[-4, -2.5], [4, -2.5], [-4, 2.5], [4, 2.5]].forEach(([x, z]) => canopy.add(K.box(0.25, 3.4, 0.25, M.graphite, x, 0, z)));
  canopy.add(K.box(9, 0.25, 6, M.graphiteLight, 0, 3.4, 0));
  canopy.add(K.box(8, 0.06, 0.2, M.warmGlow, 0, 3.36, 0));
  canopy.position.set(sA.x, sA.y, sA.z - 0.5);
  root.add(canopy);
  const carA = K.makeCar(M, '#5a5f63');
  carA.position.set(sA.x - 1.2, sA.y, sA.z - 0.5);
  carA.rotation.y = 0.15;
  root.add(carA);
  // B · evaluación de segunda vida: módulo cerrado con estanterías
  const sB = STATIONS.sB;
  const evalLab = K.makeCutaway(M, { w: 8, d: 6.5, h: 4.2, roofDepth: 0.6 });
  evalLab.position.set(sB.x + 0.5, sB.y, sB.z - 0.8);
  root.add(evalLab);
  const modB = [];
  for (let l = 0; l < 3; l++) {
    root.add(K.box(3.4, 0.06, 0.8, M.metal, sB.x + 2.2, sB.y + 0.3 + l * 1.1, sB.z - 3.4));
    for (let i = 0; i < 3; i++) modB.push({ x: sB.x + 1.1 + i * 1.1, y: sB.y + 0.36 + l * 1.1, z: sB.z - 3.4, s: 0.5 });
  }
  root.add(K.batteryInstances(M, modB));
  const evalBench = K.box(2.4, 0.9, 1.1, M.ivory, sB.x - 1.2, sB.y, sB.z - 1);
  root.add(evalBench);
  const evalScreen = K.screen(T.gaugeTexture('wave'), 1.4, 0.9, 1.3);
  evalScreen.position.set(sB.x - 1.2, sB.y + 1.6, sB.z - 1.5);
  root.add(evalScreen);
  // señales de las tres rutas
  const sign = (kind, x, y, z, ry) => {
    const g = new THREE.Group();
    g.add(K.box(0.12, 1.6, 0.12, M.graphite, 0, 0, 0));
    const face = K.screen(T.signTexture(kind), 1.2, 1.2, 1.2);
    face.position.y = 2.1;
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
  // recinto con muros bajos y nave de entrada
  root.add(K.box(30, 1.4, 0.4, M.concrete, s5.x, s5.y, s5.z + 9.4));
  root.add(K.box(0.4, 1.4, 18, M.concrete, s5.x + 15.6, s5.y, s5.z));
  const intake = K.makeCutaway(M, { w: 7, d: 6, h: 5, roofDepth: 0.7 });
  intake.position.set(s5.x - 11, s5.y, s5.z - 4.5);
  root.add(intake);
  const rsign = K.screen(T.recycleWallTexture(), 2.4, 2.4, 0.5);
  rsign.position.set(s5.x - 11, s5.y + 3.2, s5.z - 7.3);
  root.add(rsign);
  // cinta transportadora
  const belt = new THREE.Group();
  const beltLen = 18;
  belt.add(K.box(beltLen, 0.22, 1.6, M.graphite, 0, 1.0, 0));
  for (let i = 0; i < 7; i++) belt.add(K.box(0.18, 1.0, 1.4, M.graphiteLight, -beltLen / 2 + 1 + i * 2.7, 0, 0));
  belt.add(K.box(beltLen, 0.1, 0.08, M.amberMatte, 0, 1.3, 0.82));
  belt.add(K.box(beltLen, 0.1, 0.08, M.amberMatte, 0, 1.3, -0.82));
  belt.position.set(s5.x - 1, s5.y, s5.z - 1.5);
  belt.rotation.y = -0.12;
  root.add(belt);
  const riders = [];
  for (let i = 0; i < 6; i++) {
    const b = K.makeBattery(M, { scale: 0.62, label: false });
    belt.add(b);
    riders.push(b);
  }
  anim.push((t) => {
    riders.forEach((b, i) => {
      const u = ((t * 0.06 + i / riders.length) % 1);
      b.position.set(-beltLen / 2 + 0.8 + u * (beltLen - 3.5), 1.22, 0);
    });
  });
  // torre de trituración con tuberías
  const tower = new THREE.Group();
  tower.add(K.box(4.4, 5.4, 4, M.graphiteLight, 0, 0, 0));
  tower.add(K.box(3.2, 2.2, 3, M.metal, 0, 5.4, 0));
  [[-2.6, 0], [2.6, 1]].forEach(([x, i]) => {
    const p = K.cyl(0.35, 0.35, 7.5, M.metal, 12);
    p.position.set(x, 3.75 + i * 0.4, -1.4);
    tower.add(p);
  });
  for (let i = 0; i < 4; i++) tower.add(K.box(4.6, 0.06, 0.06, M.amberMatte, 0, 1.4 + i * 1.3, 2.05));
  tower.add(K.box(0.6, 0.2, 0.2, M.amberGlow, 1.2, 4.6, 2.05));
  tower.position.set(s5.x + 10, s5.y, s5.z - 4.5);
  root.add(tower);
  // contenedores con materiales recuperados, separados
  const binMats = [M.lead, M.copper, M.plastic, M.metal, M.lead];
  for (let i = 0; i < 5; i++) {
    const bx = s5.x - 6 + i * 4.2;
    const bz = s5.z + 5.6;
    const binG = new THREE.Group();
    binG.add(K.box(3.4, 0.25, 2.6, M.graphiteLight, 0, 0, 0));
    binG.add(K.box(3.4, 1.6, 0.18, M.graphiteLight, 0, 0, 1.25));
    binG.add(K.box(3.4, 1.6, 0.18, M.graphiteLight, 0, 0, -1.25));
    binG.add(K.box(0.18, 1.6, 2.6, M.graphiteLight, 1.62, 0, 0));
    binG.add(K.box(0.18, 1.6, 2.6, M.graphiteLight, -1.62, 0, 0));
    const pile = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.28, 0), binMats[i], 70);
    const o = new THREE.Object3D();
    for (let k = 0; k < 70; k++) {
      const r = Math.sqrt((k * 0.6180339) % 1);
      const a = k * 2.399;
      o.position.set(Math.cos(a) * r * 1.4, 0.5 + (1 - r) * 1.0 + (k % 3) * 0.08, Math.sin(a) * r * 1.05);
      o.rotation.set(k, k * 0.7, k * 0.3);
      o.scale.setScalar(0.7 + (k % 4) * 0.15);
      o.updateMatrix();
      pile.setMatrixAt(k, o.matrix);
    }
    binG.add(pile);
    binG.position.set(bx, s5.y, bz);
    root.add(binG);
  }
  const plantLight = new THREE.PointLight('#ffcf8a', 30, 26, 1.6);
  plantLight.position.set(s5.x + 2, s5.y + 7, s5.z + 2);
  root.add(plantLight);

  // ---------- 6 · Centro de trazabilidad ----------
  const s6 = STATIONS.s6;
  const podium = K.cyl(4.2, 4.6, 0.6, M.graphiteLight, 64);
  podium.position.set(s6.x, s6.y + 0.3, s6.z);
  root.add(podium);
  const podRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.07, 8, 120), M.lime);
  podRing.rotation.x = Math.PI / 2;
  podRing.position.set(s6.x, s6.y + 0.62, s6.z);
  root.add(podRing);
  const passport = new THREE.Group();
  passport.add(K.box(3.6, 5.6, 0.4, M.graphite, 0, 0, 0));
  const pscreen = K.screen(T.passportTexture(), 3.2, 4.8, 1.25);
  pscreen.position.set(0, 2.8, 0.21);
  passport.add(pscreen);
  // La pantalla mira hacia el este, de cara a la cámara que contempla el mundo detrás.
  const FACE = 0.93;
  const lat = V(Math.cos(FACE), 0, -Math.sin(FACE));
  passport.position.set(s6.x - 1.2, s6.y + 0.6, s6.z - 1.4);
  passport.rotation.y = FACE;
  root.add(passport);
  [[-3.3, 'wave', 0.45], [3.3, 'bars', -0.45]].forEach(([dx, kind, ry]) => {
    const g = new THREE.Group();
    g.add(K.box(2.8, 1.9, 0.2, M.graphite, 0, 0, 0));
    const s = K.screen(T.gaugeTexture(kind), 2.5, 1.6, 1.3);
    s.position.set(0, 0.95, 0.11);
    g.add(s);
    g.position.set(s6.x - 1.2 + lat.x * dx, s6.y + 1.6, s6.z - 1.4 + lat.z * dx);
    g.rotation.y = FACE + ry;
    root.add(g);
  });
  const b6 = K.makeBattery(M, { glow: true, scale: 0.9 });
  b6.position.set(s6.x + 1.4, s6.y + 0.6, s6.z + 1.2);
  b6.rotation.y = FACE;
  root.add(b6);
  const hubLight = new THREE.PointLight('#e8ffb0', 16, 20, 1.6);
  hubLight.position.set(s6.x + 3, s6.y + 6, s6.z + 3);
  root.add(hubLight);

  // ---------- Vegetación y farolas ----------
  const trees = [];
  const lamps = [];
  const edge = (cx, cz, rx, rz, n, y, from = 0, to = Math.PI * 2, step = 2.2) => {
    for (let i = 0; i < n; i++) {
      const a = from + ((to - from) * i) / n;
      const jitter = Math.sin(i * 12.9) * 0.6;
      trees.push({ x: cx + Math.cos(a) * (rx + jitter), y, z: cz + Math.sin(a) * (rz + jitter), s: 0.8 + ((i * 7) % 5) * 0.12 });
      if (i % 3 === 0) lamps.push({ x: cx + Math.cos(a + 0.05) * (rx - 1.2), y, z: cz + Math.sin(a + 0.05) * (rz - 1.2) });
    }
  };
  edge(-58, 14, 11.5, 11.5, 22, F.s1, Math.PI * 0.6, Math.PI * 1.55);
  edge(16, -8, 8.6, 8.6, 18, F.s4, Math.PI * 0.85, Math.PI * 1.35);
  edge(38, 20, 16, 9, 18, F.s5, Math.PI * 0.05, Math.PI * 0.45);
  edge(60, -20, 8.8, 8.8, 20, F.s6, Math.PI * 1.1, Math.PI * 1.95);
  // árboles en las rocas bajo las islas
  for (let i = 0; i < 40; i++) {
    const a = i * 0.71;
    trees.push({ x: 60 + Math.cos(a) * (12 + (i % 3)), y: 0.5 + (i % 6) * 1.2, z: -20 + Math.sin(a) * (12 + (i % 3)), s: 0.9 + (i % 4) * 0.2 });
  }
  root.add(K.scatterTrees(M, trees));
  root.add(K.scatterLamps(M, lamps));

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
  const routeA = mkTrace([V(15.5, y4, -12), V(16.2, y4, -16), V(16.6, y4, -17.8), V(18, yA, -24.2), V(18.6, yA, -27)], '#C2F230', 0.16);
  const routeB = mkTrace([V(20, y4, -8.2), V(23.5, y4, -8), V(25.8, y4, -8), V(28.2, y4, -8), V(31.5, y4, -8.6)], '#E5AE50', 0.16);
  const routeC = mkTrace([V(17.2, y4, -4.2), V(18.4, y4, -0.6), V(19, y4, 1.6), V(24.8, y5, 10.4), V(28.5, y5, 15), V(33, y5, 17.6)], '#F1EEE6', 0.16);
  mkTrace([V(36, y5, 16.4), V(44, y5, 14.5), V(50.5, y5, 12.6), V(54.2, y5, 11), V(60.6, F.s6 + 0.06, -10.4), V(60, F.s6 + 0.06, -14.6), V(60, y6, -15.8)], '#C2F230');

  // flechas sobre la traza principal
  const arrowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(1.6) });
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
    // Cada ruta termina en un tramo visible desde el encuadre del capítulo 4.
    service: new THREE.CatmullRomCurve3([...entry, V(14.6, y4, -10.6), V(15.5, y4, -12), V(16.2, y4, -16), V(16.6, y4, -17.8), V(17.3, y4 + 1.4, -21)]),
    second: new THREE.CatmullRomCurve3([...entry, V(16, y4, -11.8), V(19.2, y4, -9.6), V(20, y4, -8.2), V(23.5, y4, -8), V(26.8, y4, -8)]),
    recycle: new THREE.CatmullRomCurve3([...entry, V(13.5, y4, -5.2), V(17.2, y4, -4.2), V(18.4, y4, -0.6), V(19, y4, 1.6), V(21.4, y4 - 1, 5.2)]),
  };
  const plan = ['recycle', 'service', 'recycle', 'recycle', 'second', 'recycle', 'service', 'recycle', 'recycle', 'recycle'];
  const counters = { service: 0, second: 0, recycle: 0 };
  const tokens = plan.map((route, i) => {
    const slot = counters[route]++;
    const b = K.makeBattery(M, { scale: 0.72, label: false, glow: route === 'service' });
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
  const arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(1.25), transparent: true, opacity: 0.85 });
  const hubTop = V(s6.x - 1.2, s6.y + 6.4, s6.z - 1.4);
  const arcs = [STATIONS.s1, STATIONS.s2, STATIONS.s3, STATIONS.s4, STATIONS.s5].map((s) => {
    const end = s.clone().add(V(0, 3, 0));
    const mid = new THREE.Vector3().lerpVectors(hubTop, end, 0.5).add(V(0, 7 + hubTop.distanceTo(end) * 0.06, 0));
    const curve = new THREE.QuadraticBezierCurve3(hubTop, mid, end);
    const geom = new THREE.TubeGeometry(curve, 120, 0.065, 6, false);
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

  root.traverse((o) => {
    if (o.isMesh && o.castShadow === false && o.geometry && o.material === M.ivory) o.receiveShadow = true;
  });

  return {
    update(t, dt) {
      anim.forEach((f) => f(t, dt));
    },
    setSimulation,
    setConnections,
  };
}
