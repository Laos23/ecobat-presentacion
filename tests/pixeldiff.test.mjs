import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparePixels } from '../tools/pixeldiff-core.mjs';

const W = 100, H = 100;
const img = (fill = 128) => new Uint8Array(W * H * 4).fill(fill);
const set = (a, x, y, v) => { const i = (y * W + x) * 4; a[i] = a[i + 1] = a[i + 2] = v; };

test('idénticas: ok', () => assert.equal(comparePixels(img(), img(), W, H).ok, true));
test('diferencia de 1 en todos los píxeles: ok', () => {
  const r = comparePixels(img(128), img(129), W, H);
  assert.equal(r.ok, true); assert.equal(r.max, 1);
});
test('un píxel aislado a 8: ok', () => {
  const b = img(); set(b, 10, 10, 136);
  const r = comparePixels(img(), b, W, H);
  assert.deepEqual([r.ok, r.isolated, r.clustered, r.over8], [true, 1, 0, 0]);
});
test('un píxel a 9: fallo', () => {
  const b = img(); set(b, 10, 10, 137);
  assert.equal(comparePixels(img(), b, W, H).ok, false);
});
test('dos píxeles contiguos a 5: fallo (con estructura)', () => {
  const b = img(); set(b, 10, 10, 133); set(b, 11, 10, 133);
  const r = comparePixels(img(), b, W, H);
  assert.equal(r.clustered, 2); assert.equal(r.ok, false);
});
test('isolatedMax para 100×100 es 1 y 2 aislados fallan', () => {
  const b = img(); set(b, 10, 10, 133); set(b, 50, 50, 133);
  const r = comparePixels(img(), b, W, H);
  assert.equal(r.isolatedMax, 1); assert.equal(r.ok, false);
});
