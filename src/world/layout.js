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
// suelos y tableros y el cruce apoya en ellas sus flechas. Ramas del cruce en la v2: norte (service) a segunda vida
// (sA), este (second) a desmontaje (sB) y sureste (recycle) a reciclaje (s5); la reutilización vuelve al oeste por
// la traza principal.
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

// v2 · Simulación hipotética del capítulo de clasificación (ejemplo 2 / 1 / 7): tres tractores de arrastre esperan
// cargados en las bocas del cruce, cada uno mirando a su salida, y salen escalonados hacia su destino.
// Cada ruta es una polilínea en el plano xz [[x, z], ...]: la cota la pone el suelo (tapa de la isla o tablero del
// puente, world.js · surfaceY). El tractor espera con su origen sobre el punto `wait` (el remolque queda detrás, sobre
// la misma ruta) y se detiene con el origen en el último punto. `go`: [salida, llegada] en fracción de la simulación;
// `count`: baterías del lote. El panel del capítulo no espera a la llegada: cuenta las baterías clasificadas al
// acercarse al ancla (main.js · CLASS_ORDER, con este mismo reparto).
//   service · reutilización: palé con 2 baterías de plomo aptas o reparables; vuelve al oeste por el mismo camino por el
//     que llegaron (carril de salida de la calzada oeste, puente s4-s3, franja este y zona de recepción del laboratorio,
//     su explanada, franja oeste, puente s3-s2 y franja este de s2) y entra en la nave de reutilización hasta el palé de
//     ENTRADA. Espera en la boca del puente s4-s3 casi alineado con él y entra en el tablero con unos 11° de ángulo: más
//     cruzado, al pasar del llano a la rampa una rueda quedaba hasta 7 cm en el aire. La franja oeste de s3 mide 1,45 m
//     entre la fachada del laboratorio y el bordillo estrecho del paso (kerbPasses): el tractor (1,29 m de buje a buje) la recorre centrado y gira hacia el puente por la boca, a unos
//     5-8 cm de la fachada, del pilar de esquina, del pie de remate de la barandilla y del bordillo. En la esquina
//     sureste de s2 gira donde no hay jardinera (edges.js · cornerPlanters la omite en las esquinas por las que pasa una
//     ruta).
//   second · desmontaje: la batería de coche eléctrico en su embalaje; calzada este y puente hasta la puerta de sB, donde
//     para con el paragolpes a medio metro del montante y el embalaje (1,8 m) centrado en la boca del puente, a unos 40 cm
//     de los pies de remate de sus barandillas.
//   recycle · reciclaje: palé con 7 baterías de plomo; calzada y puente del sureste hasta la puerta de recepción de s5,
//     donde para con el paragolpes a medio metro de la persiana cerrada.
export const SIM = {
  // pasos de tractores junto al borde de una isla: las piezas de bordillo con el centro a menos de `r` m de (x, z), en la
  // isla de suelo `y`, se estrechan hasta el pie de la barandilla (edges.js · KERB_NARROW). En la franja oeste de s3, entre
  // la fachada del laboratorio y la barandilla, el bordillo entero dejaba 1,32 m de paso a las ruedas.
  kerbPasses: [{ x: -14.72, y: F.s3, z: 2.81, r: 0.7 }],
  tractors: [
    {
      route: 'second', load: 'litio', count: 1, go: [0.04, 0.3], wait: 1,
      path: [[19.0, -7.6], [24.3, -7.95], [25.9, -8.05], [27.3, -8.15], [27.75, -8.18]],
    },
    {
      route: 'recycle', load: 'plomo', count: 7, go: [0.12, 0.5], wait: 2,
      path: [[16.45, -4.5], [16.95, -2.6], [17.95, 0.34], [19.28, 2.02], [21.75, 5.78], [24.23, 9.53], [24.73, 10.21]],
    },
    {
      // lanza de 1,2 m (world.js · placeTrain; las otras dos, 0,64 m): en la boca del puente s3-s2 y en la esquina
      // sureste de s2 tractor y remolque llegan a formar unos 100°, y con una lanza más corta el remolque, que sigue la
      // huella del tractor, se metía en él y la lanza cruzaba su paragolpes
      route: 'service', load: 'plomo', count: 2, go: [0.24, 0.94], wait: 2, bar: 1.2,
      path: [
        [13.48, -8.07], [11.18, -7.2], [8.76, -6.79], [7.08, -5.88], [5.13, -4.79], [3.2, -3.2], [2.2, -2.0], [1.55, -0.4],
        [1.05, 0.85], [-0.4, 1.4], [-4, 1.5], [-7.4, 1.55], [-9.2, 2.5], [-10.7, 3.56], [-12.28, 4.07], [-13.4, 3.79],
        [-13.91, 3.14], [-13.98, 1.98], [-14.17, 1.01], [-14.54, 0.27], [-14.96, 0.04], [-16.8, 0.62], [-19.2, 2.0], [-20.4, 3.3],
        [-20.6, 6.2], [-20.7, 9.0],
        [-21.1, 10.8], [-22.8, 11.3], [-26.6, 10.9], [-29.6, 8.6], [-31.8, 7.3], [-34.0, 7.0],
      ],
    },
  ],
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
