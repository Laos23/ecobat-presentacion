# Rendimiento en gráficas integradas · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** que la presentación vaya fluida en gráficas integradas (Ryzen 5 5500G o peor) con píxeles idénticos a los de hoy.

**Arquitectura:** el mundo se parte en fragmentos (uno por isla, agua lejana y dinámico); la geometría se fusiona por fragmento y material; cada material iluminado se clona por fragmento y recibe, por inyección en `lights_fragment_begin`, solo las luces locales que alcanzan ese fragmento (regla exacta: una luz más allá de su `distance` suma cero). Un solo pase de render, como hoy. Todo lo que el driver hace en el primer uso se adelanta a un calentamiento bajo el velo.

**Stack:** three 0.186.1 (fijado), Vite 8, Node 24 (`node --test` para pruebas unitarias), arnés Playwright existente en `.verify/` (ignorado por git, con `playwright-core` y `pngjs` en `.verify/node_modules`).

**Especificación:** `docs/superpowers/specs/2026-10-21-rendimiento-integradas-design.md`. El plan argumenta desde ella; quien ejecute debe leer las dos.

## Restricciones globales

- three fijado en `0.186.1` (`package.json`: `"three": "0.186.1"` sin `^`). La inyección copia texto de `THREE.ShaderChunk.lights_fragment_begin`.
- Sin dependencias nuevas. Las pruebas unitarias usan `node:test` y `node:assert/strict`; los módulos que prueban (`src/world/chunks.js`, `src/world/chunkLights.js`, `src/world/water.js`) solo importan `three` y `./layout.js`, nunca `kit.js`, `textures.js` ni `pbr.js` (usan `document`).
- Píxeles idénticos según §7.1 de la especificación: ningún píxel con diferencia > 1/255 salvo píxeles aislados (sin vecino de 8 que también difiera) hasta 8/255 y como mucho `max(1, floor(ancho·alto·0,00001))` por captura. Cada tarea que toque `src/` termina con esa verificación en verde a 1440×810, 1280×720 y 390×844.
- Los materiales `M.*` originales no se modifican; se clonan. `K.bakeStatic` conserva la proyección de UV en mundo y la regla de `castShadow`.
- Un solo `renderer.render()` de escena por fotograma. Sin capas, sin pases extra.
- No tocar `src/camera.js`, `src/content.js`, `src/ui.js`, `src/styles.css`, `docs/evidencia/`.
- Textos y comentarios del código en castellano, como el resto del proyecto. Identificadores en inglés como los existentes.
- Rama de trabajo: `rendimiento-integradas`, creada desde `main` en la tarea 1. Un commit por tarea como mínimo.
- Nombres de los fragmentos: `s1`, `s2`, `s3`, `s4`, `sA`, `sB`, `s5`, `s6`, `agua-lejana`, `dinamico`, `resto`.

## Puntos de revisión

Entradas que la especificación implica y que ninguna tarea cubriría por sí sola; cada una tiene su prueba en la tarea indicada.

1. Cambio de tamaño de ventana o pantalla completa después del calentamiento: `layout()` debe restaurar el tamaño real y el mundo seguir idéntico. Prueba en la tarea 8 (`resizeprobe.mjs`).
2. `prefers-reduced-motion`: solo se renderizan unos fotogramas tras cada cambio; los uniformes por fragmento deben estar al día en ese primer render. Prueba en la tarea 9 (capturas con movimiento reducido comparadas con `antes`).
3. `?debug&nobake`: sin fragmentos ni clones; colliders y piezas como hoy. Prueba en la tarea 4 (`harness.mjs clearance`).
4. Una luz local con `distance` 0 o sin `distance`: entra en todos los fragmentos. Prueba unitaria en la tarea 2 (`lightSetFor`).
5. Las baterías de la simulación aparcadas en destino (capítulo 4 con `sim = 1`) y en cola (capítulo 3): deben seguir dentro de la caja de `dinamico`. Prueba en la tarea 7 (`checklights.mjs` en p = 0,4134 y 0,5592).

---

### Tarea 1: herramientas de verificación y línea base

**Archivos:**
- Modificar: `package.json` (script `test`, fijar three)
- Crear: `.verify/perf/pixeldiff.mjs`, `.verify/perf/shots-all.mjs`, `tests/pixeldiff.test.mjs`
- Copiar a `.verify/perf/`: `gpuprobe.mjs`, `scenestats.mjs`, `breakdown.mjs`, `sweep.mjs`, `gpuinfo.mjs`, `perfprobe.mjs` desde `C:\Users\yamil\.claude\jobs\7b9bc624\tmp\` (sin cambios; usan `createRequire` con la ruta absoluta de `.verify/package.json`)

**Interfaces:**
- Produce: `comparePixels(a: Uint8Array, b: Uint8Array, width: number, height: number) → { max: number, over8: number, clustered: number, isolated: number, isolatedMax: number, ok: boolean }` exportada por `.verify/perf/pixeldiff.mjs`. `over8` cuenta píxeles con diferencia máxima de canal > 8; `clustered` los de diferencia 2..8 con algún vecino de 8 de diferencia > 1; `isolated` los de 2..8 sin tal vecino; `isolatedMax = Math.max(1, Math.floor(width * height * 0.00001))`; `ok = over8 === 0 && clustered === 0 && isolated <= isolatedMax`. El canal alfa se ignora.
- Produce: CLI `node .verify/perf/pixeldiff.mjs <dirA> <dirB> [--out <dir>]`: compara cada PNG con el mismo nombre en ambos directorios (recursivo), imprime una línea por imagen (`OK`/`FALLO`, `max`, `over8`, `clustered`, `isolated`), escribe `<nombre>.diff.png` (diferencia ×32, saturada) en `--out` (por defecto `<dirB>/diff/`), y termina con código 1 si alguna falla.
- Produce: CLI `node .verify/perf/shots-all.mjs <buildDir> <outDir>`: lanza `node .verify/harness.mjs shots` tres veces (1440×810 `--dsf 1`, 1280×720 `--dsf 1`, 390×844 `--dsf 3`) con `--settle 900`, `--ps 0.0001,0.1555,0.302,0.4134,0.5592,0.7142,0.8464,1,0.09,0.2525,0.512,0.668,0.80,0.915` y `--names a0,a1,a2,a3,a4,a5,a6,a7,t1,t2,t3,t4,t5,t6`, guardando en `<outDir>/1440`, `<outDir>/1280`, `<outDir>/movil`.

- [ ] **Paso 1: rama y three fijado**

```bash
git switch -c rendimiento-integradas
```

En `package.json`: `"three": "0.186.1"` y `"test": "node --test tests/"` en `scripts`. Ejecutar `npm install` y comprobar que `node_modules/three/package.json` sigue en `0.186.1`.

- [ ] **Paso 2: prueba unitaria de `comparePixels`**

`tests/pixeldiff.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparePixels } from '../.verify/perf/pixeldiff.mjs';

