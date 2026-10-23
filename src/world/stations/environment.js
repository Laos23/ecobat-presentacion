import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ACCESS } from '../layout.js';
import { radial } from '../pbr.js';
import { makeParkedCar, makeTruck } from '../actors.js';

// v2 · Entorno del polígono (ideas §7): polígono industrial al anochecer. Tierra firme a la cota 0,31 al oeste, al
// norte y al este de la bahía, con muelle de hormigón hacia el agua; dos calzadas de 7 m sobre pilas (la ciudad → s1 y
// s5 → la fábrica), carreteras, aparcamiento, valla, vegetación y farolas; la ciudad iluminada al fondo (noroeste) y la
// fábrica de baterías nuevas fuera del polígono (orilla este). Los accesos son los de layout.js · ACCESS.
//
// Rendimiento, pensado desde el principio:
// - Solo materiales de M (makeMaterials). Las únicas excepciones son básicos sin luces: el de la ciudad (un programa
//   propio, el único que añade el entorno) y el de los charcos de luz de las farolas, que tiene los mismos parámetros que
//   el de los charcos de las balizas (kit.js · scatterLamps) y comparte su programa.
// - Ninguna luz real: las farolas, ventanas y pilotos son emisivos (warmGlow, amberGlow) y los charcos, aditivos.
// - Lo fijo se fusiona solo (bakeStatic en world.js): una llamada por material y fragmento. Lo que se repite mucho
//   (farolas, paneles y postes de la valla, edificios de la ciudad, árboles) va instanciado.
// - Fragmentos: world.js asigna cada pieza al fragmento de la isla más cercana (chunks.js · chunkKeyFor) y calcula su
//   conjunto de luces con la caja de cada pieza. Las piezas de tierra firme se parten para que ninguna caja llegue a la
//   esfera de una luz de las islas (las explanadas empiezan en las orillas, a más de 50 m de cualquier luz): no añaden
//   luces a ningún fragmento ni cambian sus clases, así que no se compila ningún programa iluminado nuevo y la regla
//   sigue siendo exacta (debug.checkLights() vacío). Mandarlas a un fragmento sin luces costaría un programa por
//   material; las islas cercanas tienen de 1 a 5 luces locales y el sombreador salta las que no llegan.
// - La ciudad es una sola InstancedMesh de cajas con un material básico sin niebla (la niebla exponencial la borraría a
//   400 m): la bruma va pintada en su textura de ventanas, compartida por todos los edificios.

const Y = ACCESS.west.shore.y; // cota de la tierra firme (0,31)
const BASE = -3.4; // pie de los muros del muelle, bajo el agua (a -2,6)
const ROAD = Y + 0.08; // firme de las carreteras: 8 cm sobre la explanada (de lejos no parpadea)
const SOIL = Y + 0.11; // parterres de tierra
const PAD = Y + 0.06; // explanada de la fábrica
const MARK = 0.012; // las marcas viales asoman 1,2 cm sobre el firme
const WEST = ACCESS.shoreWestX; // -125
const EAST = ACCESS.shoreEastX; // 105
const NORTH = -212; // orilla norte de la bahía, al pie de la ciudad
const FAR = 650; // las explanadas siguen hasta más allá del plano lejano (700 m) visto desde el polígono
const ROAD_W = 7;
const MAIN_W = WEST - 25; // eje de la carretera oeste (x = -150)
const MAIN_E = EAST + 23; // eje de la carretera este (x = 128)
const NORTH_Z = NORTH - 10.5; // eje de la carretera de la orilla norte (z = -222,5)

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r3 = (v) => Math.round(v * 1000) / 1000;

// Caja por esquinas en planta, con la cara superior a la cota `top` y alto `h`.
function slab(ctx, mat, x0, x1, z0, z1, top, h) {
  return ctx.add(ctx.K.box(r3(x1 - x0), h, r3(z1 - z0), mat, (x0 + x1) / 2, top - h, (z0 + z1) / 2));
}

// Pieza larga en x (xa < xb) cuya cara superior va de la cota ya (en xa) a yb (en xb), centrada en z.
function along(ctx, key, mat, xa, xb, ya, yb, z, w, h) {
  const L = r3(xb - xa);
  const g = ctx.K.geo(`env:${key}|${L}|${h}|${w}`, () => new THREE.BoxGeometry(L, h, w).translate(0, -h / 2, 0));
  const m = new THREE.Mesh(g, mat);
  m.position.set((xa + xb) / 2, (ya + yb) / 2, z);
  m.rotation.z = Math.atan2(yb - ya, L);
  return ctx.add(m);
}

