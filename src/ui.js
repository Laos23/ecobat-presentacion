import { intro, chapters, closing, annex, SITE_URL } from './content.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

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
            <span class="route__count" data-route="${r.key}" aria-label="${r.count} baterías">0</span>
            <span class="route__text"><strong>${esc(r.name)}</strong><span>${esc(r.detail)}</span></span>
          </li>`,
        )
        .join('')}
    </ol>
    <p class="tag tag--sim">${esc(c.simulation)}</p>`;
}

function passportHTML(c) {
  return `<ol class="passport" aria-label="Historial de la batería">
    ${c.passport.map((s, i) => `<li data-step="${i}"><span class="passport__dot"></span>${esc(s)}</li>`).join('')}
  </ol>`;
}

export function buildOverlay(root) {
  const scenes = [];
  // Apertura
  scenes.push(`
    <section class="scene scene--intro" data-scene="0" aria-label="Portada">
      <h1 class="wordmark">Eco<span>Bat</span></h1>
      <p class="tagline">${esc(intro.tagline)}</p>
      <p class="lede">${esc(intro.lede)}</p>
      <p class="note">${esc(intro.note)}</p>
    </section>`);
  chapters.forEach((c, i) => {
    scenes.push(`
      <section class="scene scene--chapter scene--${c.id}" data-scene="${i + 1}" aria-label="Capítulo ${i + 1}: ${esc(c.label)}">
        <div class="scene__copy">
          <h2>${esc(c.title)}</h2>
          <p class="scene__body">${esc(c.body)}</p>
          ${c.passport ? passportHTML(c) : ''}
        </div>
        ${c.routes ? `<div class="scene__aside">${routesHTML(c)}</div>` : ''}
      </section>`);
  });
  scenes.push(`
    <section class="scene scene--closing" data-scene="${chapters.length + 1}" aria-label="Cierre">
      <h2>${esc(closing.title)}</h2>
      <p class="scene__body">${esc(closing.body)}</p>
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

function tableHTML(t) {
  return `<div class="table-wrap"><table>
    <thead><tr>${t.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function annexPanelHTML(a) {
  let h = `<h3>${esc(a.title)}</h3>`;
  if (a.intro && !a.table && !a.timeline) h += `<p>${esc(a.intro)}</p>`;
  if (a.table) h += tableHTML(a.table);
  if (a.timeline) {
    h += `<ol class="weeks">${a.timeline
      .map(([w, t, d]) => `<li><span class="weeks__when">${esc(w)}</span><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`)
      .join('')}</ol>`;
  }
  if (a.intro && (a.table || a.timeline)) h += `<p class="muted">${esc(a.intro)}</p>`;
  if (a.example) h += `<p class="example"><span class="tag tag--sim">${esc(a.example.label)}</span> ${esc(a.example.text)}</p>`;
  if (a.goals) {
    h += `<ol class="goals">${a.goals
      .map(([n, t, d]) => `<li><span class="goals__n">ODS ${esc(n)}</span><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`)
      .join('')}</ol>`;
  }
  if (a.links) {
    h += `<ul class="links">${a.links
      .map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ${ICON.link}</a></li>`)
      .join('')}</ul>`;
  }
  (a.lists || []).forEach((l) => {
    h += `<h4>${esc(l.title)}</h4><ul class="bullets">${l.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  });
  return h;
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
          (a, i) => `<button type="button" role="tab" id="tab-${a.id}" aria-controls="panel-${a.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(a.label)}</button>`,
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
      <p class="tagline">${esc(intro.tagline)}</p>
      <p class="lede">${esc(intro.lede)}</p>
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
            <div><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p>
            ${c.routes ? `<ul class="static__routes">${c.routes.map((r) => `<li class="route--${r.key}"><strong>${r.count} · ${esc(r.name)}</strong> ${esc(r.detail)}</li>`).join('')}</ul><p class="tag tag--sim">${esc(c.simulation)}</p>` : ''}
            ${c.passport ? `<p class="muted">${c.passport.map(esc).join(' → ')}</p>` : ''}
            </div>
          </li>`,
        )
        .join('')}
    </ol>
    <section class="static__closing">
      <h2>${esc(closing.title)}</h2>
      <p>${esc(closing.body)}</p>
      <button class="btn btn--primary" type="button" data-action="annex">${ICON.annex}<span>Ver anexos</span></button>
      <p><a href="./">Volver a la versión 3D</a></p>
    </section>`;
}

export const icons = ICON;
