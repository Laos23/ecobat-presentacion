import * as THREE from 'three';

// Texturas dibujadas en canvas: no hay imágenes externas en el mundo.
export const PAL = {
  graphite: '#161819',
  ink: '#1f2224',
  ivory: '#F1EEE6',
  lime: '#C2F230',
  amber: '#E5AE50',
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Patrón tipo QR, decorativo: no codifica nada.
function drawQR(g, x, y, size, seed = 7, fg = PAL.graphite) {
  const n = 21;
  const m = size / n;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = fg;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const inFinder = (i < 8 && j < 8) || (i > 12 && j < 8) || (i < 8 && j > 12);
      if (!inFinder && rnd() > 0.52) g.fillRect(x + i * m, y + j * m, m + 0.4, m + 0.4);
    }
  }
  const finder = (fx, fy) => {
    g.fillRect(x + fx * m, y + fy * m, 7 * m, 7 * m);
    g.clearRect(x + (fx + 1) * m, y + (fy + 1) * m, 5 * m, 5 * m);
    g.fillStyle = '#ffffff';
    g.fillRect(x + (fx + 1) * m, y + (fy + 1) * m, 5 * m, 5 * m);
    g.fillStyle = fg;
    g.fillRect(x + (fx + 2) * m, y + (fy + 2) * m, 3 * m, 3 * m);
  };
  finder(0, 0);
  finder(14, 0);
  finder(0, 14);
}

export function qrLabelTexture(seed = 7) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f4f2ec';
  g.fillRect(0, 0, 256, 256);
  drawQR(g, 28, 28, 200, seed);
  return tex(c);
}

export function batteryLabelTexture() {
  // Etiqueta frontal de la batería: franja lima, marca y QR decorativo.
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#202326';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = PAL.lime;
  g.fillRect(0, 0, 512, 14);
  g.fillStyle = '#f4f2ec';
  g.fillRect(330, 40, 160, 176);
  drawQR(g, 340, 52, 140, 11);
  g.fillStyle = PAL.ivory;
  g.font = '800 46px "Archivo Variable", sans-serif';
  g.fillText('Eco', 34, 120);
  g.fillStyle = PAL.lime;
  g.fillText('Bat', 34 + g.measureText('Eco').width, 120);
  g.fillStyle = 'rgba(241,238,230,0.55)';
  g.font = '500 22px "Archivo Variable", sans-serif';
  g.fillText('12 V · ECB-0427', 36, 170);
  return tex(c);
}

export function recordPanelTexture() {
  // Ficha digital ilustrativa (datos de demostración).
  const [c, g] = canvas(512, 640);
  g.fillStyle = 'rgba(22,24,25,0.92)';
  g.fillRect(0, 0, 512, 640);
  g.strokeStyle = PAL.lime;
  g.lineWidth = 6;
  g.strokeRect(3, 3, 506, 634);
  g.fillStyle = PAL.lime;
  g.font = '800 44px "Archivo Variable", sans-serif';
  g.fillText('Ficha ECB-0427', 36, 82);
  const rows = [
    ['Tipo', 'Plomo-ácido 12 V'],
    ['Entrada', 'Taller · 21/10'],
    ['Procedencia', 'Mantenimiento'],
    ['Estado visual', 'Sin fugas'],
    ['Diagnóstico', 'Pendiente'],
  ];
  g.font = '500 28px "Archivo Variable", sans-serif';
  rows.forEach(([k, v], i) => {
    const y = 160 + i * 74;
    g.fillStyle = 'rgba(241,238,230,0.55)';
    g.fillText(k, 36, y);
    g.fillStyle = PAL.ivory;
    g.fillText(v, 36, y + 34);
    g.fillStyle = 'rgba(241,238,230,0.14)';
    g.fillRect(36, y + 50, 440, 2);
  });
  g.fillStyle = '#f4f2ec';
  g.fillRect(356, 30, 120, 120);
  drawQR(g, 362, 36, 108, 11);
  return tex(c);
}

