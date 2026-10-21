# Rendimiento en gráficas integradas sin cambiar el diseño

Fecha: 2026-10-21. Estado: borrador para revisión.

## 1. Intención

La presentación va fluida en un PC con gráfica dedicada, pero en una gráfica integrada (Ryzen 5 5500G con Vega 7, o peor) va a tirones y se congela a ratos. Hay que dejarla fluida en esas máquinas **sin cambiar nada de lo que se ve**: ni geometría, ni materiales, ni luces, ni cámara, ni posprocesado. El criterio es literal: las capturas de cada encuadre antes y después deben ser píxel a píxel iguales.

La decisión del proyecto es que no habrá ningún escalón de calidad automático (ni MSAA 2×, ni bajar el DPR, ni apagar bloom). Solo entran optimizaciones que producen el mismo píxel exacto.

## 2. Objetivos, no objetivos y anti-objetivos

Objetivos:

- En la integrada de referencia de este PC (ver §4) el tiempo de GPU por fotograma en cada anclaje baja al menos un 45 % (p. ej. de 55-77 ms a 30-40 ms). Extrapolado a una Vega 7, unas tres veces más rápida, eso son 60 fps estables.
- Desaparecen los tirones de 0,2-0,6 s al entrar por primera vez en cada zona: tras levantar el velo, ningún fotograma supera los 120 ms en un recorrido completo con rueda rápida y saltos por teclas, medido en la integrada de referencia.
- El coste de JS del hilo principal por fotograma no supera los 4 ms en este PC (hoy 1,1-2,2 ms).
- La carga (velo) no crece más de 3 s en la integrada de referencia ni más de 0,5 s en la RTX 5090.
- `?debug`, `?debug&nobake`, el movimiento reducido, la versión estática y la publicación en GitHub Pages siguen funcionando igual.

No objetivos (quedan fuera, decidido con la usuaria):

- Borrar geometría oculta, LOD, decimación, streaming de texturas, oclusión precalculada (PVS).
- Cambiar resolución, MSAA, sombras, bloom, luces o materiales en ninguna máquina.
- Reducir el trabajo de las pantallas vivas (canvas) o de las texturas procedurales.
- Tocar `src/camera.js`, `src/content.js`, `src/ui.js` o `src/styles.css`.

Anti-objetivos (sería un fracaso aunque fuera rápido):

- Cualquier píxel distinto en los encuadres de referencia (§7.1), en escritorio, proyector 1280×720 o móvil vertical.
- Tirones nuevos al navegar (por ejemplo, compilaciones o subidas a GPU a mitad de recorrido).
- Una carga en frío notablemente más larga o un velo que se queda congelado sin avanzar.

## 3. Restricciones

- Stack actual: three 0.186, GSAP ScrollTrigger, Vite 8, sin dependencias nuevas. Build con `base: './'` para GitHub Pages.
- El mundo es procedural (no hay modelos ni texturas externas). La geometría estática se fusiona en `K.bakeStatic` (`src/world/kit.js`) por material y se proyectan las UV en coordenadas de mundo; esa proyección debe conservarse tal cual.
- El renderizado pasa por `EffectComposer` con `RenderPass`, `UnrealBloomPass` y `OutputPass` sobre un `WebGLRenderTarget` HalfFloat con `samples: 4` (`src/main.js`). Bloom y salida no se tocan.
- La sombra de la luz principal (`key`, 4096², `PCFShadowMap`) se renderiza una sola vez (`shadowMap.autoUpdate = false`, `needsUpdate` al arrancar). Debe seguir siendo una sola vez y con todos los objetos que la proyectan.
- Los materiales `M.*` compartidos no se modifican en tiempo de ejecución; cada InstancedMesh con y sin color por instancia ya recibe su clon (ver el final de `buildWorld`). Esa regla se mantiene.
- Con `?debug` se exponen `window.__ecobat.debug` (`scene`, `camera`, `setProgress`, `freeze`, `clearance`, `motion`, `info`) y los colliders; `.verify/` contiene el arnés de verificación (ignorado por git).

## 4. Situación medida (2026-10-21)

Máquina: Ryzen 9 9950X3D, RTX 5090 y la Radeon integrada del propio 9950X3D (RDNA2, 2 CU). Esa integrada es la **referencia de máquina floja**: unas tres veces más lenta que la Vega 7 de un 5500G, así que cumple con margen el "o peor" pedido. Se usa forzando el adaptador en Chrome: `--use-adapter-luid=0,113510` (el LUID sale en `chrome://gpu`; la sonda `gpuinfo.mjs` lo lista).

