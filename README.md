# EcoBat · Una batería. Más de una vida.

Presentación web cinematográfica del proyecto académico **EcoBat** (sostenibilidad informática): gestión de baterías de coche de plomo (arranque) y de litio (coche eléctrico), con identificación por QR, registro de diagnósticos, clasificación validada por técnicos, reutilización, desmontaje, segunda vida, reciclaje y trazabilidad hasta un destino documentado.

El mundo representa las instalaciones de un **gestor de baterías** en un polígono industrial al anochecer: recibe baterías ya sueltas de muchos talleres y desguaces de la ciudad (iluminada al fondo) y las envía a su destino; el plomo reciclado sale en camión hacia una fábrica de baterías nuevas.

La presentación es un **mundo 3D en tiempo real** (Three.js) que la cámara recorre al hacer scroll (GSAP ScrollTrigger) en una sola trayectoria continua, con una coreografía propia en cada tramo: entra en cada estación a la altura de los bancos y pasa junto a los objetos. Es la adaptación del concepto *scroll-world* sin vídeo generado ni servicios de pago.

- Web publicada: https://laos23.github.io/ecobat-presentacion/
- Versión estática: https://laos23.github.io/ecobat-presentacion/?estatica=1

> Es una presentación estática. **No** implementa la aplicación EcoBat (Flask, SQLite, autenticación); esas tecnologías se explican en los anexos como propuesta del prototipo.

## Guion

| # | Escena | Titular |
|---|--------|---------|
| — | Vista general del polígono con la ciudad al fondo | EcoBat · Una batería. Más de una vida. |
| 1 | Recogida: camión de recogida, carretilla que descarga los palés y embalaje de la batería de coche eléctrico | ¿Aquí termina todo? |
| 2 | Identificación y diagnóstico: puesto de etiquetado con QR, ficha digital y comprobador | Ahora tiene historia. |
| 3 | Clasificación en el cruce y tres tractores de arrastre con la simulación hipotética 2 / 1 / 7 | Cada batería, su camino. |
| 4 | Reutilización: limpieza, reparación, carga, nueva comprobación y muelle de expedición | Si funciona, sigue. |
| 5 | Desmontaje de baterías de coche eléctrico por técnicos de alta tensión | Se abre por módulos. |
| 6 | Segunda vida: contenedor de almacenamiento estacionario bajo la marquesina solar | Otra vida, solo con pruebas. |
| 7 | Reciclaje de plomo-ácido en siete etapas, con lingotes y granza a la salida | Los materiales siguen. |
| 8 | Centro de trazabilidad con pasaporte y conexiones con las siete zonas | Todo queda conectado. |
| — | Cierre: el camión de lingotes y granza llega a la fábrica de baterías nuevas; QR a esta web | Conocer su estado. Documentar su destino. |

Anexos (botón o tecla `A`): ocho pestañas con datos reales, citas y fuentes numeradas. Arquitectura propuesta con versiones y licencias, calendario (plan de ocho semanas del equipo y fechas del Reglamento (UE) 2023/1542), presupuesto con precios consultados, indicadores con referencias reales, ODS 9/12/13 con sus indicadores oficiales, datos de referencia (composición, pesos, tensiones, recogida y reciclaje, energía y CO2, peligros), normativa, seguridad y limitaciones, y las 127 fuentes. Los datos reales llevan una cita `[n]` que abre su fuente; lo que no tiene datos reales se rotula como ejemplo o como decisión del equipo.

## Recorrido de la cámara

| Tramo | Movimiento |
|-------|------------|
| Apertura | El polígono entero con la ciudad iluminada al fondo; descenso en espiral hacia la recogida |
| 1 · Recogida | El camión con las puertas abiertas, la carretilla descargando el palé, el embalaje y el personal de muelle |
| 1 → 2 | Vuelo bajo junto al frente de la nave de reutilización hasta el laboratorio |
| 2 · Identificación | A la altura de los ojos: puesto de etiquetado, banco del comprobador y ficha digital junto a la esfera de 12,6 V |
| 2 → 3 | Salida por el frente del laboratorio y ascenso que revela el cruce y sus tres tractores |
| 3 · Clasificación | Los tractores salen escalonados y la cámara acompaña al de reutilización hasta la nave |
| 4 · Reutilización | La nave entera y después la línea de bancos y el muelle de expedición a la altura de los ojos |
| 4 → 5 → 6 | Vuelo alto al este hasta el puesto de alta tensión (a través del cristal) y subida a la isla de segunda vida |
| 6 → 7 | Vuelta al sur sobre el cruce y descenso por el puente del sureste hasta la planta |
| 7 · Reciclaje | Desulfuración, fundición, refino y colada; al final, lingotes y big bags de granza |
| 7 → 8 | Subida por el puente largo hasta la plaza del pasaporte |
| 8 → cierre | Retirada amplia con las conexiones sobre todo el polígono; el camión de lingotes sale hacia la fábrica |

