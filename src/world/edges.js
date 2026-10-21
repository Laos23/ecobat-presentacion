import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as CAM from '../camera.js';
import { V, TOP, F, STATIONS, PLATFORMS, BRIDGES } from './layout.js';

// Terreno común: agua, islas con acantilado estratificado, puentes y mobiliario de borde (bordillo por
// piezas, pasamanos tubular con pies embridados, balizas, vegetación, rocas y focos en la roca).
// Referencia: context/ref-borde-isla-noche.png y context/ref-cruce-rutas.png.

const DECK_W = 3; // ancho de los puentes
const KERB = { w: 0.42, h: 0.12, inset: 0.27, len: 1.05 }; // piezas de bordillo sobre el canto de la losa
const RAIL = { y: 0.98, inset: 0.12, step: 2 }; // eje del pasamanos sobre el suelo (≤ 1,15 m)
const MID_Y = 0.55; // travesaño intermedio
const LAMP = { inset: 0.66, step: 4.6 }; // balizas en el suelo, justo dentro del bordillo
const WATER_Y = -2.6;
const UP = new THREE.Vector3(0, 1, 0);
const UPLIGHTS = 24; // focos en la roca que admite el sombreador
const UPLIGHT_RANGE = 4.6;
const JOINT_STEP = 2.4; // juntas transversales de los tableros

// El terreno deja preparadas las islas y los puentes; los bordes se completan tras las estaciones.
let shared = null;

