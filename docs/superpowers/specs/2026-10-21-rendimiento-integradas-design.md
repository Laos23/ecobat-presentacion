# Rendimiento en gráficas integradas sin cambiar el diseño

Fecha: 2026-10-21. Estado: aprobado (revisado por un constructor independiente; enmienda de la tarea 7 aprobada el 2026-10-22; enmienda de la tarea 8 hecha el 2026-10-22, §11).

Enmienda del 2026-10-22, hecha durante la implementación (tarea 7 del plan): §6.1, §6.2, §6.3, §6.4 y §8 recogen la guarda por píxel del sombreador inyectado, los conjuntos de luces por pieza y el relleno por parejas de tamaño. **La enmienda queda aprobada el 2026-10-22 por decisión del ejecutor autónomo, con la autorización general de la usuaria («evalúa lo que creas mejor y sigue»): conserva los píxeles idénticos y cumple el objetivo de GPU; si la usuaria la rechaza, §10 explica cómo deshacer cada parte.** §10 resume qué cambia respecto al texto del commit `723b652`, por qué, con qué medidas y cómo deshacer cada parte.

Enmienda del 2026-10-22, hecha durante la implementación (tarea 8 del plan): §5, §6.4, §6.5, §6.6, §7.2, §7.3 y §8 recogen el ritmo de la GPU (§6.7, nuevo), un calentamiento que no toca el estado de las estaciones y la compilación del bloom a la vez que la del mundo. La hizo el ejecutor autónomo con la delegación general de la usuaria («evalúa lo que creas mejor y sigue»), porque las medidas muestran que el texto anterior no cumplía sus propios objetivos: con el calentamiento tal cual seguía habiendo fotogramas de más de 120 ms (la puerta dura de §2), y el estado que el calentamiento dejaba en las estaciones cambiaba la primera visita a los capítulos, sobre todo con movimiento reducido, que debe seguir funcionando igual (§2). Todo conserva los píxeles idénticos. §11 resume qué cambia, por qué, con qué medidas, en qué se aparta de la tarea 8 del plan y cómo deshacer cada parte.

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
4. Alcance: fragmentos y luces por fragmento (§6.1-6.3), compilación en paralelo de todas las variantes (§6.4), calentamiento bajo el velo (§6.5), ritmo de la GPU (§6.7; enmienda, §11), verificación (§7). Nada más.
5. Si una parte no supera la verificación 7.1 por redondeo (no por error lógico), esa parte vuelve a su forma exacta (por ejemplo, el agua entera con todas las luces) y el resto se entrega. La tolerancia no se relaja más de lo que fija §7.1.

## 6. Diseño técnico

### 6.1 Fragmentos del mundo

El mundo se divide en **fragmentos** (chunks). Cada fragmento es un `Group` con su geometría fusionada por material, sus instanciados y un **conjunto de luces locales** fijo. No hay capas ni pases: todo sigue en la misma escena y en el mismo `render()`. Fragmentos:

- Uno por plataforma de `PLATFORMS` (`src/world/layout.js`): `s1`, `s2`, `s3`, `s4`, `sA`, `sB`, `s5`, `s6`. Cada pieza estática (las 8 927 mallas previas a la fusión), cada instancia de árbol, roca, baliza, charco y sombra de contacto, y cada objeto dinámico de estación se asigna a la plataforma más cercana en el plano xz al centro de su caja envolvente en mundo (`islandFloor` de `src/world/world.js` da la plataforma cuando el punto cae dentro; fuera, la más cercana). Puentes, acantilados y bordes van a la isla más cercana; un puente largo asignado a una isla solo le añade las luces que alcanzan el propio puente, lo cual sigue siendo exacto (§6.2).
- `agua-lejana`: el agua fuera del alcance de cualquier luz local. Solo luces globales.
- `dinamico`: las diez baterías de la simulación del capítulo 4 (`K.compact`, `userData.dynamic` en `buildWorld`), que recorren varias islas.

El agua (`buildTerrain`, `src/world/edges.js`, hoy un `CircleGeometry(1600, 96)` en abanico desde el centro) se divide en una rejilla de celdas cuadradas que cubre la caja del mundo ampliada por el alcance máximo de las luces, más un disco con hueco rectangular para el resto. Cada celda va al fragmento de la plataforma más cercana; el disco exterior, a `agua-lejana`. Las celdas y el hueco comparten aristas exactas (sin solape ni hueco). Es un plano con material sin mapas: partirlo no cambia la cobertura de píxeles ni el sombreado salvo redondeos de último bit en los atributos interpolados (§7.1 y §8). Tamaño de celda a elegir por el constructor (orientación: 20-30 m). Si el agua partida no superara §7.1, se deja entera en un fragmento propio, `agua`, cuyo conjunto sale de la regla de §6.2 con la caja del disco (exacto). Es lo implementado: las celdas no superaron §7.1 (tarea 3), y el disco recibe 2 de las 5 puntuales y 8 de los 11 focos; las otras 6 luces no llegan a su plano (enmienda, §10).

Los objetos sin iluminación (`MeshBasicMaterial`: trazas, flechas, arcos, charcos, sombras de contacto, resplandores) no entran en el cálculo de la caja de luces de su fragmento: su color no depende de las luces. Se asignan por posición solo para fusionarlos y para el culling.

Lo que ya hace `K.bakeStatic` (fusión por material, UV proyectadas en mundo, `castShadow` según material) se conserva, pero por fragmento: la clave de fusión pasa de `material.uuid` a `fragmento + material.uuid`. `K.scatterTrees`, `K.scatterRocks`, `K.scatterLamps` y `K.contactShadows` producen un InstancedMesh por fragmento y tipo, con la misma geometría, material y color por instancia que hoy. Los transparentes (cristal, charcos, sombras de contacto, arcos) se fusionan e instancian igual que el resto; como el pase es único, three los ordena exactamente como hoy.

### 6.2 Conjunto de luces por fragmento (regla exacta)

Para cada fragmento se calcula la caja envolvente en mundo de cada pieza que recibe iluminación (`MeshStandardMaterial` y `MeshPhysicalMaterial`): cada pieza estática tal como llega a la fusión, cada instancia de un instanciado y cada malla que no se fusiona; los objetos dinámicos de estación, en su pose inicial ampliada 2 m. Todas las cajas se amplían además 0,5 m. El conjunto de luces locales del fragmento son las luces cuya esfera de centro `light.position` en mundo y radio `light.distance` corta alguna de esas cajas (el cono de un foco queda dentro de su esfera). La caja que une todas las del fragmento también daría un conjunto exacto, pero abarca el vacío entre piezas: un puente o un acantilado asignados a una isla le traerían luces que solo alcanzan ese hueco (enmienda, §10).