Escena (build actual): 879 k triángulos, 8 927 piezas antes de fusionar, 227 mallas después (71 instanciadas). Por estación: bordes 211 k, reciclaje 139 k, depósito 130 k, laboratorio 86 k, cruce 76 k, taller 75 k, raíz (trazas, simulación, arcos) 58 k, centro 57 k, terreno 47 k. Luces: 11 `SpotLight` y 5 `PointLight` locales (todas con `distance` > 0 y `decay` > 0), más 2 `DirectionalLight` y 1 `HemisphereLight` globales. 50 programas de sombreado, 82 texturas.

Por capítulo (llamadas de dibujo / triángulos por fotograma, 1920×1080): portada 237 / 872 k; c1 226 / 854 k; c2 88 / 625 k; c3 84 / 612 k; c4 186 / 756 k; c5 80 / 664 k; c6 128 / 660 k; cierre 237 / 880 k. La fusión global por material anula el culling por frustum: las mallas fusionadas abarcan todo el mundo y se dibujan siempre.

RTX 5090 (1080p): 1,1 ms de JS y 1,0-1,1 ms de GPU por fotograma; sin tirones en ningún recorrido, ni en el Chrome de la usuaria.

Integrada de referencia (1080p), ms de GPU por fotograma, mediana: portada 55, c1 78, c2 71, c3 76, c4 63, c5 51, c6 58, cierre 57. Es decir, 13-19 fps. Navegando con rueda, fotogramas de 130-240 ms y tareas largas de 52-139 ms en el hilo principal; al llegar por primera vez a un capítulo, picos de 570-605 ms de GPU (primer uso de programas y estados en el driver).

Desglose en la integrada (ms de GPU; portada / laboratorio):

| Variante | Portada | Laboratorio |
|---|---|---|
| Base | 55 | 77 |
| Sin las 16 luces locales | 24 | 27 |
| Con 12 / 8 / 4 luces locales | 47 / 44 / 34 | 66 / 63 / 46 |
| Sin sombras | 52 | 66 |
| Sin MSAA | 39 | 66 |
| Mitad de las mallas ocultas | 49 | 54 |
| Escena vacía (bloom + resolve + salida) | 6 | 13 |
| 960×540 | 21 | 24 |
| 671×377 | 14 | 14 |

Conclusión: el coste es de sombreado de fragmentos, y entre el 55 % y el 65 % es la evaluación de las 16 luces locales en todos los píxeles, estén o no al alcance. Geometría y culling pesan poco (5-15 %). Las pruebas con culling real por malla (sin fusionar) dibujan 290 k triángulos en vez de 620-660 k y la GPU tarda casi igual.

Carga: lista en 2,7-3,3 s; incluye una tarea larga síncrona de 1,5-1,6 s (generación del PMREM de `RoomEnvironment` y compilación en el primer fotograma de los materiales de bloom, salida y profundidad de sombras, que `compileAsync` no cubre).

## 5. Decisiones tomadas

1. Píxeles idénticos siempre. Sin escalones automáticos de calidad.
2. Se elimina también la degradación automática que ya existe en `src/main.js` (tras 2,5 s de fotogramas lentos baja el DPR a 1 y el bloom a 0,16). Contradice la regla anterior y falsea las medidas. Decisión mía, pendiente de que la usuaria la confirme al leer este documento.
3. Alcance: luces por isla con render por capas (§6.1-6.4), calentamiento bajo el velo (§6.5), compilación en paralelo de todas las variantes (§6.4), verificación (§7). Nada más.

## 6. Diseño técnico

### 6.1 Fragmentos del mundo

El mundo se divide en **fragmentos** (chunks). Cada uno es un `Group` con su geometría fusionada por material, sus instanciados y sus luces, y una **capa** (`Object3D.layers`) propia. Fragmentos:

- Uno por plataforma de `PLATFORMS` (`src/world/layout.js`): `s1`, `s2`, `s3`, `s4`, `sA`, `sB`, `s5`, `s6`. Cada pieza estática (las 8 927 mallas previas a la fusión), cada instancia de árbol, roca, baliza, charco y sombra de contacto, y cada objeto dinámico de estación se asigna a la plataforma más cercana en el plano xz al centro de su caja envolvente en mundo (`islandFloor` de `src/world/world.js` da la plataforma cuando el punto cae dentro; fuera, la más cercana). Puentes, acantilados y bordes van a la isla más cercana; un puente largo asignado a una isla solo agranda la caja de esa isla, lo cual sigue siendo exacto (§6.2).
- `agua-lejana`: el agua fuera del alcance de cualquier luz local. Solo luces globales.
- `dinamico`: las diez baterías de la simulación del capítulo 4 (`K.compact`, `userData.dynamic` en `buildWorld`), que recorren varias islas.
- `transparentes`: todos los objetos con `material.transparent === true` (cristal `M.glass`, charcos de las balizas, sombras de contacto, arcos del capítulo 6, resplandores y registros del taller, alfombrilla del depósito). Se dibujan en un pase final (§6.3).

