# Rendimiento en gráficas integradas sin cambiar el diseño

Fecha: 2026-10-21. Estado: revisado por un constructor independiente; listo para aprobación.

## 1. Intención

La presentación va fluida en un PC con gráfica dedicada, pero en una gráfica integrada (Ryzen 5 5500G con Vega 7, o peor) va a tirones y se congela a ratos. Hay que dejarla fluida en esas máquinas **sin cambiar nada de lo que se ve**: ni geometría, ni materiales, ni luces, ni cámara, ni posprocesado. El criterio es literal: las capturas de cada encuadre antes y después deben ser píxel a píxel iguales (con la tolerancia de redondeo definida en §7.1).

La decisión del proyecto es que no habrá ningún escalón de calidad automático (ni MSAA 2×, ni bajar el DPR, ni apagar bloom). Solo entran optimizaciones que producen el mismo píxel.

## 2. Objetivos, no objetivos y anti-objetivos

Objetivos:

- En la integrada de referencia de este PC (§4), el tiempo de GPU por fotograma en cada anclaje baja al menos un 45 % (p. ej. de 55-77 ms a 30-40 ms). Extrapolado a una Vega 7, unas tres veces más rápida, eso son 60 fps estables.
- Desaparecen los tirones al entrar por primera vez en cada zona: tras levantar el velo, ningún fotograma supera los 120 ms en un recorrido completo con rueda rápida y saltos por teclas, medido en la integrada de referencia. Esta es la puerta dura.
- El coste de JS del hilo principal por fotograma no supera los 4 ms en este PC (hoy 1,1-2,2 ms).
- La carga (velo) crece como mucho 3 s en la integrada de referencia (orientativo) y 0,5 s en la RTX 5090. Si en la referencia no caben la carga y los tirones a la vez, manda la navegación: se acepta hasta +4 s de carga en la referencia (≈ +1,5 s en una Vega 7) siempre que la barra del velo siga avanzando.
- `?debug`, `?debug&nobake`, el movimiento reducido, la versión estática y la publicación en GitHub Pages siguen funcionando igual.

No objetivos (quedan fuera, decidido con la usuaria):

- Borrar geometría oculta, LOD, decimación, streaming de texturas, oclusión precalculada (PVS).
- Cambiar resolución, MSAA, sombras, bloom, luces o materiales en ninguna máquina.
- Reducir el trabajo de las pantallas vivas (canvas) o de las texturas procedurales.
- Tocar `src/camera.js`, `src/content.js`, `src/ui.js` o `src/styles.css`.

Anti-objetivos (sería un fracaso aunque fuera rápido):

- Cualquier diferencia visible en los encuadres de referencia (§7.1), en escritorio, proyector 1280×720 o móvil vertical.
- Tirones nuevos al navegar (por ejemplo, compilaciones o subidas a GPU a mitad de recorrido).
- Una carga en frío notablemente más larga o un velo que se queda congelado sin avanzar.

## 3. Restricciones

- Stack actual: three 0.186.1, GSAP ScrollTrigger, Vite 8, sin dependencias nuevas. Build con `base: './'` para GitHub Pages. three queda fijado en 0.186.1 porque el diseño copia texto de sus `ShaderChunk` (§6.3); subirlo de versión exige repetir la verificación 7.1.
- El mundo es procedural (no hay modelos ni texturas externas). La geometría estática se fusiona en `K.bakeStatic` (`src/world/kit.js`) por material y se proyectan las UV en coordenadas de mundo; esa proyección debe conservarse tal cual.
- El renderizado pasa por `EffectComposer` con `RenderPass`, `UnrealBloomPass` y `OutputPass` sobre un `WebGLRenderTarget` HalfFloat con `samples: 4` (`src/main.js`). Bloom, salida y el pase de escena no se tocan: sigue habiendo **un solo** `renderer.render()` por fotograma. Comprobado en three 0.186: cada `render()` sobre un destino multimuestra hace un resolve completo (`WebGLRenderer.render` → `textures.updateMultisampleRenderTarget`), así que cualquier diseño con varios pases de escena pagaría un resolve de 1080p HalfFloat 4× por pase; en la integrada son 1-2 ms cada uno. Por eso se descartó el render por capas.
- La sombra de la luz principal (`key`, 4096², `PCFShadowMap`) se renderiza una sola vez (`shadowMap.autoUpdate = false`, `needsUpdate` al arrancar). No cambia.
- Los materiales `M.*` compartidos no se modifican en tiempo de ejecución. Hoy, al final de `buildWorld` (`src/world/world.js`), cada InstancedMesh con y sin color por instancia recibe su clon; ese paso queda absorbido por el clonado por fragmento de §6.3.
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
| Escena vacía (limpieza, resolve, bloom, salida) | 6 | 13 |
| 960×540 | 21 | 24 |
| 671×377 | 14 | 14 |

