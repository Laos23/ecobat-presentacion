import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterGeometries, waterBounds } from '../src/world/water.js';
import { STATIONS, PLATFORMS } from '../src/world/layout.js';

test('waterBounds abarca todas las plataformas más el alcance', () => {
  const b = waterBounds(STATIONS, PLATFORMS, 34);
  assert.ok(b.minX <= -58 - 13 - 34 && b.maxX >= 60 + 10 + 34);
  assert.ok(b.minZ <= -28 - 4 - 34 && b.maxZ >= 20 + 10 + 34);
});
test('celdas: rejilla completa, en el plano xz, normales arriba', () => {
  const { cells, snapped, outer } = waterGeometries({ radius: 1600, segments: 96, bounds: { minX: -10, maxX: 10, minZ: -30, maxZ: 5 }, cell: 24 });
  assert.deepEqual(snapped, { minX: -24, maxX: 24, minZ: -48, maxZ: 24 });
  assert.equal(cells.length, 2 * 3);
  for (const { geometry } of cells) {
    const p = geometry.attributes.position; const n = geometry.attributes.normal;
    for (let i = 0; i < p.count; i++) { assert.equal(p.getY(i), 0); assert.deepEqual([n.getX(i), n.getY(i), n.getZ(i)], [0, 1, 0]); }
  }
  const xs = new Set(cells.map((c) => c.cx)); assert.deepEqual([...xs].sort((a, b) => a - b), [-12, 12]);
  const op = outer.attributes.position;
  let maxR = 0; const corners = new Set();
  for (let i = 0; i < op.count; i++) {
    assert.equal(op.getY(i), 0);
    maxR = Math.max(maxR, Math.hypot(op.getX(i), op.getZ(i)));
    corners.add(`${op.getX(i)},${op.getZ(i)}`);
  }
  // Los vértices se guardan en float32: a 1600 m el redondeo (1 ulp = 1,2e-4) deja el borde hasta 5e-5 fuera
  // del círculo exacto, así que el margen es de unos ulp y no de 1e-6.
  assert.ok(maxR <= 1600 + 1e-3 && maxR >= 1600 - 1e-3, `radio máximo ${maxR}`);
  for (const c of ['-24,-48', '24,-48', '24,24', '-24,24']) assert.ok(corners.has(c), c);
});

// ---------- malla cerrada: celdas + anillo exterior ----------
// Triángulos de una geometría como [[x, z] × 3] con los valores ya redondeados a float32.
function triangles(geometry) {
  const p = geometry.attributes.position;
  const idx = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: p.count }, (_, i) => i);
  const out = [];
  for (let i = 0; i < idx.length; i += 3) out.push([0, 1, 2].map((k) => [p.getX(idx[i + k]), p.getZ(idx[i + k])]));
  return out;
}
// Componente y de (B − A) × (C − A) en el plano xz: positivo si la cara mira hacia +y.
const upward = ([a, b, c]) => (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);

test('celdas + anillo cubren el disco sin huecos, solapes ni uniones en T', () => {
  const radius = 1600;
  const segments = 96;
  // caja con las proporciones reales (10 × 6 celdas) y descentrada, para no depender de que el origen quede dentro
  const { cells, outer, snapped } = waterGeometries({ radius, segments, bounds: { minX: -107, maxX: 106, minZ: -68, maxZ: 66 }, cell: 24 });
  assert.deepEqual(snapped, { minX: -120, maxX: 120, minZ: -72, maxZ: 72 });
  assert.equal(cells.length, 10 * 6);
  const all = [...cells.map((c) => c.geometry), outer].flatMap(triangles);

  // todas las caras miran hacia arriba (el material es de una sola cara)
  for (const t of all) assert.ok(upward(t) > 0, `cara hacia abajo o degenerada: ${JSON.stringify(t)}`);

  // área: el disco poligonal (el borde en float32, tal como lo guarda la geometría) se rellena exacto
  const area = all.reduce((s, t) => s + upward(t) / 2, 0);
  const rim = [...new Set(all.flat().filter(([x, z]) => Math.hypot(x, z) > radius - 1).map(([x, z]) => `${x},${z}`))]
    .map((k) => k.split(',').map(Number))
    .sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  assert.equal(rim.length, segments);
  let poly = 0;
  rim.forEach((a, i) => { const b = rim[(i + 1) % rim.length]; poly += (a[0] * b[1] - b[0] * a[1]) / 2; });
  assert.ok(Math.abs(area - Math.abs(poly)) <= 1e-6 * Math.abs(poly), `área ${area} contra ${Math.abs(poly)}`);

  // topología: cada arista interior la recorren dos triángulos en sentidos opuestos y solo el borde del disco
  // queda sin pareja. Una unión en T (un vértice de una celda sobre el lado largo del anillo) dejaría aristas sueltas.
  const edges = new Map();
  for (const t of all) {
    for (let i = 0; i < 3; i++) {
      const a = t[i]; const b = t[(i + 1) % 3];
      const k = `${a}>${b}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let loose = 0;
  for (const [k, n] of edges) {
    assert.equal(n, 1, `arista repetida en el mismo sentido: ${k}`);
    const [a, b] = k.split('>');
    if (edges.has(`${b}>${a}`)) continue;
    loose++;
    const [ax, az] = a.split(',').map(Number); const [bx, bz] = b.split(',').map(Number);
    assert.ok(Math.hypot(ax, az) > radius - 1 && Math.hypot(bx, bz) > radius - 1, `arista suelta fuera del borde: ${k}`);
  }
  assert.equal(loose, segments);
});

test('el hueco debe caber dentro del disco', () => {
  assert.throws(() => waterGeometries({ radius: 100, segments: 96, bounds: { minX: -90, maxX: 90, minZ: -90, maxZ: 90 }, cell: 24 }), /disco/);
});
