import * as THREE from 'three';

// 3 · Laboratorio de diagnóstico: banco de pruebas con la batería, comprobador, pinzas, lupa y pantallas que
// avanzan mientras se mide. Alrededor, un laboratorio completo y ordenado por funciones: estanterías iluminadas
// con módulos, pared de cables de prueba, encimera de instrumentos, estación de ciclado, puesto de registro,
// zona de seguridad y ventanal hacia el resto del recorrido.
// Referencia: context/ref-laboratorio.png.
export function buildLab(ctx) {
  const { K, M, T, V, STATIONS } = ctx;
  const s3 = STATIONS.s3;
  const FY = s3.y + 0.06; // suelo interior
  const BZ = s3.z - 6.3; // cara interior del muro del fondo
  const LX = s3.x - 6.8; // cara interior del muro izquierdo
  const EX = s3.x - 7.175; // cara exterior del muro izquierdo
  const bats = []; // baterías de apoyo: una sola tanda de instancias para todo el laboratorio
  const tmp = new THREE.Vector3();

  const at = (o, x, y, z, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    return o;
  };
  // coloca una batería instanciada en un punto local de un grupo ya situado (sin escala)
  const batAt = (g, x, y, z, r = 0, s = 0.4) => {
    tmp.set(x, y, z).applyEuler(g.rotation).add(g.position);
    bats.push({ x: tmp.x, y: tmp.y, z: tmp.z, r: g.rotation.y + r, s });
  };
  const knob = (r, h, mat, x, y, z, seg = 12) => {
    const k = K.cyl(r, r, h, mat, seg);
    k.rotation.x = Math.PI / 2;
    k.position.set(x, y, z);
    return k;
  };

  // ---------- Piezas reutilizables ----------
  // sonda de prueba: punta de acero, guarda y mango de color (origen en el extremo de la punta)
  const probe = (mat) => {
    const g = new THREE.Group();
    g.add(at(K.cyl(0.004, 0.004, 0.06, M.steel, 6), 0, 0.03, 0));
    g.add(at(K.cyl(0.024, 0.024, 0.012, mat, 10), 0, 0.066, 0));
    g.add(at(K.cyl(0.015, 0.018, 0.13, mat, 10), 0, 0.137, 0));
    g.add(at(K.cyl(0.009, 0.012, 0.03, M.rubber, 8), 0, 0.217, 0));
    return g;
  };
  // portasondas: bloque grafito con las sondas de pie
  const probeHolder = (mats) => {
    const g = new THREE.Group();
    const n = mats.length;
    g.add(K.rbox(0.07 * n + 0.06, 0.1, 0.12, M.graphite, 0, 0, 0, 0.02));
    mats.forEach((mat, i) => {
      const p = probe(mat);
      p.position.set(-0.035 * (n - 1) + i * 0.07, 0.04, (i % 2) * 0.03 - 0.015);
      p.rotation.z = (i - (n - 1) / 2) * 0.06;
      g.add(p);
    });
    return g;
  };
  // organizador de cajoncitos para piezas pequeñas
  const organiser = (cols, rows, w, h, d) => {
    const g = new THREE.Group();
    g.add(K.rbox(w, h, d, M.graphite, 0, 0, 0, 0.015));
    const cw = (w - 0.04) / cols;
    const ch = (h - 0.04) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = -w / 2 + 0.02 + cw * (c + 0.5);
        const y = 0.02 + ch * r;
        g.add(K.box(cw - 0.014, ch - 0.014, 0.012, M.panel, x, y + 0.007, d / 2 + 0.004));
        g.add(K.box(cw * 0.42, 0.012, 0.014, M.steel, x, y + ch * 0.42, d / 2 + 0.012));
      }
    }
    return g;
  };
  // fuente de alimentación de banco: dos lecturas, mandos y bornes
  const psu = () => {
    const g = new THREE.Group();
    g.add(K.rbox(0.42, 0.2, 0.32, M.graphite, 0, 0, 0, 0.02));
    g.add(K.box(0.12, 0.045, 0.006, M.amberGlow, -0.12, 0.12, 0.162));
    g.add(K.box(0.12, 0.045, 0.006, M.lime, 0.03, 0.12, 0.162));
    g.add(knob(0.022, 0.025, M.steel, -0.12, 0.06, 0.17));
    g.add(knob(0.022, 0.025, M.steel, 0.03, 0.06, 0.17));
    g.add(knob(0.014, 0.02, M.amberMatte, 0.14, 0.06, 0.17, 8));
    g.add(knob(0.014, 0.02, M.rubber, 0.18, 0.06, 0.17, 8));
    return g;
  };
  // multímetro de banco con lectura ámbar
  const benchMeter = () => {
    const g = new THREE.Group();
    g.add(K.rbox(0.36, 0.14, 0.3, M.graphite, 0, 0, 0, 0.02));
    g.add(K.box(0.17, 0.05, 0.006, M.amberGlow, -0.07, 0.07, 0.152));
    for (let i = 0; i < 4; i++) g.add(K.box(0.03, 0.02, 0.01, M.panel, 0.05 + i * 0.035, 0.09, 0.152));
    g.add(knob(0.012, 0.02, M.amberMatte, 0.08, 0.035, 0.155, 8));
    g.add(knob(0.012, 0.02, M.rubber, 0.13, 0.035, 0.155, 8));
    return g;
  };
  // multímetro de mano: funda ámbar de seguridad, frontal grafito y selector
  const multimeter = () => {
    const g = new THREE.Group();
    g.add(K.rbox(0.17, 0.32, 0.055, M.amberMatte, 0, 0, 0, 0.02));
    g.add(K.box(0.13, 0.27, 0.01, M.graphite, 0, 0.025, 0.026));
    g.add(K.box(0.1, 0.06, 0.006, M.darkGlass, 0, 0.21, 0.033));
    g.add(K.box(0.07, 0.024, 0.004, M.amberGlow, 0, 0.228, 0.037));
    g.add(knob(0.035, 0.016, M.steel, 0, 0.12, 0.036, 14));
    return g;
  };
  // pseudoaleatorio estable por semilla: cada madeja cuelga a su manera
  const rnd = (s) => {
    const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  // pinza de cocodrilo pequeña: funda de color y mordazas de acero (origen en la entrada del cable)
  const croc = (mat) => {
    const g = new THREE.Group();
    g.add(at(K.cyl(0.011, 0.015, 0.06, mat, 8), 0, -0.03, 0));
    [-0.005, 0.005].forEach((z) => g.add(at(K.box(0.018, 0.05, 0.007, M.steel, 0, 0, 0), 0, -0.085, z)));
    return g;
  };
  // cable de prueba enrollado y colgado de su gancho: seis o siete vueltas finas, una sonda y una pinza
  // colgando (origen en el gancho)
  const coil = (mat, tipMat, seed) => {
    const g = new THREE.Group();
    const torus = K.geo('labCoil2', () => new THREE.TorusGeometry(0.13, 0.008, 6, 28));
    const n = 6 + (seed % 2);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(torus, mat);
      m.scale.set(0.82 + rnd(seed * 13 + k) * 0.26, 1.38 + rnd(seed * 7 + k * 3) * 0.1, 1);
      m.rotation.z = (rnd(seed * 3 + k * 5) - 0.5) * 0.24;
      m.position.set((rnd(seed + k * 11) - 0.5) * 0.02, -0.19 - rnd(seed * 5 + k) * 0.02, 0.02 + k * 0.008);
      g.add(m);
    }
    g.add(K.box(0.025, 0.025, 0.12, M.darkSteel, 0, -0.012, 0.06));
    g.add(at(K.cyl(0.006, 0.006, 0.16, mat, 6), 0.05, -0.46, 0.045));
    g.add(at(probe(tipMat), 0.05, -0.772, 0.045));
    g.add(at(K.cyl(0.006, 0.006, 0.1 + (seed % 3) * 0.03, mat, 6), -0.055, -0.43 - (seed % 3) * 0.015, 0.06));
    g.add(at(croc(tipMat), -0.055, -0.48 - (seed % 3) * 0.03, 0.06));
    return g;
  };
  // cable de prueba fino (≈2 cm de diámetro a esta escala) con curva centrípeta: cuelga y se apoya sin quiebros
  const lead = (pts, mat, seg = 64) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, 0.0095, 6, false), mat);
  // varilla recta entre dos puntos
  const UP = V(0, 1, 0);
  const strut = (a, b, r, mat, seg = 8) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = K.cyl(r, r, +d.length().toFixed(3), mat, seg);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    m.position.addVectors(a, b).multiplyScalar(0.5);
    return m;
  };
  // taburete con base de cinco radios, aro reposapiés y asiento acolchado
  const fiveStar = (g, r) => {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.add(at(K.box(0.045, 0.035, r, M.darkSteel, 0, 0, 0), Math.sin(a) * r * 0.5, 0.06, Math.cos(a) * r * 0.5, a));
      g.add(at(K.cyl(0.028, 0.028, 0.03, M.rubber, 10), Math.sin(a) * r, 0.03, Math.cos(a) * r));
    }
  };

  // ---------- Edificio (se conserva) ----------
  const lab = K.makeCutaway(M, { w: 14, d: 11, h: 6, roofDepth: 0.5 });
  lab.position.set(s3.x, s3.y, s3.z - 1);
  // pared cálida en clave baja y foco general a la mitad, solo en este edificio: como en la referencia, las
  // pantallas, las tiras cálidas y los acentos lima vuelven a ser lo más luminoso del cuadro
  const labWall = M.ivory.clone();
  labWall.color.set('#a07d55');
  lab.traverse((o) => {
    if (o.isMesh && o.material === M.ivory) o.material = labWall;
    if (o.isSpotLight) o.intensity *= 0.45;
  });
  ctx.add(lab);
  // por fuera, los muros conservan el acabado común del mundo: piel fina en las caras exteriores
  ctx.add(K.box(0.01, 6, 11, M.ivory, s3.x - 7.18, s3.y, s3.z - 1));
  ctx.add(K.box(0.01, 2.52, 6.05, M.ivory, s3.x + 7.18, s3.y, s3.z - 1 - 2.475));
  // tablero de cables algo más claro que la pared, como la zona iluminada de la referencia
  const labBoard = M.ivory.clone();
  labBoard.color.set('#b49c78');

  // ---------- Pantallas vivas: el proceso de medida avanza con la lectura del capítulo ----------
  const AMBER = '#E5AE50';
  const LIME = '#C2F230';
  const IVORY = '#F1EEE6';
  const FONT_BIG = '800 44px "Archivo Variable", sans-serif';
  const FONT_T = '700 26px "Archivo Variable", sans-serif';
  const FONT_R = '500 20px "Archivo Variable", sans-serif';
  const FONT_V = '700 21px "Archivo Variable", sans-serif';
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  // valores mostrados (suavizados) y los últimos que se dibujaron: solo se redibuja lo que cambia
  const st = { link: 0, wave: 0, dial: 0, bars: 0, rows: 0 };
  const drawn = { link: -1, wave: -1, dial: -1, bars: -1, barsB: -1, rows: -1 };
  let reducedNow = false;
  const volts = Array.from({ length: 127 }, (_, i) => `${Math.floor(i / 10)},${i % 10} V`);
  const WN = 128;
  const waveA = new Float32Array(WN + 1);
  const waveB = new Float32Array(WN + 1);
  for (let i = 0; i <= WN; i++) {
    const u = i / WN;
    waveA[i] = Math.sin(u * 15.7) * Math.exp(-u * 0.6) * 0.8 + Math.sin(u * 52) * 0.07;
    waveB[i] = Math.sin(u * 15.7 + 0.8) * Math.exp(-u * 0.35) * 0.45;
  }
  const barsA = [0.3, 0.46, 0.38, 0.58, 0.5, 0.68, 0.6, 0.76, 0.7, 0.84, 0.78, 0.9];
  // registro de ejemplo coherente con los valores de referencia (pestaña Datos): tras 24 h de reposo, 12,6 V
  // corresponde a una batería inundada cargada (≈75 % en una AGM, carga suficiente para la prueba de carga); la
  // prueba de carga no se supera si la tensión cae por debajo de unos 9,6 V
  const recRows = [
    ['Química', 'Plomo-ácido'],
    ['Reposo previo', '24 h'],
    ['Tensión en reposo', '12,6 V'],
    ['Prueba de carga (15 s)', '< 9,6 V', true],
    ['Estado de salud', 'Insuficiente', true],
  ];

  function plot(g, arr, n, x0, x1, mid, amp, color, lw) {
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / WN;
      const y = mid - arr[i] * amp;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // curva de descarga que se traza de izquierda a derecha y barras que crecen escalonadas
  function drawWave(g, w, h) {
    g.fillStyle = '#0c0e0f';
    g.fillRect(0, 0, w, h);
    const x0 = 28;
    const x1 = w - 28;
    g.strokeStyle = 'rgba(229,174,80,0.14)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const x = x0 + ((x1 - x0) * i) / 12;
      g.moveTo(x, 40);
      g.lineTo(x, h - 24);
    }
    for (let i = 0; i <= 8; i++) {
      const y = 40 + ((h - 64) * i) / 8;
      g.moveTo(x0, y);
      g.lineTo(x1, y);
    }
    g.stroke();
    g.fillStyle = LIME;
    g.fillRect(x0, 16, 60, 6);
    g.fillStyle = 'rgba(229,174,80,0.65)';
    g.fillRect(x1 - 96, 16, 96, 6);
    const n = Math.round(st.wave * WN);
    if (n > 0) {
      plot(g, waveB, n, x0, x1, 150, 86, 'rgba(229,174,80,0.4)', 2);
      plot(g, waveA, n, x0, x1, 150, 86, AMBER, 4);
      g.fillStyle = IVORY;
      g.beginPath();
      g.arc(x0 + ((x1 - x0) * n) / WN, 150 - waveA[n] * 86, 5, 0, Math.PI * 2);
      g.fill();
    }
    const nb = barsA.length;
    const bw = (x1 - x0) / nb;
    for (let i = 0; i < nb; i++) {
      const k = clamp01((st.bars * (nb + 4) - i) / 5);
      if (k <= 0) continue;
      const bh = barsA[i] * 104 * k;
      g.fillStyle = i === nb - 1 ? LIME : 'rgba(229,174,80,0.78)';
      g.fillRect(x0 + i * bw + 5, h - 26 - bh, bw - 10, bh);
    }
    drawn.wave = st.wave;
    drawn.bars = st.bars;
  }
  // esfera de tensión: la aguja sube hasta 12,6 V y se encienden los indicadores
  function drawDial(g, w, h) {
    g.fillStyle = '#0c0e0f';
    g.fillRect(0, 0, w, h);
    const cx = 292;
    const cy = 196;
    const R = 124;
    g.strokeStyle = 'rgba(194,242,48,0.26)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - R - 34, cy);
    g.lineTo(cx + R + 34, cy);
    g.moveTo(cx, cy - R - 34);
    g.lineTo(cx, cy + R + 34);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, R - 40, 0, Math.PI * 2);
    g.stroke();
    const a0 = Math.PI * 0.75;
    const span = Math.PI * 1.5;
    const v = st.dial * 12.6;
    const a = a0 + (span * v) / 15;
    g.lineWidth = 20;
    g.strokeStyle = 'rgba(194,242,48,0.15)';
    g.beginPath();
    g.arc(cx, cy, R, a0, a0 + span);
    g.stroke();
    if (v > 0.05) {
      g.strokeStyle = LIME;
      g.beginPath();
      g.arc(cx, cy, R, a0, a);
      g.stroke();
    }
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(241,238,230,0.5)';
    g.beginPath();
    for (let i = 0; i <= 15; i++) {
      const t = a0 + (span * i) / 15;
      const r2 = R + (i % 5 ? 23 : 31);
      g.moveTo(cx + Math.cos(t) * (R + 16), cy + Math.sin(t) * (R + 16));
      g.lineTo(cx + Math.cos(t) * r2, cy + Math.sin(t) * r2);
    }
    g.stroke();
    g.strokeStyle = IVORY;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22));
    g.stroke();
    g.fillStyle = IVORY;
    g.beginPath();
    g.arc(cx, cy, 8, 0, Math.PI * 2);
    g.fill();
    g.font = FONT_BIG;
    g.textAlign = 'center';
    g.fillText(volts[Math.round(v * 10)], cx, cy + 92);
    // lectura de la batería de ejemplo ECB-0427, no una medición: se rotula como la esfera del cruce
    g.font = FONT_R;
    g.fillStyle = 'rgba(241,238,230,0.62)';
    g.fillText('tensión en reposo · ejemplo', cx, cy + 130);
    g.textAlign = 'left';
    for (let i = 0; i < 3; i++) {
      const y = 236 + i * 40;
      g.strokeStyle = LIME;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(44, y, 11, 0, Math.PI * 2);
      g.stroke();
      if (st.dial >= (i + 1) / 3 - 0.02) {
        g.fillStyle = LIME;
        g.beginPath();
        g.arc(44, y, 5.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = LIME;
    g.fillRect(30, 24, 66, 7);
    g.fillStyle = 'rgba(194,242,48,0.5)';
    g.fillRect(w - 118, 24, 88, 4);
    for (let i = 0; i < 6; i++) {
      const bh = (14 + i * 9) * clamp01((st.bars * 9 - i) / 4);
      if (bh <= 0) continue;
      g.fillStyle = LIME;
      g.fillRect(w - 104 + i * 14, h - 26 - bh, 8, bh);
    }
    drawn.dial = st.dial;
    drawn.barsB = st.bars;
  }
  // pantalla pequeña del comprobador: barrido continuo de osciloscopio (tensión ámbar, corriente lima)
  function tracePath(g, w, h, pass, from, to) {
    const L = st.link;
    g.beginPath();
    for (let x = from; x <= to; x += 4) {
      const u = x / w;
      const y = pass ? h * 0.7 - L * Math.sin(u * 21 + 1.1) * 12 : h * 0.42 - L * (Math.sin(u * 12.6) * 34 * Math.exp(-u * 0.9) + Math.sin(u * 63) * 3);
      if (x === from) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  function drawTrace(g, w, h, t) {
    g.fillStyle = '#0b0d0e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(194,242,48,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 16; x < w; x += 36) {
      g.moveTo(x, 10);
      g.lineTo(x, h - 10);
    }
    for (let y = 12; y < h; y += 28) {
      g.moveTo(8, y);
      g.lineTo(w - 8, y);
    }
    g.stroke();
    const head = reducedNow ? w : Math.floor(((t * 0.4) % 1) * (w / 4)) * 4;
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass ? LIME : AMBER;
      g.lineWidth = pass ? 2 : 3;
      g.globalAlpha = 0.3;
      tracePath(g, w, h, pass, 0, w);
      g.globalAlpha = 1;
      if (head > 4) tracePath(g, w, h, pass, 0, head);
    }
    if (!reducedNow) {
      g.fillStyle = 'rgba(241,238,230,0.5)';
      g.fillRect(head, 8, 2, h - 16);
    }
    drawn.link = st.link;
  }
  // monitor de registro: los resultados se anotan uno a uno
  function drawRecords(g, w, h) {
    g.fillStyle = '#0f1112';
    g.fillRect(0, 0, w, h);
    g.fillStyle = LIME;
    g.fillRect(0, 0, w, 6);
    g.font = FONT_T;
    g.fillStyle = IVORY;
    g.fillText('Registro de ejemplo · ECB-0427', 24, 46);
    // st.rows se acerca a 1 sin alcanzarlo y la pantalla deja de redibujarse a 0,004: margen para cerrar la última fila
    const p = st.rows * recRows.length + 0.03;
    for (let i = 0; i < recRows.length; i++) {
      const y = 96 + i * 44;
      const k = clamp01(p - i);
      g.fillStyle = 'rgba(241,238,230,0.1)';
      g.fillRect(24, y + 13, w - 48, 2);
      g.font = FONT_R;
      g.fillStyle = k > 0 ? 'rgba(241,238,230,0.62)' : 'rgba(241,238,230,0.22)';
      g.fillText(recRows[i][0], 24, y);
      if (k >= 1) {
        g.font = FONT_V;
        g.fillStyle = IVORY;
        g.textAlign = 'right';
        g.fillText(recRows[i][1], w - 62, y);
        g.textAlign = 'left';
        g.lineWidth = 3;
        g.beginPath();
        if (recRows[i][2]) {
          // resultado no superado: aspa ámbar
          g.strokeStyle = AMBER;
          g.moveTo(w - 45, y - 14);
          g.lineTo(w - 31, y);
          g.moveTo(w - 31, y - 14);
          g.lineTo(w - 45, y);
        } else {
          g.strokeStyle = LIME;
          g.moveTo(w - 46, y - 8);
          g.lineTo(w - 39, y - 1);
          g.lineTo(w - 26, y - 15);
        }
        g.stroke();
      } else if (k > 0) {
        g.fillStyle = 'rgba(229,174,80,0.85)';
        g.fillRect(w - 172, y - 12, 110 * k, 6);
      }
    }
    drawn.rows = st.rows;
  }
  const wallA = T.liveScreen(640, 384, drawWave, 12);
  const wallB = T.liveScreen(512, 384, drawDial, 12);
  const trace = T.liveScreen(320, 192, drawTrace, 12);
  const rec = T.liveScreen(512, 320, drawRecords, 12);

  // ---------- Banco de pruebas (grupo y anclas conservados) ----------
  // encimera de 1,15 m de fondo: la batería queda a 10 cm del canto, con los cajones y la tira cálida debajo
  const tb = new THREE.Group();
  const TZ = -0.08; // eje del banco
  const TF = TZ + 0.575; // canto delantero de la encimera
  [-1.2, 1.2].forEach((x) => {
    const c = K.cabinet(M, { w: 2.3, h: 0.9, d: 1.05, drawers: 3, mat: M.graphite });
    c.position.set(x, 0, TZ);
    tb.add(c);
  });
  tb.add(K.rbox(4.8, 0.1, 1.15, M.stoneTop, 0, 0.98, TZ, 0.035));
  // tiras cálidas bajo el canto de la encimera y a ras de suelo, como en la referencia
  tb.add(K.box(4.62, 0.02, 0.03, M.warmGlow, 0, 0.945, TF - 0.03));
  tb.add(K.box(4.5, 0.02, 0.02, M.warmGlow, 0, 0.065, TZ + 0.54));
  const b3 = K.makeBattery(M, { scale: 0.62 });
  b3.position.set(-0.9, 1.08, 0.1);
  tb.add(b3);
  // comprobador a escala 0,6 (0,75 × 0,37 m: tres cuartos del largo de la batería y la mitad de su altura, como
  // en la referencia) a 20 cm de ella: pantalla viva con marco, rejilla, mando con anillo lima, teclado, bornas y
  // piloto de estado; carcasa lisa para que de cerca no se lea como estuco
  const tester = new THREE.Group();
  tester.add(K.rbox(1.25, 0.62, 0.75, M.graphiteLight, 0, 0, 0, 0.05));
  tester.add(K.rbox(0.66, 0.42, 0.016, M.darkGlass, -0.18, 0.13, 0.375, 0.008));
  const testerScreen = K.screen(trace.texture, 0.62, 0.36, 0.95);
  testerScreen.position.set(-0.18, 0.34, 0.386);
  tester.add(testerScreen);
  const traceMat = testerScreen.material;
  tester.add(knob(0.1, 0.06, M.steel, 0.4, 0.38, 0.39, 20));
  const knobRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 24), M.limeInsert);
  knobRing.position.set(0.4, 0.38, 0.39);
  tester.add(knobRing);
  for (let k = 0; k < 5; k++) tester.add(K.box(0.02, 0.32, 0.06, M.panel, -0.635, 0.15, -0.25 + k * 0.12));
  for (let k = 0; k < 5; k++) tester.add(K.box(0.075, 0.014, 0.01, M.panel, -0.555, 0.31 + k * 0.045, 0.378));
  for (let k = 0; k < 6; k++) tester.add(K.box(0.09, 0.06, 0.025, M.panel, 0.27 + (k % 3) * 0.13, 0.07 + Math.floor(k / 3) * 0.09, 0.385));
  tester.add(knob(0.028, 0.03, M.amberMatte, -0.555, 0.12, 0.39, 14));
  tester.add(knob(0.028, 0.03, M.rubber, -0.555, 0.22, 0.39, 14));
  [-0.45, 0.45].forEach((x) => [-0.28, 0.28].forEach((z) => tester.add(K.box(0.1, 0.02, 0.08, M.rubber, x, -0.012, z))));
  const led = ctx.dyn(K.box(0.07, 0.025, 0.012, M.amberGlow, 0.4, 0.53, 0.38));
  tester.add(led);
  tester.scale.setScalar(0.6);
  tester.position.set(0.2, 1.08, -0.1);
  tb.add(tester);
  // pinzas: argolla de acero en la base de cada borne (el borne de acero sigue a la vista), funda de color donde
  // sale el cable y cable fino hasta las bornas; el (+) sale hacia atrás, se apoya en el margen trasero de la tapa,
  // por detrás del asa y del otro borne, y cae por la esquina trasera derecha; el (−) va directo a su borna: el
  // frontal y la línea lima de la batería quedan limpios
  const PY = 1.54; // base de los bornes
  const LY = 1.525; // cable apoyado sobre la tapa
  const lug = K.geo('labLug', () => new THREE.TorusGeometry(0.04, 0.008, 6, 20).rotateX(Math.PI / 2));
  [-1.272, -0.528].forEach((x) => tb.add(at(new THREE.Mesh(lug, M.steel), x, PY, -0.03)));
  tb.add(at(K.box(0.026, 0.006, 0.05, M.steel, 0, 0, 0), -1.25, PY, -0.09));
  tb.add(at(K.box(0.05, 0.006, 0.03, M.steel, 0, 0, 0), -0.463, PY, -0.03));
  const sleeveP = K.cyl(0.016, 0.016, 0.06, M.amberMatte, 10);
  sleeveP.rotation.z = Math.PI / 2;
  sleeveP.position.set(-1.215, PY + 0.002, -0.11);
  tb.add(sleeveP);
  const sleeveN = K.cyl(0.016, 0.016, 0.06, M.rubber, 10);
  sleeveN.rotation.z = Math.PI / 2;
  sleeveN.position.set(-0.416, PY + 0.004, -0.03);
  tb.add(sleeveN);
  // bornas del comprobador escalado: (+) abajo, (−) arriba, con su clavija
  const JX = 0.2 - 0.555 * 0.6;
  const JYP = 1.08 + 0.12 * 0.6;
  const JYN = 1.08 + 0.22 * 0.6;
  [[JYP, M.amberMatte], [JYN, M.rubber]].forEach(([y, mat]) => {
    const p = K.cyl(0.011, 0.013, 0.06, mat, 10);
    p.rotation.x = Math.PI / 2;
    p.position.set(JX, y, 0.173);
    tb.add(p);
  });
  tb.add(lead([V(-1.19, PY + 0.002, -0.11), V(-1.1, LY + 0.004, -0.12), V(-0.85, LY, -0.12), V(-0.6, LY, -0.12), V(-0.43, LY - 0.001, -0.12), V(-0.375, 1.49, -0.12), V(-0.335, 1.36, -0.1), V(-0.3, 1.2, -0.05), V(-0.28, 1.092, 0.06), V(-0.25, 1.094, 0.2), V(-0.17, 1.14, 0.24), V(JX, JYP, 0.2)], M.amberMatte, 96));
  tb.add(lead([V(-0.39, PY + 0.004, -0.03), V(-0.35, 1.515, -0.033), V(-0.31, 1.43, 0.0), V(-0.27, 1.32, 0.08), V(-0.225, 1.245, 0.185), V(-0.17, JYN + 0.002, 0.235), V(JX, JYN, 0.2)], M.rubber, 72));
  // lupa con aro de luz sobre la batería: base pesada en el canto trasero, entre la batería y el comprobador;
  // brazo de varillas paralelas con muelle; cabezal plano inclinado hacia el recorrido de la cámara, colgado
  // sobre el borne (+) y siempre por debajo de las pantallas del fondo
  const lamp = new THREE.Group();
  const LB = V(-0.26, 1.08, TZ - 0.44); // base
  const J1 = V(-0.26, 1.26, TZ - 0.44); // hombro
  const J2 = V(-0.64, 2.0, TZ - 0.36); // codo
  const J3 = V(-1.48, 1.94, -0.2); // muñeca
  const HC = V(-1.74, 1.8, 0.04); // centro del cabezal (algo a la izquierda del borne: no tapa las pantallas del fondo)
  const HT = -0.66; // inclinación del cabezal: la cara iluminada mira abajo y hacia +z
  lamp.add(at(K.cyl(0.11, 0.13, 0.035, M.graphite, 24), LB.x, LB.y + 0.0175, LB.z));
  lamp.add(at(K.cyl(0.016, 0.02, 0.17, M.darkSteel, 10), LB.x, LB.y + 0.12, LB.z));
  const springGeo = K.geo('labSpring', () => {
    class Helix extends THREE.Curve {
      getPoint(t, out = new THREE.Vector3()) {
        const a = t * Math.PI * 36;
        return out.set(Math.cos(a) * 0.009, t * 0.36, Math.sin(a) * 0.009);
      }
    }
    return new THREE.TubeGeometry(new Helix(), 180, 0.0022, 4, false);
  });
  [[J1, J2], [J2, J3]].forEach(([a, b], i) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const w = new THREE.Vector3().crossVectors(d, UP).normalize();
    const n = new THREE.Vector3().crossVectors(w, d).normalize();
    [1, -1].forEach((s) => lamp.add(strut(a.clone().addScaledVector(w, s * 0.017), b.clone().addScaledVector(w, s * 0.017), 0.009, M.darkSteel)));
    // muelle de compensación por encima de las varillas
    const sp = new THREE.Mesh(springGeo, M.steel);
    sp.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    sp.position.copy(a).addScaledVector(d, 0.28).addScaledVector(n, 0.032);
    lamp.add(sp);
    // ejes de las articulaciones
    (i === 0 ? [a, b] : [b]).forEach((p) => {
      const j = K.cyl(0.026, 0.026, 0.07, M.graphite, 14);
      j.quaternion.setFromUnitVectors(UP, w);
      j.position.copy(p);
      lamp.add(j);
    });
  });
  // cabezal: carcasa abierta, tapa anular, aro LED, bisel y lente pulida que cierra ambas caras
  const head = new THREE.Group();
  head.add(new THREE.Mesh(K.geo('labLampShell', () => new THREE.CylinderGeometry(0.17, 0.17, 0.05, 32, 1, true)), M.graphite));
  head.add(at(new THREE.Mesh(K.geo('labLampCap', () => new THREE.RingGeometry(0.115, 0.17, 32).rotateX(-Math.PI / 2)), M.graphite), 0, 0.025, 0));
  head.add(at(new THREE.Mesh(K.geo('labLampBezel', () => new THREE.RingGeometry(0.155, 0.17, 32).rotateX(Math.PI / 2)), M.graphite), 0, -0.025, 0));
  const ledMat = M.warmGlow.clone();
  ledMat.emissiveIntensity = 4;
  head.add(at(new THREE.Mesh(K.geo('labLampLed', () => new THREE.RingGeometry(0.115, 0.155, 32).rotateX(Math.PI / 2)), ledMat), 0, -0.026, 0));
  const lensMat = new THREE.MeshPhysicalMaterial({ color: '#cfc9bc', roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  head.add(new THREE.Mesh(K.geo('labLampLens', () => new THREE.CylinderGeometry(0.115, 0.115, 0.05, 32)), lensMat));
  head.rotation.x = HT;
  head.position.copy(HC);
  lamp.add(head);
  // muñeca: vástago hasta el canto trasero del cabezal y eje de giro
  const backDir = V(0, 0, -1).applyAxisAngle(V(1, 0, 0), HT);
  lamp.add(strut(J3, HC.clone().addScaledVector(backDir, 0.2), 0.011, M.darkSteel));
  const pivot = K.cyl(0.02, 0.02, 0.07, M.graphite, 12);
  pivot.rotation.z = Math.PI / 2;
  pivot.position.copy(HC).addScaledVector(backDir, 0.185);
  lamp.add(pivot);
  tb.add(lamp);
  // la luz sale del cabezal: charco cálido sobre la tapa y el borne (+), sin quemar el acero
  const litDir = V(0, -1, 0).applyAxisAngle(V(1, 0, 0), HT);
  const lampSpot = new THREE.SpotLight('#ffd7a0', 4, 2.6, 0.8, 0.85, 1.6);
  lampSpot.position.copy(HC).addScaledVector(litDir, 0.04);
  lampSpot.target.position.set(-1.0, 1.54, 0.14);
  tb.add(lampSpot, lampSpot.target);
  // extremo izquierdo: alfombrilla, portasondas de colores, bandeja de tornillería y destornillador
  tb.add(K.box(0.9, 0.006, 0.5, M.rubber, -1.93, 1.08, 0.2));
  tb.add(at(probeHolder([M.limeInsert, M.amberMatte, M.rubber, M.limeInsert, M.rubber, M.amberMatte]), -2.06, 1.086, 0.12, 0.25));
  const driver = new THREE.Group();
  driver.add(at(K.cyl(0.018, 0.016, 0.1, M.limeInsert, 10), 0, 0.05, 0));
  driver.add(at(K.cyl(0.004, 0.004, 0.13, M.steel, 6), 0, 0.165, 0));
  driver.rotation.set(0, 0.5, Math.PI / 2);
  driver.position.set(-1.68, 1.104, 0.32);
  tb.add(driver);
  tb.add(K.box(0.36, 0.03, 0.24, M.steel, -1.9, 1.08, -0.32));
  tb.add(K.box(0.32, 0.004, 0.2, M.panel, -1.9, 1.11, -0.32));
  for (let i = 0; i < 7; i++) tb.add(at(K.cyl(0.009, 0.009, 0.018, M.lead, 6), -2.0 + (i % 4) * 0.06, 1.12, -0.37 + Math.floor(i / 4) * 0.09));
  // junto al comprobador: bandeja con herramientas y pinzas de repuesto, vaso de sondas y multímetro de mano
  tb.add(K.box(0.52, 0.05, 0.3, M.graphite, 1.2, 1.08, 0.18));
  [1.07, 1.32].forEach((x) => tb.add(K.box(0.012, 0.045, 0.28, M.panel, x, 1.13, 0.18)));
  [[1.0, M.limeInsert], [1.2, M.rubber]].forEach(([x, mat]) => {
    const d = new THREE.Group();
    d.add(at(K.cyl(0.016, 0.014, 0.09, mat, 8), 0, 0.045, 0));
    d.add(at(K.cyl(0.004, 0.004, 0.12, M.steel, 6), 0, 0.15, 0));
    d.rotation.x = Math.PI / 2;
    d.position.set(x, 1.15, 0.07);
    tb.add(d);
  });
  [-0.012, 0.012].forEach((dz) => {
    tb.add(at(K.box(0.03, 0.012, 0.14, M.steel, 0, 0, 0), 1.41, 1.137, 0.12 + dz * 3, dz * 8));
    tb.add(at(K.box(0.034, 0.02, 0.1, M.amberMatte, 0, 0, 0), 1.41 + dz * 2, 1.14, 0.24 + dz * 3, dz * 10));
  });
  tb.add(at(K.cyl(0.05, 0.045, 0.12, M.graphite, 14), 1.5, 1.14, -0.18));
  [M.limeInsert, M.amberMatte, M.rubber].forEach((mat, i) => {
    const p = probe(mat);
    p.position.set(1.48 + (i - 1) * 0.022, 1.13, -0.18 + (i % 2) * 0.015);
    p.rotation.z = (i - 1) * 0.18;
    tb.add(p);
  });
  const dmm = multimeter();
  dmm.rotation.set(-0.62, 0.15, 0);
  dmm.position.set(1.0, 1.09, -0.36);
  tb.add(dmm);
  // extremo derecho: organizador de cajoncitos, hoja de pruebas en su tablilla, termómetro de infrarrojos y
  // cepillo de bornes (todo bajo, para no tapar el comprobador)
  tb.add(at(organiser(3, 4, 0.5, 0.44, 0.3), 2.05, 1.08, -0.4));
  const board = at(new THREE.Group(), 1.95, 1.08, 0.16, 0.18);
  board.add(K.box(0.25, 0.008, 0.34, M.graphite, 0, 0, 0));
  board.add(K.box(0.22, 0.003, 0.28, M.ivoryPanel, 0, 0.008, 0.02));
  for (let i = 0; i < 6; i++) board.add(K.box(0.15 - (i % 3) * 0.03, 0.001, 0.008, M.panel, -0.02, 0.011, -0.07 + i * 0.038));
  board.add(K.box(0.09, 0.016, 0.03, M.steel, 0, 0.008, -0.15));
  tb.add(board);
  const ir = at(new THREE.Group(), 1.68, 1.08, 0.3, -0.5);
  ir.add(K.rbox(0.2, 0.05, 0.065, M.amberMatte, 0, 0, 0, 0.015));
  ir.add(K.rbox(0.05, 0.045, 0.13, M.graphite, -0.06, 0, 0.09, 0.012));
  const irLens = K.cyl(0.02, 0.02, 0.01, M.darkGlass, 12);
  irLens.rotation.z = Math.PI / 2;
  irLens.position.set(0.103, 0.025, 0);
  ir.add(irLens);
  tb.add(ir);
  const brush = at(new THREE.Group(), 2.24, 1.08, 0.1, 0.4);
  const brushHandle = K.cyl(0.016, 0.014, 0.14, M.wood, 10);
  brushHandle.rotation.z = Math.PI / 2;
  brushHandle.position.set(-0.02, 0.016, 0);
  brush.add(brushHandle);
  brush.add(K.box(0.05, 0.026, 0.04, M.steel, 0.08, 0, 0));
  brush.add(K.box(0.04, 0.018, 0.034, M.rubber, 0.08, 0.026, 0));
  tb.add(brush);
  tb.position.set(s3.x + 0.5, s3.y, s3.z + 0.6);
  ctx.add(tb);
  ctx.shadows.push({ x: s3.x + 0.5, y: FY, z: s3.z + 0.6 + TZ, w: 5.3, d: 1.6 });
  // alfombrilla antifatiga y taburete delante del banco
  ctx.add(K.box(3.4, 0.014, 0.8, M.rubber, s3.x + 0.5, FY, s3.z + 0.6 + TF + 0.35));
  const stool = new THREE.Group();
  fiveStar(stool, 0.3);
  stool.add(at(K.cyl(0.03, 0.03, 0.56, M.steel, 10), 0, 0.36, 0));
  const ring = new THREE.Mesh(K.geo('labStoolRing', () => new THREE.TorusGeometry(0.22, 0.012, 6, 28)), M.steel);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.42;
  stool.add(ring);
  stool.add(at(K.cyl(0.24, 0.24, 0.03, M.graphite, 20), 0, 0.655, 0));
  stool.add(at(K.cyl(0.3, 0.29, 0.09, M.rubber, 28), 0, 0.715, 0));
  at(stool, s3.x + 1.55, FY, s3.z + 1.75, 0.4);
  ctx.add(stool);
  ctx.shadows.push({ x: s3.x + 1.55, y: FY, z: s3.z + 1.75, w: 0.8, d: 0.8 });

  // ---------- Fondo A · estanterías iluminadas con módulos (rincón izquierdo) ----------
  const shelving = (len, rows, step) => {
    const g = new THREE.Group();
    const d = 0.56;
    const top = 0.12 + rows * step;
    [-len / 2, len / 2].forEach((x) => {
      [-d / 2 + 0.025, d / 2 - 0.025].forEach((z) => g.add(K.box(0.045, top + 0.04, 0.045, M.darkSteel, x, 0, z)));
      for (let i = 0; i < rows; i++) {
        const br = K.box(0.016, Math.hypot(step, d - 0.05), 0.016, M.darkSteel);
        br.position.set(x, 0.12 + (i + 0.5) * step, 0);
        br.rotation.x = (i % 2 ? 1 : -1) * Math.atan2(d - 0.05, step);
        g.add(br);
      }
    });
    for (let i = 0; i <= rows; i++) {
      const y = 0.12 + i * step;
      g.add(K.box(len + 0.04, 0.035, d, M.darkSteel, 0, y, 0));
      g.add(K.box(len + 0.04, 0.05, 0.014, M.graphiteLight, 0, y - 0.012, d / 2 + 0.007));
      if (i > 0) g.add(K.box(len - 0.1, 0.014, 0.022, M.warmGlow, 0, y - 0.03, d / 2 - 0.035));
    }
    return g;
  };
  // la fila alta guarda maletines de instrumentos; el resto, módulos en espera con su etiqueta
  const fillShelf = (g, len, rows, step, slots, skip) => {
    for (let r = 0; r < rows; r++) {
      for (let s = 0; s < slots; s++) {
        const x = -len / 2 + (len / slots) * (s + 0.5);
        const y = 0.12 + r * step;
        g.add(K.box(0.09, 0.03, 0.006, M.ivoryPanel, x, y - 0.002, 0.297));
        if (skip.includes(r * slots + s)) continue;
        if (r === rows - 1 && s % 2 === 0) {
          g.add(K.rbox(0.56, 0.3, 0.4, M.graphite, x, y + 0.035, 0.0, 0.03));
          [-0.16, 0.16].forEach((k) => g.add(K.box(0.06, 0.035, 0.012, M.amberMatte, x + k, y + 0.25, 0.205)));
          g.add(K.box(0.18, 0.025, 0.04, M.rubber, x, y + 0.335, 0.0));
        } else batAt(g, x, y + 0.035, 0.02, 0, 0.4);
      }
    }
  };
  const shelfA = at(shelving(2.4, 4, 0.78), s3.x - 5.55, FY, BZ + 0.3);
  ctx.add(shelfA);
  fillShelf(shelfA, 2.4, 4, 0.78, 3, [5, 9]);
  const shelfL = at(shelving(3.2, 4, 0.78), LX + 0.3, FY, s3.z - 4.1, Math.PI / 2);
  ctx.add(shelfL);
  fillShelf(shelfL, 3.2, 4, 0.78, 4, [2, 7, 12]);
  ctx.shadows.push({ x: s3.x - 5.55, y: FY, z: BZ + 0.3, w: 2.8, d: 0.9 });
  ctx.shadows.push({ x: LX + 0.3, y: FY, z: s3.z - 4.1, w: 0.9, d: 3.6 });
  // pilastras con una sola tira vertical, de la encimera a lo alto de las pantallas, que separan las zonas
  [s3.x - 4, s3.x + 5].forEach((x) => {
    ctx.add(K.box(0.26, 5.9, 0.08, M.graphiteLight, x, FY, BZ + 0.04));
    ctx.add(K.box(0.035, 2.4, 0.012, M.warmGlow, x, FY + 1.0, BZ + 0.086));
  });

  // ---------- Fondo B · pared de cables de prueba sobre la encimera de instrumentos ----------
  // tablero claro a la altura de la mano, raíl de ganchos a 2,2 m y madejas que acaban sobre la encimera
  const CBX = s3.x - 2.3; // centro de la pared de cables, sobre el módulo izquierdo de la encimera
  ctx.add(K.box(2.3, 1.36, 0.03, labBoard, CBX, FY + 1.1, BZ + 0.015));
  [FY + 1.08, FY + 2.44].forEach((y) => ctx.add(K.box(2.34, 0.035, 0.04, M.darkSteel, CBX, y, BZ + 0.02)));
  ctx.add(K.box(2.2, 0.05, 0.04, M.darkSteel, CBX, FY + 2.2, BZ + 0.05));
  [[M.rubber, M.limeInsert], [M.amberMatte, M.amberMatte], [M.rubber, M.rubber], [M.amberMatte, M.rubber], [M.rubber, M.limeInsert], [M.rubber, M.amberMatte], [M.amberMatte, M.limeInsert]].forEach(([mat, tip], i) => {
    ctx.add(at(coil(mat, tip, i), CBX - 0.9 + i * 0.3, FY + 2.22, BZ + 0.03));
  });
  // estante alto de maletines de instrumentos, con escuadras
  ctx.add(K.box(2.1, 0.035, 0.32, M.darkSteel, CBX, FY + 2.6, BZ + 0.19));
  [-0.85, 0.85].forEach((dx) => ctx.add(K.box(0.03, 0.22, 0.26, M.darkSteel, CBX + dx, FY + 2.38, BZ + 0.16)));
  [[-0.65, 0.5, 0.3], [-0.08, 0.44, 0.24], [0.5, 0.52, 0.26]].forEach(([dx, w, h]) => {
    ctx.add(K.rbox(w, h, 0.26, M.graphite, CBX + dx, FY + 2.635, BZ + 0.19, 0.03));
    [-0.12, 0.12].forEach((k) => ctx.add(K.box(0.05, 0.03, 0.01, M.amberMatte, CBX + dx + k * w * 1.6, FY + 2.635 + h * 0.62, BZ + 0.325)));
  });

  // ---------- Fondo C · encimera de instrumentos bajo las pantallas ----------
  const bc = at(new THREE.Group(), s3.x + 1.7, FY, BZ + 0.36);
  ctx.add(bc);
  // cuatro módulos: el de la izquierda queda bajo la pared de cables, como en la referencia
  [-4, -2, 0, 2].forEach((x, i) => bc.add(at(K.cabinet(M, { w: 1.96, h: 0.86, d: 0.64, drawers: i === 2 ? 3 : 4, mat: M.graphite }), x, 0, 0)));
  bc.add(K.rbox(8.0, 0.06, 0.72, M.stoneTop, -0.98, 0.96, 0.02, 0.02));
  bc.add(K.box(7.86, 0.02, 0.03, M.warmGlow, -0.98, 0.925, 0.37));
  bc.add(K.box(7.76, 0.02, 0.02, M.warmGlow, -0.98, 0.065, 0.335));
  // regleta de enchufes en la pared
  bc.add(K.box(7.76, 0.08, 0.05, M.graphiteLight, -0.98, 1.17, -0.315));
  for (let i = 0; i < 12; i++) bc.add(K.box(0.07, 0.05, 0.01, M.ivoryPanel, -4.55 + i * 0.65, 1.185, -0.285));
  const CY = 1.02;
  // bajo las madejas: comprobador de cables, pinzas de repuesto en su cubeta, un cable enrollado sobre la encimera
  // y otro portasondas (todo por debajo de las puntas que cuelgan)
  const leadTester = at(new THREE.Group(), -4.45, CY, -0.06, 0.1);
  leadTester.add(K.rbox(0.42, 0.13, 0.26, M.graphite, 0, 0, 0, 0.02));
  leadTester.add(K.box(0.14, 0.04, 0.006, M.amberGlow, -0.11, 0.07, 0.131));
  for (let i = 0; i < 4; i++) leadTester.add(knob(0.016, 0.02, i % 2 ? M.rubber : M.amberMatte, 0.03 + i * 0.045, 0.05, 0.135, 8));
  bc.add(leadTester);
  bc.add(K.box(0.34, 0.05, 0.22, M.steel, -3.85, CY, 0.04));
  for (let i = 0; i < 6; i++) bc.add(at(K.box(0.03, 0.02, 0.09, i % 2 ? M.rubber : M.amberMatte, 0, 0, 0), -3.97 + (i % 3) * 0.1, CY + 0.06, 0.0 + Math.floor(i / 3) * 0.09, (i - 2.5) * 0.12));
  const flatLead = new THREE.Mesh(K.geo('labCoilFlat2', () => new THREE.TorusGeometry(0.11, 0.012, 6, 24).rotateX(Math.PI / 2)), M.rubber);
  flatLead.position.set(-3.4, CY + 0.012, 0.08);
  bc.add(flatLead);
  bc.add(at(probeHolder([M.amberMatte, M.rubber, M.limeInsert, M.rubber, M.amberMatte]), -3.2, CY, -0.16, 0.08));
  bc.add(at(organiser(2, 4, 0.44, 0.46, 0.3), -2.55, CY, -0.12));
  bc.add(at(probeHolder([M.rubber, M.amberMatte, M.limeInsert, M.rubber]), -1.95, CY, 0.06, -0.15));
  bc.add(at(psu(), -1.3, CY, -0.05, 0.12));
  bc.add(at(benchMeter(), -0.6, CY, -0.04, -0.08));
  bc.add(at(organiser(3, 3, 0.62, 0.36, 0.28), 0.25, CY, -0.13));
  batAt(bc, 1.22, CY, 0.0, -0.1, 0.38);
  // cargador del módulo con su piloto y cables
  bc.add(K.rbox(0.26, 0.15, 0.22, M.graphite, 1.9, CY, -0.08, 0.02));
  bc.add(K.box(0.05, 0.02, 0.006, M.lime, 1.84, CY + 0.1, 0.033));
  bc.add(K.pipe([V(1.77, CY + 0.06, 0.0), V(1.6, CY + 0.12, 0.08), V(1.45, CY + 0.42, 0.0), V(1.45, CY + 0.38, -0.05)], 0.01, M.amberMatte, 14));
  bc.add(K.pipe([V(1.77, CY + 0.04, -0.06), V(1.55, CY + 0.08, -0.14), V(1.0, CY + 0.42, -0.08), V(1.0, CY + 0.38, -0.05)], 0.01, M.rubber, 14));
  // portaherramientas con destornilladores de pie
  bc.add(K.box(0.36, 0.13, 0.18, M.graphite, 2.55, CY, 0.0));
  [M.limeInsert, M.rubber, M.amberMatte, M.rubber, M.limeInsert].forEach((mat, i) => {
    bc.add(at(K.cyl(0.016, 0.014, 0.1, mat, 8), 2.42 + i * 0.065, CY + 0.18, (i % 2) * 0.04 - 0.02));
  });
  ctx.shadows.push({ x: s3.x + 1.7 - 0.98, y: FY, z: BZ + 0.36, w: 8.4, d: 1.1 });
  // dos pantallas enmarcadas: curva con barras y esfera de tensión, con la tira cálida debajo
  const scrA = K.framedScreen(M, wallA.texture, 2.2, 1.3, 0.9);
  scrA.position.set(s3.x + 0.58, FY + 2.49, BZ + 0.07);
  ctx.add(scrA);
  const scrB = K.framedScreen(M, wallB.texture, 1.76, 1.3, 0.9);
  scrB.position.set(s3.x + 2.75, FY + 2.49, BZ + 0.07);
  ctx.add(scrB);
  ctx.add(K.box(4.4, 0.025, 0.04, M.warmGlow, s3.x + 1.6, FY + 1.68, BZ + 0.05));

  // ---------- Fondo D · armario de herramientas y cubetas (rincón derecho) ----------
  const chest = K.cabinet(M, { w: 1.3, h: 1.4, d: 0.62, drawers: 7, mat: M.graphite, top: M.steel });
  ctx.add(at(chest, s3.x + 6.0, FY, BZ + 0.33));
  ctx.shadows.push({ x: s3.x + 6.0, y: FY, z: BZ + 0.33, w: 1.6, d: 0.9 });
  ctx.add(K.box(1.3, 0.9, 0.03, M.darkSteel, s3.x + 6.0, FY + 1.88, BZ + 0.015));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const x = s3.x + 5.52 + c * 0.24;
      const y = FY + 1.96 + r * 0.27;
      ctx.add(K.rbox(0.2, 0.12, 0.18, M.graphite, x, y, BZ + 0.12, 0.02));
      ctx.add(K.box(0.1, 0.03, 0.006, M.ivoryPanel, x, y + 0.04, BZ + 0.213));
    }
  }

  // ---------- Bandeja de cables a lo largo del fondo, con bajantes a cada puesto ----------
  ctx.add(K.box(12.9, 0.015, 0.3, M.darkSteel, s3.x - 0.1, FY + 3.5, BZ + 0.25));
  ctx.add(K.box(12.9, 0.09, 0.012, M.darkSteel, s3.x - 0.1, FY + 3.5, BZ + 0.4));
  [[0.03, M.rubber, 0.17], [0.024, M.amberMatte, 0.25], [0.028, M.rubber, 0.32]].forEach(([r, mat, dz]) => {
    const c = K.cyl(r, r, 12.7, mat, 8);
    c.rotation.z = Math.PI / 2;
    c.position.set(s3.x - 0.1, FY + 3.515 + r, BZ + dz);
    ctx.add(c);
  });
  for (let x = s3.x - 6.3; x <= s3.x + 6.4; x += 1.6) ctx.add(K.box(0.04, 0.14, 0.4, M.darkSteel, x, FY + 3.37, BZ + 0.2));
  [[s3.x - 5.0, FY + 3.33], [s3.x - 0.9, FY + 1.2], [s3.x + 4.4, FY + 1.2], [s3.x + 5.24, FY + 1.05]].forEach(([x, yb]) => {
    ctx.add(at(K.cyl(0.022, 0.022, FY + 3.5 - yb, M.steel, 8), x, (FY + 3.5 + yb) / 2, BZ + 0.05));
  });
  ctx.add(K.box(0.09, 0.13, 0.05, M.graphiteLight, s3.x + 5.24, FY + 0.95, BZ + 0.03));

  // ---------- Muro izquierdo · cajonera alta, archivo, lavaojos y equipo de derrames ----------
  ctx.add(at(K.cabinet(M, { w: 1.5, h: 1.75, d: 0.6, drawers: 7, mat: M.graphite, top: M.steel }), LX + 0.31, FY, s3.z - 1.4, Math.PI / 2));
  ctx.shadows.push({ x: LX + 0.31, y: FY, z: s3.z - 1.4, w: 0.9, d: 1.8 });
  ctx.add(K.box(0.3, 0.03, 1.5, M.darkSteel, LX + 0.15, FY + 2.33, s3.z - 1.4));
  const binderMats = [M.graphite, M.ivoryPanel, M.graphite, M.amberMatte, M.graphite, M.graphite, M.ivoryPanel, M.graphite, M.graphite, M.ivoryPanel, M.graphite, M.graphite];
  binderMats.forEach((mat, i) => ctx.add(K.box(0.24, 0.3 - (i % 3) * 0.02, 0.06, mat, LX + 0.14, FY + 2.36, s3.z - 2.0 + i * 0.075)));
  // lavaojos sobre mueble con pila: imprescindible donde se manipula electrolito
  const sink = at(new THREE.Group(), LX + 0.31, FY, s3.z + 0.2, Math.PI / 2);
  sink.add(K.rbox(1.3, 0.8, 0.6, M.graphite, 0, 0.1, 0, 0.03));
  sink.add(K.box(0.006, 0.66, 0.01, M.panel, 0, 0.16, 0.302));
  [-0.08, 0.08].forEach((x) => sink.add(K.box(0.02, 0.2, 0.03, M.steel, x, 0.62, 0.31)));
  sink.add(K.box(1.36, 0.05, 0.66, M.stoneTop, 0, 0.9, 0));
  sink.add(K.box(0.5, 0.012, 0.38, M.steel, -0.2, 0.946, 0.02));
  sink.add(K.pipe([V(-0.2, 0.95, -0.25), V(-0.2, 1.24, -0.25), V(-0.2, 1.31, -0.13), V(-0.2, 1.2, -0.03)], 0.016, M.steel, 16));
  sink.add(at(K.cyl(0.012, 0.012, 0.22, M.steel, 8), 0.35, 1.06, -0.12));
  [-0.06, 0.06].forEach((dx) => sink.add(at(K.cyl(0.05, 0.034, 0.06, M.amberMatte, 12), 0.35 + dx, 1.19, -0.12)));
  sink.add(K.box(0.3, 0.3, 0.012, M.amberMatte, 0.35, 1.45, -0.29));
  sink.add(K.box(0.2, 0.2, 0.006, M.ivoryPanel, 0.35, 1.5, -0.281));
  ctx.add(sink);
  ctx.shadows.push({ x: LX + 0.31, y: FY, z: s3.z + 0.2, w: 0.9, d: 1.6 });
  // extintor en su soporte y bidón del equipo de derrames (tapa ámbar)
  ctx.add(at(K.cyl(0.085, 0.085, 0.52, M.graphite, 16), LX + 0.12, FY + 0.9, s3.z + 1.35));
  ctx.add(at(K.cyl(0.088, 0.088, 0.07, M.amberMatte, 16), LX + 0.12, FY + 1.02, s3.z + 1.35));
  ctx.add(K.box(0.06, 0.09, 0.1, M.darkSteel, LX + 0.12, FY + 1.16, s3.z + 1.35));
  ctx.add(K.box(0.04, 0.05, 0.24, M.darkSteel, LX + 0.03, FY + 0.95, s3.z + 1.35));
  ctx.add(at(K.cyl(0.26, 0.24, 0.66, M.graphite, 20), LX + 0.38, FY + 0.33, s3.z + 1.95));
  ctx.add(at(K.cyl(0.275, 0.275, 0.05, M.amberMatte, 20), LX + 0.38, FY + 0.685, s3.z + 1.95));
  ctx.shadows.push({ x: LX + 0.38, y: FY, z: s3.z + 1.95, w: 0.7, d: 0.7 });

  // ---------- Carro de instrumentos junto al extremo izquierdo del banco (primer plano) ----------
  const cart = at(new THREE.Group(), s3.x - 2.85, FY, s3.z + 0.8, 0.35);
  [[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]].forEach(([x, z]) => {
    cart.add(K.box(0.035, 0.9, 0.035, M.darkSteel, x, 0.09, z));
    cart.add(knob(0.05, 0.035, M.rubber, x, 0.05, z));
  });
  cart.add(K.box(0.82, 0.03, 0.54, M.steel, 0, 0.3, 0));
  cart.add(K.box(0.82, 0.03, 0.54, M.steel, 0, 0.96, 0));
  cart.add(K.box(0.03, 0.03, 0.46, M.darkSteel, -0.5, 0.98, 0));
  [-0.18, 0.18].forEach((z) => cart.add(K.box(0.1, 0.025, 0.025, M.darkSteel, -0.45, 0.98, z)));
  // osciloscopio: repite la traza del comprobador
  const scope = new THREE.Group();
  scope.add(K.rbox(0.52, 0.3, 0.34, M.graphite, 0, 0, 0, 0.025));
  scope.add(K.box(0.3, 0.2, 0.01, M.darkGlass, -0.08, 0.06, 0.168));
  const scopeScreen = new THREE.Mesh(K.geo('labScope', () => new THREE.PlaneGeometry(0.27, 0.17)), traceMat);
  scopeScreen.position.set(-0.08, 0.16, 0.175);
  scope.add(scopeScreen);
  for (let i = 0; i < 6; i++) scope.add(knob(0.016, 0.02, M.steel, 0.13 + (i % 2) * 0.07, 0.08 + Math.floor(i / 2) * 0.065, 0.175, 10));
  [-0.17, -0.08, 0.01].forEach((x) => scope.add(knob(0.013, 0.025, M.steel, x, 0.03, 0.175, 8)));
  scope.add(K.box(0.44, 0.02, 0.03, M.rubber, 0, 0.3, -0.12));
  cart.add(at(scope, 0.04, 0.99, 0.0, 0.1));
  // abajo: rollos de cable y un módulo en espera
  const flat = K.geo('labCoilFlat', () => new THREE.TorusGeometry(0.13, 0.022, 6, 24).rotateX(Math.PI / 2));
  [[M.amberMatte, 0.345], [M.rubber, 0.39]].forEach(([mat, y], i) => {
    const c = new THREE.Mesh(flat, mat);
    c.position.set(-0.2 + i * 0.02, y, 0.04 - i * 0.03);
    cart.add(c);
  });
  ctx.add(cart);
  batAt(cart, 0.2, 0.33, 0, Math.PI / 2, 0.34);
  ctx.shadows.push({ x: s3.x - 2.85, y: FY, z: s3.z + 0.8, w: 1.1, d: 0.8, r: 0.35 });

  // ---------- Estación de ciclado: cuatro canales y tres módulos conectados ----------
  const cyc = at(new THREE.Group(), s3.x + 3.8, FY, s3.z - 3.6);
  cyc.add(K.rbox(2.8, 0.86, 0.72, M.graphite, 0, 0.1, 0, 0.03));
  cyc.add(K.rbox(2.88, 0.05, 0.8, M.stoneTop, 0, 0.96, 0, 0.02));
  for (let i = 0; i < 4; i++) {
    const x = -1.05 + i * 0.7;
    cyc.add(K.rbox(0.62, 0.62, 0.02, M.panel, x, 0.2, 0.365, 0.008));
    cyc.add(K.box(0.2, 0.05, 0.006, i === 3 ? M.amberGlow : M.lime, x - 0.12, 0.7, 0.378));
    for (let k = 0; k < 5; k++) cyc.add(K.box(0.4, 0.012, 0.006, M.graphiteLight, x, 0.27 + k * 0.06, 0.378));
    cyc.add(knob(0.018, 0.02, M.amberMatte, x + 0.12, 0.725, 0.38, 8));
    cyc.add(knob(0.018, 0.02, M.rubber, x + 0.2, 0.725, 0.38, 8));
  }
  cyc.add(K.box(2.6, 0.02, 0.02, M.warmGlow, 0, 0.065, 0.37));
  cyc.add(K.rbox(2.7, 0.12, 0.1, M.graphiteLight, 0, 1.01, -0.32, 0.02));
  [-0.9, 0, 0.9].forEach((x) => {
    batAt(cyc, x, 1.01, 0.04, 0, 0.42);
    [-0.252, 0.252].forEach((tx, k) => {
      const sx = x + tx;
      cyc.add(K.pipe([V(sx, 1.345, -0.05), V(sx + (k ? 0.05 : -0.05), 1.44, -0.17), V(sx + (k ? 0.08 : -0.08), 1.14, -0.3)], 0.012, k ? M.rubber : M.amberMatte, 12));
    });
  });
  ctx.add(cyc);
  ctx.shadows.push({ x: s3.x + 3.8, y: FY, z: s3.z - 3.6, w: 3.3, d: 1.2 });

  // ---------- Puesto de registro junto al ventanal ----------
  const desk = at(new THREE.Group(), s3.x + 6.4, FY, s3.z - 1.45, -Math.PI / 2);
  desk.add(K.rbox(1.7, 0.045, 0.76, M.ivoryPanel, 0, 0.73, 0, 0.012));
  [-0.82, 0.82].forEach((x) => desk.add(K.box(0.04, 0.73, 0.68, M.darkSteel, x, 0, 0)));
  desk.add(K.box(1.6, 0.25, 0.02, M.darkSteel, 0, 0.45, -0.34));
  desk.add(at(K.cabinet(M, { w: 0.42, h: 0.5, d: 0.6, drawers: 3, mat: M.graphite }), 0.55, 0, 0.02));
  const mon = K.framedScreen(M, rec.texture, 0.86, 0.52, 0.85);
  mon.position.set(-0.15, 1.13, -0.12);
  mon.rotation.y = 0.35;
  desk.add(mon);
  desk.add(K.box(0.05, 0.2, 0.04, M.darkSteel, -0.13, 0.775, -0.22));
  desk.add(K.box(0.24, 0.015, 0.18, M.darkSteel, -0.13, 0.775, -0.2));
  desk.add(K.box(0.44, 0.018, 0.14, M.graphite, -0.15, 0.775, 0.16));
  desk.add(K.box(0.06, 0.02, 0.1, M.graphite, 0.2, 0.775, 0.17));
  desk.add(K.box(0.3, 0.04, 0.24, M.darkSteel, 0.5, 0.775, -0.1));
  desk.add(K.box(0.26, 0.012, 0.2, M.ivoryPanel, 0.5, 0.815, -0.1));
  ctx.add(desk);
  ctx.shadows.push({ x: s3.x + 6.4, y: FY, z: s3.z - 1.45, w: 1.0, d: 2.0 });
  // sobre el puesto: corcho con procedimientos y fichas de seguridad, y estante de archivo
  const IX = s3.x + 6.82; // cara interior del murete
  ctx.add(K.box(0.03, 0.8, 1.4, M.darkSteel, IX - 0.015, FY + 1.55, s3.z - 1.45));
  ctx.add(K.box(0.02, 0.72, 1.32, M.wood, IX - 0.035, FY + 1.59, s3.z - 1.45));
  [[-0.45, 0.3, 0.06, M.ivoryPanel], [-0.12, 0.36, -0.05, M.ivoryPanel], [0.2, 0.3, 0.04, M.ivoryPanel], [0.47, 0.42, -0.03, M.amberMatte], [0.05, 0.1, 0.0, M.ivoryPanel]].forEach(([dz, y, rot, mat]) => {
    const sheet = K.box(0.006, mat === M.amberMatte ? 0.14 : 0.3, mat === M.amberMatte ? 0.2 : 0.21, mat, IX - 0.05, FY + 1.59 + y - 0.02, s3.z - 1.45 + dz);
    sheet.rotation.x = rot;
    ctx.add(sheet);
  });
  ctx.add(K.box(0.28, 0.03, 1.2, M.darkSteel, IX - 0.14, FY + 2.0, s3.z - 3.5));
  [M.ivoryPanel, M.graphite, M.ivoryPanel, M.ivoryPanel, M.graphite].forEach((mat, i) => {
    ctx.add(K.rbox(0.24, 0.26, 0.2, mat, IX - 0.14, FY + 2.03, s3.z - 3.98 + i * 0.235, 0.012));
  });
  // canto del murete junto a la salida: guardavivos y tira vertical cálida que marca el paso
  ctx.add(K.box(0.035, 2.3, 0.01, M.warmGlow, s3.x + 7, FY + 0.12, s3.z - 0.445));
  [-0.17, 0.17].forEach((dx) => ctx.add(K.box(0.03, 2.46, 0.03, M.darkSteel, s3.x + 7 + dx, FY, s3.z - 0.465)));
  const chair = at(new THREE.Group(), s3.x + 5.55, FY, s3.z - 1.55, Math.PI / 2 - 0.25);
  fiveStar(chair, 0.3);
  chair.add(at(K.cyl(0.03, 0.03, 0.4, M.steel, 10), 0, 0.28, 0));
  chair.add(K.rbox(0.48, 0.08, 0.46, M.graphite, 0, 0.46, 0, 0.03));
  chair.add(K.box(0.04, 0.4, 0.04, M.darkSteel, 0, 0.5, -0.24));
  chair.add(K.rbox(0.44, 0.42, 0.06, M.graphite, 0, 0.72, -0.26, 0.03));
  ctx.add(chair);

  // ---------- Ventanal sobre el murete derecho: vidrio fino entre montantes ----------
  const gx = s3.x + 7;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 3.44), M.glass);
  glass.position.set(gx, s3.y + 2.52 + 1.72, s3.z - 3.85);
  glass.rotation.y = -Math.PI / 2;
  ctx.add(glass);
  [-6.5, -5.175, -3.85, -2.525, -1.2].forEach((dz) => ctx.add(K.box(0.07, 3.44, 0.07, M.darkSteel, gx, s3.y + 2.52, s3.z + dz)));
  ctx.add(K.box(0.1, 0.08, 5.37, M.darkSteel, gx, s3.y + 5.92, s3.z - 3.85));
  ctx.add(K.box(0.14, 0.05, 5.37, M.darkSteel, gx, s3.y + 2.52, s3.z - 3.85));
  ctx.add(K.box(0.05, 0.05, 5.3, M.darkSteel, gx, s3.y + 4.3, s3.z - 3.85));

  // ---------- Carro de entrada con baterías pendientes (primer plano al salir) ----------
  const ic = at(new THREE.Group(), s3.x + 4.05, FY, s3.z + 0.75, -0.55);
  ic.add(K.box(1.0, 0.04, 0.62, M.steel, 0, 0.62, 0));
  ic.add(K.box(1.0, 0.04, 0.62, M.steel, 0, 0.16, 0));
  [-0.47, 0.47].forEach((x) => [-0.28, 0.28].forEach((z) => {
    ic.add(K.box(0.035, 0.6, 0.035, M.darkSteel, x, 0.06, z));
    ic.add(knob(0.06, 0.04, M.rubber, x, 0.06, z));
  }));
  [-0.26, 0.26].forEach((z) => ic.add(K.box(0.035, 0.5, 0.035, M.darkSteel, 0.5, 0.66, z)));
  ic.add(K.box(0.035, 0.035, 0.56, M.darkSteel, 0.5, 1.14, 0));
  ic.add(K.box(0.01, 0.3, 0.22, M.ivoryPanel, 0.53, 0.78, 0));
  ic.add(K.box(0.014, 0.03, 0.08, M.amberMatte, 0.535, 1.06, 0));
  ctx.add(ic);
  batAt(ic, -0.24, 0.66, 0, -Math.PI / 2, 0.34);
  batAt(ic, 0.16, 0.66, 0.01, -Math.PI / 2 + 0.08, 0.32);
  batAt(ic, -0.02, 0.2, 0, 0, 0.32);
  ctx.shadows.push({ x: s3.x + 4.05, y: FY, z: s3.z + 0.75, w: 1.2, d: 0.8, r: -0.55 });

  // ---------- Entrada de muestras junto al frente abierto (primer plano de la llegada) ----------
  // jaula con cuatro baterías etiquetadas pendientes de diagnóstico sobre una zona rotulada en ámbar; todo por
  // debajo de 1,3 m y a unos 2,5 m del recorrido de la cámara, fuera de los encuadres de lectura
  const cage = at(new THREE.Group(), s3.x - 5.65, FY, s3.z + 3.3, 0.35);
  cage.add(K.box(1.2, 0.05, 0.66, M.darkSteel, 0, 0.1, 0));
  [[-0.54, -0.27], [0.54, -0.27], [-0.54, 0.27], [0.54, 0.27]].forEach(([x, z]) => cage.add(knob(0.05, 0.035, M.rubber, x, 0.05, z)));
  [[-0.585, -0.315], [0.585, -0.315], [-0.585, 0.315], [0.585, 0.315]].forEach(([x, z]) => cage.add(K.box(0.03, 1.07, 0.03, M.darkSteel, x, 0.15, z)));
  cage.add(K.box(1.16, 0.03, 0.62, M.steel, 0, 0.62, 0));
  for (let i = 0; i < 12; i++) cage.add(K.box(0.012, 1.05, 0.012, M.darkSteel, -0.55 + i * 0.1, 0.15, -0.315));
  [-0.585, 0.585].forEach((x) => {
    for (let i = 1; i < 6; i++) cage.add(K.box(0.012, 1.05, 0.012, M.darkSteel, x, 0.15, -0.315 + i * 0.105));
  });
  [0.45, 0.85, 1.2].forEach((y) => {
    cage.add(K.box(1.2, 0.016, 0.016, M.darkSteel, 0, y, -0.315));
    [-0.585, 0.585].forEach((x) => cage.add(K.box(0.016, 0.016, 0.64, M.darkSteel, x, y, 0)));
  });
  // cintas de sujeción ámbar en el frente abierto y ficha de entrada en el lateral
  [0.42, 0.9].forEach((y) => cage.add(K.box(1.17, 0.035, 0.006, M.amberMatte, 0, y, 0.322)));
  cage.add(K.box(0.006, 0.24, 0.17, M.ivoryPanel, 0.594, 0.66, 0.12));
  cage.add(K.box(0.007, 0.04, 0.17, M.amberMatte, 0.596, 0.86, 0.12));
  [[-0.285, 0.15], [0.285, 0.15], [-0.285, 0.65], [0.285, 0.65]].forEach(([x, y], i) => {
    batAt(cage, x, y, 0.0, i % 2 ? 0.04 : -0.03, 0.33);
    cage.add(K.box(0.06, 0.045, 0.004, M.amberMatte, x + 0.14, y + 0.2, 0.172));
  });
  // zona rotulada: contorno ámbar y franja rayada delante del frente de la jaula
  const ZW = 1.7;
  const ZD = 1.25;
  [-ZD / 2, ZD / 2].forEach((z) => cage.add(K.box(ZW, 0.004, 0.05, M.amberMatte, 0, 0.001, z)));
  [-ZW / 2, ZW / 2].forEach((x) => cage.add(K.box(0.05, 0.004, ZD, M.amberMatte, x, 0.001, 0)));
  for (let i = 0; i < 10; i++) cage.add(at(K.box(0.05, 0.004, 0.32, M.amberMatte, 0, 0, 0), -0.7 + i * 0.155, 0.003, 0.475, Math.PI / 4));
  // rótulo sobre poste
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256;
  signCanvas.height = 160;
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = 4;
  const drawSign = () => {
    const g = signCanvas.getContext('2d');
    g.fillStyle = '#e6dfcf';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = AMBER;
    g.fillRect(0, 0, 256, 46);
    g.fillStyle = '#1d1f21';
    g.font = '800 27px "Archivo Variable", sans-serif';
    g.fillText('ENTRADA', 16, 33);
    g.font = '600 23px "Archivo Variable", sans-serif';
    g.fillText('Pendiente de', 16, 90);
    g.fillText('diagnóstico', 16, 122);
    g.fillRect(16, 138, 64, 5);
    signTex.needsUpdate = true;
  };
  drawSign();
  document.fonts?.ready.then(drawSign);
  const sign = at(new THREE.Group(), -0.95, 0, 0.55);
  sign.add(at(K.cyl(0.12, 0.13, 0.02, M.darkSteel, 16), 0, 0.01, 0));
  sign.add(at(K.cyl(0.018, 0.018, 1.0, M.darkSteel, 8), 0, 0.5, -0.02));
  sign.add(K.box(0.42, 0.27, 0.014, M.graphite, 0, 0.98, 0));
  const signFace = new THREE.Mesh(K.geo('labSignFace', () => new THREE.PlaneGeometry(0.39, 0.24)), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 }));
  signFace.position.set(0, 1.115, 0.008);
  sign.add(signFace);
  cage.add(sign);
  ctx.add(cage);
  ctx.shadows.push({ x: s3.x - 5.65, y: FY, z: s3.z + 3.3, w: 1.4, d: 0.85, r: 0.35 });
  // pasillo peatonal señalizado a lo largo del frente, de la entrada de muestras a la salida este
  [s3.z + 2.45, s3.z + 4.2].forEach((z) => ctx.add(K.box(10.2, 0.004, 0.05, M.amberMatte, s3.x + 0.7, FY + 0.001, z)));
  // contenedor de cuarentena para baterías dañadas (las que no superan la inspección), a un lado del pasillo
  const qbin = at(new THREE.Group(), s3.x + 5.15, FY, s3.z + 1.95, -0.2);
  qbin.add(K.box(0.92, 0.06, 0.72, M.darkSteel, 0, 0, 0));
  qbin.add(K.rbox(0.86, 0.66, 0.66, M.steel, 0, 0.06, 0, 0.02));
  qbin.add(K.rbox(0.9, 0.06, 0.7, M.graphite, 0, 0.72, -0.004, 0.015));
  qbin.add(K.box(0.3, 0.03, 0.04, M.darkSteel, 0, 0.74, 0.34));
  for (let i = 0; i < 6; i++) qbin.add(at(K.box(0.06, 0.1, 0.006, i % 2 ? M.graphite : M.amberMatte, 0, 0, 0), -0.3 + i * 0.12, 0.6, 0.333));
  qbin.add(K.box(0.24, 0.16, 0.006, M.ivoryPanel, 0, 0.3, 0.333));
  qbin.add(K.box(0.24, 0.035, 0.007, M.amberMatte, 0, 0.425, 0.334));
  ctx.add(qbin);
  ctx.shadows.push({ x: s3.x + 5.15, y: FY, z: s3.z + 1.95, w: 1.1, d: 0.9, r: -0.2 });

  // ---------- Fachada exterior del muro izquierdo: juntas, zócalo, cuadro eléctrico y extracción ----------
  ctx.add(K.box(0.03, 0.35, 11, M.panel, EX - 0.015, s3.y, s3.z - 1));
  for (let z = s3.z - 5.5; z <= s3.z + 2.5; z += 2) ctx.add(K.box(0.02, 5.6, 0.04, M.graphiteLight, EX - 0.01, s3.y + 0.35, z));
  ctx.add(K.rbox(0.22, 0.9, 0.7, M.graphite, EX - 0.11, s3.y + 1.1, s3.z + 3.3, 0.03));
  ctx.add(K.box(0.01, 0.12, 0.12, M.amberMatte, EX - 0.225, s3.y + 1.75, s3.z + 3.3));
  [3.15, 3.45].forEach((dz) => {
    ctx.add(at(K.cyl(0.035, 0.035, 3.95, M.steel, 8), EX - 0.07, s3.y + 2.0 + 1.975, s3.z + dz));
    for (let y = 2.6; y < 6; y += 1.1) ctx.add(K.box(0.05, 0.03, 0.1, M.darkSteel, EX - 0.04, s3.y + y, s3.z + dz));
  });
  // conducto de extracción de la zona de carga, que sube por la fachada
  ctx.add(at(K.cyl(0.17, 0.17, 3.0, M.steel, 20), EX - 0.28, s3.y + 4.9, s3.z + 1.4));
  const elbow = K.cyl(0.17, 0.17, 0.3, M.steel, 20);
  elbow.rotation.z = Math.PI / 2;
  elbow.position.set(EX - 0.15, s3.y + 3.55, s3.z + 1.4);
  ctx.add(elbow);
  ctx.add(at(K.cyl(0.19, 0.19, 0.06, M.darkSteel, 20), EX - 0.28, s3.y + 3.55, s3.z + 1.4));
  ctx.add(at(K.cyl(0.3, 0.22, 0.08, M.darkSteel, 20), EX - 0.28, s3.y + 6.48, s3.z + 1.4));
  [4.4, 5.6].forEach((y) => ctx.add(K.box(0.3, 0.05, 0.06, M.darkSteel, EX - 0.15, s3.y + y, s3.z + 1.4)));

  // ---------- Baterías de apoyo instanciadas y luces cálidas sin sombra ----------
  ctx.add(K.batteryInstances(M, bats));
  const shelfLight = new THREE.PointLight('#ffc98c', 3.4, 5, 2);
  shelfLight.position.set(s3.x - 5.4, FY + 2.4, s3.z - 4.7);
  ctx.add(shelfLight);
  const counterLight = new THREE.PointLight('#ffd49a', 2.4, 3.6, 2);
  counterLight.position.set(s3.x + 1.7, FY + 1.45, BZ + 1.05);
  ctx.add(counterLight);

  // ---------- Proceso: pinzas, curva, aguja, barras y registro siguen la lectura ----------
  // como mucho una pantalla se redibuja (y se sube a la GPU) por fotograma, cada una a 12 fps como máximo
  const FRAME = 1 / 12;
  const queue = [
    { s: wallA, acc: 0, dirty: () => Math.abs(st.wave - drawn.wave) > 0.004 || Math.abs(st.bars - drawn.bars) > 0.004 },
    // el comprobador barre como un osciloscopio solo mientras se lee el capítulo 3
    { s: trace, acc: 0, dirty: () => (idxNow === 3 && !reducedNow) || Math.abs(st.link - drawn.link) > 0.004 },
    { s: wallB, acc: 0, dirty: () => Math.abs(st.dial - drawn.dial) > 0.003 || Math.abs(st.bars - drawn.barsB) > 0.004 },
    { s: rec, acc: 0, dirty: () => Math.abs(st.rows - drawn.rows) > 0.004 },
  ];
  let turn = 0;
  let idxNow = 0;
  ctx.anim((t, dt, story) => {
    if (!story || story.index < 2 || story.index > 4) return;
    reducedNow = story.reduced;
    idxNow = story.index;
    let tl = 0;
    let tw = 0;
    let td = 0;
    let tb2 = 0;
    let tr = 0;
    if (story.reduced || story.index === 4) {
      tl = tw = td = tb2 = tr = 1;
    } else if (story.index === 3) {
      // todo termina justo antes del ancla: si el usuario se detiene, la medida ya está asentada
      const l = story.local;
      tl = clamp01((l + 0.8) / 0.4);
      tw = clamp01((l + 0.6) / 0.85);
      td = clamp01((l + 0.25) / 0.5);
      tb2 = clamp01((l + 0.15) / 0.4);
      tr = clamp01((l + 0.35) / 0.6);
    }
    const k = story.reduced ? 1 : 1 - Math.exp(-dt * 4.5);
    st.link += (tl - st.link) * k;
    st.wave += (tw - st.wave) * k;
    st.dial += (td - st.dial) * k;
    st.bars += (tb2 - st.bars) * k;
    st.rows += (tr - st.rows) * k;
    if (story.reduced) {
      // movimiento reducido: la escena solo se renderiza unos fotogramas tras cada corte, y con la cadencia de
      // 12 fps y una pantalla por fotograma la esfera quedaba sin redibujar («0,0 V»). Se redibuja todo lo
      // pendiente en este mismo fotograma.
      for (let i = 0; i < queue.length; i++) if (queue[i].dirty()) queue[i].s.update(t, story, true);
    } else {
      for (let i = 0; i < queue.length; i++) queue[i].acc += dt;
      for (let i = 0; i < queue.length; i++) {
        const q = queue[(turn + i) % queue.length];
        if (q.acc >= FRAME && q.dirty()) {
          q.acc = 0;
          q.s.update(t, story, true);
          turn = (turn + i + 1) % queue.length;
          break;
        }
      }
    }
    led.material = st.dial > 0.985 ? M.lime : M.amberGlow;
  });
}