Conclusión: el coste es de sombreado de fragmentos, y entre el 55 % y el 65 % es la evaluación de las 16 luces locales en todos los píxeles, estén o no al alcance. Geometría y culling pesan poco (5-15 %). Las pruebas con culling real por malla (sin fusionar) dibujan 290 k triángulos en vez de 620-660 k y la GPU tarda casi igual.

Carga: lista en 2,7-3,3 s; incluye una tarea larga síncrona de 1,5-1,6 s (generación del PMREM de `RoomEnvironment` y compilación en el primer fotograma de los materiales de bloom, salida y profundidad de sombras, que `compileAsync` no cubre).

## 5. Decisiones tomadas

1. Píxeles idénticos siempre (tolerancia de redondeo de §7.1). Sin escalones automáticos de calidad.
2. Se elimina la degradación automática que ya existe en `src/main.js` (líneas 483-494: tras 2,5 s de fotogramas lentos baja el DPR a 1 y el bloom a 0,16). Se deriva de la decisión 1: hoy ya cambia píxeles en máquinas lentas, y en la integrada de referencia saltaría siempre y falsearía las medidas. Decisión del diseño; la usuaria la revisa al leer este documento.
3. Un solo pase de escena. Las luces por fragmento se inyectan en clones de material (§6.3), no en pases de render por capas (ver §3, resolve por pase).
4. Alcance: fragmentos y luces por fragmento (§6.1-6.3), compilación en paralelo de todas las variantes (§6.4), calentamiento bajo el velo (§6.5), verificación (§7). Nada más.
5. Si una parte no supera la verificación 7.1 por redondeo (no por error lógico), esa parte vuelve a su forma exacta (por ejemplo, el agua entera con todas las luces) y el resto se entrega. La tolerancia no se relaja más de lo que fija §7.1.

## 6. Diseño técnico

### 6.1 Fragmentos del mundo

El mundo se divide en **fragmentos** (chunks). Cada fragmento es un `Group` con su geometría fusionada por material, sus instanciados y un **conjunto de luces locales** fijo. No hay capas ni pases: todo sigue en la misma escena y en el mismo `render()`. Fragmentos:

- Uno por plataforma de `PLATFORMS` (`src/world/layout.js`): `s1`, `s2`, `s3`, `s4`, `sA`, `sB`, `s5`, `s6`. Cada pieza estática (las 8 927 mallas previas a la fusión), cada instancia de árbol, roca, baliza, charco y sombra de contacto, y cada objeto dinámico de estación se asigna a la plataforma más cercana en el plano xz al centro de su caja envolvente en mundo (`islandFloor` de `src/world/world.js` da la plataforma cuando el punto cae dentro; fuera, la más cercana). Puentes, acantilados y bordes van a la isla más cercana; un puente largo asignado a una isla solo agranda la caja de esa isla, lo cual sigue siendo exacto (§6.2).
- `agua-lejana`: el agua fuera del alcance de cualquier luz local. Solo luces globales.
- `dinamico`: las diez baterías de la simulación del capítulo 4 (`K.compact`, `userData.dynamic` en `buildWorld`), que recorren varias islas.

El agua (`buildTerrain`, `src/world/edges.js`, hoy un `CircleGeometry(1600, 96)` en abanico desde el centro) se divide en una rejilla de celdas cuadradas que cubre la caja del mundo ampliada por el alcance máximo de las luces, más un disco con hueco rectangular para el resto. Cada celda va al fragmento de la plataforma más cercana; el disco exterior, a `agua-lejana`. Las celdas y el hueco comparten aristas exactas (sin solape ni hueco). Es un plano con material sin mapas: partirlo no cambia la cobertura de píxeles ni el sombreado salvo redondeos de último bit en los atributos interpolados (§7.1 y §8). Tamaño de celda a elegir por el constructor (orientación: 20-30 m). Si el agua partida no superara §7.1, se deja entera en un fragmento propio con todas las luces locales (exacto; cuesta unos 10 ms más en portada y cierre en la integrada de referencia).

