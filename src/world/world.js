import * as THREE from 'three';
import * as K from './kit.js';
import * as T from './textures.js';
import { V, F, STATIONS, PLATFORMS, BRIDGES, TRACES, SIM } from './layout.js';
import { buildTerrain, buildEdges, deckAt } from './edges.js';
import { buildDepot } from './stations/depot.js';
import { buildWorkshop } from './stations/workshop.js';
import { buildLab } from './stations/lab.js';
import { buildJunction } from './stations/junction.js';
import { buildRecycling } from './stations/recycling.js';
import { buildHub } from './stations/hub.js';
import { buildEnvironment } from './stations/environment.js';
import { CHUNK_KEYS, chunkKeyFor, findLightViolations, lightSetForBoxes, padLightClasses } from './chunks.js';
import { createMaterialFactory, createChunkLightState, isLit, drawKeys } from './chunkLights.js';
import * as A from './actors.js';

export { STATIONS };

// Suelo bajo un punto del plano: el tablero de un puente o la tapa de la isla que lo contiene (null sobre
// el agua). Los tableros llanos pasan 1,5 cm bajo la tapa en sus apoyos: allí manda la isla.
const ISLANDS = Object.entries(PLATFORMS);
function islandFloor(x, z) {
  for (const [key, sh] of ISLANDS) {
    const dx = x - STATIONS[key].x;
    const dz = z - STATIONS[key].z;
    if (sh.kind === 'circle' ? dx * dx + dz * dz < sh.r * sh.r : Math.abs(dx) < sh.w / 2 && Math.abs(dz) < sh.d / 2) return F[key];
  }
  return null;
}
function surfaceY(x, z) {
  const deck = deckAt(x, z);
  const isl = islandFloor(x, z);
  if (deck && !(deck.flat && isl !== null)) return deck.y;
  return isl;
}
// Apoya un punto de traza sobre el suelo: ni flota sobre los tableros ni se hunde al bajar una rampa.
function rest(p) {
  const s = surfaceY(p.x, p.z);
  if (s !== null) p.y = s + 0.012;
  return p;
}

// Franja luminosa embutida a ras de suelo (ref-borde-isla-noche.png): cinta plana que sigue la curva,
// con un bisel mínimo a cada lado; la coordenada u recorre la longitud para animar el pulso.
function ribbonGeometry(curve, width, closed = false) {
  const len = curve.getLength();
  const segs = Math.max(24, Math.round(len * 4));
  const pos = [];
  const uv = [];
  const idx = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    rest(curve.getPointAt(closed ? u % 1 : u, p));
    curve.getTangentAt(closed ? u % 1 : u, t);
    side.crossVectors(t, up).normalize();
    const hw = width / 2;
    // cuatro vértices por sección: bisel exterior (a ras), cara superior (+1,8 cm), bisel exterior
    const rows = [[-hw - 0.03, 0.0], [-hw, 0.018], [hw, 0.018], [hw + 0.03, 0.0]];
    rows.forEach(([o, h]) => {
      pos.push(p.x + side.x * o, p.y + h, p.z + side.z * o);
      uv.push(u * (len / 10), 0.5);
    });
    // caras hacia arriba: side = t × up apunta a la derecha de la marcha, así que la fila k + 1 queda a la derecha
    if (i < segs) {
      const a0 = i * 4;
      for (let k = 0; k < 3; k++) idx.push(a0 + k, a0 + k + 1, a0 + k + 4, a0 + k + 1, a0 + k + 5, a0 + k + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, len };
}

function tube(points, width, mat, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  const { geometry, len } = ribbonGeometry(curve, width, closed);
  const m = new THREE.Mesh(geometry, mat);
  m.userData.noCollide = true;
  return { mesh: m, curve, len };
}

function traceMaterial(color, pulse, scale = 1.45) {
  const map = pulse.clone();
  map.needsUpdate = true;
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(scale), map });
}

// Cajas orientadas de todo lo sólido (solo en modo depuración): sirven para comprobar
// que la cámara nunca atraviesa geometría.
function collectColliders(root) {
  root.updateMatrixWorld(true);
  const list = [];
  const box = new THREE.Box3();
  const m = new THREE.Matrix4();
  const skip = (o) => {
    for (let p = o; p; p = p.parent) if (p.userData.noCollide) return true;
    return false;
  };
  root.traverse((o) => {
    if (!o.isMesh || skip(o)) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat && mat.transparent && mat.opacity < 0.05) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    box.copy(g.boundingBox);
    const label = o.userData.label || (() => {
      for (let p = o; p; p = p.parent) if (p.userData.station) return p.userData.station;
      return '';
    })();
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        if (Math.abs(m.determinant()) < 1e-9) continue;
        const w = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m);
        list.push({ m: w, inv: w.clone().invert(), min: box.min.clone(), max: box.max.clone(), label });
      }
    } else {
      const w = o.matrixWorld.clone();
      list.push({ m: w, inv: w.clone().invert(), min: box.min.clone(), max: box.max.clone(), label });
    }
  });
  return list;
}

// Caja en mundo de una malla: la de su geometría (calculada aparte si falta, sin guardarla en la geometría,
// que puede ser compartida) llevada por su matriz de mundo; en una instanciada, la unión de las de sus
// instancias (la caja de la geometría sola queda en el origen de las instancias).
const _gBox = new THREE.Box3();
const _iBox = new THREE.Box3();
const _iMat = new THREE.Matrix4();
function worldBox(o, target) {
  const g = o.geometry;
  const local = g.boundingBox || _gBox.setFromBufferAttribute(g.attributes.position);
  if (!o.isInstancedMesh) return target.copy(local).applyMatrix4(o.matrixWorld);
  target.makeEmpty();
  for (let i = 0; i < o.count; i++) {
    o.getMatrixAt(i, _iMat);
    target.union(_iBox.copy(local).applyMatrix4(_iMat.premultiply(o.matrixWorld)));
  }
  return target;
}

// Caja en mundo de cada instancia de una instanciada (con su matriz actual): fn(caja, índice). La caja es compartida
// entre llamadas: clonarla para guardarla.
function forEachInstanceBox(o, fn) {
  const g = o.geometry;
  const local = g.boundingBox || new THREE.Box3().setFromBufferAttribute(g.attributes.position);
  for (let i = 0; i < o.count; i++) {
    o.getMatrixAt(i, _iMat);
    fn(_iBox.copy(local).applyMatrix4(_iMat.premultiply(o.matrixWorld)), i);
  }
}