Por qué es exacto: en three, `getDistanceAttenuation` (`lights_pars_begin`) multiplica por `pow2(saturate(1 - pow4(d / distance)))`, que vale exactamente 0 cuando `d >= distance`; `getSpotLightInfo` y `getPointLightInfo` dejan entonces `light.color = vec3(0)` y `RE_Direct` suma exactamente `vec3(0)` a difusa y especular (un cero multiplica términos finitos). Sumar un cero exacto no cambia ninguna suma en coma flotante. Evaluar esa luz o no da el mismo resultado numérico. Cada píxel de un fragmento pertenece a alguna de sus piezas, así que una luz que no corta la caja de ninguna suma ese cero en todos los píxeles del fragmento. El argumento vale también píxel a píxel: donde una luz del conjunto no llega (más allá de `distance` o, en un foco, fuera del cono), three marca `light.visible = false` y su aporte es ese mismo cero; la guarda de §6.3 se salta ahí la llamada a `RE_Direct`. Solo quedan fuera casos de medida nula en que algún término del BRDF no es finito (por ejemplo, la luz exactamente detrás del píxel en la prolongación de la línea de visión, donde `normalize` recibe un vector nulo). La regla de quitar luces del conjunto tiene la misma salvedad. La regla solo vale si todas las luces locales tienen `distance > 0`; al construir se comprueba y, si alguna no lo tuviera, entra en todos los fragmentos (sigue siendo exacto, solo más caro).

Orden: dentro de cada fragmento, las luces conservan el orden relativo que tienen en la lista global de three (orden de recorrido de la escena; `WebGLLights.setup` lo mantiene porque ninguna luz local proyecta sombra ni tiene mapa). Así las sumas de la iluminación se hacen en el mismo orden que hoy y los redondeos coinciden.

Las luces globales (`key`, `rim`, hemisférica) siguen por el camino normal de three en todos los materiales, sombra incluida. No se tocan.

`dinamico`: su conjunto es la unión de las luces que cortan la caja barrida por las rutas de `SIM` (`src/world/layout.js`), muestreadas, ampliada por el tamaño de una batería. Fijo, calculado al construir.

`agua-lejana`: ninguna luz local.

Para limitar el número de programas (§6.4), el constructor puede **rellenar** conjuntos con luces que no alcanzan el fragmento hasta igualar unas pocas clases de tamaño (número de focos y de puntuales). Añadir una luz que no alcanza es exacto en cualquier posición de la lista; solo cuesta GPU (con la guarda de §6.3, el cálculo de su alcance en cada píxel). Implementado (enmienda, §10): solo se rellenan las ocho islas, que comparten casi todos sus materiales. Cada clase es una pareja (puntuales, focos), y se unen las dos clases cuya unión añade menos luces hasta que quedan cinco: (0, 4), (0, 5), (2, 3), (0, 1) y (3, 1). El relleno añade una sola luz a dos islas. `agua` y `dinamico` usan pocos materiales y conservan su conjunto exacto: rellenarlos costaría GPU para ahorrar uno o dos programas.

### 6.3 Luces por fragmento en un solo pase: clones de material con luces propias

Cada material iluminado usado en un fragmento se sustituye por un **clon por fragmento** (`material.clone()`, mismos parámetros, misma referencia a texturas) al que se inyectan sus luces locales. Los `M.*` originales no se tocan. Los materiales que ya traen `onBeforeCompile` y `customProgramCacheKey` (el acantilado `uplit` de `src/world/edges.js`, que sustituye `common`, `map_fragment`, `roughnessmap_fragment` y `emissivemap_fragment`) encadenan: el clon llama primero al `onBeforeCompile` original y después aplica la inyección; la clave de programa concatena la original con la de la inyección.

Inyección (`onBeforeCompile` del clon):

1. Uniformes nuevos: `uChunkPoint`, array de `K_point` objetos con los mismos campos que el struct `PointLight` de three (`position`, `color`, `distance`, `decay`), y `uChunkSpot`, array de `K_spot` objetos con los campos del struct `SpotLight` (`position`, `direction`, `color`, `distance`, `decay`, `coneCos`, `penumbraCos`). Se declaran en el fragment shader justo después de `#include <lights_pars_begin>` con los **mismos tipos de struct** que define three (`uniform SpotLight uChunkSpot[K_spot];`), para poder llamar a `getSpotLightInfo` y `getPointLightInfo` tal cual. Con `K = 0` no se declara el array (GLSL no admite tamaño 0).
2. `#include <lights_fragment_begin>` se sustituye por el texto de `THREE.ShaderChunk.lights_fragment_begin` con tres cambios en cada uno de esos dos bucles y nada más: en el de puntuales, `for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ )` pasa a `i < K_point` (literal), `pointLight = pointLights[ i ];` a `pointLight = uChunkPoint[ i ];` y la llamada `RE_Direct( directLight, … );` a `if ( directLight.visible ) { RE_Direct( directLight, … ); }`; en el de focos, `i < K_spot`, `spotLight = uChunkSpot[ i ];` y la misma guarda. Los bucles de sol, direccionales, rectangulares y hemisféricas quedan como en three. Con `K = 0` el bloque correspondiente se elimina entero. Las guardas `#if ( NUM_SPOT_LIGHTS > 0 )`, los `#pragma unroll_loop` y los bloques de sombras y mapas de foco (que quedan fuera con `NUM_SPOT_LIGHT_SHADOWS = 0`) se dejan como están; three aplica `replaceLightNums` y `unrollLoops` después de `onBeforeCompile`, así que los literales y los pragmas funcionan igual que en el chunk original. La sustitución comprueba que cada cadena buscada aparece exactamente una vez (la llamada a `RE_Direct`, una vez en cada uno de los dos bloques) y falla ruidosamente si three cambiara el chunk. La guarda (enmienda, §10) no cambia el resultado: `getPointLightInfo` y `getSpotLightInfo` ponen `light.visible = ( light.color != vec3( 0.0 ) )`, o `false` con color `vec3( 0.0 )` fuera del cono, y todo lo que suma `RE_Direct_Physical` va multiplicado por `dotNL * directLight.color` o `dotNLcc * directLight.color`. Con color 0 la llamada solo suma ceros exactos (§6.2), así que saltársela deja la misma suma. Lo que cambia es el trabajo: la GPU deja de evaluar el BRDF de cada luz del conjunto en los píxeles a los que no llega. Las pruebas comprueban esa base contra el texto de three 0.186.1, y que con `K` igual al total de luces el sombreador final es el de three salvo las declaraciones, el array del que se lee cada luz y las guardas.
3. Los arrays globales `pointLights` y `spotLights` quedan declarados pero sin uso: el compilador los elimina, three no los encuentra activos y no los sube.
4. `customProgramCacheKey` del clon = clave original + `|chunk|K_point|K_spot`. three compila un programa por combinación de parámetros del material y de `(K_point, K_spot)`; los fragmentos con el mismo tamaño de conjunto comparten programa.