Los objetos sin iluminación (`MeshBasicMaterial`: trazas, flechas, arcos, charcos, sombras de contacto, resplandores) no entran en el cálculo de la caja de luces de su fragmento: su color no depende de las luces. Se asignan por posición solo para fusionarlos y para el culling.

Lo que ya hace `K.bakeStatic` (fusión por material, UV proyectadas en mundo, `castShadow` según material) se conserva, pero por fragmento: la clave de fusión pasa de `material.uuid` a `fragmento + material.uuid`. `K.scatterTrees`, `K.scatterRocks`, `K.scatterLamps` y `K.contactShadows` producen un InstancedMesh por fragmento y tipo, con la misma geometría, material y color por instancia que hoy. Los transparentes (cristal, charcos, sombras de contacto, arcos) se fusionan e instancian igual que el resto; como el pase es único, three los ordena exactamente como hoy.

### 6.2 Conjunto de luces por fragmento (regla exacta)

Para cada fragmento se calcula la caja envolvente en mundo de todo lo que recibe iluminación (`MeshStandardMaterial` y `MeshPhysicalMaterial`), incluidos los objetos dinámicos de estación en su pose inicial ampliada 2 m. El conjunto de luces locales del fragmento son las luces cuya esfera de centro `light.position` en mundo y radio `light.distance` corta esa caja (el cono de un foco queda dentro de su esfera).

Por qué es exacto: en three, `getDistanceAttenuation` (`lights_pars_begin`) multiplica por `pow2(saturate(1 - pow4(d / distance)))`, que vale exactamente 0 cuando `d >= distance`; `getSpotLightInfo` y `getPointLightInfo` dejan entonces `light.color = vec3(0)` y `RE_Direct` suma exactamente `vec3(0)` a difusa y especular (un cero multiplica términos finitos). Sumar un cero exacto no cambia ninguna suma en coma flotante. Evaluar esa luz o no da el mismo resultado numérico. La regla solo vale si todas las luces locales tienen `distance > 0`; al construir se comprueba y, si alguna no lo tuviera, entra en todos los fragmentos (sigue siendo exacto, solo más caro).

Orden: dentro de cada fragmento, las luces conservan el orden relativo que tienen en la lista global de three (orden de recorrido de la escena; `WebGLLights.setup` lo mantiene porque ninguna luz local proyecta sombra ni tiene mapa). Así las sumas de la iluminación se hacen en el mismo orden que hoy y los redondeos coinciden.

Las luces globales (`key`, `rim`, hemisférica) siguen por el camino normal de three en todos los materiales, sombra incluida. No se tocan.

`dinamico`: su conjunto es la unión de las luces que cortan la caja barrida por las rutas de `SIM` (`src/world/layout.js`), muestreadas, ampliada por el tamaño de una batería. Fijo, calculado al construir.

`agua-lejana`: ninguna luz local.

Para limitar el número de programas (§6.4), el constructor puede **rellenar** conjuntos con luces que no alcanzan el fragmento hasta igualar unas pocas clases de tamaño (número de focos y de puntuales). Añadir una luz que no alcanza es exacto en cualquier posición de la lista; solo cuesta GPU. Orientación: como mucho tres clases de tamaño en todo el mundo.

### 6.3 Luces por fragmento en un solo pase: clones de material con luces propias

Cada material iluminado usado en un fragmento se sustituye por un **clon por fragmento** (`material.clone()`, mismos parámetros, misma referencia a texturas) al que se inyectan sus luces locales. Los `M.*` originales no se tocan. Los materiales que ya traen `onBeforeCompile` y `customProgramCacheKey` (el acantilado `uplit` de `src/world/edges.js`, que sustituye `common`, `map_fragment`, `roughnessmap_fragment` y `emissivemap_fragment`) encadenan: el clon llama primero al `onBeforeCompile` original y después aplica la inyección; la clave de programa concatena la original con la de la inyección.

Inyección (`onBeforeCompile` del clon):