const W = 100, H = 100;
const img = (fill = 128) => new Uint8Array(W * H * 4).fill(fill);
const set = (a, x, y, v) => { const i = (y * W + x) * 4; a[i] = a[i + 1] = a[i + 2] = v; };

test('idénticas: ok', () => assert.equal(comparePixels(img(), img(), W, H).ok, true));
test('diferencia de 1 en todos los píxeles: ok', () => {
  const r = comparePixels(img(128), img(129), W, H);
  assert.equal(r.ok, true); assert.equal(r.max, 1);
});
test('un píxel aislado a 8: ok', () => {
  const b = img(); set(b, 10, 10, 136);
  const r = comparePixels(img(), b, W, H);
  assert.deepEqual([r.ok, r.isolated, r.clustered, r.over8], [true, 1, 0, 0]);
});
test('un píxel a 9: fallo', () => {
  const b = img(); set(b, 10, 10, 137);
  assert.equal(comparePixels(img(), b, W, H).ok, false);
});
test('dos píxeles contiguos a 5: fallo (con estructura)', () => {
  const b = img(); set(b, 10, 10, 133); set(b, 11, 10, 133);
  const r = comparePixels(img(), b, W, H);
  assert.equal(r.clustered, 2); assert.equal(r.ok, false);
});
test('isolatedMax para 100×100 es 1 y 2 aislados fallan', () => {
  const b = img(); set(b, 10, 10, 133); set(b, 50, 50, 133);
  const r = comparePixels(img(), b, W, H);
  assert.equal(r.isolatedMax, 1); assert.equal(r.ok, false);
});
```

- [ ] **Paso 3: ejecutar y ver que falla**

Ejecutar: `npm test`
Esperado: FALLO (`Cannot find module` de `pixeldiff.mjs`).

- [ ] **Paso 4: implementar `.verify/perf/pixeldiff.mjs`**

`comparePixels` como en Interfaces; CLI con `pngjs` (`createRequire('C:/Proyects/Sostenibilidad/.verify/package.json')`), recorrido recursivo de `dirA`, solo el CLI usa `pngjs` (la función exportada no, para que la prueba no lo necesite). Diferencia amplificada: `min(255, diff * 32)` en gris sobre negro.

- [ ] **Paso 5: ejecutar y ver que pasa**

Ejecutar: `npm test`
Esperado: 6 pruebas, `pass 6`, `fail 0`.

- [ ] **Paso 6: `shots-all.mjs` y copia de sondas**

Implementar `shots-all.mjs` con `child_process.spawnSync` sobre `node .verify/harness.mjs shots --dir <buildDir> --ps ... --names ... --out <outDir>/<tamaño> --settle 900 --w W --h H --dsf D`, desde la raíz del repositorio. Copiar las seis sondas a `.verify/perf/`.

- [ ] **Paso 7: línea base**

```bash
npx vite build --outDir .verify/build-antes
node .verify/perf/shots-all.mjs .verify/build-antes .verify/ref/antes
node .verify/perf/shots-all.mjs .verify/build-antes .verify/ref/antes-bis
node .verify/perf/pixeldiff.mjs .verify/ref/antes .verify/ref/antes-bis
```

Esperado: 42 imágenes en cada carpeta; `pixeldiff` imprime 42 líneas `OK` con `max 0` (si alguna da `max` 1 o más, el mundo no es determinista entre cargas: investigar antes de seguir; `groundTexture` no se llama, así que no debería ocurrir) y termina con código 0.

- [ ] **Paso 8: medidas de la línea base en la integrada**

```bash
npx vite preview --outDir .verify/build-antes --port 4181
CHROME_EXTRA="--use-adapter-luid=0,113510" node .verify/perf/scenestats.mjs --url http://localhost:4181/ --out .verify/out/stats-antes-igpu.json --dsf 1
CHROME_EXTRA="--use-adapter-luid=0,113510" node .verify/perf/perfprobe.mjs .verify/build-antes .verify/out/perf-antes-igpu.json
node .verify/perf/gpuprobe.mjs --url http://localhost:4181/ --out .verify/out/gpu-antes-5090.json --profile
```

Esperado: `stats-antes-igpu.json` con GPU por capítulo en torno a 51-78 ms (base) y `readyMs` ≈ 3 300; `perf-antes-igpu.json` con `readyMs` y tirones; `gpu-antes-5090.json` con `cpuByPhase.scroll.med` ≈ 4,2 y perfil. Guardar los tres: son la referencia de las tareas 7-9. (Si el LUID `0,113510` no apareciera, obtenerlo con `node .verify/perf/gpuinfo.mjs`.)

- [ ] **Paso 9: commit**

```bash
git add package.json package-lock.json tests/pixeldiff.test.mjs
git commit -m "Pruebas unitarias con node --test y three fijado en 0.186.1"
```

(`.verify/` está en `.gitignore`; sus scripts se documentan en `.verify/brief.md` en la tarea 10.)

---

### Tarea 2: `chunks.js`, asignación y conjuntos de luces (puro)

**Archivos:**
- Crear: `src/world/chunks.js`, `tests/chunks.test.mjs`

**Interfaces:**
- Produce: `CHUNK_KEYS = ['s1','s2','s3','s4','sA','sB','s5','s6']`.
- Produce: `platformAt(x, z) → string | null`: clave de la plataforma que contiene el punto (mismo test que `islandFloor` de `world.js`: círculo `dx²+dz² < r²`, rectángulo `|dx| < w/2 && |dz| < d/2`, con `STATIONS` y `PLATFORMS` de `layout.js`).
- Produce: `chunkKeyFor(x, z) → string`: `platformAt` si no es null; si no, la plataforma a menor distancia en xz al borde de su forma (círculo: `max(0, dist − r)`; rectángulo: distancia a la caja `[−w/2, w/2] × [−d/2, d/2]`).
- Produce: `partitionByChunk(items, keyOf = (p) => chunkKeyFor(p.x, p.z)) → Map<string, Array<[item, indexOriginal]>>` con los índices originales de `items`.
- Produce: `lightSetFor(box: THREE.Box3, lights: THREE.Light[]) → THREE.Light[]`: las luces, en el orden de entrada, cuya esfera (`light.getWorldPosition`, radio `light.distance`) corta `box` (`box.intersectsSphere`); una luz con `distance <= 0` o no numérico se incluye siempre.
- Produce: `padLightSets(entries: Array<{ key: string, points: Light[], spots: Light[] }>, allPoints: Light[], allSpots: Light[], maxClasses = 3) → Map<string, { points: Light[], spots: Light[] }>`: ordena las entradas por `points.length + spots.length`, las reparte en `maxClasses` grupos consecutivos de tamaño `ceil(n / maxClasses)`, y en cada grupo rellena cada entrada hasta el máximo de puntuales y de focos del grupo añadiendo al final luces de `allPoints`/`allSpots` que no estén ya, en su orden. Las luces originales conservan su orden al principio.
- Produce: `routeBox(curves: THREE.Curve[], samples = 200, margin = 1.5) → THREE.Box3`: caja de los puntos muestreados (`getPointAt(i / samples)`) ampliada `margin` en los tres ejes.
- Produce: `findLightViolations(entries: Array<{ name: string, box: THREE.Box3, lightIds: Set<string> }>, lights: Light[]) → Array<{ name: string, light: string }>`: para cada entrada, las luces (por `uuid`) cuya esfera corta la caja y no están en `lightIds`.

- [ ] **Paso 1: pruebas**

`tests/chunks.test.mjs` (valores de `STATIONS`/`PLATFORMS`: `s1` círculo r 13 en (−58, 14); `s2` rectángulo 22×18 en (−30, 4); `s5` rectángulo 34×20 en (38, 20); `s6` círculo r 10 en (60, −20)):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { chunkKeyFor, platformAt, partitionByChunk, lightSetFor, padLightSets, routeBox, findLightViolations } from '../src/world/chunks.js';

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
```

