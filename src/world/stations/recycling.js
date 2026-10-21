import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 5 · Gestor autorizado de reciclaje. Referencia: context/ref-reciclaje.png.
// Recepción con palés en espera y caseta de control, cinta con rodillos grandes a la vista que entra
// en la trituradora por una boca a contraluz, torre de plataformas con barandillas ámbar, conductos de
// acero con codos y bridas hacia el filtro de mangas, transportador inclinado abierto hasta la nave de
// separación, tolva que vierte plástico triturado, contenedores galvanizados con los materiales
// recuperados, silo de plástico y valla de barrotes que deja ver el borde iluminado de la isla.

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

// Pepita de cobre: caja con las esquinas desplazadas (la misma esquina se mueve igual en cada cara).
// Tamaño real de recorte de conexiones: unos 11 cm, para que el montón no parezca de cajas.
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

// Rótulos impresos en un solo atlas de 2 × 4 celdas (512 × 256): una textura para todas las placas.
function labelAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const font = (w, s) => `${w} ${s}px "Archivo Variable", sans-serif`;
  const ink = '#1f2224';
  const draw = () => {
    const mats = [
      ['Pb', 'Plomo', 'Lingote recuperado'],
      ['Cu', 'Cobre y latón', 'Terminales (fracción menor)'],
      ['PP', 'Plástico', 'Carcasa triturada'],
      ['Fe', 'Acero', 'Chatarra separada'],
    ];
    mats.forEach(([sym, name, sub], i) => {
      const x = (i % 2) * 512;
      const y = Math.floor(i / 2) * 256;
      g.fillStyle = '#e4dac6';
      g.fillRect(x, y, 512, 256);
      g.fillStyle = ink;
      g.fillRect(x + 22, y + 28, 172, 200);
      g.textAlign = 'center';
      g.fillStyle = '#F1EEE6';
      g.font = font(800, 104);
      g.fillText(sym, x + 108, y + 166);
      g.textAlign = 'left';
      g.fillStyle = ink;
      g.font = font(800, 64);
      g.fillText(name, x + 220, y + 120);
      g.font = font(500, 30);
      g.fillStyle = 'rgba(31,34,36,0.72)';
      g.fillText(sub, x + 222, y + 170);
      g.fillStyle = '#93b52a';
      g.fillRect(x + 222, y + 196, 250, 8);
    });
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
    // 6 · gestor autorizado
    g.fillStyle = '#e4dac6';
    g.fillRect(0, 768, 512, 256);
    g.fillStyle = ink;
    g.font = font(800, 46);
    g.fillText('Gestor autorizado', 34, 860);
    g.font = font(500, 28);
    g.fillStyle = 'rgba(31,34,36,0.72)';
    g.fillText('Entrega registrada en EcoBat', 36, 908);
    g.fillStyle = '#93b52a';
    g.fillRect(36, 934, 300, 8);
    // 7 · franjas de seguridad ámbar y grafito
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

function labelGeometry(cell, w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  const col = cell % 2;
  const row = Math.floor(cell / 2);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 2, 1 - (row + 1 - uv.getY(i)) / 4);
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
  const label = (cell, w, h) => new THREE.Mesh(K.geo(`lbl${cell}|${w}|${h}`, () => labelGeometry(cell, w, h)), labels);

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
  walls.add(K.box(0.35, 0.3, 15.4, M.concrete, s5.x + 15.6, Y, s5.z + 1.3));
  walls.add(K.box(0.42, 0.05, 15.5, M.concreteLight, s5.x + 15.6, Y + 0.3, s5.z + 1.3));
  const fenceE = new THREE.Mesh(K.geo('fence15', () => fenceGeo(15.4)), M.graphite);
  fenceE.position.set(s5.x + 15.6, Y, s5.z + 1.3);
  fenceE.rotation.y = Math.PI / 2;
  walls.add(fenceE);
  for (let z = s5.z - 6; z < s5.z + 9; z += 6) kerbLight(s5.x + 15.6 - 0.19, z, -Math.PI / 2);
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
  // cajas abiertas de transporte (nervadas, con canto ámbar y asas troqueladas) junto a la caseta
  const crate = (x, y, z) => {
    const w = 0.6;
    const h = 0.38;
    const d = 0.42;
    const t = 0.025;
    yard.add(K.box(w, 0.03, d, M.graphiteLight, x, y, z));
    [-1, 1].forEach((s) => {
      yard.add(K.box(w, h, t, M.graphiteLight, x, y, z + s * (d / 2 - t / 2)));
      yard.add(K.box(t, h, d - 2 * t, M.graphiteLight, x + s * (w / 2 - t / 2), y, z));
      yard.add(K.box(w + 0.02, 0.025, 0.04, M.amberMatte, x, y + h - 0.02, z + s * (d / 2 - 0.01)));
      yard.add(K.box(0.04, 0.025, d, M.amberMatte, x + s * (w / 2 - 0.01), y + h - 0.025, z));
      [-0.18, 0, 0.18].forEach((rx) => yard.add(K.box(0.03, h - 0.08, 0.012, M.graphiteLight, x + rx, y + 0.03, z + s * (d / 2 + 0.006))));
      yard.add(K.box(0.012, 0.05, 0.16, M.panel, x + s * (w / 2 + 0.006), y + h - 0.11, z));
    });
  };
  [[0, 0], [0, 1], [0.66, 0]].forEach(([ox, k]) => crate(s5.x - 3.0 + ox, Y + k * 0.39, s5.z - 6.3));
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

  // pantalla viva: recuperación por material. Las barras se llenan durante la llegada y el registro
  // queda «documentado» justo en el encuadre de exposición (local ≈ 0,45), donde el visitante se detiene
  const regK = (story) => {
    if (!story || story.reduced || story.index > 5) return 1;
    if (story.index < 5) return 0;
    return clamp((story.local + 1.0) / 1.45, 0, 1);
  };
  const recRows = [['Plomo', 1], ['Plástico', 1], ['Electrolito', 1], ['Otros', 1]];
  const live = T.liveScreen(512, 288, (g, w, h, t, story) => {
    const k = regK(story);
    g.fillStyle = '#0f1112';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#C2F230';
    g.fillRect(0, 0, w, 6);
    g.textAlign = 'left';
    g.fillStyle = '#F1EEE6';
    g.font = '700 30px "Archivo Variable", sans-serif';
    g.fillText('Entrega ECB-0427', 26, 50);
    g.font = '500 19px "Archivo Variable", sans-serif';
    g.fillStyle = 'rgba(241,238,230,0.6)';
    g.fillText('Gestor autorizado · fracciones separadas', 26, 80);
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
  // tercera pantalla, en un poste junto a la barandilla de la pasarela: queda en el encuadre de exposición
  const regPost = new THREE.Group();
  regPost.add(K.box(0.36, 0.04, 0.3, M.darkSteel, 0, 0, 0));
  regPost.add(K.box(0.1, 1.5, 0.1, M.graphite, 0, 0.04, -0.02));
  regPost.add(K.rbox(1.38, 0.84, 0.1, M.darkSteel, 0, 1.48, -0.045, 0.03));
  regPost.add(K.box(1.2, 0.012, 0.012, M.limeLine, 0, 1.5, 0.012));
  const scrWalk = new THREE.Mesh(scr.geometry, scr.material);
  scrWalk.position.set(0, 1.9, 0.012);
  regPost.add(scrWalk);
  regPost.position.set(s5.x + 8.5, Y, s5.z + 3.45);
  regPost.rotation.y = -1.77;
  ctx.add(regPost);
  ctx.shadows.push({ x: s5.x + 8.5, y: Y, z: s5.z + 3.45, w: 0.7, d: 0.6 });
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

  // ---------- transportador inclinado abierto: virutas de la trituradora hasta la nave de separación ----------
  // artesa de bandejas de acero sobre rodillos (las virutas se ven subir), faldones en la zona de carga,
  // celosía ligera apoyada en los dos pórticos y cordón de parada ámbar en el lado este.
  // Perfil bajo: la cámara de salida pasa unos 2 m por encima del tramo central.
  const galA = V(s5.x + 11.8, Y + 1.0, s5.z - 1.9);
  const galB = V(s5.x + 13.9, Y + 3.3, s5.z + 3.4);
  const galLen = galA.distanceTo(galB);
  const gal = new THREE.Group();
  gal.position.copy(galA);
  gal.lookAt(galB);
  gal.updateMatrix();
  const TW = Math.PI / 6;
  [-1, 1].forEach((s) => {
    // larguero en C (cordón superior) y cordón inferior de la celosía
    gal.add(K.box(0.05, 0.2, galLen, M.darkSteel, s * 0.57, -0.34, galLen / 2));
    gal.add(K.box(0.1, 0.022, galLen, M.darkSteel, s * 0.545, -0.34, galLen / 2));
    gal.add(K.box(0.1, 0.022, galLen, M.darkSteel, s * 0.545, -0.162, galLen / 2));
    gal.add(K.box(0.05, 0.05, galLen - 0.2, M.darkSteel, s * 0.57, -0.7, galLen / 2));
    // alas inclinadas de la artesa (bandejas de acero, como en ref-reciclaje: las virutas negras contrastan)
    const wing = K.box(0.3, 0.012, galLen, M.darkSteel, s * 0.3345, 0.0332, galLen / 2);
    wing.rotation.z = s * TW;
    gal.add(wing);
    // montantes y diagonales de la celosía
    for (let z = 0.2, j = 0; z < galLen - 0.2; z += 1.1, j++) {
      gal.add(bar(V(s * 0.57, -0.34, z), V(s * 0.57, -0.66, z), 0.018, M.darkSteel, 6));
      const z2 = Math.min(z + 1.1, galLen - 0.2);
      if (z2 - z > 0.3) gal.add(j % 2 ? bar(V(s * 0.57, -0.34, z), V(s * 0.57, -0.66, z2), 0.016, M.darkSteel, 6) : bar(V(s * 0.57, -0.66, z), V(s * 0.57, -0.34, z2), 0.016, M.darkSteel, 6));
    }
    // faldones de acero donde cae el material de la trituradora
    gal.add(K.box(0.02, 0.24, 1.4, M.steel, s * 0.37, 0.05, 0.75));
    gal.add(K.box(0.07, 0.02, 1.4, M.steel, s * 0.385, 0.29, 0.75));
    [0.25, 0.75, 1.25].forEach((z) => gal.add(bar(V(s * 0.38, 0.2, z), V(s * 0.57, -0.14, z), 0.014, M.darkSteel, 6)));
  });
  gal.add(K.box(0.42, 0.012, galLen, M.darkSteel, 0, -0.035, galLen / 2));
  // estaciones de rodillos en artesa: central y dos alas a 30°
  for (let z = 0.3; z < galLen - 0.15; z += 0.55) {
    gal.add(K.box(1.1, 0.03, 0.05, M.darkSteel, 0, -0.14, z));
    gal.add(bar(V(-0.21, -0.08, z), V(0.21, -0.08, z), 0.045, M.graphite, 8));
    [-1, 1].forEach((s) => {
      gal.add(bar(V(s * 0.23, -0.08, z), V(s * 0.49, 0.07, z), 0.045, M.graphite, 8));
      gal.add(K.box(0.03, 0.05, 0.04, M.darkSteel, s * 0.22, -0.13, z));
      gal.add(K.box(0.03, 0.2, 0.04, M.darkSteel, s * 0.51, -0.13, z));
    });
  }
  // ramal de retorno con sus rodillos y tambores de cola y cabeza
  gal.add(K.box(0.9, 0.01, galLen - 0.35, M.darkSteel, 0, -0.465, galLen / 2));
  for (let z = 0.9; z < galLen - 0.5; z += 1.8) gal.add(bar(V(-0.5, -0.5, z), V(0.5, -0.5, z), 0.035, M.graphite, 8));
  [0.12, galLen - 0.05].forEach((z) => gal.add(bar(V(-0.52, -0.245, z), V(0.52, -0.245, z), 0.21, M.darkSteel, 16)));
  // cordón de parada de emergencia en el lado este
  for (let z = 0.4; z < galLen - 0.3; z += 1.1) gal.add(K.box(0.03, 0.4, 0.03, M.darkSteel, 0.6, -0.14, z));
  gal.add(K.box(0.014, 0.014, galLen - 0.6, M.amberMatte, 0.6, 0.22, galLen / 2 + 0.05));
  ctx.add(gal);
  // pórticos de apoyo: el travesaño recibe el cordón inferior de la celosía
  const galDir = new THREE.Vector3().subVectors(galB, galA);
  const perp = new THREE.Vector3(-galDir.z, 0, galDir.x).normalize().multiplyScalar(0.66);
  [0.28, 0.64].forEach((s) => {
    const c = new THREE.Vector3(0, -0.75, s * galLen).applyMatrix4(gal.matrix);
    const top = c.y;
    [-1, 1].forEach((k) => {
      ctx.add(K.box(0.1, top - Y + 0.05, 0.1, M.darkSteel, c.x + perp.x * k, Y, c.z + perp.z * k));
      ctx.add(K.box(0.24, 0.02, 0.24, M.darkSteel, c.x + perp.x * k, Y, c.z + perp.z * k));
    });
    ctx.add(bar(V(c.x - perp.x, top, c.z - perp.z), V(c.x + perp.x, top, c.z + perp.z), 0.05, M.darkSteel, 6));
    ctx.add(bar(V(c.x - perp.x, Y + 0.25, c.z - perp.z), V(c.x + perp.x, top - 0.1, c.z + perp.z), 0.025, M.darkSteel, 6));
  });

  // ---------- nave de separación (esquina sureste): boca iluminada y tolva hacia el contenedor ----------
  const sep = new THREE.Group();
  const bx0 = s5.x + 12.85;
  const bx1 = s5.x + 15.42;
  const bz0 = s5.z + 3.3;
  const bz1 = s5.z + 8.9;
  const bw = bx1 - bx0;
  const bd = bz1 - bz0;
  const bh = 3.9;
  const bcx = (bx0 + bx1) / 2;
  const bcz = (bz0 + bz1) / 2;
  const oz0 = s5.z + 4.55;
  const oz1 = s5.z + 6.65;
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
  const sepSign = label(6, 1.0, 0.5);
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
  // entrada del transportador en la fachada norte (marco y boca oscura)
  sep.add(K.box(1.4, 1.2, 0.24, M.darkSteel, galB.x, galB.y - 0.85, bz0 - 0.1));
  sep.add(K.box(1.1, 0.6, 0.02, M.panel, galB.x, galB.y - 0.4, bz0 - 0.225));
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
  // virutas que suben por el transportador inclinado: salen de la descarga y entran en la nave
  const GCHIPS = 80;
  const galV = 0.4;
  const galRun = galLen + 0.45;
  const galCycle = galRun / galV;

  // depósitos de electrolito (GRG) sobre cubeto, junto al muro este
  const tanks = new THREE.Group();
  tanks.add(K.box(1.3, 0.12, 2.65, M.graphite, s5.x + 14.6, Y, s5.z - 3.45));
  tanks.add(K.box(1.32, 0.03, 0.04, M.amberMatte, s5.x + 14.6, Y + 0.12, s5.z - 4.76));
  [s5.z - 4.05, s5.z - 2.85].forEach((z) => {
    const x = s5.x + 14.6;
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
  ctx.add(tanks);
  ctx.shadows.push({ x: s5.x + 14.6, y: Y, z: s5.z - 3.45, w: 1.8, d: 3.1 });

  // ---------- contenedores troncocónicos con los materiales recuperados (posiciones fijas) ----------
  const binOut = K.geo('binOut', () => frustumShell(3.4, 2.6, 0.88, 1.6));
  const binIn = K.geo('binIn', () => frustumShell(3.26, 2.46, 0.88, 1.58, true));
  const tz = Math.atan(0.156 / 1.6);
  const tx = Math.atan(0.204 / 1.6);
  const piles = { ingot: [], chunk: [], shard: [], rod: [] };
  const fills = ['rod', 'chunk', 'ingot', 'ingot', 'shard'];
  const cells = { ingot: 0, chunk: 1, shard: 2, rod: 3 };
  // por tipo: piezas, semiejes del montón (la pieza no atraviesa la pared interior) y altura de la cima
  const heapSpec = {
    ingot: [300, 1.4, 1.0, 0.55],
    chunk: [760, 1.5, 1.1, 0.55],
    shard: [760, 1.5, 1.1, 0.5],
    rod: [300, 1.3, 0.9, 0.42],
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
  fills.forEach((kind, i) => {
    const cell = cells[kind];
    const bx = s5.x - 6 + i * 4.2;
    const bz = s5.z + 5.6;
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
    bin.position.set(bx, Y, bz);
    ctx.add(bin);
    ctx.shadows.push({ x: bx, y: Y, z: bz, w: 4.3, d: 3.5 });
    const [n, rx, rz, peak] = heapSpec[kind];
    heap(piles[kind], bx, bz, rx, rz, Y + 1.6, peak, n, i + 1);
  });

  // ---------- muelles de acopio al norte: plástico triturado y paquetes de lingotes ----------
  const bays = new THREE.Group();
  bays.add(K.box(6.4, 2.0, 0.3, M.concrete, s5.x + 4.4, Y, s5.z - 9.25));
  bays.add(K.box(6.5, 0.07, 0.42, M.concreteLight, s5.x + 4.4, Y + 2.0, s5.z - 9.25));
  for (let x = s5.x + 1.6; x < s5.x + 7.5; x += 1.6) bays.add(K.box(0.035, 1.94, 0.012, M.panel, x, Y + 0.03, s5.z - 9.094));
  [s5.x + 1.35, s5.x + 4.45, s5.x + 7.45].forEach((x) => {
    bays.add(K.box(0.3, 1.5, 2.6, M.concrete, x, Y, s5.z - 7.8));
    bays.add(K.box(0.4, 0.06, 2.62, M.concreteLight, x, Y + 1.5, s5.z - 7.8));
  });
  const mound = new THREE.Mesh(K.geo('mound', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.72, 1.12)), M.shard);
  mound.position.set(s5.x + 2.9, Y, s5.z - 8.0);
  bays.add(mound);
  for (let k = 0; k < 320; k++) {
    const r = Math.sqrt((k * 0.6180339) % 1) * 0.97;
    const a = k * 2.39996;
    piles.shard.push([s5.x + 2.9 + Math.cos(a) * r * 1.3, Y + 0.72 * Math.sqrt(1 - r * r) + 0.01, s5.z - 8.0 + Math.sin(a) * r * 1.12, k + 500]);
  }
  const bundles = [];
  [[5.0, -8.6], [5.85, -8.6], [6.7, -8.6], [5.0, -7.45], [5.85, -7.45], [6.7, -7.45]].forEach(([ox, oz], b) => {
    const layers = 4 + (b % 3);
    bays.add(K.box(0.72, 0.1, 0.62, M.wood, s5.x + ox, Y, s5.z + oz));
    for (let L = 0; L < layers; L++) {
      for (let j = 0; j < 2; j++) {
        const rot = L % 2 === 0 ? 0 : Math.PI / 2;
        const off = (j - 0.5) * 0.25;
        bundles.push([s5.x + ox + (rot ? off : 0), Y + 0.1 + L * 0.175, s5.z + oz + (rot ? 0 : off), rot]);
      }
    }
  });
  ctx.add(bays);

  // instancias de los montones: una malla por tipo de pieza para todo el gestor
  const pileGeo = {
    ingot: () => ingotGeometry(),
    chunk: () => nuggetGeometry(),
    shard: () => new THREE.OctahedronGeometry(0.06, 0).scale(1.3, 0.38, 1),
    rod: () => new THREE.CylinderGeometry(0.032, 0.032, 0.52, 6).rotateZ(Math.PI / 2),
  };
  const pileMat = { ingot: leadMat, chunk: M.copper, shard: M.shard, rod: M.steel };
  Object.keys(piles).forEach((kind) => {
    const list = piles[kind];
    const extra = kind === 'ingot' ? bundles.length : kind === 'shard' ? CHIPS + GCHIPS : 0;
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
    if (kind === 'ingot') {
      bundles.forEach(([x, y, z, r], j) => {
        o3.position.set(x, y + 0.085, z);
        o3.rotation.set(0, r, 0);
        o3.scale.set(1.55, 1.55, 1.55);
        o3.updateMatrix();
        im.setMatrixAt(list.length + j, o3.matrix);
      });
    }
    im.castShadow = true;
    im.receiveShadow = true;
    ctx.add(im);
  });

  // ---------- pasarela entre cinta y contenedores: barandilla ámbar y líneas de luz ----------
  const walk = new THREE.Group();
  railing(walk, s5.x - 7.6, s5.z + 3.85, s5.x + 12.6, s5.z + 3.85, Y, { step: 1.34 });
  walk.add(K.box(19.6, 0.012, 0.05, M.lime, s5.x + 2.6, Y, s5.z + 3.62));
  ctx.add(walk);
  belt.add(K.box(11.4, 0.012, 0.05, M.lime, -0.6, 0, 1.32));
  [[-4.4, 1.62], [0.9, 1.62], [4.2, 1.62]].forEach(([x, z]) => {
    lp.set(x, 0, z).applyMatrix4(belt.matrix);
    ctx.lamps.push({ x: lp.x, y: Y, z: lp.z });
  });

  // ---------- farolas ----------
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

  // ---------- silo de plástico triturado en la esquina libre entre el transportador y la valla ----------
  // Pieza vertical del fondo en el encuadre de exposición; queda a más de 1,5 m de la salida de cámara.
  const silo = new THREE.Group();
  const SR = 0.55;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    silo.add(K.box(0.09, 2.05, 0.09, M.darkSteel, sx * 0.4, 0, sz * 0.4));
    silo.add(K.box(0.22, 0.02, 0.22, M.darkSteel, sx * 0.4, 0, sz * 0.4));
  });
  [-1, 1].forEach((s) => {
    silo.add(bar(V(-0.4, 0.25, s * 0.4), V(0.4, 1.7, s * 0.4), 0.018, M.darkSteel, 6));
    silo.add(bar(V(s * 0.4, 0.25, -0.4), V(s * 0.4, 1.7, 0.4), 0.018, M.darkSteel, 6));
  });
  const sCone = K.cyl(SR, 0.13, 0.75, M.steel, 20);
  sCone.position.y = 2.425;
  silo.add(sCone);
  const sBody = K.cyl(SR, SR, 3.1, M.steel, 24);
  sBody.position.y = 4.35;
  silo.add(sBody);
  [2.85, 3.85, 4.85, 5.85].forEach((y) => {
    const ring = K.cyl(SR + 0.015, SR + 0.015, 0.05, M.darkSteel, 24);
    ring.position.y = y;
    silo.add(ring);
  });
  const sRoof = K.cyl(0.12, SR + 0.03, 0.3, M.darkSteel, 24);
  sRoof.position.y = 6.05;
  silo.add(sRoof);
  // salida con válvula de guillotina (maneta ámbar)
  silo.add(K.box(0.2, 0.16, 0.2, M.darkSteel, 0, 1.86, 0));
  silo.add(K.box(0.42, 0.03, 0.06, M.amberMatte, 0.12, 1.92, 0));
  // plataforma de coronación con barandilla ámbar y foco
  silo.add(K.box(1.24, 0.05, 1.24, M.darkSteel, 0, 5.9, 0));
  railing(silo, -0.62, 0.62, 0.62, 0.62, 5.95, { step: 1.24 });
  railing(silo, -0.62, -0.62, -0.62, 0.62, 5.95, { step: 1.24 });
  railing(silo, 0.62, -0.62, 0.62, 0.62, 5.95, { step: 1.24 });
  railing(silo, -0.62, -0.62, -0.28, -0.62, 5.95, { step: 0.4 });
  railing(silo, 0.28, -0.62, 0.62, -0.62, 5.95, { step: 0.4 });
  silo.add(K.box(0.05, 0.75, 0.05, M.graphite, -0.6, 5.95, 0.6));
  silo.add(K.rbox(0.36, 0.1, 0.22, M.graphite, -0.72, 6.66, 0.72, 0.03));
  silo.add(K.box(0.3, 0.02, 0.16, M.warmGlow, -0.72, 6.65, 0.72));
  // escalera con jaula en la cara norte
  const lz = -SR - 0.1;
  [-0.2, 0.2].forEach((x) => silo.add(K.box(0.04, 5.65, 0.04, M.amberMatte, x, 0.3, lz)));
  for (let y = 0.6; y < 5.9; y += 0.3) silo.add(K.box(0.4, 0.025, 0.025, M.amberMatte, 0, y, lz));
  for (let y = 2.3; y < 5.95; y += 0.65) {
    silo.add(K.box(0.66, 0.035, 0.035, M.amberMatte, 0, y, lz - 0.62));
    [-1, 1].forEach((s) => silo.add(K.box(0.035, 0.035, 0.62, M.amberMatte, s * 0.33, y, lz - 0.31)));
  }
  [[0, lz - 0.62], [-0.33, lz - 0.31], [0.33, lz - 0.31]].forEach(([x, z]) => silo.add(K.box(0.03, 3.65, 0.03, M.amberMatte, x, 2.3, z)));
  silo.position.set(s5.x + 14.8, Y, s5.z + 1.9);
  ctx.add(silo);
  ctx.shadows.push({ x: s5.x + 14.8, y: Y, z: s5.z + 1.9, w: 1.4, d: 1.4 });
  // tubería de alimentación desde la nave de separación
  ctx.add(K.pipe([V(s5.x + 14.8, Y + 5.5, s5.z + 2.42), V(s5.x + 14.8, Y + 5.5, s5.z + 2.95), V(s5.x + 14.8, Y + 4.8, s5.z + 3.55), V(s5.x + 14.8, Y + 4.15, s5.z + 3.75)], 0.08, M.steel, 28));

  // única luz de la planta (sin luces nuevas: cada una recompila todos los sombreadores al cargar).
  // Delante de la boca de la nave de separación: ilumina su interior, los montones y la pasarela.
  const plantLight = new THREE.PointLight('#ffc27a', 34, 26, 1.6);
  plantLight.position.set(s5.x + 7.8, s5.y + 6.4, s5.z + 4.6);
  ctx.add(plantLight);

  // ---------- movimiento: banda, rodillos, baterías, virutas, pilotos y pantalla ----------
  const riderPhase = (beltLen - 3.5) / RIDERS;
  const span = beltLen - 3.5;
  const wrap = (v, m) => ((v % m) + m) % m;
  let first = true;
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
    // virutas sobre la banda en artesa: suben a 0,4 m/s (con movimiento reducido quedan repartidas, quietas)
    for (let j = 0; j < GCHIPS; j++) {
      const ph = wrap(tt + (j * galCycle) / GCHIPS, galCycle);
      // repartidas por toda la artesa: las del ala este se ven desde la pasarela
      const x = ((j * 0.377) % 0.84) - 0.42;
      const ax = Math.abs(x);
      const yb = ax <= 0.21 ? -0.023 : -0.0257 + (ax - 0.21) * 0.577;
      lp.set(x, yb + 0.018 + (j % 3) * 0.008, ph * galV - 0.35).applyMatrix4(gal.matrix);
      o3.position.copy(lp);
      o3.rotation.set(j * 1.7, j * 2.3, j * 0.9);
      o3.scale.setScalar(1.0 + (j % 5) * 0.12);
      o3.updateMatrix();
      shardMesh.setMatrixAt(chipBase + CHIPS + j, o3.matrix);
    }
    const sa = shardMesh.instanceMatrix;
    sa.clearUpdateRanges();
    sa.addUpdateRange(chipBase * 16, (CHIPS + GCHIPS) * 16);
    sa.needsUpdate = true;
    o3.rotation.set(0, 0, 0);
    o3.scale.setScalar(1);
    // solo late la baliza de marcha (puerta y columna de la línea); el resto de pilotos queda fijo
    beacon.emissiveIntensity = story.reduced ? 1.1 : 0.5 + 0.9 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.4), 3);
  };
  step(0, { index: 5, reduced: false, local: 0 });
  let stillDrawn = false;
  let drawnK = -1;
  let lastDraw = -Infinity;
  let lastT = -1;
  let reducedStepped = false;
  ctx.anim((t, dt, story) => {
    // la cinta solo entra en cuadro en el capítulo 5 y en los tramos que llegan a él o salen de él
    const near = story.index === 5 || (story.index === 4 && story.local > 1) || (story.index === 6 && story.local < 0);
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
      const due = t - lastDraw >= 1 / 12 && (moved || (story.index === 5 && k < 0.97));
      if (due || (moved && t === lastT)) {
        live.update(t, story, true);
        lastDraw = t;
        drawnK = k;
      }
      lastT = t;
    }
  });
}
