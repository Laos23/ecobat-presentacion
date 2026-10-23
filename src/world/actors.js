import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as K from './kit.js';

// Actores del polígono: personas, camiones, carretillas, tractores de arrastre, palés, paquetes de batería de
// coche eléctrico, contenedores de almacenamiento estacionario, lingotes, big bags, coches aparcados y placas.
//
// Contrato común (v2):
// - Cada función devuelve un THREE.Group con el origen en el suelo (y = 0), el frente hacia +z y medidas en metros.
// - Solo se usan materiales de M (makeMaterials): ningún programa de sombreado nuevo. La única excepción son las
//   etiquetas (rombo de clase 9 y placa de alta tensión), que comparten un MeshBasicMaterial con un lienzo pequeño.
// - Rendimiento desde el principio: cada variante se construye una vez con piezas de bajo coste, se fusiona en una
//   malla por material y se guarda en caché (por juego de materiales y variante). Las siguientes llamadas devuelven
//   mallas nuevas que comparten la misma geometría: construir veinte personas cuesta lo mismo que una.
//   No hagáis dispose() de la geometría de un actor: la comparten todos los de su variante.
// - Estático (por defecto): bakeStatic lo fusiona con el resto de la estación. Con { dynamic: true } el grupo lleva
//   userData.dynamic = true (bakeStatic no lo toca) y ya va compactado: una malla por material y pieza móvil.
// - Piezas móviles expuestas en userData: forks (carretilla), doors y cargo (camión), carts y load (tractor).
//
// Presupuesto de triángulos (medido en tests/actors.test.mjs): persona ≤ 600, camión ≤ 3 000 con su carga,
// carretilla ≤ 1 500 con conductor (sin la carga), tractor con un remolque y su carga ≤ 1 500, BESS ≤ 1 500.

// ---------- Caché de variantes ----------
const variants = new WeakMap();

// Proyecta las UV en el espacio del objeto para los materiales con tesela (las texturas quedan a escala métrica
// también en los actores móviles; en los estáticos bakeStatic las vuelve a proyectar en mundo).
function tileUV(geom) {
  const pos = geom.attributes.position;
  const nor = geom.attributes.normal;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, pos.getX(i), pos.getZ(i));
    else if (ax >= az) uv.setXY(i, pos.getZ(i), pos.getY(i));
    else uv.setXY(i, pos.getX(i), pos.getY(i));
  }
}

// Fusiona las piezas de un grupo en una geometría por material (en el espacio del grupo).
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m4 = new THREE.Matrix4();
  const by = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
  });
  const out = [];
  by.forEach((list, material) => {
    const geometry = mergeGeometries(list);
    if (material.userData && material.userData.tile) tileUV(geometry);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    out.push({ geometry, material });
  });
  return out;
}

// Las piezas luminosas, el vidrio y las etiquetas no proyectan sombra.
const casts = (m) => !(m.isMeshBasicMaterial || m.transparent || (m.emissiveIntensity || 0) > 0.3 && m.emissive && m.emissive.getHex() !== 0);

function instantiate(list) {
  const g = new THREE.Group();
  for (const { geometry, material } of list) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = casts(material);
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

// Devuelve un grupo con la variante `key` (construida con `build()` la primera vez).
function variant(M, key, build) {
  let map = variants.get(M);
  if (!map) variants.set(M, (map = new Map()));
  if (!map.has(key)) map.set(key, mergeByMaterial(build()));
  return instantiate(map.get(key));
}

function finish(g, opts) {
  if (opts && opts.dynamic) g.userData.dynamic = true;
  return g;
}

// ---------- Piezas de construcción (temporales: se fusionan y se descartan) ----------
const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

function put(g, geom, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}

// Caja centrada en (x, y, z).
const bx = (g, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => put(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);

// Caja apoyada: `y` es la base. Cerrada a propósito: las sombras se dibujan con las caras traseras (main.js), y una
// caja sin cara inferior no taparía la luz que le llega desde arriba.
const ob = (g, mat, w, h, d, x, y, z, ry = 0) => put(g, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, 0, ry, 0);

// Barra de sección rectangular entre dos puntos.
function bar(g, mat, a, b, w, d = w) {
  _d.subVectors(b, a);
  const len = _d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.normalize());
  g.add(m);
  return m;
}

// Tramo cilíndrico de a (radio r1) a b (radio r2); `sz` aplasta la sección en z local (torso elíptico).
function seg(g, mat, a, b, r1, r2, sides = 6, sz = 1, open = true) {
  _d.subVectors(b, a);
  const len = _d.length();
  const geom = new THREE.CylinderGeometry(r2, r1, len, sides, 1, open);
  if (sz !== 1) geom.scale(1, 1, sz);
  const m = new THREE.Mesh(geom, mat);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.normalize());
  g.add(m);
  return m;
}

// Rueda con el eje en x.
function wheel(g, tire, hub, r, w, x, y, z, sides = 12) {
  put(g, new THREE.CylinderGeometry(r, r, w, sides), tire, x, y, z, 0, 0, Math.PI / 2);
  if (hub) put(g, new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.02, 8), hub, x + Math.sign(x || 1) * (w / 2 + 0.005), y, z, 0, 0, Math.PI / 2);
}

// Perfil lateral (puntos [z, y]) extruido a lo ancho en x, centrado en x0.
function ext(g, mat, pts, width, x0 = 0, bevel = 0) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = Math.max(0.001, width - bevel * 2);
  const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  // (z, y, extrusión) → (x, y, z) con giro propio (sin espejo: conserva el sentido de las caras)
  geom.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, depth / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  const m = new THREE.Mesh(geom, mat);
  m.position.x = x0;
  g.add(m);
  return m;
}

// ---------- Etiquetas: rombo de clase 9 y placa de alta tensión (un lienzo compartido) ----------
// Atlas 256 × 128: [0, 128] rombo de clase 9 (franjas negras arriba, «9» subrayado abajo); [128, 224] placa amarilla
// de alta tensión con triángulo, rayo y el texto. Un MeshBasicMaterial con recorte alfa (se fusiona con la estación).
const LABEL_TINT = '#cfcabf';
function drawLabels(c, text) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  // rombo de clase 9
  g.save();
  g.beginPath();
  g.moveTo(64, 2);
  g.lineTo(126, 64);
  g.lineTo(64, 126);
  g.lineTo(2, 64);
  g.closePath();
  g.fillStyle = '#f4f2ec';
  g.fill();
  g.clip();
  g.fillStyle = '#111';
  for (let i = 0; i < 7; i++) g.fillRect(22 + i * 12, 0, 6, 64);
  g.restore();
  g.lineWidth = 3;
  g.strokeStyle = '#111';
  g.beginPath();
  g.moveTo(64, 8);
  g.lineTo(120, 64);
  g.lineTo(64, 120);
  g.lineTo(8, 64);
  g.closePath();
  g.stroke();
  g.fillStyle = '#111';
  g.font = "700 30px 'Archivo Variable', Archivo, Arial, sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText('9', 64, 104);
  g.fillRect(54, 107, 20, 3);
  // placa de alta tensión (96 × 128)
  g.fillStyle = '#e8b53a';
  g.fillRect(130, 2, 92, 124);
  g.strokeStyle = '#111';
  g.lineWidth = 3;
  g.strokeRect(131.5, 3.5, 89, 121);
  g.beginPath();
  g.moveTo(176, 14);
  g.lineTo(212, 76);
  g.lineTo(140, 76);
  g.closePath();
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.stroke();
  g.beginPath();
  g.moveTo(180, 30);
  g.lineTo(166, 54);
  g.lineTo(178, 54);
  g.lineTo(170, 72);
  g.lineTo(188, 48);
  g.lineTo(176, 48);
  g.lineTo(186, 30);
  g.closePath();
  g.fillStyle = '#111';
  g.fill();
  const words = String(text).toUpperCase().split(/\s+/);
  const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words;
  g.font = "800 15px 'Archivo Variable', Archivo, Arial, sans-serif";
  lines.forEach((l, i) => {
    let size = 15;
    while (size > 8 && g.measureText(l).width > 84) g.font = `800 ${--size}px 'Archivo Variable', Archivo, Arial, sans-serif`;
    g.fillText(l, 176, 98 + i * 17);
  });
}

function labelMaterial(text = 'ALTA TENSIÓN') {
  return K.geo(`mat:actorLabels|${text}`, () => {
    if (typeof document === 'undefined') return new THREE.MeshBasicMaterial({ color: LABEL_TINT });
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    drawLabels(c, text);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    // con Archivo ya cargada se redibuja una vez (la primera pasada puede usar la tipografía de reserva)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
      drawLabels(c, text);
      map.needsUpdate = true;
    });
    return new THREE.MeshBasicMaterial({ map, color: LABEL_TINT, alphaTest: 0.5 });
  });
}

