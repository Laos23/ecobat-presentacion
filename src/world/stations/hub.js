import * as THREE from 'three';

// 6 · Centro de trazabilidad: plaza circular con gradas concéntricas, pasaporte digital, pantallas curvas,
// baterías expuestas sobre zócalos, jardineras y bancos. Referencia: context/ref-centro-final.png.
export const HUB_FACE = 0.93; // la pantalla mira hacia el este, de cara a la cámara que contempla el mundo detrás

const D2R = Math.PI / 180;
const LIME = '#C2F230';
const AMBER = '#E5AE50';
const IVORY = '#F1EEE6';
const F_TAG = '700 20px "Archivo Variable", sans-serif';
const F_STEP = '600 25px "Archivo Variable", sans-serif';
const F_TITLE = '800 34px "Archivo Variable", sans-serif';
const F_SUB = '500 20px "Archivo Variable", sans-serif';
const F_HEAD = '600 21px "Archivo Variable", sans-serif';
const F_SMALL = '500 15px "Archivo Variable", sans-serif';
const F_COUNT = '700 20px "Archivo Variable", sans-serif';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// Pasos del pasaporte: mismos umbrales que la línea de tiempo del texto (main.js, conn > i · 0,22).
const STEPS = ['Registro y QR', 'Diagnóstico', 'Ruta validada', 'Destino documentado'];
const stepOn = (i, conn) => (i ? smooth(i * 0.22 - 0.008, i * 0.22 + 0.02, conn) : smooth(0, 0.02, conn));
// Cada arco del mundo hacia la estación i avanza con (conn − 0,1 i) / 0,5 (world.js).
const arcAt = (i, conn) => clamp01((conn - i * 0.1) / 0.5);
// Estado final estable para movimiento reducido.
const FINAL = { conn: 1, index: 6, reduced: true };

// ---------- Pantallas vivas (canvas) ----------

// Halo dibujado en el propio lienzo: la pantalla es solo emisiva y no depende del bloom para brillar.
const GLOW_LIME = 'rgba(194,242,48,0.55)';
const GLOW_AMBER = 'rgba(229,174,80,0.5)';
const glow = (g, color, blur) => {
  g.shadowColor = color;
  g.shadowBlur = blur;
};
const noGlow = (g) => {
  g.shadowBlur = 0;
};