El agua (`buildTerrain`, `src/world/edges.js`, hoy un `CircleGeometry(1600, 96)`) se divide en una rejilla de celdas cuadradas que cubre la caja del mundo ampliada por el alcance máximo de las luces, más un disco con hueco rectangular para el resto. Cada celda va al fragmento de la plataforma más cercana; el disco exterior, a `agua-lejana`. Las celdas y el hueco comparten aristas exactas (sin solape ni hueco). Es un plano con material sin mapas, así que partirlo no cambia ningún píxel: la rasterización es estanca y el sombreado por píxel solo depende de la posición. Tamaño de celda a elegir por el constructor (orientación: 20-30 m).

Los objetos sin iluminación (`MeshBasicMaterial`: trazas, flechas, arcos, charcos, sombras de contacto) no entran en el cálculo de la caja de luces de su fragmento (§6.2): su color no depende de las luces. Se asignan por posición solo para decidir en qué pase se dibujan.

Lo que ya hace `K.bakeStatic` (fusión por material, UV proyectadas en mundo, `castShadow` según material) se conserva, pero por fragmento: la clave de fusión pasa de `material.uuid` a `fragmento + material.uuid`. `K.scatterTrees`, `K.scatterRocks`, `K.scatterLamps` y `K.contactShadows` producen un InstancedMesh por fragmento y tipo, con la misma geometría, material y color por instancia que hoy.

### 6.2 Conjunto de luces por fragmento (regla exacta)

Para cada fragmento se calcula la caja envolvente en mundo de todo lo que recibe iluminación (lo iluminado por `MeshStandardMaterial` y `MeshPhysicalMaterial`), incluidos los objetos dinámicos de estación en su pose inicial ampliada 2 m. El conjunto de luces locales del fragmento son las luces cuya esfera de centro `light.position` (en mundo, incluido `spot.target` para el cono, que queda dentro de la esfera) y radio `light.distance` corta esa caja.

Por qué es exacto: en three, `getDistanceAttenuation` multiplica por `pow2(saturate(1 - pow4(d / distance)))`, que vale exactamente 0 cuando `d >= distance`. Una luz fuera de su alcance aporta exactamente 0 a cada píxel, tanto en difusa como en especular. Evaluarla o no da el mismo resultado numérico. La regla solo vale si todas las luces locales tienen `distance > 0`; al construir se comprueba y, si alguna no lo tuviera, entra en todos los fragmentos (sigue siendo exacto, solo más caro).

Las luces globales (`key`, `rim`, hemisférica) llevan `layers.enableAll()` y entran en todos los pases.

`dinamico`: su conjunto es la unión de las luces que cortan la caja barrida por las rutas de `SIM` (`src/world/layout.js`), muestreadas, ampliada por el tamaño de una batería. Es fijo y se calcula al construir.

`transparentes`: conjunto = todas las luces locales. Solo el cristal está iluminado y ocupa pocos píxeles.

`agua-lejana`: ninguna luz local.

Para limitar el número de programas (§6.4), el constructor puede **rellenar** conjuntos con luces que no alcanzan el fragmento hasta igualar unas pocas clases de tamaño (número de focos y de puntuales). Añadir una luz que no alcanza es exacto; solo cuesta GPU. Orientación: como mucho tres clases de tamaño en todo el mundo.

### 6.3 Render por capas y pases

Cada fragmento recibe una capa distinta (1..N; la 0 no se usa, para detectar objetos olvidados). Todos sus objetos y sus luces locales están en esa capa. La luz `key` mantiene `shadow.camera.layers.enableAll()` para que todos los fragmentos proyecten sombra.

Un pase nuevo del compositor sustituye a `RenderPass` y renderiza al `readBuffer` como hace aquel. Por fotograma:

1. `renderer.autoClear = false`; limpiar una vez color (con `scene.background`), profundidad y stencil.
2. Para cada fragmento opaco visible, en orden de cerca a lejos (distancia de la cámara a la caja del fragmento): `camera.layers.set(capa)`; `renderer.render(scene, camera)`. Se omite todo fragmento cuya caja queda fuera del frustum. El orden de cerca a lejos favorece el descarte temprano por profundidad.
3. Pase final `transparentes`: `camera.layers.set(capaTransparentes)`; `renderer.render(scene, camera)`. three ordena los transparentes de lejos a cerca y por `renderOrder` como hoy, y todos los opacos ya están dibujados, igual que en un solo pase. Así las relaciones opaco-transparente y transparente-transparente son las de ahora por construcción.
4. Restaurar `autoClear` y la capa de la cámara.

`scene.fog`, `scene.environment` y `scene.background` son los mismos en todos los pases. La sombra se renderiza en el primer `render()` del primer fotograma (`needsUpdate`) con la cámara de sombra viendo todas las capas, y nunca más, como hoy.

Objetos que queden en la capa 0 (olvidados) se pasan a un fragmento `resto` con todas las luces locales (exacto) y se avisa en consola con `?debug`.

Con `?debug&nobake` se mantiene el camino actual (un solo pase, sin fragmentos), para poder identificar piezas y usar los colliders como hoy. Con `?debug` (fusionado) se exponen además `__ecobat.debug.chunks()` (lista de fragmentos con caja, capa, luces, mallas) y `__ecobat.debug.checkLights()`, que comprueba para cada objeto iluminado que toda luz cuya esfera corta su caja en mundo está en el conjunto de su fragmento, y devuelve las violaciones.

Coste de CPU a vigilar: cada `render()` recorre el grafo (`projectObject`) y prepara luces; con unos 10-12 pases por fotograma, poco. Además, al cambiar el conjunto de luces entre pases cambia `lights.state.version` y three vuelve a buscar el programa de cada material una vez por fotograma (`getProgram`, sin compilar): del orden de 1-3 ms. Entra en el presupuesto de 4 ms de JS.

### 6.4 Programas y compilación

three compila un programa por combinación de parámetros del material y **número** de luces de cada tipo, no por luces concretas. Los fragmentos con el mismo número de focos y puntuales comparten programas. El relleno de §6.2 mantiene el total acotado; objetivo orientativo: no más de 120 programas (hoy 50).

Antes del primer fotograma, y bajo el velo, se compila en paralelo (`KHR_parallel_shader_compile`) todo lo que se vaya a usar: para cada fragmento, `camera.layers.set(capa)` y `await renderer.compileAsync(fragmento.group, camera, scene)`, con el destino del compositor activo como hoy (así las opciones de tono y color coinciden). Pasar el grupo del fragmento como `scene` y la escena real como `targetScene` compila solo los materiales de ese fragmento con sus luces. Los materiales de bloom, salida y profundidad de sombras se compilan en el primer fotograma del calentamiento (§6.5), también bajo el velo. La generación del PMREM sigue siendo síncrona (sin acceso a sus programas internos); se acepta.

### 6.5 Calentamiento bajo el velo

Tras compilar, y antes de poner `is-ready`, se renderizan a través del compositor, a tamaño mínimo (orientación: 64×36 px, sin cambiar `pixelRatio`), unos 14 encuadres: los ocho anclajes (`tl.anchors`, portada en p = 0), las marcas `tl.marks.sim` y `tl.marks.conn`, y los tramos de vuelo 0,2525, 0,512, 0,668 y 0,915. En cada uno se coloca la cámara con `sample`, se fijan simulación y conexiones al valor del capítulo y se llama a `world.update` con el estado narrativo correspondiente para que cada pantalla viva se dibuje al menos una vez. Después se restaura el tamaño (`layout()`) y se deja la simulación y las conexiones a 0.

Esto obliga al driver a hacer en la carga todo lo que hoy hace la primera vez que un programa, un estado o una textura entran en cuadro (los picos de 570-605 ms de §4). No toca el DOM de los capítulos. La barra del velo debe seguir avanzando durante compilación y calentamiento (hoy se anima sola; basta con que el hilo principal no se bloquee más de unos 100 ms seguidos, que es lo que garantizan `compileAsync` y los fotogramas pequeños).

### 6.6 Lo que no cambia

Pantallas vivas, texturas procedurales, cámara y coreografía, movimiento reducido (`needsRender` sigue decidiendo cuándo se llama a `composer.render`), versión estática, anexos, navegación por teclas, rutas relativas del build.

## 7. Verificación

### 7.1 Igualdad de píxeles