// ---------- texturas procedurales del borde ----------
// Ruido de valor periódico (periodos enteros ≤ 256): las texturas se repiten sin costura.
function periodicNoise(seed) {
  const r = rng(seed);
  const tab = new Float32Array(256 * 256);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  return (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px;
    const y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const a = tab[y0 * 256 + x0];
    const b = tab[y0 * 256 + x1];
    const c = tab[y1 * 256 + x0];
    const d = tab[y1 * 256 + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Altura → normales (Sobel con envoltura). Fila 0 = v 0: el verde crece hacia +v.
function normalsFrom(hgt, w, h, strength) {
  const out = new Uint8Array(w * h * 4);
  const H = (x, y) => hgt[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      out[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      out[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

function dataTex(data, w, h, srgb, repeat = 1) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

// Roca estratificada en gris carbón: láminas onduladas, diaclasas verticales que cambian de sitio en cada
// banco y bloques almohadillados hacia sus juntas. La tesela cubre ~3 m de contorno (u) y dos bancos (v):
// las juntas entre bancos caen en v = 0 y v = 0,5, donde la malla del acantilado hace repisa o visera.
function strataMaps() {
  const W = 768;
  const H = 384;
  const nz = periodicNoise(41);
  const nb = periodicNoise(43);
  const r = rng(47);
  const bands = [0, 1].map(() => ({
    lam: Array.from({ length: 2 + Math.floor(r() * 2) }, () => ({ t: 0.2 + r() * 0.6, amp: 0.006 + r() * 0.012, k: 1 + Math.floor(r() * 2), ph: r() * 6.283, off: Math.floor(r() * 200) })),
    // fisuras sueltas: pocas, a distancias irregulares, casi nunca de lado a lado del banco
    joints: Array.from({ length: Math.floor(r() * 3) }, () => {
      const full = r() < 0.25;
      const t0 = full ? -1 : r() * 0.5;
      return { u: r(), t0, t1: full ? 2 : t0 + 0.25 + r() * 0.45, sl: (r() - 0.5) * 0.08, w: 0.5 + r() };
    }),
  }));
  const col = new Uint8Array(W * H * 4);
  const rough = new Uint8Array(W * H * 4);
  const hgt = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const v = (j + 0.5) / H;
    const bi = v < 0.5 ? 0 : 1;
    const t = (v - bi * 0.5) * 2; // 0 pie del banco … 1 techo
    const B = bands[bi];
    const db = Math.min(t, 1 - t) * 0.9; // metros a la junta entre bancos
    const lit = t > 0.8 ? (t - 0.8) * 0.3 : 0;
    const foot = t < 0.14 ? (0.14 - t) * 0.8 : 0;
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W;
      const g1 = nz(u * 192, v * 96, 192, 96);
      const g2 = nz(u * 96 + 37, v * 48 + 11, 96, 48);
      const g3 = nb(u * 24, v * 12, 24, 12);
      const g4 = nb(u * 6 + 101, v * 3 + 57, 6, 3);
      let dj = 1;
      for (const J of B.joints) {
        if (t < J.t0 || t > J.t1) continue;
        let du = Math.abs(u - J.u - J.sl * (t - 0.5) - (g2 - 0.5) * 0.006);
        du = Math.min(du, 1 - du) * 3;
        // la fisura se cierra hacia sus extremos
        const end = Math.min(1, (t - J.t0) * 10, (J.t1 - t) * 10) * J.w;
        dj = Math.min(dj, du / Math.max(0.12, end));
      }
      let dl = 1;
      let open = 1;
      for (const Lm of B.lam) {
        const d = Math.abs(t - Lm.t - Lm.amp * Math.sin(6.283 * u * Lm.k + Lm.ph) - (g4 - 0.5) * 0.06) * 0.9;
        if (d < dl) {
          dl = d;
          open = nb(u * 32 + Lm.off, Lm.off, 32, 256) > 0.42 ? 1 : 0.3;
        }
      }
      const gJ = Math.max(0, 1 - dj / 0.011);
      const gL = Math.max(0, 1 - dl / 0.007) * open;
      const gB = Math.max(0, 1 - db / 0.02);
      const pillow = smooth(0, 0.06, dj) * smooth(0, 0.12, db);
      // estrías finas a lo largo del lecho (relieve anisótropo: roca sedimentaria, no enfoscado)
      const stri = nb(u * 24 + 3, v * 96 + 5, 24, 96) * 0.6 + nb(u * 48 + 9, v * 160 + 1, 48, 160) * 0.4;
      hgt[j * W + i] = pillow * 0.8 + stri * 0.2 + g1 * 0.08 + g2 * 0.16 + g3 * 0.28 - gJ * 0.6 - gL * 0.18 - gB * 0.4;
      const warm = (g4 - 0.5) * 0.12;
      const k = (0.86 + g1 * 0.06 + (stri - 0.5) * 0.1 + (g3 - 0.5) * 0.22 + (g4 - 0.5) * 0.16 + lit - foot) * (1 - gJ * 0.42 - gL * 0.14 - gB * 0.25);
      const o = (j * W + i) * 4;
      col[o] = Math.min(255, 70 * k * (1 + warm));
      col[o + 1] = Math.min(255, 71 * k * (1 + warm * 0.35));
      col[o + 2] = Math.min(255, 72 * k * (1 - warm * 0.5));
      col[o + 3] = 255;
      const ro = Math.min(1, 0.84 + g2 * 0.1 + (gJ + gB) * 0.06) * 255;
      rough[o] = rough[o + 1] = rough[o + 2] = ro;
      rough[o + 3] = 255;
    }
  }
  return { map: dataTex(col, W, H, true), roughnessMap: dataTex(rough, W, H, false), normalMap: dataTex(normalsFrom(hgt, W, H, 2.4), W, H, false) };
}

// Piedra prefabricada clara de bordillos, canto de losa y tableros: grano fino, sin poros ni juntas
// (las juntas reales son piezas: bordillo segmentado y tiras transversales en los tableros).
function stoneMaps() {
  const N = 384;
  const nz = periodicNoise(61);
  const col = new Uint8Array(N * N * 4);
  const rough = new Uint8Array(N * N * 4);
  const hgt = new Float32Array(N * N);
  const base = [188, 183, 173];
  for (let j = 0; j < N; j++) {
    const v = (j + 0.5) / N;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      const g1 = nz(u * 160, v * 160, 160, 160);
      const g2 = nz(u * 48 + 17, v * 48 + 5, 48, 48);
      const g3 = nz(u * 12 + 5, v * 12 + 9, 12, 12);
      const g4 = nz(u * 3 + 71, v * 3 + 31, 3, 3);
      const fleck = nz(u * 256 + 3, v * 256 + 101, 256, 256) > 0.9 ? 1 : 0;
      const k = 0.92 + g1 * 0.06 + (g2 - 0.5) * 0.05 + (g3 - 0.5) * 0.07 + (g4 - 0.5) * 0.05 - fleck * 0.05;
      const o = (j * N + i) * 4;
      col[o] = Math.min(255, base[0] * k);
      col[o + 1] = Math.min(255, base[1] * k);
      col[o + 2] = Math.min(255, base[2] * k);
      col[o + 3] = 255;
      const ro = (0.56 + g2 * 0.08 + (g3 - 0.5) * 0.06) * 255;
      rough[o] = rough[o + 1] = rough[o + 2] = ro;
      rough[o + 3] = 255;
      hgt[j * N + i] = g1 * 0.25 + g2 * 0.45 + g3 * 0.3 - fleck * 0.15;
    }
  }
  const tile = 3;
  return {
    map: dataTex(col, N, N, true, 1 / tile),
    roughnessMap: dataTex(rough, N, N, false, 1 / tile),
    normalMap: dataTex(normalsFrom(hgt, N, N, 0.36), N, N, false, 1 / tile),
    tile,
  };
}

// ---------- focos en la roca ----------
// Luz cálida falsa (sin luces reales) calculada en el sombreador de la roca y de la vegetación: sigue el
// relieve del mapa de normales, se apaga vista de canto y no necesita bloom. Una rejilla en planta guarda
// los dos focos más cercanos de cada celda, así el sombreador evalúa dos luces sin bucles (compila rápido
// en D3D). Posiciones y rejilla se rellenan en buildEdges; todos los materiales comparten los uniformes.
const UPGRID = { x0: -80, z0: -40, cell: 0.75, nx: 216, nz: 112 };
const upU = {
  uUpPos: { value: Array.from({ length: UPLIGHTS }, () => new THREE.Vector3(0, -50, 0)) },
  uUpDir: { value: Array.from({ length: UPLIGHTS }, () => new THREE.Vector3(0, 1, 0)) },
  uUpCol: { value: new THREE.Color('#ffb46a').multiplyScalar(13) },
  uUpGrid: { value: null },
  uUpGridXf: { value: new THREE.Vector3(UPGRID.x0, UPGRID.z0, 1 / UPGRID.cell) },
};

// Rejilla RG8: índices de los dos focos más cercanos (255 = ninguno a su alcance).
function upGrid(fixtures) {
  const { x0, z0, cell, nx, nz } = UPGRID;
  const data = new Uint8Array(nx * nz * 2).fill(255);
  const reach = (UPLIGHT_RANGE + cell) ** 2;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * cell;
      const z = z0 + (j + 0.5) * cell;
      let a = -1;
      let b = -1;
      let da = reach;
      let db = reach;
      fixtures.forEach((f, k) => {
        const d = (f.x - x) ** 2 + (f.z - z) ** 2;
        if (d < da) {
          b = a;
          db = da;
          a = k;
          da = d;
        } else if (d < db) {
          b = k;
          db = d;
        }
      });
      if (a >= 0) data[(j * nx + i) * 2] = a;
      if (b >= 0) data[(j * nx + i) * 2 + 1] = b;
    }
  }
  const t = new THREE.DataTexture(data, nx, nz, THREE.RGFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// `wet`: roca oscura y más brillante junto al agua; `macro`: manchas amplias que rompen la repetición;
// `bands`: cada banco de estrato (v de la UV del acantilado) con su propio tono.
function uplit(mat, key, { wet = false, macro = false, bands = false } = {}) {
  if (mat.userData.uplit) return mat;
  mat.userData.uplit = true;
  const W = WATER_Y.toFixed(2);
  const R = UPLIGHT_RANGE.toFixed(2);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, upU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vUpW;')
      .replace('#include <project_vertex>', [
        '#include <project_vertex>',
        'vec4 upW = vec4(transformed, 1.0);',
        '#ifdef USE_INSTANCING',
        'upW = instanceMatrix * upW;',
        '#endif',
        'vUpW = (modelMatrix * upW).xyz;',
      ].join('\n'));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vUpW;
uniform vec3 uUpPos[${UPLIGHTS}];
uniform vec3 uUpDir[${UPLIGHTS}];
uniform vec3 uUpCol;
uniform sampler2D uUpGrid;
uniform vec3 uUpGridXf;
float upOne(float id, vec3 n) {
  int i = int(id + 0.5);
  if (i >= ${UPLIGHTS}) return 0.0;
  vec3 L = uUpPos[i] - vUpW;
  float d = max(length(L), 1e-3);
  L /= d;
  float cone = smoothstep(0.68, 0.95, dot(-L, uUpDir[i]));
  float fall = clamp(1.0 - d / ${R}, 0.0, 1.0);
  return (0.25 + 0.75 * max(dot(n, L), 0.0)) * cone * fall * fall;
}
float upHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float upNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(upHash(i), upHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(upHash(i + vec3(0.0, 1.0, 0.0)), upHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(upHash(i + vec3(0.0, 0.0, 1.0)), upHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(upHash(i + vec3(0.0, 1.0, 1.0)), upHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
${macro ? 'diffuseColor.rgb *= 0.84 + 0.3 * upNoise(vUpW * vec3(0.18, 0.35, 0.18));' : ''}
${bands ? 'diffuseColor.rgb *= 0.8 + 0.36 * fract(sin(floor(vMapUv.y * 2.0 + 0.001) * 12.9898) * 43758.5453);' : ''}
${wet ? `float upWet = smoothstep(${W} + 0.75, ${W} + 0.04, vUpW.y);\ndiffuseColor.rgb *= 1.0 - 0.4 * upWet;` : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
${wet ? 'roughnessFactor *= 1.0 - 0.3 * upWet;' : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  ivec2 upC = clamp(ivec2(floor((vUpW.xz - uUpGridXf.xy) * uUpGridXf.z)), ivec2(0), ivec2(${UPGRID.nx - 1}, ${UPGRID.nz - 1}));
  vec2 upIds = texelFetch(uUpGrid, upC, 0).rg * 255.0;
  if (upIds.x < 254.5) {
    vec3 upN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    float upAcc = upOne(upIds.x, upN) + upOne(upIds.y, upN);
    totalEmissiveRadiance += diffuseColor.rgb * uUpCol * upAcc;
  }
}`);
  };
  mat.customProgramCacheKey = () => `edgeUplit|${key}|${wet}|${macro}|${bands}`;
  return mat;
}

// Materiales propios del borde (una sola vez): roca del acantilado, bloques, piedra clara y agua.
let MATS = null;
function edgeMaterials() {
  if (MATS) return MATS;
  const strata = strataMaps();
  const stone = stoneMaps();
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, map: stone.map, roughnessMap: stone.roughnessMap, normalMap: stone.normalMap });
  stoneMat.userData.tile = stone.tile;
  MATS = {
    cliff: uplit(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, ...strata }), 'cliff', { wet: true, macro: true, bands: true }),
    // bloques: misma roca sin sombreador propio (comparte programa con las rocas de las estaciones)
    boulder: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, normalScale: new THREE.Vector2(0.55, 0.55), ...strata }),
    stone: stoneMat,
    // agua oscura: brillo especular ancho y tenue (sin la franja fría del contraluz); la vida la ponen
    // los reflejos cálidos de focos y balizas
    water: new THREE.MeshPhysicalMaterial({ color: '#040506', roughness: 0.38, metalness: 0, specularIntensity: 0.05 }),
  };
  return MATS;
}

// ---------- reflejos en el agua ----------
// Trazos de onda cálidos (repetibles en v) para la tira de reflejo.
function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const r = rng(71);
  for (let y = 1; y < 256; y += 1.6 + r() * 2.6) {
    let x = 2 + r() * 10;
    while (x < 62) {
      const len = 3 + r() * 16;
      const mid = x + len / 2;
      const across = Math.exp(-(((mid - 32) / 13) ** 2));
      if (r() < 0.2 + 0.8 * across) {
        const a = (0.3 + 0.7 * across) * (0.45 + r() * 0.55);
        const h = 0.6 + r() * 0.9;
        g.fillStyle = `rgba(255,182,112,${a.toFixed(3)})`;
        [-256, 0, 256].forEach((dy) => {
          g.beginPath();
          g.ellipse(mid, y + dy, len / 2, h, 0, 0, Math.PI * 2);
          g.fill();
        });
      }
      x += len + 1.5 + r() * 9;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1.5);
  return t;
}

// Reflejo de cada foco o baliza junto al borde: tira plana aditiva sobre el agua que nace al pie de la
// luz y apunta al observador (como un reflejo real); vista desde arriba se acorta y, si el observador
// queda detrás del borde, se apaga. Las ondas se desplazan despacio (quietas con movimiento reducido).
function buildStreaks(ctx, list) {
  if (!list.length) return;
  const map = streakTexture();
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSt;\nvarying float vFace;')
      .replace('#include <project_vertex>', `
vec3 sc = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
float sw = length(instanceMatrix[0].xyz);
float sl = length(instanceMatrix[1].xyz);
vec2 sn = normalize(instanceMatrix[2].xz);
vec2 tc = cameraPosition.xz - sc.xz;
float dc = max(length(tc), 0.001);
vec2 dir = tc / dc;
float face = dot(dir, sn);
vec2 along = dir;
vec2 across = vec2(-along.y, along.x);
// el reflejo se alarga al mirar rasante (como la estela de luz en agua con oleaje) y se recoge visto desde arriba
float ratio = max((cameraPosition.y - sc.y) / dc, 0.02);
float len = sl * clamp(0.55 / ratio, 0.35, 3.2);
float wid = sw * mix(1.0, 1.6, smoothstep(0.25, 1.6, ratio));
vec3 wp = vec3(sc.x + across.x * position.x * wid + along.x * position.y * len, sc.y, sc.z + across.y * position.x * wid + along.y * position.y * len);
vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
gl_Position = projectionMatrix * mvPosition;
vSt = uv;
vFace = smoothstep(-0.05, 0.3, face);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSt;\nvarying float vFace;')
      .replace('#include <map_fragment>', `#include <map_fragment>
float acr = 1.0 - abs(vSt.x - 0.5) * 2.0;
diffuseColor.a *= vFace * smoothstep(0.0, 0.12, vSt.y) * pow(max(1.0 - vSt.y, 0.0), 1.4) * smoothstep(0.0, 0.4, acr);`);
  };
  mat.customProgramCacheKey = () => 'edgeStreak';
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), mat, list.length);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  list.forEach((s, i) => {
    o.position.set(s.x, WATER_Y + 0.004, s.z);
    o.rotation.set(0, Math.atan2(s.nx, s.nz), 0);
    o.scale.set(s.w, s.len, 1);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
    im.setColorAt(i, c.setScalar(s.k));
  });
  // la orientación se decide en el sombreador: sin recorte por la caja de las instancias
  im.frustumCulled = false;
  im.renderOrder = 2;
  im.userData.noCollide = true;
  ctx.add(im);
  ctx.anim((t, dt, story) => {
    if (!story.reduced) map.offset.y = (t * 0.035) % 1;
  });
}

// ---------- utilidades ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _d = new THREE.Vector3();
// Tramo recto (pasamanos, travesaños): geometría unitaria sobre +y estirada entre dos puntos.
function segment(geom, mat, ax, ay, az, bx, by, bz) {
  _d.set(bx - ax, by - ay, bz - az);
  const len = _d.length();
  const m = new THREE.Mesh(geom, mat);
  m.position.set(ax, ay, az);
  m.quaternion.setFromUnitVectors(UP, _d.normalize());
  m.scale.set(1, len, 1);
  return m;
}

// Matriz de una pieza de puente entre xa y xb: sigue la cuerda de la rasante con los cantos verticales
// (cizalla). `sized`: la geometría ya trae su longitud (no se escala en x).
const _pm = new THREE.Matrix4();
function chordMatrix(fr, xa, xb, l, dy, sy, sz, { sized = false, yf = fr.y } = {}) {
  const ya = yf(xa);
  const yb = yf(xb);
  const sx = sized ? 1 : xb - xa;
  const k = sized ? (yb - ya) / (xb - xa) : yb - ya;
  const xc = (xa + xb) / 2;
  const px = fr.a.x + fr.u.x * xc + fr.side.x * l;
  const pz = fr.a.z + fr.u.z * xc + fr.side.z * l;
  return _pm.set(
    fr.u.x * sx, 0, fr.side.x * sz, px,
    k, sy, 0, (ya + yb) / 2 + dy,
    fr.u.z * sx, 0, fr.side.z * sz, pz,
    0, 0, 0, 1,
  );
}

// Las piezas degeneradas no se crean: una escala nula deja normales vacías y sombreado NaN.
function chordPiece(geom, mat, fr, xa, xb, l, dy, sy = 1, sz = 1, opts) {
  if (!(xb - xa > 0.01 && sy > 0.001 && sz > 0.001)) return new THREE.Group();
  const m = new THREE.Mesh(geom, mat);
  m.matrixAutoUpdate = false;
  m.matrix.copy(chordMatrix(fr, xa, xb, l, dy, sy, sz, opts));
  return m;
}

// Tramos consecutivos de longitud ~step entre xa y xb (la rasante curva se aproxima por cuerdas).
function chords(xa, xb, step, cuts = []) {
  const stops = [xa, ...cuts.filter((c) => c > xa + 0.02 && c < xb - 0.02), xb];
  const out = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const n = Math.max(1, Math.ceil((b - a) / step));
    for (let k = 0; k < n; k++) out.push([a + ((b - a) * k) / n, a + ((b - a) * (k + 1)) / n]);
  }
  return out;
}

function kerbGeo(K, len) {
  const l = Math.max(0.1, Math.round(len * 100) / 100);
  return K.geo(`edgeKerb|${l}`, () => {
    const { w, h } = KERB;
    const ch = 0.028;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h - ch);
    s.lineTo(w / 2 - ch, h);
    s.lineTo(-w / 2 + ch, h);
    s.lineTo(-w / 2, h - ch);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false });
    g.translate(0, 0, -l / 2);
    g.rotateY(Math.PI / 2);
    return g;
  });
}

// Piezas de barandilla compartidas por islas y puentes.
function railParts(K) {
  return {
    post: K.geo('edgePost', () => {
      const h = RAIL.y - KERB.h;
      return mergeGeometries([
        new THREE.BoxGeometry(0.15, 0.018, 0.15).translate(0, 0.009, 0),
        new THREE.CylinderGeometry(0.043, 0.048, 0.07, 8).translate(0, 0.053, 0),
        new THREE.CylinderGeometry(0.028, 0.028, h, 8, 1, true).translate(0, h / 2, 0),
      ]);
    }),
    newel: K.geo('edgeNewel', () => {
      const h = RAIL.y - KERB.h;
      return mergeGeometries([
        new THREE.BoxGeometry(0.17, 0.02, 0.17).translate(0, 0.01, 0),
        new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10).translate(0, 0.06, 0),
        new THREE.CylinderGeometry(0.036, 0.036, h + 0.03, 10).translate(0, (h + 0.03) / 2, 0),
      ]);
    }),
    rail: K.geo('edgeRail', () => new THREE.CylinderGeometry(0.033, 0.033, 1, 10, 1, true).translate(0, 0.5, 0)),
    mid: K.geo('edgeMid', () => new THREE.CylinderGeometry(0.014, 0.014, 1, 5, 1, true).translate(0, 0.5, 0)),
    sleeve: K.geo('edgeSleeve', () => new THREE.CylinderGeometry(0.043, 0.043, 0.11, 8)),
  };
}

// Pasamanos continuo sobre una lista de pies { x, y (base), z, ok }: tramos, manguitos y travesaño.
function railRun(ctx, P, posts, { mid = true, newelEnds = true } = {}) {
  const { M } = ctx;
  const live = posts.map((p, k) => p.ok && ((k > 0 && posts[k - 1].ok) || (k < posts.length - 1 && posts[k + 1].ok)));
  posts.forEach((p, k) => {
    if (!live[k] || p.shared) return;
    const end = !(k > 0 && live[k - 1]) || !(k < posts.length - 1 && live[k + 1]);
    const m = new THREE.Mesh(end && newelEnds ? P.newel : P.post, M.darkSteel);
    m.position.set(p.x, p.y, p.z);
    ctx.add(m);
  });
  for (let k = 0; k < posts.length - 1; k++) {
    const a = posts[k];
    const b = posts[k + 1];
    if (!live[k] || !live[k + 1] || a.cut) continue;
    const ra = a.y - KERB.h + RAIL.y;
    const rb = b.y - KERB.h + RAIL.y;
    ctx.add(segment(P.rail, M.darkSteel, a.x, ra, a.z, b.x, rb, b.z));
    if (mid) ctx.add(segment(P.mid, M.darkSteel, a.x, a.y - KERB.h + MID_Y, a.z, b.x, b.y - KERB.h + MID_Y, b.z));
  }
  // manguito en cada encuentro del pasamanos con su pie, orientado con el tramo
  posts.forEach((p, k) => {
    if (!live[k]) return;
    const prev = k > 0 && live[k - 1] && !posts[k - 1].cut ? posts[k - 1] : p;
    const next = k < posts.length - 1 && live[k + 1] && !p.cut ? posts[k + 1] : p;
    if (prev === next) return;
    _d.set(next.x - prev.x, next.y - prev.y, next.z - prev.z).normalize();
    const s = new THREE.Mesh(P.sleeve, M.darkSteel);
    s.position.set(p.x, p.y - KERB.h + RAIL.y, p.z);
    s.quaternion.setFromUnitVectors(UP, _d);
    ctx.add(s);
  });
}

// ---------- islas ----------
function island(key, edge) {
  const c = STATIONS[key];
  const n = edge.pts.length;
  const pts = edge.pts.map((p) => ({ ...p, x: p.x + c.x, z: p.z + c.z }));
  const L = edge.L;
  // punto del contorno a una distancia s, desplazado hacia dentro (inset > 0) o hacia fuera (< 0)
  const at = (s, inset = 0, out = {}) => {
    const u = ((((s % L) + L) % L) / L) * n;
    const i0 = Math.floor(u) % n;
    const i1 = (i0 + 1) % n;
    const f = u - Math.floor(u);
    const a = pts[i0];
    const b = pts[i1];
    let nx = a.nx + (b.nx - a.nx) * f;
    let nz = a.nz + (b.nz - a.nz) * f;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    out.x = a.x + (b.x - a.x) * f - nx * inset;
    out.z = a.z + (b.z - a.z) * f - nz * inset;
    out.nx = nx;
    out.nz = nz;
    out.tx = a.tx + (b.tx - a.tx) * f;
    out.tz = a.tz + (b.tz - a.tz) * f;
    return out;
  };
  return { key, c, n, pts, L, top: TOP[key], floor: F[key], at, off: edge.offAt, yTop: edge.yTop, openings: [] };
}

// Intersección de la recta p + u·t (plano xz) con el contorno de una isla; devuelve la más cercana a t = 0.
function crossing(isl, px, pz, ux, uz) {
  let best = null;
  for (let i = 0; i < isl.n; i++) {
    const a = isl.pts[i];
    const b = isl.pts[(i + 1) % isl.n];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const den = ux * ez - uz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const dx = a.x - px;
    const dz = a.z - pz;
    const t = (dx * ez - dz * ex) / den;
    const w = (dx * uz - dz * ux) / den;
    if (w < -1e-6 || w > 1 + 1e-6) continue;
    if (!best || Math.abs(t) < Math.abs(best.t)) best = { t, s: (a.s + w * Math.hypot(ex, ez)) % isl.L };
  }
  return best;
}

// Rasante de cada puente: recta entre apoyos más la desviación en S que tiene la traza luminosa
// (Catmull-Rom con los puntos vecinos a la cota de cada isla), para que la cinta quede apoyada en el
// tablero en vez de hundirse o flotar. La desviación es de pocos centímetros y nula en los apoyos.
function bridgeFrames() {
  return BRIDGES.map(([a, b], i) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenH = Math.hypot(dx, dz);
    const u = new THREE.Vector3(dx / lenH, 0, dz / lenH);
    const side = new THREE.Vector3(-u.z, 0, u.x);
    const rise = b.y - a.y;
    const slope = rise / lenH;
    const y = (x) => {
      // fuera de los apoyos el tablero sigue en llano, 1,5 cm bajo la tapa (sin cuñas ni huecos en los extremos)
      if (x < 0) return a.y - 0.015;
      if (x > lenH) return b.y - 0.015;
      const s = x / lenH;
      return a.y + slope * x + (s > 0 && s < 1 ? Math.sign(rise) * s * (1 - s) * (s - 0.33) : 0);
    };
    const at = (x, l = 0, out = new THREE.Vector3()) => out.set(a.x + u.x * x + side.x * l, y(x), a.z + u.z * x + side.z * l);
    return { i, a, b, u, side, slope, lenH, y, at };
  });
}

