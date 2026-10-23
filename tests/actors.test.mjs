// Pruebas de los actores (src/world/actors.js) en Node, sin DOM: los materiales son sustitutos con los mismos
// nombres que makeMaterials (que necesita lienzos). Comprueban que cada función devuelve un grupo con mallas, el
// origen en el suelo, las medidas pedidas, el presupuesto de triángulos y que no se crean materiales nuevos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as A from '../src/world/actors.js';

const NAMES = ['graphite', 'panel', 'ivory', 'ivoryPanel', 'steel', 'darkSteel', 'amberMatte', 'paint', 'rubber', 'wood', 'lead', 'limeLine', 'limeInsert', 'lime', 'warmGlow', 'amberGlow', 'darkGlass', 'glass', 'concrete', 'concreteLight', 'floor', 'stoneTop', 'casing', 'terminal', 'grip', 'trunk', 'copper'];
function fakeMaterials() {
  const M = {};
  for (const n of NAMES) {
    const m = new THREE.MeshStandardMaterial({ name: n });
    if (['steel', 'darkSteel', 'rubber', 'concrete', 'concreteLight', 'floor'].includes(n)) m.userData.tile = 1.6;
    if (n === 'glass') m.transparent = true;
    if (['lime', 'warmGlow', 'amberGlow'].includes(n)) {
      m.emissive.set('#ffffff');
      m.emissiveIntensity = 1.2;
    }
    M[n] = m;
  }
  return M;
}
const M = fakeMaterials();
const allowed = new Set(Object.values(M));

function stats(obj) {
  obj.updateMatrixWorld(true);
  let tris = 0;
  let meshes = 0;
  const mats = new Set();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    mats.add(o.material);
    const g = o.geometry;
    tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  return { tris, meshes, mats, box, size };
}

// Comprobaciones comunes: Group, mallas, origen en el suelo, solo materiales de M (o la etiqueta compartida),
// sin cobre.
function common(name, obj, { budget, size } = {}) {
  assert.ok(obj && obj.isGroup, `${name}: devuelve un Group`);
  const s = stats(obj);
  assert.ok(s.meshes > 0, `${name}: tiene mallas`);
  assert.ok(Math.abs(s.box.min.y) < 0.02, `${name}: origen en el suelo (min.y = ${s.box.min.y.toFixed(3)})`);
  for (const m of s.mats) {
    assert.ok(allowed.has(m) || m.isMeshBasicMaterial, `${name}: material fuera de M (${m.type} ${m.name})`);
    assert.notEqual(m, M.copper, `${name}: sin cobre`);
  }
  if (budget) assert.ok(s.tris <= budget, `${name}: ${s.tris} triángulos > ${budget}`);
  if (size) {
    ['x', 'y', 'z'].forEach((k, i) => {
      if (size[i] == null) return;
      const [want, tol] = Array.isArray(size[i]) ? size[i] : [size[i], 0.15];
      assert.ok(Math.abs(s.size[k] - want) <= want * tol, `${name}: tamaño ${k} = ${s.size[k].toFixed(2)} (≈ ${want})`);
    });
  }
  return s;
}

const report = [];
const log = (name, s) => report.push(`${name.padEnd(34)} ${String(s.tris).padStart(5)} tri  ${String(s.meshes).padStart(3)} mallas  ${s.size.x.toFixed(2)} × ${s.size.y.toFixed(2)} × ${s.size.z.toFixed(2)} m`);

test('personas: todos los roles y poses, ≤ 600 triángulos, 1,75 m de pie', () => {
  const roles = ['muelle', 'carretillero', 'laboratorio', 'conductor', 'reutilizacion', 'altaTension', 'especialista', 'planta', 'horno', 'visitante'];
  const poses = ['stand', 'work', 'seated', 'walk', 'look'];
  for (const role of roles) {
    for (const pose of poses) {
      const p = A.makePerson(M, { role, pose });
      const s = common(`persona ${role}/${pose}`, p, { budget: 600 });
      if (pose === 'stand') {
        assert.ok(Math.abs(s.size.y - 1.75) < 0.05, `persona ${role}: altura ${s.size.y.toFixed(3)}`);
        log(`persona ${role}`, s);
      }
      if (pose === 'seated') assert.ok(s.size.y < 1.4, `sentada más baja (${s.size.y.toFixed(2)})`);
    }
  }
  const v = A.makePerson(M, { role: 'visitante', variant: 1 });
  common('visitante variante 1', v, { budget: 600 });
});

test('caché de variantes: geometría compartida, mallas propias', () => {
  const a = A.makePerson(M, { role: 'muelle' });
  const b = A.makePerson(M, { role: 'muelle' });
  assert.notEqual(a.children[0], b.children[0]);
  assert.equal(a.children[0].geometry, b.children[0].geometry);
});

test('dinámico: compactado y marcado', () => {
  const p = A.makePerson(M, { role: 'planta', dynamic: true });
  assert.equal(p.userData.dynamic, true);
  const s = stats(p);
  assert.equal(s.meshes, s.mats.size, 'una malla por material');
  const t = A.makeTruck(M, { kind: 'recogida', dynamic: true });
  assert.equal(t.userData.dynamic, true);
});

