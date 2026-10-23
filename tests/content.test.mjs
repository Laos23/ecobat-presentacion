// Coherencia del contenido y de sus fuentes (sin DOM). Ejecutar con: node --test tests/content.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { intro, chapters, closing, annex } from '../src/content.js';
import { sources, SOURCE_GROUPS } from '../src/sources.js';
import { CH } from '../src/world/chapters.js';

// v2: ocho capítulos, en el orden de los índices del mundo (src/world/chapters.js)
const CHAPTER_IDS = ['recogida', 'identificacion', 'clasificacion', 'reutilizacion', 'desmontaje', 'segunda-vida', 'reciclaje', 'trazabilidad'];
const CH_KEYS = ['recogida', 'identificacion', 'clasificacion', 'reutilizacion', 'desmontaje', 'segundaVida', 'reciclaje', 'trazabilidad'];
// El cuerpo de un capítulo se lee en pantalla sobre el 3D: como mucho 270 caracteres (unas siete líneas de 34ch).
const MAX_BODY = 270;
// Tarjeta de datos: título de 2 a 4 palabras, de 1 a 3 datos breves y cada uno con su cita.
const MAX_CARD_ITEM = 220;
const BLOCK_TYPES = new Set(['p', 'note', 'h4', 'list', 'table', 'timeline', 'example', 'goals', 'sources']);

// Cadenas en el orden en que se pintan (portada, capítulos con sus tarjetas, cierre y pestañas del anexo).
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
const cards = [...chapters.map((c) => c.card), closing.card].filter(Boolean);

test('ocho capítulos en el orden de CH (portada 0, cierre 9)', () => {
  assert.deepEqual(chapters.map((c) => c.id), CHAPTER_IDS);
  CH_KEYS.forEach((k, i) => assert.equal(CH[k], i + 1, `CH.${k}`));
  assert.equal(CH.portada, 0);
  assert.equal(CH.cierre, chapters.length + 1);
  assert.deepEqual(chapters.map((c) => c.label), ['Recogida', 'Identificación', 'Clasificación', 'Reutilización', 'Desmontaje', 'Segunda vida', 'Reciclaje', 'Trazabilidad']);
});

test('toda cita [n] del contenido existe en sources.js', () => {
  const known = new Set(sources.map((s) => s.n));
  const missing = [...new Set(cited.filter((n) => !known.has(n)))];
  assert.deepEqual(missing, []);
});

test('toda fuente de sources.js se cita al menos una vez', () => {
  const used = new Set(cited);
  assert.deepEqual(sources.filter((s) => !used.has(s.n)).map((s) => s.n), []);
});

test('números contiguos 1..N, en orden de primera aparición (tarjetas de los capítulos y después anexos)', () => {
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

test('el mapa de fuentes de docs/investigacion cubre las mismas fuentes con los mismos números', () => {
  const mapa = JSON.parse(fs.readFileSync(new URL('../docs/investigacion/mapa-fuentes.json', import.meta.url), 'utf8'));
  assert.deepEqual(mapa.map((e) => e.n), sources.map((s) => s.n));
  for (const e of mapa) assert.equal(e.url, sources[e.n - 1].url, `mapa ${e.n}: otra URL`);
  const hechos = new Set(JSON.parse(fs.readFileSync(new URL('../docs/investigacion/hechos-verificados.json', import.meta.url), 'utf8')).map((h) => h.id));
  for (const e of mapa) for (const id of e.hechos) assert.ok(hechos.has(id), `mapa ${e.n}: hecho desconocido ${id}`);
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
  for (const c of chapters) assert.ok(c.body.length <= MAX_BODY, `${c.id}: ${c.body.length} caracteres (máximo ${MAX_BODY})`);
});

test('títulos y cuerpos del recorrido sin citas; cada dato de una tarjeta, con la suya', () => {
  for (const s of [intro, ...chapters.map(({ title, body, label, routes, simulation, passport }) => ({ title, body, label, routes, simulation, passport })), { title: closing.title, body: closing.body }]) {
    assert.deepEqual([...strings(s)].flatMap(citations), []);
  }
  assert.equal(cards.length, chapters.length + 1, 'una tarjeta por capítulo y la del cierre');
  for (const card of cards) {
    const words = card.title.split(/\s+/).length;
    assert.ok(words >= 2 && words <= 4, `tarjeta «${card.title}»: ${words} palabras`);
    assert.deepEqual(citations(card.title), []);
    assert.ok(card.items.length >= 1 && card.items.length <= 3, `tarjeta «${card.title}»: ${card.items.length} datos`);
    for (const t of card.items) {
      assert.ok(citations(t).length > 0, `dato sin cita en «${card.title}»: ${t}`);
      assert.ok(t.length <= MAX_CARD_ITEM, `dato largo en «${card.title}» (${t.length})`);
    }
    if (card.example) assert.deepEqual(citations(card.example), [], 'el ejemplo no lleva cita');
  }
});

test('la pestaña Datos tiene una fila con fuente por capítulo, en el mismo orden', () => {
  const datos = annex.find((a) => a.id === 'datos');
  const firstTable = datos.blocks.find((b) => b.table).table;
  chapters.forEach((c, i) => assert.ok(firstTable.rows[i][0].startsWith(`${i + 1} · ${c.label}`), `fila ${i + 1}: ${firstTable.rows[i][0]}`));
  for (const row of firstTable.rows) assert.ok(citations(row.join(' ')).length > 0, `fila sin fuente: ${row[0]}`);
});

test('la simulación 2/1/7 y el ejemplo del 90 % siguen rotulados como ejemplos', () => {
  const ch = chapters.find((c) => c.routes);
  assert.equal(ch.id, 'clasificacion');
  assert.deepEqual(ch.routes.map((r) => [r.key, r.count]), [['service', 2], ['second', 1], ['recycle', 7]]);
  assert.deepEqual(ch.routes.map((r) => r.name), ['Vuelven a servicio', 'Batería de coche eléctrico', 'Reciclaje autorizado']);
  assert.match(ch.simulation, /ejemplo/i);
  assert.match(ch.simulation, /no son datos reales/i);
  const ind = annex.find((a) => a.id === 'indicadores');
  const ex = ind.blocks.find((b) => b.example).example;
  assert.match(ex.label, /ejemplo/i);
  assert.match(ex.text, /no un dato real/i);
});

test('reglas de fidelidad de la v2', () => {
  const all = [...overlay, ...annexText].join('\n');
  // en el reciclaje de plomo-ácido no hay cobre
  assert.doesNotMatch(all, /\bcobre\b/i);
  // la ruta del 1 del ejemplo no se confunde con el reciclaje de plomo del 7
  const second = chapters.find((c) => c.routes).routes.find((r) => r.key === 'second');
  assert.match(second.detail, /reciclador de litio/);
  // la segunda vida es del litio: la batería de arranque no sirve para ella
  const sv = chapters.find((c) => c.id === 'segunda-vida');
  assert.match(sv.body, /arranque no sirve/);
  // remanufacturar vuelve a un coche (mismo uso), no es segunda vida
  assert.match(chapters.find((c) => c.id === 'desmontaje').card.items.join(' '), /no es segunda vida/);
  // el 90 % de la remanufacturación es un umbral legal con cita, no un ejemplo
  const reman = chapters.find((c) => c.id === 'desmontaje').card.items.find((t) => /90 %/.test(t));
  assert.ok(reman && citations(reman).length > 0);
  // la ruta del taller con coche ya no existe en el recorrido
  assert.doesNotMatch([...strings(chapters)].join('\n'), /\btaller\b/i);
});