1. Uniformes nuevos: `uChunkPoint`, array de `K_point` objetos con los mismos campos que el struct `PointLight` de three (`position`, `color`, `distance`, `decay`), y `uChunkSpot`, array de `K_spot` objetos con los campos del struct `SpotLight` (`position`, `direction`, `color`, `distance`, `decay`, `coneCos`, `penumbraCos`). Se declaran en el fragment shader justo después de `#include <lights_pars_begin>` con los **mismos tipos de struct** que define three (`uniform SpotLight uChunkSpot[K_spot];`), para poder llamar a `getSpotLightInfo` y `getPointLightInfo` tal cual. Con `K = 0` no se declara el array (GLSL no admite tamaño 0).
2. `#include <lights_fragment_begin>` se sustituye por el texto de `THREE.ShaderChunk.lights_fragment_begin` con dos cambios y nada más: en el bucle de puntuales, `for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ )` pasa a `i < K_point` (literal) y `pointLight = pointLights[ i ];` a `pointLight = uChunkPoint[ i ];`; en el de focos, `i < K_spot` y `spotLight = uChunkSpot[ i ];`. Con `K = 0` el bloque correspondiente se elimina entero. Las guardas `#if ( NUM_SPOT_LIGHTS > 0 )`, los `#pragma unroll_loop` y los bloques de sombras y mapas de foco (que quedan fuera con `NUM_SPOT_LIGHT_SHADOWS = 0`) se dejan como están; three aplica `replaceLightNums` y `unrollLoops` después de `onBeforeCompile`, así que los literales y los pragmas funcionan igual que en el chunk original. La sustitución comprueba que cada cadena buscada aparece exactamente una vez y falla ruidosamente si three cambiara el chunk.
3. Los arrays globales `pointLights` y `spotLights` quedan declarados pero sin uso: el compilador los elimina, three no los encuentra activos y no los sube.
4. `customProgramCacheKey` del clon = clave original + `|chunk|K_point|K_spot`. three compila un programa por combinación de parámetros del material y de `(K_point, K_spot)`; los fragmentos con el mismo tamaño de conjunto comparten programa.

Valores de los uniformes: por fotograma y por fragmento se calculan una sola vez (en `onBeforeRender` del primer objeto del fragmento que se dibuja, con una marca de fotograma) copiando literalmente las operaciones de `WebGLLights.setup` y `setupView` de three (archivo `node_modules/three/build/three.module.js`, función `WebGLLights`): posición en espacio de vista con `setFromMatrixPosition(light.matrixWorld).applyMatrix4(camera.matrixWorldInverse)`; dirección del foco como posición menos `target` transformada con `transformDirection`; `color.copy(light.color).multiplyScalar(light.intensity)`; `distance`, `decay`, `coneCos = Math.cos(angle)`, `penumbraCos = Math.cos(angle * (1 - penumbra))`. Mismas llamadas, mismos dobles, mismos float32 al subir. Los objetos de valor son compartidos por todos los clones de un fragmento; three sube uniformes al enlazar cada material, como hoy con los arrays globales, pero con arrays más cortos (menos llamadas `uniform*` que ahora).

Dinámicos: los clones del fragmento `dinamico` llevan la unión de luces de §6.2; las baterías de `K.compact` reciben esos clones. Los dinámicos de estación reciben los clones de su fragmento.

Sombra: sin cambios. La luz `key` sigue el camino normal, la sombra se renderiza una vez al arrancar y la cámara no cambia de capas.

Con `?debug&nobake` se mantiene el camino actual (sin fragmentos ni clones), para identificar piezas y usar los colliders como hoy. Con `?debug` (fusionado) se exponen además `__ecobat.debug.chunks()` (lista de fragmentos con caja, luces, mallas, clones) y `__ecobat.debug.checkLights()`, que comprueba para cada objeto iluminado que toda luz cuya esfera corta su caja en mundo está en el conjunto de su fragmento, y devuelve las violaciones. Un objeto iluminado que llegue a la fusión sin fragmento asignado (olvido) va a un fragmento `resto` con todas las luces locales (exacto) y se avisa en consola con `?debug`.

### 6.4 Programas y compilación

three compila un programa por combinación de parámetros del material y tamaño del conjunto `(K_point, K_spot)`. El relleno de §6.2 mantiene el total acotado; objetivo orientativo: no más de 120 programas (hoy 50).