Dos builds: `antes` (commit actual de `main`) y `después`. Para cada uno, con el arnés existente (`.verify/harness.mjs shots`, que congela el reloj de animación con `freeze(12.5)`), capturas a 1440×810, 1280×720 y 390×844 en p = 0,0001; 0,1555; 0,302; 0,4134; 0,5592; 0,7142; 0,8464; 1 (anclajes) y 0,09; 0,2525; 0,512; 0,668; 0,80; 0,915 (transiciones). Se comparan con un script (pngjs, como `crop.mjs`): número de píxeles con diferencia mayor que 1/255 en cualquier canal debe ser **0**; con diferencia exactamente 1/255, como mucho el 0,01 % (redondeo de mezcla y acumulación del bloom). Cualquier otra diferencia es un fallo que hay que arreglar, no documentar.

El mundo es determinista entre cargas (los generadores usan semillas; `groundTexture`, que usa `Math.random`, no se llama desde ningún sitio), así que la comparación es válida sin cambios previos.

### 7.2 Rendimiento

Las sondas usadas en la medición (`gpuprobe.mjs`, `scenestats.mjs`, `breakdown.mjs`, `sweep.mjs`, `gpuinfo.mjs`, `perfprobe.mjs`, hoy en `C:\Users\yamil\.claude\jobs\7b9bc624\tmp\`) se copian a `.verify/perf/` y se documenta su uso en `.verify/brief.md`. Se ejecutan contra `vite preview` del build `antes` y `después`, en la RTX 5090 y en la integrada (`CHROME_EXTRA="--use-adapter-luid=0,113510"`). Criterios: los de §2 (−45 % de GPU por anclaje en la integrada, ningún fotograma > 120 ms tras el velo, JS ≤ 4 ms, carga ≤ +3 s / +0,5 s). Los números finales se recogen en el README (sección de rendimiento) con la fecha.

### 7.3 Regresiones funcionales

`node harness.mjs info|clearance|motion`, `node navprobe.mjs`, `node consoleprobe.mjs` (cero errores y avisos en consola), `reducedprobe.mjs`, la versión estática y las capturas de móvil deben dar lo mismo que hoy. `?debug&nobake` sigue listando colliders y piezas.

## 8. Riesgos y mitigaciones

- Orden de transparencias: resuelto por construcción con el pase final (§6.3). La verificación 7.1 lo confirma en los encuadres con cristal (taller, laboratorio, evaluación) y con arcos (c6, cierre).
- Programas de más y carga más larga: relleno de conjuntos (§6.2), compilación en paralelo, medida de carga en la integrada. Si la carga superase el presupuesto, reducir clases de tamaño antes que renunciar a fragmentos.
- Objetos que se mueven entre fragmentos: solo las baterías de la simulación, con conjunto propio. `checkLights()` en `?debug` lo vigila; el constructor lo ejecuta en los encuadres de 7.1.
- Overhead de pases en CPU floja: medir JS por fotograma en la integrada (la CPU es la misma, así que la medida se hace en la 5090 y se escala ×2 para un 5500G); si pasara de 4 ms, fusionar fragmentos con conjuntos iguales en un mismo pase (misma capa).
- `compile` con `targetScene`: comprobar en three 0.186 que la firma `compileAsync(scene, camera, targetScene)` compila solo los materiales de `scene` con las luces de `targetScene` filtradas por `camera.layers`; si no, compilar con la escena completa por capa y aceptar programas de más.
- Picos del driver no cubiertos por el calentamiento (por ejemplo, el primer uso a tamaño real del destino MSAA): ocurren en el primer fotograma real, aún bajo el velo, porque `is-ready` se pone después de ese fotograma.

## 9. Lo que queda al constructor

- Estructura de módulos y nombres (por ejemplo `src/world/chunks.js` para la asignación y las cajas, `src/render/IslandPass.js` para el pase). Mantener `world.js` como punto de entrada que devuelve `update`, `setSimulation`, `setConnections`, `colliders` y, nuevo, la lista de fragmentos.
- Tamaño de celda del agua, clases de tamaño de conjuntos de luces, margen de las cajas, heurística exacta de asignación de piezas largas.
- Cómo se marca cada objeto con su fragmento (por posición al fusionar, o al construir desde `ctx`), siempre que el resultado cumpla §6.1-6.2 y `checkLights()` no devuelva violaciones.
- Progreso visible en la barra del velo durante compilación y calentamiento.
- Orden de trabajo sugerido: (1) fragmentos y pases con todas las luces en todos los fragmentos (debe dar píxeles idénticos y servir para medir el overhead de los pases); (2) conjuntos de luces por fragmento; (3) compilación por capa; (4) calentamiento; (5) quitar la degradación automática; (6) medidas y README.
