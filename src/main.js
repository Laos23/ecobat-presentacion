import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import QRCode from 'qrcode';
import { buildWorld } from './world/world.js';
import { buildTimeline, sample, chapterState } from './camera.js';
import { buildOverlay, buildChrome, buildAnnex, buildStatic, icons } from './ui.js';
import { chapters, SITE_URL } from './content.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const params = new URLSearchParams(location.search);
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const POSTER = `${import.meta.env.BASE_URL}referencia-ecobat.png`;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// ---------- Anexos (comunes a la vista 3D y a la estática) ----------
const annexEl = $('#anexos');
buildAnnex(annexEl);
let annexReturn = null;
function openAnnex() {
  annexReturn = document.activeElement;
  annexEl.hidden = false;
  requestAnimationFrame(() => {
    annexEl.classList.add('is-open');
    annexEl.querySelector('[role=tab][aria-selected=true]').focus();
  });
}
function closeAnnex() {
  annexEl.classList.remove('is-open');
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
  });
}

if (params.has('estatica')) {
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
  QRCode.toString(SITE_URL, { type: 'svg', margin: 0, color: { dark: '#161819', light: '#f1eee6' } }).then((svg) => {
    $('#qr').innerHTML = svg;
    $('#qr svg').setAttribute('role', 'img');
    $('#qr svg').setAttribute('aria-label', `Código QR que abre ${SITE_URL}`);
  });

  // Las texturas de canvas usan Archivo: esperar a la fuente evita rótulos con la tipografía del sistema.
  await Promise.race([
    Promise.all([document.fonts.load('800 40px "Archivo Variable"'), document.fonts.load('500 28px "Archivo Variable"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  // ---------- Render ----------
  const canvas = $('#world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
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
  scene.fog = new THREE.FogExp2('#161819', 0.0052);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 600);

  scene.add(new THREE.HemisphereLight('#4a535c', '#0e1011', 0.9));
  const key = new THREE.DirectionalLight('#ffe0b5', 1.5);
  key.position.set(-50, 90, 60);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -90, right: 90, top: 70, bottom: -70, near: 10, far: 260 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9fb6c8', 0.35);
  rim.position.set(80, 40, -80);
  scene.add(rim);

  const world = buildWorld(scene);
  renderer.shadowMap.needsUpdate = true;

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.42, 1.0);
  composer.addPass(bloom);
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.52;
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  composer.addPass(new OutputPass());

  // ---------- Línea de tiempo y scroll ----------
  const tl = buildTimeline();
  const space = $('#scroll-space');
  const state = { p: 0 };
  let reduced = reducedQuery.matches;

  function layout() {
    const w = innerWidth;
    const h = innerHeight;
    space.style.height = `${Math.round(tl.total * h)}px`;
    camera.aspect = w / h;
    // en vertical se abre el campo de visión para no perder la estación
    camera.fov = w / h < 1 ? 58 : w / h < 1.4 ? 46 : 38;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    composer.setPixelRatio(pixelRatio);
    bloom.resolution.set(w, h);
    tiltH.uniforms.h.value = 1.6 / (w * pixelRatio);
    tiltV.uniforms.v.value = 1.6 / (h * pixelRatio);
    ScrollTrigger.refresh();
  }

  const trigger = ScrollTrigger.create({
    trigger: space,
    start: 'top top',
    end: 'bottom bottom',
  });
  // GSAP suaviza el progreso: la cámara llega y se queda quieta cuando el scroll se detiene.
  gsap.to(state, {
    p: 1,
    ease: 'none',
    scrollTrigger: { trigger: space, start: 'top top', end: 'bottom bottom', scrub: 1.1 },
  });

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

  function scrollMax() {
    return space.offsetHeight - innerHeight;
  }
  function goTo(i) {
    const idx = THREE.MathUtils.clamp(i, 0, tl.anchors.length - 1);
    const y = tl.anchors[idx] * scrollMax();
    const hops = Math.abs(idx - current);
    const done = () => {
      if (navTween === tween) pending = null;
    };
    const tween = gsap.to(window, {
      scrollTo: { y, autoKill: true },
      duration: reduced ? 0 : Math.min(1.5 + hops * 0.7, 4.5),
      ease: 'power2.inOut',
      overwrite: true,
      onComplete: done,
      onInterrupt: done,
    });
    navTween = tween;
    pending = idx;
  }
  // Pulsaciones seguidas encadenan capítulos aunque la cámara aún esté volando.
  let pending = null;
  let navTween = null;
  const next = () => goTo((pending ?? current) + 1);
  const prev = () => goTo((pending ?? current) - 1);

  document.addEventListener('click', (e) => {
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
  addEventListener('pointermove', (e) => {
    swayTarget.set((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
  });
  reducedQuery.addEventListener('change', (e) => (reduced = e.matches));

  const veil = $('.veil');
  const lastIndex = chapters.length + 1;
  let shownIndex = -1;
  let cutIndex = -1;
  const timer = new THREE.Timer();
  timer.connect(document);
  let frames = 0;
  let slowTime = 0;
  let degraded = false;
  const passportSteps = [...document.querySelectorAll('.passport li')];
  const counts = [...document.querySelectorAll('.route__count')];

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();

    const raw = trigger.progress;
    let p = state.p;
    let cs = chapterState(tl, p);
    if (reduced) {
      // Movimiento reducido: sin vuelos, cortes directos entre encuadres estables.
      const target = chapterState(tl, raw).index;
      if (target !== cutIndex) {
        if (cutIndex !== -1) {
          veil.classList.add('is-cut');
          requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-cut')));
        }
        cutIndex = target;
      }
      p = tl.anchors[target];
      cs = { index: target, vis: 1, local: 0.5 };
    }

    sample(tl, p, camPos, camTgt);
    if (camera.aspect < 1) {
      // En vertical la cámara se aleja para que la estación quepa a lo ancho
      // y, en la portada, centra el diorama en la mitad inferior.
      const introW = cs.index === 0 ? cs.vis : 0;
      camTgt.add(new THREE.Vector3(14, 0, 10).multiplyScalar(introW));
      camPos.add(new THREE.Vector3(14, -4, 30).multiplyScalar(introW));
      camPos.sub(camTgt).multiplyScalar(1 + (1 - camera.aspect) * 0.75).add(camTgt);
    }
    if (!reduced) {
      sway.lerp(swayTarget, 1 - Math.exp(-dt * 2));
      const right = new THREE.Vector3().subVectors(camTgt, camPos).cross(camera.up).normalize();
      camPos.addScaledVector(right, sway.x * 0.35).add(new THREE.Vector3(0, -sway.y * 0.25, 0));
    }
    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    // Estado narrativo: capítulo activo y animaciones ligadas al progreso.
    current = cs.index;
    const sim = current < 4 ? 0 : current > 4 ? 1 : THREE.MathUtils.clamp(cs.local + 0.55, 0, 1);
    const arrived = world.setSimulation(reduced && current >= 4 ? 1 : sim);
    counts.forEach((el) => {
      const v = String(arrived[el.dataset.route]);
      if (el.textContent !== v) el.textContent = v;
    });
    const con = current < 6 ? 0 : current > 6 ? 1 : THREE.MathUtils.clamp(cs.local + 0.6, 0, 1);
    world.setConnections(reduced && current >= 6 ? 1 : con);
    passportSteps.forEach((li, i) => li.classList.toggle('is-on', current > 6 || (current === 6 && (reduced || con > i * 0.22))));
    world.update(t, dt);

    scenes.forEach((el, i) => {
      const on = i === cs.index;
      const v = on ? cs.vis : 0;
      el.classList.toggle('is-on', v > 0.001);
      el.style.opacity = v.toFixed(3);
      if (!reduced) {
        el.style.transform = `translate3d(0, ${((1 - v) * 24).toFixed(1)}px, 0)`;
        el.style.filter = v < 0.999 ? `blur(${((1 - v) * 6).toFixed(1)}px)` : '';
      } else {
        el.style.transform = '';
        el.style.filter = '';
      }
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

    composer.render(dt);

    // Si el equipo va justo, bajar resolución y quitar el desenfoque de maqueta.
    if (!degraded) {
      frames++;
      if (frames > 30 && dt > 1 / 38) slowTime += dt;
      if (slowTime > 2.5) {
        degraded = true;
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        tiltH.enabled = tiltV.enabled = false;
        bloom.strength = 0.3;
        layout();
      }
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(() => {
    frame();
    setTimeout(() => html.classList.add('is-ready'), 120);
  });

  // Exponer el estado solo para las pruebas automáticas.
  window.__ecobat = { tl, goTo, get chapter() { return current; }, get p() { return state.p; }, renderer };
}