// Plano con una región del atlas (u0..u1 en píxeles de 256, v en 0..1), centrado.
function labelPlane(w, h, u0, u1) {
  const geom = new THREE.PlaneGeometry(w, h);
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (u0 + uv.getX(i) * (u1 - u0)) / 256);
  return geom;
}
const class9 = (g, size, x, y, z, ry = 0) => put(g, labelPlane(size, size, 0, 128), labelMaterial(), x, y, z, 0, ry, 0);

// ---------- Personas ----------
// Plano medio de maqueta: volúmenes sencillos (≈ 350–470 triángulos), sin rasgos faciales ni logotipos.
const POSES = {
  stand: { hipY: 0.93, pz: 0, lean: 0, tilt: 0.08,
    leg: (k) => [[k * 0.09, 0.93, 0], [k * 0.095, 0.5, 0.015], [k * 0.1, 0.085, 0]],
    arm: (k) => [[k * 0.04, -0.28, -0.01], [k * 0.01, -0.25, 0.05]] },
  walk: { hipY: 0.92, pz: 0, lean: 0.06, tilt: 0.05,
    leg: (k) => (k > 0 ? [[0.09, 0.92, 0.02], [0.09, 0.5, 0.13], [0.09, 0.085, 0.25]] : [[-0.09, 0.92, -0.02], [-0.09, 0.49, -0.07], [-0.09, 0.13, -0.26]]),
    arm: (k) => (k > 0 ? [[0.03, -0.27, -0.09], [0.01, -0.24, -0.05]] : [[-0.03, -0.27, 0.09], [-0.01, -0.22, 0.13]]) },
  work: { hipY: 0.92, pz: -0.05, lean: 0.42, tilt: 0.4,
    leg: (k) => [[k * 0.1, 0.92, -0.05], [k * 0.11, 0.5, -0.01], [k * 0.12, 0.085, -0.03]],
    arm: (k) => [[k * 0.03, -0.24, 0.1], [-k * 0.05, -0.18, 0.2]] },
  seated: { hipY: 0.5, pz: 0, lean: 0.06, tilt: 0.12,
    leg: (k) => [[k * 0.1, 0.5, 0], [k * 0.11, 0.53, 0.44], [k * 0.11, 0.085, 0.47]],
    arm: (k) => [[k * 0.04, -0.22, 0.14], [-k * 0.02, -0.04, 0.27]] },
  look: { hipY: 0.93, pz: 0, lean: -0.03, tilt: -0.3,
    leg: (k) => [[k * 0.09, 0.93, 0], [k * 0.105, 0.5, 0.01], [k * 0.12, 0.085, 0]],
    arm: (k) => [[k * 0.03, -0.26, -0.09], [-k * 0.12, -0.15, -0.05]] },
};

function roleSpec(M, role, variantIdx) {
  const v = variantIdx | 0;
  const tops = [M.ivoryPanel, M.amberMatte, M.panel, M.ivory];
  const bottoms = [M.graphite, M.panel, M.graphite, M.trunk];
  const base = { top: M.graphite, legs: M.panel, shoes: M.grip, hands: M.wood };
  switch (role) {
    case 'muelle':
    case 'carretillero':
      return { ...base, vest: true, hands: M.grip, shoes: M.rubber };
    case 'conductor':
      return { ...base, top: M.panel, legs: M.graphite, vest: true };
    case 'laboratorio':
      return { ...base, top: M.ivoryPanel, coat: true, glasses: true, hands: M.grip };
    case 'reutilizacion':
      return { ...base, apron: true, glasses: true, hands: M.grip };
    case 'altaTension':
      return { ...base, top: M.panel, legs: M.panel, glasses: true, hands: M.amberMatte, cuffs: true, band: true, shoes: M.rubber };
    case 'especialista':
      return { ...base, hands: M.amberMatte, cuffs: true };
    case 'planta':
      return { ...base, vest: true, helmet: true, hands: M.grip, shoes: M.rubber };
    case 'horno':
      return { ...base, top: M.steel, legs: M.steel, hood: true, hands: M.steel, shoes: M.rubber };
    case 'visitante':
    default:
      return { ...base, top: tops[v % tops.length], legs: bottoms[v % bottoms.length] };
  }
}

function buildPerson(M, role, poseName, variantIdx) {
  const g = new THREE.Group();
  const P = POSES[poseName] || POSES.stand;
  const S = roleSpec(M, role, variantIdx);
  const skin = M.wood;
  const piv = new THREE.Vector3(0, P.hipY, P.pz);
  const rot = (l) => (x, y, z) => new THREE.Vector3(x, y * Math.cos(l) - z * Math.sin(l), y * Math.sin(l) + z * Math.cos(l));
  const R = rot(P.lean);
  const at = (x, y, z) => R(x, y, z).add(piv);
  const V = (a) => new THREE.Vector3(...a);
  const torsoR = (t) => 0.15 + 0.04 * Math.max(0, Math.min(1, (t - 0.06) / 0.44));

  // piernas y calzado
  [1, -1].forEach((k) => {
    const [h, kn, an] = P.leg(k).map(V);
    seg(g, S.legs, h, kn, 0.078, 0.062);
    seg(g, S.legs, kn, an, 0.058, 0.045);
    const raised = an.y > 0.1;
    const a = raised ? 0.45 : 0;
    const sh = 0.08;
    const sd = 0.25;
    const cy = (sh / 2) * Math.cos(a) + (sd / 2) * Math.sin(a) + (raised ? 0 : 0);
    bx(g, S.shoes, 0.105, sh, sd, an.x, raised ? cy : sh / 2, an.z + (raised ? 0.02 : 0.045), a);
  });
  // pelvis y torso (sección elíptica)
  seg(g, S.coat ? S.top : S.legs, at(0, -0.07, 0), at(0, 0.1, 0), 0.152, 0.155, 8, 0.68);
  seg(g, S.top, at(0, 0.06, 0), at(0, 0.5, 0), torsoR(0.06), torsoR(0.5), 8, 0.6);
  // hombros caídos hacia el cuello (sin la tapa plana del cilindro)
  seg(g, S.top, at(0, 0.5, 0), at(0, 0.555, 0), torsoR(0.5), 0.07, 8, 0.62);
  // cuello y cabeza
  const neck = at(0, 0.58, 0);
  seg(g, skin, at(0, 0.48, 0), neck, 0.046, 0.044, 5);
  const HL = P.lean + P.tilt;
  const RH = rot(HL);
  const headC = RH(0, 0.1, 0.012).add(neck);
  const up = RH(0, 1, 0);
  const fwd = RH(0, 0, 1);
  const head = put(g, new THREE.IcosahedronGeometry(0.1, 1).scale(0.92, 1.12, 1), skin, headC.x, headC.y, headC.z, HL);
  head.updateMatrix();
  if (S.hood) {
    // traje aluminizado: capucha que cubre la cabeza, esclavina sobre los hombros y pantalla facial
    put(g, new THREE.IcosahedronGeometry(0.118, 1).scale(0.98, 1.08, 1.02), M.steel, headC.x, headC.y + 0.005, headC.z - 0.004, HL);
    seg(g, M.steel, at(0, 0.52, 0), at(0, 0.36, 0), 0.09, 0.205, 8, 0.66);
    const vz = headC.clone().addScaledVector(fwd, 0.112).addScaledVector(up, -0.005);
    bx(g, M.glass, 0.17, 0.13, 0.012, vz.x, vz.y, vz.z, HL);
  } else if (S.helmet) {
    const hc = headC.clone().addScaledVector(up, 0.035);
    put(g, new THREE.SphereGeometry(0.122, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), M.ivory, hc.x, hc.y, hc.z, HL);
    put(g, new THREE.CylinderGeometry(0.145, 0.145, 0.014, 8), M.ivory, hc.x, hc.y, hc.z + 0.012, HL);
  } else {
    // pelo: casquete inclinado hacia la nuca (deja libre la cara)
    // casquete que envuelve la cabeza sin cortarla (sin manchas): nacimiento del pelo en la frente, nuca cubierta
    put(g, new THREE.SphereGeometry(0.115, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.485).scale(0.95, 1.05, 1.0), M.trunk, headC.x, headC.y + 0.004, headC.z, HL - 0.655);
    if (variantIdx % 2 === 1) {
      const bun = headC.clone().addScaledVector(up, 0.02).addScaledVector(fwd, -0.105);
      put(g, new THREE.IcosahedronGeometry(0.045, 0), M.trunk, bun.x, bun.y, bun.z);
    }
  }
  if (S.glasses) {
    // gafas de protección: cinta elástica por detrás (lo que se ve de espaldas) y ocular transparente delante
    const eye = headC.clone().addScaledVector(up, 0.012);
    put(g, new THREE.CylinderGeometry(0.104, 0.104, 0.022, 8, 1, true, Math.PI * 0.55, Math.PI * 0.9).scale(1, 1, 1.04), M.grip, eye.x, eye.y, eye.z, HL);
    const lens = eye.clone().addScaledVector(fwd, 0.098);
    // montura opaca (sin vidrio transparente: no añade llamadas ordenadas por profundidad)
    [-1, 1].forEach((k) => {
      bx(g, M.grip, 0.15, 0.01, 0.022, lens.x, lens.y + k * 0.024, lens.z, HL);
      bx(g, M.grip, 0.012, 0.05, 0.03, lens.x + k * 0.078, lens.y, lens.z - 0.008, HL);
    });
  }
  // brazos
  [1, -1].forEach((k) => {
    const [eo, wo] = P.arm(k).map(V);
    const s = at(k * 0.2, 0.46, 0);
    const e = s.clone().add(eo);
    const w = e.clone().add(wo);
    seg(g, S.top, s, e, 0.052, 0.043);
    seg(g, S.top, e, w, 0.042, 0.035);
    const dir = w.clone().sub(e).normalize();
    const hand = w.clone().addScaledVector(dir, 0.055);
    put(g, new THREE.IcosahedronGeometry(0.045, 0).scale(0.78, 1.15, 0.9), S.hands, hand.x, hand.y, hand.z);
    if (S.cuffs) seg(g, S.hands, w.clone().addScaledVector(dir, -0.12), w.clone().addScaledVector(dir, 0.01), 0.047, 0.044, 6);
  });
  // prendas
  if (S.vest) {
    seg(g, M.limeLine, at(0, 0.08, 0), at(0, 0.44, 0), torsoR(0.08) + 0.016, torsoR(0.44) + 0.016, 8, 0.6);
    [0.19, 0.31].forEach((t) => seg(g, M.stoneTop, at(0, t - 0.018, 0), at(0, t + 0.018, 0), torsoR(t) + 0.024, torsoR(t) + 0.024, 8, 0.6));
  }
  if (S.band) seg(g, M.stoneTop, at(0, 0.3, 0), at(0, 0.335, 0), torsoR(0.31) + 0.01, torsoR(0.32) + 0.01, 8, 0.6);
  if (S.coat && poseName !== 'seated') {
    // faldón de la bata hasta la rodilla (cuelga en vertical aunque el torso se incline)
    // (inclinado sobre el banco, arranca en la cadera y cuelga recto)
    const top = P.lean > 0.2 ? new THREE.Vector3(0, P.hipY + 0.1, piv.z + 0.02) : at(0, 0.2, 0);
    seg(g, M.ivoryPanel, top, new THREE.Vector3(0, P.hipY - 0.42, top.z - 0.02), P.lean > 0.2 ? 0.175 : torsoR(0.2) + 0.004, 0.2, 8, 0.66);
  }
  if (S.apron) {
    const a0 = at(0, 0.42, 0.105);
    const a1 = at(0, 0.02, 0.112);
    bar(g, M.ivory, a0, a1, 0.3, 0.012);
    if (poseName !== 'seated') bar(g, M.ivory, a1, new THREE.Vector3(0, P.hipY - 0.36, a1.z + 0.02), 0.32, 0.012);
  }
  return g;
}

