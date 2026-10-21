# EcoBat · Una batería. Más de una vida.

Presentación web cinematográfica del proyecto académico **EcoBat** (sostenibilidad informática): identificación de baterías de coche con QR, registro de diagnósticos, clasificación validada por técnicos y trazabilidad hasta un destino documentado.

La presentación es un **mundo 3D en tiempo real** (Three.js) que la cámara recorre al hacer scroll (GSAP ScrollTrigger) en una sola trayectoria continua, con una coreografía propia en cada tramo: entra en cada estación a la altura de los bancos y pasa junto a los objetos. Es la adaptación del concepto *scroll-world* sin vídeo generado ni servicios de pago.

- Web publicada: https://laos23.github.io/ecobat-presentacion/
- Versión estática: https://laos23.github.io/ecobat-presentacion/?estatica=1

> Es una presentación estática. **No** implementa la aplicación EcoBat (Flask, SQLite, autenticación); esas tecnologías se explican en los anexos como propuesta del prototipo.

## Guion

| # | Escena | Titular |
|---|--------|---------|
| — | Vista general del mundo | EcoBat · Una batería. Más de una vida. |
| 1 | Depósito de recogida y batería protagonista | ¿Aquí termina todo? |
| 2 | Taller abierto en sección, lector QR y ficha digital | Ahora tiene historia. |
| 3 | Laboratorio de diagnóstico | Medir antes de decidir. |
| 4 | Cruce con tres rutas (servicio, evaluación de segunda vida, reciclaje) y simulación hipotética 2 / 1 / 7 | Cada batería, su camino. |
| 5 | Gestor autorizado y materiales separados | Los materiales siguen. |
| 6 | Centro de trazabilidad con pasaporte y conexiones | Todo queda conectado. |
| — | Cierre con QR a esta web | Conocer su estado. Documentar su destino. |

Anexos (botón o tecla `A`): arquitectura propuesta, calendario de ocho semanas, presupuesto orientativo de 20–120 €, indicadores, ODS 9/12/13, normativa, seguridad, limitaciones y fuentes.

## Recorrido de la cámara

| Tramo | Movimiento |
|-------|------------|
| Apertura | Vista del conjunto; descenso en espiral sobre el depósito hasta la batería |
| 1 · Recogida | Dentro del patio: aproximación a la carcasa y a la etiqueta QR, con la carretilla en plano medio y el taller al fondo |
| 1 → 2 | Rodea la carcasa, cruza el agua y entra en el taller por el frente abierto a la altura del banco, a menos de 2 m del brazo del elevador, hasta el lector QR |
| 2 → 3 | Salida lateral con el pilar del frente en primer plano; llegada al laboratorio por su fachada |
| 3 · Diagnóstico | A la altura del banco, desplazamiento lateral: bornes, después sondas y por último la pantalla del comprobador |
| 3 → 4 | Grúa atrás y arriba sobre el laboratorio, junto a la cola de baterías de la rampa, hasta revelar las tres rutas y sus destinos |
| 4 → 5 | Descenso siguiendo la ruta C y su puente; la cámara sigue la cinta a baja altura hasta la boca de la trituradora |
| 5 · Reciclaje | Entre la cinta y los contenedores de materiales separados |
| 5 → 6 | Subida por el puente largo hasta la plaza |
| 6 · Trazabilidad | Acercamiento al pasaporte; después, retirada amplia con las conexiones hacia todas las estaciones |

Cómo funciona (`src/camera.js`): posición y mirada siguen dos curvas Catmull-Rom centrípetas con los mismos nudos. Cada nudo fija dónde cae el sujeto en pantalla (en panorámico deja el tercio izquierdo al texto; en vertical, la mitad inferior), la focal y la velocidad relativa. El horizonte siempre queda nivelado. La longitud del scroll se reparte según el esfuerzo visual de cada tramo (metros recorridos y giro de la mirada), así la velocidad cambia de forma continua y no hay frenadas entre capítulos. La cámara sigue al scroll con un muelle de amortiguamiento crítico (0,26 s) y se queda quieta cuando el scroll para.

Movimiento ambiental, solo mientras su capítulo está cerca: escaneo breve del QR y ficha que se rellena en el taller; curva, aguja, barras y traza del comprobador en el laboratorio; rosa de rutas y simulación 2 / 1 / 7 en el cruce; rodillos, tacos y baterías de la cinta, virutas y pantallas de registro en el reciclaje; línea de tiempo del pasaporte y gráficas en el centro; pulso de luz por las trazas.