- [ ] **Paso 2: ejecutar y ver que falla** · `npm test` → FALLO (`Cannot find module '../src/world/chunks.js'`).

- [ ] **Paso 3: implementar `src/world/chunks.js`** con las firmas de Interfaces. Solo importa `three` y `./layout.js`.

- [ ] **Paso 4: ejecutar y ver que pasa** · `npm test` → `fail 0`.

- [ ] **Paso 5: commit** · `git add src/world/chunks.js tests/chunks.test.mjs && git commit -m "Fragmentos del mundo: asignación por plataforma y conjuntos de luces exactos"`

---

### Tarea 3: agua en celdas

**Archivos:**
- Crear: `src/world/water.js`, `tests/water.test.mjs`
- Modificar: `src/world/edges.js:1036-1044` (`buildTerrain`)

**Interfaces:**
- Produce: `waterGeometries({ radius, segments, bounds: { minX, maxX, minZ, maxZ }, cell }) → { cells: Array<{ geometry: THREE.BufferGeometry, cx: number, cz: number }>, outer: THREE.BufferGeometry, snapped: { minX, maxX, minZ, maxZ } }`. `snapped` es `bounds` ampliado hacia fuera a múltiplos de `cell` (centrado en 0). Cada celda es un `PlaneGeometry(cell, cell)` llevado al plano xz y trasladado a `(cx, 0, cz)`; `outer` es un `ShapeGeometry` del disco de `radius` con `segments` divisiones (`Shape.absarc(0, 0, radius, 0, 2π)`, mismo ángulo inicial que `CircleGeometry`) con un agujero rectangular igual a `snapped`, también llevado al plano xz. El paso al plano xz se hace copiando coordenadas, no con `rotateX`: cada vértice `(x, y, 0)` pasa a `(x, 0, −y)` y cada normal a `(0, 1, 0)` exactas (una rotación de −π/2 deja residuos de 1e-16 que romperían las pruebas). Todas las geometrías tienen y = 0 y normales (0, 1, 0).
- Produce: `waterBounds(stations, platforms, reach) → { minX, maxX, minZ, maxZ }`: unión de las cajas xz de las plataformas (círculo: ±r; rectángulo: ±w/2, ±d/2) ampliada `reach`.
- Consume: `WATER_Y`, `PLATFORMS`, `STATIONS` de `edges.js`/`layout.js`.

- [ ] **Paso 1: pruebas**