// ---------- farolas ----------
// Báculo de 8 m con brazo hacia la calzada (eje +x local) y luminaria con difusor cálido; sin luz real: el charco
// aditivo bajo la luminaria hace de luz en el firme. Tres mallas instanciadas por orilla (báculo, difusor, charco).
function lampGeometries(K) {
  return {
    pole: K.geo('envLampPole', () => mergeGeometries([
      new THREE.BoxGeometry(0.3, 0.3, 0.3).translate(0, 0.15, 0),
      new THREE.CylinderGeometry(0.065, 0.1, 7.9, 6, 1, true).translate(0, 4.1, 0),
      new THREE.BoxGeometry(1.9, 0.08, 0.08).translate(0.95, 7.95, 0),
      new THREE.BoxGeometry(0.82, 0.15, 0.34).translate(1.78, 7.88, 0),
    ])),
    lens: K.geo('envLampLens', () => new THREE.BoxGeometry(0.64, 0.03, 0.26).translate(1.78, 7.795, 0)),
    pool: K.geo('poolV2', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
  };
}

function buildLamps(ctx, list, poolMat) {
  if (!list.length) return;
  const { K, M } = ctx;
  const G = lampGeometries(K);
  const n = list.length;
  const posts = new THREE.InstancedMesh(G.pole, M.graphite, n);
  const glows = new THREE.InstancedMesh(G.lens, M.warmGlow, n);
  const pools = new THREE.InstancedMesh(G.pool, poolMat, n);
  const o = new THREE.Object3D();
  list.forEach((l, i) => {
    o.position.set(l.x, l.y, l.z);
    o.rotation.set(0, Math.atan2(-l.dz, l.dx), 0);
    o.scale.setScalar(1);
    o.updateMatrix();
    posts.setMatrixAt(i, o.matrix);
    glows.setMatrixAt(i, o.matrix);
    o.position.set(l.x + l.dx * 1.78, l.py, l.z + l.dz * 1.78);
    o.rotation.set(0, 0, 0);
    o.scale.set(l.pool, 1, l.pool);
    o.updateMatrix();
    pools.setMatrixAt(i, o.matrix);
  });
  posts.castShadow = true;
  posts.receiveShadow = true;
  glows.userData.noCollide = true;
  pools.userData.noCollide = true;
  pools.renderOrder = 2;
  ctx.add(posts);
  ctx.add(glows);
  ctx.add(pools);
}

// ---------- valla ----------
// Paneles de 2,5 m (dos largueros y barrotes) y postes, en grafito; dos mallas instanciadas por orilla.
function buildFence(ctx, lines) {
  const { K, M } = ctx;
  const panel = K.geo('envFencePanel', () => {
    const parts = [
      new THREE.BoxGeometry(2.5, 0.05, 0.04).translate(0, 0.16, 0),
      new THREE.BoxGeometry(2.5, 0.05, 0.04).translate(0, 1.86, 0),
    ];
    for (let k = 0; k < 7; k++) parts.push(new THREE.BoxGeometry(0.026, 1.78, 0.026).translate(-1.25 + (k + 0.5) * (2.5 / 7), 1.0, 0));
    return mergeGeometries(parts);
  });
  const post = K.geo('envFencePost', () => mergeGeometries([
    new THREE.BoxGeometry(0.2, 0.06, 0.2).translate(0, 0.03, 0),
    new THREE.BoxGeometry(0.07, 2.0, 0.07).translate(0, 1.0, 0),
  ]));
  const panels = [];
  const posts = [];
  const o = new THREE.Object3D();
  lines.forEach(([x0, z0, x1, z1]) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 2.5));
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      o.position.set(x0 + (x1 - x0) * t, Y, z0 + (z1 - z0) * t);
      o.rotation.set(0, ry, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      posts.push(o.matrix.clone());
      if (k < n) {
        o.position.set(x0 + (x1 - x0) * (t + 0.5 / n), Y, z0 + (z1 - z0) * (t + 0.5 / n));
        o.scale.set(len / n / 2.5, 1, 1);
        o.updateMatrix();
        panels.push(o.matrix.clone());
      }
    }
  });
  [[panel, panels], [post, posts]].forEach(([g, mats]) => {
    const im = new THREE.InstancedMesh(g, M.graphite, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    im.receiveShadow = true;
    ctx.add(im);
  });
}