// Cota de la cara superior del tablero en (x, z), o null fuera de los puentes. Los tableros llanos quedan
// 1,5 cm bajo la tapa de las islas (sin parpadeo); lo que se apoya en un puente (traza luminosa, baterías
// de la simulación) puede tomar aquí su altura para no flotar ni hundirse.
let FRAMES = null;
export function deckY(x, z) {
  const d = deckAt(x, z);
  return d ? d.y : null;
}

// Igual que deckY, indicando si el tablero es llano (los llanos pasan bajo la tapa de las islas en sus apoyos).
export function deckAt(x, z) {
  if (!FRAMES) FRAMES = bridgeFrames();
  for (const fr of FRAMES) {
    const dx = x - fr.a.x;
    const dz = z - fr.a.z;
    const t = dx * fr.u.x + dz * fr.u.z;
    if (t < -0.6 || t > fr.lenH + 0.6 || Math.abs(dx * fr.side.x + dz * fr.side.z) > DECK_W / 2 + 0.05) continue;
    // los extremos prolongados cuentan como llanos: dentro de una isla manda su suelo
    const level = Math.abs(fr.slope) < 1e-3;
    const flat = level || t < 0 || t > fr.lenH;
    return { y: fr.y(t) + (level ? -0.015 : 0), flat };
  }
  return null;
}

