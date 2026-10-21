import * as THREE from 'three';
import { STATIONS, PLATFORMS } from './layout.js';

// Fragmentos del mundo: uno por plataforma. Cada pieza se asigna a una plataforma por su posición y cada
// fragmento lleva su propio conjunto de luces locales: las que alcanzan su caja. Módulo puro (solo three y
// layout.js, sin DOM) para poder probarlo con `node --test`.
//
// Por qué quitar luces es exacto: en three la atenuación de una luz con `distance > 0` vale exactamente 0 a
// partir de esa distancia, y `RE_Direct` suma entonces `vec3(0)`; sumar un cero exacto no cambia la suma.
// Una luz cuya esfera no corta la caja de un fragmento no puede alcanzar ningún píxel suyo. Por la misma
// razón, añadir luces que no alcanzan (relleno por clases de tamaño) tampoco cambia ningún píxel.

export const CHUNK_KEYS = ['s1', 's2', 's3', 's4', 'sA', 'sB', 's5', 's6'];

const ISLANDS = Object.entries(PLATFORMS);

// Plataforma que contiene el punto del plano xz (null sobre el agua). Mismo test, con la misma desigualdad
// estricta, que `islandFloor` de world.js: el borde exacto cuenta como fuera.
export function platformAt(x, z) {
  for (const [key, sh] of ISLANDS) {
    const dx = x - STATIONS[key].x;
    const dz = z - STATIONS[key].z;
    if (sh.kind === 'circle' ? dx * dx + dz * dz < sh.r * sh.r : Math.abs(dx) < sh.w / 2 && Math.abs(dz) < sh.d / 2) return key;
  }
  return null;
}

// Distancia en xz de un punto (relativo al centro de la plataforma) al borde de su forma; 0 dentro.
function edgeDistance(sh, dx, dz) {
  if (sh.kind === 'circle') return Math.max(0, Math.sqrt(dx * dx + dz * dz) - sh.r);
  const ex = Math.max(0, Math.abs(dx) - sh.w / 2);
  const ez = Math.max(0, Math.abs(dz) - sh.d / 2);
  return Math.sqrt(ex * ex + ez * ez);
}

// Fragmento de un punto: su plataforma si cae dentro de una y, si no, la de borde más cercano (a igual
// distancia, la primera de PLATFORMS). Siempre devuelve una clave: ante coordenadas no finitas, la primera.
export function chunkKeyFor(x, z) {
  const inside = platformAt(x, z);
  if (inside !== null) return inside;
  let best = null;
  let bestDist = Infinity;
  for (const [key, sh] of ISLANDS) {
    const d = edgeDistance(sh, x - STATIONS[key].x, z - STATIONS[key].z);
    if (best === null || d < bestDist) {
      best = key;
      bestDist = d;
    }
  }
  return best;
}

// Reparte `items` por fragmento: Map clave → [[item, índice original en `items`], ...], en el orden original.
export function partitionByChunk(items, keyOf = (p) => chunkKeyFor(p.x, p.z)) {
  const out = new Map();
  let i = 0;
  for (const item of items) {
    const key = keyOf(item);
    let list = out.get(key);
    if (!list) out.set(key, (list = []));
    list.push([item, i++]);
  }
  return out;
}

const _center = new THREE.Vector3();
const _sphere = new THREE.Sphere();

// ¿Puede la luz iluminar algo dentro de la caja? Su esfera (centro en mundo, radio `distance`) corta la caja;
// sin alcance finito (`distance` <= 0, ausente o no numérica) alcanza siempre.
function reaches(box, light) {
  const d = light.distance;
  if (typeof d !== 'number' || !(d > 0)) return true;
  light.getWorldPosition(_center);
  _sphere.set(_center, d);
  return box.intersectsSphere(_sphere);
}

// Luces que alcanzan la caja, en el orden de entrada (el orden de las sumas de la iluminación debe coincidir
// con el de three, que es el de recorrido de la escena).
export function lightSetFor(box, lights) {
  return lights.filter((light) => reaches(box, light));
}

// Iguala los conjuntos de luces a unas pocas clases de tamaño para limitar los programas de sombreado
// (cada combinación de nº de puntuales y de focos compila uno). Ordena las entradas por su total de luces
// (estable), las reparte en `maxClasses` grupos consecutivos y rellena cada entrada hasta el máximo de
// puntuales y de focos de su grupo con luces de `allPoints`/`allSpots` que no tuviera, en su orden global y
// detrás de las propias, que no se reordenan. No modifica las entradas; el Map sale en el orden de entrada.
export function padLightSets(entries, allPoints, allSpots, maxClasses = 3) {
  const padded = new Map();
  const sorted = [...entries].sort((a, b) => a.points.length + a.spots.length - (b.points.length + b.spots.length));
  const size = Math.ceil(sorted.length / Math.max(1, Math.floor(maxClasses) || 1));
  for (let g = 0; g < sorted.length; g += size) {
    const group = sorted.slice(g, g + size);
    const nPoints = Math.max(...group.map((e) => e.points.length));
    const nSpots = Math.max(...group.map((e) => e.spots.length));
    for (const e of group) padded.set(e.key, { points: padTo(e.points, allPoints, nPoints), spots: padTo(e.spots, allSpots, nSpots) });
  }
  return new Map(entries.map((e) => [e.key, padded.get(e.key)]));
}

function padTo(own, all, count) {
  const out = own.slice();
  const present = new Set(out);
  for (const light of all) {
    if (out.length >= count) break;
    if (!present.has(light)) {
      out.push(light);
      present.add(light);
    }
  }
  return out;
}

// Caja que barren las curvas (puntos a longitud de arco regular) ampliada `margin` en los tres ejes.
export function routeBox(curves, samples = 200, margin = 1.5) {
  const n = Math.max(1, Math.floor(samples));
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const curve of curves) {
    for (let i = 0; i <= n; i++) box.expandByPoint(curve.getPointAt(i / n, p));
  }
  return box.expandByScalar(margin);
}

// Comprobación de `checkLights`: por cada entrada, las luces (por uuid) que alcanzan su caja y no están en
// su conjunto. Con un conjunto correcto no devuelve nada.
export function findLightViolations(entries, lights) {
  const out = [];
  for (const { name, box, lightIds } of entries) {
    for (const light of lights) {
      if (reaches(box, light) && !lightIds.has(light.uuid)) out.push({ name, light: light.uuid });
    }
  }
  return out;
}