export function makePerson(M, { role = 'visitante', pose = 'stand', variant: v = 0, dynamic = false } = {}) {
  const g = variant(M, `person|${role}|${pose}|${v}`, () => buildPerson(M, role, pose, v));
  g.userData.role = role;
  return finish(g, { dynamic });
}

// ---------- Baterías de plomo y módulos ----------
// Batería de arranque 0,28 × 0,19 × 0,175 m; las tapas de los bornes son pirámides de 4 caras (4 triángulos).
const LEAD = { w: 0.28, h: 0.19, d: 0.175 };
const capGeom = () => new THREE.ConeGeometry(0.03, 0.035, 4, 1, true).rotateY(Math.PI / 4);

// Capa superior de un palé de plomo: bloque de baterías con las juntas marcadas, tapas en cada borne.
function leadTop(g, M, nx, nz, y, caps = true) {
  const W = nx * LEAD.w;
  const D = nz * LEAD.d;
  ob(g, M.casing, W, LEAD.h, D, 0, y, 0);
  // juntas entre baterías (líneas oscuras sobre la tapa)
  for (let i = 1; i < nx; i++) bx(g, M.grip, 0.012, 0.004, D, -W / 2 + i * LEAD.w, y + LEAD.h + 0.002, 0);
  for (let j = 1; j < nz; j++) bx(g, M.grip, W, 0.004, 0.012, 0, y + LEAD.h + 0.002, -D / 2 + j * LEAD.d);
  if (!caps) return;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const cx = -W / 2 + (i + 0.5) * LEAD.w;
      const cz = -D / 2 + (j + 0.5) * LEAD.d;
      [-0.09, 0.09].forEach((dx) => put(g, capGeom(), M.grip, cx + dx, y + LEAD.h + 0.0175, cz + 0.045));
    }
  }
}

// Palé europeo 1,2 × 0,8 m (x × z), 0,144 m de alto.
function palletBase(g, M, w = 1.2, d = 0.8) {
  ob(g, M.wood, w, 0.022, d, 0, 0.122, 0);
  // tacos corridos a lo largo de z: las horquillas entran por el frente entre ellos
  [-1, 0, 1].forEach((k) => ob(g, M.wood, 0.1, 0.1, d, k * (w / 2 - 0.05), 0.022, 0));
  ob(g, M.wood, w, 0.022, d * 0.9, 0, 0, 0);
  return 0.144;
}

// Fleje: cinta que abraza la carga (se ve arriba y en los costados).
function straps(g, mat, w, h, d, y, along = 'z', n = 2) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    if (along === 'z') ob(g, mat, 0.03, h + 0.006, d + 0.012, t * w * 0.8, y, 0);
    else ob(g, mat, w + 0.012, h + 0.006, 0.03, 0, y, t * d * 0.8);
  }
}

function buildLeadPallet(M, layers, detail) {
  const g = new THREE.Group();
  let y = palletBase(g, M);
  const nx = 4;
  const nz = 4;
  const W = nx * LEAD.w;
  const D = nz * LEAD.d;
  const y0 = y;
  for (let l = 0; l < layers - 1; l++) {
    ob(g, M.casing, W, LEAD.h, D, 0, y, 0);
    y += LEAD.h;
    ob(g, M.ivory, W + 0.02, 0.008, D + 0.02, 0, y, 0);
    y += 0.008;
  }
  leadTop(g, M, nx, nz, y, detail !== 'low');
  y += LEAD.h;
  straps(g, M.ivory, W, y - y0, D, y0, 'z');
  return g;
}

// Módulo de litio 0,6 × 0,15 × 0,35 m (x × y × z): carcasa de aluminio, tapa, placas de extremo y bornes.
function moduleParts(g, M, x, y, z, { capped = false, full = true } = {}) {
  ob(g, M.steel, 0.6, 0.13, 0.35, x, y, z);
  ob(g, M.casing, 0.56, 0.02, 0.31, x, y + 0.13, z);
  if (full) [-1, 1].forEach((k) => ob(g, M.darkSteel, 0.02, 0.14, 0.352, x + k * 0.3, y, z));
  [-0.2, 0.2].forEach((dx) => {
    if (capped) put(g, capGeom(), M.grip, x + dx, y + 0.15 + 0.0175, z + 0.08);
    else ob(g, M.terminal, 0.05, 0.025, 0.05, x + dx, y + 0.15, z + 0.08);
  });
  if (full) ob(g, M.amberMatte, 0.08, 0.03, 0.05, x, y + 0.15, z - 0.09);
}

function buildModulePallet(M, count) {
  const g = new THREE.Group();
  const y0 = palletBase(g, M);
  let y = y0;
  const per = 4;
  const layers = Math.max(1, Math.ceil(count / per));
  let n = 0;
  for (let l = 0; l < layers; l++) {
    for (let i = 0; i < per && n < count; i++, n++) moduleParts(g, M, (i % 2 ? 0.3 : -0.3), y, (i < 2 ? -0.18 : 0.18), { capped: true, full: false });
    y += 0.15 + (l < layers - 1 ? 0.012 : 0);
    if (l < layers - 1) ob(g, M.ivory, 1.2, 0.01, 0.72, 0, y - 0.012, 0);
  }
  straps(g, M.ivory, 1.2, y - y0, 0.72, y0, 'x');
  return g;
}

