import * as THREE from 'three';
import { CH } from '../chapters.js';
import { ACCESS } from '../layout.js';
import { makePerson, makeTruck, makeForklift, makePallet, makeEVCrate } from '../actors.js';

// 1 · Recogida (isla s1): el patio del gestor de baterías, ordenado alrededor de la batería protagonista.
// Oeste: franja de descarga libre para el camión de recogida, que llega por la calzada oeste con baterías de
// muchos talleres y desguaces (ACCESS.west); la carretilla saca un palé de baterías de arranque por la trasera y
// junto al camión queda la batería de coche eléctrico en su embalaje. Noroeste: caseta de recepción y mástil de
// iluminación. Suroeste: báscula (origen de la traza) y jaulas de rejilla. Centro: calles de palés. Norte:
// almacén cubierto con estantería. Este: contenedor cerrado y bahía de salida junto al puente hacia el laboratorio.
// Referencias: context/EcoBat-scroll-world-referencia.png (01), context/ref-bateria.png, context/ref-borde-isla-noche.png.
export function buildDepot(ctx) {
  const { K, M, T, STATIONS } = ctx;
  const s1 = STATIONS.s1;
  const y0 = s1.y;
  const PAL = T.PAL;
  // todas las baterías del patio en una sola tanda de instancias (siempre el modelo de ref-bateria.png)
  const bats = [];
  // escala de las baterías del patio: 0,50 × 0,29 × 0,36 m con asa (≈1,8 × real, legibles a 15-20 m);
  // la protagonista mantiene su escala de pieza expuesta
  const BS = 0.3;
  const LAYER = 0.282; // paso entre capas: batería con asa (0,364 m) + cartón separador

  // ---------- utilidades de colocación (coordenadas locales respecto al centro de la plataforma) ----------
  const place = (o, x, z, ry = 0, y = 0, name) => {
    o.position.set(s1.x + x, y0 + y, s1.z + z);
    o.rotation.y = ry;
    if (name) o.name = name;
    return ctx.add(o);
  };
  // marco de un objeto girado: (u, v) del objeto → (x, z) locales de la plataforma
  const rot = (x, z, ry) => (u, v) => [x + Math.cos(ry) * u + Math.sin(ry) * v, z - Math.sin(ry) * u + Math.cos(ry) * v];
  const bat = (x, y, z, r, s) => bats.push({ x: s1.x + x, y: y0 + y, z: s1.z + z, r, s });
  const shadow = (x, z, w, d, r = 0) => ctx.shadows.push({ x: s1.x + x, y: y0, z: s1.z + z, w, d, r });
  const cylAt = (rt, rb, h, mat, seg, x, y, z) => {
    const m = K.cyl(rt, rb, h, mat, seg);
    m.position.set(x, y + h / 2, z);
    return m;
  };

  // ---------- rótulos: un único atlas dibujado una vez (material estático, se fusiona) ----------
  const AW = 1024;
  const AH = 512;
  const CELLS = {
    recep: [0, 0, 1024, 96],
    A: [0, 96, 128, 128],
    B: [128, 96, 128, 128],
    C: [256, 96, 128, 128],
    D: [384, 96, 128, 128],
    r1: [512, 96, 128, 64],
    r2: [640, 96, 128, 64],
    r3: [768, 96, 128, 64],
    kg: [896, 96, 128, 64],
    un: [512, 160, 128, 64],
    load: [640, 160, 384, 64],
    diamond: [0, 224, 128, 128],
    fire: [128, 224, 128, 128],
    spill: [256, 224, 256, 128],
    lab: [512, 224, 512, 128],
    fA: [0, 352, 128, 128],
    fB: [128, 352, 128, 128],
    fC: [256, 352, 128, 128],
    fArrow: [384, 352, 128, 128],
    fBat: [512, 352, 128, 128],
    fD: [640, 352, 128, 128],
    notice: [768, 352, 256, 128],
  };
  const atlas = T.liveScreen(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    const plate = ([x, y, w, h], bg, border) => {
      g.fillStyle = bg;
      g.fillRect(x, y, w, h);
      if (border) {
        g.strokeStyle = border;
        g.lineWidth = 6;
        g.strokeRect(x + 6, y + 6, w - 12, h - 12);
      }
    };
    const text = (s, x, y, size, col, weight = 800) => {
      g.fillStyle = col;
      g.font = `${weight} ${size}px "Archivo Variable", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s, x, y);
    };
    const mid = (c) => [c[0] + c[2] / 2, c[1] + c[3] / 2];
    plate(CELLS.recep, '#1b1e20');
    g.fillStyle = PAL.lime;
    g.fillRect(40, 80, 160, 5);
    text('RECEPCIÓN DE BATERÍAS', 512, 46, 52, PAL.ivory);
    ['A', 'B', 'C', 'D'].forEach((k) => {
      const c = CELLS[k];
      plate(c, '#1b1e20', PAL.ivory);
      text(k, c[0] + 64, c[1] + 56, 70, PAL.ivory);
      g.strokeStyle = PAL.lime;
      g.lineWidth = 4;
      g.strokeRect(c[0] + 42, c[1] + 98, 44, 16);
      g.fillStyle = PAL.lime;
      g.fillRect(c[0] + 48, c[1] + 93, 8, 5);
      g.fillRect(c[0] + 72, c[1] + 93, 8, 5);
    });
    ['01', '02', '03'].forEach((s, i) => {
      const c = CELLS[`r${i + 1}`];
      plate(c, PAL.amber);
      text(s, ...mid(c), 42, '#161819');
    });
    plate(CELLS.kg, '#1b1e20', PAL.amber);
    text('kg', ...mid(CELLS.kg), 36, PAL.amber);
    // panel naranja ADR: 80 / 2794 (baterías de plomo-ácido con electrolito)
    const un = CELLS.un;
    plate(un, PAL.amber, '#161819');
    g.fillStyle = '#161819';
    g.fillRect(un[0] + 10, un[1] + 31, 108, 3);
    text('80', un[0] + 64, un[1] + 19, 22, '#161819');
    text('2794', un[0] + 64, un[1] + 47, 22, '#161819');
    // rótulo de la estantería: código del residuo almacenado (lista europea de residuos), un dato verificado;
    // sustituye a una carga máxima por nivel que no tenía fuente
    plate(CELLS.load, '#1b1e20', PAL.ivory);
    text('CÓDIGO LER 16 06 01*', ...mid(CELLS.load), 28, PAL.ivory, 700);
    // rombo de corrosivos (clase 8) en marfil y grafito
    {
      const [cx, cy] = mid(CELLS.diamond);
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.PI / 4);
      g.fillStyle = PAL.ivory;
      g.fillRect(-42, -42, 84, 84);
      g.restore();
      g.save();
      g.beginPath();
      g.moveTo(cx - 60, cy);
      g.lineTo(cx, cy + 60);
      g.lineTo(cx + 60, cy);
      g.closePath();
      g.fillStyle = '#161819';
      g.fill();
      g.restore();
      g.fillStyle = '#161819';
      g.fillRect(cx - 22, cy - 30, 10, 22);
      g.fillRect(cx + 8, cy - 30, 10, 22);
      text('8', cx, cy + 32, 22, PAL.ivory);
    }
    // extintor (pictograma grafito sobre ámbar)
    {
      const c = CELLS.fire;
      plate(c, PAL.amber);
      g.fillStyle = '#161819';
      g.fillRect(c[0] + 50, c[1] + 40, 30, 66);
      g.fillRect(c[0] + 56, c[1] + 28, 18, 14);
      g.fillRect(c[0] + 74, c[1] + 30, 26, 6);
      g.fillRect(c[0] + 94, c[1] + 30, 6, 40);
    }
    plate(CELLS.spill, '#1b1e20', PAL.amber);
    text('KIT', CELLS.spill[0] + 128, CELLS.spill[1] + 46, 46, PAL.amber);
    text('ANTIDERRAMES', CELLS.spill[0] + 128, CELLS.spill[1] + 92, 26, PAL.ivory, 700);
    {
      // rótulo de la cabeza del puente: las baterías siguen hacia el laboratorio (identificación y diagnóstico);
      // «LABORATORIO» a 44 px mide unos 330 px y termina antes de la cola de la flecha (x = 420)
      const c = CELLS.lab;
      plate(c, '#1b1e20', PAL.ivory);
      text('LABORATORIO', c[0] + 218, c[1] + 64, 44, PAL.ivory);
      g.fillStyle = PAL.lime;
      g.beginPath();
      g.moveTo(c[0] + 440, c[1] + 42);
      g.lineTo(c[0] + 484, c[1] + 64);
      g.lineTo(c[0] + 440, c[1] + 86);
      g.closePath();
      g.fill();
      g.fillRect(c[0] + 420, c[1] + 58, 24, 12);
    }
    // placa de normas junto a la ventanilla sur: solo normas con base en el anexo (seguridad y transporte ADR)
    {
      const c = CELLS.notice;
      plate(c, '#1b1e20', PAL.ivory);
      g.fillStyle = PAL.amber;
      g.fillRect(c[0] + 22, c[1] + 22, 6, 84);
      g.textAlign = 'left';
      const line = (s, y, size, col, weight = 700) => {
        g.fillStyle = col;
        g.font = `${weight} ${size}px "Archivo Variable", sans-serif`;
        g.textBaseline = 'middle';
        g.fillText(s, c[0] + 40, c[1] + y);
      };
      line('NORMAS', 34, 26, PAL.amber, 800);
      line('No abrir ni vaciar', 66, 24, PAL.ivory);
      line('ADR · UN 2794', 98, 22, PAL.ivory);
    }
    // pintura de suelo (fondo transparente, se recorta con alphaTest)
    ['A', 'B', 'C', 'D'].forEach((k) => text(k, ...mid(CELLS[`f${k}`]), 108, 'rgba(228,218,198,0.92)'));
    {
      const [cx, cy] = mid(CELLS.fArrow);
      g.fillStyle = 'rgba(228,218,198,0.92)';
      g.fillRect(cx - 12, cy - 10, 24, 56);
      g.beginPath();
      g.moveTo(cx - 40, cy - 6);
      g.lineTo(cx, cy - 52);
      g.lineTo(cx + 40, cy - 6);
      g.closePath();
      g.fill();
    }
    {
      const [cx, cy] = mid(CELLS.fBat);
      g.strokeStyle = 'rgba(228,218,198,0.92)';
      g.lineWidth = 9;
      g.strokeRect(cx - 44, cy - 22, 88, 52);
      g.fillStyle = 'rgba(228,218,198,0.92)';
      g.fillRect(cx - 34, cy - 36, 16, 12);
      g.fillRect(cx + 18, cy - 36, 16, 12);
    }
  }, 1);
  const signMat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.55, metalness: 0.05, alphaTest: 0.5 });
  // difusor de luminaria cálido y contenido (la tira M.warmGlow satura y florece a distancia)
  const fixtureMat = new THREE.MeshStandardMaterial({ color: '#ffe9c9', emissive: '#ffd49a', emissiveIntensity: 0.85, roughness: 0.6 });
  const sign = (cell, w, h) => {
    const geo = K.geo(`depSign|${cell}|${w}|${h}`, () => {
      const pg = new THREE.PlaneGeometry(w, h);
      const [cx, cy, cw, ch] = CELLS[cell];
      const uv = pg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i) * cw) / AW, 1 - (cy + (1 - uv.getY(i)) * ch) / AH);
      return pg;
    });
    return new THREE.Mesh(geo, signMat);
  };
  const decal = (cell, x, z, ry, w, h) => {
    const m = sign(cell, w, h);
    m.rotation.set(-Math.PI / 2, ry, 0, 'YXZ');
    m.position.set(s1.x + x, y0 + 0.016, s1.z + z);
    m.userData.noCollide = true;
    return ctx.add(m);
  };

  // ---------- pintura de suelo: bandas de 12 mm sobre el hormigón ----------
  const stripe = (x1, z1, x2, z2, w = 0.08, mat = M.ivory, ext = 0) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz) + ext * 2;
    const m = K.box(+len.toFixed(3), 0.012, w, mat, s1.x + (x1 + x2) / 2, y0, s1.z + (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(dz, dx);
    m.userData.noCollide = true;
    return ctx.add(m);
  };
  const outline = (x, z, w, d, ry = 0, lw = 0.08, mat = M.ivory) => {
    const f = rot(x, z, ry);
    const c = [f(-w / 2, -d / 2), f(w / 2, -d / 2), f(w / 2, d / 2), f(-w / 2, d / 2)];
    for (let i = 0; i < 4; i++) stripe(...c[i], ...c[(i + 1) % 4], lw, mat, lw / 2);
  };
  // zona rayada: contorno y diagonales a 45° recortadas al rectángulo
  const hatch = (x, z, w, d, ry = 0, step = 0.42, mat = M.amberMatte) => {
    outline(x, z, w, d, ry, 0.08, mat);
    const f = rot(x, z, ry);
    const hw = w / 2;
    const hd = d / 2;
    for (let c = -hw - hd + step; c < hw + hd; c += step) {
      const u1 = Math.max(-hw, c - hd);
      const u2 = Math.min(hw, c + hd);
      if (u2 - u1 < 0.08) continue;
      stripe(...f(u1, u1 - c), ...f(u2, u2 - c), 0.07, mat);
    }
  };
  const dashed = (x1, z1, x2, z2, dash = 0.6, gap = 0.4, w = 0.08, mat = M.amberMatte) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    for (let s = 0; s + dash <= len + 1e-3; s += dash + gap) {
      const a = s / len;
      const b = (s + dash) / len;
      stripe(x1 + (x2 - x1) * a, z1 + (z2 - z1) * a, x1 + (x2 - x1) * b, z1 + (z2 - z1) * b, w, mat);
    }
  };

  // ---------- piezas reutilizables ----------
  // palé de 1,2 × 1,0 m con tacos: las aberturas para las horquillas se leen de lejos
  function pallet() {
    const g = new THREE.Group();
    [-0.45, 0, 0.45].forEach((z) => g.add(K.box(1.2, 0.022, 0.1, M.wood, 0, 0, z)));
    [-0.53, 0, 0.53].forEach((x) => [-0.45, 0, 0.45].forEach((z) => g.add(K.box(0.145, 0.078, 0.1, M.wood, x, 0.022, z))));
    [-0.53, 0, 0.53].forEach((x) => g.add(K.box(0.1, 0.022, 1.0, M.wood, x, 0.1, 0)));
    [-0.44, -0.22, 0, 0.22, 0.44].forEach((z) => g.add(K.box(1.2, 0.022, 0.12, M.wood, 0, 0.122, z)));
    return g;
  }
  // palé cargado: capas de 2 × 3 baterías (QR hacia fuera) con cartón entre capas. En los palés interiores
  // de una calle la fila central de las capas bajas no se ve (filas exteriores, cartón y palés vecinos):
  // `full = false` la omite para ahorrar instancias.
  const loadedPallet = (x, z, ry, layers, y = 0, full = true) => {
    place(pallet(), x, z, ry, y);
    const f = rot(x, z, ry);
    for (let l = 0; l < layers; l++) {
      const by = y + 0.144 + l * LAYER;
      const top = l === layers - 1;
      [-0.3, 0, 0.3].forEach((v) => {
        if (v === 0 && !top && !full) return;
        [-0.255, 0.255].forEach((u) => {
          const [bx, bz] = f(u, v);
          bat(bx, by, bz, ry + (v < 0 ? Math.PI : 0), BS);
        });
      });
      if (!top) place(K.box(1.16, 0.02, 0.98, M.ivory), x, z, ry, by + 0.262);
    }
  };
  // caja-palé estanca (antiácido) abierta: asoman las tapas, los bornes y las asas de cuatro baterías
  const palletBox = (x, z, ry, y = 0) => {
    const g = new THREE.Group();
    [-0.5, 0.5].forEach((u) => [-0.4, 0.4].forEach((v) => g.add(K.box(0.12, 0.12, 0.12, M.graphite, u, 0, v))));
    g.add(K.box(1.2, 0.04, 1.0, M.graphite, 0, 0.12, 0));
    [-0.475, 0.475].forEach((v) => g.add(K.box(1.2, 0.62, 0.05, M.graphite, 0, 0.12, v)));
    [-0.575, 0.575].forEach((u) => g.add(K.box(0.05, 0.62, 0.9, M.graphite, u, 0.12, 0)));
    g.add(K.box(1.1, 0.02, 0.9, M.panel, 0, 0.48, 0));
    for (let i = -2; i <= 2; i++) [-1, 1].forEach((s) => g.add(K.box(0.04, 0.5, 0.025, M.graphiteLight, i * 0.24, 0.2, s * 0.51)));
    place(g, x, z, ry, y);
    const f = rot(x, z, ry);
    [-0.16, 0.16].forEach((v) => [-0.27, 0.27].forEach((u) => {
      const [bx, bz] = f(u, v);
      bat(bx, y + 0.5, bz, ry + (v < 0 ? Math.PI : 0), BS);
    }));
  };
  // jaula de rejilla apilable (1,24 × 0,835 × 0,97 m) con hasta ocho baterías en dos niveles de 2 × 2
  const cage = (x, z, ry, y = 0, n = 8) => {
    const g = new THREE.Group();
    const w = 1.24;
    const d = 0.835;
    const h = 0.97;
    [-0.55, 0.55].forEach((u) => [-0.35, 0.35].forEach((v) => g.add(K.box(0.1, 0.1, 0.1, M.darkSteel, u, 0, v))));
    g.add(K.box(w, 0.04, d, M.darkSteel, 0, 0.1, 0));
    [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].forEach(([u, v]) => g.add(K.box(0.04, h - 0.14, 0.04, M.darkSteel, u, 0.14, v)));
    [0.14, h - 0.03].forEach((yy) => {
      g.add(K.box(w, 0.03, 0.03, M.darkSteel, 0, yy, -d / 2));
      g.add(K.box(w, 0.03, 0.03, M.darkSteel, 0, yy, d / 2));
      g.add(K.box(0.03, 0.03, d, M.darkSteel, -w / 2, yy, 0));
      g.add(K.box(0.03, 0.03, d, M.darkSteel, w / 2, yy, 0));
    });
    for (let i = 0; i < 6; i++) {
      const u = -0.5 + i * 0.2;
      g.add(K.box(0.012, 0.8, 0.012, M.steel, u, 0.16, -d / 2));
      g.add(K.box(0.012, 0.8, 0.012, M.steel, u, 0.16, d / 2));
    }
    for (let i = 0; i < 4; i++) {
      const v = -0.3 + i * 0.2;
      g.add(K.box(0.012, 0.8, 0.012, M.steel, -w / 2, 0.16, v));
      g.add(K.box(0.012, 0.8, 0.012, M.steel, w / 2, 0.16, v));
    }
    [0.38, 0.6, 0.82].forEach((yy) => {
      g.add(K.box(w, 0.012, 0.012, M.steel, 0, yy, -d / 2));
      g.add(K.box(w, 0.012, 0.012, M.steel, 0, yy, d / 2));
      g.add(K.box(0.012, 0.012, d, M.steel, -w / 2, yy, 0));
      g.add(K.box(0.012, 0.012, d, M.steel, w / 2, yy, 0));
    });
    // portezuela abatible y portaetiquetas
    g.add(K.box(0.5, 0.05, 0.02, M.darkSteel, 0, 0.55, d / 2 + 0.015));
    g.add(K.box(0.16, 0.1, 0.01, M.ivoryPanel, 0.42, 0.7, d / 2 + 0.02));
    place(g, x, z, ry, y);
    const f = rot(x, z, ry);
    // primero el nivel inferior completo; el superior se llena parcialmente (con cartón debajo)
    const slots = [[-0.27, -0.17], [0.27, -0.17], [-0.27, 0.17], [0.27, 0.17]];
    for (let i = 0; i < Math.min(n, 8); i++) {
      const [u, v] = slots[i % 4];
      const [bx, bz] = f(u, v);
      bat(bx, y + 0.14 + (i >= 4 ? LAYER : 0), bz, ry + (v < 0 ? Math.PI : 0) + (i >= 4 ? 0.04 * (i - 5.5) : 0), BS);
    }
    if (n > 4) place(K.box(1.14, 0.015, 0.74, M.ivory), x, z, ry, y + 0.14 + 0.262);
  };
  const bollard = (x, z) => {
    const g = new THREE.Group();
    g.add(cylAt(0.1, 0.1, 1.0, M.graphite, 14, 0, 0, 0));
    [0.6, 0.8].forEach((yy) => g.add(cylAt(0.104, 0.104, 0.08, M.amberMatte, 14, 0, yy, 0)));
    g.add(cylAt(0.06, 0.1, 0.06, M.graphite, 14, 0, 1.0, 0));
    place(g, x, z, 0, 0, 'bolardo');
  };
  const signPost = (cell, x, z, ry, w, h, top = 2.0) => {
    const g = new THREE.Group();
    g.add(K.box(0.24, 0.02, 0.24, M.darkSteel, 0, 0, 0));
    g.add(K.box(0.06, top, 0.06, M.darkSteel, 0, 0, 0));
    g.add(K.box(w + 0.06, h + 0.06, 0.03, M.graphite, 0, top - h - 0.03, 0.045));
    const s = sign(cell, w, h);
    s.position.set(0, top - h / 2, 0.062);
    g.add(s);
    place(g, x, z, ry, 0, 'rotulo');
  };
  const extinguisher = (x, z, ry) => {
    const g = new THREE.Group();
    g.add(K.box(0.3, 0.02, 0.3, M.darkSteel, 0, 0, 0));
    g.add(K.box(0.07, 1.9, 0.07, M.graphite, 0, 0, 0));
    g.add(K.box(0.14, 0.04, 0.14, M.darkSteel, 0, 0.34, 0.1));
    g.add(cylAt(0.08, 0.08, 0.5, M.graphite, 16, 0, 0.38, 0.14));
    g.add(cylAt(0.082, 0.082, 0.07, M.amberMatte, 16, 0, 0.7, 0.14));
    g.add(cylAt(0.03, 0.04, 0.08, M.steel, 10, 0, 0.88, 0.14));
    g.add(K.box(0.02, 0.36, 0.02, M.rubber, 0.08, 0.5, 0.18));
    g.add(K.box(0.3, 0.3, 0.015, M.graphite, 0, 1.52, 0.04));
    const s = sign('fire', 0.26, 0.26);
    s.position.set(0, 1.67, 0.05);
    g.add(s);
    place(g, x, z, ry, 0, 'extintor');
  };

  // ======================================================================
  // Norte: almacén cubierto con estantería de palés (estructura alta de fondo)
  // ======================================================================
  const RX = 1.4;
  const RZ = -9.25;
  {
    const g = new THREE.Group();
    const RH = 4.6;
    const RD = 1.1;
    const ups = [-4.2, -1.4, 1.4, 4.2];
    ups.forEach((x) => {
      [-RD / 2, RD / 2].forEach((z) => {
        g.add(K.box(0.09, RH, 0.07, M.graphite, x, 0, z));
        g.add(K.box(0.18, 0.012, 0.16, M.darkSteel, x, 0, z));
      });
      g.add(K.box(0.05, 0.05, RD, M.graphite, x, 0.12, 0));
      g.add(K.box(0.05, 0.05, RD, M.graphite, x, RH - 0.1, 0));
      // celosía del bastidor
      const dy = 0.72;
      const len = Math.hypot(RD, dy);
      for (let k = 0; k < 6; k++) {
        const br = K.box(0.035, 0.035, +len.toFixed(3), M.graphite);
        br.position.set(x, 0.17 + dy * (k + 0.5), 0);
        br.rotation.x = (k % 2 ? 1 : -1) * Math.atan2(dy, RD);
        g.add(br);
      }
      // protector ámbar en el pie delantero
      g.add(K.box(0.22, 0.42, 0.12, M.amberMatte, x, 0, RD / 2 + 0.1));
    });
    // largueros ámbar en dos niveles y placas de módulo
    const levels = [1.5, 3.0];
    for (let b = 0; b < 3; b++) {
      const cx = (ups[b] + ups[b + 1]) / 2;
      levels.forEach((ly) => {
        g.add(K.box(2.71, 0.12, 0.05, M.amberMatte, cx, ly, RD / 2));
        g.add(K.box(2.71, 0.12, 0.05, M.amberMatte, cx, ly, -RD / 2));
      });
      const s = sign(`r${b + 1}`, 0.22, 0.11);
      s.position.set(cx, 1.56, RD / 2 + 0.028);
      g.add(s);
    }
    const lsign = sign('load', 0.84, 0.14);
    lsign.position.set(ups[0] - 0.05, 2.3, 0);
    lsign.rotation.y = -Math.PI / 2;
    g.add(lsign);
    // marquesina en voladizo sobre pilares traseros, con canalón y bajante; luminarias empotradas
    // (cuatro pantallas cortas en lugar de una tira continua: no deslumbran ni compiten con la interfaz)
    const RF = 2.2; // vuelo delantero de la cubierta
    const CH = 4.95; // altura de la cubierta: justo por encima de los bastidores (4,6 m)
    [-4.0, 1.4, 4.6].forEach((x) => {
      g.add(K.box(0.16, CH, 0.16, M.darkSteel, x, 0, -1.0));
      g.add(K.box(0.12, 0.26, RF + 1.2, M.darkSteel, x, CH - 0.26, (RF - 1.2) / 2));
      g.add(K.box(0.26, 0.02, 0.26, M.darkSteel, x, 0, -1.0));
    });
    g.add(K.rbox(9.8, 0.16, RF + 1.5, M.panel, 0, CH, (RF - 1.5) / 2 + 0.05, 0.04));
    g.add(K.box(9.9, 0.34, 0.07, M.darkSteel, 0, CH - 0.18, RF + 0.08));
    [-3.3, -1.1, 1.1, 3.3].forEach((x) => {
      g.add(K.box(1.3, 0.05, 0.2, M.darkSteel, x, CH - 0.31, RF - 0.5));
      g.add(K.box(1.2, 0.02, 0.12, fixtureMat, x, CH - 0.325, RF - 0.5));
    });
    g.add(K.box(9.9, 0.12, 0.14, M.darkSteel, 0, CH - 0.06, -1.4));
    g.add(cylAt(0.05, 0.05, CH - 0.1, M.darkSteel, 8, -4.75, 0, -1.4));
    // canaleta de recogida de derrames delante de la estantería
    g.add(K.box(8.4, 0.014, 0.24, M.darkSteel, 0, 0, RD / 2 + 0.45));
    for (let i = 0; i < 28; i++) g.add(K.box(0.03, 0.03, 0.2, M.panel, -4.05 + i * 0.3, 0, RD / 2 + 0.45));
    place(g, RX, RZ, 0, 0, 'almacen');
    shadow(RX, RZ, 9.4, 2.0);
    // luz cálida bajo la marquesina (una de las dos luces nuevas de la estación), dirigida a los largueros
    const spot = new THREE.SpotLight('#ffd2a0', 26, 15, 1.0, 0.65, 1.4);
    spot.position.set(s1.x + RX, y0 + CH - 0.4, s1.z + RZ + 2.1);
    spot.target.position.set(s1.x + RX, y0 + 2.2, s1.z + RZ + 0.55);
    ctx.add(spot);
    ctx.add(spot.target);

    // carga de la estantería: cajas estancas y palés con baterías (de dos capas en el nivel del suelo)
    const plan = [
      ['bat2', 'box', 'box', 'bat1', 'box', 'box'],
      ['box', 'bat1', 'box', 'box', 'bat1', 'box'],
      ['bat1', 'box', 'bat1', 'bat1', 'box', 'box'],
    ];
    const ly = [0, 1.62, 3.12];
    plan.forEach((row, li) => {
      row.forEach((kind, k) => {
        const b = Math.floor(k / 2);
        const cx = RX + (ups[b] + ups[b + 1]) / 2 + (k % 2 ? 0.65 : -0.65);
        if (kind === 'box') palletBox(cx, RZ, 0, ly[li]);
        else loadedPallet(cx, RZ, 0, kind === 'bat2' ? 2 : 1, ly[li], k === 0 || k === 5);
      });
    });
    // línea ámbar de seguridad y calle de la carretilla
    stripe(RX - 4.6, RZ + RD / 2 + 1.0, RX + 4.6, RZ + RD / 2 + 1.0, 0.1, M.amberMatte);
    dashed(RX - 4.4, RZ + 3.6, RX + 4.4, RZ + 3.6, 0.7, 0.45, 0.08, M.amberMatte);
  }

  // ======================================================================
  // Centro: calles de palés A y B con baterías, contornos y letras pintadas
  // ======================================================================
  // (v2) las dos calles empiezan en x = -0,25: letras, postes y contornos quedan al este de la franja de descarga
  const rowsA = { x0: -0.25, z: -3.9, n: 5 };
  const rowsB = { x0: -0.25, z: -0.4, n: 4 };
  // capas por palé (norte, sur) de oeste a este; 0 = palé vacío, -1 = hueco libre (destino de la carretilla)
  [[rowsA, 'A', [2, 1, 2, 3, 1, 2, 2, 2, 1, 0]], [rowsB, 'B', [1, 2, 2, -1, 2, 2, 1, 1]]].forEach(([r, letter, lay]) => {
    for (let i = 0; i < r.n; i++) {
      const x = r.x0 + i * 1.35;
      const full = i === 0 || i === r.n - 1;
      [[r.z - 0.55, lay[i * 2]], [r.z + 0.55, lay[i * 2 + 1]]].forEach(([z, n]) => {
        if (n === 0) place(pallet(), x, z, 0);
        else if (n > 0) loadedPallet(x, z, 0, n, 0, full);
      });
    }
    const len = (r.n - 1) * 1.35 + 2.5;
    const cx = r.x0 + ((r.n - 1) * 1.35) / 2 - 0.5;
    outline(cx, r.z, len, 2.5);
    shadow(cx + 0.5, r.z, len - 0.6, 2.8);
    decal(`f${letter}`, r.x0 - 1.3, r.z, 0, 0.9, 0.9);
    signPost(letter, r.x0 - 1.35, r.z + 1.0, 0.5, 0.42, 0.42, 1.9);
  });

  // ======================================================================
  // Noroeste: caseta de recepción con ventanilla iluminada y marquesina (v2: al norte de la franja de descarga;
  // su fachada sur da al camión)
  // (marco local: +z = ventanilla hacia el patio (este), −x = fachada sur, la que ve la cámara de lectura)
  // ======================================================================
  const KX = -7.2;
  const KZ = -6.4;
  {
    const g = new THREE.Group();
    const w = 3.2;
    const d = 2.4;
    const h = 2.7;
    const t = 0.12;
    const b = 0.14;
    // paneles de hormigón gris cálido: la caseta queda por debajo de la tapa iluminada de la protagonista
    const wall = M.concreteLight;
    g.add(K.box(w + 0.3, b, d + 0.3, M.concreteLight, 0, 0, 0));
    g.add(K.box(w, h, t, wall, 0, b, -d / 2 + t / 2));
    g.add(K.box(t, h, d - 2 * t, wall, w / 2 - t / 2, b, 0));
    g.add(K.box(w, 0.95, t, wall, 0, b, d / 2 - t / 2));
    g.add(K.box(w, 0.75, t, wall, 0, b + 1.95, d / 2 - t / 2));
    g.add(K.box(0.7, 1.0, t, wall, -w / 2 + 0.35, b + 0.95, d / 2 - t / 2));
    g.add(K.box(0.7, 1.0, t, wall, w / 2 - 0.35, b + 0.95, d / 2 - t / 2));
    // fachada sur con ventana pequeña (hueco real: se ve el archivador y la silla del interior)
    const sx = -w / 2 + t / 2;
    const wv0 = 0.2;
    const wv1 = 0.9;
    const wy0 = b + 1.0;
    const wy1 = b + 1.85;
    g.add(K.box(t, h, wv0 + d / 2 - t, wall, sx, b, (wv0 - d / 2 + t) / 2));
    g.add(K.box(t, h, d / 2 - t - wv1, wall, sx, b, (wv1 + d / 2 - t) / 2));
    g.add(K.box(t, wy0 - b, wv1 - wv0, wall, sx, b, (wv0 + wv1) / 2));
    g.add(K.box(t, b + h - wy1, wv1 - wv0, wall, sx, wy1, (wv0 + wv1) / 2));
    g.add(K.box(0.1, 0.05, wv1 - wv0 + 0.1, M.darkSteel, -w / 2 - 0.01, wy0 - 0.05, (wv0 + wv1) / 2));
    g.add(K.box(0.08, 0.04, wv1 - wv0 + 0.1, M.darkSteel, -w / 2, wy1, (wv0 + wv1) / 2));
    [wv0 - 0.025, wv1 + 0.025].forEach((v) => g.add(K.box(0.08, wy1 - wy0, 0.05, M.darkSteel, -w / 2, wy0, v)));
    const sGlass = new THREE.Mesh(K.geo('depKioskGlassS', () => new THREE.PlaneGeometry(wv1 - wv0, wy1 - wy0)), M.glass);
    sGlass.rotation.y = -Math.PI / 2;
    sGlass.position.set(-w / 2 + 0.03, (wy0 + wy1) / 2, (wv0 + wv1) / 2);
    g.add(sGlass);
    g.add(K.box(w + 0.04, 0.3, d + 0.04, M.panel, 0, b, 0));
    for (let i = 1; i < 4; i++) g.add(K.box(0.03, h - 0.4, 0.02, M.graphiteLight, -w / 2 + i * 0.8, b + 0.32, -d / 2 - 0.005));
    // juntas verticales entre paneles y cantoneras grafito en las esquinas vistas
    g.add(K.box(0.02, h - 0.4, 0.03, M.graphiteLight, -w / 2 - 0.005, b + 0.32, 0.05));
    [[-1, -1], [-1, 1], [1, 1]].forEach(([su, sv]) => g.add(K.box(0.07, h, 0.07, M.graphiteLight, su * (w / 2 + 0.01), b, sv * (d / 2 + 0.01))));
    g.add(K.box(0.04, 0.06, d + 0.06, M.graphiteLight, -w / 2 - 0.01, b + h - 0.06, 0));
    g.add(K.box(w + 0.06, 0.06, 0.04, M.graphiteLight, 0, b + h - 0.06, d / 2 + 0.01));
    // ventanilla con marco, montante, vidrio y mostrador exterior
    const wy = b + 1.45;
    g.add(K.box(1.86, 0.05, 0.06, M.darkSteel, 0, b + 0.93, d / 2));
    g.add(K.box(1.86, 0.05, 0.06, M.darkSteel, 0, b + 1.93, d / 2));
    [-0.93, 0, 0.93].forEach((x) => g.add(K.box(0.05, 1.0, 0.06, M.darkSteel, x, b + 0.95, d / 2)));
    const glass = new THREE.Mesh(K.geo('depKioskGlass', () => new THREE.PlaneGeometry(1.8, 1.0)), M.glass);
    glass.position.set(0, wy, d / 2 - 0.02);
    g.add(glass);
    g.add(K.box(1.9, 0.05, 0.34, M.stoneTop, 0, b + 0.9, d / 2 + 0.17));
    [-0.7, 0.7].forEach((x) => g.add(K.box(0.04, 0.2, 0.28, M.darkSteel, x, b + 0.7, d / 2 + 0.15)));
    // puerta sur (cerrada) con aplique, en el extremo oeste de la fachada
    g.add(K.box(0.05, 2.08, 0.9, M.graphite, -w / 2 - 0.02, b, -0.58));
    g.add(K.box(0.07, 0.05, 0.98, M.darkSteel, -w / 2 - 0.02, b + 2.08, -0.58));
    g.add(K.box(0.04, 0.03, 0.14, M.steel, -w / 2 - 0.06, b + 1.0, -0.24));
    g.add(K.box(0.012, 0.3, 0.5, M.darkGlass, -w / 2 - 0.05, b + 1.45, -0.58));
    g.add(K.box(0.12, 0.1, 0.22, M.darkSteel, -w / 2 - 0.06, b + 2.3, -0.58));
    g.add(K.box(0.02, 0.06, 0.16, fixtureMat, -w / 2 - 0.125, b + 2.3, -0.58));
    // fachada este (ventanilla): placa de normas y aplique sobre ella
    {
      const np = sign('notice', 0.5, 0.25);
      np.position.set(-w / 2 + 0.36, b + 1.5, d / 2 + 0.017);
      g.add(np);
      g.add(K.box(0.54, 0.29, 0.015, M.graphite, -w / 2 + 0.36, b + 1.355, d / 2 + 0.004));
      g.add(K.box(0.2, 0.08, 0.12, M.darkSteel, -w / 2 + 0.36, b + 1.95, d / 2 + 0.06));
      g.add(K.box(0.16, 0.015, 0.08, fixtureMat, -w / 2 + 0.36, b + 1.945, d / 2 + 0.07));
    }
    // interior: mostrador de trabajo, monitor, silla, archivador y luz de techo
    const desk = K.cabinet(M, { w: 2.2, h: 0.72, d: 0.6, drawers: 2, top: M.stoneTop });
    desk.position.set(0.25, b, -d / 2 + t + 0.32);
    g.add(desk);
    g.add(K.box(0.56, 0.34, 0.04, M.darkGlass, 0.35, b + 1.0, -0.72));
    g.add(K.box(0.06, 0.18, 0.06, M.darkSteel, 0.35, b + 0.84, -0.76));
    g.add(K.box(0.5, 0.012, 0.3, M.ivoryPanel, -0.55, b + 0.84, -0.7));
    g.add(K.rbox(0.46, 0.08, 0.44, M.graphite, 0.3, b + 0.48, -0.15, 0.03));
    g.add(K.rbox(0.44, 0.48, 0.07, M.graphite, 0.3, b + 0.56, -0.36, 0.03));
    g.add(K.box(0.06, 0.45, 0.06, M.darkSteel, 0.3, b + 0.03, -0.15));
    g.add(K.box(0.3, 1.6, 1.2, M.graphiteLight, w / 2 - 0.3, b, -0.2));
    for (let i = 0; i < 8; i++) g.add(K.box(0.22, 0.3, 0.07, [M.amberMatte, M.ivoryPanel, M.graphite][i % 3], w / 2 - 0.3, b + 1.62, -0.66 + i * 0.12));
    g.add(K.box(w - 0.3, 0.05, d - 0.3, M.ivoryPanel, 0, b + h - 0.05, 0));
    [-0.6, 0.6].forEach((x) => g.add(K.box(0.9, 0.03, 0.22, M.warmGlow, x, b + h - 0.09, 0.15)));
    // fachada trasera: climatizador, cuadro eléctrico y bajante
    g.add(K.rbox(0.8, 0.55, 0.3, M.graphiteLight, 0.6, b + 0.35, -d / 2 - 0.16, 0.03));
    const fan = K.cyl(0.19, 0.19, 0.02, M.darkSteel, 18);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(0.6, b + 0.62, -d / 2 - 0.32);
    g.add(fan);
    g.add(K.box(0.42, 0.5, 0.14, M.graphite, -0.9, b + 1.1, -d / 2 - 0.07));
    g.add(cylAt(0.04, 0.04, h, M.darkSteel, 8, w / 2 - 0.12, b, -d / 2 - 0.06));
    // cubierta con vuelo delantero, rótulo y tira de luz bajo la marquesina
    g.add(K.rbox(w + 0.5, 0.2, d + 1.6, M.panel, 0, b + h, 0.55, 0.04));
    g.add(K.box(w + 0.5, 0.3, 0.06, M.darkSteel, 0, b + h - 0.06, d / 2 + 1.37));
    const rs = sign('recep', w + 0.2, 0.22);
    rs.position.set(0, b + h + 0.1, d / 2 + 1.405);
    g.add(rs);
    // segundo rótulo en el canto sur de la marquesina, hacia el patio y la cámara de lectura
    g.add(K.box(0.06, 0.3, d + 1.6, M.darkSteel, -w / 2 - 0.28, b + h - 0.06, 0.55));
    const rs2 = sign('recep', 3.2, 0.3);
    rs2.rotation.y = -Math.PI / 2;
    rs2.position.set(-w / 2 - 0.315, b + h + 0.09, 0.55);
    g.add(rs2);
    g.add(K.box(w, 0.035, 0.08, M.warmGlow, 0, b + h - 0.05, d / 2 + 1.2));
    [-1, 1].forEach((s) => g.add(K.box(0.07, h, 0.07, M.darkSteel, s * (w / 2 + 0.12), b, d / 2 + 1.26)));
    place(g, KX, KZ, Math.PI / 2, 0, 'caseta');
    shadow(KX + 0.4, KZ, 4.0, 4.4);
  }

  // mástil de iluminación entre la caseta y la franja de descarga: su foco cálido (luz que ya existía, ahora
  // reorientada) alumbra la trasera del camión y la carretilla
  {
    const MX = -10.4;
    const MZ = -4.4;
    const g = new THREE.Group();
    g.add(K.box(0.7, 0.25, 0.7, M.concreteLight, 0, 0, 0));
    g.add(K.box(0.36, 0.02, 0.36, M.darkSteel, 0, 0.25, 0));
    [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]].forEach(([x, z]) => g.add(cylAt(0.016, 0.016, 0.06, M.steel, 6, x, 0.26, z)));
    g.add(cylAt(0.075, 0.11, 5.3, M.graphite, 12, 0, 0.27, 0));
    g.add(K.box(0.14, 0.42, 0.1, M.graphite, 0, 1.0, 0.11));
    g.add(K.box(0.08, 0.08, 1.5, M.darkSteel, 0, 5.4, 0));
    [-0.55, 0.55].forEach((z) => {
      const head = new THREE.Group();
      head.add(K.rbox(0.42, 0.28, 0.16, M.graphite, 0, -0.14, 0, 0.03));
      head.add(K.box(0.36, 0.22, 0.012, M.warmGlow, 0, -0.11, 0.085));
      head.add(K.box(0.04, 0.12, 0.04, M.darkSteel, 0, 0.02, -0.06));
      head.position.set(0.12, 5.4, z);
      head.rotation.set(0.5, Math.PI / 2, 0, 'YXZ');
      g.add(head);
    });
    // proyectores hacia el sur (la franja de descarga)
    place(g, MX, MZ, -Math.PI / 2, 0, 'mastil');
    shadow(MX, MZ, 0.9, 0.9);
    const flood = new THREE.SpotLight('#ffc98a', 70, 17, 0.78, 0.6, 1.6);
    flood.position.set(s1.x + MX, y0 + 5.3, s1.z + MZ + 0.4);
    flood.target.position.set(s1.x - 9.6, y0, s1.z + 0.8);
    ctx.add(flood);
    ctx.add(flood.target);
  }
  // bolardos, extintor y punto de entrega pintado ante la ventanilla (al este de la caseta)
  bollard(KX + 2.95, KZ - 1.85);
  bollard(KX + 2.95, KZ + 1.85);
  extinguisher(KX + 2.75, KZ - 2.55, Math.PI / 2);
  decal('fBat', KX + 2.85, KZ, Math.PI / 2, 0.75, 0.75);

  // ======================================================================
  // Báscula de recepción con visor de patio: el lote se pesa mientras la cámara se acerca y la lectura
  // se estabiliza justo al entrar en la ventana de lectura (story.local = 0); al retroceder, descuenta.
  // ======================================================================
  // lote de ejemplo: 18 baterías × 18 kg (batería europea de referencia de 70 Ah, pestaña Datos) = 324 kg netos
  const WEIGHT = 324;
  const weigh = (story) => {
    if (!story) return 0;
    if (story.reduced || story.index > CH.recogida) return 1;
    if (story.index < CH.recogida) return 0;
    const u = Math.min(1, Math.max(0, (story.local + 0.75) / 0.75));
    return u * u * (3 - 2 * u);
  };
  const display = T.liveScreen(384, 160, (g, w, h, t, story) => {
    const k = weigh(story);
    const done = k >= 0.999;
    g.fillStyle = '#0d0f10';
    g.fillRect(0, 0, w, h);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = '700 19px "Archivo Variable", sans-serif';
    g.fillStyle = 'rgba(241,238,230,0.55)';
    g.fillText('BÁSCULA 1', 18, 22);
    g.textAlign = 'right';
    g.fillStyle = done ? PAL.lime : 'rgba(229,174,80,0.75)';
    g.fillText(done ? 'REGISTRADO' : 'PESANDO', w - 18, 22);
    g.font = '700 74px "Archivo Variable", sans-serif';
    g.fillStyle = 'rgba(229,174,80,0.12)';
    g.fillText('888,8', 296, 80);
    g.fillStyle = PAL.amber;
    g.fillText((WEIGHT * k).toFixed(1).replace('.', ','), 296, 80);
    g.textAlign = 'left';
    g.font = '700 30px "Archivo Variable", sans-serif';
    g.fillText('kg', 304, 94);
    g.font = '600 21px "Archivo Variable", sans-serif';
    g.fillStyle = PAL.ivory;
    g.fillText('LOTE 0147 · 18 uds · EJEMPLO', 18, 128);
    // barra lima fina que se llena con el peso
    g.fillStyle = 'rgba(194,242,48,0.16)';
    g.fillRect(18, 146, w - 36, 5);
    g.fillStyle = PAL.lime;
    g.fillRect(18, 146, Math.round((w - 36) * k), 5);
  }, 8);
  // La traza luminosa nace bajo la báscula (-6, 4): la batería empieza su recorrido al pesarse en recepción.
  // (v2) Báscula girada con las rampas al este y al oeste, justo al sur de la franja de descarga.
  {
    const SX = -6.4;
    const SZ = 4.45;
    const g = new THREE.Group();
    // plataforma de 1,5 × 1,5 m y 0,2 m de alto con rampas este y oeste (la traza sale bajo la rampa este)
    g.add(K.box(1.56, 0.17, 1.56, M.darkSteel, 0, 0, 0));
    g.add(K.rbox(1.5, 0.05, 1.5, M.steel, 0, 0.15, 0, 0.012));
    for (let i = 0; i < 7; i++) g.add(K.box(1.4, 0.006, 0.02, M.darkSteel, 0, 0.2, -0.6 + i * 0.2));
    [-1, 1].forEach((s) => {
      const ramp = K.box(1.5, 0.035, 0.64, M.darkSteel);
      ramp.position.set(0, 0.1, s * 1.08);
      ramp.rotation.x = s * 0.32;
      g.add(ramp);
    });
    // columna con terminal y visor de patio (1,3 × 0,54 m) al sur de la plataforma, mirando al sur
    const col = new THREE.Group();
    col.add(K.box(0.34, 0.02, 0.34, M.darkSteel, 0, 0, 0));
    col.add(K.box(0.1, 2.12, 0.1, M.graphite, 0, 0, 0));
    col.add(K.rbox(0.32, 0.26, 0.18, M.graphite, 0, 1.0, 0.1, 0.03));
    col.add(K.box(0.18, 0.05, 0.01, M.amberGlow, 0, 1.17, 0.195));
    col.add(K.box(0.7, 0.06, 0.08, M.darkSteel, 0, 2.07, 0.02));
    const scr = K.framedScreen(M, display.texture, 1.3, 0.54, 0.85);
    scr.position.set(0, 2.42, 0.1);
    col.add(scr);
    const ks = sign('kg', 0.22, 0.11);
    ks.position.set(0, 1.84, 0.055);
    col.add(ks);
    col.position.set(-1.15, 0, -0.5);
    col.rotation.y = 0.1 - Math.PI / 2;
    g.add(col);
    place(g, SX, SZ, Math.PI / 2, 0, 'bascula');
    outline(SX, SZ, 3.2, 1.75, 0, 0.08, M.amberMatte);
    // lote entrante: tres capas completas (18 baterías) sobre la plataforma
    loadedPallet(SX, SZ, 0, 3, 0.2);
  }
  // se redibuja solo cuando cambia la lectura (y como mucho a 8 fps mientras avanza el tiempo)
  let shownK = -1;
  let shownT = -1;
  ctx.anim((t, dt, story) => {
    if (story.index > CH.identificacion) return;
    const k = Math.round(weigh(story) * 1000);
    if (k === shownK || (t > shownT && t - shownT < 0.125)) return;
    shownK = k;
    shownT = t;
    display.update(t, story, true);
  });

  // ======================================================================
  // Noreste: contenedor cerrado para baterías (rótulos ADR, ventilación, barras de cierre)
  // ======================================================================
  {
    const g = new THREE.Group();
    const L = 2.99;
    const W2 = 2.44;
    const H = 2.59;
    const b = 0.15;
    [-1.1, 1.1].forEach((z) => g.add(K.box(W2 + 0.2, b, 0.3, M.concreteLight, 0, 0, z)));
    g.add(K.box(W2 - 0.12, H - 0.1, L - 0.1, M.graphiteLight, 0, b + 0.05, 0));
    g.add(K.box(W2, 0.05, L, M.panel, 0, b + H - 0.04, 0));
    // bastidor: postes de esquina, largueros y cantoneras
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      g.add(K.box(0.16, H, 0.16, M.darkSteel, sx * (W2 / 2 - 0.08), b, sz * (L / 2 - 0.08)));
      g.add(K.box(0.18, 0.12, 0.18, M.steel, sx * (W2 / 2 - 0.08), b + H - 0.12, sz * (L / 2 - 0.08)));
    });
    [b, b + H - 0.12].forEach((yy) => {
      [-1, 1].forEach((s) => {
        g.add(K.box(0.12, 0.12, L, M.darkSteel, s * (W2 / 2 - 0.06), yy, 0));
        g.add(K.box(W2, 0.12, 0.12, M.darkSteel, 0, yy, s * (L / 2 - 0.06)));
      });
    });
    // chapa ondulada en los costados
    for (let i = 0; i < 13; i++) {
      const z = -L / 2 + 0.28 + i * 0.204;
      [-1, 1].forEach((s) => g.add(K.box(0.05, H - 0.3, 0.09, M.graphiteLight, s * (W2 / 2 - 0.03), b + 0.15, z)));
    }
    for (let i = 0; i < 10; i++) g.add(K.box(0.09, H - 0.3, 0.05, M.graphiteLight, -W2 / 2 + 0.3 + i * 0.205, b + 0.15, -L / 2 + 0.03));
    // puertas: dos hojas, cuatro barras de cierre, manetas y bisagras
    g.add(K.box(W2 - 0.3, H - 0.26, 0.05, M.graphiteLight, 0, b + 0.13, L / 2 - 0.01));
    g.add(K.box(0.02, H - 0.3, 0.06, M.darkSteel, 0, b + 0.15, L / 2 + 0.015));
    [-0.85, -0.35, 0.35, 0.85].forEach((x) => {
      g.add(cylAt(0.018, 0.018, H - 0.36, M.steel, 8, x, b + 0.18, L / 2 + 0.05));
      [b + 0.3, b + H - 0.36].forEach((yy) => g.add(K.box(0.07, 0.06, 0.05, M.darkSteel, x, yy, L / 2 + 0.04)));
      g.add(K.box(0.04, 0.04, 0.12, M.steel, x + 0.05, b + 1.2, L / 2 + 0.09));
    });
    [-1, 1].forEach((s) => [0.6, 1.4, 2.2].forEach((yy) => g.add(K.box(0.06, 0.12, 0.06, M.darkSteel, s * (W2 / 2 - 0.12), b + yy, L / 2 + 0.03))));
    // rejillas de ventilación altas (las baterías se almacenan ventiladas)
    [-1, 1].forEach((s) => [-0.7, 0.7].forEach((z) => {
      g.add(K.box(0.04, 0.3, 0.5, M.darkSteel, s * (W2 / 2 + 0.03), b + H - 0.62, z));
      for (let k = 0; k < 4; k++) g.add(K.box(0.05, 0.02, 0.46, M.panel, s * (W2 / 2 + 0.05), b + H - 0.58 + k * 0.07, z));
    }));
    // rótulos: panel ADR y rombo de corrosivos en las puertas y en el costado visible
    const un = sign('un', 0.4, 0.2);
    un.position.set(-0.55, b + 1.75, L / 2 + 0.075);
    g.add(un);
    const dm = sign('diamond', 0.42, 0.42);
    dm.position.set(0.55, b + 1.75, L / 2 + 0.075);
    g.add(dm);
    const dm2 = sign('diamond', 0.5, 0.5);
    dm2.position.set(W2 / 2 + 0.08, b + 1.55, 0.6);
    dm2.rotation.y = Math.PI / 2;
    g.add(dm2);
    const un2 = sign('un', 0.48, 0.24);
    un2.position.set(W2 / 2 + 0.08, b + 1.55, -0.4);
    un2.rotation.y = Math.PI / 2;
    g.add(un2);
    // rampa de acceso de chapa
    const ramp = K.box(1.6, 0.04, 0.9, M.steel);
    ramp.position.set(0, 0.09, L / 2 + 0.42);
    ramp.rotation.x = 0.17;
    g.add(ramp);
    // junto a la salida: las baterías esperan cerradas antes de cruzar hacia el laboratorio (puertas hacia el patio);
    // deja libre la visual hacia la carretilla desde la cámara de lectura y de salida
    const cx = 7.9;
    const cz = -5.4;
    const ry = 0;
    place(g, cx, cz, ry, 0, 'contenedor');
    shadow(cx, cz, 3.2, 3.8, ry);
    const f = rot(cx, cz, ry);
    hatch(...f(0, L / 2 + 0.95), 2.3, 1.2, ry, 0.42);
    extinguisher(...f(W2 / 2 + 0.45, L / 2 - 0.45), ry);
  }

  // jaulas de rejilla en dos filas, alguna apilada, con contorno de zona C (v2: 0,9 m al este y 0,7 m al sur,
  // para dejar sitio a la báscula)
  {
    const cx = -2.7;
    const cz = 7.7;
    const ry = -0.42;
    const f = rot(cx, cz, ry);
    // dos niveles de 2 × 2 por jaula; sobre las jaulas 1 y 4 va otra apilada (una vacía, de retorno)
    const slots = [[-2.1, -0.47, 8], [-0.7, -0.47, 6], [0.7, -0.47, 8], [2.1, -0.47, 5], [-2.1, 0.47, 6], [-0.7, 0.47, 8], [0.7, 0.47, 5]];
    slots.forEach(([u, v, n], i) => {
      const [x, z] = f(u, v);
      cage(x, z, ry + (v > 0 ? 0 : Math.PI), 0, n);
      if (i === 1 || i === 4) cage(x, z, ry + (v > 0 ? 0 : Math.PI), 0.98, i === 1 ? 0 : 4);
    });
    outline(cx, cz, 5.9, 2.3, ry);
    decal('fC', ...f(3.6, 0.1), ry, 0.9, 0.9);
    shadow(cx, cz, 6.0, 2.4, ry);
    signPost('C', ...f(2.9, 1.35), ry + 0.5, 0.42, 0.42, 1.9);
    // kit antiderrames y sacos de absorbente: (v2) junto a la cuarentena de baterías dañadas, frente al sur
    const k = new THREE.Group();
    k.add(K.cabinet(M, { w: 0.9, h: 0.95, d: 0.55, drawers: 2, mat: M.amberMatte, top: M.graphite }));
    k.add(K.box(0.92, 0.5, 0.03, M.graphite, 0, 1.12, -0.3));
    const ss = sign('spill', 0.6, 0.3);
    ss.position.set(0, 1.37, -0.28);
    k.add(ss);
    k.add(K.rbox(0.45, 0.28, 0.32, M.ivory, 0.75, 0, 0.05, 0.08));
    k.add(K.rbox(0.42, 0.26, 0.3, M.ivory, 0.72, 0.28, 0.02, 0.08));
    const broom = K.box(0.03, 1.3, 0.03, M.wood);
    broom.position.set(-0.55, 0.62, -0.18);
    broom.rotation.z = 0.18;
    k.add(broom);
    place(k, -0.75, 2.5, 0, 0, 'kit');
    shadow(-0.55, 2.45, 1.8, 0.8);
  }

  // pila de palés vacíos al oeste de la báscula (se cambian por los que llegan a ella)
  for (let i = 0; i < 5; i++) place(pallet(), -9.6 + (i % 2) * 0.03, 6.1, (i % 3) * 0.02, i * 0.145);
  shadow(-9.6, 6.1, 1.5, 1.3);

  // cuarentena: baterías dañadas aisladas sobre cubetos de retención (bajos: quedan tras la protagonista
  // desde la cámara de lectura y ordenan el centro en el descenso)
  {
    const x = 2.6;
    const z = 2.7;
    const ry = 0.2;
    const f = rot(x, z, ry);
    [-0.75, 0.75].forEach((u, i) => {
      const g = new THREE.Group();
      g.add(K.rbox(1.3, 0.3, 1.3, M.graphite, 0, 0, 0, 0.04));
      g.add(K.box(1.18, 0.02, 1.18, M.panel, 0, 0.29, 0));
      for (let k = 0; k < 9; k++) g.add(K.box(1.16, 0.025, 0.025, M.darkSteel, 0, 0.3, -0.52 + k * 0.13));
      place(g, ...f(u, 0), ry, 0, 'cubeto');
      // tres baterías dañadas por cubeto, separadas y sin apilar
      const lay = i ? [[-0.2, -0.28, -0.2], [0.25, 0.05, 0.3], [-0.2, 0.33, 0.05]] : [[-0.25, -0.3, 0.1], [0.28, -0.25, -0.15], [0, 0.3, 1.45]];
      lay.forEach(([du, dv, a]) => {
        const [bx, bz] = f(u + du, dv);
        bat(bx, 0.325, bz, ry + a, BS);
      });
    });
    hatch(x, z, 3.4, 2.0, ry, 0.42);
    const sp = new THREE.Group();
    sp.add(K.box(0.2, 0.02, 0.2, M.darkSteel, 0, 0, 0));
    sp.add(K.box(0.05, 1.15, 0.05, M.darkSteel, 0, 0, 0));
    const dm = sign('diamond', 0.34, 0.34);
    dm.position.set(0, 1.0, 0.03);
    sp.add(dm);
    place(sp, ...f(1.85, -0.75), ry, 0, 'rotulo');
    shadow(x, z, 3.0, 1.6, ry);
  }

  // ======================================================================
  // Este: bahía D de salida hacia el laboratorio (jaulas y palés listos) con transpalet
  // ======================================================================
  {
    const x = 7.0;
    const z = -0.7;
    const ry = -0.3;
    const f = rot(x, z, ry);
    cage(...f(-0.55, -0.5), ry + Math.PI, 0, 8);
    cage(...f(0.85, -0.5), ry + Math.PI, 0, 6);
    cage(...f(0.85, -0.5), ry + Math.PI, 0.98, 4);
    loadedPallet(...f(-0.55, 0.62), ry, 2);
    palletBox(...f(0.85, 0.62), ry);
    outline(...f(0.35, 0.05), 3.7, 2.5, ry);
    decal('fD', ...f(-1.2, 0.05), ry, 0.8, 0.8);
    signPost('D', ...f(1.9, -1.0), ry, 0.42, 0.42, 1.9);
    shadow(...f(0.15, 0.05), 3.2, 2.6, ry);
    // transpalet manual aparcado junto a la bahía
    const pj = new THREE.Group();
    [-0.19, 0.19].forEach((u) => pj.add(K.box(0.16, 0.07, 1.15, M.darkSteel, u, 0.02, 0.45)));
    pj.add(K.rbox(0.56, 0.26, 0.32, M.amberMatte, 0, 0.04, -0.2, 0.04));
    pj.add(cylAt(0.05, 0.05, 0.3, M.steel, 10, 0, 0.3, -0.2));
    const tiller = K.box(0.04, 1.05, 0.04, M.graphite);
    tiller.position.set(0, 0.95, -0.42);
    tiller.rotation.x = -0.35;
    pj.add(tiller);
    pj.add(K.box(0.3, 0.04, 0.05, M.graphite, 0, 1.36, -0.62));
    const w = K.cyl(0.1, 0.1, 0.08, M.rubber, 14);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.1, -0.25);
    pj.add(w);
    place(pj, ...f(-2.35, 0.2), ry + 0.5, 0, 'transpalet');
  }

  // cabeza del puente: bolardos, rótulo y balizas del borde este
  bollard(11.4, -2.8);
  bollard(10.25, -6.25);
  signPost('lab', 11.75, -1.3, -0.64, 1.0, 0.25, 2.1);
  [[11.5, 1.6], [10.7, 4.6], [9.7, -7.9]].forEach(([x, z]) => ctx.lamps.push({ x: s1.x + x, y: y0, z: s1.z + z }));

  // ======================================================================
  // v2 · Franja de descarga (oeste, x ∈ [-13, -2], z ∈ [-3,5, 3,5] locales, libre por contrato: ACCESS.west).
  // El camión de recogida llega por la calzada oeste con baterías de muchos talleres y desguaces, se detiene con
  // el morro al este y abre las puertas traseras; la carretilla (con su conductor) da la vuelta en la boca de la
  // calzada, entra con las horquillas a la altura de la caja y saca un palé de baterías de arranque, que queda a
  // media altura durante la ventana de lectura. Junto al camión, ya en el suelo, la batería de coche eléctrico en
  // su embalaje (lo primero que se descarga: viaja junto a las puertas), y dos operarios de muelle.
  // Rendimiento: lo que se mueve va compactado (una malla por material; userData.dynamic) y se construye en su pose
  // final, la de la ventana de lectura, que es la que ven la fusión y los conjuntos de luces del fragmento s1. No
  // proyecta sombra en el mapa (se genera una sola vez, en el primer fotograma): lleva su sombra de contacto.
  // ======================================================================
  // sombra de contacto difusa (la de la protagonista y la de los vehículos que se mueven): un único material
  const blobMat = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const g = c.getContext('2d');
    g.filter = 'blur(9px)';
    g.fillStyle = 'rgba(0,0,0,0.8)';
    g.beginPath();
    g.roundRect(24, 24, 208, 112, 12);
    g.fill();
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: '#000000', transparent: true, depthWrite: false });
  })();
  const blob = (w, d, x = 0, y = 0.012, z = 0) => {
    const b = new THREE.Mesh(K.geo('depBlob', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), blobMat);
    b.scale.set(w, 1, d);
    b.position.set(x, y, z);
    b.renderOrder = 1;
    b.userData.noCollide = true;
    return b;
  };
  const noCast = (g) => g.traverse((o) => o.isMesh && (o.castShadow = false));
  {
    const TX = -6.9; // centro del camión parado (local); morro al este
    const TZ = -0.5;
    const TRY = Math.PI / 2;
    // el camión arranca en la calzada, 8 m dentro de la orilla
    const T0 = ACCESS.west.shore.x - s1.x + 8;
    const src = makeTruck(M, { kind: 'recogida', loaded: true });
    const { cargo, doors, doorOpen } = src.userData;
    // el embalaje ya está en el suelo: se quita de la carga (los palés llevan userData.kind)
    [...cargo.children].forEach((o) => !o.userData.kind && cargo.remove(o));
    // los palés que quedan van 1,32 m más hacia la cabina (al hueco que deja el embalaje): junto a las puertas viaja
    // solo el palé que saca la carretilla, sin ocupar el sitio de otro
    cargo.children.forEach((o) => {
      o.position.z += 1.32;
    });
    const deckY = cargo.position.y; // suelo de carga
    const boxB = doors[0].position.z + 0.03; // trasera de la caja
    // Caja, cabina y carga restante en una malla por material, en tres versiones que comparten materiales (solo se
    // ve una): puertas cerradas (en marcha), puertas abiertas (parado; la de la lectura) y sin puertas, con las dos
    // hojas sueltas girando sobre sus bisagras mientras se abren. Así parado o en marcha son 12 dibujos, no 18.
    const swing = (k) => doors.forEach((d, i) => (d.rotation.y = doorOpen[i] * k));
    swing(0);
    const vClosed = K.compact(src);
    swing(1);
    const vOpen = K.compact(src);
    doors.forEach((d) => src.remove(d));
    const vSwing = K.compact(src);
    doors.forEach((d) => vSwing.add(d));
    const truck = new THREE.Group();
    truck.add(vClosed, vOpen, vSwing, blob(2.9, 8.9));
    noCast(truck);
    truck.userData.dynamic = true;
    const setDoors = (k) => {
      vClosed.visible = k <= 0;
      vOpen.visible = k >= 1;
      vSwing.visible = k > 0 && k < 1;
      if (vSwing.visible) swing(k);
    };

    // carretilla con su conductor; userData.forks sube y baja (y = 0: cara inferior de los brazos)
    const fl = makeForklift(M, { forkHeight: 0.2, pallet: null, driver: true, dynamic: true });
    const forks = fl.userData.forks;
    noCast(fl);
    fl.add(blob(1.6, 3.2, 0, 0.012, -0.1));
    // palé de baterías de arranque (fleje y tapas en los bornes), girado 90°: los brazos entran por su costado de 0,8 m,
    // por las entalladuras de sus tacos (palé de cuatro entradas, actors.js · palletBase). Sobre los brazos como el de
    // makeForklift: 6 cm por debajo de su cara inferior, centrado a 1,78 m del origen de la carretilla (su base toca el
    // talón de los brazos sin meterse en el tablero)
    const pal = makePallet(M, { kind: 'plomo', dynamic: true, across: true });
    noCast(pal);
    const REACH = 1.78;
    const PAL_DY = -0.06;
    // centro del palé dentro de la caja (z local del camión): a 9 cm de la trasera, para que al cogerlo el mástil
    // quede 3 cm por detrás del travesaño trasero del suelo de carga
    const palInTruck = boxB + 0.69;
    const palInTruckX = TX + palInTruck;
    // recorrido de la carretilla (origen en el suelo, frente hacia +z local): espera al sur del camión mirando al
    // oeste, se arrima 30 cm al camión mientras avanza, gira en la boca de la calzada (radio 1,35 m: con 1,5 m el
    // contrapeso, que se abre en el giro, pisaba el bordillo y la bionda de la calzada) y vuelve hacia el este por
    // detrás del camión. Sube las horquillas a la altura del suelo de carga en la segunda mitad del giro, con las
    // puntas aún fuera de la caja, y entra recto
    const W = [-8.4, 2.5];
    const R = 1.35;
    const CX = -13.6;
    const CZ = TZ + R; // el giro acaba en el eje del camión
    const pickX = palInTruckX - REACH;
    const holdX = pickX - 1.45;
    const L1 = W[0] - CX;
    const L2 = Math.PI * R;
    const L3 = pickX - CX;
    const L4 = pickX - holdX;
    const LT = L1 + L2 + L3 + L4;
    const hDrive = 0.2;
    const hPick = deckY - PAL_DY; // el palé apoyado en el suelo de carga
    const hLift = hPick + 0.07;
    const hHold = 0.9; // a media altura durante la lectura
    const smooth = (u) => u * u * (3 - 2 * u);
    const clamp01 = (u) => Math.min(1, Math.max(0, u));
    const pose = { x: 0, z: 0, ry: 0, h: 0, held: false };
    // s ∈ [0, 1] a lo largo del recorrido → pose (velocidad uniforme; arranca y para con suavidad)
    const flPose = (s) => {
      let d = smooth(clamp01(s)) * LT;
      if (d <= L1) {
        // cambio de carril suave de z = W[1] (espera) a z = CZ + R (entrada del giro); rumbo según la tangente
        const u = d / L1;
        const dz = CZ + R - W[1];
        Object.assign(pose, { x: W[0] - d, z: W[1] + dz * smooth(u), ry: Math.atan2(-1, (dz * 6 * u * (1 - u)) / L1), h: hDrive, held: false });
      } else if ((d -= L1) <= L2) {
        const th = d / R;
        const up = smooth(clamp01((2 * th) / Math.PI - 1));
        Object.assign(pose, { x: CX - R * Math.sin(th), z: CZ + R * Math.cos(th), ry: Math.atan2(-Math.cos(th), -Math.sin(th)), h: hDrive + (hPick - hDrive) * up, held: false });
      } else if ((d -= L2) <= L3) {
        // de frente hacia la caja, con las horquillas ya a la altura del suelo de carga
        Object.assign(pose, { x: CX + d, z: CZ - R, ry: Math.PI / 2, h: hPick, held: false });
      } else {
        // levanta 7 cm en el sitio, sale marcha atrás hasta que el palé queda fuera de la caja y lo baja a media altura
        const k = (d - L3) / L4;
        const lift = clamp01(k / 0.2);
        const back = smooth(clamp01((k - 0.2) / 0.6));
        const lower = smooth(clamp01((k - 0.8) / 0.2));
        Object.assign(pose, { x: pickX - L4 * back, z: CZ - R, ry: Math.PI / 2, h: hPick + (hLift - hPick) * lift + (hHold - hLift) * lower, held: lift > 0 });
      }
      return pose;
    };
    place(truck, TX, TZ, TRY, 0, 'camionRecogida');
    place(fl, holdX, CZ - R, Math.PI / 2, 0, 'carretilla');
    place(pal, palInTruckX, TZ, TRY + Math.PI / 2, deckY, 'paleDescarga');
    // Pose de lectura (la carretilla quieta con el palé a media altura): carretilla, horquillas, palé y sombra en
    // una sola pieza rígida, una malla por material (16 dibujos en lugar de 19). Solo se ve con m = 1.
    const flHold = (() => {
      const g = makeForklift(M, { forkHeight: hHold, pallet: null, driver: true });
      const p2 = makePallet(M, { kind: 'plomo', across: true });
      p2.position.set(0, hHold + PAL_DY, REACH);
      p2.rotation.y = Math.PI / 2;
      g.add(p2, blob(1.6, 3.2, 0, 0.012, -0.1));
      const c = K.compact(g);
      noCast(c);
      c.children.forEach((o) => o.material === blobMat && (o.renderOrder = 1));
      c.userData.dynamic = true;
      return c;
    })();
    place(flHold, holdX, CZ - R, Math.PI / 2, 0, 'carretillaLectura');

    // m ∈ [0, 1]: llegada del camión (0 → 0,5), puertas (0,5 → 0,6) y carretilla (0,58 → 1)
    // por la calzada va por su carril (el derecho, al sur del eje z = 14) y se cambia al centro antes de entrar
    const LANE = ACCESS.west.rim.z - s1.z + ACCESS.west.width / 4;
    const laneZ = (a) => LANE + (TZ - LANE) * smooth(clamp01((a - 0.55) / 0.25));
    // rasante de la calzada (environment.js): 1,5 cm sobre el suelo de la isla en su borde y sube recta hasta el
    // firme de la orilla (8 cm sobre la tierra firme)
    const RIM = ACCESS.west.rim.x - s1.x + 0.5;
    const SHORE = ACCESS.west.shore.x - s1.x;
    const roadY = (x) => (x >= RIM ? 0 : 0.015 + (ACCESS.west.shore.y + 0.08 - y0 - 0.015) * clamp01((RIM - x) / (RIM - SHORE)));
    const apply = (m) => {
      const a = smooth(clamp01(m / 0.5));
      const tx = T0 + (TX - T0) * a;
      const tz = laneZ(a);
      // rumbo: tangente de la trayectoria (pequeño giro durante el cambio de carril)
      const yaw = TRY - Math.atan2(laneZ(a + 0.002) - laneZ(a - 0.002), (TX - T0) * 0.004);
      truck.position.set(s1.x + tx, y0 + roadY(tx), s1.z + tz);
      truck.rotation.y = yaw;
      setDoors(smooth(clamp01((m - 0.5) / 0.1)));
      const p = flPose((m - 0.58) / 0.42);
      const hold = m >= 1;
      flHold.visible = hold;
      fl.visible = !hold;
      pal.visible = !hold;
      fl.position.set(s1.x + p.x, y0 + roadY(p.x), s1.z + p.z);
      fl.rotation.y = p.ry;
      forks.position.y = p.h;
      if (p.held) {
        pal.position.set(fl.position.x + Math.sin(p.ry) * REACH, fl.position.y + p.h + PAL_DY, fl.position.z + Math.cos(p.ry) * REACH);
        pal.rotation.y = p.ry + Math.PI / 2;
      } else {
        // dentro de la caja: viaja con el camión
        pal.position.set(truck.position.x + Math.sin(yaw) * palInTruck, truck.position.y + deckY, truck.position.z + Math.cos(yaw) * palInTruck);
        pal.rotation.y = yaw + Math.PI / 2;
      }
    };
    // estado final (pose de lectura) para la fusión y los conjuntos de luces
    apply(1);

    // Avance ligado al recorrido: 0 en la portada; en CH.recogida sube en el último tramo antes de la ventana de
    // lectura y llega a 1 al entrar en ella (y después). Un seguimiento suave (0,25 s) cubre el cambio de índice a
    // mitad del tramo y los saltos del menú; con movimiento reducido, estado final. Solo se recoloca si cambia.
    const target = (story) => {
      if (!story || story.reduced || story.index > CH.recogida) return 1;
      if (story.index < CH.recogida) return 0;
      return clamp01((story.local + 1.0) / 0.95);
    };
    let m = -1;
    let shown = -1;
    ctx.anim((t, dt, story) => {
      const goal = target(story);
      if (m < 0 || story?.reduced) m = goal;
      else m += (goal - m) * (1 - Math.exp(-dt / 0.25));
      if (Math.abs(goal - m) < 2e-4) m = goal;
      if (Math.abs(m - shown) < 1e-5) return;
      shown = m;
      apply(m);
    });
  }
  // la batería de coche eléctrico en su embalaje, ya en el suelo al sur del camión (paralela a él), y los dos
  // operarios de muelle: uno junto al embalaje, de espaldas al patio, y otro en la esquina trasera guiando a la
  // carretilla (fuera del barrido de la hoja derecha de las puertas traseras, que gira 1,28 m alrededor de su
  // bisagra, en (-11,18, -1,78), mientras se abren)
  place(makeEVCrate(M), -4.9, 2.3, Math.PI / 2, 0, 'embalajeVE');
  shadow(-4.9, 2.3, 2.6, 1.9);
  place(makePerson(M, { role: 'muelle', pose: 'look' }), -4.5, 3.55, Math.PI - 0.15, 0, 'operarioMuelle');
  shadow(-4.5, 3.55, 0.7, 0.5);
  place(makePerson(M, { role: 'muelle', pose: 'stand' }), -11.55, -3.38, Math.atan2(-2.02, 2.88), 0, 'operarioMuelle');
  shadow(-11.55, -3.38, 0.7, 0.5);
  // bahía de descarga: líneas discontinuas a ambos lados del camión
  dashed(-12.4, -2.0, -2.6, -2.0, 0.6, 0.4, 0.08, M.amberMatte);
  dashed(-12.4, 1.05, -2.6, 1.05, 0.6, 0.4, 0.08, M.amberMatte);

  // ======================================================================
  // Borde sur: arbustos, matas y un arbolillo en primer plano del descenso y la aproximación
  // ======================================================================
  {
    const pts = [];
    // sin arbolillo: quedaba junto al titular en la ventana de lectura; solo matas bajas junto al bordillo
    [[88, 12.2, 1.1, 'shrub'], [94, 12.0, 0.9, 'low'], [100, 12.1, 1.3, 'shrub'], [104, 11.6, 1.0, 'shrub'], [91, 12.3, 0.9, 'shrub'], [97, 12.4, 1.0, 'shrub'],
      [86, 11.6, 1.0, 'low'], [90, 11.7, 1.2, 'low'], [96, 11.9, 1.1, 'low'], [102, 12.4, 1.0, 'low'], [106, 12.2, 1.2, 'low']].forEach(([deg, r, s, kind]) => {
      const a = (deg * Math.PI) / 180;
      pts.push({ x: s1.x + Math.cos(a) * r, y: y0, z: s1.z + Math.sin(a) * r, s, kind });
    });
    const veg = K.scatterTrees(M, pts);
    veg.name = 'vegetacion';
    ctx.add(veg);
  }

  // ======================================================================
  // Batería protagonista sobre una peana con anillo lima (anclas fijas de cámara)
  // ======================================================================
  const heroPos = new THREE.Vector3(s1.x + 7, s1.y, s1.z + 7);
  // giro de la protagonista (ancla de cámara): la sombra de contacto y el foco se derivan de él, de modo
  // que reorientar la cara del QR solo exige cambiar este valor (y los nudos de cámara del capítulo)
  const HERO_RY = -0.98; // la cara del QR mira al interior del patio, hacia la cámara del capítulo 1
  const plinth = K.cyl(2.8, 3, 0.35, M.plinthConcrete, 64);
  plinth.position.set(heroPos.x, heroPos.y + 0.17, heroPos.z);
  plinth.name = 'plinth';
  ctx.add(plinth);
  // anillo lima contenido: se lee como filete luminoso, no como halo
  const ringMat = new THREE.MeshStandardMaterial({ color: '#C2F230', emissive: '#C2F230', emissiveIntensity: 0.4, roughness: 0.5 });
  const heroRing = new THREE.Mesh(new THREE.TorusGeometry(2.74, 0.035, 8, 128), ringMat);
  heroRing.rotation.x = Math.PI / 2;
  heroRing.position.set(heroPos.x, heroPos.y + 0.352, heroPos.z);
  heroRing.name = 'heroRing';
  ctx.add(heroRing);
  const hero = K.makeBattery(M, { scale: 2.1 });
  hero.position.set(heroPos.x, heroPos.y + 0.345, heroPos.z);
  hero.rotation.y = HERO_RY;
  hero.name = 'hero';
  ctx.add(hero);
  ctx.shadows.push({ x: heroPos.x, y: heroPos.y + 0.345, z: heroPos.z, w: 4.4, d: 2.8, r: HERO_RY });
  {
    const contact = blob(4.3, 2.9, heroPos.x, heroPos.y + 0.354, heroPos.z);
    contact.rotation.y = HERO_RY;
    ctx.add(contact);
  }
  // foco blanco cálido casi neutro delante de la cara del QR: la carcasa sigue siendo grafito y la línea, lima
  const heroSpot = new THREE.SpotLight('#fff0dc', 70, 18, 0.5, 0.6, 1.5);
  heroSpot.position.set(heroPos.x + Math.sin(HERO_RY) * 5.83, heroPos.y + 9, heroPos.z + Math.cos(HERO_RY) * 5.83);
  heroSpot.target.position.copy(heroPos);
  ctx.add(heroSpot);
  ctx.add(heroSpot.target);

  // ---------- baterías instanciadas ----------
  const inst = K.batteryInstances(M, bats);
  inst.name = 'baterias';
  ctx.add(inst);
}