Cómo funciona (`src/camera.js`): posición y mirada siguen dos curvas Catmull-Rom centrípetas con los mismos nudos. Cada nudo fija dónde cae el sujeto en pantalla (en panorámico deja el tercio izquierdo al texto; en vertical, la mitad inferior), la focal y la velocidad relativa. El horizonte siempre queda nivelado. La longitud del scroll se reparte según el esfuerzo visual de cada tramo (metros recorridos y giro de la mirada), así la velocidad cambia de forma continua y no hay frenadas entre capítulos. La cámara sigue al scroll con un muelle de amortiguamiento crítico (0,26 s) y se queda quieta cuando el scroll para.

Movimiento ambiental, solo mientras su capítulo está cerca: descarga del camión de recogida con la carretilla; etiqueta, lectura del QR y ficha que se rellena en el laboratorio, con la curva, la aguja y las barras del comprobador; rosa de rutas y tres tractores en el cruce; batería que pasa por la línea de reutilización y cargadores que terminan; grúa que saca un módulo del paquete abierto; pantalla del almacenamiento de segunda vida; cinta, lingoteras y pantallas en el reciclaje; red de trazabilidad y pasaporte en el centro; camión de lingotes hacia la fábrica en el cierre.

## Controles para presentar

| Acción | Teclas / control |
|--------|------------------|
| Siguiente / anterior capítulo | `→` `↓` `Espacio` `AvPág` · `←` `↑` `RePág` (sirve un mando de presentaciones). Las pulsaciones seguidas encadenan el vuelo sin frenar; la rueda lo cancela |
| Ir a un capítulo | `1`–`8` o la barra inferior (a dos o más capítulos de distancia, fundido breve y corte) |
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
src/world/layout.js        Estaciones, plataformas, puentes, trazas, accesos del polígono y simulación del capítulo 3
src/world/world.js         Montaje del mundo, trazas apoyadas en suelos y tableros, simulación y conexiones
src/world/edges.js         Islas, acantilados, puentes, agua, vegetación y balizas
src/world/chapters.js      Índices de los capítulos (CH) que usan la cámara, las estaciones y el bucle
src/world/actors.js        Personas, camiones, carretilla, tractores, palés, paquetes de litio y contenedor de almacenamiento
src/world/stations/        Recogida, reutilización, laboratorio, cruce (con desmontaje y segunda vida), reciclaje, centro y entorno
src/world/kit.js           Materiales y piezas reutilizables: batería, edificio en sección, fusión de lo estático...
src/world/pbr.js           Texturas PBR procedurales (hormigón, roca, metal cepillado, plástico)
src/world/textures.js      Texturas dibujadas en canvas y pantallas vivas
src/content.js             Textos de los capítulos y de los anexos, con las citas [n]
src/sources.js             Fuentes citadas, numeradas por orden de primera aparición
src/ui.js                  Capas HTML, controles, anexos y vista estática
public/                    Favicon e ilustración de referencia (vista estática)
```

## Versión 2: comprobaciones (23/10/2026)

Build de producción servido en local, Chrome sin ventana con ANGLE D3D11. La GPU y los tirones se midieron en la integrada de referencia (Radeon del Ryzen 9 9950X3D, 2 CU), igual que en la versión anterior.

| Comprobación | Resultado |
|--------------|-----------|
| Pruebas y build | `npm test`: 99 de 99. `vite build` sin errores |
| GPU por ancla, integrada (mediana) | Portada 23,9 ms · Recogida 30,8 · Identificación 36,0 · Clasificación 30,4 · Reutilización 27,3 · Desmontaje 26,8 · Segunda vida 20,0 · Reciclaje 24,7 · Trazabilidad 27,6 · Cierre 20,6 (objetivo: 45 ms o menos) |
| Tirones tras el velo, integrada | 0 fotogramas de más de 120 ms en un recorrido completo (rueda rápida, lenta y hacia atrás, y teclas); intervalo máximo entre rAF de 66 ms |
| Carga hasta la presentación lista, integrada | 3,56 s (3,31 s en la primera versión) |
| Escena | 848 000 triángulos en total (880 000 en la primera versión); personas, vehículos y entorno reutilizan los materiales del mundo, así que los programas de sombreado siguen siendo 104 |
| Holgura de la cámara | Nunca a menos de 1,315 m de un sólido, incluido el balanceo con el ratón (0 violaciones con un límite de 1,2 m) |
| Giros | 76,8° por pantalla como máximo, en los tránsitos; 55° como máximo en las ventanas de lectura |
| Luces por fragmento | `checkLights()`: 0 violaciones en los 14 encuadres y 0 uniformes distintos de three |
| Consola | Sin errores ni avisos, salvo los X4122 del compilador HLSL que imprime three con `?debug` |
| Encuadres revisados | Las 10 anclas a 1440×810, 1280×720 y 390×844; entrada y salida de cada ventana de lectura; 9 tránsitos; movimiento reducido; vista estática; las 8 pestañas de los anexos a 1440 y 390 px de ancho |

## Rendimiento

Las cifras de esta sección son las de la primera versión, con seis capítulos.

La presentación está pensada para ir con soltura también en una gráfica integrada, y se consigue **sin cambiar nada de lo que se ve**: ni geometría, ni materiales, ni luces, ni cámara, ni posprocesado. No hay ningún escalón automático de calidad (ni resolución menor, ni MSAA reducido, ni bloom apagado): en cualquier equipo se dibuja lo mismo.

**Luces por fragmento.** El mundo se parte en 10 fragmentos (las ocho islas, el agua y las baterías de la simulación) y cada uno evalúa solo las luces locales cuya esfera de alcance (`distance`) toca alguna de sus piezas (entre 1 y 10 de las 16; en dos islas se añade una luz de relleno que no alcanza, para compartir programa de sombreado, lo cual tampoco cambia ningún píxel): una luz más allá de su `distance` aporta exactamente cero, así que dejarla fuera no cambia ningún píxel. Cada material iluminado se clona por fragmento y un sombreador inyectado recorre solo las luces de ese fragmento y se salta el cálculo donde la luz no llega, todo en un único pase de render.

Tres piezas más completan el trabajo. La geometría fusionada por fragmento vuelve a poder descartarse fuera de cuadro (menos triángulos en los capítulos 2 a 6, a costa de más llamadas de dibujo). Los 104 programas de sombreado se compilan en paralelo y un calentamiento bajo el velo adelanta los primeros usos de programas, texturas y estados del driver, que antes daban tirones de hasta 600 ms al entrar por primera vez en cada capítulo. Y el bucle deja como mucho dos fotogramas en vuelo en la GPU, para que la cola no junte 100–200 ms de trabajo y la imagen se detenga mientras la vacía.

### Antes y después

Medido el 22/10/2026 en un Ryzen 9 9950X3D con RTX 5090 y la Radeon integrada del propio procesador (RDNA2, 2 CU), que hace de **integrada de referencia**. Chrome 155 sin ventana (ANGLE D3D11) a 1920×1080, salvo las cargas, a 1440×810. «Antes» es el build del commit `69b0a0a`, anterior a este trabajo, y «después» la versión actual; los dos se midieron en la misma sesión. La GPU es la mediana del tiempo por fotograma en la integrada; las llamadas de dibujo y los triángulos son por fotograma en la RTX 5090.

| Encuadre | GPU antes | GPU después | Después / antes | Llamadas de dibujo | Triángulos |
|----------|-----------|-------------|-----------------|--------------------|------------|
| Portada | 54,9 ms | 27,3 ms | 49,7 % | 237 → 594 | 872 k → 872 k |
| 1 · Depósito | 78,7 ms | 37,3 ms | 47,4 % | 226 → 577 | 854 k → 854 k |
| 2 · Taller | 71,4 ms | 38,3 ms | 53,6 % | 88 → 174 | 625 k → 276 k |
| 3 · Laboratorio | 74,7 ms | 39,2 ms | 52,5 % | 84 → 142 | 612 k → 181 k |
| 4 · Cruce | 63,2 ms | 30,7 ms | 48,6 % | 186 → 398 | 756 k → 543 k |
| 5 · Reciclaje | 52,1 ms | 24,7 ms | 47,4 % | 80 → 79 | 664 k → 172 k |
| 6 · Centro | 57,5 ms | 27,8 ms | 48,3 % | 128 → 328 | 660 k → 492 k |
| Cierre | 57,4 ms | 29,3 ms | 51,0 % | 237 → 594 | 880 k → 880 k |

En los ocho encuadres la GPU de la integrada baja al 47–54 % (el objetivo era el 55 % o menos): de unos 13–19 a unos 25–40 fotogramas por segundo, limitados solo por la GPU. La Vega 7 de un Ryzen 5 5500G se estima unas tres veces más rápida que esta integrada; con esa estimación, que no se ha medido, la GPU de una Vega 7 daría para unos 60 fps. Falta medir la CPU de un 5500G: en la integrada de referencia el JavaScript por fotograma llega a unos 6 ms en los encuadres con más llamadas de dibujo (portada y cierre), y a 3,4 ms en la RTX 5090.

| Métrica | Antes | Después |
|---------|-------|---------|
| Fotogramas de más de 120 ms tras el velo de carga (integrada) | 140 | 0 |
| Intervalo más largo entre fotogramas (rAF) tras el velo (integrada) | 473 ms | 92 ms |
| Carga hasta la presentación lista, integrada (mediana de 5) | 3 049 ms | 3 307 ms |
| Carga hasta la presentación lista, RTX 5090 (mediana de 5) | 2 823 ms | 3 148 ms |
| Programas de sombreado | 50 | 104 |
| JS del hilo principal por fotograma (RTX 5090) | 1,2 ms | 3,4 ms |

Los tirones son los de un recorrido completo: rueda rápida, lenta y hacia atrás y saltos con teclas. Las cargas son en frío y alternan los dos builds. La carga sube unos 0,3 s, el precio de compilar 104 programas en vez de 50 y de calentar bajo el velo. Las cifras de «Comprobaciones realizadas (21/10/2026)», más abajo, son las del build anterior a este trabajo.

### Cómo se comprueba que no cambia nada

Se capturan 14 encuadres a 1440×810, 1280×720 y 390×844 (y tres más con movimiento reducido) del build anterior y del actual, con tiempo virtual para que sean repetibles, y se comparan píxel a píxel: ningún píxel puede diferir más de 1/255, salvo píxeles aislados de hasta 8/255 que sumen como mucho el 0,001 % de la imagen. El arnés es local y no se versiona: `.verify/perf/shots-all.mjs` captura, `.verify/perf/pixeldiff.mjs` compara y `.verify/brief.md` describe cada sonda. El 22/10/2026 pasan las 45 capturas: 37 son idénticas bit a bit y las otras 8 difieren como mucho 1/255.

Con `?debug`, `window.__ecobat.debug.chunks()` lista los fragmentos (cajas, mallas y luces) y `window.__ecobat.debug.checkLights()` comprueba que ninguna luz que alcanza una malla falta en el conjunto de su fragmento (0 violaciones en los 14 encuadres).

### three queda fijado en 0.186.1

La inyección copia el texto de `THREE.ShaderChunk.lights_fragment_begin` de three 0.186.1 y falla con un error a la vista si ese texto cambia, así que `package.json` fija `"three": "0.186.1"` sin `^`. Las pruebas (`npm test`) comprueban la inyección contra el texto de esa versión. Subir three exige pasar las pruebas y repetir la verificación de píxeles.

### Dónde está

```
src/world/chunks.js        Fragmentos: asignación de piezas, cajas y conjuntos de luces locales
src/world/chunkLights.js   Clones de material por fragmento e inyección de sus luces en el sombreador
src/world/water.js         Agua en celdas: probada, pero sin uso (el agua va entera)
tests/                     Pruebas unitarias (npm test)
```

## Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` compila y publica en cada push a `main`.