// ---------- Lingotes y granza ----------
// Lingote de plomo (0,5 × 0,075 × 0,125 m, sección trapezoidal: 12 triángulos).
function ingotGeometry() {
  const g = new THREE.BoxGeometry(0.5, 0.075, 0.125);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setZ(i, p.getZ(i) * 0.76); p.setX(i, p.getX(i) * 0.96); }
  g.computeVertexNormals();
  return g;
}

// Pilas cuadradas de 0,5 m: `cols` lingotes por capa, capas cruzadas; `rows` pilas en fila a lo largo de x.
function ingotStacks(g, M, rows, cols, layers, y0 = 0) {
  const pitch = 0.56;
  const LH = 0.075;
  const cw = 0.5 / cols;
  for (let r = 0; r < rows; r++) {
    const sx = (r - (rows - 1) / 2) * pitch;
    for (let l = 0; l < layers; l++) {
      for (let c = 0; c < cols; c++) {
        const o = -0.25 + (c + 0.5) * cw;
        if (l % 2 === 0) put(g, ingotGeometry(), M.lead, sx, y0 + l * LH + LH / 2, o);
        else put(g, ingotGeometry(), M.lead, sx + o, y0 + l * LH + LH / 2, 0, 0, Math.PI / 2, 0);
      }
    }
    [-0.12, 0.12].forEach((dz) => ob(g, M.darkSteel, 0.512, layers * LH + 0.004, 0.025, sx, y0, dz));
  }
}

function buildPelletBag(M) {
  const g = new THREE.Group();
  // cuerpo abombado: caja subdividida con las caras empujadas hacia fuera (48 triángulos)
  const geom = new THREE.BoxGeometry(0.9, 0.95, 0.9, 2, 2, 2);
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.45;
    const y = p.getY(i) / 0.475;
    const z = p.getZ(i) / 0.45;
    const bulge = 1 + 0.07 * (1 - Math.abs(y)) * (1 - Math.min(1, Math.abs(x) * Math.abs(z)));
    p.setXYZ(i, p.getX(i) * bulge, p.getY(i) * (y > 0 ? 1 - 0.04 * (1 - Math.max(Math.abs(x), Math.abs(z))) : 1), p.getZ(i) * bulge);
  }
  geom.computeVertexNormals();
  put(g, geom, M.ivoryPanel, 0, 0.475, 0);
  // asas de elevación en las esquinas y boca de llenado atada
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    bar(g, M.ivory, new THREE.Vector3(sx * 0.41, 0.9, sz * 0.41), new THREE.Vector3(sx * 0.37, 1.1, sz * 0.37), 0.06, 0.012);
  });
  put(g, new THREE.CylinderGeometry(0.1, 0.13, 0.12, 6, 1, false), M.ivory, 0, 1.0, 0);
  return g;
}

// ---------- Palés ----------
// kind: 'plomo' (count = capas de baterías, por defecto 2) | 'modulos' (count = módulos, por defecto 8) |
// 'lingotes' (count = capas de lingotes, por defecto 4) | 'granza' (un big bag). detail: 'low' quita las tapas
// de los bornes (palés del fondo de un camión).
export function makePallet(M, { kind = 'plomo', count, detail = 'high', dynamic = false } = {}) {
  let g;
  if (kind === 'modulos') g = variant(M, `pallet|modulos|${count ?? 8}`, () => buildModulePallet(M, count ?? 8));
  else if (kind === 'lingotes') {
    g = variant(M, `pallet|lingotes|${count ?? 4}`, () => {
      const b = new THREE.Group();
      const y = palletBase(b, M);
      ingotStacks(b, M, 2, 4, count ?? 4, y);
      return b;
    });
  } else if (kind === 'granza') {
    g = variant(M, 'pallet|granza', () => {
      const b = new THREE.Group();
      const y = palletBase(b, M, 1.2, 1.0);
      const bag = buildPelletBag(M);
      bag.position.y = y;
      b.add(bag);
      return b;
    });
  } else g = variant(M, `pallet|plomo|${count ?? 2}|${detail}`, () => buildLeadPallet(M, Math.max(1, count ?? 2), detail));
  g.userData.kind = kind;
  return finish(g, { dynamic });
}

export function makeModule(M, { dynamic = false } = {}) {
  return finish(variant(M, 'module', () => {
    const g = new THREE.Group();
    moduleParts(g, M, 0, 0, 0);
    return g;
  }), { dynamic });
}

export function makeIngotStack(M, { rows = 3, cols = 4, layers = 4, dynamic = false } = {}) {
  return finish(variant(M, `ingots|${rows}|${cols}|${layers}`, () => {
    const g = new THREE.Group();
    ingotStacks(g, M, rows, cols, layers);
    return g;
  }), { dynamic });
}

export function makePelletBag(M, { dynamic = false } = {}) {
  return finish(variant(M, 'pelletBag', () => buildPelletBag(M)), { dynamic });
}

// ---------- Paquete de batería de coche eléctrico ----------
// 2,2 m de largo (z) × 1,5 m de ancho (x) × 0,3 m de alto. 12 módulos en 6 filas × 2 columnas; `modulesOut` vacía
// las primeras posiciones desde el frente (+z). Cerrado: tapa con nervios; abierto: sin tapa.
function buildEVPack(M, open, modulesOut) {
  const g = new THREE.Group();
  const W = 1.5;
  const L = 2.2;
  ob(g, M.darkSteel, W, 0.05, L, 0, 0, 0);
  [-1, 1].forEach((k) => {
    ob(g, M.darkSteel, 0.04, 0.25, L, k * (W / 2 - 0.02), 0.03, 0);
    ob(g, M.darkSteel, W - 0.08, 0.25, 0.04, 0, 0.03, k * (L / 2 - 0.02));
    // pestañas de anclaje al chasis
    [-0.7, 0, 0.7].forEach((z) => ob(g, M.darkSteel, 0.08, 0.02, 0.12, k * (W / 2 + 0.03), 0.08, z));
  });
  // caja de control (BMS) y conector naranja de alta tensión en el frente
  ob(g, M.panel, 0.5, 0.12, 0.08, 0, 0.06, L / 2 + 0.04);
  ob(g, M.amberMatte, 0.14, 0.08, 0.06, 0.38, 0.08, L / 2 + 0.03);
  if (!open) {
    ob(g, M.casing, W + 0.02, 0.025, L + 0.02, 0, 0.28, 0);
    for (let i = -2; i <= 2; i++) ob(g, M.casing, W - 0.2, 0.012, 0.06, 0, 0.305, i * 0.38);
    return g;
  }
  ob(g, M.darkSteel, 0.03, 0.12, L - 0.1, 0, 0.05, 0);
  let n = 0;
  for (let r = 0; r < 6; r++) {
    const z = L / 2 - 0.2 - r * 0.36;
    [-0.33, 0.33].forEach((x) => {
      if (n++ >= modulesOut) moduleParts(g, M, x, 0.05, z, { full: false });
    });
  }
  // cables naranjas de alta tensión a lo largo de los módulos
  [-0.66, 0.66].forEach((x) => ob(g, M.amberMatte, 0.035, 0.035, L - 0.3, x, 0.2, 0));
  return g;
}

export function makeEVPack(M, { open = false, modulesOut = 0, dynamic = false } = {}) {
  const out = open ? Math.max(0, Math.min(12, modulesOut | 0)) : 0;
  return finish(variant(M, `evpack|${open}|${out}`, () => buildEVPack(M, open, out)), { dynamic });
}