// ---------- calzadas ----------
// Firme de 7 m sobre pilas: rodadura de 6,4 m, bordillos con el quitamiedos y las farolas, canto claro, marcas viales.
// La rasante va recta de la isla (1,5 cm sobre su suelo, medio metro dentro de la tapa: sin hueco con el contorno
// curvo de s1) al firme de la carretera en la orilla.
function causeway(ctx, a, lamps) {
  const { K, M } = ctx;
  const dir = Math.sign(a.shore.x - a.rim.x);
  const zc = a.rim.z;
  const hw = a.width / 2;
  const xi = a.rim.x - dir * 0.5;
  const xs = a.shore.x;
  const yi = a.rim.y + 0.015;
  const top = (x) => yi + ((ROAD - yi) * (x - xi)) / (xs - xi);
  const [x0, x1] = xi < xs ? [xi, xs] : [xs, xi];
  const span = (xa, xb, dy) => [Math.min(xa, xb), Math.max(xa, xb), top(Math.min(xa, xb)) + dy, top(Math.max(xa, xb)) + dy];
  const run = (key, mat, xa, xb, dy, z, w, h) => {
    const [p, q, yp, yq] = span(xa, xb, dy);
    along(ctx, key, mat, p, q, yp, yq, z, w, h);
  };
  run('asf', M.rubber, x0, x1, 0, zc, 6.4, 0.06);
  run('deck', M.concrete, x0, x1, -0.06, zc, a.width, 0.75);
  [-1, 1].forEach((sd) => {
    run('curb', M.concreteLight, x0, x1, 0.12, zc + sd * (hw - 0.15), 0.3, 0.2);
    run('fascia', M.concreteLight, x0, x1, -0.02, zc + sd * (hw + 0.03), 0.06, 0.55);
    run('edgeLine', M.ivory, x0, x1, MARK, zc + sd * 2.95, 0.12, 0.02);
    // quitamiedos: banda de acero sobre postes cada 2 m, desde 1 m fuera de la isla hasta 1 m antes de la orilla
    const ga = a.rim.x + dir * 1;
    const gb = xs - dir * 1;
    run('beam', M.steel, ga, gb, 0.12 + 0.72, zc + sd * 3.24, 0.05, 0.3);
    const n = Math.round(Math.abs(gb - ga) / 2);
    for (let k = 0; k <= n; k++) {
      const x = ga + ((gb - ga) * k) / n;
      ctx.add(K.box(0.1, 0.78, 0.1, M.darkSteel, x, top(x) + 0.1, zc + sd * 3.32));
    }
  });
  // eje discontinuo: 3 m de marca cada 9 m
  const len = Math.abs(xs - a.rim.x);
  for (let s = 3; s + 3 < len - 1; s += 9) run('dash', M.ivory, a.rim.x + dir * s, a.rim.x + dir * (s + 3), MARK, zc, 0.12, 0.02);
  // pilas: cabecero bajo el tablero y dos fustes hasta el fondo
  for (let s = 5; s < len - 3; s += 9) {
    const x = a.rim.x + dir * s;
    const yb = top(x) - 0.81;
    ctx.add(K.box(1.0, 0.6, a.width - 0.5, M.concrete, x, yb - 0.6, zc));
    const h = r3(yb - 0.6 - BASE);
    [-1, 1].forEach((sd) => {
      const c = K.cyl(0.42, 0.5, h, M.concrete, 10);
      c.position.set(x, BASE + h / 2, zc + sd * 2.2);
      ctx.add(c);
    });
  }
  // farolas alternas sobre los bordillos, cada 9 m
  let k = 0;
  for (let s = 6; s < len - 2; s += 9, k++) {
    const x = a.rim.x + dir * s;
    const sd = k % 2 ? 1 : -1;
    lamps.push({ x, z: zc + sd * 3.42, y: top(x) + 0.12, dx: 0, dz: -sd, py: top(x) + 0.03, pool: 8 });
  }
}

