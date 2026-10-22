import { intro, chapters, closing, annex, SITE_URL } from './content.js';
import { sources, SOURCE_GROUPS } from './sources.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const SOURCE = new Map(sources.map((s) => [s.n, s]));
// Marcadores de cita: [4], [1, 2] o [3–5]; cada número enlaza a su fuente de src/sources.js.
const CITE = /\s?\[(\d+(?:\s*[,–]\s*\d+)*)\]/g;
// Tipografía: cifra y unidad unidas («60 %», «12,6 V»), fechas e intervalos sin partir («18-2-2027», «12,6-12,65»),
// códigos de residuo («16 06 01*»), «art. 13.6», «UN 2794» y «3 · Diagnóstico».
const UNIT = /(\d) (%|V\b|kg\b|kWh\b|MJ\b|Ah\b|°C|€|\$|t\b|mm\b|cm\b|h\b|s\b|mg\b|MiB\b|minutos\b|años\b|baterías\b)/g;
const RANGE = /\d+(?:[.,]\d+)?(?:[-–]\d+(?:[.,]\d+)?)+/g;
const CODE = /\b(\d\d) (\d\d) (\d\d\*?)/g;
const ABBR = /\b(arts?\.|n\.º|UN) (?=\d)/g;
const DOT = /(\d) · /g;

function citeLink(n) {
  const s = SOURCE.get(+n);
  if (!s) return n;
  const label = `Fuente ${n}: ${s.title}`;
  return `<a class="cite" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(label)}" aria-label="${esc(label)}">${n}</a>`;
}

const typo = (t) =>
  esc(t)
    .replace(UNIT, '$1\u00a0$2')
    .replace(CODE, '$1\u00a0$2\u00a0$3')
    .replace(ABBR, '$1\u00a0')
    .replace(DOT, '$1\u00a0·\u00a0')
    .replace(RANGE, '<span class="nw">$&</span>');

// Única vía para pintar texto de contenido: escapa el HTML, aplica la tipografía y convierte los marcadores [n]
// en enlaces a la fuente (la cita queda pegada a la palabra anterior y no se parte).
function rich(s) {
  const str = String(s);
  let html = '';
  let last = 0;
  for (const m of str.matchAll(CITE)) {
    const links = m[1].split(/\s*,\s*/).map((part) => part.split(/\s*–\s*/).map(citeLink).join('–'));
    html += `${typo(str.slice(last, m.index))}${/^\s/.test(m[0]) ? '\u00a0' : ''}<span class="cites">[${links.join(', ')}]</span>`;
    last = m.index + m[0].length;
  }
  return html + typo(str.slice(last));
}

const ICON = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  exit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  annex: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>',
};

function routesHTML(c) {
  return `
    <ol class="routes" aria-label="Rutas de gestión">
      ${c.routes
        .map(
          (r) => `<li class="route route--${r.key}">
            <span class="route__count" data-route="${r.key}" aria-hidden="true">0</span><span class="sr-only">${r.count} baterías: </span>
            <span class="route__text"><strong>${rich(r.name)}</strong><span>${rich(r.detail)}</span></span>
          </li>`,
        )
        .join('')}
    </ol>
    <p class="tag tag--sim">${rich(c.simulation)}</p>`;
}

function passportHTML(c) {
  return `<ol class="passport" aria-label="Historial de la batería">
    ${c.passport.map((s, i) => `<li data-step="${i}"><span class="passport__dot"></span>${rich(s)}</li>`).join('')}
  </ol>`;
}

export function buildOverlay(root) {
  const scenes = [];
  // Apertura
  scenes.push(`
    <section class="scene scene--intro" data-scene="0" aria-label="Portada">
      <h1 class="wordmark">Eco<span>Bat</span></h1>
      <p class="tagline">${rich(intro.tagline)}</p>
      <p class="lede">${rich(intro.lede)}</p>
      <p class="note">${rich(intro.note)}</p>
    </section>`);
  chapters.forEach((c, i) => {
    scenes.push(`
      <section class="scene scene--chapter scene--${c.id}" data-scene="${i + 1}" aria-label="Capítulo ${i + 1}: ${esc(c.label)}">
        <div class="scene__copy">
          <h2>${rich(c.title)}</h2>
          <p class="scene__body">${rich(c.body)}</p>
          ${c.passport ? passportHTML(c) : ''}
        </div>
        ${c.routes ? `<div class="scene__aside">${routesHTML(c)}</div>` : ''}
      </section>`);
  });
  scenes.push(`
    <section class="scene scene--closing" data-scene="${chapters.length + 1}" aria-label="Cierre">
      <h2>${rich(closing.title)}</h2>
      <p class="scene__body">${rich(closing.body)}</p>
      <div class="closing__actions">
        <figure class="qr">
          <div class="qr__code" id="qr"></div>
          <figcaption>Abre esta presentación<br><span>${esc(SITE_URL.replace('https://', ''))}</span></figcaption>
        </figure>
        <button class="btn btn--primary" type="button" data-action="annex">${ICON.annex}<span>Ver anexos</span></button>
      </div>
    </section>`);
  root.innerHTML = scenes.join('');
  return [...root.querySelectorAll('.scene')];
}

