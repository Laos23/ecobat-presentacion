import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CH } from '../chapters.js';
import { ACCESS } from '../layout.js';
import { makePerson, makeTruck, makeIngotStack, makePelletBag } from '../actors.js';

// 7 · Gestor autorizado de reciclaje de plomo-ácido (isla s5). Referencia: context/ref-reciclaje.png.
// Etapas rotuladas, en el orden del proceso (hechos proceso_reciclaje-f1, f4-f7 y f19):
//   1 Drenaje del electrolito (tanque junto a la recepción) → 2 Trituración (torre) → 3 Separación (nave del
//   sureste: rejillas, pasta y polipropileno a sus contenedores) → 4 Desulfuración de la pasta (reactor; el
//   sulfato de sodio sale en sacos) → 5 Fundición (horno rotativo) → 6 Refino (calderos) → 7 Colada (lingoteras).
// Salidas: pilas de lingotes de plomo y big bags de granza de polipropileno, que un camión lleva por la calzada
// este a la fábrica de baterías nuevas (desde el tramo de trazabilidad hasta el cierre). Sin cobre: una batería
// de plomo-ácido no lo contiene (§9.6 de las ideas).
// Recepción con palés en espera y caseta de control, cinta con rodillos grandes a la vista que entra
// en la trituradora por una boca a contraluz, torre de plataformas con barandillas ámbar, conductos de
// acero con codos y bridas hacia el filtro de mangas, elevador y puente de cinta cerrado (por encima del paso
// del camión) hasta la nave de separación, tolva que vierte plástico triturado, contenedores galvanizados y
// valla de barrotes que deja ver el borde iluminado de la isla.
// Rendimiento: solo materiales de M (y los clones que la estación ya tenía), sin luces nuevas, geometría
// en caché, repeticiones instanciadas y lo que se mueve (camión, lingoteras) compactado o instanciado.

// Tronco de pirámide abierto (contenedores y tolvas): caras planas, sin tapas.
function frustumShell(wTop, dTop, taper, h, inward = false) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * taper, 1, 4, 1, true).rotateY(Math.PI / 4).toNonIndexed();
  g.scale(wTop, h, dTop);
  g.translate(0, h / 2, 0);
  if (inward) {
    // invierte cada triángulo para que la cara visible sea la interior
    ['position', 'uv'].forEach((k) => {
      const a = g.attributes[k];
      for (let i = 0; i < a.count; i += 3) {
        for (let c = 0; c < a.itemSize; c++) {
          const v = a.getComponent(i + 1, c);
          a.setComponent(i + 1, c, a.getComponent(i + 2, c));
          a.setComponent(i + 2, c, v);
        }
      }
    });
  }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

// Lingote de plomo: prisma con la cara superior más estrecha (brillos en los cantos).
function ingotGeometry() {
  const g = new THREE.BoxGeometry(0.34, 0.11, 0.15).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * 0.84, p.getY(i), p.getZ(i) * 0.72);
  g.computeVertexNormals();
  return g;
}

// Trozo de rejilla o borne de plomo (fracción metálica de la separación): caja con las esquinas desplazadas
// (la misma esquina se mueve igual en cada cara), unos 11 cm, para que el montón no parezca de cajas.
function nuggetGeometry() {
  const g = new THREE.BoxGeometry(0.11, 0.065, 0.09);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = Math.sin(x * 91.7 + y * 47.3 + z * 13.1);
    p.setXYZ(i, x * (1 + 0.28 * h), y * (1 + 0.3 * Math.cos(x * 37 + z * 11)), z * (1 - 0.22 * h));
  }
  g.computeVertexNormals();
  return g;
}

// Rótulos impresos en un solo atlas de 1024 × 2048: una textura para todas las placas.
// Celdas de 512 × 256 (0-7: materiales, avisos, recepción, gestor y franjas; 8-9: salidas del proceso) y, en
// la mitad inferior, carteles de etapa de 512 × 128 (1 Drenaje … 7 Colada).
const ATLAS_W = 1024;
const ATLAS_H = 2048;
const STAGES = ['Drenaje', 'Trituración', 'Separación', 'Desulfuración', 'Fundición', 'Refino', 'Colada'];
const cellRect = (cell) => [(cell % 2) * 512, Math.floor(cell / 2) * 256, 512, 256];
const stageRect = (i) => [(i % 2) * 512, 1280 + Math.floor(i / 2) * 128, 512, 128];

function labelAtlas() {
  const c = document.createElement('canvas');
  c.width = ATLAS_W;
  c.height = ATLAS_H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const font = (w, s) => `${w} ${s}px "Archivo Variable", sans-serif`;
  const ink = '#1f2224';
  // texto que cabe en `max` px: reduce el cuerpo hasta que entra
  const fit = (text, w, size, max) => {
    let s = size;
    g.font = font(w, s);
    while (s > 12 && g.measureText(text).width > max) g.font = font(w, --s);
  };
  const draw = () => {
    g.clearRect(0, 0, ATLAS_W, ATLAS_H);
    // placas de material: solo lo que sale de una batería de plomo-ácido (plomo, polipropileno y los productos
    // del electrolito; hechos proceso_reciclaje-f1, f7 y f14); sin cobre ni latón
    const mats = [
      ['Pb', 'Lingotes', 'Plomo refinado'],
      ['Pb', 'Rejillas', 'Fracción metálica'],
      ['PP', 'Plástico', 'Carcasa triturada'],
      ['Pb', 'Pasta', 'A desulfuración'],
    ];
    const plate = (cell, [sym, name, sub]) => {
      const [x, y] = cellRect(cell);
      g.fillStyle = '#e4dac6';
      g.fillRect(x, y, 512, 256);
      g.fillStyle = ink;
      g.fillRect(x + 22, y + 28, 172, 200);
      g.textAlign = 'center';
      g.fillStyle = '#F1EEE6';
      fit(sym, 800, 104, 150);
      g.fillText(sym, x + 108, y + 166);
      g.textAlign = 'left';
      g.fillStyle = ink;
      fit(name, 800, 64, 268);
      g.fillText(name, x + 220, y + 120);
      g.fillStyle = 'rgba(31,34,36,0.72)';
      fit(sub, 500, 30, 268);
      g.fillText(sub, x + 222, y + 170);
      g.fillStyle = '#93b52a';
      g.fillRect(x + 222, y + 196, 250, 8);
    };
    mats.forEach((m, i) => plate(i, m));
    // 8-9 · salidas: sulfato de sodio (del electrolito y de la desulfuración de la pasta) y granza de polipropileno
    plate(8, ['Na₂SO₄', 'Sulfato de sodio', 'Producto del electrolito']);
    plate(9, ['PP', 'Granza', 'Polipropileno']);
    // 4 · aviso de trituradora (ámbar de seguridad)
    g.fillStyle = '#E5AE50';
    g.fillRect(0, 512, 512, 256);
    g.strokeStyle = ink;
    g.lineWidth = 16;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(122, 548);
    g.lineTo(212, 724);
    g.lineTo(32, 724);
    g.closePath();
    g.stroke();
    g.fillStyle = ink;
    g.fillRect(114, 606, 16, 64);
    g.fillRect(114, 684, 16, 16);
    g.font = font(800, 44);
    g.fillText('Trituradora', 238, 620);
    g.font = font(600, 28);
    g.fillText('Acceso solo con', 240, 664);
    g.fillText('la línea parada', 240, 700);
    // 5 · recepción de baterías
    g.fillStyle = ink;
    g.fillRect(512, 512, 512, 256);
    g.fillStyle = '#F1EEE6';
    g.font = font(800, 48);
    g.fillText('Recepción', 548, 604);
    g.font = font(500, 30);
    g.fillStyle = 'rgba(241,238,230,0.7)';
    g.fillText('Baterías de plomo-ácido', 550, 650);
    g.fillStyle = '#C2F230';
    g.fillRect(550, 676, 300, 8);
    g.beginPath();
    g.moveTo(900, 640);
    g.lineTo(950, 680);
    g.lineTo(900, 720);
    g.closePath();
    g.fill();
    // 6 · gestor autorizado (las franjas de la celda 7 invaden la esquina derecha: los textos acaban antes, x < 372)
    g.fillStyle = '#e4dac6';
    g.fillRect(0, 768, 512, 256);
    g.fillStyle = ink;
    g.font = font(800, 46);
    g.fillText('Reciclaje', 34, 860);
    g.font = font(500, 28);
    g.fillStyle = 'rgba(31,34,36,0.72)';
    g.fillText('Gestor autorizado', 36, 908);
    g.fillStyle = '#93b52a';
    g.fillRect(36, 934, 300, 8);
    // 7 · franjas de seguridad ámbar y grafito (recortadas a su celda)
    g.save();
    g.beginPath();
    g.rect(512, 768, 512, 256);
    g.clip();
    g.fillStyle = ink;
    g.fillRect(512, 768, 512, 256);
    g.fillStyle = '#E5AE50';
    for (let k = -4; k < 12; k++) {
      g.beginPath();
      g.moveTo(512 + k * 64, 1024);
      g.lineTo(512 + k * 64 + 32, 1024);
      g.lineTo(512 + k * 64 + 32 + 256, 768);
      g.lineTo(512 + k * 64 + 256, 768);
      g.closePath();
      g.fill();
    }
    g.restore();
    // carteles de etapa: grafito, número en un círculo lima y nombre en marfil
    STAGES.forEach((name, i) => {
      const [x, y, w, h] = stageRect(i);
      g.fillStyle = ink;
      g.fillRect(x, y, w, h);
      g.fillStyle = '#C2F230';
      g.beginPath();
      g.arc(x + 64, y + 64, 40, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ink;
      g.textAlign = 'center';
      g.font = font(800, 50);
      g.fillText(String(i + 1), x + 64, y + 82);
      g.textAlign = 'left';
      g.fillStyle = '#F1EEE6';
      fit(name, 800, 58, 360);
      g.fillText(name, x + 126, y + 84);
      g.fillStyle = 'rgba(194,242,48,0.55)';
      g.fillRect(x + 128, y + 100, 120, 5);
    });
  };
  draw();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      draw();
      tex.needsUpdate = true;
    });
  }
  return tex;
}

// Plano con las UV de un rectángulo del atlas ([x, y, ancho, alto] en píxeles, y hacia abajo).
function labelGeometry([x, y, rw, rh], w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * rw) / ATLAS_W, 1 - (y + (1 - uv.getY(i)) * rh) / ATLAS_H);
  return g;
}