// ---------- ciudad ----------
// Lienzo de fachadas con ventanas (16 × 16 por tesela, 3 m × 3,4 m cada una): la mayoría apagadas, un tercio
// encendidas en tonos cálidos y alguna fría. El canto inferior izquierdo es fachada lisa (cubiertas).
function cityTexture() {
  const N = 256;
  const cs = 16;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#171b20';
  g.fillRect(0, 0, N, N);
  const rnd = rng(1207);
  for (let j = 0; j < N / cs; j++) {
    // plantas enteras más o menos ocupadas: el encendido va por franjas, como en una ciudad de verdad
    const busy = rnd();
    for (let i = 0; i < N / cs; i++) {
      const r = rnd();
      let col = '#20262e';
      if (r < 0.12 + busy * 0.42) {
        const k = 0.55 + rnd() * 0.45;
        col = rnd() < 0.12
          ? `rgb(${Math.round(185 * k)},${Math.round(200 * k)},${Math.round(215 * k)})`
          : `rgb(${Math.round(255 * k)},${Math.round((178 + rnd() * 40) * k)},${Math.round((96 + rnd() * 40) * k)})`;
      }
      g.fillStyle = col;
      g.fillRect(i * cs + 4, j * cs + 5, 9, 7);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function buildCity(ctx) {
  const { K } = ctx;
  const C = ACCESS.city;
  const mat = new THREE.MeshBasicMaterial({ map: cityTexture(), fog: false });
  mat.name = 'ciudad';
  // UV a escala métrica en cada cara: una sola caja unitaria instanciada sirve para todos los tamaños de edificio
  // (las ventanas no se estiran); cada edificio desplaza la tesela según su posición; las cubiertas, fachada lisa.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_INSTANCING
	vec3 bScale = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ), length( instanceMatrix[ 2 ].xyz ) );
	float bFace = abs( normal.x ) > 0.5 ? bScale.z : bScale.x;
	vec2 bSeed = floor( fract( instanceMatrix[ 3 ].xz * vec2( 0.0173, 0.0291 ) ) * 16.0 ) / 16.0;
	vMapUv = abs( normal.y ) > 0.5 ? vec2( 0.004 ) : vec2( uv.x * bFace / 48.0 + bSeed.x, uv.y * bScale.y / 54.4 + bSeed.y );
#endif`);
  };
  mat.customProgramCacheKey = () => 'ecobat-ciudad';
  const rnd = rng(4242);
  const list = [];
  const x0 = C.center.x - C.width / 2;
  const x1 = C.center.x + C.width / 2;
  const zFront = C.center.z + C.depth / 2;
  const zBack = C.center.z - C.depth / 2;
  for (let gx = x0 + 12; gx < x1; gx += 24) {
    for (let gz = zFront - 13; gz > zBack; gz -= 24) {
      if (Math.abs(gx - MAIN_W) < 15) continue; // la avenida que llega del polígono
      const back = (zFront - gz) / C.depth;
      const core = Math.max(0, 1 - Math.hypot((gx - C.center.x) / (C.width / 2), (gz - C.center.z) / (C.depth / 2)));
      const count = rnd() < 0.3 ? 2 : 1;
      for (let b = 0; b < count; b++) {
        const w = 10 + rnd() * (count > 1 ? 6 : 10);
        const d = 10 + rnd() * (count > 1 ? 6 : 10);
        let h = 3.4 * Math.round((8 + rnd() * 14 + back * 22 + core * 30) / 3.4);
        if (rnd() < 0.1 + core * 0.3) h += 3.4 * Math.round((20 + rnd() * 40) / 3.4);
        const ox = count > 1 ? (b ? 5.5 : -5.5) : (rnd() - 0.5) * 5;
        const oz = (rnd() - 0.5) * 4;
        list.push({ x: gx + ox, z: Math.min(gz + oz, zFront - d / 2), w, d, h: count > 1 && b ? h * 0.55 : h, k: 0.8 + rnd() * 0.35 });
      }
    }
  }
  const geom = K.geo('envCityBox', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const im = new THREE.InstancedMesh(geom, mat, list.length);
  const o = new THREE.Object3D();
  const col = new THREE.Color();
  list.forEach((b, i) => {
    o.position.set(b.x, Y, b.z);
    o.scale.set(b.w, b.h, b.d);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
    im.setColorAt(i, col.setScalar(b.k));
  });
  im.userData.noCollide = true;
  ctx.add(im);
  return list.length;
}

// ---------- fábrica de baterías nuevas ----------
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1e20';
  g.fillRect(0, 0, 1024, 128);
  g.strokeStyle = 'rgba(241,238,230,0.55)';
  g.lineWidth = 4;
  g.strokeRect(10, 10, 1004, 108);
  g.fillStyle = '#F1EEE6';
  g.font = '800 78px "Archivo Variable", Archivo, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('Fábrica de baterías', 512, 68, 960);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildFactory(ctx, lamps, trees, rnd) {
  const { K, M } = ctx;
  const f = ACCESS.factory;
  const x0 = f.x - 25;
  const x1 = f.x + 25;
  const z0 = f.z - 17;
  const z1 = f.z + 17;
  const b = PAD;
  // explanada y acceso desde la carretera este
  slab(ctx, M.concrete, x0 - 4, x1 + 6, z0 - 6, z1 + 20, PAD, 0.2);
  slab(ctx, M.panel, MAIN_E + ROAD_W / 2, x0 - 4, z1 + 4, z1 + 16, ROAD, 0.12);
  slab(ctx, M.trunk, x0 - 4, x1 + 6, z1 + 20.3, z1 + 25, SOIL, 0.2);
  for (let x = x0; x <= x1 + 3; x += 8.5) trees.push({ x: x + rnd() * 2, y: SOIL, z: z1 + 22.6, s: 1.9 + rnd() * 0.6, kind: 'tree', r: rnd() * 6.28 });
  // nave: zócalo, cerramiento claro y cornisa
  ctx.add(K.box(50, 10, 34, M.ivoryPanel, f.x, b, f.z));
  ctx.add(K.box(50.16, 1.1, 34.16, M.panel, f.x, b, f.z));
  ctx.add(K.box(50.3, 0.35, 34.3, M.concreteLight, f.x, b + 9.7, f.z));
  // cubierta en diente de sierra: seis dientes con el lucernario vertical hacia el oeste (hacia el polígono)
  const wT = 50 / 6;
  const hT = 2.8;
  const tooth = K.geo('envSawTooth', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(wT, 0);
    s.lineTo(0, hT);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 34, bevelEnabled: false });
  });
  for (let k = 0; k < 6; k++) {
    const x = x0 + k * wT;
    const m = new THREE.Mesh(tooth, M.darkSteel);
    m.position.set(x, b + 10, z0);
    ctx.add(m);
    ctx.add(K.box(0.08, hT - 0.5, 33, M.darkGlass, x - 0.04, b + 10.25, f.z));
    ctx.add(K.box(0.05, 0.22, 32.4, M.warmGlow, x - 0.1, b + 11.1, f.z));
  }
  // chimenea con bandas y piloto cálido
  const cx = x1 + 3;
  const cz = z0 + 4;
  const stack = K.cyl(1.1, 1.4, 32, M.concreteLight, 12);
  stack.position.set(cx, b + 16, cz);
  ctx.add(stack);
  [22, 28.5].forEach((y) => {
    const band = K.cyl(1.2, 1.2, 0.6, M.darkSteel, 12);
    band.position.set(cx, b + y, cz);
    ctx.add(band);
  });
  const lip = K.cyl(1.18, 1.18, 0.5, M.darkSteel, 12);
  lip.position.set(cx, b + 31.9, cz);
  ctx.add(lip);
  const beacon = K.cyl(1.13, 1.13, 0.3, M.amberGlow, 12);
  beacon.position.set(cx, b + 30.6, cz);
  ctx.add(beacon);
  // oficinas en la esquina suroeste, con dos bandas de ventanas encendidas
  const ox = x0 + 6.5;
  const oz = z1 + 5.5;
  ctx.add(K.box(13, 7.4, 11, M.ivoryPanel, ox, b, oz));
  ctx.add(K.box(13.2, 0.3, 11.2, M.graphite, ox, b + 7.4, oz));
  [1.2, 4.5].forEach((y) => {
    ctx.add(K.box(12.2, 1.5, 0.1, M.darkGlass, ox, b + y, oz + 5.52));
    ctx.add(K.box(11.8, 0.3, 0.06, M.warmGlow, ox, b + y + 1.05, oz + 5.58));
    ctx.add(K.box(0.1, 1.5, 10.2, M.darkGlass, x0 - 0.02, b + y, oz));
    ctx.add(K.box(0.06, 0.3, 9.8, M.warmGlow, x0 - 0.09, b + y + 1.05, oz));
  });
  // muelle de carga en la fachada sur: andén, cuatro puertas con abrigo, topes y luces
  const dx0 = x0 + 15;
  const dx1 = x1 - 1;
  ctx.add(K.box(dx1 - dx0, 1.2, 3, M.concrete, (dx0 + dx1) / 2, b, z1 + 1.5));
  const doors = [0, 1, 2, 3].map((i) => dx0 + 4.5 + i * 7.3);
  doors.forEach((x) => {
    ctx.add(K.box(3.2, 3.4, 0.08, M.darkSteel, x, b + 1.2, z1 + 0.04));
    ctx.add(K.box(3.9, 0.45, 0.6, M.rubber, x, b + 4.6, z1 + 0.3));
    [-1, 1].forEach((sd) => {
      ctx.add(K.box(0.35, 3.4, 0.6, M.rubber, x + sd * 1.78, b + 1.2, z1 + 0.3));
      ctx.add(K.box(0.25, 0.4, 0.15, M.rubber, x + sd * 1.2, b + 0.6, z1 + 3.07));
    });
    ctx.add(K.box(0.36, 0.12, 0.26, M.warmGlow, x + 2.35, b + 5.25, z1 + 0.13));
  });
  // ventana corrida de la nave, al sur y al oeste
  ctx.add(K.box(dx1 - dx0, 1.0, 0.1, M.darkGlass, (dx0 + dx1) / 2, b + 6.0, z1 + 0.05));
  ctx.add(K.box(dx1 - dx0 - 0.4, 0.18, 0.06, M.warmGlow, (dx0 + dx1) / 2, b + 6.6, z1 + 0.11));
  ctx.add(K.box(0.1, 1.4, 24, M.darkGlass, x0 - 0.05, b + 3.4, f.z - 4));
  ctx.add(K.box(0.06, 0.2, 23.6, M.warmGlow, x0 - 0.11, b + 4.35, f.z - 4));
  // rótulo «Fábrica de baterías» (sin marcas): en la fachada oeste, que mira al polígono, y sobre el muelle
  const sign = K.screen(signTexture(), 16, 2, 0.9);
  sign.position.set(x0 - 0.12, b + 8.1, f.z - 4);
  sign.rotation.y = -Math.PI / 2;
  ctx.add(sign);
  const sign2 = new THREE.Mesh(K.geo('envSign14', () => new THREE.PlaneGeometry(14, 1.75)), sign.material);
  sign2.position.set((dx0 + dx1) / 2, b + 8.5, z1 + 0.08);
  ctx.add(sign2);
  [-1, 1].forEach((sd) => {
    ctx.add(K.box(0.12, 2.3, 0.12, M.darkSteel, x0 - 0.12, b + 6.95, f.z - 4 + sd * 8.1));
  });
  // un camión de expedición en el muelle (camino de vuelta al mercado de las baterías nuevas)
  if (typeof makeTruck === 'function') {
    const truck = makeTruck(M, { kind: 'expedicion', loaded: true });
    truck.position.set(doors[1], b, z1 + 3 + 4.4);
    ctx.add(truck);
    ctx.shadows.push({ x: doors[1], y: b, z: z1 + 3 + 4.4, w: 3.2, d: 9.4 });
  }
  // farolas del patio
  [x0 + 10, f.x + 3, x1 - 4].forEach((x) => lamps.push({ x, z: z1 + 19.4, y: PAD, dx: 0, dz: -1, py: PAD + 0.03, pool: 8.5 }));
}