Valores de los uniformes: por fotograma y por fragmento se calculan una sola vez (en `onBeforeRender` del primer objeto del fragmento que se dibuja, con una marca de fotograma) copiando literalmente las operaciones de `WebGLLights.setup` y `setupView` de three (archivo `node_modules/three/build/three.module.js`, función `WebGLLights`): posición en espacio de vista con `setFromMatrixPosition(light.matrixWorld).applyMatrix4(camera.matrixWorldInverse)`; dirección del foco como posición menos `target` transformada con `transformDirection`; `color.copy(light.color).multiplyScalar(light.intensity)`; `distance`, `decay`, `coneCos = Math.cos(angle)`, `penumbraCos = Math.cos(angle * (1 - penumbra))`. Mismas llamadas, mismos dobles, mismos float32 al subir. Los objetos de valor son compartidos por todos los clones de un fragmento; three sube uniformes al enlazar cada material, como hoy con los arrays globales, pero con arrays más cortos (menos llamadas `uniform*` que ahora).

Dinámicos: los clones del fragmento `dinamico` llevan la unión de luces de §6.2; las baterías de `K.compact` reciben esos clones. Los dinámicos de estación reciben los clones de su fragmento.

Sombra: sin cambios. La luz `key` sigue el camino normal, la sombra se renderiza una vez al arrancar y la cámara no cambia de capas.

Con `?debug&nobake` se mantiene el camino actual (sin fragmentos ni clones), para identificar piezas y usar los colliders como hoy. Con `?debug` (fusionado) se exponen además `__ecobat.debug.chunks()` (lista de fragmentos con caja, luces, mallas, clones) y `__ecobat.debug.checkLights()`, que comprueba para cada objeto iluminado que toda luz que alcanza su geometría en su pose actual (con el margen de las cajas de §6.2) está en el conjunto de su fragmento, y devuelve las violaciones. Como los conjuntos salen de las piezas, la caja de una malla fusionada puede cortar la esfera de una luz que no llega a ninguna de sus piezas. Por eso las luces que cortan la caja de la malla se comprueban después contra cada triángulo (mallas fusionadas, que son fijas), cada instancia (instanciadas) o la malla entera (las que mueve una estación) (enmienda, §10). Un objeto iluminado que llegue a la fusión sin fragmento asignado (olvido) va a un fragmento `resto` con todas las luces locales (exacto) y se avisa en consola con `?debug`.

### 6.4 Programas y compilación

three compila un programa por combinación de parámetros del material y tamaño del conjunto `(K_point, K_spot)`; la guarda de §6.3 es la misma en todos los clones y no añade ninguno. El relleno de §6.2 mantiene el total acotado; objetivo orientativo: no más de 120 programas (hoy 50). Con las cinco clases de las islas salen 104; sin relleno serían 129 (enmienda, §10).

Antes del primer fotograma, y bajo el velo, se compila en paralelo (`KHR_parallel_shader_compile`) como hoy: `renderer.setRenderTarget(composer.readBuffer)` y `await renderer.compileAsync(scene, camera)`. Como todos los clones están en la escena, una sola llamada los cubre. Los materiales del bloom se compilan a la vez, con una segunda llamada a `compileAsync` sobre una escena auxiliar con sus materiales y la geometría del cuadro de pantalla completa de three (mismas claves de programa: el bloom dibuja siempre en sus propios destinos); los de salida y profundidad de sombras, en el primer fotograma del calentamiento (§6.5), también bajo el velo. Mientras la GPU compila, el hilo principal sube las texturas de los materiales con `renderer.initTexture` (el mismo camino de subida que al dibujar), que antes subía de golpe el primer fotograma (enmienda, §11). La generación del PMREM sigue siendo síncrona (sin acceso a sus programas internos); se acepta. No se puede pasar detrás de `buildWorld` para solaparla con él: el taller lee `scene.environment` al construirse (`src/world/stations/workshop.js`).

### 6.5 Calentamiento bajo el velo

Tras compilar, y antes de poner `is-ready`, se renderizan a través del compositor, a tamaño mínimo (orientación: 64×36 px, sin cambiar `pixelRatio`), unos 14 encuadres: los ocho anclajes (`tl.anchors`, portada en p = 0), las marcas `tl.marks.sim` y `tl.marks.conn`, y los tramos de vuelo 0,2525, 0,512, 0,668 y 0,915. En cada uno se coloca la cámara con `sample` y se fijan simulación y conexiones al valor del encuadre (las dos son funciones puras de su valor). No se llama a `world.update` (enmienda, §11): las estaciones guardan estado entre fotogramas (pantallas vivas que solo se redibujan al cambiar su lectura, contadores, la baliza y la cinta del reciclaje, el desplazamiento de las trazas, el guion del taller) y lo que dejara el calentamiento se vería en la primera visita; con movimiento reducido, ese estado no se vuelve a escribir nunca. Después se dejan simulación y conexiones a 0 y la apertura de la cámara en su valor inicial, se pide regenerar el mapa de sombras y se restaura el tamaño (`layout()`). El primer encuadre genera el mapa de sombras con el mundo tal como sale de `buildWorld` (así compila y estrena sus materiales bajo el velo), y el primer fotograma real lo vuelve a generar después de su `world.update`, como sin calentamiento. El calentamiento se hace también con movimiento reducido: no deja nada visible. Las texturas de las pantallas vivas se suben durante la compilación (§6.4); sus redibujos siguen ocurriendo al visitarlas, como antes de este diseño.

Esto obliga al driver a hacer en la carga todo lo que hoy hace la primera vez que un programa, un estado o una textura entran en cuadro (los picos de 570-605 ms de §4). No toca el DOM de los capítulos. La barra del velo debe seguir avanzando durante compilación y calentamiento (hoy se anima sola; basta con que el hilo principal no se bloquee más de unos 100 ms seguidos, que es lo que dan `compileAsync` y los fotogramas pequeños). Si el calentamiento se come el presupuesto de carga, se recortan primero los tramos de vuelo y nunca los anclajes, y se mide de nuevo el objetivo de tirones (§2): la navegación manda.

El calentamiento quita los costes de primer uso, pero no los fotogramas largos que quedaban en la integrada tras la tarea 7: eran atascos de la cola de la GPU, que se repiten en cada pasada por el mismo tramo, no primeros usos (con 115 encuadres de calentamiento, uno cada 0,01 de p, seguía habiendo 6 fotogramas de más de 120 ms). Los resuelve el ritmo de §6.7 (enmienda, §11).