`tests/water.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterGeometries, waterBounds } from '../src/world/water.js';
import { STATIONS, PLATFORMS } from '../src/world/layout.js';

test('waterBounds abarca todas las plataformas más el alcance', () => {
  const b = waterBounds(STATIONS, PLATFORMS, 34);
  assert.ok(b.minX <= -58 - 13 - 34 && b.maxX >= 60 + 10 + 34);
  assert.ok(b.minZ <= -28 - 4 - 34 && b.maxZ >= 20 + 10 + 34);
});
test('celdas: rejilla completa, en el plano xz, normales arriba', () => {
  const { cells, snapped, outer } = waterGeometries({ radius: 1600, segments: 96, bounds: { minX: -10, maxX: 10, minZ: -30, maxZ: 5 }, cell: 24 });
  assert.deepEqual(snapped, { minX: -24, maxX: 24, minZ: -48, maxZ: 24 });
  assert.equal(cells.length, 2 * 3);
  for (const { geometry } of cells) {
    const p = geometry.attributes.position; const n = geometry.attributes.normal;
    for (let i = 0; i < p.count; i++) { assert.equal(p.getY(i), 0); assert.deepEqual([n.getX(i), n.getY(i), n.getZ(i)], [0, 1, 0]); }
  }
  const xs = new Set(cells.map((c) => c.cx)); assert.deepEqual([...xs].sort((a, b) => a - b), [-12, 12]);
  const op = outer.attributes.position;
  let maxR = 0; const corners = new Set();
  for (let i = 0; i < op.count; i++) {
    assert.equal(op.getY(i), 0);
    maxR = Math.max(maxR, Math.hypot(op.getX(i), op.getZ(i)));
    corners.add(`${op.getX(i)},${op.getZ(i)}`);
  }
  assert.ok(maxR <= 1600 + 1e-6);
  for (const c of ['-24,-48', '24,-48', '24,24', '-24,24']) assert.ok(corners.has(c), c);
});
```

- [ ] **Paso 2: ejecutar y ver que falla** · `npm test` → FALLO (módulo inexistente).

- [ ] **Paso 3: implementar `src/world/water.js`** (solo importa `three`). Agujero: `Path` rectangular con las esquinas de `snapped`; como la coordenada y de la forma pasa a −z, la forma se construye con `y = −z`.

- [ ] **Paso 4: ejecutar y ver que pasa** · `npm test` → `fail 0`.

- [ ] **Paso 5: usar las celdas en `buildTerrain`**

En `src/world/edges.js`, sustituir el `CircleGeometry(1600, 96)` por `waterGeometries({ radius: 1600, segments: 96, bounds: waterBounds(STATIONS, PLATFORMS, reach + 2), cell: 24 })` donde `reach` es el mayor `distance` de los focos y puntuales del mundo. Como las luces se crean en las estaciones, que se construyen después del terreno, usar la constante `WATER_REACH = 34` (el mayor `distance` hoy es 32: `Math.max(w, d) * 2` del taller) y comprobarla en `buildWorld` tras construir las estaciones: `console.assert(maxDistance <= WATER_REACH)` con `?debug`. Cada celda y el disco exterior son un `Mesh` con `E.water`, `position.y = WATER_Y`, sin rotación, `receiveShadow = true`, `userData.noCollide = true`, `userData.waterCell = { cx, cz }` (el exterior, `userData.waterOuter = true`).

- [ ] **Paso 6: verificación de píxeles**

```bash
npx vite build --outDir .verify/build-despues
node .verify/perf/shots-all.mjs .verify/build-despues .verify/ref/despues
node .verify/perf/pixeldiff.mjs .verify/ref/antes .verify/ref/despues
```

Esperado: 42 `OK`. Si falla solo por el agua (diferencias aisladas por encima de `isolatedMax`, o alguna agrupada en bordes de sombra sobre el agua), aplicar la decisión 5 de la especificación: revertir este paso 5 (agua entera) y anotar en el commit que el agua queda en un fragmento propio con todas las luces (tarea 7, paso 3).

- [ ] **Paso 7: commit** · `git add src/world/water.js tests/water.test.mjs src/world/edges.js && git commit -m "Agua en celdas por isla y disco exterior"`

---

### Tarea 4: fusión e instanciado por fragmento

**Archivos:**
- Modificar: `src/world/kit.js` (`bakeStatic` 1165-1211, `scatterTrees` 642-682, `scatterRocks` 718-749, `scatterLamps` 755-802, `contactShadows` 805-820)
- Modificar: `src/world/world.js` (`buildWorld` 128-410: llamada a `bakeStatic`, etiquetado, `dinamico`, retorno)
- Modificar: `src/main.js:530-661` (`makeDebug`: `chunks()`)

**Interfaces:**
- Consume: `chunkKeyFor`, `partitionByChunk` de la tarea 2.
- Produce: `bakeStatic(root, chunkOf = () => 'resto') → THREE.Group`: fusiona por clave `${chunkOf(o)}|${o.material.uuid}`; cada malla resultante lleva `userData.chunk = chunkOf(o)`. Misma proyección de UV y misma regla de `castShadow` que hoy.
- Produce: `scatterTrees`, `scatterRocks`, `scatterLamps`, `contactShadows` con la misma firma que hoy, pero devolviendo un `InstancedMesh` por fragmento y tipo (clave `chunkKeyFor(p.x, p.z)`), cada uno con `userData.chunk`. Colores y rotaciones dependientes del índice usan el índice **original** (`partitionByChunk`).
- Produce: en `buildWorld`, toda malla iluminada o no que quede sin fusionar recibe `userData.chunk` (centro de su caja en mundo → `chunkKeyFor`; baterías de `K.compact` → `'dinamico'`; disco exterior del agua → `'agua-lejana'`; celdas del agua → `chunkKeyFor(cx, cz)`).
- Produce: `buildWorld` devuelve además `chunks: Array<{ key: string, meshes: number, instanced: number }>` y `window.__ecobat.debug.chunks()` lo expone.

- [ ] **Paso 1: prueba del reparto de instancias** (puro, en `tests/chunks.test.mjs`): ya cubierto por `partitionByChunk` (tarea 2). No hay prueba unitaria nueva; la verificación es de píxeles y de recuento.

- [ ] **Paso 2: `bakeStatic(root, chunkOf)`** en `kit.js`. `chunkOf` por defecto devuelve `'resto'` para no cambiar el comportamiento de otros llamadores.

- [ ] **Paso 3: `scatter*` y `contactShadows` por fragmento.** En `scatterTrees`, `list(k)` ya produce pares `[p, i]`; repartir esos pares con `partitionByChunk` (clave por `p`) y llamar a `batch` por fragmento. En `scatterRocks`, `lists[v]` contiene pares; repartir cada lista por fragmento. `scatterLamps` y `contactShadows`: repartir `points`/`items`; la matriz de cada instancia usa el índice local.