// ---------- caseta de control y barrera ----------
function gatehouse(ctx, x, z, bx, bz, lean) {
  const { K, M } = ctx;
  ctx.add(K.box(3.4, 2.7, 3.8, M.ivoryPanel, x, Y, z));
  ctx.add(K.box(3.0, 0.95, 3.86, M.darkGlass, x, Y + 1.15, z));
  ctx.add(K.box(2.8, 0.12, 3.9, M.warmGlow, x, Y + 2.02, z));
  ctx.add(K.box(4.1, 0.2, 4.6, M.graphite, x, Y + 2.7, z));
  // barrera levantada (paso libre para el camión de recogida)
  ctx.add(K.box(0.32, 1.05, 0.32, M.darkSteel, bx, Y, bz));
  // la pluma gira sobre su centro: se desplaza para que su pie quede en el poste
  const tilt = lean * 0.12;
  const boom = K.box(0.11, 5.2, 0.11, M.ivory, 0, 0, 0);
  boom.position.set(bx, Y + 1.05 + 2.6 * Math.cos(tilt), bz + 2.6 * Math.sin(tilt));
  boom.rotation.x = tilt;
  ctx.add(boom);
  [1.1, 2.4, 3.7].forEach((y) => {
    const s = K.box(0.125, 0.4, 0.125, M.amberMatte, 0, 0, 0);
    s.position.set(bx, Y + 1.05 + y * Math.cos(tilt), bz + y * Math.sin(tilt));
    s.rotation.x = tilt;
    ctx.add(s);
  });
}