### 6.6 Lo que no cambia

Pantallas vivas, texturas procedurales, cámara y coreografía, movimiento reducido (`needsRender` sigue decidiendo cuándo se llama a `composer.render`; con el ritmo de §6.7, un render pendiente se hace en el siguiente rAF en que la GPU tenga sitio), versión estática, anexos, navegación por teclas, rutas relativas del build, orden de dibujo de opacos y transparentes (un solo pase).

### 6.7 Ritmo de la GPU

Como mucho dos fotogramas en vuelo (enmienda, §11). Tras cada `composer.render` de `frame()` se inserta una valla (`gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)`). En el rAF siguiente, antes de dibujar, se liberan en orden las vallas ya señaladas (`gl.getSyncParameter(valla, gl.SYNC_STATUS)`, que no espera) y, si siguen dos pendientes, ese rAF no dibuja. Todo lo demás del fotograma (scroll, cámara, simulación, conexiones, `world.update`, DOM) se hace igual en cada rAF y con el mismo `dt`, así que el estado no depende de cuándo termina la GPU, y el siguiente fotograma que se dibuja muestra el estado de su instante. Una respuesta distinta de `UNSIGNALED` (también `null` con el contexto perdido) libera la espera.

Por qué: cuando la GPU va justa, Chrome entrega a veces de dos a cinco rAF seguidos, a 3-12 ms, y cada uno encarga un fotograma completo de 30-50 ms de GPU; la cola junta 100-200 ms de trabajo y la presentación se detiene mientras la vacía (`Present` de DXGI bloqueado 85-137 ms en las trazas). Con dos fotogramas en vuelo la GPU sigue igual de ocupada (93-94 % frente a 96 %) y la cola no pasa de dos.

Exactitud: no cambia qué se dibuja ni cómo; solo deja de dibujar fotogramas que la cola habría tapado. En una GPU rápida las vallas están señaladas en el rAF siguiente y no se salta ningún render (mismas llamadas de dibujo que antes en `harness.mjs info`). Las capturas de §7.1 lo comprueban; por eso el estado avanza en cada rAF: si el rAF entero se saltara, el `dt` dependería de la GPU y las pantallas vivas de las capturas con tiempo virtual dejarían de ser repetibles (medido: la de móvil del laboratorio).

## 7. Verificación

### 7.1 Igualdad de píxeles

Dos builds: `antes` (commit `69b0a0a` de `main`, el anterior a este diseño) y `después`. Para cada uno, con el arnés existente (`.verify/harness.mjs shots`, que congela el reloj de animación con `freeze(12.5)`), capturas a 1440×810, 1280×720 y 390×844 en p = 0,0001; 0,1555; 0,302; 0,4134; 0,5592; 0,7142; 0,8464; 1 (anclajes) y 0,09; 0,2525; 0,512; 0,668; 0,80; 0,915 (transiciones).

Comparación con un script propio (pngjs, como `crop.mjs`). Criterio de "idéntico":

- Ningún píxel difiere en más de 1/255 en ningún canal, salvo píxeles **aislados** (sin ningún vecino de 8 que también difiera), que pueden llegar a 8/255 y suman como mucho el 0,001 % de la imagen (unos 12 píxeles a 1440×810). Esta excepción cubre saltos de una muestra PCF o de un umbral de bloom por redondeo de último bit; cualquier diferencia con estructura (dos píxeles contiguos, una línea, una mancha) es un fallo.
- El script también escribe una imagen de diferencias amplificada por cada captura, para revisar a ojo lo que haya.

Por qué hay tolerancia: el compilador de sombreadores reordena y contrae operaciones al cambiar el código, y partir el agua cambia los atributos interpolados en el último bit. Son diferencias de 1/255 invisibles. No cubren errores lógicos: si una luz que alcanza queda fuera de un fragmento, la diferencia es grande y con estructura, y el script la detecta. Cualquier parte que no cumpla el criterio vuelve a su forma exacta (decisión 5).

El mundo es determinista entre cargas (los generadores usan semillas; `groundTexture`, que usa `Math.random`, no se llama desde ningún sitio), así que la comparación es válida sin cambios previos.

### 7.2 Rendimiento