export function buildChrome(root) {
  root.innerHTML = `
    <a class="brand" href="#" data-goto="0" aria-label="EcoBat, volver a la portada">Eco<span>Bat</span></a>
    <p class="keys" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd> capítulos · <kbd>F</kbd> pantalla completa · <kbd>A</kbd> anexos</p>
    <p class="cue" aria-hidden="true">Desliza o pulsa <kbd>→</kbd></p>
    <div class="dock">
      <div class="progress" aria-hidden="true"><span class="progress__fill"></span></div>
      <nav class="rail" aria-label="Capítulos">
        ${chapters
          .map(
            (c, i) => `<button type="button" class="rail__item" data-goto="${i + 1}" aria-label="Capítulo ${i + 1}: ${esc(c.label)}">
              <span class="rail__num">${i + 1}</span><span class="rail__label">${esc(c.label)}</span>
            </button>`,
          )
          .join('')}
      </nav>
      <div class="controls">
        <button type="button" class="icon-btn" data-action="prev" aria-label="Capítulo anterior">${ICON.prev}</button>
        <button type="button" class="icon-btn" data-action="next" aria-label="Capítulo siguiente">${ICON.next}</button>
        <button type="button" class="icon-btn" data-action="annex" aria-label="Abrir anexos">${ICON.annex}</button>
        <button type="button" class="icon-btn" data-action="fullscreen" aria-label="Pantalla completa">${ICON.full}</button>
      </div>
    </div>`;
}

// Tablas del anexo: cabecera de columna y primera celda de cada fila como cabecera de fila. Las de tres columnas
// o más (o con stack: true) se apilan en pantallas estrechas (cada celda lleva su columna en data-label); los roles
// ARIA conservan la semántica de tabla cuando el CSS cambia su display.
function tableHTML(t) {
  const stack = Boolean(t.stack) || t.head.length > 2;
  const role = (r) => (stack ? ` role="${r}"` : '');
  const label = (h) => esc(String(h).replace(CITE, '').trim());
  return `<div class="table-wrap${stack ? ' table-wrap--stack' : ''}"><table${role('table')}>
    <thead${role('rowgroup')}><tr${role('row')}>${t.head.map((h) => `<th scope="col"${role('columnheader')}>${rich(h)}</th>`).join('')}</tr></thead>
    <tbody${role('rowgroup')}>${t.rows
      .map(
        (r) =>
          `<tr${role('row')}>${r
            .map((c, i) =>
              i === 0
                ? `<th scope="row"${role('rowheader')}>${rich(c)}</th>`
                : `<td${role('cell')}${stack ? ` data-label="${label(t.head[i])}"` : ''}>${rich(c)}</td>`,
            )
            .join('')}</tr>`,
      )
      .join('')}</tbody>
  </table></div>`;
}