1. Repositorio: `Laos23/ecobat-presentacion` (público).
2. *Settings → Pages → Build and deployment → Source: GitHub Actions*.
3. `git push` a `main`; la URL aparece en la pestaña *Actions*.

## Fidelidad al contenido académico

- La clasificación la sugiere el software y la **valida personal técnico**.
- La segunda vida está **condicionada a pruebas específicas** y es la de los módulos de litio de coche eléctrico: una batería de arranque no está hecha para descargas profundas.
- Reutilización (plomo), remanufacturación (litio que vuelve a un coche), segunda vida (litio en almacenamiento estacionario) y reciclaje son **rutas distintas** y no se cuentan dos veces.
- En el reciclaje de plomo-ácido **no hay cobre**: salen lingotes de plomo, granza de polipropileno y el producto del electrolito (sulfato de sodio).
- La ropa y la protección de las personas del mundo 3D son ilustrativas; las que tienen fuente (alta tensión, ácido y horno) se citan en Límites.
- El ejemplo 2 / 1 / 7 sobre diez baterías y el 90 % de trazabilidad son **hipotéticos** y se etiquetan así: no hay datos publicados de ese reparto.
- No se afirma que EcoBat reduzca emisiones o contaminación. Las cifras de energía y CO2 del reciclaje del plomo son datos publicados sobre el proceso industrial (estudios de la industria), no resultados del proyecto.
- Los QR de las baterías del mundo 3D son decorativos. El QR del cierre es funcional y abre esta web.
- Los registros de las pantallas del mundo 3D son **ejemplos del prototipo**, no mediciones, y las pantallas los rotulan como «ejemplo»: el código ECB-0427, los lotes, las fechas, las lecturas de prueba y los contadores; las curvas y gráficos sin cifras son ilustrativos. Sus valores se mantienen dentro de rangos con fuente (por ejemplo, 12,6 V tras 24 h de reposo en una batería inundada cargada, o 324 kg para 18 baterías de 18 kg). Son datos reales la tensión nominal de 12 V, la composición típica en masa (plomo 60 %, electrolito 30 % y plástico 7 %, aproximados), el código de residuo 16 06 01* y la clasificación de transporte UN 2794.
- La batería de ejemplo no supera la prueba de carga (por debajo de 9,6 V) y por eso termina en el reciclaje, coherente con «Medir antes de decidir».
- El monolito dice «Pasaporte EcoBat» y «Ejemplo · prototipo académico»: no es el pasaporte de baterías del Reglamento (UE) 2023/1542, que no se exige a las baterías de arranque de plomo (llevan QR, no pasaporte).
- La imagen de la versión estática (`public/vista-ecobat.jpg`) es una captura del propio mundo 3D. Las referencias de la primera versión (`context/ref-*.png`) se generaron con la herramienta de imágenes de Codex como dirección artística. El mundo 3D está modelado con geometría procedural, sin modelos externos.

