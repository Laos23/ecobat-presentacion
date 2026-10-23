import * as THREE from 'three';

// Distribución compartida del mundo: todas las estaciones viven en el mismo sistema de coordenadas.
// x hacia el este, z hacia el sur (hacia la cámara de la portada), y hacia arriba. 1 unidad ≈ 1 m de maqueta.

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Altura de la tapa de cada plataforma y su suelo transitable (tapa + 0.31).
export const TOP = { s1: 0, s2: 1, s3: 1, s4: 3, sA: 6, sB: 3, s5: 0.5, s6: 9 };
export const F = Object.fromEntries(Object.entries(TOP).map(([k, v]) => [k, v + 0.31]));

// Centros de estación.
export const STATIONS = {
  s1: V(-58, F.s1, 14), // 1 · depósito de recogida (círculo r 13)
  s2: V(-30, F.s2, 4), // 2 · taller (rectángulo 22 × 18)
  s3: V(-6, F.s3, -2), // 3 · laboratorio (rectángulo 18 × 16)
  s4: V(16, F.s4, -8), // 4 · cruce (círculo r 10)
  sA: V(19, F.sA, -28), // 4A · sigue en servicio (rectángulo 12 × 8)
  sB: V(34, F.sB, -9), // 4B · evaluación de segunda vida (rectángulo 12 × 10)
  s5: V(38, F.s5, 20), // 5 · gestor autorizado (rectángulo 34 × 20)
  s6: V(60, F.s6, -20), // 6 · centro de trazabilidad (círculo r 10)
};

// Formas de las plataformas (en el plano xz local de cada estación).
export const PLATFORMS = {
  s1: { kind: 'circle', r: 13 },
  s2: { kind: 'rect', w: 22, d: 18, r: 2.5 },
  s3: { kind: 'rect', w: 18, d: 16, r: 2.5 },
  s4: { kind: 'circle', r: 10 },
  sA: { kind: 'rect', w: 12, d: 8, r: 1.6 },
  sB: { kind: 'rect', w: 12, d: 10, r: 1.6 },
  s5: { kind: 'rect', w: 34, d: 20, r: 3 },
  s6: { kind: 'circle', r: 10, railCount: 64 },
};

// Puentes: extremos sobre el suelo de cada plataforma.
export const BRIDGES = [
  [V(-46.2, F.s1, 9.2), V(-40.6, F.s2, 7.4)],
  [V(-19.2, F.s2, 2), V(-14.8, F.s3, 0)],
  [V(3.2, F.s3, -3.2), V(7.06, F.s4, -6.38)],
  [V(16.6, F.s4, -17.8), V(18.06, F.sA, -24.49)],
  [V(25.8, F.s4, -8), V(28.2, F.sB, -8)],
  [V(19, F.s4, 1.6), V(24.8, F.s5, 10.4)],
  [V(54.2, F.s5, 11), V(60.7, F.s6, -10.74)],
];

// Trazas luminosas: puntos de control a 1,2 cm sobre el suelo de cada isla. world.js las dibuja apoyadas en
// suelos y tableros; el taller repinta su tramo interior sobre la losa y el cruce apoya en ellas sus flechas.
const fy = (k) => F[k] + 0.012;
export const TRACES = {
  // de la báscula del depósito al cruce: rodea la peana por el norte, cruza el taller y pasa por el frente
  // del laboratorio (fuera de su losa) antes de bajar por la franja este hasta la rampa del cruce
  main: [
    V(-64, fy('s1'), 18), V(-60.6, fy('s1'), 18.9), V(-56.8, fy('s1'), 19.2), V(-53.4, fy('s1'), 18.3),
    V(-49.5, fy('s1'), 16), V(-47.3, fy('s1'), 10.9), V(-46.2, fy('s1'), 9.2), V(-40.6, fy('s2'), 7.4),
    V(-33, fy('s2'), 8.4), V(-26.5, fy('s2'), 7.5), V(-22, fy('s2'), 4), V(-19.2, fy('s2'), 2), V(-14.8, fy('s3'), 0),
    V(-12, fy('s3'), 3.4), V(-6, fy('s3'), 3.9), V(-0.6, fy('s3'), 3.7), V(1.5, fy('s3'), 2.9), V(1.85, fy('s3'), 1.2), V(1.95, fy('s3'), -1.6),
    V(3.2, fy('s3'), -3.2), V(7.06, fy('s4'), -6.38), V(11, fy('s4'), -7.6),
  ],
  service: [V(15.5, fy('s4'), -12), V(16.2, fy('s4'), -16), V(16.6, fy('s4'), -17.8), V(18.06, fy('sA'), -24.49), V(18.6, fy('sA'), -27)],
  second: [V(20, fy('s4'), -8.2), V(23.5, fy('s4'), -8), V(25.8, fy('s4'), -8), V(28.2, fy('sB'), -8), V(31.5, fy('sB'), -8.6)],
  recycle: [V(17.2, fy('s4'), -4.2), V(18.4, fy('s4'), -0.6), V(19, fy('s4'), 1.6), V(24.8, fy('s5'), 10.4), V(28.5, fy('s5'), 15), V(33, fy('s5'), 17.6)],
  // termina a ras, al pie del podio del pasaporte
  hub: [V(36, fy('s5'), 16.4), V(44, fy('s5'), 14.5), V(50.5, fy('s5'), 12.6), V(54.2, fy('s5'), 11), V(60.7, fy('s6'), -10.74), V(60, fy('s6'), -15.0)],
};