## Controles para presentar

| Acción | Teclas / control |
|--------|------------------|
| Siguiente / anterior capítulo | `→` `↓` `Espacio` `AvPág` · `←` `↑` `RePág` (sirve un mando de presentaciones). Las pulsaciones seguidas encadenan el vuelo sin frenar; la rueda lo cancela |
| Ir a un capítulo | `1`–`6` o la barra inferior (a dos o más capítulos de distancia, fundido breve y corte) |
| Portada / cierre | `Inicio` / `Fin` |
| Pantalla completa | `F` o botón |
| Anexos | `A` o botón; `Esc` cierra |
| Explorar libre | rueda del ratón o trackpad |

La cámara se detiene cuando se deja de avanzar. Con `prefers-reduced-motion` no hay vuelos: se pasa de un encuadre a otro con un único corte cuando el scroll se detiene (como mucho dos por segundo), las teclas cortan al instante, las animaciones quedan en su estado final y la escena no se vuelve a dibujar si nada cambia. Sin WebGL, o con `?estatica=1`, se muestra una versión estática legible.

## Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # genera dist/
npm run preview   # sirve dist/ para comprobar el build
```

El build usa rutas relativas (`base: './'`), así que `dist/` funciona en GitHub Pages y en cualquier servidor estático.

### Estructura

```
index.html                 Documento y contenedores
src/main.js                Render, posprocesado, scroll, navegación y bucle
src/camera.js              Coreografía: nudos de cámara, reparto del scroll y encuadre
src/world/layout.js        Estaciones, plataformas, puentes, trazas y simulación del capítulo 4
src/world/world.js         Montaje del mundo, trazas apoyadas en suelos y tableros, simulación y conexiones
src/world/edges.js         Islas, acantilados, puentes, agua, vegetación y balizas
src/world/stations/        Depósito, taller, laboratorio, cruce, reciclaje y centro (un módulo cada una)
src/world/kit.js           Materiales y piezas reutilizables: batería, edificio en sección, coche...
src/world/pbr.js           Texturas PBR procedurales (hormigón, roca, metal cepillado, plástico)
src/world/textures.js      Texturas dibujadas en canvas y pantallas vivas
src/content.js             Textos de los capítulos y de los anexos
src/ui.js                  Capas HTML, controles, anexos y vista estática
public/                    Favicon e ilustración de referencia (vista estática)
```

## Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` compila y publica en cada push a `main`.

1. Repositorio: `Laos23/ecobat-presentacion` (público).
2. *Settings → Pages → Build and deployment → Source: GitHub Actions*.
3. `git push` a `main`; la URL aparece en la pestaña *Actions*.

## Fidelidad al contenido académico

- La clasificación la sugiere el software y la **valida personal técnico**.
- La segunda vida está **condicionada a pruebas específicas**.
- El ejemplo 2 / 1 / 7 sobre diez baterías y el 90 % de trazabilidad son **hipotéticos** y se etiquetan así.
- No se afirma ninguna reducción de emisiones o contaminación.
- Los QR de las baterías del mundo 3D son decorativos. El QR del cierre es funcional y abre esta web.
- Las pantallas del mundo 3D muestran datos ilustrativos (pesos, lotes, tensiones y gráficos), no mediciones reales. La batería de ejemplo no supera la prueba de carga y por eso termina en el reciclaje, coherente con «Medir antes de decidir».
- El monolito dice «Pasaporte EcoBat · Prototipo académico»: no es el pasaporte de baterías del Reglamento (UE) 2023/1542.
- La ilustración `public/referencia-ecobat.png` es conceptual: se generó con la herramienta de imágenes de Codex como dirección artística. El mundo 3D está modelado con geometría procedural, sin modelos externos.

## Materiales e iluminación