## Datos y fuentes

La presentación separa lo que tiene datos reales de lo que es ejemplo:

- **Dato real.** Todo número, fecha, nombre propio o afirmación factual que la web presenta como dato tiene detrás un hecho verificado de la investigación y sus fuentes. Los anexos citan cada dato real con un número `[n]` que abre la fuente (127 fuentes, consultadas del 21 al 23 de octubre de 2026). Los textos del recorrido no llevan citas: sus fuentes están en la pestaña Datos.
- **Ejemplo o hipótesis.** Lo que no tiene datos reales se rotula y no se presenta como dato: el reparto 2 / 1 / 7 de diez baterías y el ejemplo del 90 % de trazabilidad; los registros de ejemplo del prototipo (el código ECB-0427, las fechas, los lotes y los resultados de prueba); y las decisiones del equipo (arquitectura, calendario de ocho semanas y partidas del presupuesto). La pestaña Fuentes explica cada ejemplo («Qué es real y qué es ejemplo en las pantallas 3D») con su valor de referencia real y su cita.
- **Formulación prudente.** «Sin datos personales» es un principio de diseño, no una garantía legal. Las baterías de arranque de plomo llevan QR, no pasaporte. Las cifras con definiciones distintas no se mezclan (por ejemplo, el índice oficial de recogida de España y el porcentaje autodeclarado por el Acuerdo Voluntario del sector). No hay absolutos como «100 %» o «siempre», ni nombres de empresas o marcas salvo como fuente citada o dato verificado, ni afiliación afirmada con ninguna entidad.