- [ ] **Paso 4: `buildWorld`**: llamar a `K.bakeStatic(root, chunkOfMesh)` con `chunkOfMesh = (o) => { caja = o.geometry.boundingBox (calcular si falta) transformada por o.matrixWorld; centro → chunkKeyFor(x, z) }`; después recorrer `root` y asignar `userData.chunk` a las mallas sin él según Interfaces. Construir `chunks` (recuento por clave) y devolverlo.

- [ ] **Paso 5: `makeDebug().chunks()`** en `main.js` devuelve `world.chunks`.

- [ ] **Paso 6: verificación**

```bash
npx vite build --outDir .verify/build-despues
node .verify/perf/shots-all.mjs .verify/build-despues .verify/ref/despues
node .verify/perf/pixeldiff.mjs .verify/ref/antes .verify/ref/despues
npx vite preview --outDir .verify/build-despues --port 4182
node .verify/harness.mjs info --url http://localhost:4182/
node .verify/harness.mjs clearance --url http://localhost:4182/?debug&nobake --limit 1.2 --samples 4000
```

Esperado: 42 `OK`; `info` con `calls` mayor que antes (`info` acumula dos fotogramas: antes 474, ahora esperable 700-900) y los mismos triángulos en portada (todo a la vista); `clearance` con `colliders: 16625`, `violations: 0`, como en `.verify/brief.md`. En la consola de `?debug`, `__ecobat.debug.chunks()` lista las ocho islas, `agua-lejana` y `dinamico` con recuentos no nulos.

- [ ] **Paso 7: commit** · `git add src/world/kit.js src/world/world.js src/main.js && git commit -m "Fusión e instanciado por fragmento (sin cambios de luz)"`

---

### Tarea 5: clones de material por fragmento, sin inyección

**Archivos:**
- Crear: `src/world/chunkLights.js` (solo la fábrica de clones en esta tarea)
- Modificar: `src/world/world.js` (sustituye el bloque de clones por tipo de instanciado, líneas 377-398 de la versión original)

**Interfaces:**
- Produce: `createMaterialFactory() → { materialFor(material, chunkKey, kind) → THREE.Material, clones: Map }`: devuelve un clon por `(material.uuid, chunkKey, kind)` (caché), con `kind` 0 malla, 1 instanciada, 2 instanciada con color (`kindOf` de `world.js`). El clon copia `onBeforeCompile` y `customProgramCacheKey` del original (como hace hoy `world.js`), `userData.chunk = chunkKey`, `userData.chunkLights = []`. Los materiales `MeshBasicMaterial` y los arrays de materiales no se clonan (se devuelven tal cual).
- Produce: en `buildWorld`, tras el etiquetado de la tarea 4, cada malla con material iluminado (`isMeshStandardMaterial` o `isMeshPhysicalMaterial`) recibe `materialFor(material, userData.chunk, kindOf(o))`.

- [ ] **Paso 1: implementar la fábrica y usarla en `buildWorld`.** Eliminar el bloque anterior de clones por tipo (`kinds`/`clones`): la fábrica lo cubre porque la clave incluye `kind`.

- [ ] **Paso 2: verificación**

Mismos comandos de píxeles de la tarea 4. Además:

```bash
node .verify/perf/gpuprobe.mjs --url http://localhost:4182/ --out .verify/out/gpu-t5.json
```

Esperado: 42 `OK`; `gpu.programs` = 50 (los clones comparten programa porque su clave es la misma) y `textures` = 82.

- [ ] **Paso 3: commit** · `git add src/world/chunkLights.js src/world/world.js && git commit -m "Clones de material por fragmento"`

---

### Tarea 6: inyección de luces por fragmento con todas las luces (mecanismo)

**Archivos:**
- Modificar: `src/world/chunkLights.js`, `src/world/world.js`, `src/main.js` (`makeDebug`: `checkLights()`)
- Crear: `tests/chunkLights.test.mjs`, `.verify/perf/checklights.mjs`

**Interfaces:**
- Produce: `cutBlock(text: string, startLine: string) → string`: elimina desde la línea que empieza por `startLine` (exactamente una ocurrencia, si no lanza `Error`) hasta su `#endif` emparejado inclusive, contando `#if`, `#ifdef`, `#ifndef` anidados.
- Produce: `injectChunkLights(shader: { fragmentShader: string, uniforms: object }, Kp: number, Ks: number) → void`: (1) tras `#include <lights_pars_begin>` añade `uniform PointLight uChunkPoint[Kp];` si `Kp > 0` y `uniform SpotLight uChunkSpot[Ks];` si `Ks > 0`; (2) sustituye `#include <lights_fragment_begin>` por `THREE.ShaderChunk.lights_fragment_begin` modificado: con `Kp > 0`, `for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ )` → `for ( int i = 0; i < Kp; i ++ )` y `pointLight = pointLights[ i ];` → `pointLight = uChunkPoint[ i ];`; con `Kp === 0`, `cutBlock` del bloque `#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )`; igual para focos con `NUM_SPOT_LIGHTS`, `spotLights`, `uChunkSpot`. Cada cadena buscada debe aparecer exactamente una vez; si no, lanza `Error` con la cadena.
- Produce: `createChunkLightState(points: PointLight[], spots: SpotLight[]) → { points: object[], spots: object[], frame: number, sync(camera: THREE.Camera, frame: number): void }`: objetos de uniforme con los campos de los structs de three (`position: Vector3, color: Color, distance, decay` y además `direction: Vector3, coneCos, penumbraCos` en focos). `sync` no hace nada si `frame === this.frame`; si no, calcula los valores copiando las operaciones de `WebGLLights.setup`/`setupView` de `node_modules/three/build/three.module.js` (buscar `isSpotLight` dentro de `function WebGLLights`): `color.copy(light.color).multiplyScalar(light.intensity)`, `distance`, `decay`, `coneCos = Math.cos(light.angle)`, `penumbraCos = Math.cos(light.angle * (1 - light.penumbra))`, `position.setFromMatrixPosition(light.matrixWorld).applyMatrix4(camera.matrixWorldInverse)`, `direction.setFromMatrixPosition(light.matrixWorld).sub(v.setFromMatrixPosition(light.target.matrixWorld)).transformDirection(camera.matrixWorldInverse)`.
- Produce: `materialFor(material, chunkKey, kind, state)` de la fábrica ahora recibe el `state` del fragmento: el clon encadena `onBeforeCompile` (primero el original, luego `injectChunkLights(sh, state.points.length, state.spots.length)` y `sh.uniforms.uChunkPoint = { value: state.points }`, `sh.uniforms.uChunkSpot = { value: state.spots }`), y `customProgramCacheKey = () => `${original ? original() : ''}|chunk|${Kp}|${Ks}``; `userData.chunkLights` = uuids de `points` y `spots`.
- Produce: cada malla con clon recibe `onBeforeRender = (renderer, scene, camera) => state.sync(camera, renderer.info.render.frame)`.
- Produce: `buildWorld` devuelve `checkLights() → Array<{ name, light }>`: para cada malla con clon, caja en mundo (`Box3.setFromObject`; en instanciadas, unión de las cajas por instancia) y `findLightViolations` contra todas las luces locales. `window.__ecobat.debug.checkLights()` lo expone.
- En esta tarea el `state` de **todos** los fragmentos contiene todas las luces locales en orden de recorrido de la escena (`root.traverse`, `isSpotLight`/`isPointLight`): valida el mecanismo sin quitar ninguna luz.