Las sondas usadas en la medición (`gpuprobe.mjs`, `scenestats.mjs`, `breakdown.mjs`, `sweep.mjs`, `gpuinfo.mjs`, `perfprobe.mjs`, hoy en `C:\Users\yamil\.claude\jobs\7b9bc624\tmp\`) se copian a `.verify/perf/` y se documenta su uso en `.verify/brief.md`. Se ejecutan contra `vite preview` del build `antes` y `después`, en la RTX 5090 y en la integrada (`CHROME_EXTRA="--use-adapter-luid=0,113510"`). Criterios: los de §2 (−45 % de GPU por anclaje en la integrada, ningún fotograma > 120 ms tras el velo, JS ≤ 4 ms, carga ≤ +3 s orientativo y ≤ +4 s duro en la referencia, ≤ +0,5 s en la 5090). Con el ritmo de §6.7 un rAF puede no dibujar, así que `perfprobe.mjs` mide los dos intervalos: entre rAF (`frames`) y entre fotogramas dibujados (`renders`, cuando cambia `renderer.info.render.frame`); la puerta de tirones exige que ninguno de los dos pase de 120 ms (enmienda, §11). Los números finales se recogen en el README (sección de rendimiento) con la fecha.

### 7.3 Regresiones funcionales

`node harness.mjs info|clearance|motion`, `node navprobe.mjs`, `node consoleprobe.mjs` (cero errores y avisos en consola), `reducedprobe.mjs`, la versión estática y las capturas de móvil deben dar lo mismo que hoy. `?debug&nobake` sigue listando colliders y piezas. `__ecobat.debug.checkLights()` devuelve cero violaciones en los 14 encuadres de 7.1.

El cambio de tamaño después del calentamiento lo comprueba `.verify/perf/resizeprobe.mjs` con la maquinaria de captura repetible de 7.1: en p = 0,302 captura a 1440×810, pasa a 1280×720, vuelve a 1440×810, y compara la vuelta con la ida y la de 1280×720 con la captura de una carga directa a ese tamaño. En esta última se excluye la caja de la píldora de atajos (`.keys`), que tras cambiar de tamaño sale 1 px más alta por redondeo del DOM también en el build `antes`; la secuencia entera, sin excluir nada, es idéntica a la del build `antes` con el mismo cambio de tamaño (enmienda, §11).

La primera visita la comprueba `.verify/perf/firstvisit.mjs`, porque las capturas de 7.1 neutralizan a propósito el historial de arranque (pasada previa y mapa de sombras regenerado): con movimiento reducido, una carga nueva por capítulo, salto directo con `goTo` y captura, sin pasadas previas. Con movimiento reducido el resultado no depende del reloj, así que los ocho capítulos deben salir idénticos a los del build `antes` (criterio de 7.1) a 1440×810, 1280×720 y 390×844, también con `?debug` (enmienda, §11).

## 8. Riesgos y mitigaciones

- Dependencia del texto de los chunks de three: la sustitución de §6.3 comprueba que cada cadena aparece exactamente una vez y lanza un error si no; three fijado en 0.186.1 (§3). La guarda de §6.3 depende además de que `getPointLightInfo` y `getSpotLightInfo` marquen `visible` y de que `RE_Direct_Physical` multiplique cada suma por la irradiancia; una prueba lo comprueba contra el texto de three.
- Uniformes calculados a mano: copiar las operaciones de `WebGLLights` literalmente y verificar con 7.1; el paso 2 del orden de trabajo (§9) valida el mecanismo antes de quitar ninguna luz.
- Programas de más y carga más larga: relleno de conjuntos (§6.2), compilación en paralelo, medida de carga en la integrada. Si la carga superase el presupuesto, reducir clases de tamaño antes que renunciar a fragmentos.
- Agua partida: redondeos de último bit en atributos interpolados (posición de vista, coordenada de sombra, niebla). Cubierto por la tolerancia de 7.1; si no la cumple, agua entera en un fragmento propio (§6.1).
- Objetos que se mueven entre fragmentos: solo las baterías de la simulación, con conjunto propio. `checkLights()` lo vigila en los 14 encuadres.
- Instancias animadas: los conjuntos usan la caja de cada instancia al construir (§6.2). Hoy solo la cinta del reciclaje mueve instancias, sin salir de su isla, y `checkLights()` no da violaciones en todo su ciclo. Una animación nueva que aleje instancias de las piezas de su isla debe ampliar su caja, como los dinámicos de estación, o ir a un fragmento con caja barrida, como `dinamico`.
- Coste de CPU de subir uniformes: los arrays por fragmento son más cortos que los globales de hoy; medir JS por fotograma en este PC y escalar ×2 para un 5500G; límite 4 ms.
- Encadenado con `uplit`: el clon debe llamar al `onBeforeCompile` original antes de inyectar; la clave de programa debe incluir ambas partes. Verificado que `uplit` no toca `lights_fragment_begin` ni `lights_pars_begin`.
- Picos del driver no cubiertos por el calentamiento (por ejemplo, el primer uso a tamaño real del destino MSAA): ocurren en el primer fotograma real, aún bajo el velo, porque `is-ready` se pone después de ese fotograma.
- Estado de las estaciones durante la carga: el calentamiento no llama a `world.update` (§6.5). Cualquier paso nuevo de la carga que cambie el estado de una estación debe pasar la comprobación de primera visita de §7.3.
- Ritmo de la GPU (§6.7): si el navegador tardara en dar por señalada una valla, se dibujarían menos fotogramas, nunca fotogramas distintos. En la 5090 se dibujan 9 010 de 9 031 rAF del recorrido de `perfprobe.mjs` (sin ventana, a unos 200 rAF por segundo) y las llamadas de dibujo por fotograma no cambian.

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

## 10. Enmienda del 2026-10-22: guarda por píxel, conjuntos por pieza y relleno por parejas

Con el texto anterior (commit `723b652`), la tarea 7 no alcanzaba el objetivo de GPU de §2 en la integrada de referencia. La implementación se apartó de él en cuatro puntos, todos exactos por la regla de §6.2, y esta enmienda los recoge en §6.1-§6.4 y §8. **Aprobada** por decisión del ejecutor autónomo, con la autorización general de la usuaria: la guarda es un tercer cambio sobre el texto de three (§6.3 decía «dos cambios y nada más»), exacto por construcción (una luz con `visible = false` aporta color cero) y comprobado con la puerta de píxeles; sin ella el objetivo de GPU no se cumple. El código implementa la enmienda.

| Punto | Texto anterior | Enmienda |
|---|---|---|
| Sombreador (§6.3) | Dos cambios en cada bucle propio: límite literal y array propio | Además, la guarda `if ( directLight.visible ) { RE_Direct( … ); }` en los bucles de puntuales y focos |
| Conjuntos (§6.2) | Luces que cortan la caja del fragmento | Luces que cortan la caja de alguna pieza; `checkLights()` comprueba triángulos, instancias y mallas |
| Relleno (§6.2, §6.4) | Como mucho tres clases de tamaño en todo el mundo | Cinco clases de pareja (puntuales, focos), solo en las islas; 104 programas |
| Agua entera (§6.1) | Con todas las luces locales | Con las que alcanzan el disco: 2 puntuales y 8 focos de las 16 luces |

En el código, `lightSetForBoxes` y `padLightClasses` (`src/world/chunks.js`, con pruebas) sustituyen en `buildWorld` a `lightSetFor` sobre la caja del fragmento y a `padLightSets(…, 3)`, que pedía el plan; las dos siguen exportadas y probadas.

Medidas en la integrada de referencia, en ms de GPU por fotograma (mediana, 1920×1080, variante `base`). Las filas intermedias se midieron en la tarea 7 con una sonda rápida que sigue el método de `scenestats.mjs`; la última es la de `scenestats.mjs`.

| Variante | Portada | c1 | c2 | c3 | c4 | c5 | c6 | Cierre | Programas |
|---|---|---|---|---|---|---|---|---|---|
| Línea base (`antes`) | 55,4 | 77,3 | 72,6 | 78,7 | 63,6 | 52,1 | 58,6 | 57,7 | 50 |
| Objetivo de §2 (55 %) | 30,5 | 42,5 | 39,9 | 43,3 | 35,0 | 28,7 | 32,2 | 31,7 | ≤ 120 |
| Texto anterior: caja del fragmento y tres clases | 42,7 | 55,7 | 59,4 | 64,7 | 50,3 | 43,8 | 40,8 | 44,6 | 66 |
| Caja del fragmento, sin relleno ni guarda | 36,3 | 47,0 | 56,8 | 48,5 | 39,6 | 30,7 | 30,9 | 37,8 | 124 |
| Texto anterior con la guarda | 29,5 | 39,8 | 41,2 | 44,8 | 33,3 | 27,0 | 30,1 | 31,3 | 66 |
| Enmienda: guarda, piezas y cinco clases | 27,9 | 36,9 | 38,2 | 39,4 | 30,5 | 24,3 | 27,8 | 28,9 | 104 |

- La guarda es lo que da el salto. Sin ella, el taller (c2) queda entre el 76 % y el 82 % de la línea base en todas las variantes medidas. Con ella, el relleno del texto anterior aún deja c2 y c3 por encima del objetivo. Con la enmienda completa, los ocho capítulos quedan entre el 46,6 % y el 52,6 % (el revisor de la tarea midió entre el 46,6 % y el 51,7 %). c2 es el más justo: 38,2 ms frente a 39,9.
- Exactitud verificada: las 42 capturas de §7.1 pasan en la RTX 5090 (34 idénticas bit a bit, 8 con 1 a 5 píxeles sueltos a 1/255) y las 14 de 1440×810 en la integrada. `checkLights()` no da violaciones en los 14 encuadres ni en barridos de la simulación y del reloj de animación. Las pruebas unitarias comprueban la guarda contra el texto de three 0.186.1.
- Coste: 104 programas frente a 50. La carga sube de 2 636 a 2 993 ms en la 5090 (del margen de +0,5 s de §2 quedan unos 140 ms para el calentamiento de §6.5) y de 2 994 a 3 182 ms en la integrada. El JS por fotograma en la 5090 es de 3,2 ms (límite 4).
- Cómo deshacer cada parte (todas siguen siendo exactas; solo cambia la GPU):
  - Guarda: en `src/world/chunkLights.js`, quitar `GUARDED_CALL` y la línea `chunk = replaceInBlock(…)` de `lightsFragmentBegin`; en `tests/chunkLights.test.mjs`, las aserciones de la guarda. La GPU vuelve a quedar por encima del objetivo.
  - Piezas: en `buildWorld` (`src/world/world.js`), calcular cada conjunto con `lightSetFor` sobre la caja que une las piezas. En las medidas sin relleno, c2 pasaba de 38,1 a 39,7 ms.
  - Relleno: `LIGHT_CLASSES` en `src/world/world.js`. Menos clases dan menos programas y más GPU.
  - Agua: dar todas las luces locales al fragmento `agua`.

## 11. Enmienda del 2026-10-22 (tarea 8): ritmo de la GPU, calentamiento sin estado y compilación del bloom

Con el calentamiento de §6.5 tal como estaba escrito, dos objetivos del diseño no se cumplían. La puerta dura de §2 (ningún fotograma de más de 120 ms tras el velo en la integrada de referencia) seguía en rojo, y el remedio previsto (añadir encuadres de calentamiento) no la movía. Y la llamada a `world.update` en cada encuadre dejaba estado en las estaciones que se veía en la primera visita a los capítulos: con movimiento reducido, que nunca lo vuelve a escribir, 7 de 8 capítulos salían distintos de los del build `antes`. La implementación añade el ritmo de la GPU (§6.7), calienta sin tocar el estado de las estaciones (§6.5) y compila el bloom en paralelo (§6.4). La enmienda la hizo el ejecutor autónomo con la delegación general de la usuaria; todo conserva los píxeles idénticos (42 capturas de §7.1 y primera visita de §7.3). El límite de carga en la RTX 5090 sigue siendo +0,5 s (§2).

| Punto | Texto anterior | Enmienda |
|---|---|---|
| Tirones (§6.5, §6.7) | El calentamiento adelanta los primeros usos; si quedan tirones, más encuadres | Además, como mucho dos fotogramas en vuelo en la GPU (§6.7) |
| Calentamiento (§6.5) | `world.update` con el estado narrativo de cada encuadre, para que cada pantalla viva se dibuje una vez | Sin `world.update`: cámara, simulación y conexiones; después, apertura de la cámara restaurada y mapa de sombras regenerado en el primer fotograma real; también con movimiento reducido |
| Compilación (§6.4) | Bloom, salida y sombras en el primer fotograma del calentamiento | Bloom con `compileAsync`, en paralelo con el mundo; texturas subidas durante la compilación |
| Medida de tirones (§7.2) | Intervalos entre rAF | Entre rAF y entre fotogramas dibujados |
| Primera visita (§7.3) | Sin comprobación propia (las capturas de §7.1 neutralizan a propósito el historial de arranque) | `firstvisit.mjs`: con movimiento reducido, carga nueva por capítulo y salto directo, contra `antes` |

Respecto de la tarea 8 del plan, que conserva su texto original, el entregable se aparta en estos puntos y en ninguno más:

| Tarea 8 del plan | Entregado | Por qué |
|---|---|---|
| Interfaces, `renderAt(p)`: calcula `cs = chapterState(tl, p)` y llama a `world.update(0, 1 / 60, story)` | Sin `chapterState`, `story` ni `world.update`: cámara (`sample`, `lookAt`, `fov`), simulación, conexiones y `composer.render(1 / 60)` (§6.5) | Con `world.update`, 7 de los 8 capítulos de la primera visita con movimiento reducido salen distintos de `antes` (medidas abajo) |
| Interfaces, `warmUp()`: al final, simulación y conexiones a 0 y `layout()` | Además, antes de `layout()`, devuelve `camera.fov` a su valor inicial y pide regenerar el mapa de sombras (§6.5) | Consecuencia de la fila anterior: el primer fotograma real parte del mismo estado que sin calentamiento |
| Archivos: `start3D`, entre `compileAsync` y el primer `requestAnimationFrame`, y `layout()` | Además, en `frame()`, el ritmo de la GPU (§6.7) | Puerta dura de tirones: con el calentamiento solo quedaban 7 rAF de más de 120 ms, y con 115 encuadres, 6 |
| Archivos: ídem | Además, en la compilación, el bloom con `compileAsync` en paralelo y la subida de texturas (§6.4) | Ninguna puerta lo exige por sí solo. Es la «compilación completa» del título de la tarea y la compilación en paralelo de la decisión 4, y acerca dos objetivos de la propia tarea: la carga en la 5090, cuyo margen es pequeño, y el velo, que no debe quedarse parado (medidas abajo) |
| Paso 2, `resizeprobe.mjs`: esperas de 900 ms y las dos comparaciones tal cual | Captura repetible de §7.1, p recolocada tras cada cambio de tamaño, tamaño del lienzo comprobado y la píldora `.keys` excluida al comparar con la carga directa; imprime también la comparación sin excluir nada (§7.3) | Con 900 ms en tiempo real las pantallas vivas no convergen; el scroll conserva los píxeles y no la proporción; la píldora sale 1 px más alta también en `antes` |
| Paso 3, tirones: ningún elemento de `frames` con `dt > 120` | Lo mismo y, además, ningún intervalo de más de 120 ms entre fotogramas dibujados (`perfprobe.mjs` ampliado, §7.2) | Con el ritmo, un rAF puede no dibujar. Es más estricto |
| Sin comprobación de primera visita | `firstvisit.mjs` (§7.3) | Las capturas de §7.1 neutralizan a propósito el historial de arranque |
| Paso 4: un commit, `git add src/main.js` | El commit del plan (`a30a052`, «Calentamiento de encuadres bajo el velo») y otros, de código (ritmo, calentamiento sin estado) y de especificación | Cada parte se puede revertir por separado; las restricciones globales piden un commit por tarea como mínimo |

`WARMUP_POINTS` (14 valores), el tamaño de 64×36, el rAF entre encuadres, `layout()` al final, la marca `eb:warm` y el orden respecto de `compileAsync` y de `is-ready` son los del plan. Las puertas del paso 3 se miden como dice el plan.

Medidas en la integrada de referencia (`perfprobe.mjs`, 1920×1080, fase posterior al velo):

| Variante | rAF > 120 ms | Máximo rAF | Dibujados > 120 ms | Máximo dibujado | `readyMs` |
|---|---|---|---|---|---|
| Línea base (`antes`) | 136 | 248 ms | — | — | 2 994 |
| Tarea 7 | 8 | 156 ms | — | — | 3 182 |
| Tarea 7 + calentamiento de 14 encuadres | 7 | 148 ms | 5 | 144 ms | 3 377-3 538 |
| Ídem con 115 encuadres (uno cada 0,01 de p; experimento) | 6 | 164 ms | — | — | 4 324 |
| Calentamiento con `world.update` + ritmo (cinco pasadas; tres con el contador de dibujados) | 0 | 66-75 ms | 0 | 102-105 ms | 3 242-3 306 |
| Entregado: calentamiento sin estado + ritmo (cuatro pasadas; dos, el 2026-10-22 por la tarde) | 0 | 71-92 ms | 0 | 85-101 ms | 3 312-3 503 |

- Causa de los tirones que quedaban, según trazas de Chrome con categorías de GPU: Chrome entrega a veces de dos a cinco rAF seguidos (a 3-12 ms) y cada uno encarga un fotograma de 30-50 ms de GPU; el hilo principal de la GPU se queda bloqueado en `DXGISwapChainImageBacking::Present` (85-137 ms) o en la ejecución de los comandos WebGL (96 ms) mientras vacía la cola. Se repiten en cada pasada por el mismo tramo (rueda rápida, lenta y teclas), así que no son primeros usos.
- Fotogramas en vuelo (tramo de rueda lenta desde p = 0,22, consultas de tiempo de GPU): sin límite, 30,8 fotogramas dibujados por segundo con la GPU ocupada el 96 %, pero 135 dibujados a menos de 8 ms del anterior (no llegan a verse) y un máximo de 165 ms; con dos (entregado), 29,8 por segundo, 93 % y un máximo de 73 ms. Con uno y con tres (medidos en la variante que saltaba el rAF entero, abajo): con uno no hay ráfagas, pero la GPU espera entre fotogramas (25,9 por segundo y 81 %); con tres vuelven las ráfagas (50) y 17 intervalos de 67-100 ms.
- Saltarse el rAF entero cuando la GPU va llena daba un resultado parecido en la integrada (30,6 por segundo, máx. 49 ms), pero hacía que el `dt` dependiera de la GPU: con tiempo virtual, la captura de móvil del laboratorio (390×844, dsf 3, p = 0,4134) dejó de ser repetible (máx. 50 y 78/255 en dos pasadas, en una pantalla viva). Por eso el estado avanza en cada rAF y solo se salta el render.
- En la 5090 no cambia nada visible: se dibujan 9 010 de 9 031 rAF de `perfprobe.mjs` (sin ventana, unos 200 por segundo), y `harness.mjs info` da las mismas 594 llamadas de dibujo que la tarea 7.
- Efecto secundario: con el ritmo, en una máquina limitada por la GPU el rAF sigue al ritmo de la pantalla, así que la degradación automática de `main.js` (que salta tras 2,5 s de rAF de más de 1/38 s) casi nunca se activa. Va en la dirección de la decisión 2, que la tarea 9 cumple quitándola.
- Con la usuaria jugando en la 5090 de la misma máquina (procesador y memoria compartidos con la integrada), las dos versiones del calentamiento dan 2 rAF de más de 120 ms por pasada, en sitios distintos cada vez (máx. 216-233 ms), y la carga sube entre 250 y 650 ms; esas pasadas no cuentan como medida.

Calentamiento sin estado (§6.5). Medidas en la RTX 5090, 1440×810 salvo que se diga otra cosa:

- Primera visita con movimiento reducido (`firstvisit.mjs`, una carga nueva por capítulo): con `world.update` en el calentamiento, solo el capítulo 2 sale igual que en `antes`. En la portada, máx. 144/255 y 219 píxeles de más de 8/255: las trazas, con la textura desplazada, y la baliza del reciclaje, que se queda en 0,61 de intensidad en vez de 1,1. En el capítulo 3, máx. 215 y 4 779 píxeles: las pantallas del laboratorio, dibujadas por el calentamiento («11,8 V»), frente a «0,0 V» en `antes`. Además, c4 máx. 182 (1 220 píxeles), c7 máx. 17 (150) y c1, c5 y c6 máx. 5-7 con píxeles agrupados. Sin `world.update`, los 8 capítulos salen idénticos (máx. 1/255), también a 1280×720, a 390×844 y con `?debug`, y con el tiempo virtual de `--vt`. Dos cargas de `antes` dan máx. 0.
- Primera visita sin movimiento reducido y sin pasada previa (`harness.mjs shots --vt --snap --settle 4000`, sin `--warm` ni `--rebake`, 14 encuadres): dos cargas de `antes` ya difieren entre sí en 5 encuadres (a0, a4, a5, a7 y t4: la cinta del reciclaje y lo que se coloca con el reloj del primer fotograma). Con `world.update` en el calentamiento difieren además a1 (máx. 112) y a3 (máx. 59), por pantallas dibujadas durante el calentamiento. Sin `world.update` difieren los mismos 5 que entre dos cargas de `antes`.
- Tirones y carga: sin cambio medible frente al calentamiento con `world.update` (tabla de arriba y carga, abajo). En cargas alternas en la 5090, mediana de 3 221 ms con `world.update` y de 3 194 ms sin él.
- Descartado: saltarse el calentamiento con movimiento reducido (`if (!reduced) await warmUp()`). También da 8 de 8 en la primera visita con movimiento reducido, pero deja el estado en el modo normal (a1 y a3, arriba) y también en quien active el movimiento reducido con la página ya cargada, y deja a esos visitantes sin calentamiento.
- Descartado: recortar los cuatro tramos de vuelo del calentamiento (el retroceso de §6.5 si la carga no cabe). Casi todo el calentamiento es su primer encuadre (un bloqueo de unos 360 ms en la 5090: el mapa de sombras, los materiales de sombra y de salida y la primera subida de la geometría, que antes pagaba el primer fotograma); con 10 encuadres en vez de 14, la fase baja de 393 a 383 ms (mediana de cinco cargas alternas).

Carga (mediana de tres cargas en frío, cada una con un Chrome nuevo; marcas `eb:*`; máquina en reposo):

| | `antes` | Tarea 7 | Calentamiento con `world.update` |
|---|---|---|---|
| RTX 5090 | 2 653 ms | 2 993 ms | 3 026 ms |
| Integrada de referencia | 2 838 ms | 3 135 ms | 3 207 ms |

- Puerta de §2 en la 5090 (+0,5 s). Con la sonda del plan (`perfprobe.mjs` frente a los 2 636 ms de `gpu-antes-5090.json`, medidos el 2026-10-21 con la máquina en reposo), el calentamiento con `world.update` dio 3 001, 3 042 y 3 182 ms (+365, +406 y +546), y en la revisión de la tarea, 3 037 ms (+401) y cinco pares de cargas alternas de +276 a +437 ms (mediana +372). El calentamiento sin estado no cambia la carga: en cargas alternas de la misma sesión, mediana de 3 221 ms con `world.update` y de 3 194 ms sin él. Con la máquina ocupada (la usuaria jugando o retransmitiendo con codificación de vídeo en la 5090) todo tarda más, también `antes` (de 2 745 a 3 009 ms), y `perfprobe.mjs` da de 3 272 a 3 539 ms; frente a `antes` en la misma sesión, la mediana de 11 pares de cargas alternas es +407 ms (de +320 a +620; 2 pares por encima de +500), y `perfprobe.mjs` alterno da +418 y +508. Casi todo el coste es de la tarea 7 (104 programas frente a 50; §10) y del primer encuadre del calentamiento, un bloqueo de unos 360 ms (mapa de sombras, materiales de sombra y de salida, primera subida de la geometría) que en `antes` pagaba el primer fotograma en unos 250 ms. En la integrada, de 3 366 a 3 503 ms frente a 2 994 (de +372 a +509; límites +3 s orientativo y +4 s duro).
- Repetido el 2026-10-22 por la tarde con la sonda del plan y la máquina en reposo (sin juegos ni codificación de vídeo), alternando con `antes`. De 13:54 a 13:58, el entregado dio 3 148, 3 163 y 3 192 ms, con `antes` a 2 785, 2 741 y 2 789 ms. De 14:15 a 14:18, 3 059, 3 075 y 3 041 ms, con `antes` a 2 725, 2 711 y 2 719 ms. Frente al número guardado (2 636 + 500 = 3 136 ms) cumplen las tres últimas y no las tres primeras, que lo pasan de 12 a 56 ms. Frente a `antes` alternado, de +322 a +422 ms (mediana +364). Con `gpuprobe.mjs` contra `vite preview`, como se midió la línea base, `antes` dio 2 790, 2 833 y 2 817 ms y el entregado 3 231, 3 201 y 3 203 ms (+441, +368 y +386). La comprobación del plan queda en el límite: depende de lo rápida que esté la máquina, también para `antes`. Desglose en cargas en frío alternas (medianas de tres): construcción del mundo, 1 491 ms en `antes` y 1 555 en el entregado; compilación, 532 y 679; y el primer fotograma de `antes` (246 ms) frente al calentamiento (396 ms, unos 325 del primer encuadre) más el primer fotograma (11 ms).
- La compilación del bloom en paralelo y la subida de texturas durante la compilación acortan el calentamiento de 423 a 364 ms en la 5090 y de 381 a 258 ms en la integrada (medianas); su bloqueo más largo del hilo principal baja de unos 300 a unos 180 ms en la integrada. La carga total gana de 10 a 40 ms. Repetido el 2026-10-22 con el calentamiento entregado, en cargas en frío alternas frente a la misma versión sin esta compilación: en la 5090, calentamiento de 362 frente a 398 ms y carga 30 ms menor (mediana de cinco pares); en la integrada, calentamiento de 253 frente a 384 ms, su bloqueo más largo de 177-197 frente a 314-319 ms y carga 28 ms menor (tres pares).
- Observación, sin cambio: en la integrada, mientras dura `compileAsync` la página no recibe fotogramas durante 600-700 ms (en la 5090 no pasa), así que la barra del velo se detiene ese rato. Ya pasaba antes de esta tarea (600 ms en el build de la tarea 7).

Cambio de tamaño (punto de revisión 1): `resizeprobe.mjs` da la vuelta a 1440×810 idéntica a la ida (máx. 0) y la captura a 1280×720 idéntica a la de una carga directa (máx. 0) fuera de la píldora `.keys`, que sale 1 px más alta tras el cambio de tamaño; con el build `antes` pasa exactamente lo mismo (444 píxeles, máx. 107/255), y la secuencia entera, sin excluir nada, coincide con la del build `antes` (máx. 1/255).

Cómo deshacer cada parte:

- Ritmo de la GPU: en `src/main.js`, quitar `MAX_IN_FLIGHT`, `inFlight` y `gpuBusy()`, la condición `&& !gpuBusy()` del render de `frame()` y las dos líneas de la valla. Los píxeles no cambian; la puerta de tirones vuelve a fallar (7 rAF de más de 120 ms, máx. 148).
- Calentamiento sin estado: en `renderAt` (`src/main.js`), volver a llamar a `world.update(0, 1 / 60, { index, vis, local, p, sim, route, conn, reduced: false })` con `chapterState(tl, p)`, y quitar de `warmUp()` la restauración de la apertura y la regeneración del mapa de sombras. Entonces hay que saltarse el calentamiento con movimiento reducido (`if (!reduced) await warmUp();`), y la primera visita sin movimiento reducido vuelve a diferir de `antes` en a1 y a3 (arriba).
- Compilación del bloom y subida de texturas: en el `try` de la compilación de `src/main.js`, dejar solo `await renderer.compileAsync(scene, camera)`. Los píxeles no cambian; la carga sube unos 30 ms y el bloqueo más largo del calentamiento en la integrada pasa de unos 190 a unos 315 ms.
- Medida de dibujados en `perfprobe.mjs`: son campos nuevos (`renders`, `rhist`, `nRenders`); los de siempre no cambian.
- Primera visita: `firstvisit.mjs` es una sonda nueva; no cambia nada del build.
