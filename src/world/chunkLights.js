// Luces por fragmento: cada material iluminado se sustituye, en cada fragmento del mundo (chunks.js), por un
// clon propio. Módulo puro (sin DOM) para poder probarlo con `node --test`. Esta primera parte es la fábrica de
// clones, sin inyección de luces: los clones usan las luces globales de three, como los originales, y el
// resultado en pantalla es el mismo.

// Un material iluminado es el que recibe las luces locales y, por tanto, el que se clona por fragmento.
// Los básicos (trazas, flechas, charcos, resplandores) no dependen de ninguna luz y los arrays de materiales
// no existen en el mundo: ni unos ni otros se clonan.
export const isLit = (material) => !Array.isArray(material) && (material.isMeshStandardMaterial === true || material.isMeshPhysicalMaterial === true);

// Propiedades numéricas que las estaciones reescriben en el original mientras corre la escena (el pulso de las
// balizas del depósito y del reciclaje). El clon las lee del original: si guardara su propia copia, la animación
// seguiría moviendo el original, que ya no se dibuja. Todo lo demás se copia en el momento de clonar. Si una
// animación nueva reescribe otra propiedad de un material iluminado, hay que añadirla aquí.
const LIVE_PROPS = ['emissiveIntensity'];

// Fábrica de clones: `materialFor(material, chunkKey, kind)` devuelve el clon de `material` para ese fragmento y
// ese tipo de malla (`kind`: 0 malla, 1 instanciada, 2 instanciada con color por instancia; `kindOf` de world.js),
// y siempre el mismo para la misma terna (`clones` guarda la caché con clave `uuid|fragmento|tipo`). Un clon:
//   - copia los parámetros del original y comparte con él las texturas (por referencia) y, si lo tiene, su
//     `onBeforeCompile` y su `customProgramCacheKey` (`clone()` no los copia): three calcula la clave del programa
//     con los mismos parámetros, así que el clon usa el mismo programa que el original y no se compila ninguno nuevo;
//   - lleva `userData.chunk` (su fragmento) y `userData.chunkLights` (uuids de las luces locales de su fragmento,
//     vacío mientras no haya inyección);
//   - lleva `userData.sortId`, la clave con la que se ordena al dibujar (ver más abajo): la de su original;
//   - sigue las propiedades de LIVE_PROPS del original.
// Los materiales que no son iluminados (básicos, arrays) se devuelven tal cual. El original no se modifica.
export function createMaterialFactory() {
  const clones = new Map();
  function materialFor(material, chunkKey = 'resto', kind = 0) {
    if (!isLit(material)) return material;
    const key = `${material.uuid}|${chunkKey}|${kind}`;
    let clone = clones.get(key);
    if (clone === undefined) {
      clone = material.clone();
      clone.onBeforeCompile = material.onBeforeCompile;
      clone.customProgramCacheKey = material.customProgramCacheKey;
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
      clone.userData.chunkLights = [];
      clone.userData.sortId = material.id;
      clones.set(key, clone);
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