export function buildRecycling(ctx) {
  const { K, M, T, V, STATIONS } = ctx;
  const s5 = STATIONS.s5;
  const Y = s5.y;
  const UP = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const o3 = new THREE.Object3D();
  const lp = new THREE.Vector3();
  const clamp = THREE.MathUtils.clamp;

  // materiales propios: pilotos fijos, baliza de marcha que late, fondo tenue de la boca de la
  // trituradora (por debajo del umbral del bloom), plomo y acero galvanizado de los contenedores y rótulos
  const ind = M.amberGlow.clone();
  ind.emissiveIntensity = 1.1;
  const beacon = M.amberGlow.clone();
  const mouthBack = M.warmGlow.clone();
  mouthBack.emissiveIntensity = 0.4;
  const leadMat = M.lead.clone();
  leadMat.color.set('#80868c');
  leadMat.roughness = 0.46;
  leadMat.envMapIntensity = 0.95;
  const galv = M.steel.clone();
  galv.color.set('#d2d6da');
  galv.envMapIntensity = 1.5;
  const labels = new THREE.MeshStandardMaterial({ map: labelAtlas(), roughness: 0.62, metalness: 0.05 });
  const label = (cell, w, h) => new THREE.Mesh(K.geo(`lbl${cell}|${w}|${h}`, () => labelGeometry(cellRect(cell), w, h)), labels);
  // cartel de etapa (1 Drenaje … 7 Colada) de 1,0 × 0,25 m
  const stageLabel = (i, w = 1.0) => new THREE.Mesh(K.geo(`stage${i}|${w}`, () => labelGeometry(stageRect(i), w, w / 4)), labels);
  // cartel de etapa en un poste corto, con el frente hacia `ry` (0 = +z)
  // (impreso por las dos caras: se lee llegue la cámara por donde llegue)
  const stagePost = (i, x, z, ry, h = 1.5) => {
    const g = new THREE.Group();
    g.add(K.box(0.07, h, 0.07, M.graphite, 0, 0, 0));
    g.add(K.box(1.38, 0.41, 0.04, M.darkSteel, 0, h - 0.06, -0.025));
    const s = stageLabel(i, 1.3);
    s.position.set(0, h + 0.145, 0.0);
    g.add(s);
    const back = stageLabel(i, 1.3);
    back.rotation.y = Math.PI;
    back.position.set(0, h + 0.145, -0.05);
    g.add(back);
    g.position.set(x, Y, z);
    g.rotation.y = ry;
    ctx.add(g);
    return g;
  };
  // placa de material o salida en un poste bajo
  const platePost = (cell, x, z, ry) => {
    const g = new THREE.Group();
    g.add(K.box(0.06, 0.95, 0.06, M.graphite, 0, 0, 0));
    g.add(K.box(0.92, 0.48, 0.035, M.darkSteel, 0, 0.92, -0.022));
    const p = label(cell, 0.84, 0.42);
    p.position.set(0, 1.16, 0);
    g.add(p);
    const back = label(cell, 0.84, 0.42);
    back.rotation.y = Math.PI;
    back.position.set(0, 1.16, -0.044);
    g.add(back);
    g.position.set(x, Y, z);
    g.rotation.y = ry;
    ctx.add(g);
    return g;
  };

  // barra cilíndrica entre dos puntos (tirantes, conductos finos)
  const bar = (a, b, r, mat, seg = 8) => {
    const m = new THREE.Mesh(K.geo(`bar${r}|${seg}`, () => new THREE.CylinderGeometry(r, r, 1, seg)), mat);
    m.position.addVectors(a, b).multiplyScalar(0.5);
    m.scale.set(1, a.distanceTo(b), 1);
    m.quaternion.setFromUnitVectors(UP, dir.subVectors(b, a).normalize());
    return m;
  };

  // barandilla ámbar entre dos puntos del plano: postes, pasamanos, barra media y rodapié
  const railing = (parent, x1, z1, x2, z2, y, { h = 1.05, mat = M.amberMatte, step = 1.25 } = {}) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ry = Math.atan2(-(z2 - z1), x2 - x1);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      parent.add(K.box(0.05, h, 0.05, mat, x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t));
    }
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    [[h - 0.045, 0.05], [h * 0.52, 0.035], [0, 0.1]].forEach(([yy, s], k) => {
      const r = K.box(len, s, k === 2 ? 0.015 : s, mat, cx, y + yy, cz);
      r.rotation.y = ry;
      parent.add(r);
    });
  };

  // juntas de paneles atornillados sobre una caja (verticales cada ~1 m y dos horizontales)
  const seams = (parent, cx, y0, cz, w, h, d, { step = 1.0, faces = 'nsew', bolts = '' } = {}) => {
    const off = 0.007;
    const nx = Math.max(1, Math.round(w / step));
    const nz = Math.max(1, Math.round(d / step));
    for (let i = 1; i < nx; i++) {
      const x = cx - w / 2 + (w * i) / nx;
      if (faces.includes('s')) parent.add(K.box(0.022, h - 0.12, 0.014, M.darkSteel, x, y0 + 0.06, cz + d / 2 + off));
      if (faces.includes('n')) parent.add(K.box(0.022, h - 0.12, 0.014, M.darkSteel, x, y0 + 0.06, cz - d / 2 - off));
    }
    for (let i = 1; i < nz; i++) {
      const z = cz - d / 2 + (d * i) / nz;
      if (faces.includes('e')) parent.add(K.box(0.014, h - 0.12, 0.022, M.darkSteel, cx + w / 2 + off, y0 + 0.06, z));
      if (faces.includes('w')) parent.add(K.box(0.014, h - 0.12, 0.022, M.darkSteel, cx - w / 2 - off, y0 + 0.06, z));
    }
    [0.34, 0.68].forEach((f) => {
      const y = y0 + h * f;
      if (faces.includes('s')) parent.add(K.box(w - 0.04, 0.022, 0.014, M.darkSteel, cx, y, cz + d / 2 + off));
      if (faces.includes('n')) parent.add(K.box(w - 0.04, 0.022, 0.014, M.darkSteel, cx, y, cz - d / 2 - off));
      if (faces.includes('e')) parent.add(K.box(0.014, 0.022, d - 0.04, M.darkSteel, cx + w / 2 + off, y, cz));
      if (faces.includes('w')) parent.add(K.box(0.014, 0.022, d - 0.04, M.darkSteel, cx - w / 2 - off, y, cz));
      // tornillería a ambos lados de la junta horizontal
      for (let k = 0.15; k < w - 0.1; k += 0.3) {
        if (bolts.includes('s')) parent.add(K.box(0.03, 0.03, 0.016, M.steel, cx - w / 2 + k, y + 0.035, cz + d / 2 + off));
      }
      for (let k = 0.15; k < d - 0.1; k += 0.3) {
        if (bolts.includes('w')) parent.add(K.box(0.016, 0.03, 0.03, M.steel, cx - w / 2 - off, y + 0.035, cz - d / 2 + k));
      }
    });
  };

  // conducto de acero: tramos rectos con codos redondeados y bridas en cada unión
  const duct = (parent, pts, r, R) => {
    const path = [pts[0].clone()];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const d1 = new THREE.Vector3().subVectors(b, a).normalize();
      const d2 = new THREE.Vector3().subVectors(c, b).normalize();
      const p0 = b.clone().addScaledVector(d1, -R);
      const p1 = b.clone().addScaledVector(d2, R);
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        // arco aproximado con una Bézier cuadrática (codo de 90°)
        path.push(new THREE.Vector3().copy(p0).multiplyScalar((1 - t) * (1 - t)).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(p1, t * t));
      }
    }
    path.push(pts[pts.length - 1].clone());
    let len = 0;
    for (let i = 1; i < path.length; i++) len += path[i].distanceTo(path[i - 1]);
    parent.add(K.pipe(path, r, M.steel, Math.round(len * 10)));
    // bridas: extremos de cada tramo recto y cada ~1,7 m
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const L = a.distanceTo(b);
      const d = new THREE.Vector3().subVectors(b, a).normalize();
      const s0 = i === 0 ? 0.05 : R;
      const s1 = i === pts.length - 2 ? L - 0.05 : L - R;
      const n = Math.max(1, Math.round((s1 - s0) / 1.7));
      for (let k = 0; k <= n; k++) {
        const s = s0 + ((s1 - s0) * k) / n;
        const c = a.clone().addScaledVector(d, s);
        parent.add(bar(c.clone().addScaledVector(d, -0.035), c.clone().addScaledVector(d, 0.035), r + 0.06, M.darkSteel, 20));
      }
    }
  };

  // ---------- límite sur y este: bordillo de hormigón con valla de barrotes ----------
  // (deja ver a través el borde iluminado de la isla: barandilla, balizas y arbustos de la orilla)
  const fenceGeo = (len) => {
    const parts = [];
    const nb = Math.round(len / 0.12);
    for (let i = 0; i <= nb; i++) parts.push(new THREE.BoxGeometry(0.02, 1.55, 0.02).translate(-len / 2 + (len * i) / nb, 0.3 + 0.775, 0));
    const np = Math.max(1, Math.round(len / 2.5));
    for (let i = 0; i <= np; i++) parts.push(new THREE.BoxGeometry(0.07, 1.64, 0.07).translate(-len / 2 + (len * i) / np, 0.3 + 0.82, 0));
    parts.push(new THREE.BoxGeometry(len, 0.05, 0.05).translate(0, 1.86, 0));
    parts.push(new THREE.BoxGeometry(len, 0.04, 0.04).translate(0, 0.42, 0));
    return mergeGeometries(parts);
  };
  const walls = new THREE.Group();
  const kerbLight = (x, z, ry) => {
    const g = new THREE.Group();
    g.add(K.box(0.36, 0.1, 0.03, M.graphite, 0, 0.09, 0));
    g.add(K.box(0.3, 0.035, 0.012, M.warmGlow, 0, 0.12, 0.018));
    g.position.set(x, Y, z);
    g.rotation.y = ry;
    walls.add(g);
  };
  walls.add(K.box(30, 0.3, 0.35, M.concrete, s5.x, Y, s5.z + 9.4));
  walls.add(K.box(30.1, 0.05, 0.42, M.concreteLight, s5.x, Y + 0.3, s5.z + 9.4));
  const fenceS = new THREE.Mesh(K.geo('fence30', () => fenceGeo(30)), M.graphite);
  fenceS.position.set(s5.x, Y, s5.z + 9.4);
  walls.add(fenceS);
  for (let x = s5.x - 12; x < s5.x + 15; x += 6) kerbLight(x, s5.z + 9.4 - 0.19, Math.PI);
  // murete este en dos tramos: el paso de la calzada este (ACCESS.east, z ∈ [19,5, 24,5]) queda abierto para el
  // camión de lingotes y granza, con dos postes de entrada ámbar
  const ex = s5.x + 15.6;
  const gate0 = ACCESS.east.rim.z - 2.5;
  const gate1 = ACCESS.east.rim.z + 2.5;
  [[s5.z - 6.4, gate0], [gate1, s5.z + 9.0]].forEach(([z0, z1], k) => {
    const len = z1 - z0;
    const zc = (z0 + z1) / 2;
    walls.add(K.box(0.35, 0.3, len, M.concrete, ex, Y, zc));
    walls.add(K.box(0.42, 0.05, len + 0.1, M.concreteLight, ex, Y + 0.3, zc));
    const fe = new THREE.Mesh(K.geo(`fenceE${k}`, () => fenceGeo(len)), M.graphite);
    fe.position.set(ex, Y, zc);
    fe.rotation.y = Math.PI / 2;
    walls.add(fe);
  });
  [gate0, gate1].forEach((z) => {
    walls.add(K.box(0.3, 1.25, 0.3, M.amberMatte, ex, Y, z + (z < ACCESS.east.rim.z ? -0.2 : 0.2)));
    walls.add(K.box(0.32, 0.08, 0.32, M.graphite, ex, Y + 1.25, z + (z < ACCESS.east.rim.z ? -0.2 : 0.2)));
  });
  [s5.z - 6, s5.z + 6].forEach((z) => kerbLight(ex - 0.19, z, -Math.PI / 2));
  ctx.add(walls);

  // ---------- nave de recepción (posición fija) y su fachada norte ----------
  const intake = K.makeCutaway(M, { w: 7, d: 6, h: 5, roofDepth: 0.7, light: 12 });
  intake.position.set(s5.x - 11, Y, s5.z - 4.5);
  ctx.add(intake);
  const rsign = K.framedScreen(M, T.recycleWallTexture(), 2.2, 2.2, 0.4);
  rsign.position.set(s5.x - 11, Y + 3.2, s5.z - 7.2);
  ctx.add(rsign);
  const facade = new THREE.Group();
  const fz = s5.z - 7.675; // cara exterior del muro trasero
  // el mismo rótulo de reciclaje, visible para quien llega por el puente
  const outSign = rsign.clone();
  outSign.scale.setScalar(0.5);
  outSign.rotation.y = Math.PI;
  outSign.position.set(s5.x - 8.6, Y + 3.55, fz - 0.035);
  facade.add(outSign);
  // puerta enrollable por la que entra la ruta de reciclaje
  const dx = s5.x - 11.7;
  facade.add(K.box(2.6, 2.9, 0.05, M.darkSteel, dx, Y, fz - 0.03));
  for (let i = 0; i < 14; i++) facade.add(K.box(2.58, 0.022, 0.02, M.graphiteLight, dx, Y + 0.12 + i * 0.2, fz - 0.065));
  [-1, 1].forEach((s) => {
    facade.add(K.box(0.14, 3.2, 0.14, M.darkSteel, dx + s * 1.37, Y, fz - 0.07));
    // protecciones ámbar a los lados de la puerta
    facade.add(K.box(0.16, 0.95, 0.16, M.amberMatte, dx + s * 1.62, Y, fz - 0.42));
    facade.add(K.box(0.17, 0.08, 0.17, M.graphite, dx + s * 1.62, Y + 0.95, fz - 0.42));
  });
  facade.add(K.rbox(3.0, 0.48, 0.44, M.graphite, dx, Y + 2.98, fz - 0.22, 0.05));
  // baliza de la puerta: late mientras la línea está en marcha
  facade.add(K.box(0.12, 0.12, 0.1, beacon, dx + 1.62, Y + 3.62, fz - 0.06));
  facade.add(K.rbox(0.5, 0.12, 0.26, M.graphite, dx, Y + 3.62, fz - 0.14, 0.03));
  facade.add(K.box(0.42, 0.02, 0.2, M.warmGlow, dx, Y + 3.61, fz - 0.14));
  const rec = label(5, 0.84, 0.42);
  rec.rotation.y = Math.PI;
  rec.position.set(dx, Y + 3.22, fz - 0.447);
  facade.add(rec);
  // zócalo oscuro, bandeja de cables y armario eléctrico con conductos
  facade.add(K.box(7.1, 0.45, 0.05, M.panel, s5.x - 11, Y, fz - 0.025));
  facade.add(K.box(6.8, 0.07, 0.28, M.darkSteel, s5.x - 11, Y + 4.32, fz - 0.15));
  facade.add(K.rbox(0.62, 1.15, 0.3, M.graphite, s5.x - 13.85, Y + 0.55, fz - 0.15, 0.03));
  facade.add(K.box(0.56, 0.012, 0.012, M.darkSteel, s5.x - 13.85, Y + 1.12, fz - 0.306));
  facade.add(K.box(0.07, 0.07, 0.02, ind, s5.x - 13.68, Y + 1.5, fz - 0.31));
  [-0.15, 0.05].forEach((x) => facade.add(K.box(0.05, 2.62, 0.05, M.darkSteel, s5.x - 13.85 + x, Y + 1.7, fz - 0.05)));
  ctx.add(facade);

  // ---------- palés con baterías en espera y caseta de control ----------
  const yard = new THREE.Group();
  const pallet = (x, y, z) => {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) g.add(K.box(1.2, 0.022, 0.15, M.wood, 0, 0.122, -0.42 + i * 0.21));
    [-0.55, 0, 0.55].forEach((xx) => g.add(K.box(0.1, 0.1, 1.0, M.wood, xx, 0.022, 0)));
    [-0.42, 0, 0.42].forEach((zz) => g.add(K.box(1.2, 0.022, 0.12, M.wood, 0, 0, zz)));
    g.position.set(x, y, z);
    yard.add(g);
  };
  // las baterías en espera comparten las instancias de las de la cinta (misma geometría de ref-bateria)
  const waiting = [];
  const stacks = [
    [s5.x - 9.2, s5.z - 8.45, 1], [s5.x - 7.9, s5.z - 8.45, 1],
    [s5.x - 6.25, s5.z - 8.7, 2], [s5.x - 4.95, s5.z - 8.7, 1],
    [s5.x - 6.25, s5.z - 7.4, 1],
  ];
  // misma escala que las baterías de la cinta (0,62): dos por palé, con el lado largo en el fondo
  // del palé y el frontal hacia fuera
  const TIER = 0.925;
  stacks.forEach(([x, z, tiers]) => {
    for (let k = 0; k < tiers; k++) {
      const y = Y + k * TIER;
      pallet(x, y, z);
      [-0.3, 0.3].forEach((ox) => waiting.push({ x: x + ox, y: y + 0.144, z, r: ox < 0 ? -Math.PI / 2 : Math.PI / 2, s: 0.62 }));
      // separador de cartón entre alturas
      if (k < tiers - 1) yard.add(K.box(1.2, 0.012, 1.0, M.ivory, x, y + TIER - 0.013, z));
    }
    ctx.shadows.push({ x, y: Y, z, w: 1.7, d: 1.5 });
  });
  // pilas de palés vacíos listos para devolver
  [[s5.x - 3.65, s5.z - 8.7, 7], [s5.x - 3.65, s5.z - 7.4, 4], [s5.x - 4.95, s5.z - 7.4, 2]].forEach(([x, z, n]) => {
    for (let k = 0; k < n; k++) pallet(x, Y + k * 0.146, z);
    ctx.shadows.push({ x, y: Y, z, w: 1.6, d: 1.4 });
  });
  // marcas ámbar de la zona de espera y transpalé aparcado
  [[s5.x - 4.95, s5.z - 9.35, 4.4, 0.05], [s5.x - 4.95, s5.z - 6.75, 4.4, 0.05], [s5.x - 7.15, s5.z - 8.05, 0.05, 2.65], [s5.x - 2.75, s5.z - 8.05, 0.05, 2.65]]
    .forEach(([x, z, w, d]) => yard.add(K.box(w, 0.008, d, M.amberMatte, x, Y, z)));
  const jack = new THREE.Group();
  [-0.17, 0.17].forEach((z) => jack.add(K.box(1.15, 0.06, 0.16, M.darkSteel, 0.1, 0.03, z)));
  jack.add(K.rbox(0.3, 0.38, 0.56, M.amberMatte, -0.6, 0.03, 0, 0.04));
  jack.add(bar(V(-0.65, 0.4, 0), V(-1.05, 1.15, 0), 0.025, M.graphite));
  jack.add(K.box(0.05, 0.05, 0.3, M.graphite, -1.06, 1.12, 0));
  jack.position.set(s5.x - 7.0, Y, s5.z - 6.25);
  jack.rotation.y = 0.35;
  yard.add(jack);
  // caseta de control: registro de entregas (pantalla viva en la fachada oeste)
  const kiosk = new THREE.Group();
  const kw = 2.2;
  const kd = 2.0;
  const kh = 2.55;
  kiosk.add(K.box(kw + 0.3, 0.12, kd + 0.3, M.concreteLight, 0, 0, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => kiosk.add(K.box(0.1, kh, 0.1, M.graphite, sx * (kw / 2 - 0.05), 0.12, sz * (kd / 2 - 0.05))));
  [-1, 1].forEach((sz) => {
    kiosk.add(K.box(kw - 0.1, 0.95, 0.07, M.graphiteLight, 0, 0.12, sz * (kd / 2 - 0.035)));
    kiosk.add(K.box(kw, 0.04, 0.12, M.darkSteel, 0, 1.07, sz * (kd / 2 - 0.03)));
  });
  kiosk.add(K.box(0.07, kh, kd - 0.1, M.graphiteLight, -(kw / 2 - 0.035), 0.12, 0));
  kiosk.add(K.box(0.07, kh, kd - 0.1, M.graphiteLight, kw / 2 - 0.035, 0.12, 0));
  // interior claro que se ve a través del vidrio
  kiosk.add(K.box(kw - 0.2, kh - 0.2, 0.02, M.ivoryPanel, 0, 0.2, 0.0));
  kiosk.add(K.box(0.03, 2.05, 0.86, M.darkSteel, kw / 2 + 0.005, 0.14, 0.2));
  kiosk.add(K.box(0.04, 0.2, 0.04, M.steel, kw / 2 + 0.03, 1.1, -0.12));
  const glass = new THREE.Group();
  [-1, 1].forEach((sz) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(kw - 0.2, 1.36), M.glass);
    p.position.set(0, 1.79, sz * (kd / 2 - 0.035));
    p.rotation.y = sz > 0 ? 0 : Math.PI;
    glass.add(p);
  });
  const glassMesh = K.compact(glass);
  glassMesh.traverse((m) => m.isMesh && (m.castShadow = false));
  kiosk.add(glassMesh);
  kiosk.add(K.rbox(kw + 0.5, 0.16, kd + 0.5, M.panel, 0, kh + 0.12, 0, 0.04));
  kiosk.add(K.box(kw + 0.52, 0.03, 0.03, M.amberMatte, 0, kh + 0.17, kd / 2 + 0.26));
  kiosk.add(K.box(1.5, 0.03, 0.1, M.warmGlow, 0, kh + 0.08, 0));
  kiosk.add(K.box(kw - 0.3, 0.05, 0.55, M.stoneTop, 0, 0.84, -(kd / 2 - 0.36)));
  kiosk.add(K.box(kw - 0.3, 0.72, 0.5, M.graphite, 0, 0.12, -(kd / 2 - 0.36)));
  kiosk.add(K.box(0.56, 0.34, 0.03, M.darkGlass, -0.3, 0.92, -(kd / 2 - 0.2)));
  kiosk.add(K.box(0.4, 0.26, 0.03, M.darkGlass, 0.4, 0.92, -(kd / 2 - 0.2)));
  kiosk.position.set(s5.x - 1.25, Y, s5.z - 8.3);
  yard.add(kiosk);
  ctx.shadows.push({ x: s5.x - 1.25, y: Y, z: s5.z - 8.3, w: 3.2, d: 3 });
  // fachada oeste: ventana de vidrio oscuro y lector de tarjetas (sin rótulos que compitan con el titular)
  kiosk.add(K.box(0.03, 1.06, 1.36, M.darkSteel, -(kw / 2) - 0.005, 1.22, 0));
  kiosk.add(K.box(0.012, 0.94, 1.24, M.darkGlass, -(kw / 2) - 0.022, 1.28, 0));
  kiosk.add(K.box(0.02, 0.94, 0.04, M.darkSteel, -(kw / 2) - 0.03, 1.28, 0));
  kiosk.add(K.box(0.06, 0.03, 1.4, M.darkSteel, -(kw / 2) - 0.03, 1.19, 0));
  kiosk.add(K.box(0.04, 0.16, 0.1, M.graphite, -(kw / 2) - 0.02, 0.98, 0.8));
  kiosk.add(K.box(0.012, 0.03, 0.03, ind, -(kw / 2) - 0.045, 1.08, 0.8));
  // (v2: las cajas de transporte junto a la caseta dejan sitio a los depósitos del drenaje)
  ctx.add(yard);

  // ---------- cinta transportadora (posición, orientación y baterías fijas) ----------
  const belt = new THREE.Group();
  const beltLen = 18;
  const beltV = 0.06 * (beltLen - 3.5); // misma velocidad que las baterías
  belt.position.set(s5.x - 1, Y, s5.z - 1.5);
  belt.rotation.y = -0.12;
  belt.updateMatrix();
  belt.add(K.box(beltLen, 0.08, 1.3, M.rubber, 0, 1.04, 0));
  [-1, 1].forEach((s) => {
    // larguero en C y cordón de parada de emergencia
    belt.add(K.box(beltLen, 0.17, 0.045, M.darkSteel, 0, 0.69, s * 0.8));
    belt.add(K.box(beltLen, 0.03, 0.11, M.darkSteel, 0, 0.83, s * 0.76));
    belt.add(K.box(beltLen, 0.03, 0.11, M.darkSteel, 0, 0.69, s * 0.76));
    belt.add(K.box(beltLen - 1.6, 0.014, 0.014, M.amberMatte, -0.4, 1.27, s * 0.93));
    for (let x = -7.6; x < 5; x += 2.1) belt.add(K.box(0.03, 0.43, 0.03, M.darkSteel, x + 1.05, 0.86, s * 0.93));
  });
  for (let x = -7.9; x < 5; x += 2.1) {
    [-1, 1].forEach((s) => {
      belt.add(K.box(0.09, 0.7, 0.09, M.darkSteel, x, 0, s * 0.72));
      belt.add(K.box(0.24, 0.02, 0.2, M.darkSteel, x, 0, s * 0.72));
      if (x + 2.1 < 5) belt.add(bar(V(x + 0.05, 0.14, s * 0.72), V(x + 2.05, 0.6, s * 0.72), 0.018, M.darkSteel, 6));
    });
    belt.add(K.box(0.07, 0.07, 1.44, M.darkSteel, x, 0.3, 0));
  }
  [-1, 1].forEach((s) => belt.add(K.box(12.8, 0.05, 0.05, M.darkSteel, -1.5, 0.3, s * 0.72)));
  // rodillos grandes con buje hexagonal: giran con la banda
  const rollerGeo = K.geo('rollerBig', () => mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.09, 1.46, 14).rotateX(Math.PI / 2),
    new THREE.CylinderGeometry(0.05, 0.05, 0.07, 6).rotateX(Math.PI / 2).translate(0, 0, 0.76),
    new THREE.CylinderGeometry(0.05, 0.05, 0.07, 6).rotateX(Math.PI / 2).translate(0, 0, -0.76),
  ]));
  const rollerAt = [];
  for (let x = -8.6; x <= 8.61; x += 0.43) rollerAt.push([x, 0.95]);
  for (let x = -7.7; x <= 7.71; x += 1.925) rollerAt.push([x, 0.5]);
  const rollers = new THREE.InstancedMesh(rollerGeo, M.graphite, rollerAt.length);
  rollers.castShadow = true;
  rollers.receiveShadow = true;
  belt.add(rollers);
  // tacos de arrastre sobre la banda
  const CLEATS = 24;
  // (grafito: su variante instanciada ya existe por las balizas, no compila un sombreador nuevo)
  const cleats = new THREE.InstancedMesh(K.geo('cleat', () => new THREE.BoxGeometry(0.05, 0.028, 1.22)), M.graphite, CLEATS);
  cleats.userData.noCollide = true;
  cleats.boundingSphere = new THREE.Sphere(new THREE.Vector3(-0.95, 1.13, 0), 8.6);
  belt.add(cleats);
  // motorreductores en el lateral sur con piloto ámbar
  [-4.6, 0.6, 3.9].forEach((x) => {
    const g = new THREE.Group();
    g.add(K.rbox(0.56, 0.46, 0.3, M.graphiteLight, 0, 0.58, 0, 0.04));
    const mot = K.cyl(0.13, 0.13, 0.5, M.darkSteel, 16);
    mot.rotation.z = Math.PI / 2;
    mot.position.set(-0.12, 0.44, 0.04);
    g.add(mot);
    for (let k = 0; k < 4; k++) g.add(K.box(0.012, 0.29, 0.29, M.darkSteel, -0.32 + k * 0.1, 0.295, 0.04));
    g.add(K.box(0.09, 0.09, 0.02, ind, 0.16, 0.9, 0.16));
    g.add(K.box(0.05, 0.6, 0.05, M.darkSteel, 0.22, 0, -0.02));
    g.position.set(x, 0, 0.98);
    belt.add(g);
  });
  // entrada desde la nave: túnel corto con cortina de lamas
  const tx0 = -9.2;
  const tx1 = -6.6;
  [-1, 1].forEach((s) => belt.add(K.box(tx1 - tx0, 1.95, 0.06, M.steel, (tx0 + tx1) / 2, 0.15, s * 0.97)));
  belt.add(K.rbox(tx1 - tx0 + 0.1, 0.1, 2.06, M.steel, (tx0 + tx1) / 2, 2.1, 0, 0.03));
  belt.add(K.box(0.1, 0.12, 2.06, M.amberMatte, tx1, 1.98, 0));
  for (let k = 0; k < 9; k++) belt.add(K.box(0.01, 0.82, 0.13, M.graphiteLight, tx1 - 0.05, 1.16, -0.64 + k * 0.16));
  // tolva de entrada a la trituradora: boca a contraluz, cortina de lamas oscura y una sola luz cálida arriba
  const hx0 = 5.0;
  const hx1 = 9.5;
  const hcx = (hx0 + hx1) / 2;
  const hl = hx1 - hx0;
  [-1, 1].forEach((s) => belt.add(K.box(hl, 2.45, 0.06, M.steel, hcx, 0, s * 0.97)));
  belt.add(K.rbox(hl + 0.12, 0.12, 2.08, M.steel, hcx, 2.45, 0, 0.03));
  belt.add(K.box(0.06, 2.45, 2.0, M.steel, hx1 - 0.03, 0, 0));
  [-1, 1].forEach((s) => belt.add(K.box(0.08, 2.45, 0.27, M.steel, hx0, 0, s * 0.865)));
  belt.add(K.box(0.08, 0.33, 1.46, M.steel, hx0, 2.12, 0));
  belt.add(K.box(0.08, 1.02, 1.46, M.steel, hx0, 0, 0));
  belt.add(K.box(0.1, 0.05, 1.5, M.darkSteel, hx0 - 0.01, 2.08, 0));
  [-1, 1].forEach((s) => {
    belt.add(K.box(0.1, 1.05, 0.05, M.darkSteel, hx0 - 0.01, 1.05, s * 0.75));
    belt.add(K.box(1.25, 1.0, 0.03, M.panel, hx0 + 0.625, 1.1, s * 0.71));
    belt.add(K.box(0.03, 0.12, 0.12, ind, hx0 - 0.05, 2.22, s * 0.86));
  });
  belt.add(K.box(1.25, 0.03, 1.42, M.panel, hx0 + 0.625, 2.08, 0));
  // cortina colgada de un riel: lamas solapadas que alternan de plano para que se lean las juntas
  belt.add(K.box(0.05, 0.045, 1.46, M.darkSteel, hx0 + 0.3, 1.9, 0));
  for (let k = 0; k < 9; k++) belt.add(K.box(0.012, 0.76, 0.17, M.graphiteLight, hx0 + 0.36 + (k % 2 ? 0.012 : -0.012), 1.14, -0.62 + k * 0.155));
  // ejes de cuchillas en silueta sobre el fondo tenue, visibles por encima de la cortina
  [hx0 + 0.72, hx0 + 0.96].forEach((x, i) => {
    const shaft = K.cyl(0.045, 0.045, 1.4, M.darkSteel, 10);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(x, 1.95, 0);
    belt.add(shaft);
    for (let k = 0; k < 11; k++) {
      const disc = K.cyl(0.085, 0.085, 0.035, M.darkSteel, 6);
      disc.rotation.set(Math.PI / 2, (k + i) * 0.5, 0);
      disc.position.set(x, 1.95, -0.6 + k * 0.12 + i * 0.06);
      belt.add(disc);
    }
  });
  belt.add(K.box(0.02, 0.98, 1.42, mouthBack, hx0 + 1.22, 1.1, 0));
  belt.add(K.box(0.04, 0.035, 1.36, M.warmGlow, hx0 + 0.07, 2.03, 0));
  seams(belt, hcx, 0, 0, hl, 2.45, 2.0, { step: 1.1, faces: 'ns', bolts: 's' });
  belt.add(K.box(0.92, 1.72, 0.02, M.steel, 7.6, 0.24, 1.014));
  belt.add(K.box(0.04, 0.24, 0.04, M.graphite, 7.95, 1.0, 1.04));
  // aviso junto a la boca: se lee al cruzar la cinta y sale del encuadre antes del texto del capítulo
  const warnHood = label(4, 0.62, 0.31);
  warnHood.position.set(5.55, 2.05, 1.016);
  belt.add(warnHood);
  // franjas de seguridad bajo la boca
  const stripes = label(7, 1.36, 0.42);
  stripes.rotation.y = -Math.PI / 2;
  stripes.position.set(hx0 - 0.045, 0.55, 0);
  belt.add(stripes);
  // marco de la pantalla del registro sobre la boca (se ve al llegar y al empezar la lectura)
  belt.add(K.box(0.06, 0.8, 1.38, M.darkSteel, hx0 - 0.07, 2.22, 0));
  ctx.add(belt);
  ctx.shadows.push({ x: s5.x - 1, y: Y, z: s5.z - 1.5, w: 19, d: 2.6, r: -0.12 });

  // pantalla viva: reparto típico en masa por material (UE, estudios sectoriales: plomo ≈60 %, electrolito ≈30 %,
  // plástico ≈7 %; el 3 % restante no se desglosa). Las barras se llenan durante la llegada y el registro
  // queda «documentado» justo en el encuadre de exposición (local ≈ 0,45), donde el visitante se detiene
  const regK = (story) => {
    if (!story || story.reduced || story.index > CH.reciclaje) return 1;
    if (story.index < CH.reciclaje) return 0;
    return clamp((story.local + 1.0) / 1.45, 0, 1);
  };
  const recRows = [['Plomo 60 %', 0.6], ['Electrolito 30 %', 0.3], ['Plástico 7 %', 0.07], ['Otros 3 %', 0.03]];
  const live = T.liveScreen(512, 288, (g, w, h, t, story) => {
    const k = regK(story);
    g.fillStyle = '#0f1112';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#C2F230';
    g.fillRect(0, 0, w, 6);
    g.textAlign = 'left';
    g.fillStyle = '#F1EEE6';
    g.font = '700 30px "Archivo Variable", sans-serif';
    g.fillText('Entrega ECB-0427 · ejemplo', 26, 50);
    g.font = '500 19px "Archivo Variable", sans-serif';
    g.fillStyle = 'rgba(241,238,230,0.6)';
    g.fillText('Composición típica en masa (UE), aprox.', 26, 80);
    for (let i = 0; i < recRows.length; i++) {
      const y = 108 + i * 38;
      g.fillStyle = 'rgba(241,238,230,0.78)';
      g.fillText(recRows[i][0], 26, y + 17);
      g.fillStyle = 'rgba(194,242,48,0.14)';
      g.fillRect(168, y, 316, 20);
      const f = clamp(k * 1.3 - i * 0.1, 0, 1) * recRows[i][1];
      g.fillStyle = i === 0 ? '#C2F230' : 'rgba(194,242,48,0.72)';
      g.fillRect(168, y, 316 * f, 20);
    }
    const done = k > 0.97;
    g.fillStyle = done ? '#C2F230' : 'rgba(241,238,230,0.4)';
    if (done) {
      g.strokeStyle = '#C2F230';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(28, 262);
      g.lineTo(36, 270);
      g.lineTo(50, 254);
      g.stroke();
      g.fillText('Destino documentado', 60, 270);
    } else {
      g.fillText('Registrando entrega', 26, 270);
      // barrido de lectura mientras registra
      g.fillStyle = 'rgba(194,242,48,0.08)';
      g.fillRect(((t * 160) % (w + 60)) - 60, 100, 60, 152);
    }
  }, 12);
  const scr = K.screen(live.texture, 1.24, 0.7, 0.85);
  scr.rotation.y = -Math.PI / 2;
  scr.position.set(hx0 - 0.105, 2.62, 0);
  belt.add(scr);
  // en la fachada norte de la caseta, sobre la ventana: la ve quien llega por el vial y no compite con el titular
  const scrKiosk = new THREE.Mesh(scr.geometry, scr.material);
  scrKiosk.rotation.y = Math.PI;
  scrKiosk.position.set(0, 1.62, -(kd / 2) - 0.03);
  kiosk.add(scrKiosk);
  kiosk.add(K.box(1.34, 0.8, 0.03, M.darkSteel, 0, 1.22, -(kd / 2) - 0.005));
  // tercera pantalla, en un poste junto a las salidas (lingotes y granza), mirando al noroeste: el registro
  // del destino acompaña a lo que sale hacia la fábrica
  const regPost = new THREE.Group();
  regPost.add(K.box(0.36, 0.04, 0.3, M.darkSteel, 0, 0, 0));
  regPost.add(K.box(0.1, 1.5, 0.1, M.graphite, 0, 0.04, -0.02));
  regPost.add(K.rbox(1.38, 0.84, 0.1, M.darkSteel, 0, 1.48, -0.045, 0.03));
  regPost.add(K.box(1.2, 0.012, 0.012, M.limeLine, 0, 1.5, 0.012));
  const scrWalk = new THREE.Mesh(scr.geometry, scr.material);
  scrWalk.position.set(0, 1.9, 0.012);
  regPost.add(scrWalk);
  regPost.position.set(s5.x - 0.4, Y, s5.z + 0.9);
  regPost.rotation.y = -2.45;
  ctx.add(regPost);
  ctx.shadows.push({ x: s5.x - 0.4, y: Y, z: s5.z + 0.9, w: 0.7, d: 0.6 });
  const gestor = label(6, 0.9, 0.45);
  gestor.position.set(0, 0.6, kd / 2 + 0.004);
  kiosk.add(gestor);

  // baterías sobre la cinta (misma lógica de recorrido) y en los palés: una malla instanciada por
  // material de la batería; las de la cinta se actualizan cada fotograma, las de los palés quedan fijas
  const RIDERS = 6;
  const beltInv = belt.matrix.clone().invert();
  const batBox = new THREE.Box3(new THREE.Vector3(-9.2, 0.9, -0.6), new THREE.Vector3(7.3, 1.9, 0.6));
  const batMat = new THREE.Matrix4();
  const riderParts = K.compact(K.makeBattery(M, { label: true })).children.map((m) => {
    const im = new THREE.InstancedMesh(m.geometry, m.material, RIDERS + waiting.length);
    // el mapa de sombras es estático: lo que se mueve no proyecta (evita sombras fantasma)
    im.castShadow = false;
    im.receiveShadow = true;
    belt.add(im);
    return im;
  });
  waiting.forEach((b, j) => {
    o3.position.set(b.x, b.y, b.z);
    o3.rotation.set(0, b.r, 0);
    o3.scale.setScalar(b.s);
    o3.updateMatrix();
    batMat.multiplyMatrices(beltInv, o3.matrix);
    riderParts.forEach((im) => im.setMatrixAt(RIDERS + j, batMat));
    lp.setFromMatrixPosition(batMat);
    batBox.expandByPoint(lp.set(lp.x - 0.6, lp.y, lp.z - 0.6)).expandByPoint(lp.set(lp.x + 1.2, lp.y + 0.6, lp.z + 1.2));
  });
  o3.rotation.set(0, 0, 0);
  o3.scale.setScalar(1);
  // esfera fija que cubre el recorrido y los palés (las instancias de la cinta se mueven cada fotograma)
  const batSphere = batBox.getBoundingSphere(new THREE.Sphere());
  riderParts.forEach((im) => (im.boundingSphere = batSphere));

  // transferencia cerrada entre la tolva y la trituradora, con el cuadro de mando de la línea
  const transfer = new THREE.Group();
  transfer.add(K.rbox(1.9, 2.4, 1.38, M.steel, s5.x + 8.75, Y, s5.z - 1.9, 0.05));
  seams(transfer, s5.x + 8.75, Y, s5.z - 1.9, 1.9, 2.4, 1.38, { step: 0.7, faces: 'w' });
  transfer.add(K.rbox(0.2, 0.78, 0.56, M.graphite, s5.x + 7.69, Y + 1.05, s5.z - 2.15, 0.03));
  [-0.15, 0, 0.15].forEach((z) => transfer.add(K.box(0.02, 0.06, 0.06, ind, s5.x + 7.58, Y + 1.66, s5.z - 2.15 + z)));
  const estop = K.cyl(0.065, 0.065, 0.05, M.amberMatte, 14);
  estop.rotation.z = Math.PI / 2;
  estop.position.set(s5.x + 7.57, Y + 1.38, s5.z - 2.15);
  transfer.add(estop);
  // columna de señalización: el piloto de marcha de la línea es el único que late
  transfer.add(K.box(0.03, 0.2, 0.03, M.darkSteel, s5.x + 7.69, Y + 1.83, s5.z - 2.32));
  const runLight = K.cyl(0.045, 0.045, 0.11, beacon, 12);
  runLight.position.set(s5.x + 7.69, Y + 2.085, s5.z - 2.32);
  transfer.add(runLight);
  const runCap = K.cyl(0.048, 0.048, 0.025, M.graphite, 12);
  runCap.position.set(s5.x + 7.69, Y + 2.15, s5.z - 2.32);
  transfer.add(runCap);
  ctx.add(transfer);

  // ---------- trituradora y torre (posición fija) ----------
  const tower = new THREE.Group();
  tower.position.set(s5.x + 10, Y, s5.z - 4.5);
  // la carcasa deja libre la traza lima que pasa por su esquina noroeste
  const hX = 0.25;
  const hZ = 0.3;
  const HW = 3.9;
  const HD = 3.4;
  const HH = 3.6;
  tower.add(K.box(4.15, 0.12, 3.65, M.concreteLight, 0.325, 0, 0.375));
  tower.add(K.rbox(HW, HH, HD, M.steel, hX, 0.12, hZ, 0.06));
  tower.add(K.box(HW + 0.02, 0.32, HD + 0.02, M.panel, hX, 0.12, hZ));
  seams(tower, hX, 0.12, hZ, HW, HH, HD, { step: 1.0, bolts: 'sw' });
  // motor principal con reductor y acoplamiento protegido (ámbar) en la fachada oeste
  tower.add(K.box(0.72, 0.34, 1.75, M.darkSteel, -2.12, 0.12, 0.95));
  tower.add(K.rbox(0.55, 0.7, 0.42, M.graphiteLight, -1.98, 0.46, 0.25, 0.04));
  tower.add(K.box(0.44, 0.44, 0.3, M.amberMatte, -2.08, 0.6, 0.62));
  const motor = K.cyl(0.32, 0.32, 0.9, M.graphiteLight, 20);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(-2.12, 0.82, 1.25);
  tower.add(motor);
  for (let k = 0; k < 5; k++) tower.add(K.box(0.7, 0.012, 0.8, M.darkSteel, -2.12, 0.58 + k * 0.11, 1.25));
  const fan = K.cyl(0.3, 0.3, 0.08, M.darkSteel, 16);
  fan.rotation.x = Math.PI / 2;
  fan.position.set(-2.12, 0.82, 1.74);
  tower.add(fan);
  // puerta de inspección y descarga hacia la galería de separación
  tower.add(K.box(0.03, 2.0, 0.85, M.steel, hX - HW / 2 - 0.016, 0.45, -0.43));
  tower.add(K.box(0.05, 0.24, 0.05, M.graphite, hX - HW / 2 - 0.04, 1.4, -0.12));
  tower.add(K.box(1.0, 1.0, 0.6, M.darkSteel, 1.8, 0.3, hZ + HD / 2 + 0.29));
  // aviso sobre la puerta de inspección (cara oeste): se lee al cruzar la cinta y no queda tras el texto
  const warnT = label(4, 0.7, 0.35);
  warnT.rotation.y = -Math.PI / 2;
  warnT.position.set(hX - HW / 2 - 0.018, 2.85, -0.43);
  tower.add(warnT);
  // 2 · Trituración: cartel de etapa en la misma fachada, sobre el motor
  const stT = stageLabel(1, 1.1);
  stT.rotation.y = -Math.PI / 2;
  stT.position.set(hX - HW / 2 - 0.02, 2.55, 0.95);
  tower.add(stT);
  // plataforma superior con barandilla ámbar
  const DY = HH + 0.12;
  tower.add(K.box(4.5, 0.07, 3.9, M.darkSteel, 0.25, DY, 0.35));
  tower.add(K.box(4.5, 0.15, 0.06, M.darkSteel, 0.25, DY - 0.12, 2.27));
  tower.add(K.box(0.06, 0.15, 3.9, M.darkSteel, 2.47, DY - 0.12, 0.35));
  [-0.9, 1.4].forEach((x) => tower.add(bar(V(x, DY - 0.5, hZ - HD / 2), V(x, DY - 0.02, -1.55), 0.03, M.darkSteel, 6)));
  railing(tower, -1.95, -1.55, 2.45, -1.55, DY + 0.07);
  railing(tower, -1.95, -1.55, -1.95, 2.25, DY + 0.07);
  railing(tower, -1.95, 2.25, 2.45, 2.25, DY + 0.07);
  railing(tower, 2.45, -1.55, 2.45, 0.55, DY + 0.07, { step: 1.1 });
  railing(tower, 2.45, 1.45, 2.45, 2.25, DY + 0.07, { step: 0.8 });
  // tolva sobre la carcasa
  tower.add(new THREE.Mesh(K.geo('hopperOut', () => frustumShell(1.9, 1.9, 0.45, 1.25)), M.steel).translateX(-0.4).translateY(DY + 0.07).translateZ(0.25));
  tower.add(new THREE.Mesh(K.geo('hopperIn', () => frustumShell(1.82, 1.82, 0.45, 1.25, true)), M.darkSteel).translateX(-0.4).translateY(DY + 0.07).translateZ(0.25));
  [-1, 1].forEach((s) => {
    tower.add(K.box(2.0, 0.06, 0.09, M.steel, -0.4, DY + 1.31, 0.25 + s * 0.95));
    tower.add(K.box(0.09, 0.06, 2.0, M.steel, -0.4 + s * 0.95, DY + 1.31, 0.25));
  });
  // estructura de la torre: pilares, arriostramientos, plataforma intermedia y ciclón
  const FX = 0.25;
  const FZ = 0.2;
  const FT = DY + 4.7;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => tower.add(K.box(0.14, FT - DY, 0.14, M.darkSteel, FX + sx * 1.3, DY + 0.07, FZ + sz * 1.3)));
  [DY + 2.5, FT - 0.1].forEach((y) => {
    [-1, 1].forEach((s) => {
      tower.add(K.box(2.74, 0.1, 0.1, M.darkSteel, FX, y, FZ + s * 1.3));
      tower.add(K.box(0.1, 0.1, 2.74, M.darkSteel, FX + s * 1.3, y, FZ));
    });
  });
  [[1.3, 'z'], [-1.3, 'z'], [1.3, 'x']].forEach(([s, ax]) => {
    const a = ax === 'z' ? V(FX - 1.3, DY + 0.1, FZ + s) : V(FX + s, DY + 0.1, FZ - 1.3);
    const b = ax === 'z' ? V(FX + 1.3, DY + 2.5, FZ + s) : V(FX + s, DY + 2.5, FZ + 1.3);
    const c = ax === 'z' ? V(FX - 1.3, DY + 2.5, FZ + s) : V(FX + s, DY + 2.5, FZ - 1.3);
    const d = ax === 'z' ? V(FX + 1.3, DY + 0.1, FZ + s) : V(FX + s, DY + 0.1, FZ + 1.3);
    tower.add(bar(a, b, 0.03, M.darkSteel, 6));
    tower.add(bar(c, d, 0.03, M.darkSteel, 6));
  });
  const MY = DY + 2.55;
  [-1, 1].forEach((s) => {
    tower.add(K.box(2.9, 0.06, 0.62, M.darkSteel, FX, MY, FZ + s * 1.14));
    tower.add(K.box(0.62, 0.06, 1.66, M.darkSteel, FX + s * 1.14, MY, FZ));
  });
  railing(tower, FX - 1.42, FZ - 1.42, FX + 1.42, FZ - 1.42, MY + 0.06, { step: 1.4 });
  railing(tower, FX - 1.42, FZ + 1.42, FX + 1.42, FZ + 1.42, MY + 0.06, { step: 1.4 });
  railing(tower, FX - 1.42, FZ - 1.42, FX - 1.42, FZ + 1.42, MY + 0.06, { step: 1.4 });
  railing(tower, FX + 1.42, FZ - 1.42, FX + 1.42, FZ + 0.25, MY + 0.06, { step: 1.6 });
  const cyc = K.cyl(0.72, 0.72, 2.3, M.steel, 28);
  cyc.position.set(FX, MY + 1.0, FZ);
  tower.add(cyc);
  const cone = K.cyl(0.72, 0.16, 0.95, M.steel, 28);
  cone.position.set(FX, MY - 0.62, FZ);
  tower.add(cone);
  [MY + 0.3, MY + 1.1, MY + 1.9].forEach((y) => {
    const ring = K.cyl(0.735, 0.735, 0.04, M.darkSteel, 28);
    ring.position.set(FX, y, FZ);
    tower.add(ring);
  });
  const cap = K.cyl(0.76, 0.76, 0.1, M.darkSteel, 28);
  cap.position.set(FX, MY + 2.2, FZ);
  tower.add(cap);
  const drop = K.cyl(0.16, 0.16, 0.6, M.darkSteel, 12);
  drop.position.set(FX, DY + 1.25, FZ);
  tower.add(drop);
  // luminarias en la coronación
  [[-1, 1], [1, 1]].forEach(([sx, sz]) => {
    tower.add(K.rbox(0.32, 0.12, 0.22, M.graphite, FX + sx * 1.3, FT, FZ + sz * 1.42, 0.03));
    tower.add(K.box(0.26, 0.02, 0.16, M.warmGlow, FX + sx * 1.3, FT - 0.01, FZ + sz * 1.42));
  });
  // escalera con jaula (ámbar) en la cara este y tramo interior hasta la plataforma intermedia
  const ladder = (x, z0, z1, y0, y1, cageFrom) => {
    [z0, z1].forEach((z) => tower.add(K.box(0.05, y1 - y0, 0.05, M.amberMatte, x, y0, z)));
    for (let y = y0 + 0.3; y < y1 - 0.2; y += 0.3) tower.add(K.box(0.03, 0.03, z1 - z0, M.amberMatte, x, y, (z0 + z1) / 2));
    if (cageFrom === undefined) return;
    for (let y = cageFrom; y < y1; y += 0.65) {
      tower.add(K.box(0.7, 0.04, 0.04, M.amberMatte, x + 0.35, y, z0 - 0.1));
      tower.add(K.box(0.7, 0.04, 0.04, M.amberMatte, x + 0.35, y, z1 + 0.1));
      tower.add(K.box(0.04, 0.04, z1 - z0 + 0.24, M.amberMatte, x + 0.7, y, (z0 + z1) / 2));
    }
    [[0.7, (z0 + z1) / 2], [0.35, z0 - 0.1], [0.35, z1 + 0.1]].forEach(([dx2, z]) => tower.add(K.box(0.03, y1 - cageFrom, 0.03, M.amberMatte, x + dx2, cageFrom, z)));
  };
  ladder(2.62, 0.75, 1.25, 0.12, DY + 1.1, 2.3);
  ladder(FX + 1.36, 0.45, 0.85, DY + 0.07, MY + 0.9);
  // conductos de acero hacia el filtro de mangas (con codos y bridas)
  const CX = 3.8;
  const CZ = -4.25;
  duct(tower, [V(FX, MY + 2.25, FZ), V(FX, MY + 3.2, FZ), V(FX, MY + 3.2, CZ), V(CX, MY + 3.2, CZ), V(CX, 5.45, CZ)], 0.34, 0.7);
  // filtro de mangas: cuerpo cilíndrico, tolva cónica, válvula y patas
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => tower.add(K.box(0.12, 1.85, 0.12, M.darkSteel, CX + sx * 0.62, 0, CZ + sz * 0.62)));
  const fCone = K.cyl(0.86, 0.22, 0.9, M.steel, 24);
  fCone.position.set(CX, 1.4, CZ);
  tower.add(fCone);
  const fBody = K.cyl(0.86, 0.86, 3.3, M.steel, 28);
  fBody.position.set(CX, 3.5, CZ);
  tower.add(fBody);
  [2.5, 3.6, 4.6].forEach((y) => {
    const ring = K.cyl(0.875, 0.875, 0.05, M.darkSteel, 28);
    ring.position.set(CX, y, CZ);
    tower.add(ring);
  });
  const fCap = K.cyl(0.9, 0.9, 0.14, M.darkSteel, 28);
  fCap.position.set(CX, 5.2, CZ);
  tower.add(fCap);
  tower.add(K.rbox(0.36, 0.36, 0.36, M.graphiteLight, CX, 0.55, CZ, 0.03));
  tower.add(K.box(0.07, 0.07, 0.02, ind, CX + 0.1, 0.8, CZ + 0.19));
  // armarios eléctricos de la línea, al norte
  [-1.0, -0.15, 0.7].forEach((x) => {
    tower.add(K.box(0.82, 0.08, 0.52, M.panel, x, 0, -4.5));
    tower.add(K.rbox(0.8, 1.95, 0.5, M.graphite, x, 0.08, -4.5, 0.03));
    tower.add(K.box(0.012, 1.8, 0.012, M.darkSteel, x, 0.16, -4.24));
    tower.add(K.box(0.06, 0.06, 0.02, ind, x + 0.24, 1.7, -4.245));
  });
  tower.add(K.box(2.8, 0.06, 0.32, M.darkSteel, -0.15, 2.6, -4.5));
  [-1.2, 0.9].forEach((x) => tower.add(K.box(0.04, 0.57, 0.04, M.darkSteel, x, 2.03, -4.5)));
  tower.add(K.box(0.32, 0.06, 2.84, M.darkSteel, -0.15, 2.6, -3.0));
  tower.add(K.box(0.32, 1.06, 0.06, M.darkSteel, -0.15, 2.66, -1.6));
  ctx.add(tower);
  ctx.shadows.push({ x: s5.x + 10.25, y: Y, z: s5.z - 4.3, w: 5.4, d: 5 });
  ctx.shadows.push({ x: s5.x + 13.8, y: Y, z: s5.z - 8.75, w: 2.4, d: 2.4 });

  // extracción de polvo de la tolva de entrada hasta el ciclón
  const ductG = new THREE.Group();
  duct(ductG, [V(s5.x + 5.95, Y + 2.6, s5.z - 0.66), V(s5.x + 5.95, Y + 5.95, s5.z - 0.66), V(s5.x + 5.95, Y + 5.95, s5.z - 4.3), V(s5.x + 9.65, Y + 5.95, s5.z - 4.3)], 0.2, 0.45);
  ctx.add(ductG);

  // ---------- elevador de cangilones y puente de cinta cerrado: de la trituradora a la nave de separación ----------
  // El material triturado sale por un tornillo bajo la torre, sube por el elevador y cruza por encima del paso
  // del camión (gálibo de más de 5 m) dentro de un puente cerrado que baja a la nave por la cubierta.
  const brX = s5.x + 13.5;
  const brZ0 = s5.z - 1.25;
  const brZ1 = s5.z + 5.3;
  const brY = Y + 6.25;
  const lift = new THREE.Group();
  lift.add(K.box(0.9, 0.7, 0.8, M.darkSteel, brX, Y, brZ0));
  lift.add(K.box(0.66, brY - Y - 0.3, 0.56, M.steel, brX, Y + 0.7, brZ0));
  lift.add(K.rbox(1.0, 0.95, 0.95, M.steel, brX, brY - 0.45, brZ0, 0.05));
  lift.add(K.rbox(0.42, 0.34, 0.4, M.graphiteLight, brX + 0.68, brY - 0.25, brZ0, 0.03));
  for (let y = Y + 1.6; y < brY - 0.5; y += 1.2) lift.add(K.box(0.7, 0.04, 0.6, M.darkSteel, brX, y, brZ0));
  // tornillo de alimentación desde la descarga de la trituradora
  lift.add(bar(V(s5.x + 12.2, Y + 0.55, s5.z - 2.45), V(brX - 0.3, Y + 0.45, brZ0 - 0.1), 0.15, M.darkSteel, 10));
  lift.add(K.rbox(0.34, 0.34, 0.34, M.graphiteLight, s5.x + 12.1, Y + 0.38, s5.z - 2.5, 0.03));
  // puente: cajón de chapa con juntas, celosía inferior y bajante a la cubierta de la nave
  const brLen = brZ1 - brZ0;
  const brC = (brZ0 + brZ1) / 2;
  lift.add(K.rbox(0.86, 0.8, brLen, M.steel, brX, brY, brC, 0.04));
  lift.add(K.box(0.92, 0.05, brLen + 0.05, M.darkSteel, brX, brY + 0.8, brC));
  for (let z = brZ0 + 0.9; z < brZ1 - 0.4; z += 1.1) {
    [-1, 1].forEach((s) => lift.add(K.box(0.014, 0.74, 0.03, M.darkSteel, brX + s * 0.435, brY + 0.03, z)));
  }
  [-1, 1].forEach((s) => lift.add(K.box(0.08, 0.1, brLen, M.darkSteel, brX + s * 0.38, brY - 0.48, brC)));
  for (let z = brZ0 + 0.45, j = 0; z < brZ1 - 0.2; z += 1.3, j++) {
    const z2 = Math.min(z + 1.3, brZ1 - 0.2);
    [-1, 1].forEach((s) => {
      lift.add(K.box(0.05, 0.4, 0.05, M.darkSteel, brX + s * 0.38, brY - 0.42, z));
      if (z2 - z > 0.4) lift.add(bar(V(brX + s * 0.38, brY - (j % 2 ? 0.02 : 0.4), z), V(brX + s * 0.38, brY - (j % 2 ? 0.4 : 0.02), z2), 0.018, M.darkSteel, 6));
    });
  }
  // gálibo: franja ámbar bajo el puente, sobre el paso del camión
  lift.add(K.box(0.9, 0.12, 0.05, M.amberMatte, brX, brY - 0.62, ACCESS.east.rim.z - 2.4));
  // bajante a la nave (la cubierta está a Y + 4,12)
  lift.add(K.box(0.62, brY - (Y + 4.1), 0.62, M.steel, brX, Y + 4.1, brZ1 - 0.35));
  lift.add(K.box(0.72, 0.06, 0.72, M.darkSteel, brX, Y + 4.12, brZ1 - 0.35));
  lift.add(K.box(0.07, 0.07, 0.02, ind, brX + 0.51, brY - 0.1, brZ0 + 0.2));
  ctx.add(lift);
  ctx.shadows.push({ x: brX, y: Y, z: brZ0, w: 1.3, d: 1.2 });

  // ---------- nave de separación (esquina sureste): boca iluminada y tolva hacia el contenedor ----------
  const sep = new THREE.Group();
  const bx0 = s5.x + 12.85;
  const bx1 = s5.x + 15.42;
  // (desde la v2 empieza en z = 24,65: deja libre el paso del camión, z ∈ [19,5, 24,5])
  const bz0 = s5.z + 4.65;
  const bz1 = s5.z + 9.15;
  const bw = bx1 - bx0;
  const bd = bz1 - bz0;
  const bh = 3.9;
  const bcx = (bx0 + bx1) / 2;
  const bcz = (bz0 + bz1) / 2;
  const oz0 = s5.z + 5.25;
  const oz1 = s5.z + 7.35;
  const ozc = (oz0 + oz1) / 2;
  const oy0 = 1.6;
  const oy1 = 3.2;
  // fachada de paneles de hormigón gris con cantoneras de acero: el interior marfil iluminado
  // se lee por contraste a través de la boca, sin más emisivo
  sep.add(K.box(bw, bh, 0.3, M.concreteLight, bcx, Y, bz0 + 0.15));
  sep.add(K.box(bw, bh, 0.3, M.concreteLight, bcx, Y, bz1 - 0.15));
  sep.add(K.box(0.3, bh, bd, M.concreteLight, bx1 - 0.15, Y, bcz));
  sep.add(K.box(0.3, bh, oz0 - bz0, M.concreteLight, bx0 + 0.15, Y, (bz0 + oz0) / 2));
  sep.add(K.box(0.3, bh, bz1 - oz1, M.concreteLight, bx0 + 0.15, Y, (oz1 + bz1) / 2));
  sep.add(K.box(0.3, oy0, oz1 - oz0, M.concreteLight, bx0 + 0.15, Y, ozc));
  sep.add(K.box(0.3, bh - oy1, oz1 - oz0, M.concreteLight, bx0 + 0.15, Y + oy1, ozc));
  [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1]].forEach(([x, z]) => sep.add(K.box(0.12, bh, 0.12, M.darkSteel, x, Y, z)));
  sep.add(K.box(0.06, 0.06, oz1 - oz0 + 0.12, M.darkSteel, bx0 - 0.02, Y + oy0 - 0.03, ozc));
  [oz0 - 0.03, oz1 + 0.03].forEach((z) => sep.add(K.box(0.06, oy1 - oy0, 0.06, M.darkSteel, bx0 - 0.02, Y + oy0, z)));
  sep.add(K.box(0.36, 0.4, bd + 0.04, M.panel, bx0 + 0.15, Y, bcz));
  sep.add(K.box(bw + 0.24, 0.22, bd + 0.24, M.panel, bcx, Y + bh, bcz));
  sep.add(K.box(bw + 0.3, 0.06, 0.06, M.amberMatte, bcx, Y + bh + 0.22, bz0 - 0.12));
  // juntas de los paneles de fachada
  for (let z = bz0 + 1.4; z < bz1 - 0.2; z += 1.4) {
    if (z > oz0 - 0.1 && z < oz1 + 0.1) continue;
    sep.add(K.box(0.012, bh - 0.45, 0.035, M.panel, bx0 - 0.006, Y + 0.42, z));
  }
  sep.add(K.box(0.012, 0.03, bd, M.panel, bx0 - 0.006, Y + 2.5, bcz));
  for (let x = bx0 + 0.85; x < bx1; x += 0.85) sep.add(K.box(0.035, bh - 0.45, 0.012, M.panel, x, Y + 0.42, bz0 - 0.006));
  // interior iluminado: separador de tambor elevado sobre bastidor (se ve por la boca, detrás de la
  // tolva), tolva de finos bajo el tambor, contenedor de finos y tiras de luz
  sep.add(K.box(bw - 0.6, 0.04, bd - 0.6, M.floor, bcx, Y, bcz));
  sep.add(K.box(0.04, bh - 0.5, 2.8, M.ivory, bx1 - 0.32, Y + 0.25, ozc));
  [-1, 1].forEach((s) => sep.add(K.box(bw - 0.6, bh - 0.5, 0.04, M.ivory, bcx, Y + 0.25, ozc + s * 1.42)));
  const drX = bx0 + 1.45;
  const drY = Y + 2.3;
  const drum = K.cyl(0.5, 0.5, 1.9, M.steel, 24);
  drum.rotation.x = Math.PI / 2;
  drum.position.set(drX, drY, ozc);
  sep.add(drum);
  [-0.8, -0.25, 0.8].forEach((dz) => {
    const ring = K.cyl(0.53, 0.53, dz === -0.25 ? 0.05 : 0.09, M.darkSteel, 24);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(drX, drY, ozc + dz);
    sep.add(ring);
  });
  // bastidor: patas, cunas bajo los aros y motor de accionamiento
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => sep.add(K.box(0.08, drY - Y - 0.45, 0.08, M.darkSteel, drX + sx * 0.45, Y, ozc + sz * 0.8))));
  [-0.8, 0.8].forEach((dz) => sep.add(K.box(1.0, 0.08, 0.1, M.darkSteel, drX, drY - 0.53, ozc + dz)));
  [-1, 1].forEach((sx) => sep.add(K.box(0.06, 0.06, 1.7, M.darkSteel, drX + sx * 0.45, Y + 0.9, ozc)));
  sep.add(K.rbox(0.3, 0.26, 0.36, M.graphiteLight, drX + 0.35, drY - 0.53, ozc - 1.1, 0.03));
  sep.add(new THREE.Mesh(K.geo('sepHopper', () => frustumShell(1.1, 1.6, 0.5, 0.7)), M.steel).translateX(drX).translateY(Y + 1.0).translateZ(ozc));
  sep.add(K.box(1.2, 0.7, 2.2, M.darkSteel, drX, Y, ozc));
  [0.35, 1.15, 1.75].forEach((dx2) => sep.add(K.box(0.14, 0.04, 2.2, M.warmGlow, bx0 + dx2, Y + bh - 0.06, ozc)));
  // luminaria colgada justo detrás del dintel: la luz del interior se ve desde la pasarela
  [-0.7, 0.7].forEach((dz) => sep.add(K.box(0.015, bh - 3.06, 0.015, M.darkSteel, bx0 + 0.55, Y + 3.06, ozc + dz)));
  sep.add(K.box(0.12, 0.06, 1.7, M.graphite, bx0 + 0.55, Y + 3.0, ozc));
  sep.add(K.box(0.07, 0.012, 1.6, M.warmGlow, bx0 + 0.55, Y + 2.99, ozc));
  // marquesina con luz cálida, apliques y rótulo del gestor
  sep.add(K.box(0.75, 0.1, oz1 - oz0 + 0.7, M.panel, bx0 - 0.3, Y + oy1 + 0.1, ozc));
  sep.add(K.box(0.05, 0.03, oz1 - oz0 + 0.5, M.warmGlow, bx0 - 0.6, Y + oy1 + 0.08, ozc));
  [oz0 - 0.75, oz1 + 0.75].forEach((z) => {
    sep.add(K.rbox(0.18, 0.3, 0.3, M.graphite, bx0 - 0.09, Y + 2.55, z, 0.03));
    sep.add(K.box(0.02, 0.22, 0.24, M.warmGlow, bx0 - 0.19, Y + 2.59, z));
  });
  // bajante, caja de mando con piloto y franjas de seguridad en el alféizar
  sep.add(K.box(0.1, bh, 0.1, M.darkSteel, bx0 - 0.07, Y, bz1 - 0.35));
  sep.add(K.rbox(0.16, 0.5, 0.36, M.graphite, bx0 - 0.08, Y + 1.1, oz0 - 0.62, 0.03));
  sep.add(K.box(0.02, 0.06, 0.06, ind, bx0 - 0.17, Y + 1.48, oz0 - 0.62));
  const sill = label(7, oz1 - oz0, 0.22);
  sill.rotation.y = -Math.PI / 2;
  sill.position.set(bx0 - 0.008, Y + oy0 - 0.16, ozc);
  sep.add(sill);
  // 3 · Separación: cartel de etapa sobre la marquesina
  const sepSign = stageLabel(2, 1.3);
  sepSign.rotation.y = -Math.PI / 2;
  sepSign.position.set(bx0 - 0.01, Y + 3.62, ozc);
  sep.add(sepSign);
  // cubierta: extractor y chimenea con bridas
  sep.add(K.rbox(1.1, 0.6, 1.4, M.graphite, bcx + 0.2, Y + bh + 0.22, bz1 - 1.4, 0.05));
  sep.add(K.box(0.9, 0.04, 1.2, M.darkSteel, bcx + 0.2, Y + bh + 0.82, bz1 - 1.4));
  const stack = K.cyl(0.22, 0.22, 2.3, M.steel, 16);
  stack.position.set(bcx + 0.3, Y + bh + 1.37, bz0 + 1.3);
  sep.add(stack);
  [0.6, 1.5].forEach((dy) => {
    const fl = K.cyl(0.28, 0.28, 0.06, M.darkSteel, 16);
    fl.position.set(bcx + 0.3, Y + bh + 0.22 + dy, bz0 + 1.3);
    sep.add(fl);
  });
  const capS = K.cyl(0.04, 0.34, 0.2, M.darkSteel, 16);
  capS.position.set(bcx + 0.3, Y + bh + 2.65, bz0 + 1.3);
  sep.add(capS);
  ctx.add(sep);
  ctx.shadows.push({ x: bcx, y: Y, z: bcz, w: bw + 0.8, d: bd + 0.8 });

  // tolva corta: el plástico triturado sale por la boca y cae al contenedor
  const chA = V(bx0 + 0.6, Y + 2.48, ozc);
  const chB = V(s5.x + 11.5, Y + 2.1, ozc);
  const chLen = chA.distanceTo(chB);
  const chute = new THREE.Group();
  chute.position.copy(chA);
  chute.lookAt(chB);
  chute.add(K.box(0.62, 0.04, chLen, M.rubber, 0, -0.02, chLen / 2));
  [-1, 1].forEach((s) => {
    chute.add(K.box(0.04, 0.22, chLen, M.darkSteel, s * 0.33, -0.05, chLen / 2));
    chute.add(K.box(0.1, 0.025, chLen, M.steel, s * 0.36, 0.17, chLen / 2));
    chute.add(K.box(0.06, 0.12, chLen, M.darkSteel, s * 0.26, -0.17, chLen / 2));
  });
  const chHead = K.cyl(0.12, 0.12, 0.66, M.darkSteel, 14);
  chHead.rotation.z = Math.PI / 2;
  chHead.position.set(0, -0.07, chLen);
  chute.add(chHead);
  chute.updateMatrix();
  ctx.add(chute);
  ctx.add(bar(V(bx0 - 0.02, Y + 1.5, ozc), new THREE.Vector3(0, -0.2, chLen * 0.55).applyMatrix4(chute.matrix), 0.035, M.darkSteel, 6));
  // virutas de plástico en movimiento sobre la tolva y cayendo al montón
  const CHIPS = 30;
  const chipV = 0.4;
  const fallT = 0.3;
  const runT = chLen / chipV;
  const chipCycle = runT + fallT;
  // (las virutas son instancias extra de la malla de plástico triturado, al final de su lista)
  const chipDir = new THREE.Vector3().subVectors(chB, chA).normalize();
  let shardMesh = null;
  let chipBase = 0;

  // 1 · Drenaje: el electrolito se vacía antes de triturar y se guarda en depósitos (GRG) sobre cubeto, junto a
  // la entrada de la cinta. Tanque de drenaje de polietileno sobre su propio cubeto y bajante desde el túnel.
  const ibcX = s5.x - 3.4;
  const ibcZ = s5.z - 5.0;
  const tanks = new THREE.Group();
  tanks.add(K.box(1.3, 0.12, 2.65, M.graphite, ibcX, Y, ibcZ));
  tanks.add(K.box(1.32, 0.03, 0.04, M.amberMatte, ibcX, Y + 0.12, ibcZ - 1.31));
  [ibcZ - 0.6, ibcZ + 0.6].forEach((z) => {
    const x = ibcX;
    tanks.add(K.box(1.0, 0.12, 1.16, M.darkSteel, x, Y + 0.12, z));
    tanks.add(K.rbox(0.92, 0.94, 1.08, M.ivory, x, Y + 0.25, z, 0.07));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => tanks.add(K.box(0.035, 1.0, 0.035, M.darkSteel, x + sx * 0.48, Y + 0.24, z + sz * 0.56)));
    [0.55, 0.88, 1.2].forEach((y) => {
      [-1, 1].forEach((s) => {
        tanks.add(K.box(0.97, 0.025, 0.025, M.darkSteel, x, Y + y, z + s * 0.56));
        tanks.add(K.box(0.025, 0.025, 1.12, M.darkSteel, x + s * 0.48, Y + y, z));
      });
    });
    [-0.28, 0, 0.28].forEach((dz) => tanks.add(K.box(0.02, 0.96, 0.02, M.darkSteel, x - 0.485, Y + 0.25, z + dz)));
    const lid = K.cyl(0.11, 0.11, 0.07, M.graphite, 14);
    lid.position.set(x, Y + 1.23, z);
    tanks.add(lid);
    tanks.add(K.box(0.12, 0.1, 0.12, M.graphite, x - 0.5, Y + 0.3, z));
  });
  // tanque de drenaje: cubeto con canto ámbar, depósito vertical marfil, aros, boca de hombre y bajante
  const dX = s5.x - 5.5;
  const dZ = s5.z - 5.1;
  tanks.add(K.box(2.0, 0.28, 2.0, M.concreteLight, dX, Y, dZ));
  tanks.add(K.box(2.02, 0.04, 0.06, M.amberMatte, dX, Y + 0.28, dZ + 0.98));
  tanks.add(K.box(0.06, 0.04, 2.02, M.amberMatte, dX - 0.98, Y + 0.28, dZ));
  const dBody = K.cyl(0.62, 0.62, 1.7, M.ivory, 20);
  dBody.position.set(dX, Y + 0.28 + 0.85, dZ);
  tanks.add(dBody);
  const dTop = K.cyl(0.3, 0.64, 0.22, M.ivory, 20);
  dTop.position.set(dX, Y + 2.09, dZ);
  tanks.add(dTop);
  [0.75, 1.55].forEach((y) => {
    const r = K.cyl(0.635, 0.635, 0.05, M.darkSteel, 20);
    r.position.set(dX, Y + y, dZ);
    tanks.add(r);
  });
  const dLid = K.cyl(0.17, 0.17, 0.08, M.graphite, 12);
  dLid.position.set(dX, Y + 2.24, dZ);
  tanks.add(dLid);
  tanks.add(K.box(0.1, 1.1, 0.1, M.darkSteel, dX + 0.55, Y + 0.28, dZ + 0.55));
  tanks.add(K.box(0.04, 0.04, 0.6, M.amberMatte, dX - 0.4, Y + 0.6, dZ + 0.62));
  // bajante desde la bandeja bajo el túnel de entrada de la cinta
  tanks.add(K.pipe([V(s5.x - 8.6, Y + 0.32, s5.z - 2.6), V(s5.x - 7.4, Y + 0.35, s5.z - 4.1), V(dX - 0.5, Y + 0.9, dZ + 0.25)], 0.06, M.darkSteel, 14));
  ctx.add(tanks);
  ctx.shadows.push({ x: ibcX, y: Y, z: ibcZ, w: 1.8, d: 3.1 });
  ctx.shadows.push({ x: dX, y: Y, z: dZ, w: 2.4, d: 2.4 });
  stagePost(0, dX - 1.15, dZ - 0.4, -2.2);

  // ---------- contenedores troncocónicos con lo que sale de la separación (posiciones fijas) ----------
  // De oeste a este: pasta de plomo (junto al reactor de desulfuración), rejillas y bornes de plomo (al horno) y
  // polipropileno triturado (bajo la tolva de la nave). Sin cobre (§9.6).
  const binOut = K.geo('binOut', () => frustumShell(3.4, 2.6, 0.88, 1.6));
  const binIn = K.geo('binIn', () => frustumShell(3.26, 2.46, 0.88, 1.58, true));
  const tz = Math.atan(0.156 / 1.6); // (inclinación de las paredes de los contenedores)
  const tx = Math.atan(0.204 / 1.6);
  const piles = { chunk: [], shard: [] };
  const BIN_Z = s5.z + 5.95;
  const bins = [['paste', 3, s5.x + 2.4], ['chunk', 1, s5.x + 6.6], ['shard', 2, s5.x + 10.8]];
  // por tipo: piezas, semiejes del montón (la pieza no atraviesa la pared interior) y altura de la cima
  const heapSpec = {
    chunk: [520, 1.5, 1.1, 0.55],
    shard: [620, 1.5, 1.1, 0.5],
  };
  // montón que llega a las paredes: secuencia R2 repartida por todo el rectángulo (también las
  // esquinas) y cima redondeada en el centro que asoma unos 0,4 m sobre el labio
  const heap = (list, cx, cz, rx, rz, base, peak, n, seed) => {
    for (let k = 0; k < n; k++) {
      const u = ((0.5 + k * 0.7548777 + seed * 0.13) % 1) * 2 - 1;
      const v = ((0.5 + k * 0.5698403 + seed * 0.29) % 1) * 2 - 1;
      const f = Math.max(0, 1 - 0.55 * (u * u + v * v) - 0.45 * Math.max(u * u, v * v));
      const top = base + peak * Math.pow(f, 0.75) + ((k * 7) % 5) * 0.012;
      list.push([cx + u * rx, top - (k % 3 === 0 ? 0.05 : 0), cz + v * rz, k + seed * 31]);
    }
  };
  bins.forEach(([kind, cell, bx], i) => {
    const bz = BIN_Z;
    const bin = new THREE.Group();
    // patines longitudinales y bolsillos para la carretilla
    [-0.8, 0.8].forEach((z) => bin.add(K.box(2.9, 0.12, 0.22, M.darkSteel, 0, 0, z)));
    [-0.85, 0.85].forEach((x) => bin.add(K.box(0.34, 0.12, 2.1, M.darkSteel, x, 0, 0)));
    // chapa galvanizada gris medio por fuera; nervios, patines e interior en acero oscuro
    bin.add(new THREE.Mesh(binOut, galv).translateY(0.12));
    bin.add(new THREE.Mesh(binIn, M.darkSteel).translateY(0.14));
    bin.add(K.box(2.9, 0.06, 2.2, M.darkSteel, 0, 0.12, 0));
    // labio superior
    [-1, 1].forEach((s) => {
      bin.add(K.box(3.5, 0.07, 0.15, M.steel, 0, 1.7, s * 1.27));
      bin.add(K.box(0.15, 0.07, 2.6, M.steel, s * 1.67, 1.7, 0));
      bin.add(K.box(0.08, 0.1, 0.22, M.darkSteel, s * 1.78, 1.25, 0));
    });
    // nervios exteriores siguiendo la inclinación de las paredes
    [-1.3, -0.6, 0.6, 1.3].forEach((x) => {
      [-1, 1].forEach((s) => {
        const rib = K.box(0.07, 1.5, 0.05, M.darkSteel, x, 0.16, s * 1.245);
        rib.rotation.x = s * tz;
        bin.add(rib);
      });
    });
    [-0.6, 0.6].forEach((z) => {
      [-1, 1].forEach((s) => {
        const rib = K.box(0.05, 1.5, 0.07, M.darkSteel, s * 1.63, 0.16, z);
        rib.rotation.z = -s * tx;
        bin.add(rib);
      });
    });
    // placa de material, piloto ámbar y relleno oscuro bajo el montón (los huecos se leen como grietas)
    const plate = label(cell, 0.84, 0.42);
    plate.rotation.set(-tz, Math.PI, 0);
    plate.position.set(0, 1.15, -1.258);
    bin.add(plate);
    bin.add(K.box(0.08, 0.08, 0.03, ind, 0.95, 1.22, -1.27));
    bin.add(K.box(3.12, 0.05, 2.34, M.shard, 0, 1.52, 0));
    if (kind === 'paste') {
      // pasta de plomo: un montón continuo, mate
      const mound = new THREE.Mesh(K.geo('pasteMound', () => new THREE.SphereGeometry(1, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.48, 0.42, 1.08)), M.concrete);
      mound.position.y = 1.5;
      bin.add(mound);
    }
    bin.position.set(bx, Y, bz);
    ctx.add(bin);
    ctx.shadows.push({ x: bx, y: Y, z: bz, w: 4.3, d: 3.5 });
    if (heapSpec[kind]) {
      const [n, rx, rz, peak] = heapSpec[kind];
      heap(piles[kind], bx, bz, rx, rz, Y + 1.6, peak, n, i + 1);
    }
  });

  // instancias de los montones: una malla por tipo de pieza para todo el gestor
  const pileGeo = {
    chunk: () => nuggetGeometry(),
    shard: () => new THREE.OctahedronGeometry(0.06, 0).scale(1.3, 0.38, 1),
  };
  const pileMat = { chunk: leadMat, shard: M.shard };
  Object.keys(piles).forEach((kind) => {
    const list = piles[kind];
    const extra = kind === 'shard' ? CHIPS : 0;
    const im = new THREE.InstancedMesh(K.geo(`pile-${kind}`, pileGeo[kind]), pileMat[kind], list.length + extra);
    if (kind === 'shard') {
      shardMesh = im;
      chipBase = list.length;
    }
    list.forEach(([x, y, z, k], i) => {
      o3.position.set(x, y, z);
      o3.rotation.set(Math.sin(k * 1.7) * 0.4, k * 1.37, Math.cos(k * 2.3) * 0.4);
      o3.scale.setScalar(0.82 + (k % 4) * 0.11);
      o3.updateMatrix();
      im.setMatrixAt(i, o3.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    ctx.add(im);
  });

  // ---------- 4 · Desulfuración: reactor agitado junto al contenedor de pasta ----------
  // La pasta se trata con carbonato o hidróxido de sodio (hecho proceso_reciclaje-f4); el sulfato de sodio que
  // resulta, junto con el del electrolito, sale cristalizado en sacos (proceso_reciclaje-f7 y f19).
  const rX = s5.x - 1.85;
  const rZ = BIN_Z;
  const reactor = new THREE.Group();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    reactor.add(K.box(0.1, 1.05, 0.1, M.darkSteel, rX + sx * 0.56, Y, rZ + sz * 0.56));
    reactor.add(K.box(0.22, 0.02, 0.22, M.darkSteel, rX + sx * 0.56, Y, rZ + sz * 0.56));
  });
  const rCone = K.cyl(0.85, 0.22, 0.55, M.steel, 20);
  rCone.position.set(rX, Y + 1.05, rZ);
  reactor.add(rCone);
  const rBody = K.cyl(0.85, 0.85, 1.9, M.steel, 20);
  rBody.position.set(rX, Y + 2.27, rZ);
  reactor.add(rBody);
  [1.75, 2.75].forEach((y) => {
    const ring = K.cyl(0.865, 0.865, 0.05, M.darkSteel, 20);
    ring.position.set(rX, Y + y, rZ);
    reactor.add(ring);
  });
  const rDish = K.cyl(0.42, 0.87, 0.22, M.darkSteel, 20);
  rDish.position.set(rX, Y + 3.33, rZ);
  reactor.add(rDish);
  // agitador: motor, reductor y soporte
  reactor.add(K.rbox(0.42, 0.46, 0.42, M.graphiteLight, rX, Y + 3.44, rZ, 0.04));
  const rGear = K.cyl(0.2, 0.2, 0.28, M.darkSteel, 12);
  rGear.position.set(rX, Y + 4.04, rZ);
  reactor.add(rGear);
  reactor.add(K.box(0.07, 0.07, 0.02, ind, rX + 0.18, Y + 3.7, rZ - 0.22));
  // tornillo de pasta desde el contenedor y bomba de descarga hacia la cristalización
  reactor.add(bar(V(s5.x + 0.75, Y + 1.72, rZ - 0.3), V(rX + 0.5, Y + 3.3, rZ - 0.3), 0.11, M.darkSteel, 8));
  reactor.add(K.rbox(0.5, 0.36, 0.34, M.graphite, rX - 1.0, Y, rZ - 0.55, 0.03));
  reactor.add(bar(V(rX - 0.75, Y + 0.25, rZ - 0.55), V(rX - 0.18, Y + 0.85, rZ - 0.2), 0.045, M.darkSteel, 8));
  ctx.add(reactor);
  ctx.shadows.push({ x: rX, y: Y, z: rZ, w: 2.2, d: 2.2 });
  stagePost(3, rX - 0.6, rZ - 1.35, -2.5);
  // sacos de sulfato de sodio en dos palés (producto del electrolito y de la desulfuración)
  [[s5.x - 4.9, BIN_Z - 0.35], [s5.x - 4.9, BIN_Z + 0.85]].forEach(([x, z], p) => {
    pallet(x, Y, z);
    for (let L = 0; L < 3 - p; L++) {
      const rot = L % 2 === 1;
      for (let j = 0; j < 4; j++) {
        const a = (j % 2) - 0.5;
        const b = Math.floor(j / 2) - 0.5;
        const sk = rot ? K.box(0.36, 0.2, 0.5, M.ivoryPanel, x + a * 0.56, Y + 0.144 + L * 0.205, z + b * 0.44) : K.box(0.54, 0.2, 0.4, M.ivoryPanel, x + a * 0.58, Y + 0.144 + L * 0.205, z + b * 0.44);
        yard.add(sk);
      }
    }
    ctx.shadows.push({ x, y: Y, z, w: 1.6, d: 1.4 });
  });
  platePost(8, s5.x - 6.3, BIN_Z - 1.0, -2.3);

  // ---------- 5 · Fundición: horno rotativo con la boca encendida hacia el norte ----------
  // Pasta desulfurada y rejillas se funden con fundentes y un reductor; se sangra plomo bruto (proceso_reciclaje-f5).
  // La boca es emisiva (sin luz real); el charco de luz lo pone una baliza del suelo.
  const fX = s5.x - 13.4;
  const fZ = s5.z + 6.0;
  const fY = Y + 1.55;
  const furnace = new THREE.Group();
  furnace.add(K.box(2.5, 0.32, 4.7, M.concreteLight, fX, Y, fZ));
  furnace.add(K.box(2.52, 0.03, 0.05, M.amberMatte, fX, Y + 0.32, fZ - 2.33));
  [fZ - 1.05, fZ + 1.05].forEach((z) => {
    // estación de rodillos y aro de rodadura
    [-1, 1].forEach((s) => {
      furnace.add(K.box(0.42, 0.42, 0.5, M.darkSteel, fX + s * 0.66, Y + 0.32, z));
      const roller = K.cyl(0.17, 0.17, 0.3, M.graphite, 12);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(fX + s * 0.66, Y + 0.86, z);
      furnace.add(roller);
    });
    const tyre = K.cyl(1.0, 1.0, 0.2, M.darkSteel, 24);
    tyre.rotation.x = Math.PI / 2;
    tyre.position.set(fX, fY, z);
    furnace.add(tyre);
  });
  const shell = K.cyl(0.9, 0.9, 3.9, M.darkSteel, 24);
  shell.rotation.x = Math.PI / 2;
  shell.position.set(fX, fY, fZ);
  furnace.add(shell);
  // corona dentada y motorreductor
  const girth = K.cyl(1.04, 1.04, 0.1, M.graphite, 24);
  girth.rotation.x = Math.PI / 2;
  girth.position.set(fX, fY, fZ + 0.2);
  furnace.add(girth);
  furnace.add(K.rbox(0.55, 0.5, 0.6, M.graphiteLight, fX + 1.25, Y + 0.32, fZ + 0.2, 0.04));
  // boca: aro oscuro, brasa ámbar y núcleo cálido (por encima del umbral del resplandor)
  const mouthZ = fZ - 1.95;
  const lip = K.cyl(0.94, 0.94, 0.12, M.graphite, 24);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(fX, fY, mouthZ - 0.02);
  furnace.add(lip);
  const ember = K.cyl(0.66, 0.66, 0.02, M.amberGlow, 24);
  ember.rotation.x = Math.PI / 2;
  ember.position.set(fX, fY, mouthZ - 0.09);
  furnace.add(ember);
  const core = K.cyl(0.42, 0.42, 0.02, M.warmGlow, 20);
  core.rotation.x = Math.PI / 2;
  core.position.set(fX, fY - 0.08, mouthZ - 0.1);
  furnace.add(core);
  // puerta abierta sobre su bisagra, campana de humos y chimenea hacia la depuración de gases
  const door = K.box(1.35, 1.35, 0.14, M.darkSteel, -0.675, -0.675, 0);
  const doorG = new THREE.Group();
  doorG.add(door);
  doorG.add(K.box(1.0, 1.0, 0.02, M.panel, -0.675, -0.5, 0.08));
  doorG.position.set(fX + 0.95, fY, mouthZ - 0.12);
  doorG.rotation.y = -1.75;
  furnace.add(doorG);
  furnace.add(K.rbox(2.0, 0.5, 1.15, M.steel, fX, fY + 1.15, mouthZ - 0.35, 0.04));
  const fStack = K.cyl(0.24, 0.24, 3.2, M.steel, 14);
  fStack.position.set(fX, fY + 3.2, mouthZ - 0.3);
  furnace.add(fStack);
  const fCapH = K.cyl(0.3, 0.3, 0.07, M.darkSteel, 14);
  fCapH.position.set(fX, fY + 2.2, mouthZ - 0.3);
  furnace.add(fCapH);
  // quemador en el extremo sur
  const burner = K.cyl(0.36, 0.5, 0.5, M.graphiteLight, 16);
  burner.rotation.x = Math.PI / 2;
  burner.position.set(fX, fY, fZ + 2.2);
  furnace.add(burner);
  furnace.add(K.rbox(0.6, 0.6, 0.55, M.graphite, fX + 0.75, Y + 0.32, fZ + 2.15, 0.04));
  furnace.add(K.box(0.07, 0.07, 0.02, ind, fX + 0.75, Y + 0.8, fZ + 1.86));
  ctx.add(furnace);
  ctx.shadows.push({ x: fX, y: Y, z: fZ, w: 3.0, d: 5.2 });
  stagePost(4, fX - 1.55, mouthZ + 0.35, -2.45);
  // charcos de luz de las balizas: delante de la boca y a lo largo de la colada
  ctx.lamps.push({ x: fX - 1.0, y: Y, z: mouthZ - 1.55 });
  ctx.lamps.push({ x: s5.x - 8.6, y: Y, z: s5.z + 1.2 });

  // ---------- 6 · Refino: dos calderos empotrados en su banco, con agitador ----------
  // El plomo bruto se refina en calderas hasta plomo blando (proceso_reciclaje-f6). Mirillas de los quemadores.
  const kX = s5.x - 9.8;
  const kZ = fZ;
  const kettles = new THREE.Group();
  kettles.add(K.box(1.9, 0.95, 4.1, M.concreteLight, kX, Y, kZ));
  kettles.add(K.box(1.92, 0.05, 4.12, M.darkSteel, kX, Y + 0.95, kZ));
  const kz = [kZ - 1.0, kZ + 1.0];
  kz.forEach((z) => {
    const rim = K.cyl(0.8, 0.8, 0.12, M.darkSteel, 24);
    rim.position.set(kX, Y + 1.06, z);
    kettles.add(rim);
    const melt = K.cyl(0.7, 0.7, 0.02, leadMat, 24);
    melt.position.set(kX, Y + 1.115, z);
    kettles.add(melt);
    // mirillas de los quemadores en la cara oeste
    kettles.add(K.box(0.02, 0.12, 0.28, M.amberGlow, kX - 0.96, Y + 0.32, z));
    kettles.add(K.box(0.03, 0.2, 0.36, M.darkSteel, kX - 0.955, Y + 0.28, z));
  });
  // pórtico del agitador sobre el primer caldero
  [-1, 1].forEach((s) => kettles.add(K.box(0.08, 1.6, 0.08, M.darkSteel, kX + s * 0.85, Y + 1.0, kz[1])));
  kettles.add(K.box(1.8, 0.1, 0.12, M.darkSteel, kX, Y + 2.6, kz[1]));
  kettles.add(K.rbox(0.36, 0.4, 0.36, M.graphiteLight, kX, Y + 2.7, kz[1], 0.03));
  kettles.add(K.box(0.05, 1.5, 0.05, M.steel, kX, Y + 1.2, kz[1]));
  ctx.add(kettles);
  ctx.shadows.push({ x: kX, y: Y, z: kZ, w: 2.4, d: 4.6 });
  stagePost(5, kX + 1.35, kz[1] + 0.2, -2.3);

  // ---------- 7 · Colada: lingotera de cadena desde el primer caldero hasta la mesa de apilado ----------
  // Las lingoteras avanzan; tras el caño se llenan y, al final, el lingote sale hacia las pilas.
  const cx0 = s5.x - 9.4;
  const cLen = 8.0;
  const cz = s5.z + 2.3;
  const cTop = Y + 0.72;
  const cast = new THREE.Group();
  [-1, 1].forEach((s) => cast.add(K.box(cLen, 0.12, 0.07, M.darkSteel, cx0 + cLen / 2, cTop - 0.14, cz + s * 0.34)));
  for (let x = cx0 + 0.3; x < cx0 + cLen; x += 1.6) {
    [-1, 1].forEach((s) => cast.add(K.box(0.08, cTop - 0.14 - Y, 0.08, M.darkSteel, x, Y, cz + s * 0.34)));
  }
  [cx0 + 0.05, cx0 + cLen - 0.05].forEach((x) => {
    const sp = K.cyl(0.16, 0.16, 0.74, M.graphite, 12);
    sp.rotation.x = Math.PI / 2;
    sp.position.set(x, cTop - 0.14, cz);
    cast.add(sp);
  });
  cast.add(K.rbox(0.5, 0.42, 0.4, M.graphiteLight, cx0 + cLen - 0.3, Y, cz + 0.62, 0.03));
  // caño de colada: del caldero a la primera lingotera, con el chorro de plomo
  const pourX = cx0 + 0.75;
  cast.add(bar(V(kX + 0.2, Y + 1.35, kz[0] - 0.55), V(pourX, cTop + 0.42, cz + 0.05), 0.07, M.darkSteel, 8));
  cast.add(K.box(0.04, 0.3, 0.04, leadMat, pourX, cTop + 0.1, cz));
  // mesa de apilado al final de la línea
  const tabX = cx0 + cLen + 0.55;
  cast.add(K.box(0.9, 0.62, 0.9, M.darkSteel, tabX, Y, cz));
  cast.add(K.box(0.94, 0.04, 0.94, M.steel, tabX, Y + 0.62, cz));
  ctx.add(cast);
  ctx.shadows.push({ x: cx0 + cLen / 2, y: Y, z: cz, w: cLen + 1, d: 1.2 });
  stagePost(6, cx0 + 5.6, cz - 0.95, -2.6);
  // lingoteras y lingotes: dos instanciadas que avanzan (no proyectan sombra: el mapa es estático)
  const MOLDS = 16;
  const pitch = cLen / MOLDS;
  const molds = new THREE.InstancedMesh(K.geo('castMold', () => new THREE.BoxGeometry(0.44, 0.12, 0.27)), M.darkSteel, MOLDS);
  const castIngots = new THREE.InstancedMesh(K.geo('ingot', ingotGeometry), leadMat, MOLDS + 6);
  [molds, castIngots].forEach((im) => {
    im.castShadow = false;
    im.receiveShadow = true;
    im.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx0 + cLen / 2 + 0.3, cTop, cz), cLen / 2 + 1.2);
    ctx.add(im);
  });
  // seis lingotes ya enfriados en la mesa de apilado (fijos)
  for (let j = 0; j < 6; j++) {
    o3.position.set(tabX - 0.2 + (j % 2) * 0.4, Y + 0.72 + Math.floor(j / 2) * 0.11, cz + (Math.floor(j / 2) % 2 ? -0.12 : 0.1));
    o3.rotation.set(0, Math.floor(j / 2) % 2 ? Math.PI / 2 : 0, 0);
    o3.scale.setScalar(1);
    o3.updateMatrix();
    castIngots.setMatrixAt(MOLDS + j, o3.matrix);
  }
  o3.rotation.set(0, 0, 0);
  const castV = 0.22;
  const wrapN = (v, m) => ((v % m) + m) % m;
  const placeCasting = (tt) => {
    for (let j = 0; j < MOLDS; j++) {
      const d = wrapN(tt * castV + j * pitch, cLen);
      const x = cx0 + 0.1 + d * ((cLen - 0.2) / cLen);
      // entra y sale por debajo de la cadena en los extremos
      const edge = Math.min(1, d / 0.25, (cLen - d) / 0.25);
      o3.position.set(x, cTop - 0.12 * (1 - edge), cz);
      o3.scale.set(1, Math.max(edge, 0.001), 1);
      o3.updateMatrix();
      molds.setMatrixAt(j, o3.matrix);
      // el lingote aparece al pasar bajo el caño y se retira antes del final
      const fill = clamp((x - pourX + 0.1) / 0.3, 0, 1) * clamp((cx0 + cLen - 0.35 - x) / 0.2, 0, 1);
      o3.position.set(x, cTop + 0.02, cz);
      o3.scale.setScalar(Math.max(fill, 0.001));
      o3.updateMatrix();
      castIngots.setMatrixAt(j, o3.matrix);
    }
    o3.scale.setScalar(1);
    molds.instanceMatrix.needsUpdate = true;
    const ca = castIngots.instanceMatrix;
    ca.clearUpdateRanges();
    ca.addUpdateRange(0, MOLDS * 16);
    ca.needsUpdate = true;
  };

  // ---------- salidas: pilas de lingotes de plomo y big bags de granza de polipropileno ----------
  const outs = new THREE.Group();
  [[s5.x + 0.6, cz - 0.05, 0], [s5.x + 2.25, cz - 0.05, 0], [s5.x + 1.45, cz + 1.25, Math.PI / 2]].forEach(([x, z, r], j) => {
    const st = makeIngotStack(M, { rows: 3, cols: 4, layers: j === 2 ? 3 : 4 });
    st.position.set(x, Y, z);
    st.rotation.y = r;
    outs.add(st);
    ctx.shadows.push({ x, y: Y, z, w: 1.5, d: 1.3 });
  });
  [[s5.x + 4.15, s5.z + 1.75], [s5.x + 5.35, s5.z + 1.75], [s5.x + 4.75, s5.z + 2.95]].forEach(([x, z], j) => {
    const bag = makePelletBag(M);
    bag.position.set(x, Y, z);
    bag.rotation.y = j * 0.35;
    outs.add(bag);
    ctx.shadows.push({ x, y: Y, z, w: 1.3, d: 1.3 });
  });
  ctx.add(outs);
  platePost(0, s5.x + 1.45, cz - 1.0, -2.75);
  platePost(9, s5.x + 3.35, s5.z + 3.2, -2.4);

  // ---------- personas: operarios de planta (casco y chaleco) y, junto al horno, traje aluminizado ----------
  const person = (role, pose, x, z, ry) => {
    const p = makePerson(M, { role, pose });
    p.position.set(x, Y, z);
    p.rotation.y = ry;
    ctx.add(p);
    ctx.shadows.push({ x, y: Y, z, w: 0.75, d: 0.6 });
  };
  person('horno', 'work', fX + 0.35, mouthZ - 1.05, 0.12);
  person('planta', 'work', cx0 + 3.6, cz - 0.95, 0);
  person('planta', 'look', s5.x - 0.75, BIN_Z - 2.05, 0.15);

  // ---------- camión de salida: lingotes y granza hacia la fábrica de baterías nuevas ----------
  // Espera cargado en el paso del murete este (ACCESS.east) durante el reciclaje; desde la trazabilidad hasta el
  // cierre sale por la calzada este hacia la fábrica (ACCESS.factory). Compactado, una malla por material; no
  // proyecta sombra (el mapa de sombras es estático). Con movimiento reducido está aparcado hasta la trazabilidad y,
  // en el cierre, en la fábrica.
  // (K.compact une cabina, caja y carga en una malla por material: 12 llamadas en vez de 14)
  const truck = K.compact(makeTruck(M, { kind: 'lingotes', loaded: true, mergeCargo: true, dynamic: true }));
  truck.userData.dynamic = true;
  truck.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = true;
  });
  const tBox = new THREE.Box3().setFromObject(truck);
  const tC = tBox.getCenter(new THREE.Vector3());
  const tHalf = (tBox.max.z - tBox.min.z) / 2;
  truck.position.set(-tC.x, 0, -tC.z);
  const truckRig = new THREE.Group();
  truckRig.userData.dynamic = true;
  truckRig.add(truck);
  ctx.add(truckRig);
  // Recorrido por las carreteras del entorno (environment.js): carril derecho de la calzada este, giro a la izquierda
  // a la carretera de la orilla (eje x = orilla + 23), y a la derecha por el acceso de la fábrica hasta su explanada.
  // Cotas: suelo de la isla, rasante recta de la calzada (de 1,5 cm sobre la isla al firme de la orilla, 0,39) y
  // explanada de la fábrica (0,37).
  const E = ACCESS.east;
  const fac = ACCESS.factory;
  const ROAD_Y = E.shore.y + 0.08;
  const yAt = (x) => {
    if (x <= E.rim.x - 0.5) return Y;
    if (x < E.shore.x) return THREE.MathUtils.lerp(E.rim.y + 0.015, ROAD_Y, (x - (E.rim.x - 0.5)) / (E.shore.x - (E.rim.x - 0.5)));
    return x > fac.x - 29 ? E.shore.y + 0.06 : ROAD_Y;
  };
  const P = (x, z) => V(x, yAt(x), z);
  const laneE = E.rim.z + 1.6; // carril derecho hacia el este
  const mainX = E.shore.x + 23 + 1.7; // carril derecho hacia el norte de la carretera de la orilla
  const accZ = fac.z + 17 + 10 + 1.6; // carril derecho del acceso de la fábrica (eje en z = fachada + 10)
  const parkX = E.rim.x - 0.45 - tHalf;
  const route = new THREE.CatmullRomCurve3([
    P(parkX, E.rim.z),
    P(E.rim.x + 1.5, E.rim.z + 0.6),
    P(E.rim.x + 7, laneE),
    P(E.shore.x - 7, laneE),
    P(mainX - 10, laneE),
    P(mainX - 4, laneE - 2.6),
    P(mainX, laneE - 8.5),
    P(mainX, accZ + 5),
    P(mainX + 3, accZ + 0.4),
    P(fac.x - 27, accZ),
    // se detiene en la explanada, delante del bloque de oficinas (antes de la farola de los muelles)
    P(fac.x - 15, accZ + 0.4),
  ], false, 'centripetal');
  // fracción del recorrido al terminar el tramo de la trazabilidad: el camión ya va por la calzada, cerca de la orilla
  let shoreU = 0.4;
  {
    const q = new THREE.Vector3();
    for (let k = 0; k <= 400; k++) {
      route.getPointAt(k / 400, q);
      if (q.x >= E.shore.x - 12) {
        shoreU = k / 400;
        break;
      }
    }
  }
  const tPos = new THREE.Vector3();
  const tTan = new THREE.Vector3();
  const smooth = (x) => x * x * (3 - 2 * x);
  const departure = (story) => {
    // movimiento reducido: estado final de cada capítulo (aparcado hasta la trazabilidad; en el cierre, en la fábrica)
    if (story && story.reduced) return story.index >= CH.cierre ? 1 : 0;
    if (!story || story.index < CH.trazabilidad) return 0;
    if (story.index === CH.trazabilidad) return shoreU * smooth(clamp(story.local, 0, 1));
    return shoreU + (1 - shoreU) * smooth(clamp(story.local, 0, 1));
  };
  let truckU = -1;
  const placeTruck = (u) => {
    if (u === truckU) return;
    truckU = u;
    route.getPointAt(u, tPos);
    route.getTangentAt(Math.min(u, 0.999), tTan);
    truckRig.position.copy(tPos);
    truckRig.rotation.y = Math.atan2(tTan.x, tTan.z);
  };
  placeTruck(0);

  // farolas
  const lampPost = (x, z, ry) => {
    const g = new THREE.Group();
    g.add(K.box(0.32, 0.05, 0.32, M.darkSteel, 0, 0, 0));
    const pole = K.cyl(0.055, 0.075, 4.5, M.graphite, 10);
    pole.position.y = 2.27;
    g.add(pole);
    g.add(K.box(0.72, 0.06, 0.08, M.graphite, 0.34, 4.42, 0));
    g.add(K.rbox(0.44, 0.1, 0.24, M.graphite, 0.66, 4.36, 0, 0.03));
    g.add(K.box(0.38, 0.02, 0.18, M.warmGlow, 0.66, 4.35, 0));
    g.position.set(x, Y, z);
    g.rotation.y = ry;
    ctx.add(g);
  };
  lampPost(s5.x + 0.55, s5.z - 9.4, -Math.PI / 2);
  lampPost(s5.x + 8.1, s5.z - 9.45, -Math.PI / 2);
  lampPost(s5.x - 8.0, s5.z + 8.9, Math.PI * 0.25);

  // única luz de la planta (sin luces nuevas: cada una recompila todos los sombreadores al cargar).
  // En el centro de la banda sur: alcanza el horno y los calderos, los contenedores y la boca de la separación.
  const plantLight = new THREE.PointLight('#ffc27a', 34, 26, 1.6);
  plantLight.position.set(s5.x + 0.5, s5.y + 6.4, s5.z + 4.0);
  ctx.add(plantLight);

  // ---------- movimiento: banda, rodillos, baterías, virutas, lingoteras, pilotos y pantalla ----------
  const riderPhase = (beltLen - 3.5) / RIDERS;
  const span = beltLen - 3.5;
  const wrap = (v, m) => ((v % m) + m) % m;
  const step = (t, story) => {
    const tt = story.reduced ? 0 : t;
    const run = tt * beltV;
    for (let i = 0; i < RIDERS; i++) {
      const u = (tt * 0.06 + i / RIDERS) % 1;
      o3.position.set(-beltLen / 2 + 0.8 + u * span, 1.12, 0);
      o3.rotation.set(0, 0, 0);
      o3.scale.setScalar(0.62);
      o3.updateMatrix();
      for (let p = 0; p < riderParts.length; p++) riderParts[p].setMatrixAt(i, o3.matrix);
    }
    // solo se suben las matrices de la cinta: las de los palés no cambian
    for (let p = 0; p < riderParts.length; p++) {
      const a = riderParts[p].instanceMatrix;
      a.clearUpdateRanges();
      a.addUpdateRange(0, RIDERS * 16);
      a.needsUpdate = true;
    }
    o3.scale.setScalar(1);
    for (let k = 0; k < CLEATS; k++) {
      o3.position.set(-beltLen / 2 + 0.8 + wrap(run + k * (riderPhase / 4) - 0.56, span), 1.134, 0);
      o3.updateMatrix();
      cleats.setMatrixAt(k, o3.matrix);
    }
    cleats.instanceMatrix.needsUpdate = true;
    const ang = -run / 0.09;
    for (let k = 0; k < rollerAt.length; k++) {
      o3.position.set(rollerAt[k][0], rollerAt[k][1], 0);
      o3.rotation.set(0, 0, ang + k * 0.4);
      o3.updateMatrix();
      rollers.setMatrixAt(k, o3.matrix);
    }
    rollers.instanceMatrix.needsUpdate = true;
    for (let j = 0; j < CHIPS; j++) {
      const ph = wrap(tt + (j * chipCycle) / CHIPS, chipCycle);
      const x = ((j * 0.377) % 0.48) - 0.24;
      if (ph < runT) {
        lp.set(x, 0.045 + (j % 3) * 0.015, ph * chipV).applyMatrix4(chute.matrix);
        o3.position.copy(lp);
      } else {
        const f = ph - runT;
        lp.set(x, 0.045, chLen).applyMatrix4(chute.matrix);
        o3.position.set(lp.x + chipDir.x * chipV * f, lp.y + chipDir.y * chipV * f - 4.9 * f * f, lp.z + chipDir.z * chipV * f);
      }
      o3.rotation.set(j * 1.7, j * 2.3 + (ph > runT ? ph * 6 : 0), j * 0.9);
      // en el estado fijo (movimiento reducido) no quedan virutas suspendidas en el aire
      o3.scale.setScalar(story.reduced && ph > runT ? 0 : 1.0 + (j % 5) * 0.12);
      o3.updateMatrix();
      shardMesh.setMatrixAt(chipBase + j, o3.matrix);
    }
    const sa = shardMesh.instanceMatrix;
    sa.clearUpdateRanges();
    sa.addUpdateRange(chipBase * 16, CHIPS * 16);
    sa.needsUpdate = true;
    o3.rotation.set(0, 0, 0);
    o3.scale.setScalar(1);
    placeCasting(tt);
    // solo late la baliza de marcha (puerta y columna de la línea); el resto de pilotos queda fijo
    beacon.emissiveIntensity = story.reduced ? 1.1 : 0.5 + 0.9 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.4), 3);
  };
  step(0, { index: CH.reciclaje, reduced: false, local: 0 });
  // ?debug: window.__ecobatStory sustituye campos del estado narrativo en esta estación (pruebas de la zona
  // mientras el recorrido de la v2 no tiene aún sus capítulos)
  const dbgStory = typeof location !== 'undefined' && /[?&]debug/.test(location.search);
  let first = true;
  let stillDrawn = false;
  let drawnK = -1;
  let lastDraw = -Infinity;
  let lastT = -1;
  let reducedStepped = false;
  ctx.anim((t, dt, storyIn) => {
    const story = dbgStory && typeof window !== 'undefined' && window.__ecobatStory ? { ...storyIn, ...window.__ecobatStory } : storyIn;
    // camión: sigue al recorrido en todos los capítulos (una matriz, solo si cambia)
    placeTruck(departure(story));
    // la planta solo entra en cuadro en el reciclaje y en los tramos que llegan a él o salen de él
    const near = story.index === CH.reciclaje || (story.index === CH.segundaVida && story.local > 1) || (story.index === CH.trazabilidad && story.local < 0);
    if (!near && !first) return;
    first = false;
    // con movimiento reducido la planta queda en su estado fijo: un solo paso
    if (!story.reduced || !reducedStepped) step(t, story);
    reducedStepped = story.reduced;
    // con movimiento reducido la pantalla se dibuja una vez en su estado final
    if (story.reduced) {
      if (!stillDrawn) live.update(t, story, true);
      stillDrawn = true;
    } else {
      stillDrawn = false;
      // como mucho 12 redibujos por segundo; si el reloj está congelado, sigue al scroll
      const k = regK(story);
      const moved = Math.abs(k - drawnK) > 0.015;
      const due = t - lastDraw >= 1 / 12 && (moved || (story.index === CH.reciclaje && k < 0.97));
      if (due || (moved && t === lastT)) {
        live.update(t, story, true);
        lastDraw = t;
        drawnK = k;
      }
      lastT = t;
    }
  });
}