// Embalaje de transporte del paquete: caja de madera sobre patines, flejes, cantoneras y el rombo de clase 9
// en los cuatro costados (sin otras marcas). 1,7 (x) × 0,66 (y) × 2,4 (z) m.
function buildEVCrate(M) {
  const g = new THREE.Group();
  const W = 1.7;
  const L = 2.4;
  // patines a lo ancho (x): girado 90° en la carretilla, las horquillas entran entre ellos
  [-0.95, 0, 0.95].forEach((z) => ob(g, M.wood, W, 0.1, 0.12, 0, 0, z));
  ob(g, M.wood, W, 0.56, L, 0, 0.1, 0);
  // listones de refuerzo y cantoneras
  [-1, 1].forEach((k) => {
    [-0.8, 0, 0.8].forEach((z) => ob(g, M.wood, 0.03, 0.56, 0.1, k * (W / 2 + 0.015), 0.1, z));
    ob(g, M.wood, W + 0.06, 0.03, 0.1, 0, 0.66, k * 0.8);
    [-1, 1].forEach((j) => ob(g, M.darkSteel, 0.06, 0.58, 0.06, k * (W / 2 - 0.02), 0.1, j * (L / 2 - 0.02)));
  });
  [-0.5, 0.5].forEach((z) => ob(g, M.darkSteel, W + 0.02, 0.57, 0.035, 0, 0.1, z));
  const s = 0.3;
  [-1, 1].forEach((k) => {
    class9(g, s, k * (W / 2 + 0.034), 0.4, 0.4, k * Math.PI / 2);
    class9(g, s, -0.4, 0.4, k * (L / 2 + 0.002), k > 0 ? 0 : Math.PI);
  });
  return g;
}

export function makeEVCrate(M, { dynamic = false } = {}) {
  return finish(variant(M, 'evcrate', () => buildEVCrate(M)), { dynamic });
}

// ---------- Camiones ----------
const TRUCK = {
  big: { L: 8.5, W: 2.5, H: 3.6, cabL: 2.25, cabH: 3.0, cabW: 2.36, r: 0.5, tw: 0.3, fz: 2.85, rz: -2.0, deckY: 1.15, chY: 0.78 },
  ligero: { L: 6.0, W: 2.2, H: 2.8, cabL: 1.75, cabH: 2.45, cabW: 2.06, r: 0.38, tw: 0.24, fz: 1.85, rz: -1.35, deckY: 0.92, chY: 0.6 },
};

function truckSpec(kind) {
  const s = kind === 'ligero' ? TRUCK.ligero : TRUCK.big;
  const zf = s.L / 2;
  const zb = zf - s.cabL;
  return { ...s, zf, zb, boxF: zb - 0.12, boxB: -s.L / 2, box: kind !== 'lingotes' };
}

function buildTruckBody(M, kind) {
  const g = new THREE.Group();
  const s = truckSpec(kind);
  const { L, W, H, cabH, cabW, r, tw, fz, rz, deckY, chY, zf, zb } = s;
  const yb = 2 * r + 0.05;
  const hh = cabH - yb;
  // cabina: perfil lateral extruido con bisel
  const prof = [[zb, yb], [zf - 0.05, yb], [zf - 0.05, yb + 0.41 * hh], [zf - 0.13, yb + 0.49 * hh], [zf - 0.32, yb + 0.93 * hh], [zf - 0.47, cabH - 0.05], [zb, cabH - 0.05]];
  ext(g, M.paint, prof, cabW, 0, 0.05);
  // parabrisas
  const p3 = new THREE.Vector3(0, yb + 0.49 * hh, zf - 0.13);
  const p4 = new THREE.Vector3(0, yb + 0.93 * hh, zf - 0.32);
  const ws = bar(g, M.darkGlass, p3, p4, cabW - 0.16, 0.02);
  const n = new THREE.Vector3(0, p4.z - p3.z, -(p4.y - p3.y)).normalize().multiplyScalar(-0.055);
  ws.position.add(n);
  // ventanillas laterales
  const wz0 = zb + s.cabL * 0.45;
  const wz1 = zf - 0.36;
  [-1, 1].forEach((k) => bx(g, M.darkGlass, 0.02, hh * 0.36, wz1 - wz0, k * (cabW / 2 + 0.05), yb + hh * 0.7, (wz0 + wz1) / 2));
  // frente: bloque bajo, parrilla, faros, intermitentes y paragolpes
  const fb = fz + r + 0.08;
  bx(g, M.paint, cabW, yb - 0.45, zf - fb, 0, (yb + 0.45) / 2, (zf + fb) / 2);
  bx(g, M.darkSteel, cabW * 0.62, hh * 0.28, 0.03, 0, yb + hh * 0.2, zf + 0.012);
  [-1, 1].forEach((k) => {
    bx(g, M.warmGlow, 0.3, 0.13, 0.03, k * (cabW / 2 - 0.28), yb - 0.1, zf + 0.01);
    bx(g, M.amberGlow, 0.1, 0.08, 0.03, k * (cabW / 2 - 0.06), yb - 0.1, zf + 0.01);
  });
  bx(g, M.darkSteel, cabW + 0.06, 0.28, 0.22, 0, 0.6, zf - 0.04);
  // retrovisores y estribos
  [-1, 1].forEach((k) => {
    bx(g, M.darkSteel, 0.3, 0.04, 0.04, k * (cabW / 2 + 0.18), yb + hh * 0.72, zf - 0.55);
    bx(g, M.paint, 0.07, 0.36, 0.16, k * (cabW / 2 + 0.34), yb + hh * 0.62, zf - 0.55);
    bx(g, M.darkSteel, 0.3, 0.05, 0.4, k * (cabW / 2 - 0.1), yb - 0.32, zb + 0.35);
    bx(g, M.darkSteel, 0.3, 0.05, 0.4, k * (cabW / 2 - 0.1), yb - 0.62, zb + 0.35);
  });
  // deflector sobre la cabina (cajas más altas que ella)
  if (s.box && H > cabH + 0.2) ext(g, M.paint, [[zb + 0.02, cabH - 0.06], [zb + 1.5, cabH - 0.06], [zb + 0.02, H - 0.05]], cabW - 0.2);
  // chasis, depósito y calderín
  [-0.45, 0.45].forEach((x) => bx(g, M.darkSteel, 0.12, 0.24, L - 0.6, x, chY, -0.1));
  put(g, new THREE.CylinderGeometry(0.26, 0.26, 0.9, 8), M.steel, -(W / 2 - 0.42), chY - 0.06, fz - r - 0.75, Math.PI / 2);
  bx(g, M.darkSteel, 0.5, 0.45, 0.6, W / 2 - 0.42, chY - 0.06, fz - r - 0.7);
  // ruedas: delanteras sencillas, traseras gemelas (una pieza ancha)
  [-1, 1].forEach((k) => {
    wheel(g, M.rubber, M.steel, r, tw, k * (cabW / 2 - 0.18), r, fz);
    wheel(g, M.rubber, M.steel, r, tw * 1.85, k * (W / 2 - 0.33), r, rz);
    // guardabarros y faldilla traseros
    bx(g, M.darkSteel, tw * 1.85 + 0.08, 0.04, 2 * r + 0.2, k * (W / 2 - 0.33), 2 * r + 0.06, rz);
    bx(g, M.rubber, tw * 1.85, 0.42, 0.02, k * (W / 2 - 0.33), r * 0.9, rz - r - 0.12);
    // protección lateral entre ejes
    [0.48, 0.78].forEach((y) => bx(g, M.darkSteel, 0.04, 0.07, fz - rz - 2 * r - 0.5, k * (W / 2 - 0.06), y * (r / 0.5), (fz + rz) / 2 - 0.05));
  });
  // trasera: paragolpes antiempotramiento y pilotos
  bx(g, M.darkSteel, W - 0.3, 0.12, 0.1, 0, 0.5, s.boxB + 0.2);
  [-1, 1].forEach((k) => {
    bar(g, M.darkSteel, new THREE.Vector3(k * 0.5, 0.5, s.boxB + 0.2), new THREE.Vector3(k * 0.45, deckY - 0.05, s.boxB + 0.3), 0.07);
    bx(g, M.amberGlow, 0.32, 0.1, 0.03, k * (W / 2 - 0.25), deckY - 0.17, s.boxB - 0.005);
  });
  if (s.box) {
    // caja cerrada: suelo, techo, laterales y frontal (hueca para ver la carga con las puertas abiertas)
    const len = s.boxF - s.boxB;
    const zc = (s.boxF + s.boxB) / 2;
    const bodyMat = kind === 'expedicion' ? M.panel : M.ivoryPanel;
    ob(g, M.darkSteel, W, 0.08, len, 0, deckY - 0.08, zc);
    ob(g, M.wood, W - 0.1, 0.02, len - 0.05, 0, deckY, zc);
    [-1, 1].forEach((k) => ob(g, bodyMat, 0.05, H - deckY, len, k * (W / 2 - 0.025), deckY, zc));
    ob(g, bodyMat, W, 0.05, len, 0, H - 0.05, zc);
    ob(g, bodyMat, W - 0.1, H - deckY - 0.05, 0.05, 0, deckY, s.boxF - 0.025);
    // perfiles de aluminio: cantos superiores e inferiores y marco trasero
    [-1, 1].forEach((k) => {
      bx(g, M.darkSteel, 0.06, 0.1, len, k * (W / 2 + 0.005), H - 0.05, zc);
      bx(g, M.darkSteel, 0.06, 0.12, len, k * (W / 2 + 0.005), deckY + 0.02, zc);
      bx(g, M.darkSteel, 0.1, H - deckY, 0.1, k * (W / 2 - 0.02), (H + deckY) / 2, s.boxB + 0.03);
      bx(g, M.darkSteel, 0.1, H - deckY, 0.08, k * (W / 2 - 0.02), (H + deckY) / 2, s.boxF);
      // luces de gálibo
      for (let i = 0; i < 3; i++) bx(g, M.amberGlow, 0.02, 0.05, 0.1, k * (W / 2 + 0.04), deckY + 0.02, s.boxB + 0.6 + i * ((len - 1.2) / 2));
    });
    bx(g, M.darkSteel, W, 0.14, 0.1, 0, H - 0.07, s.boxB + 0.03);
    bx(g, M.darkSteel, W, 0.1, 0.12, 0, deckY - 0.03, s.boxB + 0.04);
    if (kind === 'expedicion') [-1, 1].forEach((k) => bx(g, M.limeLine, 0.012, 0.07, len - 0.6, k * (W / 2 + 0.003), deckY + (H - deckY) * 0.36, zc));
    if (kind === 'ligero') [-1, 1].forEach((k) => class9(g, 0.4, k * (W / 2 + 0.004), deckY + (H - deckY) * 0.55, s.boxB + 0.8, k * Math.PI / 2));
  } else {
    // plataforma: largueros, tablero de madera, cabecero y teleros
    const len = s.boxF - s.boxB;
    const zc = (s.boxF + s.boxB) / 2;
    ob(g, M.darkSteel, W, 0.16, len, 0, deckY - 0.16, zc);
    ob(g, M.wood, W - 0.06, 0.04, len - 0.04, 0, deckY, zc);
    [-1, 1].forEach((k) => {
      for (let i = 0; i < 5; i++) bx(g, M.darkSteel, 0.05, 0.4, 0.05, k * (W / 2 + 0.01), deckY + 0.1, s.boxB + 0.3 + i * ((len - 0.6) / 4));
    });
    ob(g, M.darkSteel, W, 1.3, 0.08, 0, deckY, s.boxF - 0.06);
    [-0.6, 0, 0.6].forEach((x) => ob(g, M.panel, 0.08, 1.3, 0.04, x, deckY, s.boxF - 0.12));
  }
  return g;
}

