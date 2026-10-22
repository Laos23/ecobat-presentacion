// Contenido de la presentación. Textos del proyecto: documento académico del equipo
// (context/Proyecto de sostenibilidad informática_ EcoBat.docx).
// Cada [n] remite a src/sources.js; la relación de cada número con la fuente original y con los hechos
// verificados está en docs/investigacion/mapa-fuentes.json. Los recuentos 2/1/7, el ejemplo del 90 % y los
// registros de las pantallas 3D son ejemplos del prototipo, no datos reales, y se rotulan como tales.

export const SITE_URL = 'https://laos23.github.io/ecobat-presentacion/';

export const intro = {
  title: 'EcoBat',
  tagline: 'Una batería. Más de una vida.',
  lede: 'Gestión, reutilización y reciclaje de baterías de coche, con trazabilidad digital.',
  note: 'Proyecto académico de sostenibilidad informática',
};

// Los datos reales de los capítulos llevan su fuente en el anexo (pestaña Datos).
export const chapters = [
  {
    id: 'recogida',
    label: 'Recogida',
    title: '¿Aquí termina todo?',
    body: 'Una batería usada contiene plomo (cerca del 60 % de su peso), ácido y materiales valiosos. Necesita una gestión adecuada, no un vertedero.',
  },
  {
    id: 'taller',
    label: 'Identificación',
    title: 'Ahora tiene historia.',
    body: 'Un código QR vincula cada batería a su ficha; por diseño, sin datos personales. La UE exigirá un QR en cada batería nueva desde el 18-2-2027.',
  },
  {
    id: 'diagnostico',
    label: 'Diagnóstico',
    title: 'Medir antes de decidir.',
    body: 'Un técnico hace las pruebas adecuadas a cada química y registra los resultados. Cargada y en reposo, una batería de 12 V marca de 12,6 a 12,8 V.',
  },
  {
    id: 'clasificacion',
    label: 'Clasificación',
    title: 'Cada batería, su camino.',
    body: 'El software sugiere una ruta. El personal técnico la valida.',
    routes: [
      { key: 'service', name: 'Sigue en servicio', detail: 'Cumple los criterios para su uso previsto', count: 2 },
      { key: 'second', name: 'Evaluación de segunda vida', detail: 'Solo si supera pruebas específicas', count: 1 },
      { key: 'recycle', name: 'Reciclaje autorizado', detail: 'Fin de vida útil, a un gestor autorizado', count: 7 },
    ],
    simulation: 'Ejemplo ilustrativo con 10 baterías: no son datos reales',
  },
  {
    id: 'reciclaje',
    label: 'Reciclaje',
    title: 'Los materiales siguen.',
    body: 'Un gestor autorizado recupera los materiales: reciclar plomo ahorra del 55 al 65 % de la energía. EcoBat registra la entrega y su destino.',
  },
  {
    id: 'trazabilidad',
    label: 'Trazabilidad',
    title: 'Todo queda conectado.',
    body: 'Se guarda cada paso. En la UE, desde el 18-2-2027, toda batería nueva de vehículo eléctrico tendrá pasaporte digital.',
    passport: ['Registro y QR', 'Diagnóstico', 'Ruta validada', 'Destino documentado'],
  },
];

export const closing = {
  title: 'Conocer su estado. Documentar su destino.',
  body: 'Antes de desechar una batería, hay que conocer su estado. Cuando ya no pueda aprovecharse de forma segura, hay que asegurar que llegue al circuito de reciclaje adecuado.',
};