La investigación está en [`docs/investigacion/`](docs/investigacion/): 298 hechos verificados de 15 temas, 469 fuentes numeradas, el informe consolidado y la correspondencia entre las fuentes de la web y las de la investigación. Su [README](docs/investigacion/README.md) explica cada archivo, cómo se verificó y qué límites tiene.

Para comprobar el contenido:

```bash
node --test tests/content.test.mjs
```

La prueba funciona sin navegador y comprueba que cada cita `[n]` existe en `src/sources.js`, que cada fuente se cita y que los números van por orden de primera aparición, que cada fuente tiene título, editor, fecha, URL `https` y tipo y que no hay fuentes duplicadas, que los textos del recorrido no llevan citas y que el reparto 2 / 1 / 7 y el ejemplo del 90 % siguen rotulados como ejemplos.

Enlaces de las fuentes: `node -e "import('./src/sources.js').then(({sources})=>console.log(sources.map(s=>s.url).join('\n')))"` lista las 127 URL para pasarlas por un comprobador de enlaces. El 22-10-2026 ninguna estaba rota. EUR-Lex, tres páginas de comercios y, a veces, el registro de npm no responden con normalidad a las herramientas automáticas, y abren bien en un navegador.

Las capturas PNG de [`docs/evidencia/`](docs/evidencia/) se regeneraron el 22-10-2026 con estos textos. La grabación `recorrido-tramos.webm` es del 21-10-2026, anterior a los datos reales: las pantallas del mundo 3D que muestra tienen los valores y los rótulos de entonces.