Antes del primer fotograma, y bajo el velo, se compila en paralelo (`KHR_parallel_shader_compile`) como hoy: `renderer.setRenderTarget(composer.readBuffer)` y `await renderer.compileAsync(scene, camera)`. Como todos los clones están en la escena, una sola llamada los cubre. Los materiales de bloom, salida y profundidad de sombras se compilan en el primer fotograma del calentamiento (§6.5), también bajo el velo. La generación del PMREM sigue siendo síncrona (sin acceso a sus programas internos); se acepta.

### 6.5 Calentamiento bajo el velo

Tras compilar, y antes de poner `is-ready`, se renderizan a través del compositor, a tamaño mínimo (orientación: 64×36 px, sin cambiar `pixelRatio`), unos 14 encuadres: los ocho anclajes (`tl.anchors`, portada en p = 0), las marcas `tl.marks.sim` y `tl.marks.conn`, y los tramos de vuelo 0,2525, 0,512, 0,668 y 0,915. En cada uno se coloca la cámara con `sample`, se fijan simulación y conexiones al valor del capítulo y se llama a `world.update` con el estado narrativo correspondiente para que cada pantalla viva se dibuje al menos una vez. Después se restaura el tamaño (`layout()`) y se dejan simulación y conexiones a 0.

Esto obliga al driver a hacer en la carga todo lo que hoy hace la primera vez que un programa, un estado o una textura entran en cuadro (los picos de 570-605 ms de §4). No toca el DOM de los capítulos. La barra del velo debe seguir avanzando durante compilación y calentamiento (hoy se anima sola; basta con que el hilo principal no se bloquee más de unos 100 ms seguidos, que es lo que dan `compileAsync` y los fotogramas pequeños). Si el calentamiento se come el presupuesto de carga, se recortan primero los tramos de vuelo y nunca los anclajes, y se mide de nuevo el objetivo de tirones (§2): la navegación manda.

### 6.6 Lo que no cambia

Pantallas vivas, texturas procedurales, cámara y coreografía, movimiento reducido (`needsRender` sigue decidiendo cuándo se llama a `composer.render`), versión estática, anexos, navegación por teclas, rutas relativas del build, orden de dibujo de opacos y transparentes (un solo pase).

## 7. Verificación

### 7.1 Igualdad de píxeles

Dos builds: `antes` (commit `69b0a0a` de `main`, el anterior a este diseño) y `después`. Para cada uno, con el arnés existente (`.verify/harness.mjs shots`, que congela el reloj de animación con `freeze(12.5)`), capturas a 1440×810, 1280×720 y 390×844 en p = 0,0001; 0,1555; 0,302; 0,4134; 0,5592; 0,7142; 0,8464; 1 (anclajes) y 0,09; 0,2525; 0,512; 0,668; 0,80; 0,915 (transiciones).

Comparación con un script propio (pngjs, como `crop.mjs`). Criterio de "idéntico":

- Ningún píxel difiere en más de 1/255 en ningún canal, salvo píxeles **aislados** (sin ningún vecino de 8 que también difiera), que pueden llegar a 8/255 y suman como mucho el 0,001 % de la imagen (unos 12 píxeles a 1440×810). Esta excepción cubre saltos de una muestra PCF o de un umbral de bloom por redondeo de último bit; cualquier diferencia con estructura (dos píxeles contiguos, una línea, una mancha) es un fallo.
- El script también escribe una imagen de diferencias amplificada por cada captura, para revisar a ojo lo que haya.

Por qué hay tolerancia: el compilador de sombreadores reordena y contrae operaciones al cambiar el código, y partir el agua cambia los atributos interpolados en el último bit. Son diferencias de 1/255 invisibles. No cubren errores lógicos: si una luz que alcanza queda fuera de un fragmento, la diferencia es grande y con estructura, y el script la detecta. Cualquier parte que no cumpla el criterio vuelve a su forma exacta (decisión 5).

El mundo es determinista entre cargas (los generadores usan semillas; `groundTexture`, que usa `Math.random`, no se llama desde ningún sitio), así que la comparación es válida sin cambios previos.

### 7.2 Rendimiento

