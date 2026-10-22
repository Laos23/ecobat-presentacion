import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CHUNK_KEYS, chunkKeyFor, platformAt, partitionByChunk, lightSetFor, lightSetForBoxes, padLightSets, padLightClasses, routeBox, findLightViolations } from '../src/world/chunks.js';
import { STATIONS, PLATFORMS } from '../src/world/layout.js';

test('platformAt dentro y fuera', () => {
  assert.equal(platformAt(-58, 14), 's1');
  assert.equal(platformAt(-20, 3), 's2');
  assert.equal(platformAt(-45, 10), null);
});
test('chunkKeyFor: la más cercana al borde', () => {
  assert.equal(chunkKeyFor(-45, 10), 's1'); // a 0,6 m del borde de s1, a 4 m del de s2
  assert.equal(chunkKeyFor(500, 500), 's5');
});
test('partitionByChunk conserva índices originales', () => {
  const m = partitionByChunk([{ x: -58, z: 14 }, { x: -20, z: 3 }, { x: -57, z: 13 }]);
  assert.deepEqual(m.get('s1').map(([, i]) => i), [0, 2]);
  assert.deepEqual(m.get('s2').map(([, i]) => i), [1]);
});
test('lightSetFor: esfera-caja, orden y distance 0', () => {
  const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10));
  const far = new THREE.PointLight(0xffffff, 1, 9); far.position.set(20, 5, 5);
  const near = new THREE.PointLight(0xffffff, 1, 11); near.position.set(20, 5, 5);
  const spot = new THREE.SpotLight(0xffffff, 1, 25); spot.position.set(5, 30, 5);
  const zero = new THREE.PointLight(0xffffff, 1, 0); zero.position.set(900, 0, 0);
  [far, near, spot, zero].forEach((l) => l.updateMatrixWorld());
  assert.deepEqual(lightSetFor(box, [far, near, spot, zero]), [near, spot, zero]);
});
test('padLightSets: clases y relleno sin duplicados', () => {
  const P = Array.from({ length: 5 }, () => new THREE.PointLight());
  const S = Array.from({ length: 11 }, () => new THREE.SpotLight());
  const out = padLightSets([
    { key: 's1', points: [P[0]], spots: [S[0], S[1]] },
    { key: 's2', points: [P[1], P[2]], spots: [S[2], S[3], S[4], S[5]] },
    { key: 's3', points: [P[3]], spots: [S[6], S[7], S[8], S[9], S[10]] },
  ], P, S, 2);
  assert.deepEqual(out.get('s1').spots.slice(0, 2), [S[0], S[1]]);
  assert.equal(out.get('s1').spots.length, out.get('s2').spots.length);
  assert.equal(out.get('s1').points.length, out.get('s2').points.length);
  assert.equal(new Set(out.get('s1').spots).size, out.get('s1').spots.length);
  assert.equal(out.get('s3').spots.length, 5);
});
test('routeBox', () => {
  const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0)]);
  const b = routeBox([c], 50, 1.5);
  assert.deepEqual([b.min.x, b.max.x, b.min.y, b.max.y], [-1.5, 11.5, -1.5, 1.5]);
});
test('findLightViolations', () => {
  const l = new THREE.PointLight(0xffffff, 1, 5); l.position.set(0, 0, 0); l.updateMatrixWorld();
  const box = new THREE.Box3(new THREE.Vector3(1, 1, 1), new THREE.Vector3(2, 2, 2));
  assert.deepEqual(findLightViolations([{ name: 'm', box, lightIds: new Set() }], [l]), [{ name: 'm', light: l.uuid }]);
  assert.deepEqual(findLightViolations([{ name: 'm', box, lightIds: new Set([l.uuid]) }], [l]), []);
});

// Casos de contorno de la interfaz que las pruebas anteriores no cubren.

const named = (prefix, n, make) => Array.from({ length: n }, (_, i) => Object.assign(make(), { name: `${prefix}${i}` }));
const names = (lights) => lights.map((l) => l.name);