- [ ] **Paso 1: pruebas**

`tests/chunkLights.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cutBlock, injectChunkLights, createChunkLightState } from '../src/world/chunkLights.js';

const once = (s, needle) => s.split(needle).length - 1;
const base = () => ({ fragmentShader: '#include <common>\n#include <lights_pars_begin>\n#include <lights_fragment_begin>\n', uniforms: {} });

test('cutBlock quita un bloque con #if anidados', () => {
  const t = 'a\n#if X\n#ifdef Y\nb\n#endif\nc\n#endif\nd\n';
  assert.equal(cutBlock(t, '#if X'), 'a\nd\n');
  assert.throws(() => cutBlock(t, '#if Z'), /#if Z/);
});
test('inyección con Kp=1, Ks=2', () => {
  const sh = base();
  injectChunkLights(sh, 1, 2);
  const f = sh.fragmentShader;
  assert.equal(once(f, 'uniform PointLight uChunkPoint[1];'), 1);
  assert.equal(once(f, 'uniform SpotLight uChunkSpot[2];'), 1);
  assert.equal(once(f, 'for ( int i = 0; i < 1; i ++ )'), 1);
  assert.equal(once(f, 'for ( int i = 0; i < 2; i ++ )'), 1);
  assert.equal(once(f, 'pointLight = uChunkPoint[ i ];'), 1);
  assert.equal(once(f, 'spotLight = uChunkSpot[ i ];'), 1);
  assert.equal(once(f, 'pointLights[ i ]'), 0);
  assert.equal(once(f, 'spotLights[ i ]'), 0);
  assert.equal(once(f, '#include <lights_fragment_begin>'), 0);
  assert.equal(once(f, 'RE_Direct( directLight'), once(THREE.ShaderChunk.lights_fragment_begin, 'RE_Direct( directLight'));
});
test('inyección con Kp=0 elimina el bloque de puntuales', () => {
  const sh = base();
  injectChunkLights(sh, 0, 3);
  assert.equal(once(sh.fragmentShader, 'uChunkPoint'), 0);
  assert.equal(once(sh.fragmentShader, 'pointLight = '), 0);
  assert.equal(once(sh.fragmentShader, 'spotLight = uChunkSpot[ i ];'), 1);
});
test('inyección falla si falta el include', () => {
  assert.throws(() => injectChunkLights({ fragmentShader: '#include <common>', uniforms: {} }, 1, 1), /lights_pars_begin/);
});
test('sync calcula posición y dirección en espacio de vista', () => {
  const spot = new THREE.SpotLight(0xff8800, 2, 10, 0.5, 0.25, 1.5);
  spot.position.set(0, 10, 0); spot.target.position.set(0, 0, 0);
  spot.updateMatrixWorld(); spot.target.updateMatrixWorld();
  const cam = new THREE.PerspectiveCamera(); cam.position.set(0, 0, 20); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const st = createChunkLightState([], [spot]);
  st.sync(cam, 1);
  const u = st.spots[0];
  assert.deepEqual([u.position.x, u.position.y, u.position.z], [0, 10, -20]);
  assert.deepEqual([u.direction.x, u.direction.y, u.direction.z], [0, 1, 0]); // de la diana a la luz, como en WebGLLights
  assert.equal(u.coneCos, Math.cos(0.5)); assert.equal(u.penumbraCos, Math.cos(0.5 * 0.75));
  assert.equal(u.distance, 10); assert.equal(u.decay, 1.5);
  assert.equal(u.color.r, 2); assert.equal(st.frame, 1);
});
```

- [ ] **Paso 2: ejecutar y ver que falla** · `npm test` → FALLO (exportaciones inexistentes).

- [ ] **Paso 3: implementar** `cutBlock`, `injectChunkLights`, `createChunkLightState` y la fábrica ampliada en `chunkLights.js`; en `buildWorld`, recoger las luces locales en orden de recorrido, crear un `state` por fragmento (todos con todas las luces en esta tarea), pasar `state` a `materialFor`, poner `onBeforeRender` y construir `checkLights`.

- [ ] **Paso 4: ejecutar y ver que pasa** · `npm test` → `fail 0`.

- [ ] **Paso 5: `checklights.mjs`**

`.verify/perf/checklights.mjs --url <url>`: abre `?debug`, y para cada p de la lista de la tarea 1 hace `setProgress(p)`, espera 600 ms y llama a `__ecobat.debug.checkLights()`; imprime las violaciones y `__ecobat.debug.chunks()`; termina con código 1 si hay alguna violación o si `renderer.info.programs.length` supera 120.

- [ ] **Paso 6: verificación**

Píxeles (comandos de la tarea 4) y:

```bash
node .verify/perf/checklights.mjs --url http://localhost:4182/
node .verify/consoleprobe.mjs .verify/build-despues
node .verify/perf/gpuprobe.mjs --url http://localhost:4182/ --out .verify/out/gpu-t6.json
```