// Distancia de un punto al contorno de una isla (negativa dentro), según su forma en layout.js.
function outside(key, p) {
  const sh = PLATFORMS[key];
  const dx = p.x - STATIONS[key].x;
  const dz = p.z - STATIONS[key].z;
  return sh.kind === 'circle' ? Math.hypot(dx, dz) - sh.r : Math.max(Math.abs(dx) - sh.w / 2, Math.abs(dz) - sh.d / 2);
}

// Isla sobre la que apoya cada extremo de un puente: misma cota y el punto dentro de su forma
// (varias islas comparten cota, así que la cota sola no basta).
function islandAt(islands, p) {
  let best = null;
  for (const isl of Object.values(islands)) {
    if (Math.abs(isl.floor - p.y) > 1e-4) continue;
    const out = outside(isl.key, p);
    if (!best || out < best.out) best = { isl, out };
  }
  return best.isl;
}

// Rebaje de la tapa donde llega el extremo alto de una rampa: el tablero entra en la isla hasta su apoyo
// y enrasa con el suelo sin escalón. Devuelve, en coordenadas locales de la isla, el tramo de contorno
// que se sustituye (s0..s1) y el polígono que lo reemplaza; makePlatform corta también el canto ahí.
function rampNotches(key, pts, L, frames) {
  const c = STATIONS[key];
  const isl = island(key, { pts, L, offAt: null, yTop: 0 });
  const out = [];
  frames.forEach((fr) => {
    if (Math.abs(fr.slope) < 1e-3) return;
    const up = fr.slope > 0;
    const e = up ? fr.b : fr.a;
    if (Math.abs(F[key] - e.y) > 1e-4 || outside(key, e) > -0.05) return;
    const dir = up ? fr.u.clone().negate() : fr.u;
    const hw = DECK_W / 2;
    const cm = crossing(isl, e.x - fr.side.x * hw, e.z - fr.side.z * hw, dir.x, dir.z);
    const cp = crossing(isl, e.x + fr.side.x * hw, e.z + fr.side.z * hw, dir.x, dir.z);
    if (!cm || !cp || cm.t < 0.02 || cp.t < 0.02) return;
    const P = (l, t) => [e.x + fr.side.x * l + dir.x * t - c.x, e.z + fr.side.z * l + dir.z * t - c.z];
    const [s0, s1] = arc(L, cm.s, cp.s);
    const fwd = Math.abs(s0 - cm.s) < 1e-6 || Math.abs(s0 - cm.s - L) < 1e-6;
    const poly = [P(-hw, cm.t), P(-hw, 0), P(hw, 0), P(hw, cp.t)];
    out.push({ s0, s1, poly: fwd ? poly : poly.reverse() });
  });
  return out;
}

// Aberturas en el borde de cada isla donde entran los puentes (barandilla, bordillo y balizas).
function registerOpenings(islands, frames) {
  frames.forEach((fr) => {
    [[fr.a, fr.u, 1], [fr.b, fr.u.clone().negate(), -1]].forEach(([e, dir, sgn]) => {
      const isl = islandAt(islands, e);
      const cut = (l) => crossing(isl, e.x + fr.side.x * l, e.z + fr.side.z * l, dir.x, dir.z);
      // en la llegada alta de una rampa la tapa está rebajada: la barandilla de la isla se aparta del
      // rebaje y la del puente termina en su propio pie de remate
      const high = Math.abs(fr.slope) > 1e-3 && (fr.slope > 0) === (sgn === -1);
      const notched = high && outside(isl.key, e) < -0.05;
      const r = notched ? DECK_W / 2 + 0.2 : DECK_W / 2 - RAIL.inset;
      const k = DECK_W / 2 + 0.02;
      const rails = [cut(-r), cut(r)];
      const kerbs = [cut(-k), cut(k)];
      if (rails.some((c) => !c) || kerbs.some((c) => !c)) return;
      isl.openings.push({ bridge: fr.i, end: sgn, notched, rail: rails.map((c) => c.s), kerb: kerbs.map((c) => c.s) });
    });
  });
}

// Intervalo [s0, s1] (con s1 > s0, puede pasar de L) más corto que une dos posiciones del contorno.
function arc(L, s0, s1) {
  let a = s0;
  let b = s1;
  if (b < a) [a, b] = [b, a];
  if (b - a > L / 2) return [b, a + L];
  return [a, b];
}

// Tramos libres del contorno (complemento de las aberturas) para un tipo de pieza.
function runs(isl, kind) {
  const L = isl.L;
  const cuts = isl.openings.map((o) => arc(L, o[kind][0], o[kind][1])).sort((x, y) => x[0] - y[0]);
  if (!cuts.length) return [[0, L, true]];
  const merged = [];
  cuts.forEach(([a, b]) => {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  });
  const out = [];
  for (let i = 0; i < merged.length; i++) {
    const end = merged[i][1];
    const next = i + 1 < merged.length ? merged[i + 1][0] : merged[0][0] + L;
    if (next - end > 0.05) out.push([end, next, false]);
  }
  return out;
}