// ---------- muelle (embarcadero) ----------
function pier(ctx, xa, xb, z0, z1, lamps) {
  const { K, M } = ctx;
  const dir = Math.sign(xb - xa);
  const [p, q] = xa < xb ? [xa, xb] : [xb, xa];
  slab(ctx, M.concrete, p, q, z0, z1, Y, 0.6);
  slab(ctx, M.concreteLight, p, q, z0, z0 + 0.45, Y + 0.12, 0.2);
  slab(ctx, M.concreteLight, p, q, z1 - 0.45, z1, Y + 0.12, 0.2);
  const tip = xb - dir * 0.45;
  slab(ctx, M.concreteLight, Math.min(tip, xb), Math.max(tip, xb), z0 + 0.45, z1 - 0.45, Y + 0.12, 0.2);
  [0.35, 0.65, 0.95].forEach((t) => {
    const x = xa + (xb - xa) * t;
    [z0 + 0.8, z1 - 0.8].forEach((z) => {
      const h = r3(Y - 0.6 - BASE);
      const c = K.cyl(0.32, 0.32, h, M.concrete, 8);
      c.position.set(x, BASE + h / 2, z);
      ctx.add(c);
      const bol = K.cyl(0.15, 0.19, 0.45, M.darkSteel, 8);
      bol.position.set(x, Y + 0.12 + 0.225, z + (z < (z0 + z1) / 2 ? -0.55 : 0.55));
      ctx.add(bol);
    });
  });
  lamps.push({ x: xb - dir * 2.5, z: z0 + 0.25, y: Y + 0.12, dx: 0, dz: 1, py: Y + 0.03, pool: 8 });
}