Las sondas usadas en la medición (`gpuprobe.mjs`, `scenestats.mjs`, `breakdown.mjs`, `sweep.mjs`, `gpuinfo.mjs`, `perfprobe.mjs`, hoy en `C:\Users\yamil\.claude\jobs\7b9bc624\tmp\`) se copian a `.verify/perf/` y se documenta su uso en `.verify/brief.md`. Se ejecutan contra `vite preview` del build `antes` y `después`, en la RTX 5090 y en la integrada (`CHROME_EXTRA="--use-adapter-luid=0,113510"`). Criterios: los de §2 (−45 % de GPU por anclaje en la integrada, ningún fotograma > 120 ms tras el velo, JS ≤ 4 ms, carga ≤ +3 s orientativo y ≤ +4 s duro en la referencia, ≤ +0,5 s en la 5090). Los números finales se recogen en el README (sección de rendimiento) con la fecha.

### 7.3 Regresiones funcionales

`node harness.mjs info|clearance|motion`, `node navprobe.mjs`, `node consoleprobe.mjs` (cero errores y avisos en consola), `reducedprobe.mjs`, la versión estática y las capturas de móvil deben dar lo mismo que hoy. `?debug&nobake` sigue listando colliders y piezas. `__ecobat.debug.checkLights()` devuelve cero violaciones en los 14 encuadres de 7.1.

## 8. Riesgos y mitigaciones

- Dependencia del texto de los chunks de three: la sustitución de §6.3 comprueba que cada cadena aparece exactamente una vez y lanza un error si no; three fijado en 0.186.1 (§3).
- Uniformes calculados a mano: copiar las operaciones de `WebGLLights` literalmente y verificar con 7.1; el paso 2 del orden de trabajo (§9) valida el mecanismo antes de quitar ninguna luz.
- Programas de más y carga más larga: relleno de conjuntos (§6.2), compilación en paralelo, medida de carga en la integrada. Si la carga superase el presupuesto, reducir clases de tamaño antes que renunciar a fragmentos.
- Agua partida: redondeos de último bit en atributos interpolados (posición de vista, coordenada de sombra, niebla). Cubierto por la tolerancia de 7.1; si no la cumple, agua entera con todas las luces (§6.1).
- Objetos que se mueven entre fragmentos: solo las baterías de la simulación, con conjunto propio. `checkLights()` lo vigila en los 14 encuadres.
- Coste de CPU de subir uniformes: los arrays por fragmento son más cortos que los globales de hoy; medir JS por fotograma en este PC y escalar ×2 para un 5500G; límite 4 ms.
- Encadenado con `uplit`: el clon debe llamar al `onBeforeCompile` original antes de inyectar; la clave de programa debe incluir ambas partes. Verificado que `uplit` no toca `lights_fragment_begin` ni `lights_pars_begin`.
- Picos del driver no cubiertos por el calentamiento (por ejemplo, el primer uso a tamaño real del destino MSAA): ocurren en el primer fotograma real, aún bajo el velo, porque `is-ready` se pone después de ese fotograma.

## 9. Lo que queda al constructor

- Estructura de módulos y nombres (por ejemplo `src/world/chunks.js` para asignación, cajas y conjuntos de luces, y `src/world/chunkLights.js` para el clonado e inyección). `world.js` sigue siendo el punto de entrada y devuelve, además de lo actual, la lista de fragmentos.
- Tamaño de celda del agua, clases de tamaño de conjuntos de luces, margen de las cajas, heurística exacta de asignación de piezas largas, cómo se marca cada objeto con su fragmento (por posición al fusionar, o al construir desde `ctx`), siempre que el resultado cumpla §6.1-6.2 y `checkLights()` no devuelva violaciones.
- Progreso visible en la barra del velo durante compilación y calentamiento.
- Orden de trabajo sugerido, cada paso con la verificación 7.1 en verde antes del siguiente:
  1. Fusión por fragmento y material, instanciados por fragmento, agua en celdas, clones de material por fragmento **sin inyección** (los clones usan las luces globales de three, como hoy). Debe dar píxeles idénticos y permite medir el coste de más llamadas de dibujo.
  2. Inyección de §6.3 con `K` igual al total de luces locales en todos los fragmentos (16 luces en cada clon). Debe dar píxeles idénticos: valida el mecanismo (chunk sustituido, uniformes calculados a mano) antes de quitar ninguna luz.
  3. Conjuntos por fragmento con la regla de §6.2 y relleno por clases. Medir GPU en la integrada.
  4. Compilación de todas las variantes y calentamiento (§6.4-6.5). Medir tirones y carga en la integrada.
  5. Quitar la degradación automática (decisión 2).
  6. Sondas a `.verify/perf/`, números en el README, capturas de `docs/evidencia` sin cambios (deben seguir siendo válidas por construcción).