export function gaugeTexture(kind = 'wave') {
  const [c, g] = canvas(512, 320);
  g.fillStyle = '#0f1112';
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = 'rgba(229,174,80,0.18)';
  g.lineWidth = 1;
  for (let x = 0; x < 512; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 320);
    g.stroke();
  }
  for (let y = 0; y < 320; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  if (kind === 'wave') {
    g.strokeStyle = PAL.amber;
    g.lineWidth = 6;
    g.beginPath();
    for (let x = 0; x <= 512; x += 4) {
      const y = 170 - Math.sin(x / 38) * 60 * Math.exp(-x / 900) - Math.sin(x / 9) * 8;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  } else if (kind === 'dial') {
    g.strokeStyle = 'rgba(194,242,48,0.25)';
    g.lineWidth = 22;
    g.beginPath();
    g.arc(256, 210, 130, Math.PI, 0);
    g.stroke();
    g.strokeStyle = PAL.lime;
    g.beginPath();
    g.arc(256, 210, 130, Math.PI, Math.PI * 1.72);
    g.stroke();
    g.fillStyle = PAL.ivory;
    g.font = '800 64px "Archivo Variable", sans-serif';
    g.textAlign = 'center';
    g.fillText('12,6 V', 256, 214);
  } else {
    // barras
    const vals = [0.35, 0.6, 0.48, 0.8, 0.66, 0.9, 0.72];
    vals.forEach((v, i) => {
      g.fillStyle = i === 5 ? PAL.lime : 'rgba(194,242,48,0.45)';
      g.fillRect(40 + i * 64, 280 - v * 220, 40, v * 220);
    });
  }
  return tex(c);
}

function drawRecycle(g, cx, cy, r, color) {
  // Tres flechas que se persiguen alrededor de un triángulo.
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = r * 0.2;
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    g.save();
    g.rotate((k * Math.PI * 2) / 3);
    g.beginPath();
    g.moveTo(-r * 0.48, r * 0.42);
    g.lineTo(r * 0.3, r * 0.42);
    g.stroke();
    g.beginPath();
    g.moveTo(r * 0.52, r * 0.42);
    g.lineTo(r * 0.24, r * 0.2);
    g.lineTo(r * 0.24, r * 0.64);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.restore();
}

export function signTexture(kind) {
  const [c, g] = canvas(256, 256);
  const colors = { service: PAL.lime, second: PAL.amber, recycle: PAL.ivory };
  const col = colors[kind] || PAL.ivory;
  g.fillStyle = '#1b1e20';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = col;
  g.lineWidth = 10;
  g.strokeRect(10, 10, 236, 236);
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = 12;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (kind === 'service') {
    // coche simplificado
    g.beginPath();
    g.moveTo(52, 160);
    g.lineTo(70, 110);
    g.lineTo(186, 110);
    g.lineTo(204, 160);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.arc(86, 172, 16, 0, Math.PI * 2);
    g.arc(170, 172, 16, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'second') {
    // lupa sobre módulo
    g.strokeRect(54, 96, 96, 84);
    g.beginPath();
    g.arc(160, 120, 34, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(184, 144);
    g.lineTo(212, 176);
    g.stroke();
  } else {
    drawRecycle(g, 128, 136, 92, col);
  }
  return tex(c);
}

export function recycleWallTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#d9d4c7';
  g.fillRect(0, 0, 256, 256);
  drawRecycle(g, 128, 138, 96, '#2a2d30');
  return tex(c);
}

export function passportTexture() {
  // Pantalla del pasaporte digital (ilustrativa).
  const [c, g] = canvas(512, 768);
  g.fillStyle = '#0d0f10';
  g.fillRect(0, 0, 512, 768);
  g.strokeStyle = PAL.lime;
  g.lineWidth = 8;
  g.strokeRect(6, 6, 500, 756);
  // batería
  g.lineWidth = 10;
  g.strokeRect(126, 120, 260, 190);
  g.fillStyle = PAL.lime;
  g.fillRect(176, 92, 40, 28);
  g.fillRect(296, 92, 40, 28);
  g.fillStyle = '#f4f2ec';
  g.fillRect(196, 360, 120, 120);
  drawQR(g, 202, 366, 108, 23);
  // línea de tiempo
  g.strokeStyle = 'rgba(194,242,48,0.4)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(70, 560);
  g.lineTo(442, 560);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = PAL.lime;
    g.beginPath();
    g.arc(70 + i * 124, 560, 14, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = PAL.ivory;
  g.font = '800 40px "Archivo Variable", sans-serif';
  g.textAlign = 'center';
  g.fillText('Pasaporte', 256, 660);
  g.fillStyle = 'rgba(241,238,230,0.6)';
  g.font = '500 26px "Archivo Variable", sans-serif';
  g.fillText('Historial documentado', 256, 704);
  return tex(c);
}

export function groundTexture() {
  // Ruido sutil para el hormigón.
  const [c, g] = canvas(256, 256);
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 40;
    img.data[i] = v;
    img.data[i + 1] = v * 0.98;
    img.data[i + 2] = v * 0.93;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function pulseTexture() {
  // Gradiente para el pulso que recorre la traza luminosa.
  const [c, g] = canvas(256, 4);
  const grd = g.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0.25)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0.35)');
  grd.addColorStop(0.92, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0.25)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 4);
  const t = tex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
