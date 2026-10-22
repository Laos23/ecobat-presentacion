import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { orderedRuns, consecutiveRuns, mergedBoundingSphere, instancedBoundingSphere, TIE_MARGIN } from '../src/world/chunks.js';

const box = (x0, x1, z0 = 0, z1 = 1) => new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 1, z1));
const shape = (runs) => runs.map((r) => [r.chunk, r.items.map(([, i]) => i)]);

// generador determinista para las pruebas aleatorias
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test('orderedRuns: piezas que no se tocan se agrupan por fragmento en orden de aparición', () => {
  const items = [{ k: 'A', b: box(0, 1) }, { k: 'B', b: box(10, 11) }, { k: 'A', b: box(2, 3) }, { k: 'B', b: box(12, 13) }];
  assert.deepEqual(shape(orderedRuns(items, (it) => it.k, (it) => it.b)), [['A', [0, 2]], ['B', [1, 3]]]);
});

test('orderedRuns: una pieza que toca a otra anterior de otro fragmento abre un tramo detrás de ella', () => {
  const items = [{ k: 'A', b: box(0, 1) }, { k: 'B', b: box(10, 11) }, { k: 'A', b: box(10.5, 12) }, { k: 'A', b: box(3, 4) }];
  // la 2 toca a la 1 (B), que va antes: no puede unirse al tramo de la 0; la 3 sigue en el último tramo de A
  assert.deepEqual(shape(orderedRuns(items, (it) => it.k, (it) => it.b)), [['A', [0]], ['B', [1]], ['A', [2, 3]]]);
});

test('orderedRuns: el contacto en una cara cuenta (cajas cerradas)', () => {
  const items = [{ k: 'A', b: box(0, 1) }, { k: 'B', b: box(1, 2) }, { k: 'A', b: box(2, 3) }];
  assert.deepEqual(shape(orderedRuns(items, (it) => it.k, (it) => it.b)), [['A', [0]], ['B', [1]], ['A', [2]]]);
});

test('consecutiveRuns: agrupa solo piezas consecutivas del mismo fragmento, como orderedRuns con cajas infinitas', () => {
  const all = () => new THREE.Box3(new THREE.Vector3(-Infinity, -Infinity, -Infinity), new THREE.Vector3(Infinity, Infinity, Infinity));
  const items = ['A', 'A', 'B', 'A', 'B', 'B', 'C'];
  const expected = [['A', [0, 1]], ['B', [2]], ['A', [3]], ['B', [4, 5]], ['C', [6]]];
  assert.deepEqual(shape(consecutiveRuns(items, (k) => k)), expected);
  assert.deepEqual(shape(orderedRuns(items, (k) => k, all)), expected);
  assert.deepEqual(consecutiveRuns([], (k) => k), []);
  // los elementos de cada tramo son [pieza, índice original]
  assert.deepEqual(consecutiveRuns(['x', 'y'], () => 'A')[0].items, [['x', 0], ['y', 1]]);
});

test('orderedRuns: un solo fragmento da un solo tramo con todo en el orden original', () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ b: box(i * 0.5, i * 0.5 + 1) }));
  assert.deepEqual(shape(orderedRuns(items, () => 'resto', (it) => it.b)), [['resto', [0, 1, 2, 3, 4, 5, 6]]]);
  assert.deepEqual(orderedRuns([], () => 'x', () => box(0, 1)), []);
});

test('orderedRuns: en cualquier reparto, cada par que se toca conserva su orden relativo', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const r = rng(seed);
    const keys = ['s1', 's2', 's3', 's4'];
    const items = Array.from({ length: 80 }, () => {
      const x = r() * 40;
      const z = r() * 40;
      const w = 0.2 + r() * 6;
      return { k: keys[Math.floor(r() * keys.length)], b: box(x, x + w, z, z + 0.2 + r() * 6) };
    });
    const runs = orderedRuns(items, (it) => it.k, (it) => it.b);
    const order = runs.flatMap((run) => run.items.map(([, i]) => i));
    assert.deepEqual([...order].sort((a, b) => a - b), items.map((_, i) => i), `semilla ${seed}: cada pieza una vez`);
    runs.forEach((run) => run.items.forEach(([it]) => assert.equal(it.k, run.chunk)));
    const pos = new Map(order.map((i, p) => [i, p]));
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (items[i].b.intersectsBox(items[j].b)) assert.ok(pos.get(i) < pos.get(j), `semilla ${seed}: ${i} debe ir antes que ${j}`);
      }
    }
    // dentro de cada tramo, orden original
    runs.forEach((run) => run.items.forEach(([, i], n) => n && assert.ok(run.items[n - 1][1] < i)));
  }
});

test('mergedBoundingSphere coincide bit a bit con la esfera de la geometría fusionada', () => {
  const r = rng(7);
  const list = [];
  for (let k = 0; k < 9; k++) {
    const base = k % 3 === 0 ? new THREE.BoxGeometry(1 + r(), 2, 0.5) : k % 3 === 1 ? new THREE.CylinderGeometry(0.3, 0.6, 2, 7) : new THREE.IcosahedronGeometry(0.8, 1);
    // la icosaedro de three ya no está indexada: toNonIndexed() avisa en consola si no hay índice
    const g = base.index ? base.toNonIndexed() : base;
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((r() - 0.5) * 120, r() * 9, (r() - 0.5) * 90), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), new THREE.Vector3(1, 1 + r(), 1)));
    list.push(g);
  }
  const ref = mergeGeometries(list);
  ref.computeBoundingSphere();
  const s = mergedBoundingSphere(list);
  assert.deepEqual([s.center.x, s.center.y, s.center.z, s.radius], [ref.boundingSphere.center.x, ref.boundingSphere.center.y, ref.boundingSphere.center.z, ref.boundingSphere.radius]);
  // las geometrías de entrada no cambian
  list.forEach((g) => assert.equal(g.boundingSphere, null));
});

test('instancedBoundingSphere coincide bit a bit con InstancedMesh.computeBoundingSphere', () => {
  const r = rng(11);
  const geom = new THREE.IcosahedronGeometry(1, 1);
  const n = 37;
  const im = new THREE.InstancedMesh(geom, new THREE.MeshBasicMaterial(), n);
  const o = new THREE.Object3D();
  const matrices = new Float32Array(n * 16);
  for (let i = 0; i < n; i++) {
    o.position.set((r() - 0.5) * 80, r() * 3, (r() - 0.5) * 60);
    o.rotation.set(r() * 0.3, r() * 6, r() * 0.2);
    o.scale.set(0.5 + r(), 0.5 + r(), 0.5 + r());
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
    o.matrix.toArray(matrices, i * 16);
  }
  im.computeBoundingSphere();
  const s = instancedBoundingSphere(geom, matrices, n);
  assert.deepEqual([s.center.x, s.center.y, s.center.z, s.radius], [im.boundingSphere.center.x, im.boundingSphere.center.y, im.boundingSphere.center.z, im.boundingSphere.radius]);
});

test('TIE_MARGIN cubre el cuanto de profundidad de 24 bits en el plano lejano de la cámara (0,5 a 700 m)', () => {
  // dos superficies solo pueden empatar en profundidad si están a menos de un cuanto: d² / near · 2^-24
  const quantum = (700 * 700) / 0.5 / 2 ** 24;
  assert.ok(2 * TIE_MARGIN > quantum, `${2 * TIE_MARGIN} > ${quantum}`);
});