// Hoja de puerta trasera con su bisagra en el origen; se extiende hacia el centro del camión (signo -k).
function buildTruckDoor(M, kind, k) {
  const g = new THREE.Group();
  const s = truckSpec(kind);
  const h = s.H - s.deckY - 0.16;
  const w = s.W / 2 + 0.027;
  const mat = kind === 'expedicion' ? M.panel : M.ivoryPanel;
  ob(g, mat, w, h, 0.04, -k * w / 2, 0, 0);
  ob(g, M.steel, 0.035, h - 0.1, 0.03, -k * (w - 0.18), 0.05, -0.035);
  [0.25, h - 0.35].forEach((y) => ob(g, M.darkSteel, w * 0.9, 0.06, 0.025, -k * w * 0.48, y, -0.03));
  if (kind === 'ligero') class9(g, 0.32, -k * w * 0.5, h * 0.62, -0.032, Math.PI);
  return g;
}

function truckCargo(M, kind, s, loaded) {
  const cargo = new THREE.Group();
  cargo.name = 'cargo';
  const len = s.boxF - s.boxB;
  cargo.position.set(0, s.deckY + (s.box ? 0.02 : 0.04), (s.boxF + s.boxB) / 2);
  if (!loaded) return cargo;
  // z medida desde el centro hacia las puertas traseras (-z): lo primero que se descarga queda junto a ellas
  const add = (o, x, z, ry = 0) => {
    o.position.set(x, 0, -z);
    o.rotation.y = ry;
    cargo.add(o);
    return o;
  };
  const rear = len / 2 - 0.5;
  if (kind === 'recogida' || kind === 'expedicion') {
    const rows = kind === 'recogida' ? 3 : 4;
    for (let i = 0; i < rows; i++) [-0.62, 0.62].forEach((x) => add(makePallet(M, { kind: 'plomo', detail: i === 0 ? 'high' : 'low' }), x, rear - i * 0.86));
    if (kind === 'recogida') add(makeEVCrate(M), 0, -len / 2 + 1.35);
  } else if (kind === 'ligero') {
    [0, 1].forEach((i) => [-0.45, 0.45].forEach((x) => add(makePallet(M, { kind: 'modulos', count: i ? 4 : 8 }), x, len / 2 - 0.7 - i * 1.3, Math.PI / 2)));
  } else {
    [-0.62, 0.62].forEach((x) => add(makePallet(M, { kind: 'granza' }), x, rear - 0.1));
    [-0.62, 0.62].forEach((x) => add(makePallet(M, { kind: 'lingotes', count: 3 }), x, rear - 1.35));
    add(makePallet(M, { kind: 'lingotes', count: 3 }), -0.62, rear - 2.3);
    add(makePallet(M, { kind: 'granza' }), 0.62, rear - 2.4);
  }
  return cargo;
}

// kind: 'recogida' | 'expedicion' | 'ligero' | 'lingotes'. userData.cargo (zona de carga, con los palés como hijos
// sueltos para descargarlos uno a uno), userData.doors (pivotes de las puertas traseras: rotation.y entre 0 y
// userData.doorOpen[i]).
// mergeCargo: true fusiona la carga en una sola pieza (menos llamadas en un camión móvil que no se descarga).
export function makeTruck(M, { kind = 'recogida', loaded = true, doorsOpen = false, mergeCargo = false, dynamic = false } = {}) {
  const s = truckSpec(kind);
  const g = variant(M, `truck|${kind}`, () => buildTruckBody(M, kind));
  const doors = [];
  const doorOpen = [];
  if (s.box) {
    [-1, 1].forEach((k) => {
      const pivot = variant(M, `truckDoor|${kind}|${k}`, () => buildTruckDoor(M, kind, k));
      pivot.position.set(k * (s.W / 2 + 0.03), s.deckY + 0.06, s.boxB - 0.03);
      const open = k < 0 ? -(Math.PI * 1.5 - 0.1) : Math.PI * 1.5 - 0.1;
      // la hoja izquierda (k = -1) se extiende hacia +x; abre girando hacia atrás y queda pegada al costado
      doorOpen.push(-open);
      pivot.rotation.y = doorsOpen ? -open : 0;
      pivot.name = k < 0 ? 'doorL' : 'doorR';
      g.add(pivot);
      doors.push(pivot);
    });
  }
  let cargo;
  if (mergeCargo && loaded) {
    cargo = variant(M, `truckCargo|${kind}`, () => truckCargo(M, kind, s, true));
    cargo.position.copy(truckCargo(M, kind, s, false).position);
    cargo.name = 'cargo';
  } else cargo = truckCargo(M, kind, s, loaded);
  g.add(cargo);
  Object.assign(g.userData, { kind, cargo, doors, doorOpen });
  return finish(g, { dynamic });
}

