import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import QRCode from 'qrcode';
import { buildWorld } from './world/world.js';
import { opaqueSort } from './world/chunkLights.js';
import { buildTimeline, sample, chapterState } from './camera.js';
import { buildOverlay, buildChrome, buildAnnex, buildStatic, icons } from './ui.js';
import { chapters, SITE_URL } from './content.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const params = new URLSearchParams(location.search);
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const POSTER = `${import.meta.env.BASE_URL}referencia-ecobat.png`;
const DEBUG = params.has('debug');

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Suavizado de segundo orden (amortiguamiento crítico): sigue al scroll sin frenazos ni retardo largo.
function smoothDamp(current, target, state, smoothTime, dt, maxSpeed = Infinity) {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = maxSpeed * smoothTime;
  const change = THREE.MathUtils.clamp(current - target, -maxChange, maxChange);
  const goal = current - change;
  const temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * exp;
  let out = goal + (change + temp) * exp;
  if ((target - current > 0) === (out > target)) {
    out = target;
    state.v = 0;
  }
  return out;
}

// ---------- Anexos (comunes a la vista 3D y a la estática) ----------
const annexEl = $('#anexos');
buildAnnex(annexEl);
let annexReturn = null;
const behind = () => document.querySelectorAll('#stage, #chrome, .skip, #static');
function openAnnex() {
  annexReturn = document.activeElement;
  behind().forEach((el) => (el.inert = true));
  annexEl.hidden = false;
  requestAnimationFrame(() => {
    annexEl.classList.add('is-open');
    annexEl.querySelector('[role=tab][aria-selected=true]').focus();
  });
}
function closeAnnex() {
  annexEl.classList.remove('is-open');
  behind().forEach((el) => (el.inert = false));
  setTimeout(() => {
    if (!annexEl.classList.contains('is-open')) annexEl.hidden = true;
  }, 560);
  annexReturn?.focus?.();
}
const annexOpen = () => annexEl.classList.contains('is-open');
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  if (a.dataset.action === 'annex') {
    e.preventDefault();
    annexOpen() ? closeAnnex() : openAnnex();
  } else if (a.dataset.action === 'annex-close') closeAnnex();
});

// ---------- Vista estática ----------
function startStatic(reason) {
  html.classList.add('is-static', 'is-ready');
  const el = $('#static');
  buildStatic(el, reason, POSTER);
  el.hidden = false;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && annexOpen()) closeAnnex();
    else if ((e.key === 'a' || e.key === 'A') && !annexOpen() && !e.ctrlKey && !e.metaKey && !e.altKey) openAnnex();
  });
}

if (params.has('estatica') || params.has('static')) {
  startStatic('Versión estática de la presentación.');
} else if (!hasWebGL()) {
  startStatic('Este navegador no permite WebGL, así que se muestra la versión estática.');
} else {
  start3D().catch((err) => {
    console.error(err);
    startStatic('No se pudo iniciar el mundo 3D; se muestra la versión estática.');
  });
}