test('CHUNK_KEYS: las ocho plataformas en el orden de layout.js', () => {
  assert.deepEqual(CHUNK_KEYS, ['s1', 's2', 's3', 's4', 'sA', 'sB', 's5', 's6']);
  assert.deepEqual(CHUNK_KEYS, Object.keys(PLATFORMS));
});
test('platformAt: el borde exacto queda fuera, como en islandFloor', () => {
  assert.equal(platformAt(-45, 14), null); // círculo de s1: dx² = r²
  assert.equal(platformAt(-45.001, 14), 's1');
  assert.equal(platformAt(-19, 4), null); // rectángulo de s2: |dx| = w/2
  assert.equal(platformAt(-30, 13), null); // |dz| = d/2
  assert.equal(platformAt(-20.999, 12.999), 's2');
});
test('chunkKeyFor: dentro manda platformAt; fuera, el borde más cercano entre un círculo y un rectángulo', () => {
  assert.equal(chunkKeyFor(60, -20), 's6');
  assert.equal(chunkKeyFor(38, 20), 's5');
  assert.equal(chunkKeyFor(26.5, -8), 's4'); // a 0,5 m del círculo s4 y a 1,5 m del rectángulo sB
  assert.equal(chunkKeyFor(27.5, -8), 'sB'); // a 1,5 m de s4 y a 0,5 m de sB
});
test('chunkKeyFor siempre devuelve una clave, también con coordenadas no finitas', () => {
  for (const [x, z] of [[NaN, 0], [0, NaN], [Infinity, 0], [0, -Infinity]]) assert.ok(CHUNK_KEYS.includes(chunkKeyFor(x, z)), `${x}, ${z}`);
});
test('chunkKeyFor coincide con la distancia al borde calculada con Box3 y Sphere de three', () => {
  const ranked = (x, z) => {
    const p = new THREE.Vector3(x, 0, z);
    return Object.entries(PLATFORMS).map(([key, sh]) => {
      const c = STATIONS[key];
      const d = sh.kind === 'circle'
        ? Math.max(0, new THREE.Sphere(new THREE.Vector3(c.x, 0, c.z), sh.r).distanceToPoint(p))
        : new THREE.Box3(new THREE.Vector3(c.x - sh.w / 2, 0, c.z - sh.d / 2), new THREE.Vector3(c.x + sh.w / 2, 0, c.z + sh.d / 2)).distanceToPoint(p);
      return { key, d };
    }).sort((a, b) => a.d - b.d);
  };
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let checked = 0;
  for (let n = 0; n < 4000; n++) {
    const x = -140 + rnd() * 280;
    const z = -90 + rnd() * 160;
    const [best, next] = ranked(x, z);
    if (next.d - best.d < 1e-9) continue; // empate: vale cualquiera de las dos
    assert.equal(chunkKeyFor(x, z), best.key, `${x}, ${z}`);
    checked++;
  }
  assert.ok(checked > 3900, `solo ${checked} puntos sin empate`);
});
test('partitionByChunk: clave propia, orden de aparición y objetos originales', () => {
  const items = ['a', 'bb', 'c', 'dd'];
  const m = partitionByChunk(items, (s) => (s.length > 1 ? 'largo' : 'corto'));
  assert.deepEqual([...m.keys()], ['corto', 'largo']);
  assert.deepEqual(m.get('corto'), [['a', 0], ['c', 2]]);
  assert.deepEqual(m.get('largo'), [['bb', 1], ['dd', 3]]);
  assert.equal(partitionByChunk([]).size, 0);
});
test('lightSetFor: distance indefinida, NaN, negativa o no numérica entra siempre; la esfera tangente entra', () => {
  const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10));
  const lejos = (d) => { const l = new THREE.PointLight(0xffffff, 1, 1); l.distance = d; l.position.set(900, 900, 900); l.updateMatrixWorld(); return l; };
  const siempre = [lejos(undefined), lejos(NaN), lejos(-3), lejos('7'), lejos(null)];
  const tangente = new THREE.PointLight(0xffffff, 1, 10); tangente.position.set(20, 5, 5); tangente.updateMatrixWorld();
  const fuera = new THREE.PointLight(0xffffff, 1, 4.999); fuera.position.set(15, 5, 5); fuera.updateMatrixWorld();
  assert.deepEqual(lightSetFor(box, [...siempre, tangente, fuera]), [...siempre, tangente]);
});
test('lightSetFor: una caja vacía solo recibe las luces sin alcance finito', () => {
  const finita = new THREE.PointLight(0xffffff, 1, 1e6); finita.updateMatrixWorld();
  const siempre = new THREE.PointLight(0xffffff, 1, 0);
  assert.deepEqual(lightSetFor(new THREE.Box3(), [finita, siempre]), [siempre]);
});
test('lightSetFor usa la posición en mundo y no modifica la lista de entrada', () => {
  const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10));
  const padre = new THREE.Group(); padre.position.set(100, 0, 0);
  const l = new THREE.PointLight(0xffffff, 1, 5); l.position.set(5, 5, 5); padre.add(l);
  const lista = [l];
  assert.deepEqual(lightSetFor(box, lista), []);
  padre.position.set(0, 0, 0);
  assert.deepEqual(lightSetFor(box, lista), [l]);
  assert.deepEqual(lista, [l]);
  assert.notEqual(lightSetFor(box, lista), lista);
});
test('padLightSets: no muta la entrada, conserva el orden propio y rellena en el orden global', () => {
  const P = named('P', 4, () => new THREE.PointLight());
  const S = named('S', 6, () => new THREE.SpotLight());
  const a = { key: 'a', points: [P[2]], spots: [S[4], S[1]] };
  const b = { key: 'b', points: [P[1], P[3]], spots: [S[0], S[5], S[2], S[3]] };
  const out = padLightSets([a, b], P, S, 1);
  assert.deepEqual([names(a.points), names(a.spots)], [['P2'], ['S4', 'S1']]);
  assert.deepEqual(names(out.get('a').points), ['P2', 'P0']);
  assert.deepEqual(names(out.get('a').spots), ['S4', 'S1', 'S0', 'S2']);
  assert.deepEqual(names(out.get('b').points), ['P1', 'P3']);
  assert.deepEqual(names(out.get('b').spots), ['S0', 'S5', 'S2', 'S3']);
});
test('padLightSets: por defecto como mucho tres clases de tamaño y las luces propias van primero', () => {
  const P = named('P', 5, () => new THREE.PointLight());
  const S = named('S', 11, () => new THREE.SpotLight());
  const tamanos = [[0, 0], [1, 2], [2, 1], [1, 4], [0, 5], [2, 6], [3, 3], [1, 0]];
  const entries = tamanos.map(([p, s], i) => ({ key: `k${i}`, points: P.slice(0, p), spots: S.slice(i % 3, (i % 3) + s) }));
  const out = padLightSets(entries, P, S);
  assert.deepEqual([...out.keys()], entries.map((e) => e.key));
  const clases = new Set([...out.values()].map((v) => `${v.points.length}/${v.spots.length}`));
  assert.ok(clases.size <= 3, [...clases].join(' '));
  for (const e of entries) {
    const v = out.get(e.key);
    assert.deepEqual(v.points.slice(0, e.points.length), e.points);
    assert.deepEqual(v.spots.slice(0, e.spots.length), e.spots);
    assert.equal(new Set(v.points).size, v.points.length);
    assert.equal(new Set(v.spots).size, v.spots.length);
  }
});
test('routeBox: une varias curvas y aplica el margen por defecto', () => {
  const a = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0)]);
  const b = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 4, 20), new THREE.Vector3(0, 6, 30)]);
  const box = routeBox([a, b]);
  const close = (u, v) => Math.abs(u - v) < 1e-9;
  assert.ok([box.min.x, box.min.y, box.min.z].every((u, i) => close(u, [-1.5, -1.5, -1.5][i])), String(box.min.toArray()));
  assert.ok([box.max.x, box.max.y, box.max.z].every((u, i) => close(u, [11.5, 7.5, 31.5][i])), String(box.max.toArray()));
});
test('findLightViolations: una luz sin alcance finito falta si no está; una que no alcanza, no', () => {
  const box = new THREE.Box3(new THREE.Vector3(1, 1, 1), new THREE.Vector3(2, 2, 2));
  const infinita = new THREE.PointLight(0xffffff, 1, 0); infinita.position.set(500, 0, 0); infinita.updateMatrixWorld();
  const lejana = new THREE.PointLight(0xffffff, 1, 5); lejana.position.set(500, 0, 0); lejana.updateMatrixWorld();
  const out = findLightViolations([
    { name: 'a', box, lightIds: new Set() },
    { name: 'b', box, lightIds: new Set([infinita.uuid]) },
  ], [infinita, lejana]);
  assert.deepEqual(out, [{ name: 'a', light: infinita.uuid }]);
});