// Fecha de publicación abreviada para la lista: «2026-01 (PDF creado…)» → «2026-01».
const shortDate = (s) => String(s).split(/\s\(|;/)[0].trim();

// Fuentes numeradas, agrupadas por tipo (en cada grupo, por número).
function sourcesHTML() {
  return SOURCE_GROUPS.map((g) => {
    const list = sources.filter((s) => s.kind === g);
    if (!list.length) return '';
    return `<h4>${esc(g)}</h4><ul class="links sources">${list
      .map(
        (s) => `<li><span class="muted">[${s.n}]</span> <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ${ICON.link}</a><span class="muted"> · ${esc(s.publisher)} · <span class="nw">${esc(shortDate(s.published))}</span></span></li>`,
      )
      .join('')}</ul>`;
  }).join('');
}

// Bloques de una pestaña, en el orden de content.js (ese orden fija la numeración de las citas).
const BLOCK = {
  p: (v) => `<p>${rich(v)}</p>`,
  note: (v) => `<p class="muted">${rich(v)}</p>`,
  h4: (v) => `<h4>${rich(v)}</h4>`,
  list: (v) => `<ul class="bullets">${v.map((i) => `<li>${rich(i)}</li>`).join('')}</ul>`,
  table: tableHTML,
  timeline: (v) =>
    `<ol class="weeks">${v
      .map(([w, t, d]) => `<li><span class="weeks__when">${rich(w)}</span><strong>${rich(t)}</strong><span>${rich(d)}</span></li>`)
      .join('')}</ol>`,
  example: (v) => `<p class="example"><span class="tag tag--sim">${rich(v.label)}</span> ${rich(v.text)}</p>`,
  goals: (v) =>
    `<ol class="goals">${v
      .map(([n, t, d]) => `<li><span class="goals__n">ODS ${esc(n)}</span><strong>${rich(t)}</strong><span>${rich(d)}</span></li>`)
      .join('')}</ol>`,
  sources: sourcesHTML,
};

function annexPanelHTML(a) {
  return `<h3>${rich(a.title)}</h3>${a.blocks
    .map((b) => {
      const [k, v] = Object.entries(b)[0];
      return BLOCK[k](v);
    })
    .join('')}`;
}

export function buildAnnex(root) {
  root.innerHTML = `
    <div class="annex__head">
      <h2 id="annex-title">Anexos</h2>
      <button type="button" class="icon-btn" data-action="annex-close" aria-label="Cerrar anexos">${ICON.close}</button>
    </div>
    <div class="annex__tabs" role="tablist" aria-label="Secciones de los anexos">
      ${annex
        .map(
          (a, i) => `<button type="button" role="tab" id="tab-${a.id}" aria-controls="panel-${a.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${rich(a.label)}</button>`,
        )
        .join('')}
    </div>
    <div class="annex__body">
      ${annex
        .map(
          (a, i) => `<section role="tabpanel" id="panel-${a.id}" aria-labelledby="tab-${a.id}" ${i === 0 ? '' : 'hidden'} tabindex="0">${annexPanelHTML(a)}</section>`,
        )
        .join('')}
    </div>
    <p class="annex__foot"><a href="?estatica=1">Ver la versión estática de la presentación</a></p>`;

  const tabs = [...root.querySelectorAll('[role=tab]')];
  const select = (i) => {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      root.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        select((i + 1) % tabs.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        select((i - 1 + tabs.length) % tabs.length);
      }
    });
  });
}

// Vista estática: para movimiento reducido elegido o sin WebGL.
export function buildStatic(root, reason, posterUrl) {
  root.innerHTML = `
    <header class="static__head">
      <h1 class="wordmark">Eco<span>Bat</span></h1>
      <p class="tagline">${rich(intro.tagline)}</p>
      <p class="lede">${rich(intro.lede)}</p>
      <p class="static__reason">${esc(reason)}</p>
    </header>
    <figure class="static__poster">
      <img src="${posterUrl}" alt="Ilustración del mundo EcoBat: depósito, taller, laboratorio, cruce de tres rutas, planta de reciclaje y centro de trazabilidad conectados por una línea lima." width="1983" height="793" loading="eager">
      <figcaption>Ilustración conceptual de referencia; no muestra instalaciones reales.</figcaption>
    </figure>
    <ol class="static__steps">
      ${chapters
        .map(
          (c, i) => `<li>
            <span class="static__num">${i + 1}</span>
            <div><h2>${rich(c.title)}</h2><p>${rich(c.body)}</p>
            ${c.routes ? `<ul class="static__routes">${c.routes.map((r) => `<li class="route--${r.key}"><strong>${r.count} · ${rich(r.name)}</strong> ${rich(r.detail)}</li>`).join('')}</ul><p class="tag tag--sim">${rich(c.simulation)}</p>` : ''}
            ${c.passport ? `<p class="muted">${c.passport.map(rich).join(' → ')}</p>` : ''}
            </div>
          </li>`,
        )
        .join('')}
    </ol>
    <section class="static__closing">
      <h2>${rich(closing.title)}</h2>
      <p>${rich(closing.body)}</p>
      <button class="btn btn--primary" type="button" data-action="annex">${ICON.annex}<span>Ver anexos</span></button>
      <p><a href="./">Volver a la versión 3D</a></p>
    </section>`;
}

export const icons = ICON;