export function buildEnvironment(ctx) {
  const { K, M } = ctx;
  // medidas de rendimiento (solo con ?debug&noentorno): el mundo sin el entorno
  if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search) && location.search.includes('noentorno')) return;
  const rnd = rng(20261023);
  const poolMat = new THREE.MeshBasicMaterial({
    map: radial('rgba(255,192,118,0.3)', 'rgba(255,170,90,0)'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  // farolas y árboles por zona: cada grupo instanciado cae entero en el fragmento de su isla más cercana (las farolas de
  // cada calzada, en el de la isla a la que llega; con el resto de su orilla, una de la calzada este entraba en el
  // fragmento de s6 y le añadía una luz del reciclaje) y se recorta con una esfera ajustada a su zona
  const lampsCW = [];
  const lampsCE = [];
  const lampsW = [];
  const lampsN = [];
  const lampsE = [];
  const treesW = [];
  const treesN = [];
  const treesE = [];
  let trees = treesW;
  // árboles de alineación: el doble de la escala de los del acantilado (≈ 6 m), sobre parterres o alcorques
  const tree = (x, z, y = SOIL, s = 1, kind = 'tree') => trees.push({ x, y, z, s: s * (kind === 'tree' ? 2 : 1.6), kind, r: rnd() * 6.28 });
  // alcorque: cuadro de tierra con canto claro, para los árboles sueltos de los patios
  const pit = (x, z, s = 1, kind = 'tree') => {
    ctx.add(K.box(1.6, 0.14, 1.6, M.concreteLight, x, Y, z));
    ctx.add(K.box(1.3, 0.14, 1.3, M.trunk, x, Y + 0.01, z));
    tree(x, z, Y + 0.15, s, kind);
  };
  const hw = ROAD_W / 2;

  // ---------- tierra firme ----------
  // Tres explanadas (oeste, norte y este de la bahía): su cara hacia el agua es el muro del muelle. Ninguna llega a
  // menos de 50 m de una luz de las islas.
  // Firme oscuro y mate (M.rubber): de noche la tierra firme se queda atrás y las islas, la ciudad y las farolas
  // mandan; una explanada de hormigón claro se leía como una pista bajo la luz principal.
  slab(ctx, M.rubber, -FAR, WEST, NORTH, FAR, Y, Y - BASE);
  slab(ctx, M.rubber, -FAR, FAR, -FAR, NORTH, Y, Y - BASE);
  slab(ctx, M.rubber, EAST, FAR, NORTH, FAR, Y, Y - BASE);
  // albardilla del muelle, interrumpida en las calzadas y en los embarcaderos
  const copeW = (z0, z1) => slab(ctx, M.concreteLight, WEST - 0.8, WEST, z0, z1, Y + 0.12, 0.2);
  const copeE = (z0, z1) => slab(ctx, M.concreteLight, EAST, EAST + 0.8, z0, z1, Y + 0.12, 0.2);
  const aw = ACCESS.west;
  const ae = ACCESS.east;
  copeW(NORTH, aw.rim.z - aw.width / 2);
  copeW(aw.rim.z + aw.width / 2, 72);
  copeW(78, 400);
  copeE(NORTH, ae.rim.z - ae.width / 2);
  copeE(ae.rim.z + ae.width / 2, 66);
  copeE(72, 400);
  slab(ctx, M.concreteLight, WEST - 0.8, EAST + 0.8, NORTH - 0.8, NORTH, Y + 0.12, 0.2);
  // bolardos de amarre en la albardilla, cerca del polígono
  for (let z = -40; z <= 110; z += 16) {
    [[WEST - 0.4, aw, 75], [EAST + 0.4, ae, 69]].forEach(([x, a, pz]) => {
      if (Math.abs(z - a.rim.z) < a.width / 2 + 1.5 || Math.abs(z - pz) < 4.5) return;
      const b = K.cyl(0.15, 0.19, 0.45, M.darkSteel, 8);
      b.position.set(x, Y + 0.12 + 0.225, z);
      ctx.add(b);
    });
  }

  // ---------- calzadas ----------
  causeway(ctx, aw, lampsCW);
  causeway(ctx, ae, lampsCE);

  // ---------- carreteras ----------
  const road = (x0, x1, z0, z1) => slab(ctx, M.panel, x0, x1, z0, z1, ROAD, 0.12);
  // eje discontinuo (3 m de marca cada 8 m) a lo largo de x o de z, saltando los cruces
  const dashes = (axis, c, a0, a1, skip = []) => {
    for (let s = a0 + 2; s + 3 < a1 - 2; s += 8) {
      if (skip.some(([p, q]) => s + 3 > p && s < q)) continue;
      if (axis === 'z') slab(ctx, M.ivory, c - 0.06, c + 0.06, s, s + 3, ROAD + MARK, 0.03);
      else slab(ctx, M.ivory, s, s + 3, c - 0.06, c + 0.06, ROAD + MARK, 0.03);
    }
  };
  // oeste: carretera de la orilla (de la ciudad hacia el sur) y ramal hasta la calzada
  road(MAIN_W - hw, MAIN_W + hw, -330, 400);
  road(MAIN_W + hw, WEST, aw.rim.z - hw, aw.rim.z + hw);
  dashes('z', MAIN_W, -330, 400, [[NORTH_Z - hw - 3, NORTH_Z + hw + 3], [aw.rim.z - hw - 3, aw.rim.z + hw + 3]]);
  dashes('x', aw.rim.z, MAIN_W + hw, WEST);
  // norte: carretera de la orilla norte, de la oeste a la este
  road(MAIN_W + hw, MAIN_E - hw, NORTH_Z - hw, NORTH_Z + hw);
  dashes('x', NORTH_Z, MAIN_W + hw, MAIN_E - hw);
  // este: carretera de la orilla y ramal desde la calzada
  road(MAIN_E - hw, MAIN_E + hw, NORTH_Z - hw, 400);
  road(EAST, MAIN_E - hw, ae.rim.z - hw, ae.rim.z + hw);
  dashes('z', MAIN_E, NORTH_Z + hw, 400, [[ae.rim.z - hw - 3, ae.rim.z + hw + 3], [ACCESS.factory.z + 17, ACCESS.factory.z + 37]]);
  dashes('x', ae.rim.z, EAST, MAIN_E - hw);

  // ---------- orilla oeste: acceso al polígono, aparcamiento, valla y arbolado ----------
  const FW = WEST - 17.5; // línea de la valla (x = -142,5)
  // aparcamiento junto a la calzada, dentro de la valla: pasillo central y dos filas en batería
  const pz0 = aw.rim.z + 6;
  const pz1 = pz0 + 36;
  road(FW + 1, WEST - 1.2, pz0, pz1);
  road(FW + 6.5, FW + 11.5, aw.rim.z + hw, pz0);
  const rowA = FW + 3.6; // centro de la fila oeste
  const rowB = WEST - 3.4; // centro de la fila este
  for (let k = 0; k <= 13; k++) {
    const z = pz0 + 1.2 + k * 2.6;
    slab(ctx, M.ivory, rowA - 2.4, rowA + 2.4, z - 0.05, z + 0.05, ROAD + MARK, 0.03);
    slab(ctx, M.ivory, rowB - 2.2, rowB + 2.2, z - 0.05, z + 0.05, ROAD + MARK, 0.03);
  }
  if (typeof makeParkedCar === 'function') {
    let n = 0;
    for (let k = 0; k < 13; k++) {
      const z = pz0 + 2.5 + k * 2.6;
      [[rowA, -Math.PI / 2], [rowB, Math.PI / 2]].forEach(([x, ry]) => {
        if (rnd() < 0.3) return;
        const car = makeParkedCar(M, { tint: Math.floor(rnd() * 6) });
        car.position.set(x + (rnd() - 0.5) * 0.3, ROAD, z + (rnd() - 0.5) * 0.25);
        car.rotation.y = ry + (rnd() - 0.5) * 0.06;
        ctx.add(car);
        ctx.shadows.push({ x: car.position.x, y: ROAD, z: car.position.z, w: 4.9, d: 2.2, r: 0 });
        n++;
      });
    }
  }
  // farolas del aparcamiento: junto a la valla y sobre la albardilla del muelle
  [pz0 + 6, pz0 + 24].forEach((z) => {
    lampsW.push({ x: FW + 0.5, z, y: Y, dx: 1, dz: 0, py: ROAD + 0.03, pool: 8 });
    lampsW.push({ x: WEST - 0.4, z: z + 9, y: Y + 0.12, dx: -1, dz: 0, py: ROAD + 0.03, pool: 8 });
  });
  // caseta de control y barrera en la entrada
  gatehouse(ctx, FW + 2.6, aw.rim.z - hw - 3.6, FW + 0.7, aw.rim.z - hw - 0.35, 1);
  lampsW.push({ x: FW + 5.5, z: aw.rim.z - hw - 0.6, y: Y, dx: 0, dz: 1, py: ROAD + 0.03, pool: 8 });
  // valla del polígono
  const gw0 = aw.rim.z - hw - 1;
  const gw1 = aw.rim.z + hw + 1;
  const fz0 = aw.rim.z - 40;
  const fz1 = pz1 + 4;
  buildFence(ctx, [[FW, fz0, FW, gw0], [FW, gw1, FW, fz1], [FW, fz1, WEST - 1.2, fz1], [FW, fz0, WEST - 1.2, fz0]]);
  // parterres y arbolado: arcén entre carretera y valla, arcén oeste de la carretera, patio norte
  slab(ctx, M.trunk, MAIN_W + hw + 0.3, FW - 0.6, fz0, gw0 - 0.4, SOIL, 0.2);
  slab(ctx, M.trunk, MAIN_W + hw + 0.3, FW - 0.6, gw1 + 0.4, fz1, SOIL, 0.2);
  for (let z = fz0 + 3; z < fz1; z += 7) if (z < gw0 - 2 || z > gw1 + 2) tree(MAIN_W + hw + 2, z + rnd() * 2, SOIL, 0.9 + rnd() * 0.35);
  slab(ctx, M.trunk, MAIN_W - hw - 6.2, MAIN_W - hw - 0.3, -205, 150, SOIL, 0.2);
  for (let z = -150; z < 100; z += 14) tree(MAIN_W - hw - 3.2 + (rnd() - 0.5), z + rnd() * 3, SOIL, 1.0 + rnd() * 0.4);
  // patio norte: dos hileras de árboles en alcorque
  for (let z = fz0 + 5; z < gw0 - 8; z += 7) [FW + 5, WEST - 5].forEach((x) => pit(x + (rnd() - 0.5), z + (rnd() - 0.5) * 1.5, 0.9 + rnd() * 0.3));
  // farolas de la carretera oeste (en el arcén este, con el brazo sobre la calzada)
  for (let z = -200; z <= 130; z += 30) {
    if (Math.abs(z - aw.rim.z) < 8) continue;
    lampsW.push({ x: MAIN_W + hw + 0.7, z, y: Y, dx: -1, dz: 0, py: ROAD + 0.03, pool: 8.5 });
  }
  pier(ctx, WEST, WEST + 15, 72, 78, lampsW);

  // ---------- orilla norte: carretera, farolas y arbolado frente a la ciudad ----------
  trees = treesN;
  slab(ctx, M.trunk, WEST + 5, EAST - 5, NORTH_Z + hw + 0.3, NORTH - 1.1, SOIL, 0.2);
  for (let x = WEST + 8; x < EAST - 6; x += 15) {
    tree(x + rnd() * 4, NORTH - 3.3 + (rnd() - 0.5), SOIL, 1.0 + rnd() * 0.45);
    if (rnd() < 0.6) tree(x + 7 + rnd() * 2, NORTH - 3.3, SOIL, 0.8 + rnd() * 0.3, 'shrub');
  }
  for (let x = WEST + 2; x < EAST; x += 34) lampsN.push({ x, z: NORTH_Z + hw + 0.9, y: Y, dx: 0, dz: -1, py: ROAD + 0.03, pool: 8.5 });

  // ---------- orilla este: salida del polígono, valla, arbolado y la fábrica ----------
  trees = treesE;
  const FE = EAST + 17; // línea de la valla (x = 122)
  const ge0 = ae.rim.z - hw - 1;
  const ge1 = ae.rim.z + hw + 1;
  const ez0 = ae.rim.z - 28;
  const ez1 = ae.rim.z + 28;
  buildFence(ctx, [[FE, ez0, FE, ge0], [FE, ge1, FE, ez1], [EAST + 1.2, ez1, FE, ez1], [EAST + 1.2, ez0, FE, ez0]]);
  gatehouse(ctx, FE - 3.2, ae.rim.z + hw + 3.8, FE - 0.8, ae.rim.z + hw + 0.35, -1);
  lampsE.push({ x: FE - 6, z: ae.rim.z + hw + 0.6, y: Y, dx: 0, dz: -1, py: ROAD + 0.03, pool: 8 });
  [[ez0 + 3, ge0 - 3], [ge1 + 8, ez1 - 2]].forEach(([z0, z1]) => {
    for (let z = z0 + 2; z < z1 - 1; z += 7) [EAST + 5, FE - 5].forEach((x) => pit(x + (rnd() - 0.5), z + (rnd() - 0.5) * 1.5, 0.9 + rnd() * 0.3));
  });
  const fz = ACCESS.factory.z;
  [[-205, fz - 25], [fz + 45, 150]].forEach(([z0, z1]) => {
    slab(ctx, M.trunk, MAIN_E + hw + 0.3, MAIN_E + hw + 6.3, z0, z1, SOIL, 0.2);
    for (let z = Math.max(z0, -150) + 4; z < Math.min(z1, 100) - 2; z += 14) tree(MAIN_E + hw + 3.3 + (rnd() - 0.5), z + rnd() * 3, SOIL, 1.0 + rnd() * 0.4);
  });
  for (let z = -200; z <= 130; z += 30) {
    if (Math.abs(z - ae.rim.z) < 8 || (z > fz + 10 && z < fz + 40)) continue;
    lampsE.push({ x: MAIN_E - hw - 0.7, z, y: Y, dx: 1, dz: 0, py: ROAD + 0.03, pool: 8.5 });
  }
  pier(ctx, EAST, EAST - 15, 66, 72, lampsE);
  buildFactory(ctx, lampsE, treesE, rnd);

  // ---------- ciudad al fondo ----------
  buildCity(ctx);

  // ---------- piezas instanciadas ----------
  [lampsCW, lampsCE, lampsW, lampsN, lampsE].forEach((list) => buildLamps(ctx, list, poolMat));
  [treesW, treesN, treesE].forEach((list) => list.length && ctx.add(K.scatterTrees(M, list)));
}