// ---------- Carretilla elevadora ----------
// Contrapesada, ~2,4 m del contrapeso al mástil (más 1,1 m de horquillas), 1,1 m de ancho, 2,15 m de alto.
function buildForklift(M, driver) {
  const g = new THREE.Group();
  // chasis y capó (ámbar) y contrapeso (grafito)
  ext(g, M.amberMatte, [[-0.9, 0.22], [0.82, 0.22], [0.82, 0.92], [0.6, 1.02], [-0.55, 1.02], [-0.9, 0.9]], 1.0, 0, 0.03);
  ext(g, M.graphite, [[-0.88, 0.2], [-1.25, 0.2], [-1.4, 0.4], [-1.4, 1.0], [-1.28, 1.15], [-0.88, 1.15]], 1.1, 0, 0.03);
  // asiento
  bx(g, M.grip, 0.46, 0.08, 0.44, 0, 1.08, -0.5);
  bar(g, M.grip, new THREE.Vector3(0, 1.1, -0.74), new THREE.Vector3(0, 1.58, -0.82), 0.44, 0.08);
  // columna y volante
  bar(g, M.darkSteel, new THREE.Vector3(0, 1.0, 0.42), new THREE.Vector3(0, 1.4, 0.0), 0.05);
  put(g, new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10, 1, true), M.grip, 0, 1.42, -0.02, -0.75);
  // tejadillo protector
  const gy = 2.12;
  [-1, 1].forEach((k) => {
    bar(g, M.graphite, new THREE.Vector3(k * 0.48, 0.95, 0.58), new THREE.Vector3(k * 0.48, gy, 0.42), 0.06);
    bar(g, M.graphite, new THREE.Vector3(k * 0.48, 1.1, -0.98), new THREE.Vector3(k * 0.48, gy, -0.86), 0.06);
    bx(g, M.graphite, 0.06, 0.06, 1.34, k * 0.48, gy, -0.22);
    bx(g, M.warmGlow, 0.1, 0.08, 0.04, k * 0.48, 1.85, 0.48);
  });
  for (let i = 0; i < 5; i++) bx(g, M.graphite, 0.96, 0.04, 0.05, 0, gy + 0.02, 0.4 - i * 0.3);
  put(g, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6), M.amberGlow, 0.3, gy + 0.09, -0.8);
  // mástil fijo: largueros, travesaños, cilindros de elevación e inclinación
  [-1, 1].forEach((k) => {
    bx(g, M.darkSteel, 0.08, 2.08, 0.12, k * 0.33, 1.2, 0.98);
    bar(g, M.steel, new THREE.Vector3(k * 0.4, 0.75, 0.62), new THREE.Vector3(k * 0.33, 1.0, 0.9), 0.05);
  });
  [0.25, 2.18].forEach((y) => bx(g, M.darkSteel, 0.74, 0.08, 0.1, 0, y, 0.98));
  put(g, new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), M.steel, 0, 1.1, 0.93);
  // ruedas
  [-1, 1].forEach((k) => {
    wheel(g, M.rubber, M.steel, 0.31, 0.22, k * 0.5, 0.31, 0.58, 10);
    wheel(g, M.rubber, M.steel, 0.24, 0.17, k * 0.42, 0.24, -1.02, 10);
  });
  if (driver) {
    const p = buildPerson(M, 'carretillero', 'seated', 0);
    p.position.set(0, 0.62, -0.52);
    g.add(p);
  }
  return g;
}

// Tablero portahorquillas, respaldo de carga y las dos horquillas; y = 0 en la cara inferior de las horquillas.
function buildForks(M) {
  const g = new THREE.Group();
  bx(g, M.darkSteel, 0.82, 0.42, 0.05, 0, 0.25, 1.1);
  [-0.38, -0.13, 0.13, 0.38].forEach((x) => bx(g, M.darkSteel, 0.04, 0.55, 0.04, x, 0.72, 1.1));
  bx(g, M.darkSteel, 0.82, 0.04, 0.04, 0, 1.0, 1.1);
  [-0.26, 0.26].forEach((x) => {
    bx(g, M.darkSteel, 0.1, 0.44, 0.045, x, 0.22, 1.15);
    bx(g, M.darkSteel, 0.1, 0.045, 1.1, x, 0.0225, 1.72);
  });
  return g;
}

// forkHeight: altura de las horquillas (y local de userData.forks). pallet: null | 'plomo' | 'litio' (embalaje del
// paquete de coche eléctrico, atravesado). La carga va en userData.load (hija de las horquillas: se puede soltar).
export function makeForklift(M, { forkHeight = 0.2, pallet = null, driver = true, dynamic = false } = {}) {
  const g = variant(M, `forklift|${driver}`, () => buildForklift(M, driver));
  const forks = variant(M, 'forks', () => buildForks(M));
  forks.name = 'forks';
  forks.position.y = forkHeight;
  let load = null;
  if (pallet === 'plomo') {
    load = makePallet(M, { kind: 'plomo' });
    load.position.set(0, -0.06, 1.72);
  } else if (pallet === 'litio') {
    load = makeEVCrate(M);
    load.rotation.y = Math.PI / 2;
    load.position.set(0, -0.06, 2.0);
  }
  if (load) forks.add(load);
  g.add(forks);
  Object.assign(g.userData, { forks, load });
  return finish(g, { dynamic });
}

// ---------- Tractor de arrastre ----------
// Tractor de equipajes de aeropuerto (2,6 × 1,3 m) y remolques planos detrás (hacia -z), enganchados por lanza.
function buildTug(M, driver) {
  const g = new THREE.Group();
  ext(g, M.graphite, [[-1.3, 0.2], [1.25, 0.2], [1.3, 0.5], [-1.3, 0.5]], 1.3, 0, 0.03);
  ext(g, M.ivoryPanel, [[0.25, 0.5], [1.3, 0.5], [1.3, 0.78], [1.15, 0.92], [0.25, 0.95]], 1.24, 0, 0.03);
  ext(g, M.ivoryPanel, [[-1.3, 0.5], [-0.8, 0.5], [-0.8, 0.72], [-1.3, 0.72]], 1.24, 0, 0.02);
  bx(g, M.rubber, 1.36, 0.16, 0.12, 0, 0.32, 1.33);
  bx(g, M.rubber, 1.36, 0.16, 0.1, 0, 0.32, -1.33);
  // asiento, respaldo y volante
  bx(g, M.grip, 0.5, 0.1, 0.45, 0, 0.62, -0.4);
  bar(g, M.grip, new THREE.Vector3(0, 0.66, -0.66), new THREE.Vector3(0, 1.12, -0.74), 0.5, 0.08);
  bar(g, M.darkSteel, new THREE.Vector3(0, 0.88, 0.3), new THREE.Vector3(0, 0.97, 0.06), 0.05);
  put(g, new THREE.CylinderGeometry(0.15, 0.15, 0.03, 10, 1, true), M.grip, 0, 0.98, 0.04, -0.85);
  // faros, baliza ámbar sobre mástil y enganche
  [-1, 1].forEach((k) => bx(g, M.warmGlow, 0.18, 0.08, 0.03, k * 0.42, 0.74, 1.31));
  bar(g, M.darkSteel, new THREE.Vector3(0.55, 0.72, -1.15), new THREE.Vector3(0.55, 1.55, -1.15), 0.04);
  put(g, new THREE.CylinderGeometry(0.06, 0.07, 0.11, 6), M.amberGlow, 0.55, 1.6, -1.15);
  bx(g, M.darkSteel, 0.14, 0.06, 0.2, 0, 0.35, -1.45);
  [-1, 1].forEach((k) => {
    wheel(g, M.rubber, M.steel, 0.27, 0.2, k * 0.6, 0.27, 0.78, 8);
    wheel(g, M.rubber, M.steel, 0.27, 0.2, k * 0.6, 0.27, -0.78, 8);
  });
  if (driver) {
    const p = buildPerson(M, 'conductor', 'seated', 0);
    p.position.set(0, 0.17, -0.42);
    g.add(p);
  }
  return g;
}

// Remolque plano: origen en el centro de la plataforma (y = 0 suelo); la lanza llega hasta z = +CART[load].reach.
const CART = { plomo: { L: 1.7, W: 1.4 }, vacio: { L: 1.7, W: 1.4 }, litio: { L: 2.6, W: 1.8 } };
function buildCart(M, load) {
  const g = new THREE.Group();
  const { L, W } = CART[load] || CART.plomo;
  const dy = 0.42;
  ob(g, M.darkSteel, W, 0.1, L, 0, dy - 0.1, 0);
  // cantoneras y barandilla baja
  [-1, 1].forEach((k) => {
    [-1, 1].forEach((j) => ob(g, M.graphite, 0.05, 0.3, 0.05, k * (W / 2 - 0.025), dy, j * (L / 2 - 0.025)));
    bx(g, M.graphite, 0.04, 0.04, L, k * (W / 2 - 0.02), dy + 0.28, 0);
  });
  bar(g, M.darkSteel, new THREE.Vector3(0, dy - 0.05, L / 2), new THREE.Vector3(0, 0.36, L / 2 + 0.75), 0.06);
  bx(g, M.darkSteel, 0.14, 0.06, 0.18, 0, 0.35, -L / 2 - 0.08);
  [-1, 1].forEach((k) => [-1, 1].forEach((j) => wheel(g, M.rubber, null, 0.16, 0.12, k * (W / 2 - 0.12), 0.16, j * (L / 2 - 0.3), 8)));
  // carga sujeta con cinchas de trinquete (ámbar) hasta el bastidor
  if (load === 'plomo') {
    const p = buildLeadPallet(M, 2, 'high');
    p.position.y = dy;
    g.add(p);
    [-0.2, 0.2].forEach((z) => ob(g, M.amberMatte, W - 0.02, 0.62, 0.04, 0, dy - 0.06, z));
  } else if (load === 'litio') {
    const c = buildEVCrate(M);
    c.position.y = dy;
    g.add(c);
    [-0.6, 0.6].forEach((z) => ob(g, M.amberMatte, W - 0.02, 0.74, 0.04, 0, dy - 0.06, z));
  }
  return g;
}