// Simulación hipotética del capítulo 4 (2 / 1 / 7): orden de llegada, ritmo y separación entre baterías.
// Las rutas comparten la entrada: la cola espera en la franja este del laboratorio y en la rampa.
export const SIM = {
  plan: ['recycle', 'service', 'recycle', 'recycle', 'second', 'recycle', 'service', 'recycle', 'recycle', 'recycle'],
  stagger: 0.055, // retraso entre salidas (fracción de la simulación)
  span: 0.45, // duración de cada trayecto
  gap: 1.45, // metros entre baterías en cola y en destino
  head: 1.9, // metros entre la primera de la cola y el final de la entrada (detrás de la punta de entrada)
  entry: [V(1.5, fy('s3'), 2.9), V(1.85, fy('s3'), 1.2), V(1.95, fy('s3'), -1.6), V(3.2, fy('s3'), -3.2), V(7.06, fy('s4'), -6.38), V(11.6, fy('s4'), -8)],
  routes: {
    service: [V(14.6, fy('s4'), -10.6), V(15.5, fy('s4'), -12), V(16.2, fy('s4'), -16), V(16.6, fy('s4'), -17.8), V(17.3, fy('s4') + 1.4, -21)],
    second: [V(16, fy('s4'), -11.8), V(19.2, fy('s4'), -9.6), V(20, fy('s4'), -8.2), V(23.5, fy('s4'), -8), V(26.8, fy('s4'), -8)],
    recycle: [V(13.5, fy('s4'), -5.2), V(17.2, fy('s4'), -4.2), V(18.4, fy('s4'), -0.6), V(19, fy('s4'), 1.6), V(20.4, fy('s4') - 0.5, 3.6)],
  },
};

// v2 · Accesos del polígono: contrato entre el entorno (orillas, calzadas, ciudad, fábrica) y las estaciones que
// usan camiones. Calzadas de 7 m de ancho; la cota del firme es la del suelo de la isla en el borde y la de la orilla.
export const ACCESS = {
  // calzada oeste: la ciudad (al noroeste) → isla s1 (recogida); entra por el borde oeste de s1 a la altura z = 14.
  // En s1 la franja x ∈ [-71, -60], z ∈ [10,5, 17,5] queda libre para el camión de recogida y su descarga.
  west: { rim: V(-71, F.s1, 14), shore: V(-125, 0.31, 14), width: 7 },
  // calzada este: isla s5 (reciclaje) → orilla este → fábrica de baterías nuevas. En s5 la franja x ∈ [44, 55],
  // z ∈ [19,5, 24,5] queda libre para el camión que sale con lingotes y granza.
  east: { rim: V(55, F.s5, 22), shore: V(105, 0.31, 22), width: 7 },
  // orillas: tierra firme a la cota 0,31 (el agua está a -2,6)
  shoreWestX: -125,
  shoreEastX: 105,
  // ciudad iluminada al fondo (noroeste) y fábrica de baterías nuevas (fuera del polígono, en la orilla este)
  city: { center: V(-190, 0, -300), width: 320, depth: 140 },
  factory: V(165, 0.31, -35),
};
