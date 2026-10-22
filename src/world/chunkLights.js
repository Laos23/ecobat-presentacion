// Luces por fragmento: cada material iluminado se sustituye, en cada fragmento del mundo (chunks.js), por un
// clon propio. Módulo puro (sin DOM) para poder probarlo con `node --test`. Tiene tres partes: la inyección de
// las luces locales en el sombreador del clon (`cutBlock`, `injectChunkLights`), los valores de esas luces
// calculados como los calcula three (`createChunkLightState`) y la fábrica de clones (`createMaterialFactory`).
// Sin estado de luces, un clon usa las luces globales de three, como los originales, y el resultado en pantalla
// es el mismo; con estado, recorre solo las luces de su fragmento, con los mismos valores y en el mismo orden.

import * as THREE from 'three';

// ---------- Inyección en el sombreador ----------
// three evalúa en cada píxel de un material iluminado todas las luces de la escena: los bucles de puntuales y de
// focos de `lights_fragment_begin` recorren los arrays globales `pointLights` y `spotLights`. El clon de un
// fragmento declara arrays propios, `uChunkPoint` y `uChunkSpot`, con los mismos tipos de struct que three (para
// llamar tal cual a `getPointLightInfo` y `getSpotLightInfo`), y sustituye `#include <lights_fragment_begin>` por
// el texto del chunk con tres cambios en cada bucle y nada más: el límite pasa a un literal (el número de luces del
// fragmento), cada luz se lee del array propio y su aporte (`RE_Direct`) solo se suma donde llega
// (`if ( directLight.visible )`, ver más abajo). Con 0 luces de un tipo, su bloque se quita entero (GLSL no admite
// arrays de tamaño 0). Las guardas `#if ( NUM_… > 0 )`, los `#pragma unroll_loop` y los bloques de sombras y mapas
// de foco se quedan como están: three resuelve los includes, sustituye NUM_* y desenrolla los bucles después de
// `onBeforeCompile`, así que el literal y los pragmas funcionan igual que en el chunk original. Los arrays
// globales quedan declarados pero sin uso: el compilador los elimina y three no los sube.
// Es exacto solo si ninguna luz local proyecta sombra ni lleva mapa (three las ordenaría delante y las sombras y
// mapas van por posición en el array): `createChunkLightState` lo exige.
// La guarda es la regla de los fragmentos (chunks.js) llevada a cada píxel: `getPointLightInfo` y `getSpotLightInfo`
// ponen `visible = ( color != vec3( 0.0 ) )` (o false, con color 0, fuera del cono), y con color 0 todo lo que suma
// `RE_Direct_Physical` va multiplicado por `dotNL * color` (o `dotNLcc * color`), un cero exacto por términos
// finitos: saltarse la llamada deja la misma suma, bit a bit. Solo cambia el trabajo: la GPU no evalúa el BRDF de
// una luz en los píxeles a los que no llega (más allá de `distance` o fuera del cono).

const PARS = '#include <lights_pars_begin>';
const BEGIN = '#include <lights_fragment_begin>';
const RE_CALL = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const GUARDED_CALL = `if ( directLight.visible ) { ${RE_CALL} }`;
const LOOPS = [
  { type: 'PointLight', array: 'uChunkPoint', num: 'NUM_POINT_LIGHTS', block: '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', loop: 'for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ )', pick: 'pointLight = pointLights[ i ];', own: 'pointLight = uChunkPoint[ i ];' },
  { type: 'SpotLight', array: 'uChunkSpot', num: 'NUM_SPOT_LIGHTS', block: '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )', loop: 'for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ )', pick: 'spotLight = spotLights[ i ];', own: 'spotLight = uChunkSpot[ i ];' },
];

const occurrences = (text, needle) => text.split(needle).length - 1;

// Sustituye `needle` por `replacement` comprobando que aparece exactamente una vez (si three cambiara el texto de
// sus chunks, la inyección debe fallar a la vista y no compilar otra cosa).
function replaceOnce(text, needle, replacement) {
  const n = occurrences(text, needle);
  if (n !== 1) throw new Error(`chunkLights: se esperaba una vez «${needle}» y aparece ${n}`);
  const at = text.indexOf(needle);
  return text.slice(0, at) + replacement + text.slice(at + needle.length);
}