// carts: número de remolques; load: 'plomo' (palé de baterías con bornes tapados) | 'litio' (embalaje del paquete
// de coche eléctrico) | 'vacio'. userData.carts: grupos de cada remolque (giran en su enganche si se quiere).
export function makeTowTractor(M, { carts = 1, load = 'plomo', driver = true, dynamic = false } = {}) {
  const g = variant(M, `tug|${driver}`, () => buildTug(M, driver));
  const list = [];
  const key = CART[load] ? load : 'plomo';
  let z = -1.5;
  for (let i = 0; i < carts; i++) {
    const c = variant(M, `cart|${key}`, () => buildCart(M, key));
    const { L } = CART[key];
    z -= 0.75 + L / 2 + 0.02;
    c.position.z = z;
    c.name = `cart${i}`;
    g.add(c);
    list.push(c);
    z -= L / 2 + 0.1;
  }
  Object.assign(g.userData, { carts: list, load: key });
  return finish(g, { dynamic });
}

// ---------- Almacenamiento estacionario (BESS) ----------
// Contenedor de `length` m (x) × 2,44 (z) × 2,6 m con puertas en el costado +z. Dentro, racks de módulos de segunda
// vida con su piloto de estado; fuera, rejillas, equipo de climatización y zapatas.
function buildBESS(M, length, doorOpen) {
  const g = new THREE.Group();
  const L = length;
  const D = 2.44;
  const H = 2.6;
  const y0 = 0.18;
  // zapatas
  [-1, 1].forEach((i) => [-1, 1].forEach((j) => ob(g, M.concreteLight, 0.4, y0, 0.5, i * (L / 2 - 0.3), 0, j * (D / 2 - 0.3))));
  // envolvente: suelo, techo, fondo, testeros
  ob(g, M.darkSteel, L, 0.1, D, 0, y0, 0);
  ob(g, M.ivoryPanel, L, 0.08, D, 0, y0 + H - 0.08, 0);
  bx(g, M.ivoryPanel, L, H - 0.18, 0.05, 0, y0 + 0.1 + (H - 0.18) / 2, -D / 2 + 0.025);
  [-1, 1].forEach((k) => bx(g, M.ivoryPanel, 0.05, H - 0.18, D, k * (L / 2 - 0.025), y0 + 0.1 + (H - 0.18) / 2, 0));
  // esquineros y largueros
  [-1, 1].forEach((i) => {
    [-1, 1].forEach((j) => bx(g, M.darkSteel, 0.14, H, 0.14, i * (L / 2 - 0.05), y0 + H / 2, j * (D / 2 - 0.05)));
    [0.06, H - 0.06].forEach((y) => bx(g, M.darkSteel, L, 0.12, 0.1, 0, y0 + y, i * (D / 2 - 0.03)));
  });
  // nervios del fondo
  for (let x = -L / 2 + 0.6; x < L / 2 - 0.3; x += 0.6) bx(g, M.ivory, 0.08, H - 0.3, 0.03, x, y0 + H / 2, -D / 2 - 0.01);
  // rejillas en los testeros y climatizador en el testero +x
  [-1, 1].forEach((k) => {
    for (let i = 0; i < 4; i++) bx(g, M.darkSteel, 0.03, 0.035, 0.8, k * (L / 2 + 0.01), y0 + 1.6 + i * 0.09, -0.5);
  });
  bx(g, M.panel, 0.32, 0.9, 1.0, L / 2 + 0.16, y0 + 1.2, 0.5);
  put(g, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 10), M.darkSteel, L / 2 + 0.33, y0 + 1.2, 0.5, 0, 0, Math.PI / 2);
  // frontal (+z): montantes entre puertas y dintel
  const bays = Math.max(1, Math.round(L / 2));
  const bw = (L - 0.2) / bays;
  bx(g, M.ivoryPanel, L, 0.3, 0.05, 0, y0 + H - 0.23, D / 2 - 0.025);
  for (let i = 0; i <= bays; i++) bx(g, M.ivoryPanel, 0.12, H - 0.18, 0.06, -L / 2 + 0.1 + i * bw, y0 + 0.1 + (H - 0.18) / 2, D / 2 - 0.03);
  // racks de módulos con piloto de estado
  const rh = H - 0.55;
  for (let i = 0; i < bays; i++) {
    const cx = -L / 2 + 0.1 + (i + 0.5) * bw;
    const rw = bw - 0.3;
    ob(g, M.graphite, rw, rh, 0.6, cx, y0 + 0.1, -D / 2 + 0.38);
    // frentes de los módulos (aluminio) con las juntas del rack entre ellos
    for (let l = 0; l < 6; l++) bx(g, M.steel, rw - 0.08, (rh - 0.3) / 6 - 0.05, 0.02, cx, y0 + 0.3 + (l + 0.5) * (rh - 0.3) / 6, -D / 2 + 0.69);
    bx(g, M.limeInsert, rw - 0.4, 0.03, 0.02, cx, y0 + rh - 0.05, -D / 2 + 0.69);
    bx(g, M.lime, 0.05, 0.05, 0.02, cx + rw / 2 - 0.12, y0 + rh - 0.05, -D / 2 + 0.69);
    // puertas: dos hojas por vano
    const dh = H - 0.5;
    const lw = (bw - 0.12) / 2;
    [-1, 1].forEach((k) => {
      const hx = cx + k * (bw / 2 - 0.06);
      const leaf = new THREE.Group();
      ob(leaf, M.ivoryPanel, lw, dh, 0.04, -k * lw / 2, 0, 0.02);
      ob(leaf, M.darkSteel, 0.03, dh * 0.7, 0.03, -k * (lw - 0.1), dh * 0.15, 0.05);
      leaf.position.set(hx, y0 + 0.1, D / 2);
      leaf.rotation.y = doorOpen ? k * 1.75 : 0;
      g.add(leaf);
    });
  }
  return g;
}

export function makeBESS(M, { length = 6, doorOpen = true, dynamic = false } = {}) {
  return finish(variant(M, `bess|${length}|${doorOpen}`, () => buildBESS(M, length, doorOpen)), { dynamic });
}

// ---------- Coche aparcado (≈ 200 triángulos) ----------
const CAR_PROFILE = [[-2.15, 0.3], [2.1, 0.3], [2.2, 0.5], [2.15, 0.74], [0.95, 0.86], [0.32, 1.38], [-1.1, 1.42], [-1.95, 1.06], [-2.2, 0.86]];
const CAR_GLASS = [[1.0, 0.82], [0.34, 1.36], [-1.08, 1.39], [-1.98, 1.04], [-1.92, 0.86]];
function buildCar(M, tint) {
  const g = new THREE.Group();
  const paints = [M.paint, M.ivoryPanel, M.graphite, M.panel, M.ivory, M.darkSteel];
  const body = paints[((tint | 0) % paints.length + paints.length) % paints.length];
  ext(g, body, CAR_PROFILE, 1.76);
  ext(g, M.darkGlass, CAR_GLASS, 1.78);
  bx(g, M.stoneTop, 1.3, 0.08, 0.03, 0, 0.66, 2.18);
  bx(g, M.amberMatte, 1.35, 0.07, 0.03, 0, 0.8, -2.19);
  [[0.8, 1.35], [0.8, -1.3], [-0.8, 1.35], [-0.8, -1.3]].forEach(([x, z]) => wheel(g, M.rubber, null, 0.32, 0.2, x, 0.32, z, 8));
  return g;
}

export function makeParkedCar(M, { tint = 0, dynamic = false } = {}) {
  return finish(variant(M, `car|${tint}`, () => buildCar(M, tint)), { dynamic });
}

// ---------- Placa de alta tensión ----------
// 0,3 × 0,4 m sobre un respaldo de acero; el origen está en el canto inferior de la placa (para colgarla).
export function makeHVSign(M, { text = 'ALTA TENSIÓN', dynamic = false } = {}) {
  return finish(variant(M, `hv|${text}`, () => {
    const g = new THREE.Group();
    bx(g, M.darkSteel, 0.32, 0.42, 0.012, 0, 0.21, 0);
    put(g, labelPlane(0.3, 0.4, 128, 224), labelMaterial(text), 0, 0.21, 0.0075);
    return g;
  }), { dynamic });
}