test('camiones: medidas, carga, puertas y presupuesto', () => {
  for (const kind of ['recogida', 'expedicion', 'lingotes']) {
    const t = A.makeTruck(M, { kind, doorsOpen: false });
    // ancho con retrovisores; la plataforma de lingotes queda a la altura de la cabina
    const s = common(`camión ${kind}`, t, { budget: 3000, size: [[3.4, 0.2], [kind === 'lingotes' ? 3.0 : 3.6, 0.1], [8.5, 0.1]] });
    assert.ok(t.userData.cargo && t.userData.cargo.isObject3D, 'userData.cargo');
    assert.ok(t.userData.cargo.children.length > 0, 'cargado');
    log(`camión ${kind}`, s);
  }
  const l = A.makeTruck(M, { kind: 'ligero' });
  log('camión ligero', common('camión ligero', l, { budget: 3000, size: [[2.2 + 0.8, 0.25], [2.8, 0.1], [6.0, 0.1]] }));
  const open = A.makeTruck(M, { kind: 'recogida', doorsOpen: true });
  assert.equal(open.userData.doors.length, 2);
  assert.ok(Math.abs(open.userData.doors[0].rotation.y) > 4, 'puertas abiertas contra el costado');
  const merged = A.makeTruck(M, { kind: 'recogida', mergeCargo: true, dynamic: true });
  assert.ok(stats(merged).meshes < stats(A.makeTruck(M, { kind: 'recogida' })).meshes, 'carga fusionada: menos mallas');
  const empty = A.makeTruck(M, { kind: 'expedicion', loaded: false });
  assert.equal(empty.userData.cargo.children.length, 0);
  // cabina hacia +z: el frente (faros) en z > 0
  const tb = stats(A.makeTruck(M, { kind: 'recogida', loaded: false }));
  assert.ok(tb.box.max.z > 4 && tb.box.min.z < -4);
});

test('carretilla: horquillas móviles, carga y presupuesto', () => {
  const f = A.makeForklift(M, { forkHeight: 0.2 });
  const s = common('carretilla', f, { budget: 1500, size: [[1.1, 0.25], [2.2, 0.1], [3.5, 0.15]] });
  log('carretilla con conductor', s);
  assert.ok(f.userData.forks && f.userData.forks.isObject3D);
  assert.equal(f.userData.forks.position.y, 0.2);
  const f2 = A.makeForklift(M, { forkHeight: 1.4, pallet: 'plomo' });
  log('carretilla con palé de plomo', stats(f2));
  assert.ok(f2.userData.load, 'carga en las horquillas');
  const f3 = A.makeForklift(M, { pallet: 'litio', driver: false });
  common('carretilla con embalaje', f3);
  log('carretilla sin conductor + embalaje', stats(f3));
});

test('tractor de arrastre: remolques hacia -z y presupuesto', () => {
  for (const load of ['plomo', 'litio', 'vacio']) {
    const t = A.makeTowTractor(M, { carts: 1, load });
    const s = common(`tractor ${load}`, t, { budget: 1500 });
    log(`tractor + 1 remolque ${load}`, s);
    assert.ok(s.box.min.z < -3, 'remolque detrás');
    assert.equal(t.userData.carts.length, 1);
  }
  const t3 = A.makeTowTractor(M, { carts: 3, load: 'plomo' });
  log('tractor + 3 remolques plomo', stats(t3));
});

test('palés, módulos, lingotes y granza', () => {
  log('palé plomo', common('palé plomo', A.makePallet(M, { kind: 'plomo' }), { budget: 600, size: [[1.2, 0.05], null, [0.8, 0.05]] }));
  log('palé plomo (fondo)', common('palé plomo bajo', A.makePallet(M, { kind: 'plomo', detail: 'low' }), { budget: 200 }));
  log('palé módulos', common('palé módulos', A.makePallet(M, { kind: 'modulos' }), { budget: 700 }));
  log('palé lingotes', common('palé lingotes', A.makePallet(M, { kind: 'lingotes' }), { budget: 700 }));
  log('palé granza', common('palé granza', A.makePallet(M, { kind: 'granza' }), { budget: 400 }));
  log('módulo', common('módulo', A.makeModule(M), { budget: 120, size: [[0.6, 0.1], [0.18, 0.25], [0.35, 0.1]] }));
  log('pila de lingotes 3×4×4', common('lingotes', A.makeIngotStack(M), { budget: 800 }));
  log('big bag', common('big bag', A.makePelletBag(M), { budget: 200, size: [[0.95, 0.1], [1.06, 0.1], [0.95, 0.1]] }));
});

test('paquete de coche eléctrico y embalaje', () => {
  log('paquete VE cerrado', common('paquete cerrado', A.makeEVPack(M), { budget: 400, size: [[1.5, 0.1], [0.3, 0.12], [2.2, 0.1]] }));
  const open = A.makeEVPack(M, { open: true });
  log('paquete VE abierto', common('paquete abierto', open, { budget: 900 }));
  const out = A.makeEVPack(M, { open: true, modulesOut: 4 });
  assert.ok(stats(out).tris < stats(open).tris, 'sin los módulos sacados');
  log('embalaje VE', common('embalaje', A.makeEVCrate(M), { budget: 500, size: [[1.75, 0.1], [0.69, 0.1], [2.4, 0.1]] }));
});

test('BESS, coche aparcado y placa', () => {
  const b = A.makeBESS(M, { length: 6, doorOpen: true });
  log('BESS 6 m abierto', common('BESS', b, { budget: 1500, size: [[6.5, 0.1], [2.78, 0.1], null] }));
  log('BESS 6 m cerrado', common('BESS cerrado', A.makeBESS(M, { doorOpen: false }), { budget: 1500, size: [null, null, [2.44, 0.05]] }));
  for (let t = 0; t < 6; t++) common(`coche ${t}`, A.makeParkedCar(M, { tint: t }), { budget: 320 });
  log('coche aparcado', common('coche', A.makeParkedCar(M), { budget: 320, size: [[1.8, 0.1], [1.42, 0.1], [4.4, 0.1]] }));
  log('placa alta tensión', common('placa', A.makeHVSign(M), { budget: 40 }));
});

test('informe de triángulos', () => {
  console.log('\n' + report.join('\n'));
});
