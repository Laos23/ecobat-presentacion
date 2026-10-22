import * as THREE from 'three';

// Agua en celdas. El plano de agua (antes un CircleGeometry(1600, 96) en abanico desde el centro) se parte en
// una rejilla de celdas cuadradas que cubre las islas más el alcance de sus luces y en un anillo (el disco con
// un hueco igual a la rejilla) para el resto. Así cada celda puede llevar solo las luces locales que la
// alcanzan y el anillo, que queda más lejos que cualquier luz, solo las globales. Módulo puro (solo three,
// sin DOM) para poder probarlo con `node --test`.
//
// Las geometrías salen ya en el plano xz, con y = 0, normales (0, 1, 0) y las coordenadas de mundo en x y z:
// el Mesh solo se sube a la altura del agua. El paso del plano xy al xz copia coordenadas, (x, y, 0) →
// (x, 0, −y), y no rota: una rotación de −π/2 deja residuos de 1e-16 en y y en las normales.
//
// Malla cerrada: las celdas y el anillo comparten vértices, no solo trazado. El lado del hueco lleva un
// vértice en cada borde de celda; con un lado recto de un solo tramo, esos vértices quedarían sobre él como
// uniones en T, y al rasterizar el redondeo a subpíxel de cada lado puede dejar píxeles sin cubrir (se ve
// el fondo a través del agua) o cubiertos dos veces.
//
// Estado: la aplicación todavía no lo usa. buildTerrain (edges.js) dejó el agua entera porque, con este
// reparto, la verificación de píxeles de la especificación (§7.1) falla: la cobertura y el sombreado salen
// iguales, pero la profundidad interpolada del plano cambia en el último bit y, donde pilares, rocas y bases de
// acantilado atraviesan el agua, alguna muestra MSAA pasa de roca a agua o al revés (píxeles aislados de hasta
// 49/255 a lo largo de esas líneas). El módulo y sus pruebas se conservan por si se retoma con otro enfoque.

const TWO_PI = Math.PI * 2;

// Caja xz de las plataformas (círculo: ±r; rectángulo: ±w/2, ±d/2 alrededor de su estación) ampliada `reach`.
export function waterBounds(stations, platforms, reach) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [key, shape] of Object.entries(platforms)) {
    const { x, z } = stations[key];
    const hx = shape.kind === 'circle' ? shape.r : shape.w / 2;
    const hz = shape.kind === 'circle' ? shape.r : shape.d / 2;
    minX = Math.min(minX, x - hx);
    maxX = Math.max(maxX, x + hx);
    minZ = Math.min(minZ, z - hz);
    maxZ = Math.max(maxZ, z + hz);
  }
  return { minX: minX - reach, maxX: maxX + reach, minZ: minZ - reach, maxZ: maxZ + reach };
}

// Celda: un PlaneGeometry(cell, cell) llevado al plano xz sobre [x0, x1] × [z0, z1]. Las esquinas se escriben
// con los valores de la rejilla y no como centro ± cell/2, para que dos celdas vecinas (y el anillo) calculen
// el borde común con la misma expresión y salga el mismo float32 con cualquier tamaño de celda.
function cellGeometry(cell, x0, x1, z0, z1) {
  const g = new THREE.PlaneGeometry(cell, cell);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    // PlaneGeometry: x = ±cell/2 en el plano xy, con y positiva arriba; (x, y) → (x, −y) en xz
    pos.setXYZ(i, pos.getX(i) < 0 ? x0 : x1, 0, pos.getY(i) > 0 ? z0 : z1);
    nor.setXYZ(i, 0, 1, 0);
  }
  return g;
}