// Sustituye la línea `include` (debe aparecer una sola vez) por `replacement` como lo hace `resolveIncludes` de
// three, con su mismo patrón de línea (la sangría de delante también se va): el texto que resulta es el mismo que
// three habría compilado, salvo los cambios de la inyección.
function replaceIncludeOnce(text, include, replacement) {
  const n = occurrences(text, include);
  if (n !== 1) throw new Error(`chunkLights: se esperaba una vez «${include}» y aparece ${n}`);
  const line = new RegExp(`^[ \\t]*${include.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gm');
  if ((text.match(line) || []).length !== 1) throw new Error(`chunkLights: «${include}» no empieza una línea`);
  return text.replace(line, () => replacement);
}

const IF_LINE = /^#\s*if(n?def)?\b/; // #if, #ifdef, #ifndef
const ENDIF_LINE = /^#\s*endif\b/;

// Líneas [start, end] del bloque de preprocesador que abre la línea que empieza (sangría aparte) por `startLine`, que
// debe ser única, hasta su `#endif` emparejado, contando los `#if`, `#ifdef` e `#ifndef` anidados.
function findBlock(lines, startLine) {
  const starts = [];
  lines.forEach((line, i) => line.trimStart().startsWith(startLine) && starts.push(i));
  if (starts.length !== 1) throw new Error(`chunkLights: se esperaba una línea «${startLine}» y hay ${starts.length}`);
  const start = starts[0];
  if (!IF_LINE.test(lines[start].trimStart())) throw new Error(`chunkLights: «${startLine}» no abre un bloque #if`);
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trimStart();
    if (IF_LINE.test(line)) depth++;
    else if (ENDIF_LINE.test(line) && --depth === 0) return { start, end: i };
  }
  throw new Error(`chunkLights: el bloque «${startLine}» no se cierra`);
}

// Quita de `text` el bloque de preprocesador que abre la línea que empieza (sangría aparte) por `startLine`, que
// debe ser única, hasta su `#endif` emparejado inclusive, contando los `#if`, `#ifdef` e `#ifndef` anidados.
export function cutBlock(text, startLine) {
  const lines = text.split('\n');
  const { start, end } = findBlock(lines, startLine);
  lines.splice(start, end - start + 1);
  return lines.join('\n');
}

// Sustituye `needle` por `replacement` dentro del bloque que abre `startLine` (debe aparecer en él una sola vez).
function replaceInBlock(text, startLine, needle, replacement) {
  const lines = text.split('\n');
  const { start, end } = findBlock(lines, startLine);
  const block = replaceOnce(lines.slice(start, end + 1).join('\n'), needle, replacement);
  return [...lines.slice(0, start), block, ...lines.slice(end + 1)].join('\n');
}

// Texto de `lights_fragment_begin` con los bucles de Kp puntuales y Ks focos propios (uno por pareja, en caché).
const beginCache = new Map();
function lightsFragmentBegin(Kp, Ks) {
  const key = `${Kp}|${Ks}`;
  let chunk = beginCache.get(key);
  if (chunk === undefined) {
    chunk = THREE.ShaderChunk.lights_fragment_begin;
    [Kp, Ks].forEach((K, t) => {
      const L = LOOPS[t];
      if (occurrences(chunk, L.block) !== 1) throw new Error(`chunkLights: se esperaba una vez «${L.block}» y aparece ${occurrences(chunk, L.block)}`);
      if (K === 0) {
        chunk = cutBlock(chunk, L.block);
        return;
      }
      chunk = replaceOnce(replaceOnce(chunk, L.loop, `for ( int i = 0; i < ${K}; i ++ )`), L.pick, L.own);
      chunk = replaceInBlock(chunk, L.block, RE_CALL, GUARDED_CALL);
    });
    beginCache.set(key, chunk);
  }
  return chunk;
}

// Inyecta en `shader` (el objeto que recibe `onBeforeCompile`) las luces de un fragmento: Kp puntuales y Ks focos.
// Las declaraciones van justo después de `#include <lights_pars_begin>` (que define los structs) y dentro de la
// misma guarda que three pone a cada struct, de modo que el texto es GLSL válido con cualquier número de luces
// en la escena. Los uniformes con los valores los añade quien llama (la fábrica de clones).
export function injectChunkLights(shader, Kp, Ks) {
  if (!Number.isInteger(Kp) || Kp < 0) throw new Error(`injectChunkLights: Kp debe ser un entero >= 0 (${Kp})`);
  if (!Number.isInteger(Ks) || Ks < 0) throw new Error(`injectChunkLights: Ks debe ser un entero >= 0 (${Ks})`);
  let decl = '';
  [Kp, Ks].forEach((K, t) => {
    const L = LOOPS[t];
    if (K > 0) decl += `\n#if ${L.num} > 0\nuniform ${L.type} ${L.array}[${K}];\n#endif`;
  });
  let fragment = replaceOnce(shader.fragmentShader, PARS, PARS + decl);
  fragment = replaceIncludeOnce(fragment, BEGIN, lightsFragmentBegin(Kp, Ks));
  shader.fragmentShader = fragment;
}

// ---------- Valores de las luces ----------
// Objetos de uniforme con los campos de los structs `PointLight` y `SpotLight` de three, uno por luz y en el orden
// de las listas, compartidos por todos los clones de un fragmento. `sync(camera, frame)` los rellena una vez por
// fotograma (no hace nada si `frame` es el último calculado) copiando literalmente las operaciones de
// `WebGLLights.setup` y `setupView` de three 0.186.1 (build/three.module.js, función WebGLLights): mismas llamadas
// sobre los mismos dobles, así que three sube los mismos float32 que subiría con sus arrays globales. Se llama
// desde `onBeforeRender` de las mallas del fragmento, que three invoca antes de subir los uniformes del material y
// con la misma cámara (matrixWorldInverse ya actualizada) con la que calcula sus luces en ese `render()`.
// `lights` guarda las luces de origen (`points`, `spots`).
export function createChunkLightState(points, spots) {
  points.forEach((light) => checkLight(light, 'isPointLight', 'PointLight'));
  spots.forEach((light) => checkLight(light, 'isSpotLight', 'SpotLight'));
  const pointLights = [...points];
  const spotLights = [...spots];
  const vector3 = new THREE.Vector3();
  return {
    lights: { points: pointLights, spots: spotLights },
    points: pointLights.map(() => ({ position: new THREE.Vector3(), color: new THREE.Color(), distance: 0, decay: 0 })),
    spots: spotLights.map(() => ({ position: new THREE.Vector3(), direction: new THREE.Vector3(), color: new THREE.Color(), distance: 0, coneCos: 0, penumbraCos: 0, decay: 0 })),
    frame: -1,
    sync(camera, frame) {
      if (frame === this.frame) return;
      this.frame = frame;
      const viewMatrix = camera.matrixWorldInverse;
      for (let i = 0; i < pointLights.length; i++) {
        const light = pointLights[i];
        const uniforms = this.points[i];
        // setup
        uniforms.color.copy(light.color).multiplyScalar(light.intensity);
        uniforms.distance = light.distance;
        uniforms.decay = light.decay;
        // setupView
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.position.applyMatrix4(viewMatrix);
      }
      for (let i = 0; i < spotLights.length; i++) {
        const light = spotLights[i];
        const uniforms = this.spots[i];
        // setup
        uniforms.color.copy(light.color).multiplyScalar(light.intensity);
        uniforms.distance = light.distance;
        uniforms.coneCos = Math.cos(light.angle);
        uniforms.penumbraCos = Math.cos(light.angle * (1 - light.penumbra));
        uniforms.decay = light.decay;
        // setupView
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.position.applyMatrix4(viewMatrix);
        uniforms.direction.setFromMatrixPosition(light.matrixWorld);
        vector3.setFromMatrixPosition(light.target.matrixWorld);
        uniforms.direction.sub(vector3);
        uniforms.direction.transformDirection(viewMatrix);
      }
    },
  };
}

function checkLight(light, flag, type) {
  if (!light || light[flag] !== true) throw new Error(`createChunkLightState: ${light?.type ?? light} no es una ${type}`);
  const name = light.name || light.uuid;
  if (light.castShadow) throw new Error(`createChunkLightState: la luz ${name} proyecta sombra (la inyección no reproduce sus sombras)`);
  if (light.map) throw new Error(`createChunkLightState: la luz ${name} lleva mapa (la inyección no reproduce su mapa)`);
}

// Clave de programa propia del original: la suya si la tiene; si solo tiene compilador propio, el texto de ese
// compilador (lo que three usa por defecto); si no tiene ninguno, vacía.
function originalProgramKey(material) {
  if (material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) return material.customProgramCacheKey();
  if (material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return material.onBeforeCompile.toString();
  return '';
}

// Un material iluminado es el que recibe las luces locales y, por tanto, el que se clona por fragmento.
// Los básicos (trazas, flechas, charcos, resplandores) no dependen de ninguna luz y los arrays de materiales
// no existen en el mundo: ni unos ni otros se clonan.
export const isLit = (material) => !Array.isArray(material) && (material.isMeshStandardMaterial === true || material.isMeshPhysicalMaterial === true);

// Propiedades numéricas que las estaciones reescriben en el original mientras corre la escena (el pulso de las
// balizas del depósito y del reciclaje). El clon las lee del original: si guardara su propia copia, la animación
// seguiría moviendo el original, que ya no se dibuja. Todo lo demás se copia en el momento de clonar. Si una
// animación nueva reescribe otra propiedad de un material iluminado, hay que añadirla aquí.
const LIVE_PROPS = ['emissiveIntensity'];

// Fábrica de clones: `materialFor(material, chunkKey, kind, state)` devuelve el clon de `material` para ese
// fragmento y ese tipo de malla (`kind`: 0 malla, 1 instanciada, 2 instanciada con color por instancia; `kindOf`
// de world.js), y siempre el mismo para la misma terna (`clones` guarda la caché con clave `uuid|fragmento|tipo`;
// pedir la misma terna con otro estado es un error). Un clon:
//   - copia los parámetros del original y comparte con él las texturas (por referencia);
//   - sin `state`, comparte con el original, si los tiene, su `onBeforeCompile` y su `customProgramCacheKey`
//     (`clone()` no los copia): three calcula la clave del programa con los mismos parámetros, así que el clon usa
//     el mismo programa que el original y no se compila ninguno nuevo;
//   - con `state` (createChunkLightState, el del fragmento), encadena: su `onBeforeCompile` llama primero al del
//     original (el acantilado y las hojas, `uplit` de edges.js, sustituyen otros chunks) y después inyecta las
//     luces del estado (`injectChunkLights`) y añade los uniformes `uChunkPoint` y `uChunkSpot` con sus objetos de
//     valor; su clave de programa es la del original más `|chunk|Kp|Ks`, así que los clones con los mismos
//     parámetros y el mismo número de luces comparten programa;
//   - lleva `userData.chunk` (su fragmento) y `userData.chunkLights` (uuids de las luces locales del estado,
//     puntuales y después focos; vacío sin estado);
//   - lleva `userData.sortId`, la clave con la que se ordena al dibujar (ver más abajo): la de su original;
//   - sigue las propiedades de LIVE_PROPS del original.
// Los materiales que no son iluminados (básicos, arrays) se devuelven tal cual. El original no se modifica.
export function createMaterialFactory() {
  const clones = new Map();
  const states = new Map();
  function materialFor(material, chunkKey = 'resto', kind = 0, state = null) {
    if (!isLit(material)) return material;
    const key = `${material.uuid}|${chunkKey}|${kind}`;
    let clone = clones.get(key);
    if (clone !== undefined && states.get(key) !== state) throw new Error(`materialFor: el clon ${key} ya existe con otro estado de luces`);
    if (clone === undefined) {
      clone = material.clone();
      if (state) {
        const Kp = state.points.length;
        const Ks = state.spots.length;
        clone.onBeforeCompile = function onBeforeCompile(shader, renderer) {
          material.onBeforeCompile.call(this, shader, renderer);
          injectChunkLights(shader, Kp, Ks);
          shader.uniforms.uChunkPoint = { value: state.points };
          shader.uniforms.uChunkSpot = { value: state.spots };
        };
        clone.customProgramCacheKey = () => `${originalProgramKey(material)}|chunk|${Kp}|${Ks}`;
      } else {
        clone.onBeforeCompile = material.onBeforeCompile;
        clone.customProgramCacheKey = material.customProgramCacheKey;
      }
      for (const prop of LIVE_PROPS) {
        Object.defineProperty(clone, prop, {
          get: () => material[prop],
          set: (v) => {
            material[prop] = v;
          },
          enumerable: true,
          configurable: true,
        });
      }
      clone.userData.chunk = chunkKey;
      clone.userData.chunkLights = state ? [...state.lights.points, ...state.lights.spots].map((light) => light.uuid) : [];
      clone.userData.sortId = material.id;
      clones.set(key, clone);
      states.set(key, state);
    }
    return clone;
  }
  return { materialFor, clones };
}

// ---------- Orden de dibujo de los opacos ----------
// three dibuja los opacos ordenados por renderOrder, id de material, variante (normal o instanciada), distancia
// (centro de la esfera envolvente) e id de malla, y donde dos superficies empatan en profundidad en una muestra
// gana la que se dibuja después. El id de un clon es el de su creación, mayor que el de cualquier material que ya
// existiera: clonar sin más cambia el orden entre materiales (los clones pasan por detrás de los básicos, que no
// se clonan) y el de las piezas de un mismo material repartidas en fragmentos (cada fragmento tiene su clon), y
// con él los píxeles donde dos superficies empatan (sin esto, 15 de las 42 capturas de referencia cambiaban).
// Por eso `opaqueSort`, que se instala con `renderer.setOpaqueSort`, ordena por `userData.sortId`: la clave de
// orden del material que sustituye el clon, la misma en todos los clones de un material, de modo que three dibuja
// los opacos exactamente como antes de clonar.

// Clave de las instanciadas cuyo material también usa otro tipo de malla: hasta ahora cada una tenía un clon por
// tipo, creado al terminar el mundo, con un id mayor que el de todos los demás materiales.
export const LATE_SORT_ID = 1e9;

// Clave de orden de cada malla de `meshes` (mallas de material iluminado único, en el orden de recorrido de la
// escena): Map malla → número. Es el id del material de la malla, salvo en las instanciadas cuyo material también
// lo usa otro tipo de malla (`kindOf(malla)`: normal, instanciada, instanciada con color): esas llevan
// LATE_SORT_ID + el orden de primera aparición de su (material, tipo) en el recorrido, como los ids de aquellos clones.
export function drawKeys(meshes, kindOf) {
  const kinds = new Map();
  for (const o of meshes) {
    if (!kinds.has(o.material)) kinds.set(o.material, new Set());
    kinds.get(o.material).add(kindOf(o));
  }
  const firstSeen = new Map();
  const keys = new Map();
  for (const o of meshes) {
    let key = o.material.id;
    if (o.isInstancedMesh && kinds.get(o.material).size > 1) {
      const k = `${o.material.uuid}|${kindOf(o)}`;
      if (!firstSeen.has(k)) firstSeen.set(k, firstSeen.size);
      key = LATE_SORT_ID + firstSeen.get(k);
    }
    keys.set(o, key);
  }
  return keys;
}

// Comparador de los opacos para `renderer.setOpaqueSort`: el `painterSortStable` de three 0.186.1 con la clave
// `userData.sortId` (si la hay) en lugar del id del material. Sin ella ordena igual que three (una prueba lo
// comprueba contra el código de three, que está fijado en esa versión).
export function opaqueSort(a, b) {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  const ka = a.material.userData.sortId ?? a.material.id;
  const kb = b.material.userData.sortId ?? b.material.id;
  if (ka !== kb) return ka - kb;
  if (a.materialVariant !== b.materialVariant) return a.materialVariant - b.materialVariant;
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
}