## Materiales e iluminación

- Materiales PBR con mapas de color, rugosidad y relieve generados por código en `src/world/pbr.js`: hormigón con grano y juntas, roca con grietas, metal cepillado claro y oscuro, plástico satinado y caucho. Las UV se proyectan en coordenadas de mundo para que la escala sea coherente en todo el diorama.
- La batería sigue `context/ref-bateria.png`, también en proporciones: carcasa grafito lisa y baja, zócalo con asideros, línea lima fina bajo la tapa, bornes de acero pulido, asa grafito con inserto lima y QR pequeño abajo a la derecha. Las baterías instanciadas tienen la misma silueta.
- Cada estación tiene primer plano, plano medio y fondo con geometría de detalle: patio de recogida con camión, carretilla, jaulas, palés y báscula; laboratorio con puesto de etiquetado, comprobador, pinzas y pantallas; cruce con isletas plantadas y tres tractores de arrastre; nave de reutilización con bancos, estanterías de carga y muelle de expedición; puesto de alta tensión con el paquete abierto; contenedor de almacenamiento bajo la marquesina solar; planta de reciclaje en siete etapas; plaza con pasaporte y pantallas; y el entorno (orillas, calzadas, aparcamiento, ciudad y fábrica). Personas y vehículos se generan por código (`actors.js`), sin modelos externos. Todo lo fijo se fusiona por fragmento y material (`bakeStatic`), así que el detalle apenas multiplica las llamadas de dibujo (la portada pasa de 237 a 594 por la partición en fragmentos; ver «Rendimiento»).
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
| Render | 237 llamadas de dibujo y 872 000 triángulos en la vista general; 233–239 fps, fotograma p95 de 4,3 ms y máximo de 17 ms con scroll lento |
| Parpadeo del suelo | Ninguna superficie opaca coplanar entre materiales distintos (escaneo de los 54 000 triángulos horizontales del mundo). Renderizando cada encuadre con el orden de dibujo invertido ya no cambia ninguna zona, solo líneas de contacto de 1 px; plano cercano a 0,5 m para separar marcas y suelos también en los planos lejanos |
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
- Hay que probarlo antes en el portátil y el proyector de clase: la fluidez se midió en una gráfica integrada de referencia (ver «Rendimiento»), no en ese equipo. No hay calidad reducida automática: en cualquier equipo se dibuja lo mismo.
- El mundo 3D es una interpretación de las referencias, no una réplica de cada detalle.
- La primera carga necesita conexión; conviene abrir la web una vez antes de la exposición.