// Luces de `lights` (en su orden) cuya esfera corta la caja, ampliada `margin`, de algún triángulo de la malla en
// mundo; las que no tienen alcance finito, siempre.
const _tri = new THREE.Box3();
const _vtx = new THREE.Vector3();
function lightsOnTriangles(o, lights, margin) {
  const pos = o.geometry.attributes.position;
  const index = o.geometry.index;
  const n = index ? index.count : pos.count;
  const spheres = lights.map((l) => (typeof l.distance === 'number' && l.distance > 0 ? new THREE.Sphere(l.getWorldPosition(new THREE.Vector3()), l.distance) : null));
  const found = spheres.map((sp) => sp === null);
  let left = found.filter((f) => !f).length;
  for (let t = 0; t + 2 < n && left > 0; t += 3) {
    _tri.makeEmpty();
    for (let k = 0; k < 3; k++) _tri.expandByPoint(_vtx.fromBufferAttribute(pos, index ? index.getX(t + k) : t + k).applyMatrix4(o.matrixWorld));
    _tri.expandByScalar(margin);
    for (let i = 0; i < lights.length; i++) {
      if (!found[i] && _tri.intersectsSphere(spheres[i])) {
        found[i] = true;
        left--;
      }
    }
  }
  return lights.filter((_, i) => found[i]);
}

// Orden de la lista de fragmentos: islas, agua, dinámico y, al final, lo no previsto.
const CHUNK_ORDER = [...CHUNK_KEYS, 'agua', 'agua-lejana', 'dinamico', 'resto'];

// Cajas de los fragmentos para sus conjuntos de luces (ver buildWorld): margen de toda caja, margen de los objetos
// que mueve una estación (en su pose inicial) y tamaño de un tractor de la simulación sobre la curva de su ruta.
const BOX_MARGIN = 0.5;
const DYNAMIC_MARGIN = 2;
const SIM_MARGIN = 2.6; // medio tractor con su remolque (≈ 6 m) alrededor de cada muestra de su ruta
// clases de tamaño de los conjuntos de luces de las islas (padLightClasses): 5 deja el total de programas de
// sombreado por debajo de 120 (con una clase por isla serían unos 130) añadiendo una sola luz a dos islas
const LIGHT_CLASSES = 5;

// Nombre de una luz local para la depuración: estación, tipo e índice en la lista global de su tipo.
function lightLabel(light, points, spots) {
  let station = '';
  for (let p = light; p && !station; p = p.parent) station = p.userData.station || '';
  return light.isSpotLight ? `${station}:foco${spots.indexOf(light)}` : `${station}:puntual${points.indexOf(light)}`;
}

