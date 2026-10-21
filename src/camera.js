import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Encuadres estables: uno de apertura, seis capítulos y el cierre.
// Cada pose es donde la cámara se detiene para que el presentador hable.
export const POSES = [
  { pos: V(-14, 80, 104), target: V(-6, 0, -16) }, // apertura: el mundo entero
  { pos: V(-35, 9.5, 37), target: V(-58, 1.5, 19) }, // 1 recogida
  { pos: V(-21, 12.5, 25), target: V(-38.5, 2.2, 3.5) }, // 2 taller
  { pos: V(5, 12, 19), target: V(-14.5, 2, -0.5) }, // 3 diagnóstico
  { pos: V(4, 30, 20), target: V(22, 1.5, -9) }, // 4 clasificación
  { pos: V(22, 20, 47), target: V(31, 0, 15) }, // 5 reciclaje
  { pos: V(96, 33, 10), target: V(34, 2, -12) }, // 6 trazabilidad
  { pos: V(30, 82, 106), target: V(-12, 0, -12) }, // cierre
];

// Longitud relativa de cada tramo (en pantallas de scroll).
const HOLD = 1.15;
const FLY = 1.7;
const ENDS = 1.0;

// Construye la línea de tiempo: pausa, vuelo, pausa, vuelo...
export function buildTimeline() {
  const segs = [];
  let acc = 0;
  POSES.forEach((pose, i) => {
    const hold = i === 0 || i === POSES.length - 1 ? ENDS : HOLD;
    segs.push({ kind: 'hold', pose: i, start: acc, len: hold });
    acc += hold;
    if (i < POSES.length - 1) {
      segs.push({ kind: 'fly', from: i, to: i + 1, start: acc, len: FLY, path: flightPath(POSES[i], POSES[i + 1], i) });
      acc += FLY;
    }
  });
  segs.forEach((s) => {
    s.p0 = s.start / acc;
    s.p1 = (s.start + s.len) / acc;
  });
  const anchors = segs.filter((s) => s.kind === 'hold').map((s) => (s.p0 + s.p1) / 2);
  return { segs, total: acc, anchors };
}

function drift(pose) {
  // Pequeño avance hacia el objetivo mientras se lee: vivo, pero estable.
  return new THREE.Vector3().subVectors(pose.target, pose.pos).normalize().multiplyScalar(0.9);
}

function holdEnds(pose) {
  const d = drift(pose);
  return [pose.pos.clone().addScaledVector(d, -0.5), pose.pos.clone().addScaledVector(d, 0.5)];
}

// Sobrevuelo con inmersión: sube, cruza alto sobre el diorama y baja dentro de la siguiente estación.
function flightPath(A, B, i) {
  const a = holdEnds(A)[1];
  const b = holdEnds(B)[0];
  const dist = A.target.distanceTo(B.target);
  const mid = new THREE.Vector3().lerpVectors(A.target, B.target, 0.5);
  const high = Math.max(a.y, b.y) + 10 + dist * 0.32;
  const back = new THREE.Vector3().subVectors(B.pos, B.target).setY(0).normalize();
  const pts = [a];
  if (i === 0) {
    // de la vista general se desciende directamente hacia el capítulo 1
    pts.push(b.clone().addScaledVector(back, 22).add(V(0, 22, 0)));
  } else if (i === POSES.length - 2) {
    // del capítulo 6 se asciende hasta el cierre
    pts.push(new THREE.Vector3().lerpVectors(a, b, 0.5).add(V(0, 8, 0)));
  } else {
    const lift = a.clone().add(V(0, 9, 0)).addScaledVector(new THREE.Vector3().subVectors(b, a).setY(0).normalize(), 4);
    pts.push(lift);
    pts.push(mid.clone().addScaledVector(back, 10).setY(high));
    pts.push(b.clone().addScaledVector(back, 9).add(V(0, 8, 0)));
  }
  pts.push(b);
  const pos = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const tgt = new THREE.CatmullRomCurve3([A.target.clone(), mid.clone().setY(Math.min(A.target.y, B.target.y)), B.target.clone()], false, 'centripetal');
  return { pos, tgt };
}

const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);

// Posición y objetivo de cámara para un progreso global p ∈ [0, 1].
export function sample(tl, p, outPos, outTgt) {
  const seg = tl.segs.find((s) => p <= s.p1) || tl.segs[tl.segs.length - 1];
  const u = THREE.MathUtils.clamp((p - seg.p0) / (seg.p1 - seg.p0), 0, 1);
  if (seg.kind === 'hold') {
    const pose = POSES[seg.pose];
    const [s, e] = holdEnds(pose);
    outPos.lerpVectors(s, e, u);
    outTgt.copy(pose.target);
  } else {
    const f = smoother(u);
    seg.path.pos.getPointAt(f, outPos);
    seg.path.tgt.getPointAt(f, outTgt);
  }
  return seg;
}

// Qué capítulo está activo y cuánto se ha avanzado dentro de él (para textos y animaciones).
export function chapterState(tl, p) {
  const holds = tl.segs.filter((s) => s.kind === 'hold');
  let index = 0;
  let best = Infinity;
  holds.forEach((s, i) => {
    const d = p < s.p0 ? s.p0 - p : p > s.p1 ? p - s.p1 : 0;
    if (d < best) {
      best = d;
      index = i;
    }
  });
  const s = holds[index];
  const flyLen = (FLY / tl.total) * 0.38;
  // visibilidad: 1 durante la pausa, se desvanece al entrar en vuelo
  const vis = best === 0 ? 1 : Math.max(0, 1 - best / flyLen);
  const local = (p - s.p0) / (s.p1 - s.p0);
  return { index, vis, local };
}