Esperado: 42 `OK` (el mecanismo da el mismo píxel con todas las luces); `checklights` sin violaciones y código 0; `consoleprobe` con `messages: []`; `gpu.programs` entre 50 y 60.

- [ ] **Paso 7: commit** · `git add src/world/chunkLights.js src/world/world.js src/main.js tests/chunkLights.test.mjs && git commit -m "Luces inyectadas por fragmento (todas las luces, mecanismo validado)"`

---

### Tarea 7: conjuntos de luces por fragmento y relleno

**Archivos:**
- Modificar: `src/world/world.js`

**Interfaces:**
- Consume: `lightSetFor`, `padLightSets`, `routeBox` de la tarea 2; `createChunkLightState` de la tarea 6.
- Produce: en `buildWorld`, para cada fragmento, `box` = unión de las cajas en mundo de sus mallas con material iluminado (dinámicos de estación ampliados 2 m; celdas de agua incluidas), ampliada 0,5 m; `points`/`spots` = `lightSetFor(box, puntuales)` y `lightSetFor(box, focos)`; `dinamico` usa `routeBox` de las curvas `[...SIM.entry, ...SIM.routes[k]]` (las mismas `CatmullRomCurve3` de `routeCurves`); `agua-lejana` vacío; `resto` todas. Después `padLightSets(entradas, puntuales, focos, 3)` y un `state` por fragmento con el conjunto rellenado. `chunks()` devuelve además `points`, `spots`, `box`.
- Produce: con `?debug`, un `console.warn` si alguna luz local tiene `distance <= 0` (entra en todos los fragmentos) o si `maxDistance > WATER_REACH` (tarea 3).

- [ ] **Paso 1: implementar** los conjuntos y el relleno según Interfaces.

- [ ] **Paso 2: verificación de píxeles y violaciones** (comandos de las tareas 4 y 6). Esperado: 42 `OK`; `checklights` sin violaciones en los 14 encuadres (incluye p = 0,4134 y 0,5592, baterías en cola y aparcadas); `programs` ≤ 120.

- [ ] **Paso 3: si el agua se revirtió en la tarea 3**, asignar el disco entero al fragmento `agua` con todas las luces (exacto) y repetir el paso 2.

- [ ] **Paso 4: medida de GPU en la integrada**

```bash
CHROME_EXTRA="--use-adapter-luid=0,113510" node .verify/perf/scenestats.mjs --url http://localhost:4182/ --out .verify/out/stats-t7-igpu.json --dsf 1
node .verify/perf/gpuprobe.mjs --url http://localhost:4182/ --out .verify/out/gpu-t7-5090.json --profile
```

Esperado: GPU mediana por capítulo (`variant: base`) ≤ 55 % de la de `stats-antes-igpu.json` en cada uno de los ocho (p. ej. portada ≤ 30 ms, laboratorio ≤ 42 ms); en la 5090, `frame` del perfil inclusivo ≤ 4 ms por fotograma (tiempo de `frame src/main.js` dividido por fotogramas de la fase `scroll`). Si la GPU no baja lo suficiente, revisar primero el relleno (clases demasiado grandes) y después las cajas (piezas largas que agrandan una isla).

- [ ] **Paso 5: commit** · `git add src/world/world.js && git commit -m "Conjuntos de luces por fragmento con relleno por clases"`

---

### Tarea 8: calentamiento bajo el velo y compilación completa

**Archivos:**
- Modificar: `src/main.js` (`start3D`: entre `compileAsync` y el primer `requestAnimationFrame`; `layout()`)
- Crear: `.verify/perf/resizeprobe.mjs`

**Interfaces:**
- Produce: en `start3D`, `renderAt(p: number)`: coloca la cámara con `sample(tl, p, camera.aspect, camPos, camTgt)` (sin balanceo), `camera.lookAt`, `fov`; calcula `cs = chapterState(tl, p)`, `sim` y `conn` con las mismas fórmulas que `frame()`; llama a `world.setSimulation(sim)`, `world.setConnections(conn)`, `world.update(0, 1 / 60, story)` con `story = { index: cs.index, vis: cs.vis, local: cs.local, p, sim, route: arrived.near, conn, reduced: false }` y `composer.render(1 / 60)`. No toca el DOM.
- Produce: `WARMUP_POINTS = [0, ...tl.anchors.slice(1), tl.marks.sim, tl.marks.conn, 0.2525, 0.512, 0.668, 0.915]` (14 valores).
- Produce: `warmUp()`: `renderer.setSize(64, 36, false)`, `composer.setSize(64, 36)`, `bloom.resolution.set(64, 36)`; para cada p de `WARMUP_POINTS`, `renderAt(p)` y `await new Promise(requestAnimationFrame)` (deja respirar al velo); después `world.setSimulation(0)`, `world.setConnections(0)`, `layout()`. Se ejecuta tras `compileAsync` y antes del `requestAnimationFrame(() => { frame(); ... is-ready })`. Las marcas `performance.mark('eb:warm')` tras el calentamiento.
- La barra del velo (`.veil__bar`) ya se anima por CSS; comprobar que sigue en marcha (no hay bloqueos > 100 ms entre encuadres porque cada `renderAt` a 64×36 cuesta pocos ms salvo los picos del driver, que es lo que queremos adelantar).

- [ ] **Paso 1: implementar** `renderAt`, `WARMUP_POINTS`, `warmUp` según Interfaces.

- [ ] **Paso 2: `resizeprobe.mjs`**

`.verify/perf/resizeprobe.mjs <buildDir>`: abre el build a 1440×810 con `?debug`, espera `is-ready`, `setProgress(0.302)`, 900 ms, captura `a.png`; `page.setViewportSize({ width: 1280, height: 720 })`, 900 ms, captura `b.png`; vuelve a 1440×810, 900 ms, captura `c.png`; guarda en `.verify/out/resize/`; termina con código 1 si hay errores de consola. Verificación: `pixeldiff` de `c.png` contra `a.png` → `OK`; `b.png` contra `.verify/ref/despues/1280/a2.png` → `OK`.