export function buildWorld(scene, { debug = false } = {}) {
  performance.mark('eb:start');
  const M = K.makeMaterials();
  // nombre de cada material compartido (depuración y perfiles)
  Object.entries(M).forEach(([k, m]) => m?.isMaterial && !m.name && (m.name = k));
  performance.mark('eb:materials');
  const root = new THREE.Group();
  scene.add(root);
  const anims = [];
  const lamps = [];
  const shadows = [];
  const pulse = T.pulseTexture();

  // Contexto compartido por terreno y estaciones: cada módulo añade a su propio grupo.
  const ctx = {
    THREE, K, T, M, V, F, STATIONS,
    lamps,
    shadows,
    group: root,
    add(o) {
      this.group.add(o);
      return o;
    },
    dyn(o) {
      o.userData.dynamic = true;
      return o;
    },
    anim(fn) {
      anims.push(fn);
    },
  };
  const station = (name, build) => {
    const g = new THREE.Group();
    g.userData.station = name;
    root.add(g);
    ctx.group = g;
    build(ctx);
    ctx.group = root;
    performance.mark(`eb:${name}`);
  };

  station('terreno', buildTerrain);
  station('deposito', buildDepot);
  station('taller', buildWorkshop);
  station('laboratorio', buildLab);
  station('cruce', buildJunction);
  station('reciclaje', buildRecycling);
  station('centro', buildHub);
  station('entorno', buildEnvironment);
  station('bordes', buildEdges);

  const s4 = STATIONS.s4;
  const s6 = STATIONS.s6;

  // ---------- Traza luminosa ----------
  const traces = [];
  const mkTrace = (pts, color, width = 0.22, closed = false, scale = 1.45) => {
    const t = tube(pts, width, traceMaterial(color, pulse, scale), closed);
    root.add(t.mesh);
    traces.push(t);
    return t;
  };
  const y4 = F.s4 + 0.012;
  const main = mkTrace(TRACES.main, '#C2F230');
  mkTrace(
    Array.from({ length: 24 }, (_, i) => V(s4.x + Math.cos((i / 24) * Math.PI * 2) * 4, y4, s4.z + Math.sin((i / 24) * Math.PI * 2) * 4)),
    '#C2F230', 0.18, true,
  );
  // las tres ramas arrancan sobre el anillo, a la misma cota: ganan siempre en profundidad (sin rayado)
  [mkTrace(TRACES.service, '#C2F230', 0.3), mkTrace(TRACES.second, '#E5AE50', 0.3), mkTrace(TRACES.recycle, '#F1EEE6', 0.3, false, 1.15)].forEach(({ mesh }) => {
    Object.assign(mesh.material, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  });
  const hub = mkTrace(TRACES.hub, '#C2F230');

  // Puntas de flecha planas sobre la traza en mitad de cada puente (la traza hace de asta), inclinadas
  // con la rampa; las rutas del cruce llevan las suyas en junction.js.
  const arrowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(1.4), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const chevron = new THREE.Shape();
  [[0, -0.3], [0.34, 0.04], [0.34, 0.2], [0, -0.14], [-0.34, 0.2], [-0.34, 0.04]].forEach(([x, y], i) => (i ? chevron.lineTo(x, y) : chevron.moveTo(x, y)));
  const arrowGeo = new THREE.ShapeGeometry(chevron).rotateX(-Math.PI / 2);
  const onCurve = (curve, u, out) => rest(curve.getPointAt(THREE.MathUtils.clamp(u, 0, 1), out));
  [[main, 0], [main, 1], [main, 2], [hub, 6]].forEach(([tr, bi]) => {
    const mid = BRIDGES[bi][0].clone().lerp(BRIDGES[bi][1], 0.5);
    // parámetro de la traza más cercano al centro del puente
    let best = 0;
    let bestD = Infinity;
    const q = new THREE.Vector3();
    for (let i = 0; i <= 400; i++) {
      tr.curve.getPointAt(i / 400, q);
      const d = Math.hypot(q.x - mid.x, q.z - mid.z);
      if (d < bestD) {
        bestD = d;
        best = i / 400;
      }
    }
    const du = 0.4 / tr.len;
    const p = onCurve(tr.curve, best, new THREE.Vector3());
    const ahead = onCurve(tr.curve, best + du, new THREE.Vector3());
    const behind = onCurve(tr.curve, best - du, new THREE.Vector3());
    const m = new THREE.Mesh(arrowGeo, arrowMat);
    m.userData.noCollide = true;
    m.position.copy(p).add(V(0, 0.024, 0));
    m.lookAt(m.position.clone().add(ahead.sub(behind)));
    root.add(m);
  });
  anims.push((t, dt, story) => {
    if (story?.reduced) return;
    traces.forEach((tr, i) => {
      tr.mesh.material.map.offset.x = -t * 0.35 - i * 0.2;
    });
  });

  // ---------- Simulación del capítulo de clasificación (hipotética: 2 / 1 / 7) ----------
  // Tres tractores de arrastre (actors.js) esperan cargados en las bocas del cruce y salen escalonados hacia su destino
  // (layout.js · SIM). Tractor y remolque son dos piezas dinámicas: cada una va compactada (una malla por material) y el
  // remolque sigue la ruta detrás del tractor, articulado en su enganche. Ninguno proyecta sombra en el mapa (se genera
  // una sola vez): cada pieza lleva una sombra de contacto que se mueve con ella. Las poses solo se recalculan cuando
  // cambia el avance de la simulación.
  const blobMat = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    g.filter = 'blur(5px)';
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.beginPath();
    g.roundRect(10, 8, 44, 48, 8);
    g.fill();
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: '#000000', transparent: true, depthWrite: false });
  })();
  const blob = (w, d, z = 0) => {
    const b = new THREE.Mesh(K.geo('simBlob', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), blobMat);
    b.scale.set(w, 1, d);
    b.position.set(0, 0.02, z);
    b.renderOrder = 1;
    b.userData.noCollide = true;
    return b;
  };
  // carga de un remolque plano: palé europeo con `n` baterías de arranque (tapas en los bornes y fleje) sujeto al
  // bastidor con dos cinchas ámbar, como en los palés de actors.js
  const LEAD = { w: 0.28, h: 0.19, d: 0.175 };
  const leadLoad = (n) => {
    const g = new THREE.Group();
    const y0 = 0.42; // piso del remolque (actors.js · buildCart)
    g.add(K.box(1.2, 0.022, 0.8, M.wood, 0, y0 + 0.122, 0));
    [-0.55, 0, 0.55].forEach((x) => g.add(K.box(0.1, 0.1, 0.8, M.wood, x, y0 + 0.022, 0)));
    g.add(K.box(1.2, 0.022, 0.72, M.wood, 0, y0, 0));
    const yb = y0 + 0.144;
    const rows = n <= 4 ? [n] : [Math.ceil(n / 2), Math.floor(n / 2)];
    rows.forEach((cnt, r) => {
      const z = rows.length === 1 ? 0 : (r - 0.5) * (LEAD.d + 0.02);
      for (let i = 0; i < cnt; i++) {
        const x = (i - (cnt - 1) / 2) * (LEAD.w + 0.012);
        g.add(K.box(LEAD.w, LEAD.h, LEAD.d, M.casing, x, yb, z));
        [-0.09, 0.09].forEach((dx) => g.add(K.box(0.05, 0.03, 0.05, M.grip, x + dx, yb + LEAD.h, z + 0.045)));
      }
      // fleje blanco a lo largo de cada fila
      g.add(K.box(cnt * (LEAD.w + 0.012), 0.006, 0.03, M.ivory, 0, yb + LEAD.h + 0.001, z));
    });
    [-0.3, 0.3].forEach((x) => g.add(K.box(0.04, 0.33, 0.04 + rows.length * LEAD.d, M.amberMatte, x, y0 + 0.07, 0)));
    return g;
  };
  const simCurve = (path) => new THREE.CatmullRomCurve3(path.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const _sp = new THREE.Vector3();
  const _st = new THREE.Vector3();
  const _sa = new THREE.Vector3();
  const _sb = new THREE.Vector3();
  // losas interiores (suelo M.floor de ≥ 2 × 2 m): las de los edificios de kit.js · makeCutaway, 6 cm sobre la tapa de la
  // isla (laboratorio, nave de reutilización, puesto de desmontaje de sB y nave de recepción de s5), y el suelo de la
  // zona de separación del reciclaje. Los tractores solo entran en el laboratorio y en la nave (los otros dos se detienen
  // ante la puerta de sB y la persiana de s5), pero el filtro las recoge todas: dentro de ellas las ruedas apoyan en la
  // losa, no en la tapa
  const slabs = [];
  {
    const b = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || o.material !== M.floor) return;
      b.setFromObject(o);
      if (b.max.y - b.min.y > 0.1 || b.max.x - b.min.x < 2 || b.max.z - b.min.z < 2) return;
      slabs.push([b.min.x, b.max.x, b.min.z, b.max.z, b.max.y]);
    });
  }
  // suelo bajo (x, z) (tablero, tapa de la isla o losa interior) o, sobre el agua, la cota de referencia
  const ground = (x, z, fallback) => {
    let s = surfaceY(x, z);
    for (const [x0, x1, z0, z1, y] of slabs) if (x > x0 && x < x1 && z > z0 && z < z1 && (s === null || y > s)) s = y;
    return s === null ? fallback : s;
  };
  // punto de la curva a `s` m de su comienzo; fuera de [0, L] sigue la tangente del extremo
  const pointAtDist = (info, s, out) => {
    const L = info.len;
    if (s >= 0 && s <= L) return info.curve.getPointAt(s / L, out);
    const end = s > L ? 1 : 0;
    info.curve.getPointAt(end, out);
    info.curve.getTangentAt(end, _st);
    return out.addScaledVector(_st, s > L ? s - L : s);
  };
  // cota de apoyo de una rueda de radio `r` en (x, z): la rueda es un círculo en el plano de la marcha cuyo punto de
  // apoyo nominal, (x, z), queda bajo su eje en perpendicular al bastidor, cabeceado `sa` (seno del cabeceo, + morro
  // arriba); con cabeceo, el centro de la rueda queda r·sa detrás de ese punto. Cada punto de la huella a `q` m del
  // centro (a lo largo de la marcha) sostiene el punto de apoyo √(r² − q²) − r·cos(cabeceo) más arriba o más abajo; a
  // lo ancho (±9 cm) la banda es plana. En una pendiente uniforme manda el propio punto de apoyo (la rueda la toca bajo
  // su eje, sin quedar en el aire); en un escalón (borde de una losa, canto del rebaje de un tablero) o en una cresta la
  // rueda se apoya en la arista en vez de meterse en ella. null fuera de islas, tableros y losas.
  const WHEEL_Q = [0, 0.4, -0.4, 0.65, -0.65, 0.85, -0.85];
  const wheelGround = (x, z, ux, uz, r, sa) => {
    const rc = r * Math.sqrt(1 - sa * sa);
    let best = null;
    const probe = (da, dl, lift) => {
      const y = ground(x + ux * da + uz * dl, z + uz * da - ux * dl, null);
      if (y !== null && (best === null || y + lift > best)) best = y + lift;
    };
    probe(0, 0, 0);
    for (const k of WHEEL_Q) probe((k - sa) * r, 0, r * Math.sqrt(1 - k * k) - rc);
    probe(0, 0.09, 0);
    probe(0, -0.09, 0);
    return best;
  };
  // pose de una pieza sobre la curva con sus dos ejes (a ±`half` m del punto a `d` m del comienzo) apoyados en ella,
  // como un bogie: el centro queda en el punto medio de los ejes y el rumbo va del eje trasero al delantero. En las
  // curvas el centro se mete hacia dentro y los extremos apenas barren por fuera. La altura, el cabeceo y el balanceo
  // salen del apoyo de cada rueda (a ±`side` m del eje, radio `r`): en los cambios de pendiente y en los bordes de los
  // tableros y las losas ninguna rueda flota ni se hunde (plano medio de las cuatro).
  const poseOn = (obj, info, d, half, side, r) => {
    pointAtDist(info, d + half, _sa);
    pointAtDist(info, d - half, _sb);
    const hx = _sa.x - _sb.x;
    const hz = _sa.z - _sb.z;
    const hl = Math.hypot(hx, hz) || 1;
    const ux = hx / hl;
    const uz = hz / hl;
    // lateral +x local (hacia la izquierda de la marcha)
    const lx = uz * side;
    const lz = -ux * side;
    // dos pasadas: la primera sin cabeceo y la segunda con el cabeceo que sale de ella (la huella de cada rueda depende
    // de él). Una rueda en el canto de una boca de puente, fuera del contorno de la isla y del tablero (surfaceY null),
    // toma la cota de la otra rueda de su eje o, si tampoco, la del otro eje
    let fl, fr, bl, br;
    let sa = 0;
    for (let pass = 0; pass < 2; pass++) {
      fl = wheelGround(_sa.x + lx, _sa.z + lz, ux, uz, r, sa);
      fr = wheelGround(_sa.x - lx, _sa.z - lz, ux, uz, r, sa);
      bl = wheelGround(_sb.x + lx, _sb.z + lz, ux, uz, r, sa);
      br = wheelGround(_sb.x - lx, _sb.z - lz, ux, uz, r, sa);
      fl ??= fr;
      fr ??= fl;
      bl ??= br;
      br ??= bl;
      fl ??= bl ?? obj.position.y;
      fr ??= br ?? obj.position.y;
      bl ??= fl;
      br ??= fr;
      const dy = (fl + fr - bl - br) / 2;
      sa = dy / Math.hypot(dy, hl);
    }
    obj.position.set((_sa.x + _sb.x) / 2, (fl + fr + bl + br) / 4, (_sa.z + _sb.z) / 2);
    obj.rotation.set(-Math.atan2((fl + fr - bl - br) / 2, hl), Math.atan2(ux, uz), Math.atan2((fl + bl - fr - br) / 2, 2 * side));
  };
  // bulón del enganche del tractor (actors.js · buildTug: boca en y 0,35 que acaba en z -1,65; el bulón, en su fondo)
  const HITCH = new THREE.Vector3(0, 0.35, -1.66);
  const tractors = SIM.tractors.map((spec) => {
    const curve = simCurve(spec.path);
    const len = curve.getLength();
    // distancia sobre la curva del punto de espera
    let wait = 0;
    for (let i = 1; i <= spec.wait; i++) wait += Math.hypot(spec.path[i][0] - spec.path[i - 1][0], spec.path[i][1] - spec.path[i - 1][1]);
    const tug = A.makeTowTractor(M, { carts: 1, load: spec.load === 'litio' ? 'litio' : 'vacio', driver: true, drawbar: false });
    const cart = tug.userData.carts[0];
    // distancia del origen del tractor al centro del remolque con los dos en línea (la de actors.js · makeTowTractor)
    let hitch = -cart.position.z;
    tug.remove(cart);
    cart.position.set(0, 0, 0);
    if (spec.load !== 'litio') cart.add(leadLoad(spec.count));
    const parts = [tug, cart].map((g) => {
      const c = K.compact(g);
      c.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = true;
      });
      c.rotation.order = 'YXZ';
      c.userData.dynamic = true;
      c.userData.noCollide = true;
      root.add(c);
      return c;
    });
    const { L: cartLen, W: cartW } = A.CART[spec.load === 'litio' ? 'litio' : 'vacio'];
    // semivía de las ruedas del remolque (actors.js · buildCart: a 0,12 m de cada costado)
    const cartSide = cartW / 2 - 0.12;
    parts[0].add(blob(1.7, 3.0, -0.05));
    parts[1].add(blob(spec.load === 'litio' ? 2.1 : 1.7, cartLen + 0.3));
    // lanza: gira bajo el frente del remolque (actors.js · buildCart: plataforma de 0,32 a 0,42 m), donde puede abrirse
    // de lado sin rozar su canto, y llega al bulón del enganche del tractor, así que en las curvas y en los cambios de
    // pendiente no se clava en el suelo, no queda en el aire ni cambia de largo
    const bar = new THREE.Mesh(K.geo('simDrawbar', () => new THREE.BoxGeometry(0.06, 0.06, 1).translate(0, 0, 0.5)), M.darkSteel);
    bar.position.set(0, 0.26, cartLen / 2 - 0.02);
    bar.receiveShadow = true;
    parts[1].add(bar);
    // largo de la lanza (rígida): la que deja el remolque a `hitch` m o la de la ruta (layout.js · SIM, `bar`), que
    // entonces fija `hitch`
    const dy = HITCH.y - bar.position.y;
    let barLen = Math.hypot(hitch + HITCH.z - bar.position.z, dy);
    if (spec.bar) {
      barLen = spec.bar;
      hitch = -HITCH.z + Math.sqrt(barLen * barLen - dy * dy) + bar.position.z;
    }
    return { spec, curve, len, info: { curve, len }, wait, hitch, cartLen, cartSide, bar, barLen, tug: parts[0], cart: parts[1], d: -1 };
  });
  // orienta la lanza del remolque hasta el bulón del enganche del tractor. Con el remolque colocado por placeTrain mide
  // siempre barLen (la escala solo absorbe los milímetros de la búsqueda)
  const _hp = new THREE.Vector3();
  const _bz = new THREE.Vector3(0, 0, 1);
  function aimDrawbar(t) {
    t.tug.updateMatrixWorld(true);
    t.cart.updateMatrixWorld(true);
    t.cart.worldToLocal(t.tug.localToWorld(_hp.copy(HITCH))).sub(t.bar.position);
    const l = _hp.length() || 1;
    t.bar.quaternion.setFromUnitVectors(_bz, _hp.multiplyScalar(1 / l));
    t.bar.scale.set(1, 1, l);
  }
  // Tren de arrastre: el tractor va sobre la curva a `d` m de su comienzo y el remolque, de seguimiento (sus dos ejes
  // giran y pisan la huella del tractor, como los de los trenes de arrastre de las naves), también sobre la curva, a
  // la distancia que deja su lanza. En recta el remolque queda a `hitch` m del tractor; en las curvas, algo más cerca,
  // porque el enganche barre por fuera. Se busca sobre la curva, junto a d − hitch, la posición del remolque cuyo bulón
  // queda a barLen del enganche (en planta, corregida después con el cabeceo y el balanceo reales del remolque).
  const _hw = new THREE.Vector3();
  const _pw = new THREE.Vector3();
  const _pa = new THREE.Vector3();
  const _pb = new THREE.Vector3();
  const _piv = [0, 0];
  // bulón del remolque en planta con el remolque apoyado en `dc` (sin cabeceo ni balanceo)
  const pivotAt = (t, dc) => {
    const hc = t.cartLen / 2 - 0.3;
    pointAtDist(t.info, dc + hc, _pa);
    pointAtDist(t.info, dc - hc, _pb);
    const hx = _pa.x - _pb.x;
    const hz = _pa.z - _pb.z;
    const k = t.bar.position.z / (Math.hypot(hx, hz) || 1);
    _piv[0] = (_pa.x + _pb.x) / 2 + hx * k;
    _piv[1] = (_pa.z + _pb.z) / 2 + hz * k;
    return _piv;
  };
  // raíz de f (creciente hacia atrás: más lejos del enganche) más cercana a s0, por pasos de 5 cm y bisección
  const rootNear = (f, s0) => {
    let a = s0;
    let fa = f(a);
    if (Math.abs(fa) < 1e-5) return a;
    const dir = fa > 0 ? 1 : -1;
    for (let k = 1; k <= 40; k++) {
      const b = s0 + dir * k * 0.05;
      const fb = f(b);
      if (fb === 0 || Math.sign(fb) !== Math.sign(fa)) {
        let lo = a;
        let hi = b;
        for (let i = 0; i < 16; i++) {
          const m = (lo + hi) / 2;
          const fm = f(m);
          if (Math.sign(fm) === Math.sign(fa)) lo = m;
          else hi = m;
        }
        return (lo + hi) / 2;
      }
      a = b;
      fa = fb;
    }
    return s0;
  };
  function placeTrain(t, d) {
    poseOn(t.tug, t.info, d, 0.78, A.TUG_TRACK, 0.27);
    t.tug.updateMatrixWorld(true);
    t.tug.localToWorld(_hw.copy(HITCH));
    // primera aproximación en planta (sin cabeceo ni balanceo del remolque) y ajuste fino, por secantes, con el remolque
    // ya apoyado en el suelo: en las rampas de los puentes el bulón sube o baja respecto al enganche
    const lh = Math.sqrt(t.barLen * t.barLen - (HITCH.y - t.bar.position.y) ** 2);
    const err = (dc) => {
      poseOn(t.cart, t.info, dc, t.cartLen / 2 - 0.3, t.cartSide, 0.16);
      t.cart.updateMatrixWorld(true);
      t.cart.localToWorld(_pw.copy(t.bar.position));
      return _pw.distanceTo(_hw) - t.barLen;
    };
    let a = rootNear((s) => {
      const [px, pz] = pivotAt(t, s);
      return Math.hypot(px - _hw.x, pz - _hw.z) - lh;
    }, d - t.hitch);
    let ea = err(a);
    if (Math.abs(ea) > 0.001) {
      let b = a + ea;
      let eb = err(b);
      for (let i = 0; i < 6 && Math.abs(eb) > 0.0005 && eb !== ea; i++) {
        const c = b - (eb * (b - a)) / (eb - ea);
        a = b;
        ea = eb;
        b = c;
        eb = err(b);
      }
      if (Math.abs(eb) > Math.abs(ea)) err(a);
    }
    aimDrawbar(t);
  }
  // perfil de velocidad de cada viaje: arranca y frena en el 15 % de su tramo y va a velocidad constante en medio (la
  // cámara de la clasificación acompaña al de reutilización a un ritmo regular)
  const ACC = 0.15;
  const easeTrip = (x) => {
    const vmax = 1 / (1 - ACC);
    if (x < ACC) return (0.5 * vmax * x * x) / ACC;
    if (x > 1 - ACC) return 1 - (0.5 * vmax * (1 - x) * (1 - x)) / ACC;
    return vmax * (x - ACC / 2);
  };
  let lastU = null;
  let lastArrived = null;
  function setSimulation(u) {
    // u: 0 → los tres esperan en el cruce; 1 → cada uno en su destino. Devuelve las baterías llegadas por ruta (el lote
    // de cada tractor al llegar) y la ruta del tractor que sale del cruce más cerca de su isleta central (la que muestra
    // la rosa; sin ninguno en marcha sobre el cruce, null y la rosa repasa las tres).
    if (debug && typeof window !== 'undefined' && typeof window.__ecobatSimOverride === 'number') u = window.__ecobatSimOverride;
    if (u === lastU) return lastArrived;
    lastU = u;
    const arrived = { service: 0, second: 0, recycle: 0, near: null };
    let nearD = 9.5;
    for (const t of tractors) {
      const [a, b] = t.spec.go;
      const local = THREE.MathUtils.clamp((u - a) / (b - a), 0, 1);
      const d = THREE.MathUtils.lerp(t.wait, t.len, easeTrip(local));
      if (d !== t.d) {
        t.d = d;
        placeTrain(t, d);
      }
      if (local >= 1) arrived[t.spec.route] += t.spec.count;
      const k = Math.hypot(t.tug.position.x - s4.x, t.tug.position.z - s4.z);
      if (local > 0 && local < 1 && k < nearD) {
        nearD = k;
        arrived.near = t.spec.route;
      }
    }
    lastArrived = arrived;
    return arrived;
  }
  setSimulation(0);

  // ---------- Conexiones del capítulo de trazabilidad ----------
  // Un arco del centro a cada zona, en el orden de los capítulos (el mismo de la red de la pantalla del centro, hub.js):
  // recogida, laboratorio, clasificación, reutilización, desmontaje, segunda vida y reciclaje.
  const arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(1.15), transparent: true, opacity: 0.85 });
  const hubTop = V(s6.x - 1.2, s6.y + 6.4, s6.z - 1.4);
  const arcs = ['s1', 's3', 's4', 's2', 'sB', 'sA', 's5'].map((key) => {
    const s = STATIONS[key];
    const end = s.clone().add(V(0, 3, 0));
    const mid = new THREE.Vector3().lerpVectors(hubTop, end, 0.5).add(V(0, 4 + hubTop.distanceTo(end) * 0.045, 0));
    const geom = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(hubTop, mid, end), 120, 0.065, 6, false);
    const m = new THREE.Mesh(geom, arcMat);
    m.userData.noCollide = true;
    m.geometry.setDrawRange(0, 0);
    root.add(m);
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), arcMat);
    node.userData.noCollide = true;
    node.position.copy(end);
    node.scale.setScalar(0.001);
    root.add(node);
    return { m, node, total: geom.index.count };
  });
  function setConnections(u) {
    arcs.forEach(({ m, node, total }, i) => {
      const local = THREE.MathUtils.clamp((u - (i * 0.4) / (arcs.length - 1)) / 0.5, 0, 1);
      m.geometry.setDrawRange(0, Math.floor((total * local) / 3) * 3);
      node.scale.setScalar(local >= 1 ? 1 : 0.001);
    });
  }
  setConnections(0);

  // las balizas de bordillo que quedan en el paso de un tractor de la simulación (las del borde de s3 y s2 junto a la ruta
  // de reutilización) se quitan: el tractor (1,3 m de ancho, 1,8 m el remolque del embalaje) no cabe entre ellas y los
  // pilares o parterres de las esquinas. La de la esquina suroeste de s3 (-13,2; 5,3) se quita también: la ruta pasaba
  // a 1 m de ella y ahora, más ceñida al laboratorio, a 1,37 m, pero sigue en el paso y el encuadre no cambia
  {
    const samples = tractors.flatMap((t) => t.curve.getSpacedPoints(Math.ceil(t.len * 3)).map((q) => [q.x, q.z, t.spec.load === 'litio' ? 1.3 : 1.15]));
    const DROP = [[-13.19, 5.26]];
    for (let i = lamps.length - 1; i >= 0; i--) {
      const l = lamps[i];
      // las del cruce (bordillos de los parterres) quedan fuera de las calzadas: se conservan
      if (chunkKeyFor(l.x, l.z) === 's4') continue;
      if (DROP.some(([x, z]) => Math.hypot(l.x - x, l.z - z) < 0.2) || samples.some(([x, z, r]) => Math.hypot(l.x - x, l.z - z) < r)) lamps.splice(i, 1);
    }
  }
  const lampsMesh = K.scatterLamps(M, lamps);
  root.add(lampsMesh);
  const contact = K.contactShadows(shadows);
  contact.userData.noCollide = true;
  root.add(contact);
  // las manchas de luz de las balizas no son sólidas
  lampsMesh.children.forEach((c) => {
    if (c.material.transparent) c.userData.noCollide = true;
  });

  performance.mark('eb:trazas');
  const colliders = debug ? collectColliders(root) : null;
  if (debug) {
    // los tractores se mueven: cuentan como sólidos en su pose de espera y en la de llegada (la holgura de la cámara
    // con ellos en marcha se mide aparte, __ecobatSim.cameraGap)
    const solid = (u) => {
      setSimulation(u);
      root.updateMatrixWorld(true);
      tractors.forEach(({ tug, cart }) => [tug, cart].forEach((g) => {
        g.userData.noCollide = false;
        collectColliders(g).forEach((c) => colliders.push({ ...c, label: `tractor:${g === tug ? 'tug' : 'cart'}` }));
        g.userData.noCollide = true;
      }));
    };
    solid(1);
    solid(0);
    if (typeof window !== 'undefined') {
      const local = new THREE.Vector3();
      const inv = new THREE.Matrix4();
      // puntos de muestra de la caja de cada pieza (en sus ejes): tractor con conductor y remolque con su carga
      const grid = (x0, x1, y0, y1, z0, z1, nx, ny, nz) => {
        const out = [];
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) out.push(V(x0 + ((x1 - x0) * i) / (nx - 1), y0 + ((y1 - y0) * j) / (ny - 1), z0 + ((z1 - z0) * k) / (nz - 1)));
        return out;
      };
      const tugPts = grid(-0.64, 0.64, 0.22, 1.55, -1.42, 1.32, 3, 3, 6);
      window.__ecobatSim = {
        tractors,
        // suelo de la simulación bajo (x, z) (null fuera de islas, tableros y losas)
        ground: (x, z) => ground(x, z, null),
        // cajas (en mundo, alineadas con los ejes) de lo sólido que corta el rectángulo [x0, x1] × [z0, z1] entre y0 e y1
        solids(x0, x1, z0, z1, y0 = -1, y1 = 50) {
          const out = [];
          const b = new THREE.Box3();
          for (const c of colliders) {
            b.set(c.min, c.max).applyMatrix4(c.m);
            if (b.max.x < x0 || b.min.x > x1 || b.max.z < z0 || b.min.z > z1 || b.max.y < y0 || b.min.y > y1) continue;
            out.push({ label: c.label, min: b.min.toArray().map((v) => +v.toFixed(2)), max: b.max.toArray().map((v) => +v.toFixed(2)) });
          }
          return out;
        },
        // cambia la ruta de un tractor (solo para probar trazados con check())
        setPath(route, path, wait) {
          const t = tractors.find((x) => x.spec.route === route);
          t.spec = { ...t.spec, path, wait: wait ?? t.spec.wait };
          t.curve = simCurve(path);
          t.len = t.curve.getLength();
          t.info = { curve: t.curve, len: t.len };
          t.wait = 0;
          for (let i = 1; i <= t.spec.wait; i++) t.wait += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
          t.d = -1;
          lastU = null;
        },
        // líneas de las rutas (solo para revisar en capturas)
        showPaths() {
          for (const t of tractors) {
            const pts = t.curve.getSpacedPoints(Math.ceil(t.len * 4)).map((q) => V(q.x, ground(q.x, q.z, 0) + 0.08, q.z));
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ff2bd6' }));
            root.add(line);
          }
        },
        // choques de cada tractor con lo fijo a lo largo de su ruta: [{ route, part, d, label, at }]
        check(step = 0.3) {
          const statics = colliders.filter((c) => !c.label.startsWith('tractor'));
          const hits = [];
          const wp = new THREE.Vector3();
          for (const t of tractors) {
            const W = A.CART[t.spec.load === 'litio' ? 'litio' : 'vacio'].W;
            const cartPts = grid(-W / 2 + 0.05, W / 2 - 0.05, 0.22, t.spec.load === 'litio' ? 1.1 : 0.85, -t.cartLen / 2, t.cartLen / 2, 3, 2, 4);
            for (let d = t.wait - t.hitch - t.cartLen / 2; d <= t.len + 1e-6; d += step) {
              placeTrain(t, Math.max(d, t.wait));
              for (const [part, pts] of [['tug', tugPts], ['cart', cartPts]]) {
                const g = part === 'tug' ? t.tug : t.cart;
                g.updateMatrixWorld(true);
                for (const q of pts) {
                  wp.copy(q).applyMatrix4(g.matrixWorld);
                  for (const c of statics) {
                    local.copy(wp).applyMatrix4(c.inv);
                    if (local.x > c.min.x + 0.01 && local.x < c.max.x - 0.01 && local.y > c.min.y + 0.01 && local.y < c.max.y - 0.01 && local.z > c.min.z + 0.01 && local.z < c.max.z - 0.01) {
                      hits.push({ route: t.spec.route, part, d: +d.toFixed(2), label: c.label, at: wp.toArray().map((v) => +v.toFixed(2)) });
                      break;
                    }
                  }
                }
              }
            }
            t.d = -1;
          }
          lastU = null;
          setSimulation(0);
          return hits;
        },
        // distancia mínima de un punto a las cajas de los tractores con la simulación en `u`
        gap(point, u) {
          setSimulation(u);
          let best = Infinity;
          const pt = V(...point);
          for (const t of tractors) {
            for (const g of [t.tug, t.cart]) {
              g.updateMatrixWorld(true);
              const box = new THREE.Box3();
              g.children.forEach((m) => m.isMesh && !m.userData.noCollide && box.union(m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox)));
              inv.copy(g.matrixWorld).invert();
              local.copy(pt).applyMatrix4(inv);
              const cl = local.clone().clamp(box.min, box.max).applyMatrix4(g.matrixWorld);
              best = Math.min(best, cl.distanceTo(pt));
            }
          }
          return best;
        },
      };
    }
  }
  // Todo lo fijo se fusiona por fragmento y material: el detalle no multiplica las llamadas de dibujo y cada
  // isla queda en sus propias mallas (ver chunks.js). Cada pieza va al fragmento del centro de su caja en
  // mundo; el agua entera (edges.js, `waterWhole`) va aparte, al fragmento 'agua'.
  // (con ?debug&nobake se conserva cada pieza por separado para poder identificarla en las pruebas, sin
  // fusión ni reparto en fragmentos)
  const baked = !(debug && typeof location !== 'undefined' && location.search.includes('nobake'));
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  // fragmento de una malla con su caja en mundo `b` ya calculada: el agua entera aparte; lo demás, por su centro
  const chunkOfBox = (o, b) => {
    if (o.userData.waterWhole) return 'agua';
    b.getCenter(center);
    return chunkKeyFor(center.x, center.z);
  };
  const chunkOfMesh = (o) => chunkOfBox(o, worldBox(o, box));
  let chunks = [];
  let checkLights = () => [];
  if (baked) {
    // Cajas en mundo de las piezas iluminadas de cada fragmento (fragmento → Box3[], ya ampliadas BOX_MARGIN), de las
    // que sale su conjunto de luces: cada pieza fija tal como llega a la fusión, cada instancia de una instanciada y
    // cada malla que no se fusiona (las que mueve una estación, `ctx.dyn`, ampliadas además DYNAMIC_MARGIN). Los
    // básicos no cuentan: su color no depende de ninguna luz.
    const pieces = new Map();
    const piecesOf = (key) => {
      if (!pieces.has(key)) pieces.set(key, []);
      return pieces.get(key);
    };
    const addPiece = (key, b) => piecesOf(key).push(b.expandByScalar(BOX_MARGIN));
    const chunkOfPiece = (o) => {
      const b = worldBox(o, new THREE.Box3());
      const key = chunkOfBox(o, b);
      if (isLit(o.material)) addPiece(key, b);
      return key;
    };
    const merged = new Set(K.bakeStatic(root, chunkOfPiece).children);
    // lo que no se ha fusionado (instanciadas, dinámicas, transparentes) también lleva su fragmento: los tres
    // tractores de la simulación, que recorren varias islas, van a 'dinamico'; el resto, por su caja
    root.updateMatrixWorld(true);
    const simParts = new Set();
    tractors.forEach(({ tug, cart }) => [tug, cart].forEach((g) => g.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.chunk = 'dinamico';
      simParts.add(o);
    })));
    const isDynamic = (o) => {
      for (let p = o; p; p = p.parent) if (p.userData.dynamic) return true;
      return false;
    };
    const tally = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.chunk === undefined) o.userData.chunk = chunkOfMesh(o);
      const k = o.userData.chunk;
      if (!tally.has(k)) tally.set(k, { key: k, meshes: 0, instanced: 0 });
      const t = tally.get(k);
      t.meshes++;
      if (o.isInstancedMesh) t.instanced++;
      if (merged.has(o) || !isLit(o.material)) return;
      piecesOf(k);
      if (o.isInstancedMesh) forEachInstanceBox(o, (b) => addPiece(k, b.clone()));
      else {
        const b = worldBox(o, new THREE.Box3());
        if (isDynamic(o) && !simParts.has(o)) b.expandByScalar(DYNAMIC_MARGIN);
        addPiece(k, b);
      }
    });
    // 'dinamico': los tractores van del cruce a su destino por las rutas de SIM; a su pose actual (en espera) se suman
    // cajas a lo largo de cada ruta (cada 2 m, en su cota, ampliadas con el tamaño de un tractor con su remolque): el
    // conjunto de luces es el del pasillo que recorren, no el de la caja que une las tres rutas
    if (pieces.has('dinamico')) {
      for (const t of tractors) {
        const n = Math.ceil(t.len / 2);
        for (let i = 0; i <= n; i++) {
          t.curve.getPointAt(i / n, _sp);
          _sp.y = ground(_sp.x, _sp.z, 0) + 1;
          addPiece('dinamico', new THREE.Box3().setFromCenterAndSize(_sp, V(2, 2, 2)).expandByScalar(SIM_MARGIN));
        }
      }
    }
    const rank = (k) => (CHUNK_ORDER.includes(k) ? CHUNK_ORDER.indexOf(k) : CHUNK_ORDER.length);
    chunks = [...tally.values()].sort((a, b) => rank(a.key) - rank(b.key) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    // Cada malla de material iluminado recibe el clon de su material para su fragmento y su tipo (chunkLights.js).
    // El tipo hace de paso lo que antes hacía un bloque aparte: un material compartido entre mallas normales e
    // instanciadas (o instanciadas con y sin color por instancia) obligaba a recalcular la clave del programa en
    // cada dibujo, y ahora cada variante tiene su clon. Los M.* no se modifican en tiempo de ejecución; los
    // animados son propios de cada estación y su clon sigue al original (LIVE_PROPS). Cada clon se ordena al
    // dibujar como el material que sustituye (`userData.sortId`, ver `opaqueSort`).
    // (con ?debug&nobake no hay fragmentos y tampoco clones)
    const kindOf = (o) => (o.isInstancedMesh ? (o.instanceColor ? 2 : 1) : 0);
    const factory = createMaterialFactory();
    const lit = [];
    root.traverse((o) => o.isMesh && isLit(o.material) && lit.push(o));
    const sortIds = drawKeys(lit, kindOf);
    // Luces locales (focos y puntuales) en el orden en que three las recorre y suma sus aportes: el de recorrido
    // de la escena (ninguna proyecta sombra ni lleva mapa, así que WebGLLights no las reordena; createChunkLightState
    // lo exige). Las globales (hemisférica y direccionales, en main.js) siguen el camino normal de three.
    const points = [];
    const spots = [];
    root.traverse((o) => {
      if (o.isSpotLight) spots.push(o);
      else if (o.isPointLight) points.push(o);
    });
    // una luz sin alcance finito llega a todas partes: entra en todos los fragmentos (exacto, más caro)
    if (debug) {
      const unbounded = [...points, ...spots].filter((l) => !(typeof l.distance === 'number' && l.distance > 0));
      if (unbounded.length) console.warn(`buildWorld: ${unbounded.length} luces locales sin alcance (distance <= 0) entran en todos los fragmentos`, unbounded.map((l) => lightLabel(l, points, spots)));
    }
    // Conjunto de luces de cada fragmento (regla exacta, chunks.js): las luces locales cuya esfera (centro en la luz,
    // radio `distance`) corta la caja de alguna de sus piezas, en el orden global. Más allá de `distance` la
    // atenuación de three vale exactamente 0 y la luz suma un cero exacto, así que quitarla no cambia ningún píxel.
    // Las cajas de las piezas ajustan más que la que las une: un puente o un acantilado de la isla no le traen las
    // luces que solo alcanzan el hueco entre sus piezas. El agua entera (fragmento 'agua') es una sola pieza con la
    // caja del disco: recibe todas las luces que llegan a su plano.
    const own = [...pieces].map(([key, list]) => {
      if (key === 'resto') return { key, points, spots };
      if (key === 'agua-lejana') return { key, points: [], spots: [] };
      return { key, points: lightSetForBoxes(list, points), spots: lightSetForBoxes(list, spots) };
    });
    // Relleno por clases (padLightClasses): cada pareja (nº de puntuales, nº de focos) compila un programa por material,
    // así que los conjuntos de las islas, que comparten casi todos sus materiales, se igualan a LIGHT_CLASSES clases
    // añadiendo, detrás de las propias, luces que no las alcanzan (suman un cero exacto). Agua y dinámico usan muy
    // pocos materiales y se quedan con su conjunto exacto: rellenarlos costaría mucha GPU para ahorrar 1 o 2 programas.
    const padded = new Map(own.map((e) => [e.key, { points: [...e.points], spots: [...e.spots] }]));
    padLightClasses(own.filter((e) => CHUNK_KEYS.includes(e.key)), points, spots, LIGHT_CLASSES).forEach((s, key) => padded.set(key, s));
    // un estado de luces por fragmento (sus objetos de uniforme), compartido por todos sus clones (chunkLights.js)
    const states = new Map([...padded].map(([key, s]) => [key, createChunkLightState(s.points, s.spots)]));
    // para la depuración (chunks()): caja que une sus piezas, luces del conjunto (rellenado) y cuántas alcanzan de verdad
    const reach = new Map(own.map((e) => [e.key, { points: e.points.length, spots: e.spots.length }]));
    for (const c of chunks) {
      const s = padded.get(c.key);
      const b = pieces.has(c.key) ? pieces.get(c.key).reduce((u, x) => u.union(x), new THREE.Box3()) : null;
      c.box = b && !b.isEmpty() ? { min: b.min.toArray(), max: b.max.toArray() } : null;
      c.points = s ? s.points.map((l) => lightLabel(l, points, spots)) : [];
      c.spots = s ? s.spots.map((l) => lightLabel(l, points, spots)) : [];
      c.reach = reach.get(c.key) || { points: 0, spots: 0 };
    }
    const cloned = [];
    for (const o of lit) {
      const chunk = o.userData.chunk;
      const kind = kindOf(o);
      const state = states.get(chunk);
      const clone = factory.materialFor(o.material, chunk, kind, state);
      clone.userData.sortId = sortIds.get(o);
      // los uniformes del fragmento se calculan una vez por fotograma, antes de dibujar la primera de sus mallas
      // (three llama a onBeforeRender antes de subir los uniformes del material, con la cámara del fotograma)
      const before = Object.prototype.hasOwnProperty.call(o, 'onBeforeRender') ? o.onBeforeRender : null;
      o.onBeforeRender = before
        ? function onBeforeRender(renderer, drawnScene, camera, geometry, material, group) {
          state.sync(camera, renderer.info.render.frame);
          before.call(this, renderer, drawnScene, camera, geometry, material, group);
        }
        : (renderer, drawnScene, camera) => state.sync(camera, renderer.info.render.frame);
      // Una estación puede cambiar en marcha el material de una malla (el piloto del comprobador del laboratorio
      // alterna M.lime y M.amberGlow, lab.js): la malla recibe entonces el clon de ese material para su fragmento y
      // su tipo, con las luces del fragmento. Sin esto dibujaría el original, cuyo programa ya no comparte ningún
      // clon: three lo compilaría en mitad del recorrido, al entrar en el laboratorio.
      let current = clone;
      Object.defineProperty(o, 'material', {
        configurable: true,
        enumerable: true,
        get: () => current,
        set: (m) => {
          current = factory.materialFor(m, chunk, kind, state);
        },
      });
      cloned.push(o);
    }
    // Comprobación (con ?debug, __ecobat.debug.checkLights()): para cada malla con clon, las luces locales que no están
    // en el conjunto de su fragmento y alcanzan su geometría en su pose actual, con el mismo margen BOX_MARGIN de los
    // conjuntos: primero contra su caja en mundo y, las que la alcanzan, contra cada triángulo (mallas fusionadas, que
    // son fijas), cada instancia (instanciadas) o la malla entera (las demás, que una estación puede mover). Vacía si
    // los conjuntos son correctos. (Una malla que una estación haya pasado a un material sin luces no cuenta: su color
    // no depende de ninguna.)
    const locals = [...points, ...spots];
    const byId = new Map(locals.map((l) => [l.uuid, l]));
    checkLights = () => {
      root.updateMatrixWorld(true);
      const out = [];
      for (const o of cloned) {
        if (!isLit(o.material)) continue;
        const name = `${o.userData.chunk}/${o.material.name || o.material.type}#${o.id}`;
        const lightIds = new Set(o.material.userData.chunkLights);
        const near = findLightViolations([{ name, box: worldBox(o, new THREE.Box3()).expandByScalar(BOX_MARGIN), lightIds }], locals);
        if (!near.length) continue;
        let hit = near.map((v) => byId.get(v.light));
        if (merged.has(o)) hit = lightsOnTriangles(o, hit, BOX_MARGIN);
        else if (o.isInstancedMesh) {
          const list = [];
          forEachInstanceBox(o, (b) => list.push(b.clone().expandByScalar(BOX_MARGIN)));
          hit = lightSetForBoxes(list, hit);
        }
        for (const l of hit) out.push({ name, light: l.uuid });
      }
      return out;
    };
  }
  performance.mark('eb:bake');

  return {
    // story: { index, vis, local, p, sim, conn } — estado narrativo del fotograma
    update(t, dt, story) {
      anims.forEach((f) => f(t, dt, story));
    },
    setSimulation,
    setConnections,
    colliders,
    // fragmentos: { key, meshes (mallas, instanciadas incluidas), instanced, box ({ min, max }: la caja que une las de
    // sus piezas iluminadas, márgenes incluidos; null sin ellas), points y spots (nombres de las luces de su conjunto
    // rellenado, en el orden de sus uniformes), reach ({ points, spots }: cuántas alcanzan de verdad alguna de sus
    // piezas; el resto es relleno) } (vacío con ?debug&nobake)
    chunks,
    // luces locales que alcanzan una malla y faltan en su fragmento: Array<{ name, light (uuid) }> (vacío con &nobake)
    checkLights,
  };
}