async function start3D() {
  const stage = $('#stage');
  const scenes = buildOverlay(stage);
  buildChrome($('#chrome'));
  // QR del cierre como imagen: un SVG en línea con cientos de módulos se rasterizaba la primera vez que
  // aparecía y daba dos tirones en la retirada final
  QRCode.toDataURL(SITE_URL, { margin: 0, width: 480, color: { dark: '#161819', light: '#f1eee6' } }).then((url) => {
    const img = new Image();
    img.src = url;
    img.alt = `Código QR que abre ${SITE_URL}`;
    img.decoding = 'async';
    $('#qr').append(img);
  });

  // Las texturas de canvas usan Archivo: esperar a la fuente evita rótulos con la tipografía del sistema.
  await Promise.race([
    Promise.all([document.fonts.load('800 40px "Archivo Variable"'), document.fonts.load('500 28px "Archivo Variable"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  performance.mark('eb:fonts');
  // ---------- Render ----------
  const canvas = $('#world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // la comprobación de sombreadores solo hace falta al desarrollar (?debug): en producción evita lecturas
  // síncronas del registro de programas y los avisos de precisión del compilador de ANGLE en Windows
  renderer.debug.checkShaderErrors = DEBUG;
  let pixelRatio = Math.min(devicePixelRatio, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#161819');
  scene.fog = new THREE.FogExp2('#161819', 0.0045);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;

  // plano cercano a 0,5 m: la cámara nunca pasa a menos de 1,2 m de un sólido (balanceo incluido) y las esquinas
  // del plano quedan a menos de 0,7 m; con 0,12 la profundidad no separaba de lejos suelos y marcas a pocos mm
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 700);

  scene.add(new THREE.HemisphereLight('#46505a', '#1a1612', 0.75));
  const key = new THREE.DirectionalLight('#ffd9aa', 1.9);
  key.position.set(-50, 90, 60);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -90, right: 90, top: 70, bottom: -70, near: 10, far: 260 });
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9fb6c8', 0.35);
  rim.position.set(80, 40, -80);
  scene.add(rim);

  const world = buildWorld(scene, { debug: DEBUG });
  // los clones de material por fragmento se dibujan en el puesto del material que sustituyen (chunkLights.js)
  renderer.setOpaqueSort(opaqueSort);
  renderer.shadowMap.needsUpdate = true;
  performance.mark('eb:world');

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.12, 2.2);
  composer.addPass(bloom);
  const output = new OutputPass();
  composer.addPass(output);

  // ---------- Recorrido y scroll ----------
  const tl = buildTimeline();
  const space = $('#scroll-space');
  let reduced = reducedQuery.matches;

  // Con movimiento reducido la imagen solo cambia al cortar de encuadre o al cambiar el tamaño: se renderizan
  // unos fotogramas tras cada cambio (las pantallas vivas dibujan su estado final) y después nada.
  let needsRender = 6;
  function layout() {
    const w = innerWidth;
    const h = innerHeight;
    // la longitud del scroll sale del esfuerzo visual del recorrido (ver camera.js)
    space.style.height = `${Math.round((tl.screens + 1) * h)}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    composer.setPixelRatio(pixelRatio);
    bloom.resolution.set(w, h);
    needsRender = 6;
    ScrollTrigger.refresh();
  }

  // ScrollTrigger da el progreso bruto; el suavizado vive en el bucle (smoothDamp), sin doble easing.
  const trigger = ScrollTrigger.create({ trigger: space, start: 'top top', end: 'bottom bottom' });
  const progress = { p: 0, v: 0 };

  layout();
  let lastW = innerWidth;
  addEventListener('resize', () => {
    // En móvil, la barra de direcciones cambia solo la altura: no recalcular el scroll por eso.
    if (matchMedia('(pointer: coarse)').matches && innerWidth === lastW) return;
    lastW = innerWidth;
    layout();
  });

  // ---------- Navegación ----------
  const railItems = [...document.querySelectorAll('.rail__item')];
  const progressFill = $('.progress__fill');
  const btnPrev = $('[data-action=prev]');
  const btnNext = $('[data-action=next]');
  const btnFull = $('[data-action=fullscreen]');
  let current = 0;
  let pending = null;
  // Vuelo programado entre capítulos contiguos: la posición de scroll sigue al destino con un muelle
  // amortiguado (smoothDamp) y velocidad máxima en pantallas por segundo. Pulsar otra vez solo mueve el
  // destino: el vuelo conserva su velocidad, sin frenar ni volver a arrancar en cada tecla.
  const NAV_TIME = 0.5;
  const NAV_SPEED = 1.5;
  const nav = { y: null, at: 0, v: 0 };
  // con movimiento reducido, teclas y botones cortan sin esperar a que el scroll se detenga
  let forceCutUntil = 0;

  const scrollMax = () => space.offsetHeight - innerHeight;
  const veilEl = $('.veil');
  let cutTimer = null;
  function goTo(i) {
    const idx = THREE.MathUtils.clamp(i, 0, tl.anchors.length - 1);
    const target = tl.anchors[idx];
    const y = target * scrollMax();
    // Movimiento reducido: salto directo al encuadre.
    if (reduced) {
      nav.y = null;
      pending = null;
      forceCutUntil = performance.now() + 400;
      window.scrollTo(0, y);
      return;
    }
    // Saltos de dos o más capítulos: fundido breve y corte, en lugar de cruzar todo el mundo a toda velocidad.
    if (Math.abs(idx - (pending ?? current)) >= 2) {
      nav.y = null;
      pending = idx;
      veilEl.classList.add('is-fade');
      clearTimeout(cutTimer);
      cutTimer = setTimeout(() => {
        window.scrollTo(0, y);
        progress.p = target;
        progress.v = 0;
        pending = null;
        requestAnimationFrame(() => requestAnimationFrame(() => veilEl.classList.remove('is-fade')));
      }, 320);
      return;
    }
    if (nav.y === null) {
      nav.at = window.scrollY;
      nav.v = 0;
    }
    nav.y = y;
    pending = idx;
  }
  // Avanza el vuelo un fotograma; devuelve el progreso de scroll que debe seguir la cámara.
  function stepNav(dt) {
    if (nav.y === null) return null;
    // la rueda, el arrastre o la barra de desplazamiento toman el control: se cancela el vuelo
    if (Math.abs(window.scrollY - nav.at) > 3) {
      nav.y = null;
      pending = null;
      return null;
    }
    nav.at = smoothDamp(nav.at, nav.y, nav, NAV_TIME, dt, NAV_SPEED * innerHeight);
    if (Math.abs(nav.y - nav.at) < 0.5 && Math.abs(nav.v) < 4) {
      nav.at = nav.y;
      nav.y = null;
      pending = null;
    }
    window.scrollTo(0, nav.at);
    return nav.at / scrollMax();
  }
  // Pulsaciones seguidas encadenan capítulos aunque la cámara aún esté volando.
  const next = () => goTo((pending ?? current) + 1);
  const prev = () => goTo((pending ?? current) - 1);

  document.addEventListener('click', (e) => {
    // clic con ratón: el botón no se queda con el foco, así Espacio sigue avanzando capítulo
    if (e.detail) e.target.closest?.('#chrome button')?.blur();
    const g = e.target.closest('[data-goto]');
    if (g) {
      e.preventDefault();
      goTo(+g.dataset.goto);
      return;
    }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'next') next();
    if (a.dataset.action === 'prev') prev();
    if (a.dataset.action === 'fullscreen') toggleFullscreen();
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    btnFull.innerHTML = on ? icons.exit : icons.full;
    btnFull.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
  });
  if (!document.fullscreenEnabled) btnFull.hidden = true;

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (annexOpen()) {
      if (e.key === 'Escape') closeAnnex();
      return;
    }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key;
    // Espacio sobre un botón o una pestaña enfocados lo resuelve el propio control (clic nativo)
    if (k === ' ' && e.target.closest?.('button, [role=tab]')) return;
    // Los mandos de presentación envían Avance/Retroceso de página.
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) {
      e.preventDefault();
      next();
    } else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) {
      e.preventDefault();
      prev();
    } else if (k === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (k === 'End') {
      e.preventDefault();
      goTo(tl.anchors.length - 1);
    } else if (/^[1-6]$/.test(k)) {
      goTo(+k);
    } else if (k === 'f' || k === 'F') {
      toggleFullscreen();
    } else if (k === 'a' || k === 'A') {
      openAnnex();
    }
  });

  // ---------- Bucle ----------
  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  const sway = new THREE.Vector2();
  const swayTarget = new THREE.Vector2();
  const right = new THREE.Vector3();
  addEventListener('pointermove', (e) => {
    swayTarget.set((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
  });
  reducedQuery.addEventListener('change', (e) => {
    reduced = e.matches;
    needsRender = 6;
  });

  const veil = $('.veil');
  const lastIndex = chapters.length + 1;
  let shownIndex = -1;
  let cutIndex = -1;
  let lastRaw = 0;
  let lastMoveAt = 0;
  let lastCutAt = -Infinity;
  const timer = new THREE.Timer();
  timer.connect(document);
  let frames = 0;
  let slowTime = 0;
  let degraded = false;
  let frozenTime = null;
  const passportSteps = [...document.querySelectorAll('.passport li')];
  const counts = [...document.querySelectorAll('.route__count')];
  const ch4 = tl.chapters[4];
  const ch6 = tl.chapters[6];
  const story = { index: 0, vis: 1, local: 0, p: 0, sim: 0, route: null, conn: 0, reduced: false };

  // Ritmo de la GPU. Cuando la gráfica va justa, el navegador entrega a veces varios rAF seguidos (a 3-6 ms) y, sin
  // freno, la cola de la GPU junta tres, cuatro o cinco fotogramas: la presentación se detiene 120-160 ms mientras los
  // vacía (medido en la integrada de referencia). Con dos fotogramas en vuelo como máximo la GPU sigue igual de ocupada
  // y no se amontonan: si los dos anteriores no han terminado, este rAF no dibuja. El estado (scroll, cámara, pantallas
  // vivas) avanza igual en cada rAF, con el mismo dt que sin esta espera, y el siguiente fotograma que se dibuja muestra
  // el estado de su instante: lo que se dibuja no cambia.
  const gl = renderer.getContext();
  const MAX_IN_FLIGHT = 2;
  const inFlight = [];
  function gpuBusy() {
    // se liberan, en orden, los fotogramas que la GPU ya terminó; solo UNSIGNALED retiene (cualquier otra respuesta,
    // también null con el contexto perdido, libera la espera)
    while (inFlight.length && gl.getSyncParameter(inFlight[0], gl.SYNC_STATUS) !== gl.UNSIGNALED) gl.deleteSync(inFlight.shift());
    return inFlight.length >= MAX_IN_FLIGHT;
  }

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = frozenTime ?? timer.getElapsed();

    const flying = stepNav(dt);
    const raw = flying ?? trigger.progress;
    // durante un vuelo programado el scroll ya viene suavizado: el seguimiento se acorta
    const smoothTime = flying !== null ? 0.18 : 0.26;
    progress.p = smoothDamp(progress.p, raw, progress, smoothTime, dt, 0.32);
    let p = progress.p;
    let cs = chapterState(tl, p);
    if (reduced) {
      // Movimiento reducido: sin vuelos, cortes directos entre encuadres estables. Mientras el scroll se mueve no
      // se corta (un lanzamiento de rueda daría destellos a pantalla completa): un solo corte al detenerse y como
      // mucho dos por segundo; teclas y botones cortan al instante.
      const now = performance.now();
      if (Math.abs(raw - lastRaw) > 1e-5) lastMoveAt = now;
      lastRaw = raw;
      const target = chapterState(tl, raw).index;
      if (target !== cutIndex && (cutIndex === -1 || now < forceCutUntil || (now - lastMoveAt > 160 && now - lastCutAt > 450))) {
        if (cutIndex !== -1) {
          veil.classList.add('is-cut');
          requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-cut')));
        }
        cutIndex = target;
        lastCutAt = now;
        needsRender = 6;
      }
      p = tl.anchors[cutIndex];
      progress.p = p;
      cs = { index: cutIndex, vis: 1, local: 0.5 };
    }

    const shot = sample(tl, p, camera.aspect, camPos, camTgt);
    if (!reduced) {
      // balanceo mínimo con el ratón, proporcional a la distancia al sujeto para no rozar objetos cercanos
      sway.lerp(swayTarget, 1 - Math.exp(-dt * 2));
      const dist = camPos.distanceTo(camTgt);
      const amp = Math.min(0.22, dist * 0.02);
      right.subVectors(camTgt, camPos).cross(camera.up).normalize();
      camPos.addScaledVector(right, sway.x * amp);
      camPos.y -= sway.y * amp * 0.6;
    }
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    if (Math.abs(camera.fov - shot.fov) > 1e-3) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }

    // Estado narrativo: capítulo activo y procesos ligados al recorrido.
    current = cs.index;
    const sim = reduced ? (current >= 4 ? 1 : 0) : THREE.MathUtils.clamp((p - tl.marks.sim) / (ch4.anchor - tl.marks.sim), 0, 1);
    const arrived = world.setSimulation(sim);
    counts.forEach((el) => {
      const v = String(arrived[el.dataset.route]);
      if (el.textContent !== v) el.textContent = v;
    });
    const conn = reduced ? (current >= 6 ? 1 : 0) : THREE.MathUtils.clamp((p - tl.marks.conn) / (ch6.anchor - tl.marks.conn), 0, 1);
    world.setConnections(conn);
    passportSteps.forEach((li, i) => li.classList.toggle('is-on', current > 6 || (current === 6 && conn > i * 0.22)));
    story.index = cs.index;
    story.vis = cs.vis;
    story.local = cs.local;
    story.p = p;
    story.sim = sim;
    story.route = arrived.near;
    story.conn = conn;
    story.reduced = reduced;
    world.update(t, dt, story);

    scenes.forEach((el, i) => {
      const on = i === cs.index;
      const v = on ? cs.vis : 0;
      el.classList.toggle('is-on', v > 0.001);
      el.style.opacity = v.toFixed(3);
      el.style.transform = reduced ? '' : `translate3d(0, ${((1 - v) * 24).toFixed(1)}px, 0)`;
    });
    if (shownIndex !== cs.index) {
      shownIndex = cs.index;
      html.classList.toggle('is-intro', cs.index === 0);
      html.classList.toggle('is-closing', cs.index === lastIndex);
      railItems.forEach((b, i) => {
        if (i + 1 === cs.index) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
        b.classList.toggle('is-done', i + 1 < cs.index);
      });
      btnPrev.disabled = cs.index === 0;
      btnNext.disabled = cs.index === lastIndex;
    }
    progressFill.style.transform = `scaleX(${raw.toFixed(4)})`;

    if ((!reduced || needsRender > 0) && !gpuBusy()) {
      composer.render(dt);
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (fence) inFlight.push(fence);
      needsRender = Math.max(0, needsRender - 1);
    }

    // Si el equipo va justo, bajar resolución y suavizar el bloom.
    if (!degraded) {
      frames++;
      if (frames > 30 && dt > 1 / 38) slowTime += dt;
      if (slowTime > 2.5) {
        degraded = true;
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        bloom.strength = 0.16;
        layout();
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- Calentamiento bajo el velo ----------
  // Lo que el driver hace la primera vez que un programa, un estado o una textura entran en cuadro (variantes de
  // sombreador por formato de vértices y de destino, materiales de sombra y de salida, mapa de sombras) se adelanta a la
  // carga: se dibujan a tamaño mínimo los encuadres del recorrido, con la simulación y las conexiones de cada uno. Sin
  // tocar el DOM ni el estado de las estaciones; después se restaura el tamaño real.
  // No se llama a world.update: las estaciones guardan estado entre fotogramas (pantallas que solo se redibujan al
  // cambiar su lectura, contadores, la baliza y la cinta del reciclaje, el desplazamiento de las trazas, el guion del
  // taller) y lo que dejara el calentamiento se vería en la primera visita. Con movimiento reducido ese estado no se
  // vuelve a escribir nunca: llamándolo, 7 de los 8 capítulos salían distintos en la primera visita.
  function renderAt(p) {
    const shot = sample(tl, p, camera.aspect, camPos, camTgt);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    if (Math.abs(camera.fov - shot.fov) > 1e-3) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
    // mismas fórmulas que frame() sin movimiento reducido; las dos son funciones puras de su valor y warmUp() las
    // devuelve a 0
    world.setSimulation(THREE.MathUtils.clamp((p - tl.marks.sim) / (ch4.anchor - tl.marks.sim), 0, 1));
    world.setConnections(THREE.MathUtils.clamp((p - tl.marks.conn) / (ch6.anchor - tl.marks.conn), 0, 1));
    composer.render(1 / 60);
  }
  // portada, anclajes, arranque de la simulación y de las conexiones, y los tramos de vuelo largos
  const WARMUP_POINTS = [0, ...tl.anchors.slice(1), tl.marks.sim, tl.marks.conn, 0.2525, 0.512, 0.668, 0.915];
  async function warmUp() {
    const fov = camera.fov;
    // solo el compositor dibuja a 64×36; el lienzo no cambia de tamaño: encogerlo costaba unos 160 ms en la RTX 5090
    // (13 ms en la integrada), y el pase de salida dibuja su cuadro a tamaño real por muy poco
    composer.setSize(64, 36);
    bloom.resolution.set(64, 36);
    for (const p of WARMUP_POINTS) {
      renderAt(p);
      // un fotograma entre encuadres: el hilo principal respira y la barra del velo sigue avanzando
      await new Promise(requestAnimationFrame);
    }
    world.setSimulation(0);
    world.setConnections(0);
    // la cámara vuelve a su apertura inicial: frame() solo la cambia si difiere más de 1e-3
    camera.fov = fov;
    // el primer encuadre generó el mapa de sombras (y compiló sus materiales) con el mundo tal como sale de buildWorld;
    // el primer fotograma real lo vuelve a generar después de su world.update, como sin calentamiento
    renderer.shadowMap.needsUpdate = true;
    layout();
  }

  // Materiales de profundidad del mapa de sombras. three los crea al dibujar la sombra (WebGLShadowMap.getDepthMaterial):
  // un MeshDepthMaterial con las opciones por defecto, ajustado por combinación de cara, mapa, prueba alfa e
  // instanciado, que compilaba en síncrono el primer encuadre del calentamiento. Se reproducen aquí con las mismas
  // opciones y sobre las mismas geometrías para compilarlos a la vez que el mundo: la sombra encuentra sus programas
  // hechos (misma clave de programa).
  function shadowDepthScene() {
    const flip = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
    const out = new THREE.Scene();
    const seen = new Set();
    scene.traverseVisible((o) => {
      if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || o.customDepthMaterial !== undefined) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || m.visible === false) continue;
        const side = m.shadowSide !== null ? m.shadowSide : flip[m.side];
        const alphaTest = m.alphaToCoverage === true ? 0.5 : m.alphaTest;
        const g = o.geometry;
        const instanced = o.isInstancedMesh === true;
        const key = [side, m.map?.channel ?? -1, m.alphaMap?.channel ?? -1, alphaTest > 0, m.displacementMap?.channel ?? -1, instanced, instanced && o.instanceColor !== null, instanced && o.morphTexture !== null, !!g.morphAttributes.position, !!g.morphAttributes.normal, !!g.morphAttributes.color, !!g.attributes.normal].join();
        if (seen.has(key)) continue;
        seen.add(key);
        const dm = new THREE.MeshDepthMaterial();
        dm.side = side;
        dm.alphaMap = m.alphaMap;
        dm.alphaTest = alphaTest;
        dm.map = m.map;
        dm.displacementMap = m.displacementMap;
        dm.displacementScale = m.displacementScale;
        dm.displacementBias = m.displacementBias;
        const mesh = instanced ? new THREE.InstancedMesh(g, dm, 1) : new THREE.Mesh(g, dm);
        if (instanced) {
          mesh.instanceColor = o.instanceColor;
          mesh.morphTexture = o.morphTexture;
        }
        out.add(mesh);
      }
    });
    return out;
  }

  // Sombreadores compilados en paralelo antes del primer fotograma (KHR_parallel_shader_compile cuando
  // existe): la primera carga no bloquea el hilo principal y el velo de carga sigue animándose.
  // (con el destino del compositor activo: los programas salen con las mismas opciones de tono y color)
  try {
    renderer.setRenderTarget(composer.readBuffer);
    // los materiales del bloom (que dibuja siempre en sus propios destinos) y el de salida se compilan a la vez que
    // los del mundo: si no, el primer fotograma del calentamiento los compila uno a uno con el hilo principal parado
    const quad = new THREE.BufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    const post = new THREE.Scene();
    // el pase de salida fija sus defines (transferencia sRGB y curva de tono) la primera vez que dibuja; se fijan ya,
    // en el mismo orden que hará él, para que su programa salga ahora con la misma clave
    const defines = {};
    if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) defines.SRGB_TRANSFER = '';
    const tone = { [THREE.LinearToneMapping]: 'LINEAR_TONE_MAPPING', [THREE.ReinhardToneMapping]: 'REINHARD_TONE_MAPPING', [THREE.CineonToneMapping]: 'CINEON_TONE_MAPPING', [THREE.ACESFilmicToneMapping]: 'ACES_FILMIC_TONE_MAPPING', [THREE.AgXToneMapping]: 'AGX_TONE_MAPPING', [THREE.NeutralToneMapping]: 'NEUTRAL_TONE_MAPPING' }[renderer.toneMapping];
    if (tone) defines[tone] = '';
    output.material.defines = defines;
    [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, output.material].forEach((m) => post.add(new THREE.Mesh(quad, m)));
    const compiling = [renderer.compileAsync(scene, camera), renderer.compileAsync(post, camera)];
    // la sombra se dibuja con la escena vacía de three, sin niebla, y la clave de sus programas no la lleva: la
    // niebla se quita solo mientras compile() calcula las claves (es síncrono) y se devuelve enseguida
    const fog = scene.fog;
    scene.fog = null;
    try {
      compiling.push(renderer.compileAsync(shadowDepthScene(), camera, scene));
    } finally {
      scene.fog = fog;
    }
    // mientras la GPU compila, el hilo principal solo espera: se suben ya las texturas de los materiales, que el
    // primer fotograma subiría todas de golpe (mismo camino de subida que al dibujar)
    const textures = new Set();
    scene.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      }
    });
    try {
      textures.forEach((tex) => renderer.initTexture(tex));
    } catch {
      /* las que falten se suben al dibujar */
    }
    await Promise.all(compiling);
  } catch {
    /* el primer fotograma compilará lo que falte */
  }
  renderer.setRenderTarget(null);
  performance.mark('eb:compiled');
  await warmUp();
  performance.mark('eb:warm');
  requestAnimationFrame(() => {
    frame();
    performance.mark('eb:first');
    setTimeout(() => html.classList.add('is-ready'), 120);
  });

  // Estado expuesto para las pruebas automáticas.
  window.__ecobat = {
    tl,
    goTo,
    get chapter() {
      return current;
    },
    get p() {
      return progress.p;
    },
    renderer,
  };
  if (DEBUG) window.__ecobat.debug = makeDebug();

  // Herramientas de verificación (solo con ?debug): colocar la cámara, medir holguras y giros.
  function makeDebug() {
    const tmpP = new THREE.Vector3();
    const tmpT = new THREE.Vector3();
    const q = new THREE.Vector3();
    const local = new THREE.Vector3();
    const distTo = (pt, c) => {
      local.copy(pt).applyMatrix4(c.inv).clamp(c.min, c.max).applyMatrix4(c.m);
      return pt.distanceTo(local);
    };
    return {
      scene,
      camera,
      setProgress(p) {
        window.scrollTo(0, p * scrollMax());
        trigger.update?.();
        progress.p = p;
        progress.v = 0;
      },
      freeze(time) {
        frozenTime = time;
      },
      shot(p, aspect = camera.aspect) {
        const s = sample(tl, p, aspect, tmpP, tmpT);
        return { pos: tmpP.toArray(), target: tmpT.toArray(), fov: s.fov, k: s.k, chapter: chapterState(tl, p).index };
      },
      // distancia mínima de la cámara a cualquier sólido a lo largo de todo el recorrido
      // (incluye las ocho posiciones extremas del balanceo con el ratón, que desplaza la cámara hasta 22 cm)
      clearance({ samples = 2500, limit = 0.6, worst = 30, aspect = 16 / 9 } = {}) {
        const cols = world.colliders || [];
        const out = [];
        let min = Infinity;
        const swayDirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        const base = new THREE.Vector3();
        const side = new THREE.Vector3();
        for (let i = 0; i <= samples; i++) {
          const p = i / samples;
          sample(tl, p, aspect, base, tmpT);
          const amp = Math.min(0.22, base.distanceTo(tmpT) * 0.02);
          side.subVectors(tmpT, base).cross(camera.up).normalize();
          let best = Infinity;
          let who = null;
          for (const [sx, sy] of swayDirs) {
            tmpP.copy(base).addScaledVector(side, sx * amp);
            tmpP.y -= sy * amp * 0.6;
            for (const c of cols) {
              const d = distTo(tmpP, c);
              if (d < best) {
                best = d;
                who = c;
              }
            }
          }
          tmpP.copy(base);
          min = Math.min(min, best);
          if (best < limit) {
            q.set(0, 0, 0).applyMatrix4(who.m);
            out.push({ p: +p.toFixed(4), d: +best.toFixed(3), chapter: chapterState(tl, p).index, cam: tmpP.toArray().map((v) => +v.toFixed(2)), hit: who.label, hitAt: q.toArray().map((v) => +v.toFixed(2)) });
          }
        }
        out.sort((a, b) => a.d - b.d);
        return { colliders: cols.length, samples, min: +min.toFixed(3), violations: out.length, worst: out.slice(0, worst) };
      },
      // giros: velocidad angular de la mirada por pantalla de scroll, cabeceo extremo
      motion({ samples = 3000, aspect = 16 / 9 } = {}) {
        let prevDir = null;
        let maxTurn = 0;
        let maxTurnAt = 0;
        let maxPitch = 0;
        const dir = new THREE.Vector3();
        const perScreen = tl.screens / samples;
        for (let i = 0; i <= samples; i++) {
          const p = i / samples;
          sample(tl, p, aspect, tmpP, tmpT);
          dir.subVectors(tmpT, tmpP).normalize();
          maxPitch = Math.max(maxPitch, Math.abs(Math.asin(dir.y)));
          if (prevDir) {
            const turn = Math.acos(Math.min(1, dir.dot(prevDir))) / perScreen;
            if (turn > maxTurn) {
              maxTurn = turn;
              maxTurnAt = p;
            }
          }
          prevDir = dir.clone();
        }
        // por tramo: giro máximo (°/pantalla) y velocidad máxima (m/pantalla)
        const segs = [];
        const C = tl.chapters;
        for (let c = 0; c < C.length; c++) {
          segs.push({ name: `ventana ${c}`, a: C[c].in, b: C[c].out });
          if (c < C.length - 1) segs.push({ name: `${c}→${c + 1}`, a: C[c].out, b: C[c + 1].in });
        }
        const per = segs.map((sg) => {
          let turn = 0;
          let turnK = 0;
          let speed = 0;
          let prevD2 = null;
          let prevP2 = null;
          const N = 400;
          const dpScreen = ((sg.b - sg.a) / N) * tl.screens;
          if (dpScreen <= 0) return { name: sg.name, screens: 0 };
          for (let i = 0; i <= N; i++) {
            const p = sg.a + ((sg.b - sg.a) * i) / N;
            sample(tl, p, aspect, tmpP, tmpT);
            dir.subVectors(tmpT, tmpP).normalize();
            if (prevD2) {
              const tr = Math.acos(Math.min(1, dir.dot(prevD2))) / dpScreen;
              if (tr > turn) {
                turn = tr;
                turnK = sample(tl, p, aspect, tmpP, tmpT).k;
                dir.subVectors(tmpT, tmpP).normalize();
              }
              speed = Math.max(speed, tmpP.distanceTo(prevP2) / dpScreen);
            }
            prevD2 = dir.clone();
            prevP2 = tmpP.clone();
          }
          return { name: sg.name, screens: +((sg.b - sg.a) * tl.screens).toFixed(2), maxTurnDeg: +THREE.MathUtils.radToDeg(turn).toFixed(0), atKey: +turnK.toFixed(2), maxSpeedM: +speed.toFixed(1) };
        });
        return {
          segments: per,
          screens: +tl.screens.toFixed(2),
          maxTurnDegPerScreen: +THREE.MathUtils.radToDeg(maxTurn).toFixed(1),
          maxTurnAt: +maxTurnAt.toFixed(4),
          maxPitchDeg: +THREE.MathUtils.radToDeg(maxPitch).toFixed(1),
          chapters: tl.chapters.map((c) => ({ in: +c.in.toFixed(4), anchor: +c.anchor.toFixed(4), out: +c.out.toFixed(4) })),
        };
      },
      info() {
        return { ...renderer.info.render, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
      },
      // fragmentos del mundo (world.js): clave, mallas e instanciadas de cada uno (vacío con &nobake)
      chunks() {
        return world.chunks.map((c) => ({ ...c }));
      },
      // luces por fragmento (world.js): las luces locales que alcanzan la caja de una malla iluminada y no están
      // en el conjunto de su fragmento (vacío si los conjuntos son correctos, y con &nobake)
      checkLights() {
        return world.checkLights();
      },
    };
  }
}