// ---------- pasillo de cámara ----------
// camera.js es de solo lectura para el mundo, pero sus nudos permiten que la vegetación, las rocas y
// los focos nunca se acerquen a la trayectoria ni tapen la mirada al sujeto en las ventanas de lectura:
// si la coreografía cambia, el borde se adapta solo.
function cameraGuard() {
  const keys = CAM.KEYS;
  if (!Array.isArray(keys) || keys.length < 2) return { pts: [], free: () => true };
  const posC = new THREE.CatmullRomCurve3(keys.map((k) => k.p), false, 'centripetal');
  const subC = new THREE.CatmullRomCurve3(keys.map((k) => k.s), false, 'centripetal');
  const pts = posC.getSpacedPoints(2400);
  const CELL = 4;
  const grid = new Map();
  pts.forEach((p) => {
    const k = `${Math.floor(p.x / CELL)}|${Math.floor(p.z / CELL)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  });
  const windows = new Map();
  keys.forEach((k, i) => {
    if (k.ch === undefined) return;
    const w = windows.get(k.ch) || {};
    w[k.role] = i;
    windows.set(k.ch, w);
  });
  const sights = [];
  windows.forEach((w) => {
    const a = w.in ?? w.anchor;
    const b = w.out ?? w.anchor;
    for (let k = a; k <= b + 1e-6; k += 0.2) {
      const t = Math.min(k, keys.length - 1) / (keys.length - 1);
      sights.push(new THREE.Line3(posC.getPoint(t), subC.getPoint(t)));
    }
  });
  const q = new THREE.Vector3();
  const c = new THREE.Vector3();
  return {
    pts,
    // esfera (centro, radio) que envuelve el objeto
    free(x, y, z, r, margin = 1.4) {
      const R = r + margin;
      for (let i = Math.floor((x - R) / CELL); i <= Math.floor((x + R) / CELL); i++) {
        for (let j = Math.floor((z - R) / CELL); j <= Math.floor((z + R) / CELL); j++) {
          const list = grid.get(`${i}|${j}`);
          if (!list) continue;
          for (const p of list) if ((p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 < R * R) return false;
        }
      }
      q.set(x, y, z);
      for (const s of sights) {
        s.closestPointToPoint(q, true, c);
        if (c.distanceToSquared(q) < (r + 0.35) ** 2 && c.distanceTo(s.end) > 1.5) return false;
      }
      return true;
    },
  };
}

// Cuánto ve la cámara cada tramo de acantilado: el detalle se concentra donde se aprecia.
function viewWeight(guard, x, y, z, nx, nz) {
  let w = 0;
  for (let i = 0; i < guard.pts.length; i += 6) {
    const p = guard.pts[i];
    const dx = p.x - x;
    const dy = p.y - y;
    const dz = p.z - z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 70 || d < 0.5) continue;
    const facing = (dx * nx + dz * nz) / d;
    if (facing <= 0.1) continue;
    w += facing * (d < 18 ? 1 : (70 - d) / 52);
  }
  // las vistas generales de portada y cierre miran desde el sur
  return Math.min(1, w / 12 + Math.max(0, nz) * 0.35);
}

// Cajas de lo que ya han construido las estaciones: el mobiliario de borde no las atraviesa.
function occupancy(root) {
  root.updateMatrixWorld(true);
  const boxes = [];
  const m = new THREE.Matrix4();
  const w = new THREE.Matrix4();
  const skip = (o) => {
    for (let p = o; p; p = p.parent) if (p.userData.noCollide) return true;
    return false;
  };
  root.children.forEach((g) => {
    const name = g.userData.station;
    if (!name || name === 'terreno' || name === 'bordes') return;
    g.traverse((o) => {
      if (!o.isMesh || skip(o)) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat && mat.transparent && mat.opacity < 0.05) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const add = (mw) => {
        const b = o.geometry.boundingBox.clone().applyMatrix4(mw);
        if (b.max.x - b.min.x < 36 && b.max.z - b.min.z < 36) boxes.push(b);
      };
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          add(w.multiplyMatrices(o.matrixWorld, m));
        }
      } else add(o.matrixWorld);
    });
  });
  return {
    hit(x, z, y0, y1, r = 0.06) {
      for (const b of boxes) {
        if (x > b.min.x - r && x < b.max.x + r && z > b.min.z - r && z < b.max.z + r && y1 > b.min.y && y0 < b.max.y) return true;
      }
      return false;
    },
  };
}

// ---------- puentes ----------
function buildBridge(ctx, fr, islands, mats, glassList) {
  const { K, M } = ctx;
  const P = railParts(K);
  const isA = islandAt(islands, fr.a);
  const isB = islandAt(islands, fr.b);
  const flat = Math.abs(fr.slope) < 1e-3;
  const dTop = flat ? -0.015 : 0; // los tableros llanos quedan 1,5 cm bajo la tapa: sin parpadeo
  const deck = (x) => fr.y(x) + dTop;
  const grade = (x) => (fr.y(x + 0.1) - fr.y(x - 0.1)) / 0.2;
  // tramo de cada línea lateral entre los dos contornos
  const span = (l) => {
    const cA = crossing(isA, fr.a.x + fr.side.x * l, fr.a.z + fr.side.z * l, fr.u.x, fr.u.z);
    const cB = crossing(isB, fr.b.x + fr.side.x * l, fr.b.z + fr.side.z * l, -fr.u.x, -fr.u.z);
    return [cA ? cA.t : 0, fr.lenH - (cB ? cB.t : 0)];
  };
  const hw = DECK_W / 2;
  const edgeA = Math.min(span(-hw)[0], span(hw)[0]);
  const edgeB = Math.max(span(-hw)[1], span(hw)[1]);
  const inA = outside(isA.key, fr.a) < -0.05;
  const inB = outside(isB.key, fr.b) < -0.05;

  // tablero: el extremo bajo se mete bajo la tapa de su isla; el alto llega a su apoyo por el rebaje
  // de la tapa (rampNotches) y enrasa allí con el suelo
  let x0 = edgeA - 0.12;
  let x1 = edgeB + 0.12;
  if (!flat) {
    const up = fr.slope > 0;
    x0 = up ? Math.min(-0.5, edgeA - 0.12) : inA ? 0 : edgeA - 0.02;
    x1 = up ? (inB ? fr.lenH : edgeB + 0.02) : Math.max(fr.lenH + 0.5, edgeB + 0.12);
  }
  const unit = K.geo('bridgeUnit', () => new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0));
  // tablero de piedra prefabricada sin juntas propias: las juntas son tiras transversales cada 2,4 m que
  // siguen al puente (no a los ejes del mundo) y quedan bajo los bordillos
  chords(x0, x1, 0.9, [0, fr.lenH]).forEach(([xa, xb]) => ctx.add(chordPiece(unit, mats.stone, fr, xa, xb, 0, dTop, 0.45, DECK_W)));
  const mid = (x0 + x1) / 2;
  for (let k = -Math.floor((mid - x0 - 0.4) / JOINT_STEP); mid + k * JOINT_STEP < x1 - 0.4; k++) {
    const x = mid + k * JOINT_STEP;
    ctx.add(chordPiece(unit, M.rubber, fr, x - 0.006, x + 0.006, 0, dTop + 0.003, 0.006, DECK_W - 0.1));
  }
  // cantos del tablero: banda saliente que dibuja la línea del puente
  [-1, 1].forEach((sd) => {
    const [fa, fb] = span(sd * hw);
    chords(fa, fb, 0.9, [0, fr.lenH]).forEach(([xa, xb]) => ctx.add(chordPiece(unit, mats.stone, fr, xa, xb, sd * (hw + 0.035), dTop + 0.005, 0.56, 0.07)));
    // mejillas del rebaje: cierran el hueco entre el tablero y la tapa dentro de la isla alta
    if (!flat) {
      const up = fr.slope > 0;
      const yHi = (up ? isB.floor : isA.floor) - 0.008;
      const [ca, cb] = up ? [fb, fr.lenH] : [0, fa];
      if ((up ? inB : inA) && cb - ca > 0.02) ctx.add(chordPiece(unit, mats.stone, fr, ca, cb, sd * (hw + 0.06), 0, 0.62, 0.12, { yf: () => yHi }));
    }
  });

  // vigas o pilas según la luz
  if (fr.lenH > 9) {
    const np = Math.floor(fr.lenH / 7.4);
    const yaw = Math.atan2(-fr.u.z, fr.u.x);
    for (let k = 1; k <= np; k++) {
      const x = (fr.lenH * k) / (np + 1);
      const yTop = deck(x) - 0.43;
      const head = K.box(0.62, 0.36, 3.1, M.concrete, 0, 0, 0);
      const c = fr.at(x, 0);
      head.position.set(c.x, yTop - 0.18 + 0.1, c.z);
      head.rotation.y = yaw;
      ctx.add(head);
      [-1, 1].forEach((sd) => {
        const p = fr.at(x, sd * 1.02);
        const h = yTop - 0.26 - (WATER_Y - 0.4);
        ctx.add(K.rbox(0.42, h, 0.42, M.concrete, p.x, WATER_Y - 0.4, p.z, 0.04));
      });
    }
  } else {
    [-1, 1].forEach((sd) => chords(edgeA, edgeB, 0.9).forEach(([xa, xb]) => ctx.add(chordPiece(unit, M.concrete, fr, xa, xb, sd * 1.05, dTop - 0.44, 0.3, 0.26))));
  }

  // bordillo por piezas a ambos lados, siguiendo la rasante
  const lk = hw - KERB.w / 2;
  const len3 = Math.sqrt(1 + fr.slope * fr.slope);
  [-1, 1].forEach((sd) => {
    const [ka, kb] = span(sd * lk);
    const n = Math.max(1, Math.round(((kb - ka) * len3) / 0.98));
    const step = (kb - ka) / n;
    const gap = 0.03 / len3;
    for (let k = 0; k < n; k++) {
      const xa = ka + k * step + gap / 2;
      const xb = ka + (k + 1) * step - gap / 2;
      ctx.add(chordPiece(kerbGeo(K, xb - xa), mats.kerb, fr, xa, xb, sd * lk, dTop, 1, 1, { sized: true }));
    }
  });

  // pasamanos: arranca en los pies de remate de cada isla y sigue el tablero
  const lr = hw - RAIL.inset;
  const oA = isA.openings.find((o) => o.bridge === fr.i && o.end === 1);
  const oB = isB.openings.find((o) => o.bridge === fr.i && o.end === -1);
  const along = (p) => (p.x - fr.a.x) * fr.u.x + (p.z - fr.a.z) * fr.u.z;
  const glassGeo = K.geo('glassPanel', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const shoe = K.geo('bridgeShoe', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  [-1, 1].forEach((sd, idx) => {
    const [ra, rb] = span(sd * lr);
    const posts = [];
    const n = Math.max(1, Math.round(((rb - ra) * len3) / 1.85));
    for (let k = 0; k <= n; k++) {
      const x = ra + ((rb - ra) * k) / n;
      const p = fr.at(x, sd * lr);
      posts.push({ x: p.x, y: deck(x) + KERB.h, z: p.z, ok: true });
    }
    // los extremos son los pies de remate que la isla coloca en la entrada (salvo en un rebaje)
    if (oA && !oA.notched) {
      const j = isA.at(oA.rail[idx], RAIL.inset);
      Object.assign(posts[0], { x: j.x, z: j.z, y: isA.floor + KERB.h, shared: true });
    }
    if (oB && !oB.notched) {
      const j = isB.at(oB.rail[idx], RAIL.inset);
      Object.assign(posts[n], { x: j.x, z: j.z, y: isB.floor + KERB.h, shared: true });
    }
    railRun(ctx, P, posts, { mid: !fr.glass });
    if (fr.glass) {
      // vidrio entre pies con zapata metálica: una sola malla instanciada para todo el puente
      for (let k = 0; k < n; k++) {
        const xa = along(posts[k]) + 0.05;
        const xb = along(posts[k + 1]) - 0.05;
        if (xb - xa < 0.1) continue;
        glassList.push(chordMatrix(fr, xa, xb, sd * (lr - 0.005), dTop + KERB.h + 0.08, 0.66, 0.016).clone());
        ctx.add(chordPiece(shoe, M.darkSteel, fr, xa - 0.05, xb + 0.05, sd * (lr - 0.005), dTop + KERB.h, 0.08, 0.06));
      }
    }
  });

  // balizas sobre el bordillo, alternando lados; el charco de luz cae sobre el tablero
  const nl = Math.max(2, Math.round(((edgeB - edgeA) * len3) / 3.4));
  for (let k = 0; k < nl; k++) {
    const sd = k % 2 ? 1 : -1;
    const x = edgeA + ((edgeB - edgeA) * (k + 0.5)) / nl;
    const g = grade(x);
    const p = fr.at(x, sd * (hw - 0.29));
    const q = fr.at(x, sd * 0.55);
    ctx.lamps.push({
      x: p.x, y: deck(x) + KERB.h - Math.abs(g) * 0.1, z: p.z,
      r: Math.atan2(-fr.u.z, fr.u.x), ox: q.x - p.x, oz: q.z - p.z, fy: deck(x) + 0.012, pool: 2.1,
      nrm: new THREE.Vector3(-g * fr.u.x, 1, -g * fr.u.z).normalize(),
      rim: true,
    });
    // reflejo en el agua, junto al canto del tablero
    const w = fr.at(x, sd * (hw + 0.55));
    mats.streaks.push({ x: w.x, z: w.z, nx: fr.side.x * sd, nz: fr.side.z * sd, len: 2.8 + Math.min(1.6, (deck(x) - WATER_Y) * 0.12), w: 0.26, k: 0.6 });
  }
}

// ---------- terreno ----------
export function buildTerrain(ctx) {
  const { K, M } = ctx;
  const E = edgeMaterials();
  const water = new THREE.Mesh(new THREE.CircleGeometry(1600, 96), E.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  water.userData.noCollide = true;
  ctx.add(water);

  const frames = bridgeFrames();
  frames[frames.length - 1].glass = true; // el puente largo hacia el centro lleva antepecho de vidrio
  const islands = {};
  Object.entries(PLATFORMS).forEach(([key, shape], i) => {
    const s = shape.kind === 'circle' ? K.circleShape(shape.r) : K.roundedRect(shape.w, shape.d, shape.r);
    const p = K.makePlatform(M, s, TOP[key], {
      seed: 3 + i * 7,
      notch: (pts, L) => rampNotches(key, pts, L, frames),
      cliffMat: E.cliff,
      fasciaMat: E.stone,
    });
    p.position.set(STATIONS[key].x, 0, STATIONS[key].z);
    ctx.add(p);
    islands[key] = island(key, p.userData.edge);
  });

  // bordillo, canto de losa y tableros en la misma piedra clara (una sola llamada de dibujo)
  const mats = { kerb: E.stone, stone: E.stone, boulder: E.boulder, streaks: [] };

  registerOpenings(islands, frames);
  const glass = [];
  frames.forEach((fr) => buildBridge(ctx, fr, islands, mats, glass));
  if (glass.length) {
    const im = new THREE.InstancedMesh(K.geo('glassPanel', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), M.glass, glass.length);
    glass.forEach((m, i) => im.setMatrixAt(i, m));
    im.renderOrder = 3;
    ctx.add(im);
  }
  shared = { islands, frames, mats };
}

// ---------- bordes (después de las estaciones) ----------
function islandFurniture(ctx, isl, occ, mats) {
  const { K } = ctx;
  const P = railParts(K);
  const fl = isl.floor;
  const pa = {};
  const pb = {};
  // bordillo por piezas
  runs(isl, 'kerb').forEach(([s0, s1]) => {
    const len = s1 - s0;
    const n = Math.max(1, Math.round(len / KERB.len));
    for (let k = 0; k < n; k++) {
      const a = isl.at(s0 + (k * len) / n, KERB.inset, pa);
      const b = isl.at(s0 + ((k + 1) * len) / n, KERB.inset, pb);
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      if (occ.hit(mx, mz, fl + 0.07, fl + KERB.h, 0.12) || occ.hit(a.x, a.z, fl + 0.07, fl + KERB.h, 0.03) || occ.hit(b.x, b.z, fl + 0.07, fl + KERB.h, 0.03)) continue;
      const m = new THREE.Mesh(kerbGeo(K, Math.hypot(b.x - a.x, b.z - a.z) - 0.03), mats.kerb);
      m.position.set(mx, fl, mz);
      m.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      ctx.add(m);
    }
  });
  // pasamanos con pies embridados cada ~2 m; remates en las entradas de los puentes
  runs(isl, 'rail').forEach(([s0, s1, loop]) => {
    const len = s1 - s0;
    const n = Math.max(1, Math.round(len / RAIL.step));
    const posts = [];
    for (let k = 0; k <= n; k++) {
      const a = isl.at(s0 + (k * len) / n, RAIL.inset);
      a.y = fl + KERB.h;
      a.ok = !occ.hit(a.x, a.z, fl + 0.15, fl + RAIL.y + 0.05, 0.06);
      a.shared = loop && k === n;
      posts.push(a);
    }
    for (let k = 0; k < n; k++) {
      const a = posts[k];
      const b = posts[k + 1];
      if (occ.hit((a.x + b.x) / 2, (a.z + b.z) / 2, fl + 0.3, fl + RAIL.y + 0.05, 0.03)) a.cut = true;
    }
    railRun(ctx, P, posts);
  });
  // balizas en el suelo, a ambos lados de cada entrada y repartidas por los tramos; cada una deja su
  // reflejo en el agua al pie del acantilado
  const lamp = (s) => {
    const a = isl.at(s, LAMP.inset);
    if (occ.hit(a.x, a.z, fl + 0.07, fl + 0.65, 0.16)) return;
    ctx.lamps.push({ x: a.x, y: fl, z: a.z, r: Math.atan2(-a.tz, a.tx), ox: -a.nx * 0.5, oz: -a.nz * 0.5, fy: fl + 0.012, rim: true });
    mats.streaks.push(rimStreak(isl, s, 0.62));
  };
  runs(isl, 'kerb').forEach(([s0, s1]) => {
    const len = s1 - s0;
    if (len < 1.6) return;
    lamp(s0 + 0.55);
    lamp(s1 - 0.55);
    const n = Math.round((len - 1.1) / LAMP.step);
    for (let k = 1; k < n; k++) lamp(s0 + 0.55 + ((len - 1.1) * k) / n);
  });
}

// Reflejo de una luz del borde de la isla en la posición s del contorno: nace en el agua, delante del
// pie del acantilado, y es más largo cuanto más alta está la luz.
function rimStreak(isl, s, k) {
  const a = isl.at(s, 0);
  const w = isl.at(s, -(isl.off(s, WATER_Y + 0.05) + 0.55));
  return { x: w.x, z: w.z, nx: a.nx, nz: a.nz, len: 2.8 + Math.min(1.8, (isl.floor - WATER_Y) * 0.14), w: 0.26, k };
}

// Posición s del contorno más cercana a un punto.
function nearestS(isl, x, z) {
  let best = 0;
  let bd = Infinity;
  isl.pts.forEach((p) => {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = p.s;
    }
  });
  return best;
}

// Jardineras en las esquinas libres de las islas rectangulares (como en ref-cruce-rutas).
function cornerPlanters(ctx, isl, occ, guard, trees, rnd, mats) {
  const { K, M } = ctx;
  const shape = PLATFORMS[isl.key];
  if (shape.kind !== 'rect') return;
  const fl = isl.floor;
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    let best = null;
    isl.pts.forEach((p) => {
      const d = p.nx * sx * Math.SQRT1_2 + p.nz * sz * Math.SQRT1_2;
      if (!best || d > best.d) best = { d, s: p.s };
    });
    const c = isl.at(best.s, 1.5);
    if (occ.hit(c.x, c.z, fl + 0.07, fl + 2.6, 0.75)) return;
    if (!guard.free(c.x, fl + 1.7, c.z, 0.95) || !guard.free(c.x, fl + 0.4, c.z, 0.7)) return;
    ctx.add(K.rbox(1.15, 0.48, 1.15, mats.stone, c.x, fl, c.z, 0.05));
    ctx.add(K.box(0.99, 0.04, 0.99, M.trunk, c.x, fl + 0.44, c.z));
    trees.push({ x: c.x, y: fl + 0.46, z: c.z, s: 0.72 + rnd() * 0.12, kind: 'tree', r: rnd() * 6.28 });
    trees.push({ x: c.x + 0.28, y: fl + 0.46, z: c.z - 0.22, s: 0.55, kind: 'low', r: rnd() * 6.28 });
    trees.push({ x: c.x - 0.25, y: fl + 0.46, z: c.z + 0.26, s: 0.5, kind: 'low', r: rnd() * 6.28 });
    ctx.shadows.push({ x: c.x, y: fl, z: c.z, w: 1.7, d: 1.7 });
  });
}

// Vegetación, rocas y focos de cada acantilado; la densidad sigue a lo que ve la cámara.
function plantIsland(isl, guard, nearBridge, rnd, out) {
  const { L, top } = isl;
  const vis = [];
  const VN = Math.max(8, Math.round(L / 1.5));
  for (let i = 0; i < VN; i++) {
    const a = isl.at((i / VN) * L, 0);
    vis.push(viewWeight(guard, a.x, top - 1, a.z, a.nx, a.nz));
  }
  const vAt = (s) => vis[Math.floor((((s % L) + L) % L) / L * VN) % VN];
  const pt = {};
  // árboles pequeños que crecen del acantilado y se inclinan hacia fuera
  const treeS = [];
  for (let s = rnd() * 4; s < L; s += 3.4 + rnd() * 3) {
    const v = vAt(s);
    if (v < 0.3 || rnd() > 0.15 + 0.6 * v) continue;
    // la copa (≈ 2 × escala de alto) queda bajo el canto de losa: no se mete en la losa ni asoma a trozos
    const sc = 0.7 + rnd() * 0.42;
    const y = Math.min(top - 0.95 - rnd() * 0.7, top - 0.35 - 2 * sc);
    if (y < WATER_Y + 0.4) continue;
    const o = isl.off(s, y);
    const a = isl.at(s, -(Math.max(0.1, o) + 0.05), pt);
    const lean = 0.28 + rnd() * 0.2;
    const reach = 1.5 * sc * Math.sin(lean);
    const cx = a.x + a.nx * reach;
    const cz = a.z + a.nz * reach;
    const cy = y + 1.5 * sc * Math.cos(lean);
    if (nearBridge(cx, cz, 1.2) || !guard.free(cx, cy, cz, 0.8 * sc) || !guard.free(a.x, y + 0.6 * sc, a.z, 0.35)) continue;
    out.trees.push({ x: a.x, y, z: a.z, s: sc, kind: 'tree', r: Math.atan2(a.nx, a.nz), lean });
    treeS.push(s);
  }
  // corona: seto casi continuo bajo el canto de losa en las caras que se ven (piezas alargadas a lo largo
  // del borde, sin tapar la banda de piedra) y matas que se descuelgan por la roca; deja hueco a la copa de
  // los árboles del acantilado para que se lea entera y no como un grumo suelto sobre el seto
  const nearTree = (s) => treeS.some((t) => {
    const w = (((s - t) % L) + L) % L;
    return Math.min(w, L - w) < 0.6;
  });
  for (let s = rnd() * 1.5; s < L; s += 0.85 + rnd() * 0.9) {
    const v = vAt(s);
    if ((v < 0.2 && rnd() > 0.45) || nearTree(s)) continue;
    const y = top - 0.66 + rnd() * 0.1;
    const a = isl.at(s, -(Math.max(0.08, isl.off(s, y + 0.25)) + 0.2 + rnd() * 0.2), pt);
    const sc = 0.66 + rnd() * 0.22 + v * 0.16;
    const sx = 1.6 + rnd() * 0.5;
    if (!nearBridge(a.x, a.z, 0.8) && guard.free(a.x, y + 0.35 * sc, a.z, 0.6 * sc * sx)) {
      out.trees.push({ x: a.x, y, z: a.z, s: sc, sx, kind: 'shrub', r: Math.atan2(-a.tz, a.tx) + (rnd() - 0.5) * 0.35 });
    }
    if (rnd() < 0.3 + 0.45 * v) {
      const s2 = s + (rnd() - 0.5) * 0.9;
      const y2 = top - 0.95 - rnd() * 0.55;
      const b = isl.at(s2, -(isl.off(s2, y2) + 0.04), pt);
      if (!nearBridge(b.x, b.z, 0.6) && guard.free(b.x, y2 + 0.2, b.z, 0.45)) out.trees.push({ x: b.x, y: y2, z: b.z, s: 0.85 + rnd() * 0.5, kind: 'low', r: Math.atan2(b.nx, b.nz), lean: 0.3 + rnd() * 0.35 });
    }
  }
  // repisas entre bancos de estrato: matas (y algún arbusto) justo encima de cada escalón de la roca
  for (let s = rnd(); s < L; s += 0.8 + rnd() * 0.5) {
    const v = vAt(s);
    let prev2 = 0;
    let prev = 0;
    for (let y = -2.3; y < isl.yTop - 0.4; y += 0.12) {
      const shelf = (isl.off(s, y - 0.2) - isl.off(s, y + 0.2)) / 0.4;
      const width = prev;
      const peak = width >= 0.35 && width > prev2 && shelf < width;
      prev2 = prev;
      prev = shelf;
      // máximo local del escalón (medido en la muestra anterior): una sola mata por repisa
      if (!peak || rnd() > 0.2 + 0.65 * v) continue;
      const yy = y - 0.12;
      const a = isl.at(s, -(isl.off(s, yy + 0.05) + 0.06), pt);
      const kind = rnd() < 0.8 ? 'low' : 'shrub';
      const sc = kind === 'low' ? 0.8 + rnd() * 0.6 : 0.55 + rnd() * 0.35;
      if (nearBridge(a.x, a.z, 0.6) || !guard.free(a.x, yy + 0.2, a.z, 0.55 * sc)) continue;
      out.trees.push({ x: a.x, y: yy - 0.05, z: a.z, s: sc, kind, r: rnd() * 6.28 });
      // en los acantilados altos, algún árbol en las repisas anchas
      if (width > 0.9 && yy < isl.yTop - 1.8 && isl.yTop - WATER_Y > 5 && rnd() < 0.08 + 0.18 * v) {
        const st = 0.6 + rnd() * 0.35;
        if (guard.free(a.x, yy + 1.4 * st, a.z, 0.8 * st)) out.trees.push({ x: a.x, y: yy - 0.1, z: a.z, s: st, kind: 'tree', r: Math.atan2(a.nx, a.nz), lean: 0.12 + rnd() * 0.15 });
      }
    }
  }
  // pie del acantilado: bloques en el agua con matas entre ellos
  for (let s = rnd() * 2; s < L; s += 1.4 + rnd() * 1.4) {
    const v = vAt(s);
    if (rnd() > 0.3 + 0.6 * v) continue;
    const base = isl.off(s, -2.35);
    const a = isl.at(s, -(base + 0.25 + rnd() * 0.75), pt);
    if (nearBridge(a.x, a.z, 0.4)) continue;
    const big = rnd() < 0.28 + 0.25 * v;
    const sc = big ? 0.75 + rnd() * 0.65 : 0.38 + rnd() * 0.42;
    if (!guard.free(a.x, WATER_Y + 0.3, a.z, sc * 1.3)) continue;
    out.rocks.push({ x: a.x, y: WATER_Y - 0.12 + rnd() * 0.22, z: a.z, s: sc, v: big ? (rnd() < 0.5 ? 0 : 1) : 2, r: rnd() * 6.28 });
    const nb = rnd() < 0.4 + 0.45 * v ? 1 + Math.floor(rnd() * (1 + v * 1.5)) : 0;
    for (let k = 0; k < nb; k++) {
      const b = isl.at(s + (rnd() - 0.5) * 1.4, -(base + 0.1 + rnd() * 0.25), pt);
      out.trees.push({ x: b.x, y: WATER_Y + 0.25 + rnd() * 0.3, z: b.z, s: 0.55 + rnd() * 0.45, kind: rnd() < 0.6 ? 'shrub' : 'low', r: rnd() * 6.28 });
    }
  }
  // árboles al pie del acantilado, sobre el talud: dan volumen a la isla en las vistas generales
  for (let s = rnd() * 5; s < L; s += 5 + rnd() * 5) {
    const v = vAt(s);
    if (v < 0.4 || rnd() > 0.2 + 0.6 * v) continue;
    const y = WATER_Y + 0.35;
    const a = isl.at(s, -(isl.off(s, y) + 0.15), pt);
    const sc = 0.85 + rnd() * 0.45;
    const lean = 0.08 + rnd() * 0.14;
    const reach = 1.5 * sc * Math.sin(lean);
    if (nearBridge(a.x, a.z, 1.2) || !guard.free(a.x + a.nx * reach, y + 1.45 * sc, a.z + a.nz * reach, 0.85 * sc)) continue;
    out.trees.push({ x: a.x, y, z: a.z, s: sc, kind: 'tree', r: Math.atan2(a.nx, a.nz), lean });
    out.rocks.push({ x: a.x, y: WATER_Y - 0.1, z: a.z, s: 0.7, v: rnd() < 0.5 ? 0 : 1, r: rnd() * 6.28, sy: 0.9 });
  }
  // bloques encajados en la pared de los acantilados altos (rompen la silueta)
  if (isl.yTop - WATER_Y > 5) {
    for (let s = rnd() * 3; s < L; s += 3.5 + rnd() * 3) {
      const v = vAt(s);
      if (rnd() > 0.25 + 0.6 * v) continue;
      const y = WATER_Y + 1 + rnd() * (isl.yTop - WATER_Y - 2.4);
      const a = isl.at(s, -(isl.off(s, y) + 0.05), pt);
      const sc = 0.6 + rnd() * 0.6;
      if (nearBridge(a.x, a.z, 0.8) || !guard.free(a.x, y, a.z, sc * 1.2)) continue;
      out.rocks.push({ x: a.x, y, z: a.z, s: sc, v: rnd() < 0.5 ? 0 : 1, r: rnd() * 6.28, sy: 0.8 });
    }
  }
  // focos cálidos al pie de las caras más vistas, montados sobre su bloque para que la lente se vea
  // desde el recorrido; la luz la pinta el sombreador de la roca (ver uplit)
  for (let s = rnd() * 6; s < L; s += 8 + rnd() * 6) {
    if (out.fixtures.length >= UPLIGHTS) break;
    const v = vAt(s);
    if (v < 0.5) continue;
    const a = isl.at(s, -(isl.off(s, WATER_Y + 0.1) + 0.5), {});
    if (nearBridge(a.x, a.z, 1) || !guard.free(a.x, WATER_Y + 0.35, a.z, 0.6)) continue;
    out.rocks.push({ x: a.x, y: WATER_Y - 0.06, z: a.z, s: 0.5, v: 2, r: rnd() * 6.28, sy: 0.9 });
    out.fixtures.push({ x: a.x, y: WATER_Y + 0.12, z: a.z, nx: a.nx, nz: a.nz });
  }
}

export function buildEdges(ctx) {
  const { K, M } = ctx;
  if (!shared) return;
  const { islands, frames, mats } = shared;
  const guard = cameraGuard();
  const occ = occupancy(ctx.group.parent);
  const rnd = rng(20261021);
  const out = { trees: [], rocks: [], fixtures: [] };

  // nada bajo los tableros ni junto a las pilas
  const nearBridge = (x, z, r) => frames.some((fr) => {
    const dx = x - fr.a.x;
    const dz = z - fr.a.z;
    const t = dx * fr.u.x + dz * fr.u.z;
    if (t < -0.6 || t > fr.lenH + 0.6) return false;
    return Math.abs(dx * fr.side.x + dz * fr.side.z) < DECK_W / 2 + 0.35 + r;
  });

  // reflejos de las balizas que las estaciones colocan junto al borde de su isla
  ctx.lamps.forEach((l) => {
    if (l.rim) return;
    const isl = Object.values(islands).find((s) => Math.abs(s.floor - l.y) < 0.08 && Math.abs(outside(s.key, l) + 0.5) < 0.8);
    if (isl) mats.streaks.push(rimStreak(isl, nearestS(isl, l.x, l.z), 0.55));
  });

  Object.values(islands).forEach((isl) => {
    islandFurniture(ctx, isl, occ, mats);
    cornerPlanters(ctx, isl, occ, guard, out.trees, rnd, mats);
    plantIsland(isl, guard, nearBridge, rnd, out);
  });

  // la vegetación (material de hojas compartido por todo el mundo) recibe la luz de los focos en su
  // sombreador; lejos de ellos el término es nulo
  const veg = K.scatterTrees(M, out.trees);
  if (veg.userData.leaf) uplit(veg.userData.leaf, 'leaf');
  ctx.add(veg);
  ctx.add(K.scatterRocks(M, out.rocks, { mat: mats.boulder }));

  // focos: cuerpo grafito con lente cálida (piezas fijas, se fusionan), inclinados hacia la pared
  const body = K.geo('uplightBody', () => new THREE.CylinderGeometry(0.075, 0.085, 0.16, 10).translate(0, 0.08, 0));
  const lens = K.geo('uplightLens', () => new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10).translate(0, 0.165, 0));
  const axis = new THREE.Vector3();
  const dir = new THREE.Vector3();
  out.fixtures.forEach((f, i) => {
    const tilt = new THREE.Quaternion().setFromAxisAngle(axis.set(f.nz, 0, -f.nx), -0.45);
    [[body, M.graphite], [lens, M.warmGlow]].forEach(([g, mat]) => {
      const m = new THREE.Mesh(g, mat);
      m.position.set(f.x, f.y, f.z);
      m.quaternion.copy(tilt);
      ctx.add(m);
    });
    dir.set(0, 1, 0).applyQuaternion(tilt);
    upU.uUpPos.value[i].set(f.x, f.y, f.z).addScaledVector(dir, 0.2);
    upU.uUpDir.value[i].copy(dir);
    mats.streaks.push({ x: f.x + f.nx * 0.45, z: f.z + f.nz * 0.45, nx: f.nx, nz: f.nz, len: 3.8, w: 0.34, k: 1 });
  });
  upU.uUpGrid.value = upGrid(out.fixtures);

  buildStreaks(ctx, mats.streaks);
}

export { V };