// Anexos. Cada pestaña es una lista de bloques que se pintan en este orden:
// { p }, { note } (párrafo atenuado), { h4 }, { list }, { table: { head, rows, stack? } }, { timeline }, { example }, { goals },
// { sources: true } (lista numerada de src/sources.js).
export const annex = [
  {
    id: 'arquitectura',
    label: 'Arquitectura',
    title: 'Arquitectura propuesta del prototipo',
    blocks: [
      { p: 'Primera versión: aplicación web con base de datos y panel de control, sin hardware complejo. Las tecnologías las propone el equipo de forma orientativa; versiones y licencias consultadas el 21-10-2026.' },
      {
        table: {
          head: ['Componente', 'Tecnología', 'Función', 'Versión y licencia'],
          rows: [
            ['Interfaz web', 'HTML, CSS y JavaScript', 'Formularios, fichas y estadísticas', 'HTML: «HTML Living Standard» del WHATWG, con licencia CC BY 4.0 [1, 2]. JavaScript: ECMA-262, 17.ª edición, de junio de 2026 [3]'],
            ['Aplicación', 'Python con Flask', 'Lógica del sistema', 'Python 3.15.1, licencia PSF v2 [4, 5]. Flask 3.1.3, licencia BSD-3-Clause [6, 7]'],
            ['Base de datos', 'SQLite', 'Baterías, pruebas y movimientos', '3.54.1, del 16-10-2026; de dominio público [8, 9]'],
            ['Identificación', 'Códigos QR', 'Acceso a la ficha de cada batería', 'Bibliotecas de Python Segno 1.6.6, licencia BSD-3-Clause [10, 11], o qrcode 8.2, licencia BSD [12, 13]'],
            ['Visualización', 'Chart.js', 'Gráficos de sostenibilidad', '4.5.1, licencia MIT [14, 15]'],
            ['Alojamiento', 'Ordenador local o servidor web', 'Acceso a la aplicación', 'Opciones y precios en la pestaña Presupuesto'],
          ],
        },
      },
      { h4: 'Criterios de diseño con base en fuentes' },
      {
        list: [
          'El QR apunta a una dirección estable que redirige a la ficha, y el identificador no lleva datos dentro, como recomienda la guía técnica del consorcio Battery Pass [16]',
          'La ficha guarda datos de la batería y no de su propietario. Es un principio de diseño apoyado en la minimización de datos del RGPD (art. 5.1.c) [17], no una garantía legal: por analogía con lo que el Tribunal de Justicia de la UE resolvió sobre el número de bastidor, un identificador puede ser dato personal para quien pueda asociarlo a una persona [18]',
          'SQLite admite lectores simultáneos sin límite, pero un solo escritor a la vez; su documentación estima que basta para sitios de menos de 100.000 accesos al día [19]',
        ],
      },
      { h4: 'Tablas principales' },
      {
        list: [
          'Baterías: id, código QR, tipo, fabricante, fecha de fabricación si se conoce, recepción, estado actual',
          'Diagnósticos: id, batería, fecha, tensión, capacidad estimada según el tipo, resultado, técnico',
          'Movimientos: id, batería, fecha, origen, destino, tipo de movimiento, justificante',
          'Entidades: talleres, puntos de recogida y gestores, con autorización cuando corresponda',
        ],
      },
      { h4: 'Pantallas de la primera versión' },
      { list: ['Inicio', 'Registrar batería', 'Consultar batería por QR', 'Registrar diagnóstico', 'Gestionar destino', 'Panel ambiental'] },
      { h4: 'Alternativas que cita el equipo' },
      {
        list: [
          'Java: JDK 25 es la última versión con soporte a largo plazo y JDK 27 la más reciente; OpenJDK se distribuye con licencia GPLv2 y Classpath Exception [20, 21]',
          'PHP 8.5.12, con licencia Modified BSD (PHP License v4) [22, 23]',
          'MySQL Community Server: licencia GPLv2 con permisos adicionales [24]',
        ],
      },
    ],
  },
  {
    id: 'calendario',
    label: 'Calendario',
    title: 'Plan de desarrollo: ocho semanas',
    blocks: [
      { p: 'Plan propuesto por el equipo para el prototipo académico; no procede de fuentes externas.' },
      {
        timeline: [
          ['Semana 1', 'Análisis y planificación', 'Investigar el problema, definir requisitos y delimitar el tipo de baterías.'],
          ['Semana 2', 'Diseño de la base de datos', 'Modelo de datos, tablas y relaciones.'],
          ['Semanas 3–4', 'Desarrollo de la interfaz', 'Formularios de registro, consulta y diagnóstico.'],
          ['Semana 5', 'Implementación de la lógica', 'Reglas de clasificación y registro de movimientos.'],
          ['Semana 6', 'Códigos QR y estadísticas', 'Identificadores y panel de control.'],
          ['Semana 7', 'Pruebas y evaluación', 'Formularios, permisos, integridad de datos e indicadores.'],
          ['Semana 8', 'Memoria y presentación', 'Resultados, limitaciones y mejoras futuras.'],
        ],
      },
      { note: 'Equipo de dos o tres personas: base de datos y servidor, interfaz web, y pruebas con documentación y análisis ambiental.' },
      { h4: 'Fechas normativas verificadas: Reglamento (UE) 2023/1542' },
      {
        timeline: [
          ['17-8-2023', 'Entrada en vigor', 'Publicado en el Diario Oficial de la UE el 28-7-2023 [25].'],
          ['18-2-2024', 'Aplicación general', 'El Reglamento se aplica con carácter general [25].'],
          ['18-8-2024', 'Estado de salud en el BMS', 'Las baterías de vehículos eléctricos, de transporte ligero y estacionarias guardan datos de estado de salud y vida útil prevista [26].'],
          ['18-8-2025', 'Símbolo y responsabilidad del productor', 'Símbolo de recogida separada en todas las baterías y responsabilidad ampliada del productor [26]; queda derogada la Directiva 2006/66/CE [25].'],
          ['31-12-2025', 'Eficiencia de reciclado del 75 %', 'Objetivo para las baterías de plomo, que deben cumplir los recicladores [25].'],
          ['18-2-2027', 'Código QR y pasaporte', 'QR en todas las baterías; pasaporte digital para las de vehículos eléctricos, de transporte ligero e industriales de más de 2 kWh [26].'],
          ['18-8-2027', 'Diligencia debida', 'Obligaciones aplazadas dos años por el Reglamento (UE) 2025/1561 [27].'],
          ['31-12-2027', 'Recuperación del 90 % del plomo', 'Objetivo de valorización del plomo de las baterías recicladas [25].'],
          ['31-12-2030', 'Eficiencia de reciclado del 80 %', 'Segundo objetivo para las baterías de plomo [25].'],
          ['18-8-2031', 'Contenido reciclado mínimo', '85 % de plomo valorizado en baterías de arranque, de vehículos eléctricos e industriales de más de 2 kWh; además, 16 % de cobalto, 6 % de litio y 6 % de níquel [26].'],
          ['31-12-2031', 'Recuperación del 95 % del plomo', 'Segundo objetivo de valorización del plomo [25].'],
          ['18-8-2036', 'Contenido reciclado ampliado', 'Se mantiene el 85 % de plomo y sube al 26 % de cobalto, 12 % de litio y 15 % de níquel [26].'],
        ],
      },
      { note: 'La etiqueta con información general se exige desde el 18-8-2026 o 18 meses después del acto de ejecución del artículo 13.10, si esa fecha es posterior [26]; a 21-10-2026 ese acto solo existe como borrador [28].' },
    ],
  },
  {
    id: 'presupuesto',
    label: 'Presupuesto',
    title: 'Presupuesto del prototipo con precios verificados',
    blocks: [
      { p: 'Precios de España, en euros y con IVA incluido salvo que se indique otra cosa, consultados el 21-10-2026. Las partidas son del equipo; los importes, de las fuentes citadas.' },
      {
        table: {
          head: ['Partida', 'Precio verificado y fuente', 'Coste'],
          rows: [
            ['Software', 'Python, Flask, SQLite, Chart.js y generador de QR, con licencias libres o de dominio público (pestaña Arquitectura)', '0 €'],
            ['Ordenador', 'Equipo ya disponible', '0 €'],
            ['Etiquetas QR', '8 hojas A4 de poliéster para impresora láser con 192 etiquetas: 20,32 € más 7,99 € de envío [29, 30]', '28,31 €'],
            ['Alojamiento web durante las ocho semanas (opcional)', 'Cuenta gratuita, o plan Developer del servidor europeo de PythonAnywhere a 10 € al mes durante dos meses, sin IVA indicado [31]', '0–20,00 €'],
            ['Material de presentación', 'Póster A2 (6,75 €) y dossier A4 en color de 30 caras (30 × 0,12 €) con encuadernación en espiral (1,75 €) [32, 33]', '12,10 €'],
            ['Total del prototipo', 'Suma de las partidas anteriores; el alojamiento, sin IVA verificado', '40,41–60,41 €'],
          ],
        },
      },
      { h4: 'Opciones que no entran en el total' },
      {
        list: [
          'Impresora de etiquetas térmica: QL-700 a 69,99 € en una tienda [34] o QL-800 a 130,30 €, precio de lista del fabricante [35], más un rollo de 1000 etiquetas de 23 × 23 mm por 22,66 € [36]: de 92,65 € a 152,96 €. El fabricante advierte de que esas etiquetas no están pensadas para un etiquetado duradero ni para estar en exterior más de un mes [37]',
          'Otras etiquetas: 20 hojas A4 de vinilo adhesivo para impresora de inyección por 7,20 €, sin envío verificado [38]',
          'Otros alojamientos, con precios en dólares: Render Starter, 7 $ al mes (≈6,23 €) [39]; Railway Hobby, mínimo de 5 $ al mes (≈4,45 €) [40, 41]; Fly.io, 2,19 $ por 30 días (≈1,95 €) [42, 43]. Conversión con el tipo de referencia del BCE del 21-10-2026: 1 € = 1,1234 $ [44]',
          'La cuenta gratuita de PythonAnywhere incluye una aplicación web que caduca al mes y 512 MiB de disco [45]; en el plan gratuito de Render, una base SQLite se pierde en cada redespliegue [46]',
        ],
      },
      { h4: 'Lo que no se pudo verificar' },
      {
        list: [
          'El IVA de los alojamientos para un cliente español: sus páginas no indican impuestos, salvo Fly.io, que da los precios sin impuestos [31, 43]',
          'La resistencia de las etiquetas al electrolito, al calor del motor o a la vibración: no hay ensayos; el fabricante solo declara de −20 °C a +80 °C y resistencia al agua, al aceite, a los rayos UV, a la abrasión y a agentes químicos [29]',
          'La duración de los precios: las ofertas de tienda cambian sin aviso, y alguna vencía el 23-10-2026 [34]',
        ],
      },
      { note: 'No se incluyen equipos profesionales de diagnóstico, baterías, transporte de residuos, seguros ni instalaciones de tratamiento.' },
    ],
  },
  {
    id: 'indicadores',
    label: 'Indicadores',
    title: 'Cómo se mediría el resultado',
    blocks: [
      { p: 'Indicadores propuestos por el equipo para un piloto.' },
      {
        table: {
          head: ['Indicador', 'Cálculo'],
          rows: [
            ['Baterías registradas', 'Total de fichas creadas'],
            ['Trazabilidad documentada', 'Con destino final documentado ÷ dadas de baja × 100'],
            ['Tiempo de gestión', 'Media entre recepción y destino registrado'],
            ['Baterías reutilizadas', 'Reutilización validada'],
            ['Baterías recicladas', 'Entregadas a recicladores autorizados'],
            ['Incidencias de registro', 'Errores o fichas incompletas'],
          ],
        },
      },
      {
        example: {
          label: 'Ejemplo ilustrativo',
          text: 'Un piloto con 100 baterías registradas y 90 con destino documentado daría una trazabilidad del 90 %. Es un ejemplo, no un dato real, y no demostraría por sí solo una reducción del 90 % del impacto ambiental.',
        },
      },
      { note: 'Actividad no es impacto: registrar cien baterías no significa haber evitado cien residuos, y una batería reciclada no se cuenta también como reutilizada.' },
      { h4: 'Referencias reales para comparar' },
      {
        table: {
          head: ['Referencia', 'Valor', 'Definición y ámbito'],
          rows: [
            ['Índice de recogida de baterías de arranque (España, oficial)', '90,85 % en 2024', 'Toneladas recogidas en el año entre la media de las puestas en el mercado ese año y los dos anteriores; en 2024 se recogieron 127.396,01 t y se pusieron en el mercado 152.735,94 t [47]. Objetivo legal: 98 % desde el 31-12-2018 [48]'],
            ['Eficiencia de reciclado de baterías de plomo (España)', '71,9 % en 2023', 'Masa reciclada entre la masa que entra en las plantas: 199.181 t de 277.016 t, de cualquier origen [49]. El objetivo del 75 % desde el 31-12-2025 obliga a los recicladores y se calcula con otro método, así que esta cifra no prueba un incumplimiento [50]'],
            ['Recogida y reciclado de baterías de plomo de automoción (UE)', '97,3 % en 2015-2017', 'Toneladas recogidas entre las disponibles para recogida en 14 países de la UE de entonces, con el 92 % del parque; estimación con un modelo en un estudio encargado por la industria [51]'],
            ['Reciclado del plomo de las baterías (EE. UU.)', '97,7 % en 2020-2024', 'Plomo reciclado entre plomo disponible en todas las baterías de plomo, no solo las de automoción; estudio de la asociación del sector [52]'],
            ['Reparto entre seguir en servicio, segunda vida y reciclaje', 'Sin dato publicado', 'Eurostat solo publica la recogida de las baterías portátiles y, en el reciclado, agrupa por química: ese reparto no figura en sus datos (lectura del equipo) [53]'],
          ],
        },
      },
      { note: 'La cifra real más cercana al 90 % del ejemplo es el índice de recogida de 2024 (90,85 %), que mide recogida, no trazabilidad. Las cifras con definiciones distintas no se suman ni se comparan entre sí.' },
    ],
  },
  {
    id: 'ods',
    label: 'ODS',
    title: 'Objetivos de Desarrollo Sostenible',
    blocks: [
      { p: 'Títulos, metas e indicadores oficiales de la Agenda 2030 [54, 55]. El vínculo de cada objetivo con EcoBat es una interpretación del equipo, no una medición oficial.' },
      {
        goals: [
          ['12', 'Producción y consumo responsables', 'Título oficial: «Garantizar modalidades de consumo y producción sostenibles». Meta 12.4 (plazo 2020, ya vencido): gestión ecológicamente racional de los productos químicos y de todos los desechos; indicador 12.4.2: desechos peligrosos per cápita y proporción tratada. Meta 12.5 (2030): reducir considerablemente la generación de desechos mediante prevención, reducción, reciclado y reutilización; indicador 12.5.1: tasa nacional de reciclado. Vínculo propuesto por el equipo: gestión de residuos peligrosos y aprovechamiento mediante reutilización y reciclaje.'],
          ['13', 'Acción por el clima', 'Título oficial: «Adoptar medidas urgentes para combatir el cambio climático y sus efectos». Meta 13.2 (sin plazo): incorporar medidas relativas al cambio climático en las políticas, estrategias y planes nacionales; indicadores 13.2.1 (países que informan en virtud del Acuerdo de París) y 13.2.2 (emisiones totales de gases de efecto invernadero por año). Vínculo propuesto por el equipo: reducir impactos de fabricar baterías nuevas, siempre que la reducción se mida.'],
          ['9', 'Industria, innovación e infraestructura', 'Título oficial: «Construir infraestructuras resilientes, promover la industrialización inclusiva y sostenible y fomentar la innovación». Meta 9.4 (2030): modernizar la infraestructura y reconvertir las industrias para que sean sostenibles, con un uso más eficaz de los recursos y tecnologías limpias; indicador 9.4.1: emisiones de CO2 por unidad de valor añadido. Vínculo propuesto por el equipo: tecnologías digitales para el mantenimiento, la recuperación de materiales y la gestión de residuos.'],
        ],
      },
      { h4: 'España en esos indicadores' },
      {
        table: {
          head: ['Indicador', 'Valor', 'Ámbito'],
          rows: [
            ['12.5.1.1 Residuos reciclados respecto de los tratados', '53,9 % en 2023 (38,3 % en 2015)', 'Todos los residuos [56]'],
            ['12.4.2.1 Residuos peligrosos por habitante', '68,6 kg en 2023 (72,8 kg en 2015)', 'Toda la economía [57]'],
            ['12.4.2.2 Residuos peligrosos tratados que se reciclan', '71,0 % en 2023 (67,8 % en 2015)', 'Toda la economía [57]'],
            ['9.4.1.2 Emisiones de la industria manufacturera por valor añadido', '0,41 kg de CO2 equivalente por euro en 2024 (0,57 en 2015)', 'Valor añadido bruto real [58]'],
            ['13.2.2.1 Emisiones de gases de efecto invernadero por habitante', '5,73 t de CO2 equivalente en 2024 (7,39 t en 2015)', 'Unidades residentes [59]'],
          ],
        },
      },
      {
        list: [
          'La Agenda 2030 se aprobó el 25-9-2015 con 17 objetivos y 169 metas [54]; el marco mundial tiene 234 indicadores únicos tras su revisión de marzo de 2026 [60]',
          'Según el informe de la ONU de 2026, el 36 % de las 139 metas con datos de tendencia avanza bien o de forma moderada; el 49 %, demasiado despacio, y el 15 % está por debajo del nivel de 2015 [61]',
          'El Reglamento (UE) 2023/1542 no cita los ODS 9, 12 ni 13 [25], y ninguno de los indicadores anteriores es específico de las baterías',
        ],
      },
    ],
  },
  {
    id: 'datos',
    label: 'Datos',
    title: 'Datos reales de referencia',
    blocks: [
      { p: 'Valores publicados, con su ámbito y su año. Las cifras de los capítulos salen de aquí; los recuentos de la simulación y los registros de las pantallas 3D son ejemplos del prototipo (pestaña Fuentes).' },
      { h4: 'Cifras que aparecen en los capítulos' },
      {
        table: {
          stack: true,
          head: ['Capítulo', 'Dato, ámbito y fuente'],
          rows: [
            ['1 · Recogida', 'Los componentes de plomo son cerca del 60 % de la masa de una batería de plomo de automoción; la carcasa de plástico, cerca del 7 %, y el electrolito, cerca del 30 %. Baterías recogidas en la UE, estudios sectoriales de 2014 y 2020 [51, 62]'],
            ['2 · Identificación', 'Desde el 18-2-2027 todas las pilas y baterías llevarán un código QR (art. 13.6 del Reglamento (UE) 2023/1542). En las de arranque da acceso a la información de etiquetado, a la declaración UE de conformidad y a la gestión de residuos, no a un pasaporte [25, 26]'],
            ['3 · Diagnóstico', 'A plena carga y en circuito abierto, tras 24 h de reposo: unos 12,6-12,65 V en una batería inundada y unos 12,8 V en una AGM [63–65]'],
            ['4 · Clasificación', 'Los recuentos 2/1/7 de 10 baterías son un ejemplo ilustrativo; no hay datos publicados de ese reparto (pestaña Indicadores). Definiciones que sirven de base a las rutas: reutilizar es volver a usar con la misma finalidad, adaptar es destinar a otro uso y remanufacturar exige recuperar al menos el 90 % de la capacidad asignada [26, 66]'],
            ['5 · Reciclaje', 'Reciclar plomo ahorra entre el 55 % y el 65 % de la energía que exige producirlo a partir de mineral. Síntesis bibliográfica del PNUMA (2013), citada por la OMS en 2017 [67, 68]'],
            ['6 · Trazabilidad', 'Las baterías de vehículos eléctricos, de medios de transporte ligeros y las industriales de más de 2 kWh que se introduzcan en el mercado de la UE desde el 18-2-2027 tendrán pasaporte digital (art. 77.1); las de arranque no están entre esas categorías [25, 26]'],
          ],
        },
      },
      { h4: 'Composición y peso' },
      {
        table: {
          head: ['Concepto', 'Valor', 'Ámbito y año'],
          rows: [
            ['Composición en masa', 'Plomo ≈60 %; electrolito ≈30 %; plástico ≈7 %', 'Baterías de plomo de automoción en la UE; estudios sectoriales de 2014 y 2020; los tres valores suman 97 % [51, 62]'],
            ['Composición según una ficha de seguridad', 'Plomo en polvo ≈32 % y plomo ≈32 %; ácido sulfúrico ≈29 %; envase de plástico ≈7 %', 'Producto concreto de un fabricante, revisión de 2021 [69]'],
            ['Peso de baterías de turismo de 12 V', 'De 9,3 kg (36 Ah) a 21,8 kg (90 Ah)', 'Fichas técnicas de dos fabricantes para el mercado europeo, consultadas en 2026 [70–75]'],
            ['Batería europea de referencia', '18 kg y 70 Ah; su fabricación consume 10,5 kg de plomo', 'Estudio de ciclo de vida sectorial con datos de 2017 [76]'],
            ['Ejemplo de las directrices de Basilea', '13,3 kg (44 Ah): 8,4 kg de plomo, 3,8 kg de electrolito y 1,1 kg de plásticos', 'Diseño de hacia 2003 [77]'],
            ['Tensión nominal', '12 V: seis celdas de unos 2 V en serie', 'Baterías de arranque de plomo-ácido [77, 78]'],
            ['Electrolito', 'Ácido sulfúrico diluido, de densidad ≈1,26 a plena carga (1,28 o más en algunos fabricantes)', 'Baterías inundadas; la concentración baja al descargarse [63, 78]'],
          ],
        },
      },
      { h4: 'Tensión en reposo y estado de carga' },
      { p: 'Tensión en circuito abierto de una batería de 12 V tras al menos 4 h sin carga ni descarga; los fabricantes recomiendan 24 h, y la tabla del BCI se mide a 26 °C [63, 65]. Valores de la tabla del BCI [63], de un fabricante de baterías inundadas [64] y de dos fabricantes de baterías AGM [64, 65]; prevalece el manual de cada batería.' },
      {
        table: {
          head: ['Carga', 'Inundada, tabla del BCI', 'Inundada, fabricante', 'AGM, fabricantes'],
          rows: [
            ['100 %', '12,65 V', '12,60 V', '12,80 V'],
            ['75 %', '12,45 V', '12,40 V', '12,60 V'],
            ['50 %', '12,24 V', '12,20 V', '12,30 V'],
            ['25 %', '12,06 V', '12,00 V', '12,00 V'],
            ['0 %', '11,89 V', '11,70 V', '11,80 V'],
          ],
        },
      },
      {
        list: [
          'Prueba de carga: se aplica la mitad de la corriente de arranque en frío (CCA) durante 15 s, con la batería al menos al 70-75 % de carga; se considera buena si se mantiene por encima de unos 9,6 V (9,5 V a 21 °C o más, según un fabricante) [64, 79]',
          'La CCA se mide distinto según la norma: −18 °C, 30 s y al menos 7,2 V en SAE J537 [80]; 7,5 V a los 10 s y una segunda descarga en EN 50342-1 [81, 82]. Sus cifras no son intercambiables [83]',
          'Un comprobador de tensión no mide capacidad, resistencia interna ni CCA, así que no basta para conocer el estado de salud [84, 85]',
          'Vida media de una batería de arranque: de 3 a 6 años según la fuente; de 3 a 5 según el RACE (España, 2022) y de 5 a 6 según el ADAC (Alemania, 2026) [86, 87]',
        ],
      },
      { h4: 'Recogida y reciclaje' },
      {
        table: {
          head: ['Indicador', 'Valor', 'Ámbito y año'],
          rows: [
            ['Índice de recogida de baterías de arranque', '82,21 % (2018), 83,35 % (2019), 87,93 % (2020), 88,41 % (2021), 88,60 % (2022), 90,24 % (2023) y 90,85 % (2024)', 'España; serie oficial del MITECO con la fórmula legal [47]'],
            ['Baterías de arranque puestas en el mercado y recogidas', '152.735,94 t y 127.396,01 t', 'España, 2024 [47]'],
            ['Eficiencia de reciclado de baterías de plomo', '71,9 %', 'España, 2023; baterías de plomo de cualquier origen que entran en las plantas [49]'],
            ['Recogida y reciclado de baterías de plomo de automoción', '97,3 %', 'UE (14 países), 2015-2017; estimación sectorial [51]'],
            ['Objetivos de eficiencia de reciclado de baterías de plomo', '75 % a 31-12-2025 y 80 % a 31-12-2030', 'UE; los cumplen los recicladores [25]'],
            ['Objetivos de recuperación del plomo', '90 % a 31-12-2027 y 95 % a 31-12-2031', 'UE [25]'],
            ['Contenido reciclado mínimo de plomo', '85 % desde el 18-8-2031', 'UE; baterías de arranque, de vehículos eléctricos e industriales de más de 2 kWh [25]'],
          ],
        },
      },
      { h4: 'Energía y CO2 del plomo secundario' },
      {
        table: {
          head: ['1 kg de plomo refinado', 'Energía primaria', 'CO2 equivalente', 'Ámbito'],
          rows: [
            ['Vía secundaria (reciclaje)', '10,0 MJ', '0,977 kg', 'Europa, datos de 2015 [88]'],
            ['Vía primaria (mineral)', '23,1 MJ', '1,82 kg', 'Europa y Norteamérica, datos de 2015 [89]'],
          ],
        },
      },
      {
        list: [
          'Con esas cifras, la vía secundaria usa un 57 % menos de energía y emite un 46 % menos de CO2 equivalente por kilo. Son estudios encargados por la industria; la investigación no halló un análisis independiente con cifras por vía [88, 89]',
          'El PNUMA sitúa el ahorro de energía del plomo reciclado entre el 55 % y el 65 % [67, 68]',
          'El plomo secundario fue el 67,4 % del plomo refinado producido en el mundo en 2025 [90] y el 80 % del producido en la UE en 2012-2016 [91]',
          'Una batería estándar de 18 kg suma unos 21 kg de CO2 equivalente de la cuna a la puerta de la fábrica, el 60 % por la producción del plomo (Europa, datos de 2017) [76]',
        ],
      },
      { h4: 'Peligros' },
      {
        table: {
          head: ['Elemento', 'Peligro y fuente'],
          rows: [
            ['Plomo', 'Tóxico para la reproducción: puede perjudicar la fertilidad o dañar al feto, y la exposición prolongada afecta a la sangre, la médula ósea, el sistema nervioso y los riñones [69, 92]. Según la OMS, no se conoce ninguna concentración de plomo en sangre que sea segura [93]'],
            ['Ácido sulfúrico del electrolito', 'Provoca quemaduras graves en la piel y lesiones oculares graves (H314, corrosivo de categoría 1A) desde el 15 % de concentración; irrita entre el 5 % y el 15 % [69, 94]'],
            ['Hidrógeno', 'Se desprende al cargar y forma mezclas explosivas con el aire a partir de un 4 % en volumen, aproximadamente [95]'],
            ['Batería usada', 'Residuo peligroso con el código 16 06 01* de la lista europea de residuos [96, 97]; por carretera viaja como UN 2794, clase 8, materias corrosivas [98]'],
            ['Exposición laboral al plomo', 'Valor límite de 0,03 mg/m³ en 8 horas, según la Directiva (UE) 2024/869 [99]; el real decreto que lo incorpora en España se aprobó el 20-10-2026 y aún no consta publicado en el BOE [100]'],
          ],
        },
      },
      { h4: 'Alta tensión en baterías de tracción' },
      {
        table: {
          head: ['Concepto', 'Valor', 'Ámbito y fuente'],
          rows: [
            ['Umbral de alta tensión', 'Más de 60 V y hasta 1500 V en corriente continua', 'Reglamento n.º 100 de la ONU, serie 05 de enmiendas [101]'],
            ['Otros umbrales', 'Más de 75 V en corriente continua en el anexo I del Reglamento (UE) 2023/1542; en el REBT español, baja tensión hasta 1500 V, con los automóviles fuera de su ámbito', 'UE y España [26, 102]'],
            ['Tensión de tracción', 'Hasta 650 V en corriente continua según el HSE británico (2025); de 400 a 1000 V en un supuesto práctico del IRSST de Madrid (2023)', 'Guías de prevención; no hay estadística oficial del reparto por tensiones [103, 104]'],
            ['Contacto en seco', 'Más de 110 V en corriente continua puede ser mortal', 'HSE, Reino Unido, 2025 [103]'],
            ['Antes de intervenir', 'Esperar de 5 a 10 minutos y comprobar que no queda tensión', 'IRSST de Madrid, 2023; manda el procedimiento del fabricante [104, 105]'],
            ['Peso de la batería', 'Cerca de 500 kg', 'IRSST de Madrid, 2023 [105]'],
            ['Capacidad media', 'Casi 70 kWh por turismo eléctrico', 'UE, 2025; Agencia Internacional de la Energía [106]'],
            ['Señalización', 'Cables naranja y símbolo de alta tensión sobre fondo amarillo', 'Reglamento n.º 100 de la ONU [101]'],
          ],
        },
      },
      {
        list: [
          'Una celda dañada puede sufrir un embalamiento térmico, y una batería en llamas puede volver a inflamarse [105]',
          'En España, quien extrae estas baterías en un centro de tratamiento de vehículos debe acreditar una cualificación [107]',
        ],
      },
      { h4: 'Proceso de reciclaje y fracciones' },
      {
        list: [
          'Preparación: se retira el ácido y se desmontan y separan las partes metálicas y plásticas [108, 109]',
          'Trituración y separación en agua por densidad: pasta de óxidos y sulfatos de plomo, parte metálica (rejillas y bornes), polipropileno, y ebonita con separadores [77]',
          'Fundición en horno rotativo con fundentes y un reductor: se sangra plomo bruto de una pureza aproximada del 98 %, a unos 800 °C [110]',
          'Refino y aleado entre 320 °C y 700 °C para retirar impurezas, y colada en lingotes [111]',
          'El plástico de la carcasa, cerca del 7 % del peso, se separa antes de fundir para recuperarlo [51, 112]; el electrolito puede regenerarse, convertirse en yeso o en sulfato de sodio, o neutralizarse, según la planta [112]',
          'Escoria: del orden de 300 a 350 kg por tonelada de plomo, con alrededor de un 5 % de compuestos de plomo [77]',
        ],
      },
      { p: 'Ejemplo real de fracciones: salidas anuales autorizadas de la planta de reciclado parcial de Pina de Ebro (Zaragoza), según su autorización ambiental de 2022. Son cantidades autorizadas, no medidas [113].' },
      {
        table: {
          head: ['Fracción', 'Toneladas al año'],
          rows: [
            ['Pastas y compuestos semielaborados de plomo', '27.845'],
            ['Aguas de electrolito neutralizadas', '3.960'],
            ['Metales no férreos', '2.000'],
            ['Separadores de polietileno', '1.775'],
            ['Polipropileno', '1.020'],
            ['Carcasas metálicas', '105'],
          ],
        },
      },
    ],
  },
  {
    id: 'limites',
    label: 'Límites',
    title: 'Normativa, seguridad y limitaciones',
    blocks: [
      { p: 'El Reglamento (UE) 2023/1542 regula la sostenibilidad, la recogida, el tratamiento y el reciclaje de las baterías; está en vigor desde el 17-8-2023 y se aplica desde el 18-2-2024 [25]. EcoBat es un prototipo académico: no sustituye los sistemas oficiales, las autorizaciones ni las obligaciones legales.' },
      { h4: 'Normativa' },
      {
        list: [
          'Pasaporte digital desde el 18-2-2027 para las baterías de vehículos eléctricos, de transporte ligero e industriales de más de 2 kWh; las de arranque de plomo llevan QR, no pasaporte [26]. La ficha de EcoBat es una aplicación voluntaria inspirada en ese pasaporte',
          'A 21-10-2026 siguen sin adoptarse el acto sobre el formato del etiquetado (art. 13.10), con un borrador notificado en diciembre de 2025 [28], y el del acceso a los datos restringidos del pasaporte (art. 77.9), con un borrador del 19-10-2026 [114]',
          'Desde el 18-8-2025, distribuidores y productores deben aceptar gratis las baterías de arranque usadas, sin exigir que se compre otra [25]',
          'La batería de plomo usada es residuo peligroso (16 06 01*). Desde el 9-12-2026, ese código se llama «residuos de pilas y baterías de plomo y ácido», según la Decisión Delegada (UE) 2025/934 y su corrección de errores [115, 116]',
          'En España sigue vigente el Real Decreto 106/2008; el proyecto de real decreto que lo sustituirá estuvo en información pública del 30-6 al 3-9-2026 [48, 117]',
        ],
      },
      { h4: 'Obligaciones del taller en España' },
      {
        list: [
          'Guardar las baterías usadas en una zona identificada, protegida de la intemperie y con retención de derrames, seis meses como máximo y sin mezclarlas con otros residuos [97]',
          'Etiquetar los envases con el código y la descripción del residuo, el NIMA, los datos del productor, la fecha de inicio del depósito y los pictogramas, en una etiqueta de al menos 10 × 10 cm [97]',
          'Presentar comunicación previa a la comunidad autónoma, llevar un archivo cronológico durante al menos cinco años y enviar la memoria anual antes del 1 de marzo [97]',
          'En traslados a otra comunidad autónoma: contrato de tratamiento con el gestor de destino, documento de identificación y notificación previa al menos diez días antes [118]',
          'Entregar residuos peligrosos a quien no esté habilitado es infracción muy grave, con multas de 600.001 € a 3.500.000 € [97]',
        ],
      },
      { h4: 'Seguridad' },
      {
        list: [
          'La aplicación no toma decisiones de seguridad por sí sola',
          'No abrir baterías ni manipular electrolitos: el ácido es corrosivo y la carga desprende hidrógeno (pestaña Datos)',
          'Al probar una batería: ventilación, protección de ojos, cara y manos, sin chispas ni llamas, y desconectar primero el cable negativo [64]',
          'Baterías dañadas, con fugas o de química desconocida: derivación especializada; las que pierden electrolito van en recipientes resistentes al ácido y sin vaciarlas [119]',
          'Sin pruebas de alta tensión en baterías de vehículos eléctricos sin personal cualificado y equipos especializados [120]',
          'Solo los datos necesarios, con permisos de acceso y copias de seguridad [17]',
        ],
      },
      { h4: 'Limitaciones reconocidas' },
      {
        list: [
          'El software no recicla físicamente los materiales: mejora la información y la coordinación',
          'Datos incompletos: se permite «desconocido» y una evaluación adicional',
          'Diagnósticos: validación técnica y equipos apropiados',
          'Una batería de arranque agotada no sirve directamente para almacenar energía solar: no está diseñada para descargas profundas y soporta de 12 a 15 ciclos de descarga total, frente a 150-200 en una de ciclo profundo [121]',
          'Los datos se consultaron el 21 y el 22 de octubre de 2026; los actos de la UE pendientes y el real decreto español pueden cambiar',
        ],
      },
    ],
  },
  {
    id: 'fuentes',
    label: 'Fuentes',
    title: 'Fuentes y créditos',
    blocks: [
      { p: 'Fuentes citadas en la presentación, numeradas por orden de aparición y agrupadas por tipo. Se consultaron el 21 y el 22 de octubre de 2026; los precios y las normas en tramitación pueden cambiar.' },
      { sources: true },
      { p: 'La arquitectura, el calendario de ocho semanas, las partidas del presupuesto y los indicadores son decisiones del equipo. El informe de la investigación, con los hechos verificados y su fuente, está en la carpeta docs/investigacion del repositorio del proyecto.' },
      { h4: 'Qué es real y qué es ejemplo en las pantallas 3D' },
      {
        list: [
          'Son ejemplos del prototipo, no mediciones, y las pantallas los rotulan como tales: el código ECB-0427 y sus fechas, los lotes 0147 y 04, las lecturas de prueba, las gráficas de capacidad y de historial, los contadores y los recuentos 2/1/7 del capítulo 4',
          'Sus valores son coherentes con los de referencia de la pestaña Datos: el lote 0147 pesa 324 kg porque son 18 baterías de 18 kg, la batería europea de referencia [76]; 12,6 V tras 24 h de reposo corresponde a una batería inundada cargada [63–65], y la prueba de carga no se supera si la tensión cae por debajo de unos 9,6 V [64, 79]',
          'Son datos reales la tensión nominal de 12 V [77, 78], la composición típica en masa de las barras del reciclaje (plomo 60 %, electrolito 30 % y plástico 7 %, aproximados; el 3 % restante no se desglosa) [51, 62] y, en el depósito, el código de residuo 16 06 01* [96, 97] y la clasificación de transporte UN 2794 [98]',
          '«Pasaporte EcoBat» es el nombre de la ficha del prototipo; no es el pasaporte para baterías del Reglamento (UE) 2023/1542, y las baterías de arranque no están entre las categorías que deben llevarlo [26]',
          'Los QR de las baterías del mundo son decorativos',
        ],
      },
      { h4: 'Créditos de la presentación' },
      {
        list: [
          'Mundo 3D modelado en tiempo real con Three.js; cámara con GSAP ScrollTrigger',
          'Tipografía Archivo (SIL Open Font License)',
          'Las referencias visuales (panorámica, batería, taller, laboratorio, cruce, reciclaje, centro y borde de isla) se generaron con IA mediante Codex; son conceptuales y no muestran instalaciones reales',
          'Materiales PBR del mundo 3D (hormigón, roca, metal, plástico, caucho) generados por código; sin texturas ni modelos externos',
        ],
      },
    ],
  },
];
