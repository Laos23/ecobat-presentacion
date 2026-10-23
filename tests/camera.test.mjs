import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, chapterState, sample, KEYS } from '../src/camera.js';
import { CH } from '../src/world/chapters.js';
import * as THREE from 'three';

const tl = buildTimeline();

test('recorrido v2: una ventana por índice de CH (portada, ocho capítulos y cierre)', () => {
  assert.equal(tl.chapters.length, CH.cierre + 1);
  tl.chapters.forEach((c, i) => {
    assert.equal(c.index, i);
    assert.ok(c.in <= c.anchor && c.anchor <= c.out, `ventana ${i} ordenada`);
    if (i > 0) assert.ok(tl.chapters[i - 1].out < c.in, `ventana ${i} después de la ${i - 1}`);
  });
  assert.equal(tl.chapters[CH.portada].anchor, 0);
  assert.equal(tl.chapters[CH.cierre].anchor, 1);
});

test('marcas de la simulación y de las conexiones dentro de su capítulo', () => {
  const cl = tl.chapters[CH.clasificacion];
  assert.ok(tl.marks.sim >= tl.chapters[CH.identificacion].out && tl.marks.sim <= cl.anchor);
  assert.ok(tl.marks.simEnd > cl.anchor && tl.marks.simEnd <= cl.out + 1e-9);
  const tr = tl.chapters[CH.trazabilidad];
  assert.ok(tl.marks.conn > tl.chapters[CH.reciclaje].out && tl.marks.conn < tr.anchor);
});

test('chapterState devuelve el capítulo de cada ancla con el texto visible', () => {
  tl.anchors.forEach((p, i) => {
    const cs = chapterState(tl, p);
    assert.equal(cs.index, i);
    assert.equal(cs.vis, 1);
  });
});

test('cámara siempre por encima del agua y con focal razonable, en 16:9 y en vertical', () => {
  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  for (const aspect of [16 / 9, 390 / 844]) {
    for (let i = 0; i <= 600; i++) {
      const { fov } = sample(tl, i / 600, aspect, pos, tgt);
      assert.ok(pos.y > 2.5, `altura en p = ${i / 600}`);
      assert.ok(fov >= 30 && fov <= 72);
    }
  }
  assert.ok(KEYS.every((k) => k.p.y > 2.5));
});