- [ ] **Paso 3: verificación**

```bash
npx vite build --outDir .verify/build-despues
node .verify/perf/shots-all.mjs .verify/build-despues .verify/ref/despues
node .verify/perf/pixeldiff.mjs .verify/ref/antes .verify/ref/despues
node .verify/perf/resizeprobe.mjs .verify/build-despues
CHROME_EXTRA="--use-adapter-luid=0,113510" node .verify/perf/perfprobe.mjs .verify/build-despues .verify/out/perf-t8-igpu.json
node .verify/perf/perfprobe.mjs .verify/build-despues .verify/out/perf-t8-5090.json
node .verify/consoleprobe.mjs .verify/build-despues
```

Esperado: 42 `OK`; `resizeprobe` código 0 y sus dos diffs `OK`; en `perf-t8-igpu.json`, ningún elemento de `frames` con `dt > 120` fuera de la fase `load`, `readyMs` ≤ `readyMs` de `perf-antes-igpu.json` + 4000 (objetivo +3000); en `perf-t8-5090.json`, `readyMs` ≤ el de `gpu-antes-5090.json` + 500; `consoleprobe` vacío. Si los tirones no desaparecen, comprobar con `perfprobe` qué p los produce y añadir ese p a `WARMUP_POINTS` antes de recortar nada; si la carga se pasa, recortar los cuatro tramos de vuelo (nunca los anclajes) y repetir.

- [ ] **Paso 4: commit** · `git add src/main.js && git commit -m "Calentamiento de encuadres bajo el velo"`

---

### Tarea 9: retirar la degradación automática

**Archivos:**
- Modificar: `src/main.js` (bloque `// Si el equipo va justo, bajar resolución y suavizar el bloom.` y las variables `frames`, `slowTime`, `degraded`)

- [ ] **Paso 1: eliminar** el bloque y las variables; `pixelRatio` queda `Math.min(devicePixelRatio, 1.75)` fijo.

- [ ] **Paso 2: verificación**

Píxeles (comandos habituales) y:

```bash
node .verify/navprobe.mjs .verify/build-despues
node .verify/reducedprobe.mjs .verify/build-despues
node .verify/consoleprobe.mjs .verify/build-despues
```

y capturas con movimiento reducido para el punto de revisión 2: añadir a `.verify/harness.mjs` la opción `--reduced`, que llama a `page.emulateMedia({ reducedMotion: 'reduce' })` justo después de `browser.newPage(...)` y antes de `page.goto`; añadir a `shots-all.mjs` la opción `--reduced`, que solo captura 1440×810 con `--ps 0.1555,0.4134,0.7142 --names a1,a3,a5 --reduced` en `<outDir>/reducido`. Ejecutar `node .verify/perf/shots-all.mjs .verify/build-antes .verify/ref/antes --reduced`, lo mismo para `despues`, y `pixeldiff` de las dos carpetas `reducido`.

Esperado: 42 `OK`; `navprobe` y `reducedprobe` con la misma salida que contra `.verify/build-antes` (ejecutarlos también contra `antes` y comparar los JSON); `consoleprobe` vacío; las tres capturas reducidas `OK`.

- [ ] **Paso 3: commit** · `git add src/main.js && git commit -m "Sin degradación automática: píxeles idénticos en cualquier máquina"`

---

### Tarea 10: medidas finales y documentación

**Archivos:**
- Modificar: `README.md` (nueva sección «Rendimiento» tras «Desarrollo»), `.verify/brief.md` (sección «Rendimiento» con las sondas de `.verify/perf/`)

- [ ] **Paso 1: medidas finales**

Con el build final en `.verify/build-despues`, repetir las tres medidas del paso 8 de la tarea 1 (`stats`, `perfprobe` en la integrada, `gpuprobe` en la 5090) a `.verify/out/*-final-*.json`, y `node .verify/harness.mjs info` para llamadas y triángulos.

- [ ] **Paso 2: README**

Sección «Rendimiento» con: la regla de luces por fragmento en dos frases, la tabla antes/después (GPU mediana por capítulo en la integrada de referencia, tirones máximos tras el velo, `readyMs`, llamadas de dibujo, programas) con la fecha y la máquina, cómo se verifica la igualdad de píxeles (una frase y la ruta del arnés), y el aviso de que three está fijado en 0.186.1 por la inyección.

- [ ] **Paso 3: `.verify/brief.md`**: añadir las sondas de `.verify/perf/` con su uso (una línea cada una), el LUID de la integrada y los comandos de `shots-all` + `pixeldiff`.

- [ ] **Paso 4: comprobación final**

```bash
npm test
git status --short docs/evidencia
node .verify/perf/pixeldiff.mjs .verify/ref/antes .verify/ref/despues
```

Esperado: todas las pruebas en verde; `docs/evidencia` sin cambios; 42 `OK`.

- [ ] **Paso 5: commit** · `git add README.md && git commit -m "Rendimiento en integradas: medidas y documentación"`

---

## Autorrevisión (hecha al escribir el plan)

- Cobertura de la especificación: §6.1 (tareas 3-4), §6.2 (2 y 7), §6.3 (5-6), §6.4 (6: `compileAsync` ya cubre los clones al estar en la escena; el recuento de programas se vigila en 6 y 7), §6.5 (8), decisión 2 (9), §7.1 (1 y cada tarea), §7.2 (1, 7, 8, 10), §7.3 (4, 8, 9), `checkLights`/`chunks` (6-7), agua entera como retroceso (3 y 7).
- Nombres usados de forma consistente: `chunkKeyFor`, `partitionByChunk`, `lightSetFor`, `padLightSets`, `routeBox`, `findLightViolations`, `waterGeometries`, `waterBounds`, `WATER_REACH`, `createMaterialFactory().materialFor`, `cutBlock`, `injectChunkLights`, `createChunkLightState`, `renderAt`, `WARMUP_POINTS`, `warmUp`, `comparePixels`.
- Puntos de revisión: los cinco tienen prueba (tareas 8, 9, 4, 2, 7).
