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
import { CHUNK_KEYS, chunkKeyFor } from './chunks.js';
import { createMaterialFactory, isLit, drawKeys } from './chunkLights.js';

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

// Orden de la lista de fragmentos: islas, agua, dinámico y, al final, lo no previsto.
const CHUNK_ORDER = [...CHUNK_KEYS, 'agua', 'agua-lejana', 'dinamico', 'resto'];

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

  // ---------- Simulación del capítulo 4 (hipotética: 2 / 1 / 7) ----------
  // Las baterías esperan en cola sobre la franja este del laboratorio y la rampa, cada una apoyada en el
  // suelo y con la inclinación del tablero, y salen por orden hacia su destino (layout.js · SIM).
  const routeCurves = Object.fromEntries(Object.entries(SIM.routes).map(([k, pts]) => [k, new THREE.CatmullRomCurve3([...SIM.entry, ...pts])]));
  // longitud de la entrada común (hasta su último punto de control) medida sobre cada curva
  const entryLen = (curve) => {
    const n = curve.points.length - 1;
    const tEnd = (SIM.entry.length - 1) / n;
    let L = 0;
    const a = curve.getPoint(0);
    const b = new THREE.Vector3();
    for (let i = 1; i <= 200; i++) {
      curve.getPoint((tEnd * i) / 200, b);
      L += a.distanceTo(b);
      a.copy(b);
    }
    return L;
  };
  const routeInfo = Object.fromEntries(Object.entries(routeCurves).map(([k, c]) => [k, { curve: c, len: c.getLength(), entry: entryLen(c) }]));
  const counters = { service: 0, second: 0, recycle: 0 };
  // distancia sobre la curva al punto más cercano a (x, z): codos de la rampa 2 (pie y coronación)
  const along = (curve, x, z) => {
    let best = 0;
    let bd = Infinity;
    const q = new THREE.Vector3();
    for (let k = 0; k <= 2000; k++) {
      curve.getPointAt(k / 2000, q);
      const dd = Math.hypot(q.x - x, q.z - z);
      if (dd < bd) {
        bd = dd;
        best = k / 2000;
      }
    }
    return best * curve.getLength();
  };
  const B2 = BRIDGES[2];
  Object.values(routeInfo).forEach((info) => (info.knees = [along(info.curve, B2[0].x, B2[0].z), along(info.curve, B2[1].x, B2[1].z)]));
  let queueD = null;
  const tokens = SIM.plan.map((route, i) => {
    const slot = counters[route]++;
    const info = routeInfo[route];
    let qd = queueD === null ? info.entry - SIM.head : queueD - SIM.gap;
    for (const k of info.knees) if (Math.abs(qd - k) < 0.65) qd = k - 0.65;
    queueD = qd;
    const b = K.compact(K.makeBattery(M, { scale: 0.72, label: false }));
    b.userData.dynamic = true;
    b.userData.noCollide = true;
    b.rotation.order = 'YZX';
    root.add(b);
    // distancias sobre la curva: puesto en la cola y plaza en el destino
    return { b, route, i, info, from: qd, to: info.len - 0.15 - slot * (route === 'recycle' ? 1.3 : SIM.gap) };
  });
  const tp = new THREE.Vector3();
  const ta = new THREE.Vector3();
  const tb = new THREE.Vector3();
  let lastU = null;
  let lastArrived = null;
  function setSimulation(u) {
    // u: 0 → baterías en cola; 1 → cada una en su destino. Devuelve cuántas han llegado por ruta y la ruta
    // de la batería en marcha a menos de 3 m del bordillo de la isleta central (la que muestra la rosa del
    // cruce; las ya aparcadas no cuentan, así la rosa repasa A, B y C cuando terminan todas).
    if (u === lastU) return lastArrived;
    lastU = u;
    const arrived = { service: 0, second: 0, recycle: 0, near: null };
    let nearD = 3;
    tokens.forEach(({ b, route, i, info, from, to }) => {
      const local = THREE.MathUtils.clamp((u - i * SIM.stagger) / SIM.span, 0, 1);
      const e = local * local * (3 - 2 * local);
      const d = THREE.MathUtils.lerp(from, to, e);
      const L = info.len;
      onCurve(info.curve, d / L, tp);
      onCurve(info.curve, (d + 0.45) / L, ta);
      onCurve(info.curve, (d - 0.45) / L, tb);
      const hx = ta.x - tb.x;
      const hz = ta.z - tb.z;
      const hl = Math.hypot(hx, hz) || 1;
      const yf = surfaceY(tp.x + (hx / hl) * 0.6, tp.z + (hz / hl) * 0.6);
      const yb = surfaceY(tp.x - (hx / hl) * 0.6, tp.z - (hz / hl) * 0.6);
      // sin suelo conocido (hueco entre isla y tablero) manda el punto apoyado de la propia curva
      const ff = yf !== null ? yf + 0.012 : ta.y;
      const fb = yb !== null ? yb + 0.012 : tb.y;
      b.position.copy(tp);
      b.position.y = Math.max(tp.y, (ff + fb) / 2);
      b.rotation.set(0, Math.atan2(hx, hz) + Math.PI / 2, -Math.atan2(ff - fb, 1.2));
      if (local >= 1) arrived[route]++;
      const k = Math.hypot(tp.x - s4.x, tp.z - s4.z) - 2.2;
      if (local > 0 && local < 1 && k < nearD) {
        nearD = k;
        arrived.near = route;
      }
    });
    lastArrived = arrived;
    return arrived;
  }
  setSimulation(0);

  // ---------- Conexiones del capítulo 6 ----------
  const arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#C2F230').multiplyScalar(1.15), transparent: true, opacity: 0.85 });
  const hubTop = V(s6.x - 1.2, s6.y + 6.4, s6.z - 1.4);
  const arcs = [STATIONS.s1, STATIONS.s2, STATIONS.s3, STATIONS.s4, STATIONS.s5].map((s) => {
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
      const local = THREE.MathUtils.clamp((u - i * 0.1) / 0.5, 0, 1);
      m.geometry.setDrawRange(0, Math.floor((total * local) / 3) * 3);
      node.scale.setScalar(local >= 1 ? 1 : 0.001);
    });
  }
  setConnections(0);

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
  // Todo lo fijo se fusiona por fragmento y material: el detalle no multiplica las llamadas de dibujo y cada
  // isla queda en sus propias mallas (ver chunks.js). Cada pieza va al fragmento del centro de su caja en
  // mundo; el agua entera (edges.js, `waterWhole`) va aparte, al fragmento 'agua'.
  // (con ?debug&nobake se conserva cada pieza por separado para poder identificarla en las pruebas, sin
  // fusión ni reparto en fragmentos)
  const baked = !(debug && typeof location !== 'undefined' && location.search.includes('nobake'));
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const chunkOfMesh = (o) => {
    if (o.userData.waterWhole) return 'agua';
    worldBox(o, box).getCenter(center);
    return chunkKeyFor(center.x, center.z);
  };
  let chunks = [];
  if (baked) {
    K.bakeStatic(root, chunkOfMesh);
    // lo que no se ha fusionado (instanciadas, dinámicas, transparentes) también lleva su fragmento: las diez
    // baterías de la simulación, que recorren varias islas, van a 'dinamico'; el resto, por su caja
    root.updateMatrixWorld(true);
    tokens.forEach(({ b }) => b.traverse((o) => o.isMesh && (o.userData.chunk = 'dinamico')));
    const tally = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.chunk === undefined) o.userData.chunk = chunkOfMesh(o);
      const k = o.userData.chunk;
      if (!tally.has(k)) tally.set(k, { key: k, meshes: 0, instanced: 0 });
      const t = tally.get(k);
      t.meshes++;
      if (o.isInstancedMesh) t.instanced++;
    });
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
    for (const o of lit) {
      const clone = factory.materialFor(o.material, o.userData.chunk, kindOf(o));
      clone.userData.sortId = sortIds.get(o);
      o.material = clone;
    }
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
    // fragmentos: { key, meshes (mallas, instanciadas incluidas), instanced } (vacío con ?debug&nobake)
    chunks,
  };
}
