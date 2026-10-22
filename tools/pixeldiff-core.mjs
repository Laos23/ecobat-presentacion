// Comparación de capturas píxel a píxel con la tolerancia de la especificación de rendimiento (§7.1).
//
// Criterio de «idéntico» (el canal alfa se ignora):
//   - ningún píxel difiere más de 1/255 en ningún canal, salvo píxeles AISLADOS (sin ningún vecino de 8 cuya
//     diferencia sea > 1) que pueden llegar a 8/255 y suman como mucho max(1, floor(ancho·alto·0,00001));
//   - cualquier diferencia con estructura (dos píxeles contiguos, una línea, una mancha) o > 8/255 es un fallo.
//
// Módulo puro (sin PNG ni DOM). La herramienta de línea de órdenes que lee las capturas es .verify/perf/pixeldiff.mjs.

// Diferencia máxima entre canales RGB de cada píxel (0..255), un byte por píxel.
function channelDiff(a, b, width, height) {
  const n = width * height;
  if (a.length !== n * 4 || b.length !== n * 4) {
    throw new Error(`Tamaño de datos inesperado: ${a.length} y ${b.length} bytes para ${width}×${height} RGBA (${n * 4})`);
  }
  const d = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const dr = Math.abs(a[j] - b[j]);
    const dg = Math.abs(a[j + 1] - b[j + 1]);
    const db = Math.abs(a[j + 2] - b[j + 2]);
    d[i] = dr > dg ? (dr > db ? dr : db) : (dg > db ? dg : db);
  }
  return d;
}

/**
 * Compara dos imágenes RGBA de 8 bits del mismo tamaño.
 * @returns {{ max: number, over8: number, clustered: number, isolated: number, isolatedMax: number, ok: boolean }}
 *   max: mayor diferencia de canal; over8: píxeles con diferencia > 8; clustered: píxeles con diferencia 2..8 que
 *   tienen algún vecino de 8 con diferencia > 1; isolated: píxeles con diferencia 2..8 sin tal vecino.
 */
export function comparePixels(a, b, width, height) {
  const d = channelDiff(a, b, width, height);
  let max = 0;
  let over8 = 0;
  let clustered = 0;
  let isolated = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = d[y * width + x];
      if (v > max) max = v;
      if (v > 8) over8++;
      if (v < 2 || v > 8) continue;
      let withNeighbour = false;
      for (let dy = -1; dy <= 1 && !withNeighbour; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (d[yy * width + xx] > 1) { withNeighbour = true; break; }
        }
      }
      if (withNeighbour) clustered++; else isolated++;
    }
  }
  const isolatedMax = Math.max(1, Math.floor(width * height * 0.00001));
  return { max, over8, clustered, isolated, isolatedMax, ok: over8 === 0 && clustered === 0 && isolated <= isolatedMax };
}

/** Imagen RGBA de diferencias: min(255, diff·32) en gris sobre negro (alfa 255). */
export function diffImage(a, b, width, height) {
  const d = channelDiff(a, b, width, height);
  const out = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) {
    const v = Math.min(255, d[i] * 32);
    out[j] = out[j + 1] = out[j + 2] = v;
    out[j + 3] = 255;
  }
  return out;
}