- Materiales PBR con mapas de color, rugosidad y relieve generados por código en `src/world/pbr.js`: hormigón con grano y juntas, roca con grietas, metal cepillado claro y oscuro, plástico satinado y caucho. Las UV se proyectan en coordenadas de mundo para que la escala sea coherente en todo el diorama.
- La batería sigue `context/ref-bateria.png`, también en proporciones: carcasa grafito lisa y baja, zócalo con asideros, línea lima fina bajo la tapa, bornes de acero pulido, asa grafito con inserto lima y QR pequeño abajo a la derecha. Las baterías instanciadas tienen la misma silueta.
- Cada estación tiene primer plano, plano medio y fondo con geometría de detalle: patio con jaulas, palés, carretilla y báscula; taller con coche eléctrico en el elevador, panel de herramientas y estanterías; laboratorio con comprobador, pinzas, lupa y pantallas; cruce con isletas plantadas y destinos; planta con cinta de rodillos, trituradora, transportador inclinado y contenedores; plaza con pasaporte y pantallas. Todo lo fijo se fusiona por material (`bakeStatic`), así que el detalle no multiplica las llamadas de dibujo.
- El bloom solo alcanza las luces (umbral alto): no hay desenfoque de maqueta ni velos que oculten la geometría. Hay sombras de contacto, focos cálidos en los interiores, roca estratificada con luces de pie y reflejos cálidos en el agua.
- Las trazas luminosas se apoyan en el suelo y en los tableros de los puentes, con puntas de flecha planas inclinadas con cada rampa.
- Las referencias `context/ref-*.png` se generaron con IA mediante Codex. Se usaron como guía artística: no se aplican como texturas.

## Comprobaciones realizadas (21/10/2026)

Hechas con Playwright sobre el build de producción, en el Chrome del sistema sin ventana y con GPU real (ANGLE D3D11, RTX 5090). Las capturas y una grabación de los tramos clave están en [`docs/evidencia/`](docs/evidencia/).

| Comprobación | Resultado |
|--------------|-----------|
| Build de producción | `vite build` sin errores. JS 1,2 MB (354 kB gzip), CSS 19 kB y la fuente Archivo autoalojada |
| Consola en el build | 0 errores y 0 avisos durante la carga, un recorrido completo con rueda, los anexos e `Inicio` |
| Carga en frío | Lista en 2,7–2,8 s en local: el mundo se construye en ~1,5 s y los 50 programas de sombreado se compilan en paralelo |
| Render | 237 llamadas de dibujo y 898 000 triángulos en la vista general; 233–239 fps, fotograma p95 de 4,3 ms y máximo de 17 ms con scroll lento |
| Holgura | La cámara nunca pasa a menos de 1,237 m de un sólido, incluido el balanceo con el ratón (16 757 sólidos, 0 violaciones) |
| Giros | Como mucho 63° por pantalla en tránsitos y 39° en ventanas de lectura; con rueda tranquila, 30°/s en el percentil 95 y 37°/s en el 99; horizonte siempre nivelado |
| Scroll | Lento, rápido y hacia atrás recorren todos los capítulos en orden y terminan en el encuadre correcto |
| Navegación | Tres `→` seguidos llegan al capítulo 3 sin ninguna caída de velocidad; `←` vuelve al ancla exacta; la rueda cancela un vuelo; `6` funde y corta; `Espacio` sobre un botón enfocado activa ese botón |
| Movimiento reducido | Un lanzamiento rápido de rueda produce un solo corte; las teclas cortan en ~10 ms; en reposo no se dibuja ningún fotograma; las pantallas quedan en su estado final (11,8 V, ficha completa, «Destino documentado») |
| Encuadres | Portada, capítulos 1–6 y cierre a 1440×810; capítulo 4 a 1280×720 (proyector) con las tres rutas libres de la tarjeta; portada, capítulo 4 y cierre a 390×844 |
| Revisión independiente | Cinco revisores y cinco verificadores (coreografía, fidelidad a las referencias, movimiento ambiental y rendimiento, legibilidad y contenido). Se aplicaron las correcciones confirmadas: proporciones de la batería, bloom, hormigón y metales, trazas y baterías apoyadas, encuadres del cruce, la cinta y el cierre, contraste de marca y teclas, controles, foco de los anexos y coherencia del diagnóstico |
| Grabación | `recorrido-tramos.webm`: 39 s a 1280×720 con apertura, recogida, entrada al taller, diagnóstico, ascenso al cruce, cinta y cierre |

**Limitaciones conocidas**

- La grabación se genera fotograma a fotograma (posición y reloj fijados en cada imagen) y Chrome sin ventana llega a unos 240 fps en este equipo: muestran la coreografía y el encuadre, pero no prueban la fluidez en tiempo real en otro hardware. El navegador de pruebas con ventana (Playwright MCP) quedaba limitado a ~1,5 fps por estar oculto, así que no se usó para medir.
- Hay que probarlo antes en el portátil y el proyector de clase: con gráficos integrados débiles se activa la calidad reducida, pero no se ha medido en ese equipo.
- El mundo 3D es una interpretación de las referencias, no una réplica de cada detalle.
- La primera carga necesita conexión; conviene abrir la web una vez antes de la exposición.
