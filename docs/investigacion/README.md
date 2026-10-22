# Investigación de EcoBat

Esta carpeta guarda la investigación que respalda los datos de la presentación: 298 hechos verificados con sus fuentes, el informe consolidado y la correspondencia con las 121 fuentes que cita la web. Se investigó y se verificó de forma independiente el 21 y el 22 de octubre de 2026.

Es la base de la política de datos del proyecto (véase [Datos y fuentes](../../README.md#datos-y-fuentes) en el README): todo número, fecha, nombre propio o afirmación factual de la web debe tener detrás un hecho de esta carpeta, por su `id`, y sus fuentes. Lo que no tiene respaldo se muestra como ejemplo o hipótesis, con un rótulo visible.

## Qué contiene cada archivo

| Archivo | Contenido |
|---------|-----------|
| `hechos-verificados.json` | Lista de 298 hechos de 15 temas. Cada hecho tiene su afirmación, su valor, su ámbito, los números de sus fuentes, su confianza y el veredicto del verificador |
| `fuentes.json` | Las 469 fuentes numeradas de la investigación (`n`): título, editor, URL, fecha de publicación, fecha de consulta (todas, 2026-10-21), tipo, idioma, temas y hechos que sostienen |
| `informe.md` | Informe consolidado: resumen, cobertura de cada elemento de la web (A a I), 23 contradicciones entre temas, los hechos por tema, descartados, huecos y lista numerada de fuentes |
| `mapa-fuentes.json` | Las 121 fuentes que cita la web: su número en la web (`n`), su número en `fuentes.json` (`fuente`), título, editor, tipo original, grupo y URL, y los hechos que respaldan lo que la web cita con ella (`hechos`). `urlOriginal` aparece en 7 entradas, cuando la web enlaza otra dirección del mismo documento |

El texto de `informe.md` llama `verified-facts.json` y `sources.json` a los archivos que aquí se llaman `hechos-verificados.json` y `fuentes.json`. Son los mismos: se renombraron al incorporarlos al repositorio y su contenido es idéntico.

Los archivos de trabajo de cada tema (los del investigador y los del verificador) no están en el repositorio: el informe y los tres JSON recogen su resultado consolidado.

### Temas

Cada hecho lleva en `topic` el tema que lo recopiló. La última columna cuenta los hechos del tema que aparecen en `mapa-fuentes.json`, es decir, los que respaldan algo que la web cita.

| Tema (`topic`) | Contenido | Hechos | En la web |
|----------------|-----------|-------:|----------:|
| `composicion` | Composición y masa de una batería de plomo-ácido de coche | 20 | 11 |
| `tasas` | Tasas de recogida y de reciclaje de baterías de plomo (UE, España y EE. UU.) | 20 | 10 |
| `reglamento` | Reglamento (UE) 2023/1542: obligaciones y fechas | 20 | 11 |
| `normativa_es` | Normativa española sobre baterías y residuos peligrosos | 20 | 11 |
| `seguridad` | Seguridad, peligros y transporte de las baterías de plomo | 20 | 4 |
| `diagnostico` | Pruebas de diagnóstico y valores de referencia de taller | 19 | 10 |
| `segunda_vida` | Segunda vida y reutilización | 20 | 1 |
| `pasaporte_qr` | Pasaporte digital, código QR y protección de datos | 20 | 5 |
| `ods` | Objetivos de Desarrollo Sostenible 9, 12 y 13 | 20 | 10 |
| `clima_energia` | Energía, CO2 y riesgos del reciclaje informal del plomo | 20 | 7 |
| `tecnologias` | Tecnologías del prototipo y alojamiento | 20 | 20 |
| `presupuesto` | Presupuesto de materiales: etiquetas QR y material de presentación | 19 | 9 |
| `proceso_reciclaje` | Proceso industrial de reciclaje y fracciones obtenidas | 20 | 8 |
| `taller_resultados` | Averías por batería y resultados de pruebas en taller | 20 | 1 |
| `vehiculo_electrico` | Baterías de vehículos eléctricos: composición y alta tensión | 20 | 10 |
| | **Total** | **298** | **128** |

### Campos de un hecho

- `id`: tema y número, por ejemplo `diagnostico-f1`.
- `claim`: la afirmación. `value`: el valor resumido. `scope`: dónde, cuándo y a qué se refiere.
- `sources`: números de `fuentes.json`. `evidence`: el pasaje de la fuente, o su localización, donde consta el dato.
- `usableIn`: dónde puede usarse según los investigadores: `capitulo`, `pantalla3d`, `anexo-datos`, `anexo-indicadores`, `anexo-seguridad`, `anexo-ods`, `anexo-normativa`, `anexo-arquitectura`, `anexo-presupuesto` u `otro`.
- `confidence`: `alta` (255 hechos), `media` (41) o `baja` (2), según lo sólido del respaldo.
- `verdict`: `confirmado` (266) o `confirmado-con-correccion` (32). En estos últimos se usa el texto corregido de `claim` y `value`, y el original queda en `originalClaim` y `originalValue`.
- `caveat`: el matiz del verificador (270 hechos), con las referencias ya traducidas a números de `fuentes.json`. Hay que leerlo antes de citar el hecho.
- `conflicts`: las contradicciones (C1 a C23, sección 3 del informe) que afectan al hecho (93 hechos). `consolidation`: el cambio aplicado al resolver una contradicción (6 hechos).

### Campos de una fuente

`n` (el número que usan `sources` de los hechos y las referencias del informe), `title`, `publisher`, `url` (la dirección final), `published`, `accessed`, `kind` (tipo de documento), `language`, `topics`, `factIds` y, en 22 fuentes, `alternateUrls`: variantes del mismo documento (otro idioma, formato o espejo) fusionadas en una sola entrada.

### Dos numeraciones de fuentes

Los números de `fuentes.json`, de `informe.md` y del campo `sources` de cada hecho son los de la investigación (1 a 469). La web numera sus 121 fuentes por orden de primera aparición en la página (1 a 121, en `src/sources.js`) y son otros números: `mapa-fuentes.json` traduce unos a otros. Por ejemplo, la cita [63] de la web es la fuente 14 de la investigación.

## Cómo se verificó

1. **Investigación por temas.** Quince temas. Cada uno recopiló hechos con su valor, su ámbito, sus fuentes y los huecos que no pudo cubrir.
2. **Verificación independiente de cada hecho.** Un verificador leyó las fuentes directamente, comprobó que cargaban y emitió un veredicto por hecho: «confirmado» (266) o «confirmado con corrección» (32). Ningún hecho se descartó: no hubo veredictos de «no confirmado» ni de «fuente inaccesible». Los verificadores añadieron fuentes propias cuando hizo falta.
3. **Consolidación.** Se partió de 562 entradas de fuentes (451 de los investigadores y 111 de los verificadores). Se excluyeron 5 marcadas como «no citar» o «solo contexto», se eliminaron los duplicados por URL final y se fusionaron las variantes de un mismo documento: quedaron 469 fuentes numeradas. Las 23 contradicciones entre temas se resolvieron con el criterio de fuente primaria y más reciente (16 resueltas) o se marcaron con la indicación de cómo citarlas (7).
4. **Uso en la web.** Los textos se redactaron a partir de los hechos, respetando `caveat`, `conflicts` y los apartados «Límites» y «Cómo redactarlo» de la sección 2 del informe. `tests/content.test.mjs` comprueba la coherencia de las citas y las fuentes. Las URL de las 121 fuentes se comprobaron el 22-10-2026.

Fechas: las 469 fuentes constan como consultadas el 2026-10-21; algunos verificadores consultaron fuentes el 2026-10-22. Los datos están, por tanto, a esas fechas.

## Límites conocidos

Resumen de los huecos del informe. La sección 6 da el detalle por tema, y los apartados «Límites» de la sección 2, el de cada elemento de la web.

**Lo que no existe**

- No hay datos publicados del reparto de las baterías de coche sustituidas entre seguir en servicio, segunda vida y reciclaje (Eurostat tampoco lo publica), ni de una trazabilidad del 90 %. Por eso el reparto 2 / 1 / 7 de diez baterías y el ejemplo del 90 % son hipótesis del proyecto. La cifra real más cercana al 90 % es el índice oficial de recogida de España, 90,85 % en 2024, que mide recogida entre ventas y no trazabilidad. Los artículos 75 y 76 del Reglamento (UE) 2023/1542 harán medible el reparto.
- No hay resultados agregados reales de talleres con tamaño de muestra. La única distribución hallada (45 / 40 / 15 %, de un distribuidor británico) no tiene muestra ni fecha y es de confianza baja; la web no la usa. Tampoco hay datos publicados de lotes de baterías de un taller: los lotes y las lecturas de las pantallas 3D son ejemplos.
- No hay tabla oficial de la Comisión Europea ni del JRC con la composición de una batería de plomo de coche, ni una masa media oficial. La composición típica (plomo ≈60 %, electrolito ≈30 %, plástico ≈7 %) sale de estudios del sector, y otras fuentes dan plomo entre el 58 y el 67 % (C8). El peso procede de fichas de fabricantes (de 9,3 a 21,8 kg) y de una batería europea de referencia de 18 kg.
- No hay tasa oficial de recogida de baterías de plomo de la UE: las cifras de 97,3 % y 99 % son estudios encargados por la industria. Eurostat llega solo a 2023, y para España no hay datos posteriores a 2024 ni desglose por comunidad.
- Energía y CO2 del plomo secundario frente al primario: solo hay informes de 2018 encargados por la industria; no se halló un análisis independiente con DOI.

**Cifras que no concilian**

El informe indica cómo citar cada una; no se mezclan ni se comparan entre sí.

- Recogida en España: el índice oficial (90,85 % en 2024) y el porcentaje autodeclarado por el Acuerdo Voluntario del sector (98,7 %) tienen definiciones distintas (C2, C3). El 71,9 % de eficiencia de reciclado de 2023 no prueba un incumplimiento del 75 % (C12).
- Averías atribuidas a la batería (ADAC, RACE, Autoclub Mutua y otros): cambian la entidad, la estación y la base (C15). Plantas españolas de reciclado de plomo: 5, 6 más la de Pina de Ebro, o 7 (C7). Datos del pasaporte: 19, 71 o 93 (C21). Concentración del electrolito: sin fuente primaria coherente (C9).

**Fuentes leídas de forma indirecta**

- Normas de pago (EN 50342-1, IEC 60095-1, ISO/IEC 18004, EN 18219 y EN 18220, ISO 6469-3): no se leyó su texto, y lo que se cita de ellas viene de descripciones de laboratorios, fabricantes y otras fuentes. Los manuales del BCI no son accesibles y su tabla de tensión y carga se cita a través de una web técnica.
- EUR-Lex, ECHA, UNECE y otros sitios bloquean el acceso automatizado. Los textos legales de la UE se leyeron en la reproducción del Diario Oficial de publications.europa.eu, no en las versiones con efecto jurídico; el ADR 2025, en una copia de un tercero; y algunas páginas oficiales, en copias de Internet Archive.
- El presupuesto de búsquedas web se agotó en todos los temas. La verificación se hizo sobre todo con lectura directa de las fuentes, y las afirmaciones de ausencia («no hay acto adoptado») no son concluyentes.

**Estado a 21-10-2026, que cambiará**

- Sin adoptar: el acto sobre el formato del etiquetado (art. 13.10, borrador del 15-12-2025) y el del acceso a los datos restringidos del pasaporte (art. 77.9, borrador del 19-10-2026). Los actos delegados de huella de carbono, contenido reciclado y rendimiento solo están en borrador.
- El real decreto español de pilas y baterías es un proyecto. El que incorpora el límite de plomo de la Directiva (UE) 2024/869 se aprobó el 20-10-2026 y no consta publicado en el BOE.
- Los precios de tiendas y alojamientos son volátiles y la mayoría de las páginas no tienen fecha. El IVA de los alojamientos no se verificó para un cliente español, y no hay ensayos de la resistencia de las etiquetas al electrolito, al calor o a la vibración.

**Lo que es del equipo y no de la investigación**

- El calendario del proyecto, la arquitectura, las partidas del presupuesto y los indicadores del piloto son decisiones del equipo. La investigación solo respalda las fechas normativas, las versiones, las licencias y los precios.
- Los ODS: el vínculo del proyecto con cada meta es interpretación del equipo. El Reglamento (UE) 2023/1542 no cita los ODS 9, 12 ni 13, y el marco de los ODS no tiene series de baterías.

**Afirmaciones que no deben usarse**

Aunque su hecho se conserve, 37 afirmaciones concretas figuran como no verificadas, erróneas o frágiles en la sección 5.3 del informe. Por ejemplo, «hasta la mitad de las baterías usadas acaba en la economía informal» solo puede citarse como afirmación de sus autores, y la cifra del 71,9 % no puede presentarse como incumplimiento. La sección 5.2 lista las 5 fuentes excluidas de la numeración.

## Cómo usar estos datos

- Buscar primero el hecho por su `id` y citar su ámbito, su año y su fuente. Si no hay hecho, no se escribe como dato: se rotula como ejemplo o hipótesis.
- Leer el `caveat` y las etiquetas de `conflicts`. Cuando dos cifras salen de definiciones distintas, se citan con su entidad y su alcance y no se suman ni se comparan.
- Usar el texto corregido en los hechos «confirmado con corrección».
- Antes de escribir sobre un elemento de la web, leer su «Límites» y su «Cómo redactarlo» en la sección 2 del informe, y la sección 5.3.
- Fechas corregidas: los nuevos códigos de residuos del capítulo 16 06 se aplican desde el 9-12-2026, y no desde el 9-11-2026 (C1).
- Sin absolutos como «100 %» o «siempre». «Sin datos personales» es un principio de diseño y no una garantía legal, y las baterías de arranque de plomo llevan QR pero no pasaporte.

## Cómo consultar y comprobar

Desde la raíz del repositorio, para ver un hecho y las fuentes de la web que lo respaldan:

```bash
node -e "const h=require('./docs/investigacion/hechos-verificados.json'); console.log(h.find(x=>x.id==='diagnostico-f1'))"
node -e "const m=require('./docs/investigacion/mapa-fuentes.json'); console.log(m.filter(x=>x.hechos.includes('diagnostico-f1')).map(x=>x.n+' '+x.titulo))"
```

Para comprobar que las citas de la web existen, que todas las fuentes se citan y que los ejemplos siguen rotulados:

```bash
node --test tests/content.test.mjs
```

Esa prueba no comprueba el contenido de la investigación: solo la coherencia entre `src/content.js` y `src/sources.js`.

## Actualizar

Si cambia o se añade una cifra en la web: buscar su hecho (si no existe, hay que investigarlo y verificarlo antes de escribirlo como dato), añadir su fuente a `src/sources.js` por orden de aparición y a `mapa-fuentes.json`, y ejecutar la prueba. Si cambia el estado de un acto de la UE, un precio o una versión, hay que volver a leer la fuente y anotar la fecha de consulta.