// ---------- Pruebas añadidas en la tarea 7 ----------

const pointAt = (x, y, z, distance) => {
  const l = new THREE.PointLight(0xffffff, 1, distance);
  l.position.set(x, y, z);
  l.updateMatrixWorld();
  return l;
};
const unitBox = (x, y, z) => new THREE.Box3(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1, y + 1, z + 1));

test('lightSetForBoxes: la luz entra si alcanza alguna de las cajas, en el orden de entrada', () => {
  const boxes = [unitBox(0, 0, 0), unitBox(100, 0, 0)];
  const cerca2 = pointAt(105, 0.5, 0.5, 5); // solo alcanza la segunda caja (borde a 4 m)
  const cerca1 = pointAt(-3, 0.5, 0.5, 4); // solo alcanza la primera (borde a 3 m)
  const entre = pointAt(50, 0.5, 0.5, 20); // a 49 m de las dos: ninguna
  const infinita = pointAt(900, 0, 0, 0);
  assert.deepEqual(lightSetForBoxes(boxes, [cerca2, entre, infinita, cerca1]), [cerca2, infinita, cerca1]);
  // la caja que une las dos sí la alcanzaría: la lista es más estricta que su unión
  assert.deepEqual(lightSetFor(new THREE.Box3().union(boxes[0]).union(boxes[1]), [entre]), [entre]);
});
test('lightSetForBoxes coincide con lightSetFor caja a caja y no modifica la entrada', () => {
  const boxes = [unitBox(0, 0, 0), unitBox(7, 3, -2), unitBox(-6, 0, 9)];
  const lights = [pointAt(3, 0, 0, 2.5), pointAt(9, 9, 9, 6), pointAt(-9, 1, 9, 3.2), pointAt(0, 30, 0, 10), pointAt(2, 2, 2, NaN)];
  const copy = [...lights];
  const expected = lights.filter((l) => boxes.some((b) => lightSetFor(b, [l]).length === 1));
  assert.deepEqual(lightSetForBoxes(boxes, lights), expected);
  assert.deepEqual(lights, copy);
  // sin cajas, como una caja vacía: solo las luces sin alcance finito
  assert.deepEqual(lightSetForBoxes([], lights), [lights[4]]);
});

