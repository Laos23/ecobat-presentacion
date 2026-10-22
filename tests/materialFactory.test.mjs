import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createMaterialFactory, drawKeys, opaqueSort, LATE_SORT_ID } from '../src/world/chunkLights.js';

const geo = new THREE.BoxGeometry(1, 1, 1);

test('materialFor: un clon por (material, fragmento, tipo), en caché', () => {
  const f = createMaterialFactory();
  const m = new THREE.MeshStandardMaterial({ color: '#336699', roughness: 0.4 });
  const a = f.materialFor(m, 's1', 0);
  assert.notEqual(a, m);
  assert.notEqual(a.uuid, m.uuid);
  assert.equal(a.isMeshStandardMaterial, true);
  assert.equal(a.color.getHex(), m.color.getHex());
  assert.equal(a.roughness, 0.4);
  assert.equal(f.materialFor(m, 's1', 0), a);
  assert.notEqual(f.materialFor(m, 's2', 0), a);
  assert.notEqual(f.materialFor(m, 's1', 1), a);
  assert.notEqual(f.materialFor(m, 's1', 2), f.materialFor(m, 's1', 1));
  assert.equal(f.clones.size, 4);
  assert.equal(f.clones.get(`${m.uuid}|s1|0`), a);
});

test('materialFor: marca el clon y no toca el original', () => {
  const f = createMaterialFactory();
  const m = new THREE.MeshStandardMaterial();
  const a = f.materialFor(m, 'sB', 1);
  assert.equal(a.userData.chunk, 'sB');
  assert.deepEqual(a.userData.chunkLights, []);
  assert.equal(a.userData.sortId, m.id); // se ordena como su original
  assert.deepEqual(m.userData, {});
});

test('materialFor: un físico sigue siendo físico y comparte las texturas por referencia', () => {
  const f = createMaterialFactory();
  const map = new THREE.Texture();
  const m = new THREE.MeshPhysicalMaterial({ map, clearcoat: 0.3, transparent: true, opacity: 0.18 });
  const a = f.materialFor(m, 's3', 0);
  assert.equal(a.isMeshPhysicalMaterial, true);
  assert.equal(a.map, map);
  assert.equal(a.clearcoat, 0.3);
  assert.equal(a.transparent, true);
  assert.equal(a.opacity, 0.18);
});

test('materialFor: los básicos y los arrays de materiales se devuelven tal cual', () => {
  const f = createMaterialFactory();
  const basic = new THREE.MeshBasicMaterial();
  const arr = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
  assert.equal(f.materialFor(basic, 's1', 0), basic);
  assert.equal(f.materialFor(arr, 's1', 0), arr);
  assert.equal(f.clones.size, 0);
});

test('materialFor: el clon comparte compilador y clave de programa con el original', () => {
  const f = createMaterialFactory();
  const plain = new THREE.MeshStandardMaterial();
  const custom = new THREE.MeshStandardMaterial();
  custom.onBeforeCompile = (sh) => sh;
  custom.customProgramCacheKey = () => 'uplit|x';
  const a = f.materialFor(plain, 's1', 0);
  const b = f.materialFor(custom, 's1', 0);
  assert.equal(a.onBeforeCompile, plain.onBeforeCompile);
  assert.equal(a.customProgramCacheKey(), plain.customProgramCacheKey());
  assert.equal(b.onBeforeCompile, custom.onBeforeCompile);
  assert.equal(b.customProgramCacheKey(), 'uplit|x');
  // sin compilador propio, la clave de three sale del texto de onBeforeCompile: la misma en los dos
  assert.equal(a.customProgramCacheKey(), plain.onBeforeCompile.toString());
});

test('materialFor: el clon sigue la intensidad emisiva que las estaciones animan en el original', () => {
  const f = createMaterialFactory();
  const beacon = new THREE.MeshStandardMaterial({ emissive: '#E5AE50', emissiveIntensity: 1.1 });
  const a = f.materialFor(beacon, 's1', 0);
  assert.equal(a.emissiveIntensity, 1.1);
  beacon.emissiveIntensity = 0.25;
  assert.equal(a.emissiveIntensity, 0.25);
  a.emissiveIntensity = 0.6;
  assert.equal(beacon.emissiveIntensity, 0.6);
  // el resto de propiedades queda propia del clon
  beacon.roughness = 0.9;
  assert.notEqual(a.roughness, 0.9);
});

