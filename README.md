# EcoBat · Una batería. Más de una vida.

Presentación web cinematográfica del proyecto académico **EcoBat** (sostenibilidad informática): identificación de baterías de coche con QR, registro de diagnósticos, clasificación validada por técnicos y trazabilidad hasta un destino documentado.

La presentación es un **mundo 3D en tiempo real** (Three.js) que la cámara sobrevuela al hacer scroll (GSAP ScrollTrigger): sube, cruza el diorama y entra en cada estación. Es la adaptación del concepto *scroll-world* sin vídeo generado ni servicios de pago.

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

## Controles para presentar

| Acción | Teclas / control |
|--------|------------------|
| Siguiente / anterior capítulo | `→` `↓` `Espacio` `AvPág` · `←` `↑` `RePág` (sirve un mando de presentaciones) |
| Ir a un capítulo | `1`–`6` o la barra inferior |
| Portada / cierre | `Inicio` / `Fin` |
| Pantalla completa | `F` o botón |
| Anexos | `A` o botón; `Esc` cierra |
| Explorar libre | rueda del ratón o trackpad |

La cámara se detiene cuando se deja de avanzar. Con `prefers-reduced-motion` no hay vuelos: se pasa de un encuadre a otro con un corte. Sin WebGL, o con `?estatica=1`, se muestra una versión estática legible.

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
index.html            Documento y contenedores
src/main.js           Render, posprocesado, scroll, navegación y bucle
src/camera.js         Encuadres por capítulo y trayectorias de sobrevuelo
src/world/world.js    Las seis estaciones, puentes, traza luminosa y animaciones
src/world/kit.js      Piezas reutilizables: batería, edificio en sección, coche, árboles...
src/world/textures.js Texturas dibujadas en canvas (ficha, pantallas, señales)
src/content.js        Textos de los capítulos y de los anexos
src/ui.js             Capas HTML, controles, anexos y vista estática
public/               Favicon e ilustración de referencia (vista estática)
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
- La ilustración `public/referencia-ecobat.png` es conceptual: se generó con la herramienta de imágenes de Codex como dirección artística. El mundo 3D está modelado con geometría procedural, sin modelos externos.

## Comprobaciones realizadas (21/10/2026)

Hechas con Playwright (Chromium) sobre `npm run dev` y sobre el build de producción (`npm run preview`). Las capturas están en [`docs/evidencia/`](docs/evidencia/).

| Comprobación | Resultado |
|--------------|-----------|
| Build de producción | `vite build` sin errores. JS 803 kB (228 kB gzip), CSS 16 kB y la fuente Archivo autoalojada |
| Consola en el build | 0 errores y 0 avisos |
| Carga | Mundo listo unos 2,5 s después de navegar, en local |
| Rendimiento | ~240 fps en el equipo de desarrollo (RTX 5090). Si baja de ~38 fps, se reduce la resolución y se quita el desenfoque de maqueta automáticamente |
| Encuadres | Portada, capítulos 1–6 y cierre capturados a 1440×810 |
| Vuelos | Tomas a mitad de vuelo entre capítulos (`vuelo-1-2.png`) |
| Navegación | Tres `→` seguidos llegan al capítulo 3; `RePág` vuelve al 2; clic en la barra salta al 6; `Inicio` vuelve a la portada |
| Movimiento reducido | Con `reduce` emulado, cada flecha cambia de capítulo con un corte, sin desenfoque ni desplazamiento, y los contadores muestran 2 / 1 / 7 |
| Anexos | Se abren con `A`; pestañas con teclado; `Esc` cierra y devuelve el foco |
| Móvil (390×844) | Sin scroll horizontal; capítulo 4 legible; la versión estática se lee bien |
| QR del cierre | Apunta a `https://laos23.github.io/ecobat-presentacion/` |
| Revisión de diseño independiente | Dos rondas. Se corrigieron el contraste de los titulares sobre los interiores, la visibilidad de las tres rutas del capítulo 4, el horizonte del agua, la señal «Desliza o pulsa →», el encuadre móvil de la portada, las pestañas de los anexos y los encuadres del capítulo 6 y del cierre |
| Web publicada | Carga sin errores ni avisos en consola en `https://laos23.github.io/ecobat-presentacion/` |

Las capturas finales se tomaron con la ventana del navegador de pruebas limitada a ~1,5 fps (también le ocurría al build anterior, que antes iba a 240 fps). Cada captura esperó a que la cámara llegara a su encuadre.

**Limitaciones conocidas**

- Hay que probarlo antes en el portátil de clase: con gráficos integrados débiles se activa la calidad reducida, pero no se ha medido en ese equipo.
- El mundo 3D es una interpretación simplificada de la referencia, no una réplica de cada detalle.
- La primera carga necesita conexión; después todo es estático, y conviene abrirlo una vez antes de la exposición.