// Entradas de prueba: k puntuales y s focos propios, tomados de P y S en orden.
const P7 = Array.from({ length: 6 }, () => new THREE.PointLight());
const S7 = Array.from({ length: 10 }, () => new THREE.SpotLight());
const entry = (key, ip, is) => ({ key, points: ip.map((i) => P7[i]), spots: is.map((i) => S7[i]) });

test('padLightClasses: con clases de sobra no rellena nada', () => {
  const entries = [entry('a', [], [0, 1]), entry('b', [0], [2]), entry('c', [1, 2], [])];
  const out = padLightClasses(entries, P7, S7, 3);
  assert.deepEqual([...out.keys()], ['a', 'b', 'c']);
  for (const e of entries) {
    assert.deepEqual(out.get(e.key).points, e.points);
    assert.deepEqual(out.get(e.key).spots, e.spots);
    assert.notEqual(out.get(e.key).points, e.points); // copias: no comparte los arrays de la entrada
  }
  // dos entradas con los mismos tamaños forman una sola clase
  assert.equal(padLightClasses([entry('a', [0], [1]), entry('b', [1], [2])], P7, S7, 1).get('a').spots.length, 1);
});
test('padLightClasses: une primero las clases que menos luces añaden', () => {
  // tamaños (puntuales, focos): a (0,4) b (0,5) c (2,3) d (0,3) e (0,1) f (2,2) g (3,1) → 7 clases
  const entries = [
    entry('a', [], [0, 1, 2, 3]), entry('b', [], [0, 1, 2, 3, 4]), entry('c', [0, 1], [5, 6, 7]), entry('d', [], [7, 8, 9]),
    entry('e', [], [9]), entry('f', [2, 3], [1, 2]), entry('g', [3, 4, 5], [6]),
  ];
  const out = padLightClasses(entries, P7, S7, 5);
  const size = (k) => [out.get(k).points.length, out.get(k).spots.length];
  // hay tres uniones de coste 1 (a con b, a con d y c con f); a con b es la pareja más temprana y, tras ella, c con f
  // (unir d con la clase de a y b ya cuesta 2): a sube a (0,5) y f a (2,3); el resto queda igual
  assert.deepEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(size), [[0, 5], [0, 5], [2, 3], [0, 3], [0, 1], [2, 3], [3, 1]]);
  const classes = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => size(k).join()));
  assert.equal(classes.size, 5);
  // con una sola clase, todas al máximo de puntuales y de focos
  const one = padLightClasses(entries, P7, S7, 1);
  for (const e of entries) assert.deepEqual([one.get(e.key).points.length, one.get(e.key).spots.length], [3, 5]);
});
test('padLightClasses: luces propias primero, relleno en el orden global, sin duplicados y sin tocar la entrada', () => {
  const entries = [entry('x', [4], [3, 8]), entry('y', [0, 5], [1, 2, 9])];
  const before = entries.map((e) => [[...e.points], [...e.spots]]);
  const out = padLightClasses(entries, P7, S7, 1);
  assert.deepEqual(out.get('x').points, [P7[4], P7[0]]);
  assert.deepEqual(out.get('x').spots, [S7[3], S7[8], S7[0]]);
  assert.deepEqual(out.get('y').points, [P7[0], P7[5]]);
  assert.deepEqual(out.get('y').spots, [S7[1], S7[2], S7[9]]);
  for (const [k, s] of out) {
    assert.equal(new Set(s.points).size, s.points.length, k);
    assert.equal(new Set(s.spots).size, s.spots.length, k);
  }
  assert.deepEqual(entries.map((e) => [e.points, e.spots]), before);
});
test('padLightClasses: a igual coste une las clases que aparecen antes y el resultado no depende de nada más', () => {
  // a (1,0) b (0,1) c (1,1): unir a con c o b con c cuesta 1; gana la pareja con la clase más temprana (a, c)
  const entries = [entry('a', [0], []), entry('b', [], [0]), entry('c', [1], [1])];
  const out = padLightClasses(entries, P7, S7, 2);
  assert.deepEqual([out.get('a').points.length, out.get('a').spots.length], [1, 1]);
  assert.deepEqual([out.get('b').points.length, out.get('b').spots.length], [0, 1]);
  const again = padLightClasses(entries, P7, S7, 2);
  for (const k of ['a', 'b', 'c']) assert.deepEqual(again.get(k), out.get(k));
});