const mesh = (material) => new THREE.Mesh(geo, material);
const inst = (material, color = false) => {
  const im = new THREE.InstancedMesh(geo, material, 1);
  if (color) im.setColorAt(0, new THREE.Color('#fff'));
  return im;
};
const kindOf = (o) => (o.isInstancedMesh ? (o.instanceColor ? 2 : 1) : 0);

test('drawKeys: el id del material original, salvo las instanciadas de un material compartido con otro tipo', () => {
  const shared = new THREE.MeshStandardMaterial();
  const solo = new THREE.MeshStandardMaterial();
  const other = new THREE.MeshStandardMaterial();
  const plainShared = mesh(shared);
  const instShared = inst(shared);
  const instShared2 = inst(shared);
  const colorShared = inst(shared, true);
  const instSolo = inst(solo, true);
  const plainOther = mesh(other);
  // orden de recorrido: el tipo con color de `shared` aparece antes que el sin color
  const walk = [plainOther, colorShared, instSolo, instShared, plainShared, instShared2];
  const keys = drawKeys(walk, kindOf);
  assert.equal(keys.get(plainShared), shared.id);
  assert.equal(keys.get(plainOther), other.id);
  assert.equal(keys.get(instSolo), solo.id); // solo se usa como instanciada con color: no hay otro tipo
  assert.equal(keys.get(colorShared), LATE_SORT_ID);
  assert.equal(keys.get(instShared), LATE_SORT_ID + 1);
  assert.equal(keys.get(instShared2), LATE_SORT_ID + 1); // mismo (material, tipo): misma clave
  assert.equal(keys.size, walk.length);
});

// El comparador de three 0.186.1, extraído de su código: `opaqueSort` debe ordenar igual cuando no hay `sortId`.
// Si una versión nueva de three cambia sus criterios, esta prueba falla y hay que volver a verificar los píxeles.
const threeSource = readFileSync(new URL('../node_modules/three/build/three.module.js', import.meta.url), 'utf8');
const painterSource = threeSource.match(/function painterSortStable\( a, b \) \{[\s\S]*?\n\}\n/)[0];
const painterSortStable = new Function(`${painterSource}; return painterSortStable;`)();

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const item = (over) => ({ id: 0, groupOrder: 0, renderOrder: 0, materialVariant: 0, z: 0, material: { id: 1, userData: {} }, ...over });

test('opaqueSort: sin sortId ordena igual que el painterSortStable de three', () => {
  const rand = rng(7);
  const items = Array.from({ length: 400 }, (_, id) => item({
    id,
    groupOrder: Math.floor(rand() * 2),
    renderOrder: Math.floor(rand() * 3),
    materialVariant: Math.floor(rand() * 2) * 2,
    z: Math.floor(rand() * 6) / 6, // muchos empates de distancia
    material: { id: 1 + Math.floor(rand() * 12), userData: {} },
  }));
  assert.deepEqual([...items].sort(opaqueSort).map((i) => i.id), [...items].sort(painterSortStable).map((i) => i.id));
});

test('opaqueSort: ordena por sortId y no por el id del clon', () => {
  const original = item({ id: 1, material: { id: 20, userData: {} } });
  const clone = item({ id: 2, material: { id: 500, userData: { sortId: 10 } } });
  const later = item({ id: 3, material: { id: 30, userData: {} } });
  assert.deepEqual([later, original, clone].sort(opaqueSort).map((i) => i.id), [2, 1, 3]);
  // los clones de un mismo material se ordenan entre sí por distancia e id, como las mallas de un material único
  const a = item({ id: 4, z: 0.5, material: { id: 501, userData: { sortId: 10 } } });
  const b = item({ id: 5, z: 0.2, material: { id: 502, userData: { sortId: 10 } } });
  assert.deepEqual([a, b].sort(opaqueSort).map((i) => i.id), [5, 4]);
  // la clave tardía va detrás de todos los materiales y delante solo de las claves tardías mayores
  const late = item({ id: 6, material: { id: 600, userData: { sortId: LATE_SORT_ID } } });
  const late2 = item({ id: 7, material: { id: 601, userData: { sortId: LATE_SORT_ID + 1 } } });
  assert.deepEqual([late2, late, later].sort(opaqueSort).map((i) => i.id), [3, 6, 7]);
});
