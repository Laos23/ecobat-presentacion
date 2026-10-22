// Coherencia del contenido y de sus fuentes (sin DOM). Ejecutar con: node --test tests/content.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { intro, chapters, closing, annex } from '../src/content.js';
import { sources, SOURCE_GROUPS } from '../src/sources.js';

// Longitud de cada cuerpo de capítulo antes de añadir los datos reales: puede crecer como mucho 40 caracteres.
const BODY_BEFORE = { recogida: 110, taller: 112, diagnostico: 114, clasificacion: 60, reciclaje: 98, trazabilidad: 80 };
const MAX_GROWTH = 40;
const BLOCK_TYPES = new Set(['p', 'note', 'h4', 'list', 'table', 'timeline', 'example', 'goals', 'sources']);

// Cadenas en el orden en que se pintan (portada, capítulos, cierre y pestañas del anexo).
function* strings(v) {
  if (typeof v === 'string') yield v;
  else if (Array.isArray(v)) for (const x of v) yield* strings(x);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x);
}
const CITE = /\[(\d+(?:\s*[,–]\s*\d+)*)\]/g;
function citations(s) {
  const out = [];
  for (const m of s.matchAll(CITE)) {
    for (const part of m[1].split(/\s*,\s*/)) {
      const [a, b] = part.split(/\s*–\s*/).map(Number);
      if (b === undefined) out.push(a);
      else {
        assert.ok(b > a, `intervalo mal formado: [${m[1]}]`);
        for (let n = a; n <= b; n++) out.push(n);
      }
    }
  }
  return out;
}
const overlay = [...strings([intro, chapters, closing])];
const annexText = [...strings(annex)];
const cited = [...overlay, ...annexText].flatMap(citations);

test('toda cita [n] del contenido existe en sources.js', () => {
  const known = new Set(sources.map((s) => s.n));
  const missing = [...new Set(cited.filter((n) => !known.has(n)))];
  assert.deepEqual(missing, []);
});

test('toda fuente de sources.js se cita al menos una vez', () => {
  const used = new Set(cited);
  assert.deepEqual(sources.filter((s) => !used.has(s.n)).map((s) => s.n), []);
});

test('números contiguos 1..N, en orden de primera aparición', () => {
  assert.deepEqual(sources.map((s) => s.n), sources.map((_, i) => i + 1));
  const firsts = [...new Set(cited)];
  assert.deepEqual(firsts, sources.map((s) => s.n));
});

test('cada fuente tiene sus campos, una URL https y un grupo conocido', () => {
  for (const s of sources) {
    for (const k of ['title', 'publisher', 'published', 'accessed', 'url', 'kind']) {
      assert.equal(typeof s[k], 'string', `fuente ${s.n}: falta ${k}`);
      assert.ok(s[k].trim().length > 0, `fuente ${s.n}: ${k} vacío`);
    }
    assert.match(s.url, /^https:\/\/[^\s]+$/, `fuente ${s.n}: URL no https`);
    assert.ok(SOURCE_GROUPS.includes(s.kind), `fuente ${s.n}: grupo desconocido ${s.kind}`);
    assert.match(s.accessed, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('sin fuentes duplicadas (número, URL, mismo documento ni título)', () => {
  const norm = (u) => {
    const x = new URL(u);
    return x.host + x.pathname + '?' + [...x.searchParams.entries()].sort().map((e) => e.join('=')).join('&');
  };
  for (const key of [(s) => s.n, (s) => s.url, (s) => norm(s.url), (s) => s.title]) {
    const vals = sources.map(key);
    assert.equal(new Set(vals).size, vals.length);
  }
});

test('sin marcadores pendientes ni restos del borrador', () => {
  const files = ['../src/content.js', '../src/sources.js'].map((f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
  for (const text of files) {
    assert.doesNotMatch(text, /\bTODO\b|\bFIXME\b|\bXXX\b|\bTBD\b/);
    assert.doesNotMatch(text, /\{\{|\}\}/);
  }
});

test('ids de pestañas y de capítulos únicos; bloques del anexo conocidos', () => {
  const ids = annex.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(annex.map((a) => a.label)).size, annex.length);
  assert.equal(new Set(chapters.map((c) => c.id)).size, chapters.length);
  for (const id of ['arquitectura', 'calendario', 'presupuesto', 'indicadores', 'ods', 'datos', 'limites', 'fuentes']) assert.ok(ids.includes(id), `falta la pestaña ${id}`);
  for (const a of annex) {
    for (const b of a.blocks) {
      const keys = Object.keys(b);
      assert.equal(keys.length, 1, `${a.id}: bloque con varias claves`);
      assert.ok(BLOCK_TYPES.has(keys[0]), `${a.id}: bloque desconocido ${keys[0]}`);
    }
  }
  assert.equal(annex.flatMap((a) => a.blocks).filter((b) => b.sources).length, 1);
});

test('el cuerpo de cada capítulo no supera la longitud acordada', () => {
  for (const c of chapters) {
    assert.ok(c.id in BODY_BEFORE, `capítulo sin longitud de referencia: ${c.id}`);
    assert.ok(c.body.length <= BODY_BEFORE[c.id] + MAX_GROWTH, `${c.id}: ${c.body.length} caracteres (máximo ${BODY_BEFORE[c.id] + MAX_GROWTH})`);
  }
});

test('los textos del recorrido no llevan citas: sus fuentes están en la pestaña Datos', () => {
  assert.deepEqual(overlay.flatMap(citations), []);
  const datos = annex.find((a) => a.id === 'datos');
  const firstTable = datos.blocks.find((b) => b.table).table;
  assert.equal(firstTable.rows.length, chapters.length, 'una fila de datos por capítulo');
  for (const row of firstTable.rows) assert.ok(citations(row.join(' ')).length > 0, `fila sin fuente: ${row[0]}`);
});

test('la simulación y el ejemplo del 90 % siguen rotulados como ejemplos', () => {
  const ch = chapters.find((c) => c.routes);
  assert.equal(ch.routes.reduce((n, r) => n + r.count, 0), 10);
  assert.match(ch.simulation, /ejemplo/i);
  assert.match(ch.simulation, /no son datos reales/i);
  const ind = annex.find((a) => a.id === 'indicadores');
  const ex = ind.blocks.find((b) => b.example).example;
  assert.match(ex.label, /ejemplo/i);
  assert.match(ex.text, /no un dato real/i);
});