// fx: { scan: −1 inactivo o 0..1 (barrido en curso), flash: 0..1 (confirmación) }, lo gobierna buildHub.
function drawPassport(qr, fx) {
  let bg = null;
  let trail = null;
  let ecoW = 0;
  const ys = [452, 516, 580, 644];
  const bars = [0.8, 0.55, 0.7, 0.95];
  return (g, w, h, t, story) => {
    const conn = story ? story.conn : 0;
    if (!bg) {
      bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#151819');
      bg.addColorStop(1, '#0a0b0c');
      // estela del barrido: degradado reutilizable que se desplaza con la línea
      trail = g.createLinearGradient(0, -54, 0, 0);
      trail.addColorStop(0, 'rgba(194,242,48,0)');
      trail.addColorStop(1, 'rgba(194,242,48,0.3)');
      g.font = F_TAG;
      ecoW = g.measureText('Eco').width;
    }
    // el borde lima es físico (listones del monolito): el lienzo no repite el marco
    g.globalAlpha = 1;
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // cabecera: marca y matrícula de la batería
    g.font = F_TAG;
    g.textAlign = 'left';
    g.fillStyle = IVORY;
    g.fillText('Eco', 40, 66);
    g.fillStyle = LIME;
    g.fillText('Bat', 40 + ecoW, 66);
    g.textAlign = 'right';
    g.globalAlpha = 0.7;
    g.fillStyle = IVORY;
    g.fillText('ECB-0427', w - 40, 66);
    g.globalAlpha = 0.14;
    g.fillRect(40, 86, w - 80, 2);
    g.globalAlpha = 1;
    // icono de batería (silueta de ref-bateria.png) con el QR dentro; el halo lima va en el lienzo
    glow(g, GLOW_LIME, 12);
    g.strokeStyle = LIME;
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(106, 170, 300, 214, 16);
    g.stroke();
    g.lineWidth = 3;
    g.globalAlpha = 0.7;
    g.beginPath();
    g.moveTo(112, 204);
    g.lineTo(400, 204);
    g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(180, 132, 16, 38, 4);
    g.roundRect(316, 132, 16, 38, 4);
    g.roundRect(170, 118, 172, 20, 8);
    g.stroke();
    g.fillStyle = LIME;
    g.fillRect(222, 122, 68, 12);
    g.fillRect(128, 154, 34, 16);
    g.fillRect(350, 154, 34, 16);
    noGlow(g);
    // placa del QR algo más oscura: el código se multiplica sobre ella y se lee nítido sin deslumbrar
    g.fillStyle = '#cfcac0';
    g.beginPath();
    g.roundRect(194, 224, 124, 124, 8);
    g.fill();
    g.globalCompositeOperation = 'multiply';
    g.drawImage(qr, 200, 230, 112, 112);
    g.globalCompositeOperation = 'source-over';
    // escaneo breve en la lectura: una línea lima recorre el icono y el QR una sola vez
    if (fx.scan >= 0) {
      const e = fx.scan * fx.scan * (3 - 2 * fx.scan);
      const y = 112 + e * 292;
      g.globalAlpha = Math.min(1, fx.scan * 7, (1 - fx.scan) * 7);
      g.setTransform(1, 0, 0, 1, 0, y);
      g.fillStyle = trail;
      g.fillRect(100, -54, 312, 54);
      glow(g, GLOW_LIME, 14);
      g.fillStyle = LIME;
      g.fillRect(92, -2, 328, 4);
      noGlow(g);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
    }
    // confirmación: el marco del QR se enciende y se apaga tras el barrido
    if (fx.flash > 0.01) {
      glow(g, GLOW_LIME, 10);
      g.strokeStyle = LIME;
      g.lineWidth = 4;
      g.globalAlpha = fx.flash;
      g.beginPath();
      g.roundRect(188, 218, 136, 136, 11);
      g.stroke();
      noGlow(g);
      g.globalAlpha = 1;
    }
    // línea de tiempo vertical: los pasos se encienden con el avance
    const fill = clamp01(conn / 0.71);
    g.fillStyle = LIME;
    g.globalAlpha = 0.22;
    g.fillRect(62, ys[0], 4, ys[3] - ys[0]);
    g.globalAlpha = 1;
    glow(g, GLOW_LIME, 8);
    g.fillRect(62, ys[0], 4, (ys[3] - ys[0]) * fill);
    noGlow(g);
    g.font = F_STEP;
    g.textAlign = 'left';
    for (let i = 0; i < 4; i++) {
      const k = stepOn(i, conn);
      g.fillStyle = '#0c0e0f';
      g.beginPath();
      g.arc(64, ys[i], 13, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = LIME;
      g.lineWidth = 4;
      g.globalAlpha = 0.35 + 0.65 * k;
      g.stroke();
      if (k > 0.01) {
        glow(g, GLOW_LIME, 9 * k);
        g.fillStyle = LIME;
        g.beginPath();
        g.arc(64, ys[i], 6.5 * k, 0, Math.PI * 2);
        g.fill();
        noGlow(g);
      }
      g.globalAlpha = 0.32 + 0.68 * k;
      g.fillStyle = IVORY;
      g.fillText(STEPS[i], 96, ys[i] + 9);
      g.globalAlpha = 0.85 * k;
      g.fillStyle = AMBER;
      g.fillRect(96, ys[i] + 20, 150 * bars[i] * k, 5);
      g.globalAlpha = 1;
    }
    g.textAlign = 'center';
    g.fillStyle = IVORY;
    g.font = F_TITLE;
    g.fillText('Pasaporte EcoBat', w / 2, 712);
    g.globalAlpha = 0.6;
    g.font = F_SUB;
    g.fillText('Prototipo académico', w / 2, 740);
    g.globalAlpha = 1;
  };
}

function drawHistory() {
  // Gráfico de línea ámbar: el historial se dibuja a medida que avanza el capítulo.
  // Curva, cursor e indicador caben en los dos tercios izquierdos, que la cámara de lectura ve enteros; el resumen
  // de la derecha puede quedar tras el monolito sin que se pierda el mensaje.
  const N = 96;
  const X0 = 40;
  const X1 = 390;
  const ys = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    ys[i] = 182 - 52 * Math.sin(u * Math.PI * 3.2 - 0.9) * (0.55 + 0.45 * u) - 34 * u + 8 * Math.sin(u * 23);
  }
  const ev = [0.06, 0.28, 0.5, 0.72, 0.94];
  const labels = ['Recogida', 'Taller', 'Diagnóstico', 'Clasificación', 'Reciclaje'];
  const counts = ['0/5', '1/5', '2/5', '3/5', '4/5', '5/5'];
  const yAt = (u) => {
    const f = clamp01(u) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return ys[i] + (ys[i + 1] - ys[i]) * (f - i);
  };
  return (g, w, h, t, story) => {
    const conn = story ? story.conn : 0;
    const end = clamp01(conn / 0.9);
    g.globalAlpha = 1;
    g.fillStyle = '#0e1011';
    g.fillRect(0, 0, w, h);
    g.fillStyle = AMBER;
    g.globalAlpha = 0.13;
    for (let k = 0; k <= 8; k++) g.fillRect(X0 + ((X1 - X0) * k) / 8 - 0.75, 58, 1.5, 184);
    for (let y = 58; y <= 242; y += 46) g.fillRect(X0, y, X1 - X0, 1.5);
    g.globalAlpha = 0.8;
    g.font = F_HEAD;
    g.textAlign = 'left';
    g.fillStyle = IVORY;
    g.fillText('Historial de estado', 24, 38);
    g.textAlign = 'right';
    g.fillStyle = AMBER;
    g.fillText('ECB-0427', w - 24, 38);
    // indicador vertical del último valor registrado, pegado a la gráfica
    g.globalAlpha = 0.16;
    g.fillRect(410, 62, 16, 176);
    g.globalAlpha = 0.9;
    const lvl = end > 0.002 ? clamp01((242 - yAt(end)) / 184) : 0;
    g.fillRect(410, 238 - 176 * lvl, 16, 176 * lvl);
    g.globalAlpha = 1;
    if (end > 0.002) {
      const last = Math.max(1, Math.round(end * N));
      g.lineJoin = 'round';
      g.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = AMBER;
        g.lineWidth = pass ? 4.5 : 13;
        g.globalAlpha = pass ? 1 : 0.18;
        if (pass) glow(g, GLOW_AMBER, 10);
        g.beginPath();
        for (let i = 0; i <= last; i++) {
          const x = X0 + ((X1 - X0) * Math.min(i / N, end));
          const y = i === last ? yAt(end) : ys[i];
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
      noGlow(g);
      g.globalAlpha = 1;
      // cursor del último registro con un pulso suave
      const cx = X0 + (X1 - X0) * end;
      const cy = yAt(end);
      g.globalAlpha = 0.22;
      g.fillRect(cx - 1, 58, 2, 184);
      const pulse = story && !story.reduced ? (t * 0.8) % 1 : 0;
      g.globalAlpha = 0.6 * (1 - pulse);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, 7 + pulse * 12, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = IVORY;
      g.beginPath();
      g.arc(cx, cy, 5, 0, Math.PI * 2);
      g.fill();
    }
    // hitos del recorrido sobre la curva y en la línea inferior (rótulos alternos arriba y abajo)
    g.font = F_SMALL;
    g.textAlign = 'center';
    g.fillStyle = IVORY;
    g.globalAlpha = 0.2;
    g.fillRect(X0, 289, X1 - X0, 2);
    g.globalAlpha = 1;
    g.fillStyle = AMBER;
    g.fillRect(X0, 289, (X1 - X0) * end, 2);
    let reached = 0;
    for (let i = 0; i < 5; i++) {
      if (end >= ev[i]) reached++;
      const k = smooth(ev[i] - 0.02, ev[i], end);
      const x = X0 + (X1 - X0) * ev[i];
      if (k > 0.01) {
        g.globalAlpha = k;
        g.fillStyle = AMBER;
        g.beginPath();
        g.arc(x, ys[Math.round(ev[i] * N)], 6.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#0e1011';
        g.beginPath();
        g.arc(x, ys[Math.round(ev[i] * N)], 2.5, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#0e1011';
      g.beginPath();
      g.arc(x, 290, 8, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = AMBER;
      g.lineWidth = 3;
      g.globalAlpha = 0.35 + 0.65 * k;
      g.stroke();
      g.fillStyle = AMBER;
      g.globalAlpha = k;
      g.beginPath();
      g.arc(x, 290, 4.5, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.35 + 0.55 * k;
      g.fillStyle = IVORY;
      g.fillText(labels[i], x, i % 2 ? 274 : 322);
    }
    // resumen: último hito alcanzado y registros del pasaporte
    g.textAlign = 'left';
    g.font = F_SMALL;
    g.fillStyle = IVORY;
    g.globalAlpha = 0.6;
    g.fillText('Último hito', 466, 92);
    g.fillText('Registros', 466, 176);
    g.globalAlpha = 0.14;
    g.fillRect(466, 140, 150, 2);
    g.globalAlpha = 1;
    g.font = F_HEAD;
    g.fillStyle = AMBER;
    g.fillText(reached ? labels[reached - 1] : '—', 466, 120);
    g.font = F_COUNT;
    g.fillStyle = IVORY;
    g.fillText(counts[reached], 466, 204);
    g.fillStyle = AMBER;
    for (let i = 0; i < 5; i++) {
      g.globalAlpha = i < reached ? 0.9 : 0.16;
      g.fillRect(466 + i * 31, 222, 25, 6);
    }
    g.globalAlpha = 1;
  };
}

function drawNetwork() {
  // red de trazabilidad (nodos que se encienden con los arcos del mundo), barras y anillo de pasos.
  // La red va a la derecha: es la parte que la cámara de lectura ve entera junto al monolito.
  const HX = 482;
  const HY = 200;
  const angs = [-150, -96, -38, 22, 84, 146].map((a) => a * D2R);
  const rads = [100, 92, 104, 98, 90, 104];
  const nx = angs.map((a, i) => HX + Math.cos(a) * rads[i]);
  const ny = angs.map((a, i) => HY + Math.sin(a) * rads[i] * 0.86);
  const vals = [0.36, 0.52, 0.45, 0.66, 0.8, 0.94];
  const rows = [0.92, 0.64, 0.78];
  const counts = ['0/4', '1/4', '2/4', '3/4', '4/4'];
  return (g, w, h, t, story) => {
    const conn = story ? story.conn : 0;
    const live = story && !story.reduced;
    g.globalAlpha = 1;
    g.fillStyle = '#0e1011';
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.8;
    g.font = F_HEAD;
    g.textAlign = 'right';
    g.fillStyle = IVORY;
    g.fillText('Red de trazabilidad', w - 24, 38);
    g.globalAlpha = 1;
    // enlaces secundarios entre estaciones vecinas
    g.strokeStyle = LIME;
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      g.globalAlpha = 0.1 + 0.25 * arcAt(i + 1, conn);
      g.beginPath();
      g.moveTo(nx[i], ny[i]);
      g.lineTo(nx[i + 1], ny[i + 1]);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const k = i < 5 ? arcAt(i, conn) : smooth(0.9, 0.97, conn);
      g.lineWidth = 3;
      g.globalAlpha = 0.16;
      g.beginPath();
      g.moveTo(HX, HY);
      g.lineTo(nx[i], ny[i]);
      g.stroke();
      if (k > 0.001) {
        g.globalAlpha = 1;
        glow(g, GLOW_LIME, 8);
        g.beginPath();
        g.moveTo(HX, HY);
        g.lineTo(HX + (nx[i] - HX) * k, HY + (ny[i] - HY) * k);
        g.stroke();
        noGlow(g);
      }
      const on = k >= 1 ? 1 : 0;
      if (on && live) {
        // halo que respira en secuencia por la red: lento, se ve continuo aunque se redibuje a 8 fps
        const b = 0.5 + 0.5 * Math.sin(t * 1.25 - i * 1.05);
        g.globalAlpha = 0.12 + 0.3 * b;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(nx[i], ny[i], 18 + 4 * b, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = '#0e1011';
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(nx[i], ny[i], 13, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 3.5;
      g.globalAlpha = 0.3 + 0.7 * on;
      if (on) glow(g, GLOW_LIME, 9);
      g.stroke();
      if (on) {
        g.fillStyle = LIME;
        g.beginPath();
        g.arc(nx[i], ny[i], 6, 0, Math.PI * 2);
        g.fill();
      }
      noGlow(g);
    }
    // hexágono central: el pasaporte
    g.globalAlpha = 1;
    g.fillStyle = '#0e1011';
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const x = HX + Math.cos(a) * 36;
      const y = HY + Math.sin(a) * 36;
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
    g.fill();
    g.lineWidth = 4.5;
    glow(g, GLOW_LIME, 12);
    g.stroke();
    g.fillStyle = LIME;
    g.globalAlpha = 0.25 + 0.75 * smooth(0, 0.05, conn);
    g.fillRect(HX - 13, HY - 9, 26, 18);
    noGlow(g);
    g.globalAlpha = 1;
    // barras: baterías documentadas por etapa (ilustrativo)
    g.fillStyle = IVORY;
    g.font = F_SMALL;
    g.textAlign = 'left';
    g.globalAlpha = 0.65;
    g.fillText('Baterías trazadas', 160, 74);
    g.globalAlpha = 0.2;
    g.fillRect(160, 190, 186, 2);
    for (let i = 0; i < 6; i++) {
      const gk = smooth(0.12 + i * 0.09, 0.42 + i * 0.09, conn);
      const bh = vals[i] * 96 * gk;
      g.fillStyle = LIME;
      g.globalAlpha = i === 5 ? 1 : 0.5;
      g.fillRect(166 + i * 30, 188 - bh, 20, bh);
    }
    // anillo: pasos del pasaporte completados
    let done = 0;
    for (let i = 0; i < 4; i++) done += stepOn(i, conn);
    g.globalAlpha = 1;
    g.lineWidth = 11;
    g.strokeStyle = 'rgba(241,238,230,0.14)';
    g.beginPath();
    g.arc(196, 282, 30, 0, Math.PI * 2);
    g.stroke();
    if (done > 0.01) {
      g.strokeStyle = AMBER;
      g.beginPath();
      g.arc(196, 282, 30, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * done) / 4);
      g.stroke();
    }
    g.fillStyle = IVORY;
    g.font = F_COUNT;
    g.textAlign = 'center';
    g.fillText(counts[Math.round(done)], 196, 289);
    g.textAlign = 'left';
    g.font = F_SMALL;
    g.globalAlpha = 0.65;
    g.fillText('Pasos', 242, 268);
    for (let i = 0; i < 3; i++) {
      g.globalAlpha = 0.16;
      g.fillRect(242, 280 + i * 14, 100, 6);
      g.globalAlpha = 0.9;
      g.fillStyle = i === 1 ? AMBER : LIME;
      g.fillRect(242, 280 + i * 14, 100 * rows[i] * smooth(0.5 + i * 0.1, 0.8 + i * 0.06, conn), 6);
      g.fillStyle = IVORY;
    }
    g.globalAlpha = 1;
  };
}

// ---------- Geometría auxiliar ----------

// Pantalla solo emisiva: fondo negro profundo y grafismo nítido. Sin color difuso, las luces de la plaza
// no la lavan ni empujan el texto por encima del umbral del bloom.
function emissiveOnly(mesh, intensity = 0.98) {
  mesh.material.color.setHex(0x000000);
  mesh.material.emissiveIntensity = intensity;
  mesh.material.roughness = 0.6;
  return mesh;
}

// Sector de corona centrado en el origen (ángulos polares del mundo en grados, extrusión hacia +y).
function arcGeo(K, r0, r1, a0, a1, h) {
  return K.geo(`hubArc|${r0}|${r1}|${a0}|${a1}|${h}`, () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, -a0 * D2R, -a1 * D2R, true);
    s.absarc(0, 0, r0, -a1 * D2R, -a0 * D2R, false);
    s.closePath();
    const seg = Math.max(4, Math.round((Math.abs(a1 - a0) * D2R * r1) / 0.5));
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: seg });
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

// Tira luminosa en arco (toro parcial tumbado), con el mismo convenio de ángulos.
function ringGeo(K, r, tube, a0, a1) {
  const arc = (a1 - a0) * D2R;
  const g = K.geo(`hubRing|${r}|${tube}|${a1 - a0}`, () => new THREE.TorusGeometry(r, tube, 4, Math.max(8, Math.round(arc * r * 3)), arc).rotateX(Math.PI / 2));
  return { g };
}

// Curva una geometría alrededor de un eje vertical situado en z = R: queda cóncava hacia +z.
function bend(g, R) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / R;
    const rho = R - p.getZ(i);
    p.setXYZ(i, rho * Math.sin(a), p.getY(i), R - rho * Math.cos(a));
  }
  g.computeVertexNormals();
  return g;
}

export function buildHub(ctx) {
  const { K, M, T, STATIONS } = ctx;
  const s6 = STATIONS.s6;
  const Y = s6.y;
  const pol = (a, r) => [s6.x + Math.cos(a * D2R) * r, s6.z + Math.sin(a * D2R) * r];
  // rotación y que orienta el +z local hacia el centro de la plaza
  const faceIn = (a) => Math.atan2(-Math.cos(a * D2R), -Math.sin(a * D2R));
  const mesh = (g, mat, x = s6.x, y = Y, z = s6.z, ry = 0) => {
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    return ctx.add(m);
  };
  // Los sectores largos se trocean (≤ 12°): sus cajas envolventes no invaden el canto de la isla, donde
  // edges.js coloca bordillo, barandilla y balizas solo si no hay nada de las estaciones.
  const pieces = (a0, a1) => Math.max(1, Math.ceil((a1 - a0) / 12));
  const arc = (r0, r1, a0, a1, h, mat, y = Y) => {
    const n = pieces(a0, a1);
    const da = (a1 - a0) / n;
    const g = arcGeo(K, r0, r1, 0, da, h);
    for (let k = 0; k < n; k++) mesh(g, mat, s6.x, y, s6.z, -(a0 + k * da) * D2R);
  };
  const ring = (r, tube, a0, a1, mat, y) => {
    const n = a1 - a0 >= 360 ? 1 : pieces(a0, a1);
    const da = (a1 - a0) / n;
    const { g } = ringGeo(K, r, tube, 0, da);
    for (let k = 0; k < n; k++) mesh(g, mat, s6.x, y, s6.z, -(a0 + k * da) * D2R);
  };
  const shrubs = [];

  // ---------- Podio escalonado y anillo lima (anclas de cámara) ----------
  ctx.add(K.cyl(4.6, 4.8, 0.3, M.concreteLight, 64).translateX(s6.x).translateY(Y + 0.15).translateZ(s6.z));
  ctx.add(K.cyl(3.6, 3.7, 0.3, M.concreteLight, 64).translateX(s6.x).translateY(Y + 0.45).translateZ(s6.z));
  // anillo lima embutido en la cara superior del escalón bajo (sobresale 2 cm, no flota sobre el canto)
  const podRing = new THREE.Mesh(new THREE.TorusGeometry(4.56, 0.022, 6, 160), M.lime);
  podRing.rotation.x = Math.PI / 2;
  podRing.position.set(s6.x, Y + 0.3, s6.z);
  ctx.add(podRing);
  // tira ámbar bajo el canto del escalón superior y zócalo oscuro que despega el podio del suelo
  ring(3.635, 0.02, 0, 360, M.amberGlow, Y + 0.53);
  ring(4.8, 0.035, 0, 360, M.darkSteel, Y + 0.035);

  // ---------- Pasaporte digital: monolito con marco claro, bordes lima y alas ámbar ----------
  const FACE = HUB_FACE;
  const passport = new THREE.Group();
  passport.add(K.rbox(4.2, 0.2, 1.0, M.concreteLight, 0, 0, -0.04, 0.05));
  // marco claro satinado (ref-centro-final): sin el cepillado del acero, que en grande se leía a rayas
  passport.add(K.rbox(3.7, 5.6, 0.46, M.stoneTop, 0, 0.2, 0, 0.07));
  // bisel satinado entre marco y pantalla: el vidrio brillante reflejaba la luz de la plaza como un destello
  passport.add(K.box(3.36, 5.0, 0.03, M.graphite, 0, 0.52, 0.226));
  const fx = { scan: -1, flash: 0 };
  const live = {
    pass: T.liveScreen(512, 768, drawPassport(T.qrLabelTexture(23).image, fx), 12),
    hist: T.liveScreen(640, 360, drawHistory(), 12),
    net: T.liveScreen(640, 360, drawNetwork(), 12),
  };
  const pscreen = emissiveOnly(K.screen(live.pass.texture, 3.1, 4.65));
  pscreen.position.set(0, 3.02, 0.245);
  passport.add(pscreen);
  // bordes lima luminosos alrededor de la pantalla
  [-1, 1].forEach((sx) => passport.add(K.box(0.035, 4.76, 0.024, M.lime, sx * 1.6, 0.64, 0.25)));
  [0.64, 5.365].forEach((y) => passport.add(K.box(3.235, 0.035, 0.024, M.lime, 0, y, 0.25)));
  // cornisa con luz cálida que baña la parte alta de la pantalla
  passport.add(K.rbox(3.86, 0.12, 0.62, M.steel, 0, 5.68, 0.06, 0.03));
  passport.add(K.box(3.3, 0.025, 0.03, M.warmGlow, 0, 5.645, 0.34));
  // emisor de los arcos de conexión (los arcos nacen en la cara superior, s6.y + 6,4)
  passport.add(K.cyl(0.17, 0.21, 0.08, M.darkSteel, 20).translateY(5.84));
  const emitter = new THREE.Mesh(K.geo('hubEmit', () => new THREE.TorusGeometry(0.19, 0.016, 4, 32).rotateX(Math.PI / 2)), M.lime);
  emitter.position.y = 5.875;
  passport.add(emitter);
  // alas laterales detrás del monolito con tira ámbar vertical
  [-1, 1].forEach((sx) => {
    passport.add(K.rbox(0.46, 5.1, 0.42, M.graphite, sx * 1.98, 0, -0.52, 0.05));
    passport.add(K.box(0.04, 4.5, 0.03, M.amberGlow, sx * 2.17, 0.32, -0.295));
    passport.add(K.rbox(0.62, 0.16, 0.6, M.concreteLight, sx * 1.98, 0, -0.52, 0.04));
  });
  // proyectores de suelo que iluminan el monolito
  [-1.25, 1.25].forEach((x) => {
    passport.add(K.cyl(0.1, 0.12, 0.1, M.darkSteel, 16).translateX(x).translateY(0.05).translateZ(0.72));
    passport.add(K.cyl(0.075, 0.075, 0.012, M.warmGlow, 16).translateX(x).translateY(0.104).translateZ(0.72));
  });
  passport.position.set(s6.x - 1.2, Y + 0.6, s6.z - 1.4);
  passport.rotation.y = FACE;
  ctx.add(passport);

  // ---------- Batería expuesta delante del pasaporte (posición fija) ----------
  const b6 = K.makeBattery(M, { scale: 0.9 });
  b6.position.set(s6.x + 1.4, Y + 0.6, s6.z + 1.2);
  b6.rotation.y = FACE;
  ctx.add(b6);
  ctx.shadows.push({ x: s6.x + 1.4, y: Y + 0.6, z: s6.z + 1.2, w: 1.9, d: 1.2, r: FACE });
  // peana hexagonal de exposición con filo cálido
  mesh(K.geo('hubPad', () => new THREE.CylinderGeometry(1.22, 1.26, 0.03, 6)), M.stoneTop, s6.x + 1.4, Y + 0.615, s6.z + 1.2, FACE + Math.PI / 6);
  mesh(K.geo('hubPadEdge', () => new THREE.TorusGeometry(1.25, 0.014, 3, 6).rotateX(Math.PI / 2)), M.amberGlow, s6.x + 1.4, Y + 0.625, s6.z + 1.2, FACE + Math.PI / 6);

  // ---------- Gradas concéntricas detrás del pasaporte ----------
  const G0 = 198;
  const G1 = 290;
  arc(6.05, 7.35, G0, G1, 0.4, M.concreteLight);
  arc(6.7, 7.35, G0, G1, 0.4, M.concreteLight, Y + 0.4);
  arc(6.05, 6.2, G0, G1, 0.025, M.stoneTop, Y + 0.4);
  arc(6.7, 6.85, G0, G1, 0.025, M.stoneTop, Y + 0.8);
  // tiras doradas en las contrahuellas (ámbar: cálidas sin quemarse a blanco)
  ring(6.04, 0.018, G0 + 0.4, G1 - 0.4, M.amberGlow, Y + 0.33);
  ring(6.69, 0.018, G0 + 0.4, G1 - 0.4, M.amberGlow, Y + 0.73);
  // jardineras bajas sobre el primer escalón: alternan con las del escalón alto (ajardinado escalonado).
  // Aquí no hay asientos: mirarían a la espalda del monolito.
  [[214, 230], [250, 268]].forEach(([a0, a1]) => {
    arc(6.18, 6.64, a0, a1, 0.34, M.concreteLight, Y + 0.4);
    arc(6.23, 6.59, a0 + 0.5, a1 - 0.5, 0.02, M.trunk, Y + 0.72);
    for (let a = a0 + 2.2; a < a1 - 1; a += 3.1) {
      const [x, z] = pol(a, 6.41);
      shrubs.push({ x, y: Y + 0.7, z, s: 0.72 + ((a * 5) % 3) * 0.07, kind: (a | 0) % 4 ? 'shrub' : 'low', r: a * 1.3 });
    }
  });
  // jardineras corridas sobre el escalón alto, con arbustos
  [[200, 213], [234, 247], [273, 288]].forEach(([a0, a1]) => {
    arc(6.82, 7.3, a0, a1, 0.46, M.concreteLight, Y + 0.8);
    arc(6.88, 7.24, a0 + 0.5, a1 - 0.5, 0.02, M.trunk, Y + 1.24);
    for (let a = a0 + 2.5; a < a1 - 1; a += 3.4) {
      const [x, z] = pol(a, 7.05);
      shrubs.push({ x, y: Y + 1.2, z, s: 0.85 + ((a * 7) % 3) * 0.08, kind: 'shrub', r: a });
    }
  });

  // ---------- Pantallas curvas laterales, concéntricas con la plaza ----------
  // Proporción de ref-centro-final: cada pantalla mide ~1,1 veces el ancho del monolito y casi la mitad de
  // su alto; una jardinera curva con matas y proyectores cálidos le asienta la base.
  const RS = 5.5;
  const SW = 4.2;
  const SH = 2.45;
  const SY = 3.2;
  const PH = SY + SH / 2 + 0.32; // altura de los pilares extremos
  const SA = (SW / 2 + 0.25) / RS / D2R; // semiabertura angular hasta el eje de los pilares (≈ 24,5°)
  const screenGeo = K.geo('hubScreen', () => bend(new THREE.PlaneGeometry(SW, SH, 40, 1), RS));
  const frameGeo = K.geo('hubScreenFrame', () => bend(new THREE.BoxGeometry(SW + 0.2, SH + 0.2, 0.1, 40, 1, 1).translate(0, 0, -0.056), RS));
  const backGeo = K.geo('hubScreenBack', () => bend(new THREE.BoxGeometry(SW + 0.06, SH + 0.06, 0.16, 40, 1, 1).translate(0, 0, -0.18), RS));
  // strips: tiras ámbar de los pilares [izquierdo, derecho] vistos de frente
  const sideScreen = (a, texture, strips) => {
    const g = new THREE.Group();
    const scr = emissiveOnly(K.screen(texture, SW, SH));
    scr.geometry.dispose();
    scr.geometry = screenGeo;
    scr.position.y = SY;
    g.add(scr);
    const frame = new THREE.Mesh(frameGeo, M.darkSteel);
    frame.position.y = SY;
    const back = new THREE.Mesh(backGeo, M.graphite);
    back.position.y = SY;
    g.add(frame, back);
    // pilares extremos grafito satinado (sin cepillado) con remate de acero y tira ámbar; el tono oscuro
    // no compite con el titular que tienen delante en la lectura. Patas centrales ocultas en la jardinera.
    [-1, 1].forEach((sx) => {
      const ap = (sx * SA) * D2R;
      const pil = new THREE.Group();
      pil.add(K.rbox(0.3, PH, 0.34, M.graphiteLight, 0, 0, -0.04, 0.05));
      pil.add(K.rbox(0.36, 0.06, 0.4, M.steel, 0, PH, -0.04, 0.02));
      if (strips[(sx + 1) / 2]) pil.add(K.box(0.05, PH - 0.82, 0.02, M.amberGlow, 0, 0.45, 0.14));
      pil.add(K.rbox(0.52, 0.1, 0.56, M.darkSteel, 0, 0, -0.04, 0.03));
      pil.position.set(RS * Math.sin(ap), 0, RS - RS * Math.cos(ap));
      pil.rotation.y = -ap;
      g.add(pil);
      const ar = (sx * SW) / 4 / RS;
      const leg = K.cyl(0.06, 0.06, SY - SH / 2, M.darkSteel, 10);
      leg.position.set((RS + 0.2) * Math.sin(ar), (SY - SH / 2) / 2, RS - (RS + 0.2) * Math.cos(ar));
      g.add(leg);
    });
    const [x, z] = pol(a, RS);
    g.position.set(x, Y, z);
    g.rotation.y = faceIn(a);
    ctx.add(g);
    // jardinera curva al pie, entre los dos pilares: matas, filo ámbar bajo la albardilla y dos proyectores
    const P0 = a - SA + 2.5;
    const P1 = a + SA - 2.5;
    arc(5.0, 5.8, P0, P1, 0.55, M.concreteLight);
    arc(5.06, 5.74, P0 + 0.4, P1 - 0.4, 0.02, M.trunk, Y + 0.53);
    ring(4.996, 0.014, P0 + 0.3, P1 - 0.3, M.amberGlow, Y + 0.46);
    for (let k = 0; k < 7; k++) {
      const [px, pz] = pol(a - 18 + k * 6, 5.4 + (k % 2 ? 0.1 : -0.08));
      shrubs.push({ x: px, y: Y + 0.53, z: pz, s: 0.8 + (k % 3) * 0.08, kind: k % 3 === 1 ? 'low' : 'shrub', r: a + k * 2.3 });
    }
    [-9, 9].forEach((d) => {
      const [ux, uz] = pol(a + d, 5.3);
      mesh(K.geo('hubUpBody', () => new THREE.CylinderGeometry(0.08, 0.09, 0.07, 14)), M.darkSteel, ux, Y + 0.585, uz);
      mesh(K.geo('hubUpLens', () => new THREE.CylinderGeometry(0.062, 0.062, 0.012, 14)), M.warmGlow, ux, Y + 0.622, uz);
    });
    ctx.shadows.push({ x, y: Y, z, w: SW + 1.2, d: 1.4, r: faceIn(a) });
  };
  // la izquierda queda tras el titular en la lectura: su pilar exterior va sin luz; a 190° su pilar
  // exterior conserva el ángulo polar (~165°) y su lado interior se esconde tras el monolito
  sideScreen(190, live.hist.texture, [false, true]);
  sideScreen(266, live.net.texture, [true, true]);

  // ---------- Zócalos con baterías expuestas ----------
  const plinth = (a, r) => {
    const g = new THREE.Group();
    g.add(K.rbox(2.5, 0.08, 1.12, M.darkSteel, 0, 0, 0, 0.02));
    g.add(K.rbox(2.42, 0.6, 1.06, M.concreteLight, 0, 0.06, 0, 0.05));
    g.add(K.rbox(2.64, 0.1, 1.26, M.stoneTop, 0, 0.66, 0, 0.03));
    g.add(K.box(2.5, 0.022, 0.02, M.amberGlow, 0, 0.625, 0.545));
    [-0.62, 0.62].forEach((bx) => {
      const b = K.makeBattery(M, { scale: 0.56 });
      b.position.set(bx, 0.76, 0.02);
      g.add(b);
    });
    const [x, z] = pol(a, r);
    g.position.set(x, Y, z);
    g.rotation.y = faceIn(a);
    ctx.add(g);
    ctx.shadows.push({ x, y: Y, z, w: 3.1, d: 1.7, r: faceIn(a) });
  };
  plinth(146, 7.0);
  plinth(305, 6.5);

  // ---------- Jardineras y bancos del contorno ----------
  const planter = (a, r, len, tree) => {
    const g = new THREE.Group();
    g.add(K.rbox(len, 0.58, 0.95, M.concreteLight, 0, 0, 0, 0.06));
    g.add(K.box(len - 0.14, 0.02, 0.81, M.trunk, 0, 0.555, 0));
    const [x, z] = pol(a, r);
    g.position.set(x, Y, z);
    g.rotation.y = faceIn(a);
    ctx.add(g);
    ctx.shadows.push({ x, y: Y, z, w: len + 0.5, d: 1.4, r: faceIn(a) });
    const c = Math.cos(g.rotation.y);
    const s = Math.sin(g.rotation.y);
    const n = Math.round(len / 0.55);
    for (let k = 0; k < n; k++) {
      const lx = ((k + 0.5) / n - 0.5) * (len - 0.4);
      if (tree && k === n - 1) shrubs.push({ x: x + lx * c, y: Y + 0.56, z: z - lx * s, s: 0.62 });
      else shrubs.push({ x: x + lx * c, y: Y + 0.54, z: z - lx * s, s: 0.85 + (k % 3) * 0.1, kind: 'shrub', r: k * 2.1 + a });
    }
  };
  const bench = (a, r) => {
    const g = new THREE.Group();
    [-0.72, 0.72].forEach((bx) => g.add(K.rbox(0.36, 0.38, 0.48, M.concreteLight, bx, 0, 0, 0.04)));
    for (let k = 0; k < 4; k++) g.add(K.box(1.9, 0.045, 0.1, M.wood, 0, 0.38, -0.18 + k * 0.12));
    const [x, z] = pol(a, r);
    g.position.set(x, Y, z);
    g.rotation.y = faceIn(a);
    ctx.add(g);
    ctx.shadows.push({ x, y: Y, z, w: 2.3, d: 0.9, r: faceIn(a) });
  };
  planter(124, 7.6, 2.0, true);
  // algo apartado del pilar exterior de la pantalla izquierda (165,5°) para que no tape la vista al centro
  bench(171, 7.4);
  planter(328, 7.15, 2.0, true);
  bench(350, 7.0);

  // ---------- Acceso desde el puente: líneas lima que se abren alrededor del podio ----------
  const B = new THREE.Vector3(60.7, Y, -10.74);
  const dir = new THREE.Vector3(s6.x - B.x, 0, s6.z - B.z).normalize();
  const nrm = new THREE.Vector3(-dir.z, 0, dir.x);
  const ry = Math.atan2(dir.x, dir.z);
  const toC = Math.hypot(s6.x - B.x, s6.z - B.z);
  const RL = 5.6;
  const polar = [];
  [-1.15, 1.15].forEach((off) => {
    const t1 = toC - Math.sqrt(RL * RL - off * off);
    const t0 = 0.35;
    const mx = B.x + nrm.x * off + dir.x * ((t0 + t1) / 2);
    const mz = B.z + nrm.z * off + dir.z * ((t0 + t1) / 2);
    mesh(K.geo(`hubLine${t1 - t0}`, () => new THREE.BoxGeometry(0.05, 0.012, t1 - t0)), M.lime, mx, Y, mz, ry).position.y = Y + 0.006;
    const ex = B.x + nrm.x * off + dir.x * t1 - s6.x;
    const ez = B.z + nrm.z * off + dir.z * t1 - s6.z;
    polar.push(Math.atan2(ez, ex) / D2R);
  });
  // umbral transversal a la entrada de la plaza
  mesh(K.geo('hubLineCross', () => new THREE.BoxGeometry(2.35, 0.012, 0.05)), M.lime, B.x + dir.x * 0.35, Y + 0.006, B.z + dir.z * 0.35, ry);
  const [pe, pw] = polar[0] < polar[1] ? polar : [polar[1], polar[0]];
  arc(RL - 0.025, RL + 0.025, pw, 162, 0.012, M.lime);
  arc(RL - 0.025, RL + 0.025, -56, pe, 0.012, M.lime);
  // tótems de acceso con luz ámbar hacia el paso
  [-1.85, 1.85].forEach((off) => {
    const g = new THREE.Group();
    g.add(K.rbox(0.34, 1.25, 0.34, M.graphite, 0, 0, 0, 0.05));
    g.add(K.box(0.04, 0.9, 0.02, M.amberGlow, 0, 0.2, 0.175));
    g.add(K.box(0.36, 0.035, 0.36, M.lime, 0, 1.25, 0));
    g.add(K.rbox(0.5, 0.08, 0.5, M.darkSteel, 0, 0, 0, 0.02));
    g.position.set(B.x + nrm.x * off + dir.x * 1.5, Y, B.z + nrm.z * off + dir.z * 1.5);
    g.rotation.y = Math.atan2(-nrm.x * Math.sign(off), -nrm.z * Math.sign(off));
    ctx.add(g);
  });
  // terminal de consulta: se escanea el QR de la batería y se abre su pasaporte
  {
    const [x, z] = pol(58, 7.9);
    const g = new THREE.Group();
    g.add(K.rbox(0.56, 0.95, 0.42, M.graphite, 0, 0, 0, 0.05));
    g.add(K.rbox(0.66, 0.08, 0.5, M.darkSteel, 0, 0, 0, 0.02));
    const head = new THREE.Group();
    head.add(K.rbox(0.62, 0.06, 0.46, M.graphite, 0, 0, 0, 0.02));
    // comparte material con la pantalla del pasaporte: misma imagen y una sola llamada de dibujo
    const kscr = new THREE.Mesh(K.geo('hubKioskScreen', () => new THREE.PlaneGeometry(0.28, 0.42)), pscreen.material);
    kscr.rotation.x = -Math.PI / 2;
    kscr.position.set(0, 0.062, 0);
    head.add(kscr);
    head.position.set(0, 0.95, 0.02);
    head.rotation.x = 0.5;
    g.add(head);
    g.add(K.box(0.3, 0.03, 0.02, M.amberGlow, 0, 0.78, 0.215));
    g.position.set(x, Y, z);
    g.rotation.y = Math.atan2(B.x - x, B.z - z);
    ctx.add(g);
    ctx.shadows.push({ x, y: Y, z, w: 0.9, d: 0.8, r: g.rotation.y });
  }

  // ---------- Jardineras curvas detrás de las gradas: arbolado bajo que cierra el fondo ----------
  [[204, 222], [231, 249], [258, 276], [284, 298]].forEach(([a0, a1], j) => {
    arc(7.78, 8.62, a0, a1, 0.55, M.concreteLight);
    arc(7.84, 8.56, a0 + 0.4, a1 - 0.4, 0.02, M.trunk, Y + 0.53);
    const mid = (a0 + a1) / 2;
    const [tx, tz] = pol(mid + (j % 2 ? 2.5 : -2.5), 8.2);
    shrubs.push({ x: tx, y: Y + 0.55, z: tz, s: 0.9 + (j % 2) * 0.12, kind: 'tree', r: j * 1.7 });
    for (let a = a0 + 2; a < a1 - 1; a += 2.9) {
      if (Math.abs(a - mid) < 3.2) continue;
      const [x, z] = pol(a, 8.2 + ((a * 13) % 3 - 1) * 0.14);
      shrubs.push({ x, y: Y + 0.53, z, s: 0.75 + ((a * 7) % 4) * 0.08, kind: (a | 0) % 3 ? 'shrub' : 'low', r: a });
    }
  });

  // ---------- Tira cálida al pie del bordillo (barandilla iluminada) ----------
  // fuera del tramo que queda tras el texto en la lectura y del acceso del puente
  ring(9.47, 0.02, 101, 150, M.amberGlow, Y + 0.02);
  ring(9.47, 0.02, 196, 432, M.amberGlow, Y + 0.02);

  ctx.add(K.scatterTrees(M, shrubs));

  // ---------- Microluces cálidas entre el follaje (ref-centro-final: copas punteadas de luz) ----------
  // Piezas estáticas: se fusionan con el resto del ámbar luminoso (ninguna llamada de dibujo nueva).
  {
    const bulb = K.geo('hubBulb', () => new THREE.IcosahedronGeometry(0.028, 0));
    let seed = 91;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // [altura del centro, radio horizontal, radio vertical, luces] de cada copa por unidad de escala (kit.js)
    const CROWN = { tree: [1.34, 0.58, 0.5, 8], shrub: [0.31, 0.42, 0.3, 2], low: [0.11, 0.33, 0.14, 1] };
    shrubs.forEach((p, j) => {
      const [cy, rh, rv, n0] = CROWN[p.kind || 'tree'];
      const s = p.s || 1;
      const n = n0 + (p.kind === 'shrub' && j % 2 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const th = rnd() * Math.PI * 2;
        const up = 0.2 + rnd() * 0.75; // sesgo hacia arriba: las luces asoman por la copa
        const f = 0.86 + rnd() * 0.1;
        const side = Math.sqrt(1 - up * up) * f;
        mesh(bulb, M.amberGlow, p.x + Math.cos(th) * side * rh * s, p.y + (cy + up * f * rv) * s, p.z + Math.sin(th) * side * rh * s);
      }
    });
  }

  // ---------- Luces ----------
  const hubLight = new THREE.PointLight('#ffd8a0', 18, 20, 1.6);
  hubLight.position.set(s6.x + 3, Y + 6, s6.z + 3);
  ctx.add(hubLight);
  // luz cálida alta sobre las gradas: modela escalones, jardineras y pilares de las pantallas
  const backLight = new THREE.PointLight('#ffcf94', 9, 12, 1.6);
  const [bx, bz] = pol(235, 3.0);
  backLight.position.set(bx, Y + 6.8, bz);
  ctx.add(backLight);

  // ---------- Proceso: pasaporte, historial y red avanzan con las conexiones ----------
  // El ritmo se mide con dt (no con t) para que el progreso también se dibuje con el tiempo congelado.
  // Escaneo breve: un barrido de 1,3 s sobre el QR justo antes de que se encienda «Destino documentado»
  // (conn 0,66). Se dispara una vez por visita al cruzar SCAN_AT hacia delante con la cámara ya en la
  // lectura (pasada la clave «in», conn ≈ 0,55); un salto lejano no lo dispara y al retroceder se corta.
  const SCAN_AT = 0.585;
  const SCAN_S = 1.3;
  let acc = 1;
  let lastConn = -1;
  let prevConn = 0;
  let armed = true;
  let fxWas = false;
  let reducedDrawn = false;
  const screens = [live.pass, live.hist, live.net];
  ctx.anim((t, dt, story) => {
    if (story.reduced) {
      fx.scan = -1;
      fx.flash = 0;
      if (!reducedDrawn) screens.forEach((s) => s.update(0, FINAL, true));
      reducedDrawn = true;
      lastConn = -1;
      return;
    }
    reducedDrawn = false;
    const c = story.conn;
    if (armed && story.index === 6 && prevConn < SCAN_AT && c >= SCAN_AT && c < SCAN_AT + 0.12) {
      fx.scan = 0;
      armed = false;
    }
    if (c < 0.3) armed = true;
    prevConn = c;
    // fuera del capítulo 6 no queda escaneo ni destello pendiente que obligue a redibujar
    if (story.index !== 6) {
      fx.scan = -1;
      fx.flash = 0;
    }
    if (fx.scan >= 0) {
      fx.scan = c < 0.5 ? -1 : fx.scan + dt / SCAN_S;
      if (fx.scan >= 1) {
        fx.scan = -1;
        fx.flash = 1;
      }
    } else if (fx.flash > 0) fx.flash = c < 0.5 ? 0 : Math.max(0, fx.flash - dt / 0.9);
    if (story.index < 5 || story.index > 7) return;
    acc += dt;
    const moved = Math.abs(c - lastConn) > 1e-3;
    const fxOn = fx.scan >= 0 || fx.flash > 0;
    // capítulo 6: 12 fps mientras avanza o escanea y 8 fps para la respiración ambiental;
    // vecinos: solo si cambia el progreso
    const due = story.index === 6 ? acc >= (moved || fxOn ? 1 / 12 : 1 / 8) : (moved || fxWas) && acc >= 1 / 12;
    if (!due) return;
    acc = 0;
    lastConn = c;
    live.hist.update(t, story, true);
    live.net.update(t, story, true);
    if (moved || fxOn || fxWas) live.pass.update(t, story, true);
    fxWas = fxOn;
  });
}