// Anillo: el disco de `radius` con el hueco rectangular de la rejilla. Se triangula uniendo por ángulo, respecto
// al centro del hueco, el perímetro del hueco (un vértice por borde de celda) con los vértices del borde del
// disco. Con el borde fino de verdad (96 segmentos) y un hueco que quepa en el disco, ninguna unión cruza el
// hueco; una combinación que lo hiciera se detecta más abajo y lanza un error.
function ringGeometry(radius, segments, grid) {
  const { gx, gz, nx, nz } = grid;
  const minX = gx(0);
  const maxX = gx(nx);
  const minZ = gz(0);
  const maxZ = gz(nz);
  // El hueco debe caber en el polígono: dentro de su círculo inscrito siempre está dentro.
  const corner = Math.hypot(Math.max(Math.abs(minX), Math.abs(maxX)), Math.max(Math.abs(minZ), Math.abs(maxZ)));
  if (!(corner < radius * Math.cos(Math.PI / segments))) throw new Error(`El hueco de la rejilla (${minX}..${maxX}, ${minZ}..${maxZ}) no cabe dentro del disco de agua de radio ${radius}`);

  const pts = []; // vértices [x, z]: primero el borde del disco, después el perímetro del hueco
  // mismos vértices que CircleGeometry(radius, segments) tras llevarlo al plano xz (z = −y)
  for (let s = 0; s < segments; s++) {
    const a = (s / segments) * TWO_PI;
    pts.push([radius * Math.cos(a), 0 - radius * Math.sin(a)]);
  }
  const rim = pts.map((_, v) => v);
  for (let i = 0; i <= nx; i++) {
    pts.push([gx(i), minZ]);
    pts.push([gx(i), maxZ]);
  }
  for (let j = 1; j < nz; j++) {
    pts.push([minX, gz(j)]);
    pts.push([maxX, gz(j)]);
  }
  const hole = pts.map((_, v) => v).slice(segments);

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const ordered = (list) => list.map((v) => ({ v, a: Math.atan2(pts[v][1] - cz, pts[v][0] - cx) })).sort((p, q) => p.a - q.a);
  const inner = ordered(hole);
  const outer = ordered(rim);
  const n = inner.length;
  const m = outer.length;

  // Cada paso avanza por el contorno cuyo siguiente vértice está antes en ángulo y cierra un triángulo
  // (arista del hueco + vértice del borde, o arista del borde + vértice del hueco): n + m triángulos. Se
  // arranca por el último vértice de cada contorno, que queda justo antes del corte de ángulo (−π) y por
  // tanto a poca distancia angular del otro: es una arista de unión válida. Ambos recorridos empiezan con
  // ese vértice repetido, un giro por debajo, y terminan en él.
  const loop = (ring) => [{ v: ring[ring.length - 1].v, a: ring[ring.length - 1].a - TWO_PI }, ...ring];
  const ringIn = loop(inner);
  const ringOut = loop(outer);
  const index = [];
  const up = (a, b, c) => (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]) - (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]);
  const push = (a, b, c) => {
    const area = up(a, b, c);
    if (!(Math.abs(area) > 0)) throw new Error('Triángulo degenerado en el anillo de agua');
    // cara hacia +y: componente y de (b − a) × (c − a) positiva
    if (area > 0) index.push(a, b, c);
    else index.push(a, c, b);
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (j >= m || (i < n && ringIn[i + 1].a <= ringOut[j + 1].a)) {
      push(ringIn[i].v, ringIn[i + 1].v, ringOut[j].v);
      i++;
    } else {
      push(ringIn[i].v, ringOut[j].v, ringOut[j + 1].v);
      j++;
    }
  }

  // Comprobación (barata): malla cerrada. Con un borde del disco muy grueso respecto al hueco, el recorrido por
  // ángulo puede cruzar el hueco; en ese caso hay aristas repetidas o sin pareja y es mejor fallar que dibujarlo.
  // Cada arista interior la recorren dos triángulos en sentidos opuestos; solo los n + m lados de los dos
  // perímetros quedan sin pareja.
  const edge = new Set();
  for (let t = 0; t < index.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const key = index[t + k] * pts.length + index[t + ((k + 1) % 3)];
      if (edge.has(key)) throw new Error('Anillo de agua no válido: arista repetida');
      edge.add(key);
    }
  }
  let loose = 0;
  for (const key of edge) if (!edge.has((key % pts.length) * pts.length + Math.floor(key / pts.length))) loose++;
  if (loose !== n + m) throw new Error(`Anillo de agua no válido: ${loose} aristas sin pareja en lugar de ${n + m}`);

  const position = new Float32Array(pts.length * 3);
  const normal = new Float32Array(pts.length * 3);
  const uv = new Float32Array(pts.length * 2);
  pts.forEach(([x, z], v) => {
    position.set([x, 0, z], v * 3);
    normal.set([0, 1, 0], v * 3);
    uv.set([(x / radius + 1) / 2, (1 - z / radius) / 2], v * 2); // como CircleGeometry
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

// Rejilla de celdas de lado `cell` que cubre `bounds` (ampliada hacia fuera a múltiplos de `cell`, con el
// origen en un nudo de la rejilla) y anillo exterior con el hueco de la rejilla.
//   → { cells: [{ geometry, cx, cz }], outer, snapped: { minX, maxX, minZ, maxZ } }
export function waterGeometries({ radius, segments, bounds, cell }) {
  // posiciones de la rejilla como (entero) × cell: el mismo valor en todo lo que comparte esa línea
  const ix0 = Math.floor(bounds.minX / cell);
  const ix1 = Math.ceil(bounds.maxX / cell);
  const iz0 = Math.floor(bounds.minZ / cell);
  const iz1 = Math.ceil(bounds.maxZ / cell);
  const nx = ix1 - ix0;
  const nz = iz1 - iz0;
  if (!(nx >= 1 && nz >= 1)) throw new RangeError('La caja del agua no tiene área');
  const grid = { nx, nz, gx: (i) => (ix0 + i) * cell, gz: (j) => (iz0 + j) * cell };
  const snapped = { minX: grid.gx(0), maxX: grid.gx(nx), minZ: grid.gz(0), maxZ: grid.gz(nz) };

  const cells = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = grid.gx(i);
      const x1 = grid.gx(i + 1);
      const z0 = grid.gz(j);
      const z1 = grid.gz(j + 1);
      cells.push({ geometry: cellGeometry(cell, x0, x1, z0, z1), cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
    }
  }
  return { cells, outer: ringGeometry(radius, segments, grid), snapped };
}
