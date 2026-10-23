// Contenido de la presentación. Textos del proyecto: documento académico del equipo
// (context/Proyecto de sostenibilidad informática_ EcoBat.docx).
// Cada [n] remite a src/sources.js; la relación de cada número con la fuente original y con los hechos
// verificados está en docs/investigacion/mapa-fuentes.json. Los recuentos 2/1/7, el ejemplo del 90 % y los
// registros de las pantallas 3D son ejemplos del prototipo, no datos reales, y se rotulan como tales.

export const SITE_URL = 'https://laos23.github.io/ecobat-presentacion/';

export const intro = {
  title: 'EcoBat',
  tagline: 'Una batería. Más de una vida.',
  lede: 'Gestión, reutilización y reciclaje de baterías de coche, de plomo y de litio, con trazabilidad digital.',
  note: 'Proyecto académico de sostenibilidad informática',
};

// Ocho capítulos, en el orden de src/world/chapters.js (CH): recogida = 1 … trazabilidad = 8; la portada es 0 y el
// cierre, 9. El título y el cuerpo no llevan citas: sus datos tienen la fuente en el anexo (pestaña Datos). Cada
// capítulo lleva además una tarjeta de datos (card) con dos o tres datos breves, cada uno con su cita [n]; lo que es
// ejemplo del prototipo va aparte, en card.example, con su rótulo.
export const chapters = [
  {
    id: 'recogida',
    label: 'Recogida',
    title: '¿Aquí termina todo?',
    body: 'Una batería usada contiene plomo (cerca del 60 % de su peso), ácido y materiales valiosos. Necesita una gestión adecuada, no un vertedero.',
    card: {
      title: 'Por qué en palés',
      items: [
        'Una batería de turismo de 12 V pesa de 9,3 a 21,8 kg, según las fichas de dos fabricantes [1–6]: se mueven en palés y con carretilla.',
        'La de coche eléctrico viaja embalada como UN 3480, clase 9, con la etiqueta 9A de las baterías de litio [7, 8].',
      ],
    },
  },
  {
    id: 'identificacion',
    label: 'Identificación',
    title: 'Ahora tiene historia.',
    body: 'Al llegar, cada batería recibe un QR que la vincula a su ficha. Después, un técnico mide su estado: cargada y en reposo, una de 12 V marca de 12,6 a 12,8 V.',
    card: {
      title: 'Ficha y medida',
      example: 'La ficha ECB-0427 y la lectura de 12,6 V de las pantallas.',
      items: [
        'Cargada y tras 24 h de reposo, una batería de 12 V marca unos 12,6 V si es inundada y unos 12,8 V si es AGM [9–11].',
        'Desde el 18-2-2027, toda batería nueva llevará un código QR; en las de arranque no da acceso a un pasaporte [12, 13].',
      ],
    },
  },
  {
    id: 'clasificacion',
    label: 'Clasificación',
    title: 'Cada batería, su camino.',
    body: 'El software sugiere una ruta. El personal técnico la valida.',
    routes: [
      { key: 'service', name: 'Vuelven a servicio', detail: 'Baterías de plomo, tras comprobarlas, limpiarlas o repararlas', count: 2 },
      { key: 'second', name: 'Batería de coche eléctrico', detail: 'Se desmonta y se decide: otro coche, segunda vida o un reciclador de litio', count: 1 },
      { key: 'recycle', name: 'Reciclaje autorizado', detail: 'Baterías de plomo que no pueden aprovecharse', count: 7 },
    ],
    simulation: 'Ejemplo ilustrativo con 10 baterías: no son datos reales',
    card: {
      title: 'Bornes protegidos',
      items: [
        'Por carretera, las baterías usadas que van al reciclaje quedan fuera del ADR solo si tienen la carcasa intacta, van sujetas (por ejemplo, en palés), sin ácido por fuera y protegidas contra cortocircuitos [7].',
        'Si no, viajan como mercancía peligrosa: UN 2794, clase 8, corrosivas [7].',
      ],
    },
  },
  {
    id: 'reutilizacion',
    label: 'Reutilización',
    title: 'Si funciona, sigue.',
    body: 'Las baterías que pasan las pruebas, o que pueden repararse, se limpian, se reparan si hace falta y se recargan. Si vuelven a superar la prueba, salen al mercado con su historial; si no, van al reciclaje.',
    card: {
      title: 'Preparar para reutilizar',
      items: [
        'La ley llama así a la «comprobación, limpieza o reparación» de un residuo para que vuelva a usarse sin otra transformación previa [14, 15].',
        'En España, deja de ser residuo si cumple las normas de producto aplicables [15].',
      ],
    },
  },
  {
    id: 'desmontaje',
    label: 'Desmontaje',
    title: 'Se abre por módulos.',
    body: 'Técnicos formados en alta tensión abren la batería de un coche eléctrico y evalúan sus módulos. Si al sustituir los que fallan recupera la capacidad que exige la norma, se remanufactura y vuelve a un coche.',
    card: {
      title: 'Remanufacturar: mismo uso',
      items: [
        'La batería debe recuperar al menos el 90 % de su capacidad asignada original, con celdas cuyo estado de salud no difiera más de un 3 % (Reglamento (UE) 2023/1542) [12].',
        'Vuelve al mismo uso, otro coche: no es segunda vida [12].',
        'Los trabajos con alta tensión los hace personal cualificado [16, 17].',
      ],
    },
  },
  {
    id: 'segunda-vida',
    label: 'Segunda vida',
    title: 'Otra vida, solo con pruebas.',
    body: 'Los módulos que ya no rinden para mover un coche, pero guardan energía, pueden almacenarla en otra instalación si superan pruebas específicas; los demás van a un reciclador de litio. Una batería de arranque no sirve para esto: no está hecha para descargas profundas.',
    card: {
      title: 'Otra vida, otro uso',
      items: [
        'Casos reales: Endesa en Melilla (2022), con 78 baterías Nissan, 48 de ellas usadas [18]; Renault en Douai (2020) [19], y el Johan Cruijff ArenA de Ámsterdam (2018) [20].',
        'La AIE advierte de que reutilizarlas sigue siendo difícil: por la seguridad, la garantía, la incertidumbre sobre su vida restante y el coste de desmontarlas y adaptarlas [21].',
        'Una batería de arranque aguanta de 12 a 15 descargas totales, frente a 150-200 una de ciclo profundo [22].',
      ],
    },
  },
  {
    id: 'reciclaje',
    label: 'Reciclaje',
    title: 'Los materiales siguen.',
    body: 'Un gestor autorizado recupera los materiales: reciclar plomo ahorra del 55 al 65 % de la energía. EcoBat registra la entrega y su destino.',
    card: {
      title: 'Lingotes y granza',
      items: [
        'La batería se tritura y sus partes se separan en agua: pasta de plomo, rejillas y bornes, polipropileno y separadores [23].',
        'El plomo se funde, se refina y se cuela en lingotes [24, 25]; el plástico de la carcasa, cerca del 7 % del peso, se recupera antes de fundir [26, 27].',
      ],
    },
  },
  {
    id: 'trazabilidad',
    label: 'Trazabilidad',
    title: 'Todo queda conectado.',
    body: 'Se guarda cada paso. En la UE, desde el 18-2-2027, toda batería nueva de vehículo eléctrico tendrá pasaporte digital.',
    passport: ['Registro y QR', 'Diagnóstico', 'Ruta validada', 'Destino documentado'],
    card: {
      title: 'Un pasaporte nuevo',
      items: [
        'Si una batería de coche eléctrico se adapta o se remanufactura, recibe un pasaporte nuevo vinculado al original [12].',
        'El pasaporte deja de existir cuando la batería se recicla. La de arranque lleva QR, pero no pasaporte [12, 13].',
      ],
    },
  },
];

export const closing = {
  title: 'Conocer su estado. Documentar su destino.',
  body: 'Antes de desechar una batería, hay que conocer su estado. Cuando ya no pueda aprovecharse de forma segura, hay que asegurar que llegue al circuito de reciclaje adecuado.',
  card: {
    title: 'Cerrar el círculo',
    items: ['Desde el 18-8-2031, las baterías nuevas de arranque, de vehículo eléctrico e industriales de más de 2 kWh deberán acreditar al menos un 85 % de plomo valorizado de residuos [12].'],
  },
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
            ['Interfaz web', 'HTML, CSS y JavaScript', 'Formularios, fichas y estadísticas', 'HTML: «HTML Living Standard» del WHATWG, con licencia CC BY 4.0 [28, 29]. JavaScript: ECMA-262, 17.ª edición, de junio de 2026 [30]'],
            ['Aplicación', 'Python con Flask', 'Lógica del sistema', 'Python 3.15.1, licencia PSF v2 [31, 32]. Flask 3.1.3, licencia BSD-3-Clause [33, 34]'],
            ['Base de datos', 'SQLite', 'Baterías, pruebas y movimientos', '3.54.1, del 16-10-2026; de dominio público [35, 36]'],
            ['Identificación', 'Códigos QR', 'Acceso a la ficha de cada batería', 'Bibliotecas de Python Segno 1.6.6, licencia BSD-3-Clause [37, 38], o qrcode 8.2, licencia BSD [39, 40]'],
            ['Visualización', 'Chart.js', 'Gráficos de sostenibilidad', '4.5.1, licencia MIT [41, 42]'],
            ['Alojamiento', 'Ordenador local o servidor web', 'Acceso a la aplicación', 'Opciones y precios en la pestaña Presupuesto'],
          ],
        },
      },
      { h4: 'Criterios de diseño con base en fuentes' },
      {
        list: [
          'El QR apunta a una dirección estable que redirige a la ficha, y el identificador no lleva datos dentro, como recomienda la guía técnica del consorcio Battery Pass [43]',
          'La ficha guarda datos de la batería y no de su propietario. Es un principio de diseño apoyado en la minimización de datos del RGPD (art. 5.1.c) [44], no una garantía legal: por analogía con lo que el Tribunal de Justicia de la UE resolvió sobre el número de bastidor, un identificador puede ser dato personal para quien pueda asociarlo a una persona [45]',
          'SQLite admite lectores simultáneos sin límite, pero un solo escritor a la vez; su documentación estima que basta para sitios de menos de 100.000 accesos al día [46]',
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
          'Java: JDK 25 es la última versión con soporte a largo plazo y JDK 27 la más reciente; OpenJDK se distribuye con licencia GPLv2 y Classpath Exception [47, 48]',
          'PHP 8.5.12, con licencia Modified BSD (PHP License v4) [49, 50]',
          'MySQL Community Server: licencia GPLv2 con permisos adicionales [51]',
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
          ['17-8-2023', 'Entrada en vigor', 'Publicado en el Diario Oficial de la UE el 28-7-2023 [12].'],
          ['18-2-2024', 'Aplicación general', 'El Reglamento se aplica con carácter general [12].'],
          ['18-8-2024', 'Estado de salud en el BMS', 'Las baterías de vehículos eléctricos, de transporte ligero y estacionarias guardan datos de estado de salud y vida útil prevista [13].'],
          ['18-8-2025', 'Símbolo y responsabilidad del productor', 'Símbolo de recogida separada en todas las baterías y responsabilidad ampliada del productor [13]; queda derogada la Directiva 2006/66/CE [12].'],
          ['31-12-2025', 'Eficiencia de reciclado del 75 %', 'Objetivo para las baterías de plomo, que deben cumplir los recicladores [12].'],
          ['18-2-2027', 'Código QR y pasaporte', 'QR en todas las baterías; pasaporte digital para las de vehículos eléctricos, de transporte ligero e industriales de más de 2 kWh [13].'],
          ['18-8-2027', 'Diligencia debida', 'Obligaciones aplazadas dos años por el Reglamento (UE) 2025/1561 [52].'],
          ['31-12-2027', 'Recuperación del 90 % del plomo', 'Objetivo de valorización del plomo de las baterías recicladas [12].'],
          ['31-12-2030', 'Eficiencia de reciclado del 80 %', 'Segundo objetivo para las baterías de plomo [12].'],
          ['18-8-2031', 'Contenido reciclado mínimo', '85 % de plomo valorizado en baterías de arranque, de vehículos eléctricos e industriales de más de 2 kWh; además, 16 % de cobalto, 6 % de litio y 6 % de níquel [13].'],
          ['31-12-2031', 'Recuperación del 95 % del plomo', 'Segundo objetivo de valorización del plomo [12].'],
          ['18-8-2036', 'Contenido reciclado ampliado', 'Se mantiene el 85 % de plomo y sube al 26 % de cobalto, 12 % de litio y 15 % de níquel [13].'],
        ],
      },
      { note: 'La etiqueta con información general se exige desde el 18-8-2026 o 18 meses después del acto de ejecución del artículo 13.10, si esa fecha es posterior [13]; a 21-10-2026 ese acto solo existe como borrador [53].' },
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
            ['Etiquetas QR', '8 hojas A4 de poliéster para impresora láser con 192 etiquetas: 20,32 € más 7,99 € de envío [54, 55]', '28,31 €'],
            ['Alojamiento web durante las ocho semanas (opcional)', 'Cuenta gratuita, o plan Developer del servidor europeo de PythonAnywhere a 10 € al mes durante dos meses, sin IVA indicado [56]', '0–20,00 €'],
            ['Material de presentación', 'Póster A2 (6,75 €) y dossier A4 en color de 30 caras (30 × 0,12 €) con encuadernación en espiral (1,75 €) [57, 58]', '12,10 €'],
            ['Total del prototipo', 'Suma de las partidas anteriores; el alojamiento, sin IVA verificado', '40,41–60,41 €'],
          ],
        },
      },
      { h4: 'Opciones que no entran en el total' },
      {
        list: [
          'Impresora de etiquetas térmica: QL-700 a 69,99 € en una tienda [59] o QL-800 a 130,30 €, precio de lista del fabricante [60], más un rollo de 1000 etiquetas de 23 × 23 mm por 22,66 € [61]: de 92,65 € a 152,96 €. El fabricante advierte de que esas etiquetas no están pensadas para un etiquetado duradero ni para estar en exterior más de un mes [62]',
          'Otras etiquetas: 20 hojas A4 de vinilo adhesivo para impresora de inyección por 7,20 €, sin envío verificado [63]',
          'Otros alojamientos, con precios en dólares: Render Starter, 7 $ al mes (≈6,23 €) [64]; Railway Hobby, mínimo de 5 $ al mes (≈4,45 €) [65, 66]; Fly.io, desde 2,19 $ por 30 días en regiones de EE. UU. (≈1,95 €) [67, 68]. Conversión con el tipo de referencia del BCE del 21-10-2026: 1 € = 1,1234 $ [69]',
          'La cuenta gratuita de PythonAnywhere incluye una aplicación web que caduca al mes y 512 MiB de disco [70]; en el plan gratuito de Render, una base SQLite se pierde en cada redespliegue [71]',
        ],
      },
      { h4: 'Lo que no se pudo verificar' },
      {
        list: [
          'El IVA de los alojamientos para un cliente español: sus páginas no indican impuestos, salvo Fly.io, que da los precios sin impuestos [56, 68]',
          'La resistencia de las etiquetas al electrolito, al calor del motor o a la vibración: no hay ensayos; el fabricante solo declara de −20 °C a +80 °C y resistencia al agua, al aceite, a los rayos UV, a la abrasión y a agentes químicos [54]',
          'La duración de los precios: las ofertas de tienda cambian sin aviso, y alguna vencía el 23-10-2026 [59]',
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
            ['Índice de recogida de baterías de arranque (España, oficial)', '90,85 % en 2024', 'Toneladas recogidas en el año entre la media de las puestas en el mercado ese año y los dos anteriores; en 2024 se recogieron 127.396,01 t y se pusieron en el mercado 152.735,94 t [72]. Objetivo legal: 98 % desde el 31-12-2018 [73]'],
            ['Eficiencia de reciclado de baterías de plomo (España)', '71,9 % en 2023', 'Masa reciclada entre la masa que entra en las plantas: 199.181 t de 277.016 t, de cualquier origen [74]. El objetivo del 75 % desde el 31-12-2025 obliga a los recicladores y se calcula con otro método, así que esta cifra no prueba un incumplimiento [75]'],
            ['Recogida y reciclado de baterías de plomo de automoción (UE)', '97,3 % en 2015-2017', 'Toneladas recogidas entre las disponibles para recogida en 14 países de la UE de entonces, con el 92 % del parque; estimación con un modelo en un estudio encargado por la industria [26]'],
            ['Reciclado del plomo de las baterías (EE. UU.)', '97,7 % en 2020-2024', 'Plomo reciclado entre plomo disponible en todas las baterías de plomo, no solo las de automoción; estudio de la asociación del sector [76]'],
            ['Reparto entre reutilización, segunda vida y reciclaje', 'Sin dato publicado', 'Eurostat solo publica la recogida de las baterías portátiles y, en el reciclado, agrupa por química: ese reparto no figura en sus datos (lectura del equipo) [77]'],
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
      { p: 'Títulos, metas e indicadores oficiales de la Agenda 2030 [78, 79]. El vínculo de cada objetivo con EcoBat es una interpretación del equipo, no una medición oficial.' },
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
            ['12.5.1.1 Residuos reciclados respecto de los tratados', '53,9 % en 2023 (38,3 % en 2015)', 'Todos los residuos [80]'],
            ['12.4.2.1 Residuos peligrosos por habitante', '68,6 kg en 2023 (72,8 kg en 2015)', 'Toda la economía [81]'],
            ['12.4.2.2 Residuos peligrosos tratados que se reciclan', '71,0 % en 2023 (67,8 % en 2015)', 'Toda la economía [81]'],
            ['9.4.1.2 Emisiones de la industria manufacturera por valor añadido', '0,41 kg de CO2 equivalente por euro en 2024 (0,57 en 2015)', 'Valor añadido bruto real [82]'],
            ['13.2.2.1 Emisiones de gases de efecto invernadero por habitante', '5,73 t de CO2 equivalente en 2024 (7,39 t en 2015)', 'Unidades residentes [83]'],
          ],
        },
      },
      {
        list: [
          'La Agenda 2030 se aprobó el 25-9-2015 con 17 objetivos y 169 metas [78]; el marco mundial tiene 234 indicadores únicos tras su revisión de marzo de 2026 [84]',
          'Según el informe de la ONU de 2026, el 36 % de las 139 metas con datos de tendencia avanza bien o de forma moderada; el 49 %, demasiado despacio, y el 15 % está por debajo del nivel de 2015 [85]',
          'El Reglamento (UE) 2023/1542 no cita los ODS 9, 12 ni 13 [12], y ninguno de los indicadores anteriores es específico de las baterías',
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
            ['1 · Recogida', 'Los componentes de plomo son cerca del 60 % de la masa de una batería de plomo de automoción; la carcasa de plástico, cerca del 7 %, y el electrolito, cerca del 30 %. Baterías recogidas en la UE, estudios sectoriales de 2014 y 2020 [26, 86]. Peso de una batería de turismo de 12 V: de 9,3 a 21,8 kg [1–6]'],
            ['2 · Identificación y diagnóstico', 'Desde el 18-2-2027 todas las pilas y baterías llevarán un código QR (art. 13.6 del Reglamento (UE) 2023/1542); en las de arranque da acceso a la información de etiquetado, a la declaración UE de conformidad y a la gestión de residuos, no a un pasaporte [12, 13]. A plena carga y en circuito abierto, tras 24 h de reposo: unos 12,6-12,65 V en una batería inundada y unos 12,8 V en una AGM [9–11]'],
            ['3 · Clasificación', 'Los recuentos 2/1/7 de 10 baterías son un ejemplo ilustrativo; no hay datos publicados de ese reparto (pestaña Indicadores). Por carretera, las baterías usadas que van a reciclaje no están sujetas al ADR solo si tienen la carcasa intacta, van sujetas, sin restos de ácido y protegidas contra cortocircuitos (disposición especial 598); si no, son UN 2794, clase 8 [7]'],
            ['4 · Reutilización', 'Preparar para la reutilización es la «comprobación, limpieza o reparación» de un residuo para que pueda reutilizarse sin otra transformación previa (Directiva 2008/98/CE, art. 3.16; Ley 7/2022, art. 2.y) [14, 15]'],
            ['5 · Desmontaje', 'Remanufacturar exige desmontar y evaluar todas las celdas y módulos, recuperar al menos el 90 % de la capacidad asignada original con celdas cuyo estado de salud no difiera más de un 3 %, y mantener el uso original (Reglamento (UE) 2023/1542, art. 3.1.32) [12]. Este 90 % es un umbral legal, distinto del ejemplo del 90 % de trazabilidad (pestaña Indicadores). Los trabajos con alta tensión los hace personal cualificado [16, 17]'],
            ['6 · Segunda vida', 'Adaptar es destinar una batería a una finalidad distinta de la original (art. 3.1.31) [12]. Casos: Endesa en Melilla, 2022, 78 baterías Nissan (48 usadas y 30 nuevas), 4 MW y hasta 1,7 MWh [18]; Renault en Douai, 2020, 4,7 MWh con baterías usadas y nuevas [19]; Johan Cruijff ArenA, Ámsterdam, 2018, 3 MW con baterías usadas y nuevas equivalentes a 148 Nissan LEAF [20]. Son datos de las propias empresas. Una batería de arranque soporta de 12 a 15 descargas totales, frente a 150-200 una de ciclo profundo [22]'],
            ['7 · Reciclaje', 'Reciclar plomo ahorra entre el 55 % y el 65 % de la energía que exige producirlo a partir de mineral. Síntesis bibliográfica del PNUMA (2013), citada por la OMS en 2017 [87, 88]. Etapas del proceso y fracciones, más abajo [23–25, 27]'],
            ['8 · Trazabilidad', 'Las baterías de vehículos eléctricos, de medios de transporte ligeros y las industriales de más de 2 kWh que se introduzcan en el mercado de la UE desde el 18-2-2027 tendrán pasaporte digital (art. 77.1); las de arranque no están entre esas categorías. Si se adaptan o remanufacturan, reciben un pasaporte nuevo vinculado al original (art. 77.7) [12, 13]'],
            ['Cierre', 'Desde el 18-8-2031, las baterías de arranque, de vehículo eléctrico e industriales de más de 2 kWh deberán acreditar al menos un 85 % de plomo valorizado de residuos (art. 8.2); se mantiene desde 2036 [12, 13]'],
          ],
        },
      },
      { h4: 'Composición y peso' },
      {
        table: {
          head: ['Concepto', 'Valor', 'Ámbito y año'],
          rows: [
            ['Composición en masa', 'Plomo ≈60 %; electrolito ≈30 %; plástico ≈7 %', 'Baterías de plomo de automoción en la UE; estudios sectoriales de 2014 y 2020; los tres valores suman 97 % [26, 86]'],
            ['Composición según una ficha de seguridad', 'Plomo en polvo ≈32 % y plomo ≈32 %; ácido sulfúrico ≈29 %; envase de plástico ≈7 %', 'Producto concreto de un fabricante, revisión de 2021 [89]'],
            ['Peso de baterías de turismo de 12 V', 'De 9,3 kg (36 Ah) a 21,8 kg (90 Ah)', 'Fichas técnicas de dos fabricantes para el mercado europeo, consultadas en 2026 [1–6]'],
            ['Batería europea de referencia', '18 kg y 70 Ah; su fabricación consume 10,5 kg de plomo', 'Estudio de ciclo de vida sectorial con datos de 2017 [90]'],
            ['Ejemplo de las directrices de Basilea', '13,3 kg (44 Ah): 8,4 kg de plomo, 3,8 kg de electrolito y 1,1 kg de plásticos', 'Diseño de hacia 2003 [23]'],
            ['Tensión nominal', '12 V: seis celdas de unos 2 V en serie', 'Baterías de arranque de plomo-ácido [23, 91]'],
            ['Electrolito', 'Ácido sulfúrico diluido, de densidad ≈1,26 a plena carga (1,28 o más en algunos fabricantes)', 'Baterías inundadas; la concentración baja al descargarse [9, 91]'],
          ],
        },
      },
      { h4: 'Tensión en reposo y estado de carga' },
      { p: 'Tensión en circuito abierto de una batería de 12 V tras al menos 4 h sin carga ni descarga; los fabricantes recomiendan 24 h, y la tabla del BCI se mide a 26 °C [9, 11]. Valores de la tabla del BCI [9], de un fabricante de baterías inundadas [10] y de dos fabricantes de baterías AGM [10, 11]; prevalece el manual de cada batería.' },
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
          'Prueba de carga: se aplica la mitad de la corriente de arranque en frío (CCA) durante 15 s, con la batería al menos al 70-75 % de carga; se considera buena si se mantiene por encima de unos 9,6 V (9,5 V a 21 °C o más, según un fabricante) [10, 92]',
          'La CCA se mide distinto según la norma: −18 °C, 30 s y al menos 7,2 V en SAE J537 [93]; 7,5 V a los 10 s y una segunda descarga en EN 50342-1 [94, 95]. Sus cifras no son intercambiables [96]',
          'Un comprobador de tensión no mide capacidad, resistencia interna ni CCA, así que no basta para conocer el estado de salud [97, 98]',
          'Vida media de una batería de arranque: de 3 a 6 años según la fuente; de 3 a 5 según el RACE (España, 2022) y de 5 a 6 según el ADAC (Alemania, 2026) [99, 100]',
        ],
      },
      { h4: 'Recogida y reciclaje' },
      {
        table: {
          head: ['Indicador', 'Valor', 'Ámbito y año'],
          rows: [
            ['Índice de recogida de baterías de arranque', '82,21 % (2018), 83,35 % (2019), 87,93 % (2020), 88,41 % (2021), 88,60 % (2022), 90,24 % (2023) y 90,85 % (2024)', 'España; serie oficial del MITECO con la fórmula legal [72]'],
            ['Baterías de arranque puestas en el mercado y recogidas', '152.735,94 t y 127.396,01 t', 'España, 2024 [72]'],
            ['Eficiencia de reciclado de baterías de plomo', '71,9 %', 'España, 2023; baterías de plomo de cualquier origen que entran en las plantas [74]'],
            ['Recogida y reciclado de baterías de plomo de automoción', '97,3 %', 'UE (14 países), 2015-2017; estimación sectorial [26]'],
            ['Objetivos de eficiencia de reciclado de baterías de plomo', '75 % a 31-12-2025 y 80 % a 31-12-2030', 'UE; los cumplen los recicladores [12]'],
            ['Objetivos de recuperación del plomo', '90 % a 31-12-2027 y 95 % a 31-12-2031', 'UE [12]'],
            ['Contenido reciclado mínimo de plomo', '85 % desde el 18-8-2031', 'UE; baterías de arranque, de vehículos eléctricos e industriales de más de 2 kWh [12]'],
          ],
        },
      },
      { h4: 'Energía y CO2 del plomo secundario' },
      {
        table: {
          head: ['1 kg de plomo refinado', 'Energía primaria', 'CO2 equivalente', 'Ámbito'],
          rows: [
            ['Vía secundaria (reciclaje)', '10,0 MJ', '0,977 kg', 'Europa, datos de 2015 [101]'],
            ['Vía primaria (mineral)', '23,1 MJ', '1,82 kg', 'Europa y Norteamérica, datos de 2015 [102]'],
          ],
        },
      },
      {
        list: [
          'Con esas cifras, la vía secundaria usa un 57 % menos de energía y emite un 46 % menos de CO2 equivalente por kilo. Son estudios encargados por la industria; la investigación no halló un análisis independiente con cifras por vía [101, 102]',
          'El PNUMA sitúa el ahorro de energía del plomo reciclado entre el 55 % y el 65 % [87, 88]',
          'El plomo secundario fue el 67,4 % del plomo refinado producido en el mundo en 2025 [103] y el 80 % del producido en la UE en 2012-2016 [104]',
          'Una batería estándar de 18 kg suma unos 21 kg de CO2 equivalente de la cuna a la puerta de la fábrica, el 60 % por la producción del plomo (Europa, datos de 2017) [90]',
        ],
      },
      { h4: 'Peligros' },
      {
        table: {
          head: ['Elemento', 'Peligro y fuente'],
          rows: [
            ['Plomo', 'Tóxico para la reproducción: puede perjudicar la fertilidad o dañar al feto, y la exposición prolongada afecta a la sangre, la médula ósea, el sistema nervioso y los riñones [89, 105]. Según la OMS, no se conoce ninguna concentración de plomo en sangre que sea segura [106]'],
            ['Ácido sulfúrico del electrolito', 'Provoca quemaduras graves en la piel y lesiones oculares graves (H314, corrosivo de categoría 1A) desde el 15 % de concentración; irrita entre el 5 % y el 15 % [89, 107]'],
            ['Hidrógeno', 'Se desprende al cargar y forma mezclas explosivas con el aire a partir de un 4 % en volumen, aproximadamente [108]'],
            ['Batería usada', 'Residuo peligroso con el código 16 06 01* de la lista europea de residuos [15, 109]; por carretera viaja como UN 2794, clase 8, materias corrosivas [7]'],
            ['Exposición laboral al plomo', 'Valor límite de 0,03 mg/m³ en 8 horas, según la Directiva (UE) 2024/869 [110]; el real decreto que lo incorpora en España se aprobó el 20-10-2026 y aún no consta publicado en el BOE [111]'],
          ],
        },
      },
      { h4: 'Alta tensión en baterías de tracción' },
      {
        table: {
          head: ['Concepto', 'Valor', 'Ámbito y fuente'],
          rows: [
            ['Umbral de alta tensión', 'Más de 60 V y hasta 1500 V en corriente continua', 'Reglamento n.º 100 de la ONU, serie 05 de enmiendas [112]'],
            ['Otros umbrales', 'Más de 75 V en corriente continua en el anexo I del Reglamento (UE) 2023/1542; en el REBT español, baja tensión hasta 1500 V, con los automóviles fuera de su ámbito', 'UE y España [13, 113]'],
            ['Tensión de tracción', 'Hasta 650 V en corriente continua según el HSE británico (2025); de 400 a 1000 V en un supuesto práctico del IRSST de Madrid (2023)', 'Guías de prevención; no hay estadística oficial del reparto por tensiones [114, 115]'],
            ['Contacto en seco', 'Más de 110 V en corriente continua puede ser mortal', 'HSE, Reino Unido, 2025 [114]'],
            ['Antes de intervenir', 'Esperar de 5 a 10 minutos y comprobar que no queda tensión', 'IRSST de Madrid, 2023; manda el procedimiento del fabricante [16, 115]'],
            ['Peso de la batería', 'Hasta cerca de 500 kg', 'IRSST de Madrid, 2023 [16]'],
            ['Capacidad media', 'Casi 70 kWh por turismo eléctrico', 'UE, 2025; Agencia Internacional de la Energía [21]'],
            ['Señalización', 'Cables naranja y símbolo de alta tensión sobre fondo amarillo', 'Reglamento n.º 100 de la ONU [112]'],
          ],
        },
      },
      {
        list: [
          'Una celda dañada puede sufrir un embalamiento térmico, y una batería en llamas puede volver a inflamarse [16]',
          'En España, quien extrae estas baterías en un centro de tratamiento de vehículos debe acreditar una cualificación [116]',
        ],
      },
      { h4: 'Rutas de las baterías: definiciones legales' },
      {
        table: {
          stack: true,
          head: ['Ruta', 'Qué es', 'Uso', 'Fuente'],
          rows: [
            ['Reutilización', 'Volver a usar con la misma finalidad productos que no son residuos', 'Mismo uso', 'Directiva 2008/98/CE, art. 3.13 [14]'],
            ['Preparación para la reutilización', '«Comprobación, limpieza o reparación» de un residuo para que pueda reutilizarse sin otra transformación previa; en España deja de ser residuo si cumple las normas de producto aplicables', 'Mismo uso', 'Directiva 2008/98/CE, art. 3.16; Ley 7/2022, art. 2.y [14, 15]'],
            ['Remanufacturación', 'Desmontar y evaluar todas las celdas y módulos y recuperar al menos el 90 % de la capacidad asignada original, con celdas cuyo estado de salud no difiera más de un 3 %', 'Mismo uso', 'Reglamento (UE) 2023/1542, art. 3.1.32 [12]'],
            ['Adaptación (segunda vida)', 'Usar una batería para una finalidad o aplicación distinta de aquella para la que se diseñó; una de coche adaptada a usos industriales pasa a ser batería industrial', 'Otro uso', 'Reglamento (UE) 2023/1542, art. 3.1.13 y 3.1.31 [12]'],
            ['Reciclaje', 'Transformar los residuos en materiales: en el plomo-ácido, plomo en lingotes, polipropileno y productos del electrolito', 'Materiales', 'Directiva 2008/98/CE, art. 3.17 [14]; proceso, más abajo'],
          ],
        },
      },
      { note: 'En el recorrido, la batería de arranque de plomo va a reutilización o a reciclaje; la de coche eléctrico se desmonta en módulos, que van a remanufacturación, a segunda vida o a un reciclador de litio. Son rutas distintas y nada se cuenta dos veces.' },
      { h4: 'Segunda vida: casos reales' },
      {
        table: {
          head: ['Instalación', 'Año', 'Qué tiene', 'Fuente'],
          rows: [
            ['Central de Endesa en Melilla (España)', '2022', '78 baterías de coche Nissan, 48 usadas y 30 nuevas para comparar; 4 MW y hasta 1,7 MWh', 'Nota de prensa de Endesa [18]'],
            ['Fábrica de Renault en Douai (Francia)', '2020', '4,7 MWh con baterías de segunda vida y baterías nuevas guardadas para posventa (4,9 MWh según la empresa en 2022)', 'Nota de Renault Group [19]'],
            ['Johan Cruijff ArenA, Ámsterdam (Países Bajos)', '2018', '3 MW con baterías de coche de segunda vida y nuevas, equivalentes a 148 baterías de Nissan LEAF', 'Nota de prensa de Nissan [20]'],
          ],
        },
      },
      {
        list: [
          'Son datos de las propias empresas; los tres sistemas combinan baterías usadas y nuevas [18–20]',
          'La Agencia Internacional de la Energía (2026) considera que reutilizar baterías de coche para almacenar energía sigue siendo difícil: lo frenan los requisitos de seguridad y garantía, la incertidumbre sobre la vida restante, la bajada de precio de las baterías nuevas y el coste de desmontar y adaptar los paquetes con seguridad [21]',
          'Una batería de arranque soporta de 12 a 15 descargas totales, frente a 150-200 una de ciclo profundo (valores típicos) [22]; en energías renovables, un fabricante indica que solo deben usarse baterías de ciclo profundo [117], y otro la califica de no apta para descargas profundas frecuentes [118]',
        ],
      },
      { h4: 'Transporte de las baterías' },
      {
        table: {
          head: ['Batería', 'Clasificación por carretera', 'Condiciones', 'Fuente'],
          rows: [
            ['Plomo-ácido con electrolito líquido', 'UN 2794, clase 8 (corrosivas), etiqueta 8', 'Usadas que van a reciclaje: no están sujetas al ADR si la carcasa está intacta, van sujetas (por ejemplo, en palés), no tienen restos de ácido por fuera y están protegidas contra cortocircuitos (disposición especial 598)', 'ADR 2025 [7]'],
            ['Paquete de ion-litio de coche, desmontado', 'UN 3480, clase 9, etiqueta 9A', 'Para reciclaje: embalaje P909 y marca «LITHIUM BATTERIES FOR RECYCLING» (disposición especial 377); si está dañado o es defectuoso, embalajes especiales (disposición especial 376)', 'ADR 2025 [7, 8]'],
          ],
        },
      },
      { note: 'UN 3171 solo se aplica a vehículos con baterías de electrolito líquido o de sodio; un coche con baterías de ion-litio instaladas viaja como UN 3556 [7]. Dentro del polígono, los palés sujetos y las tapas en los bornes son buena práctica, no una obligación del ADR. El ADR 2027 se aplica desde el 1-1-2027 y no se ha revisado para esta presentación.' },
      { h4: 'Proceso de reciclaje y fracciones' },
      {
        list: [
          'Preparación: se retira el ácido y se desmontan y separan las partes metálicas y plásticas [119, 120]',
          'Trituración y separación en agua por densidad: pasta de óxidos y sulfatos de plomo, parte metálica (rejillas y bornes), polipropileno, y ebonita con separadores [23]',
          'Fundición en horno rotativo con fundentes y un reductor: se sangra plomo bruto de una pureza aproximada del 98 %, a unos 800 °C [24]',
          'Refino y aleado entre 320 °C y 700 °C para retirar impurezas, y colada en lingotes [25]',
          'El plástico de la carcasa, cerca del 7 % del peso, se separa antes de fundir para recuperarlo [26, 27]; el electrolito puede regenerarse, convertirse en yeso o en sulfato de sodio, o neutralizarse, según la planta [27]',
          'Escoria: del orden de 300 a 350 kg por tonelada de plomo, con alrededor de un 5 % de compuestos de plomo [23]',
        ],
      },
      { p: 'Ejemplo real de fracciones: salidas anuales autorizadas de la planta de reciclado parcial de Pina de Ebro (Zaragoza), según su autorización ambiental de 2022. Son cantidades autorizadas, no medidas [121].' },
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
      { p: 'El Reglamento (UE) 2023/1542 regula la sostenibilidad, la recogida, el tratamiento y el reciclaje de las baterías; está en vigor desde el 17-8-2023 y se aplica desde el 18-2-2024 [12]. EcoBat es un prototipo académico: no sustituye los sistemas oficiales, las autorizaciones ni las obligaciones legales.' },
      { h4: 'Normativa' },
      {
        list: [
          'Pasaporte digital desde el 18-2-2027 para las baterías de vehículos eléctricos, de transporte ligero e industriales de más de 2 kWh; las de arranque de plomo llevan QR, no pasaporte [13]. La ficha de EcoBat es una aplicación voluntaria inspirada en ese pasaporte',
          'A 21-10-2026 siguen sin adoptarse el acto sobre el formato del etiquetado (art. 13.10), con un borrador notificado en diciembre de 2025 [53], y el del acceso a los datos restringidos del pasaporte (art. 77.9), con un borrador del 19-10-2026 [122]',
          'Desde el 18-8-2025, distribuidores y productores deben aceptar gratis las baterías de arranque usadas, sin exigir que se compre otra [12]',
          'La batería de plomo usada es residuo peligroso (16 06 01*). Desde el 9-12-2026, ese código se llama «residuos de pilas y baterías de plomo y ácido», según la Decisión Delegada (UE) 2025/934 y su corrección de errores [123, 124]',
          'En España sigue vigente el Real Decreto 106/2008; el proyecto de real decreto que lo sustituirá estuvo en información pública del 30-6 al 3-9-2026 [73, 125]',
          'Quien prepara para la reutilización, adapta o remanufactura una batería y la introduce en el mercado se considera fabricante a efectos del Reglamento (UE) 2023/1542 (art. 38.11), con una evaluación de la conformidad adicional [12]',
          'Una batería con pasaporte que se adapta o remanufactura recibe un pasaporte nuevo vinculado al original, y la responsabilidad pasa a quien la vuelve a introducir en el mercado (art. 77.7) [12]',
          'Contenido reciclado: desde el 18-8-2031, las baterías de arranque, de vehículo eléctrico e industriales de más de 2 kWh deberán acreditar al menos un 85 % de plomo valorizado de residuos (art. 8.2) [12]. La documentación previa se exige desde el 18-8-2028 o 24 meses después del acto delegado del método de cálculo, si es posterior; a 23-10-2026 ese acto no consta adoptado',
        ],
      },
      { h4: 'Obligaciones de los talleres que entregan las baterías (España)' },
      {
        list: [
          'Guardar las baterías usadas en una zona identificada, protegida de la intemperie y con retención de derrames, seis meses como máximo y sin mezclarlas con otros residuos [15]',
          'Etiquetar los envases con el código y la descripción del residuo, el NIMA, los datos del productor, la fecha de inicio del depósito y los pictogramas, en una etiqueta de al menos 10 × 10 cm [15]',
          'Presentar comunicación previa a la comunidad autónoma, llevar un archivo cronológico durante al menos cinco años y enviar la memoria anual antes del 1 de marzo [15]',
          'En traslados a otra comunidad autónoma: contrato de tratamiento con el gestor de destino, documento de identificación y notificación previa al menos diez días antes [126]',
          'Entregar residuos peligrosos a quien no esté habilitado es infracción muy grave, con multas de 600.001 € a 3.500.000 € [15]',
        ],
      },
      { h4: 'Seguridad' },
      {
        list: [
          'La aplicación no toma decisiones de seguridad por sí sola',
          'No abrir baterías ni manipular electrolitos: el ácido es corrosivo y la carga desprende hidrógeno (pestaña Datos)',
          'Al probar una batería: ventilación, protección de ojos, cara y manos, sin chispas ni llamas, y desconectar primero el cable negativo [10]',
          'Baterías dañadas, con fugas o de química desconocida: derivación especializada; las que pierden electrolito van en recipientes resistentes al ácido y sin vaciarlas [127]',
          'Sin pruebas de alta tensión en baterías de vehículos eléctricos sin personal cualificado y equipos especializados [17]',
          'Desmontaje de baterías de coche eléctrico: personal cualificado [16, 17]; una guía de prevención indica guantes dieléctricos UNE-EN 60903 (clase 0), pantalla facial frente al arco eléctrico, ropa y calzado de protección y herramientas aisladas [16]',
          'Manipular baterías de plomo con fugas: gafas de protección, guantes resistentes a productos químicos y ropa y botas resistentes al ácido, según la ficha de seguridad del fabricante [89]',
          'Junto al horno de fundición: protección respiratoria frente a humos de plomo, pantalla facial y ropa que proteja de las proyecciones de metal fundido y de la radiación infrarroja [24]',
          'Solo los datos necesarios, con permisos de acceso y copias de seguridad [44]',
        ],
      },
      { h4: 'Limitaciones reconocidas' },
      {
        list: [
          'El software no recicla físicamente los materiales: mejora la información y la coordinación',
          'Datos incompletos: se permite «desconocido» y una evaluación adicional',
          'Diagnósticos: validación técnica y equipos apropiados',
          'Una batería de arranque agotada no sirve para almacenar energía solar: no está diseñada para descargas profundas y soporta de 12 a 15 ciclos de descarga total, frente a 150-200 una de ciclo profundo [22]. La segunda vida documentada es la de baterías de ion-litio de coches eléctricos, y depende de pruebas específicas: para que un residuo de batería adaptado deje de ser residuo hay que acreditar, entre otras cosas, una evaluación de su estado de salud (art. 73) [12, 18–21]',
          'Reutilización, remanufacturación, segunda vida y reciclaje son rutas distintas: el recorrido no las suma ni las cuenta dos veces',
          'El mundo 3D representa las instalaciones de un gestor de baterías que recibe las baterías ya sueltas de muchos talleres y desguaces de la ciudad; no reproduce ninguna instalación real',
          'Las personas del mundo 3D llevan ropa y protección ilustrativas; solo las de las zonas de alta tensión, ácido y horno siguen una fuente (apartado Seguridad)',
          'Los datos se consultaron entre el 21 y el 23 de octubre de 2026; los actos de la UE pendientes, el ADR 2027 y el real decreto español pueden cambiar',
        ],
      },
    ],
  },
  {
    id: 'fuentes',
    label: 'Fuentes',
    title: 'Fuentes y créditos',
    blocks: [
      { p: 'Fuentes citadas en la presentación, numeradas por orden de aparición (tarjetas de datos de los capítulos y anexos) y agrupadas por tipo. Se consultaron entre el 21 y el 23 de octubre de 2026; los precios y las normas en tramitación pueden cambiar.' },
      { sources: true },
      { p: 'La arquitectura, el calendario de ocho semanas, las partidas del presupuesto y los indicadores son decisiones del equipo. El informe de la investigación, con los hechos verificados y su fuente, está en la carpeta docs/investigacion del repositorio del proyecto.' },
      { h4: 'Qué es real y qué es ejemplo en las pantallas 3D' },
      {
        list: [
          'Son ejemplos del prototipo, no mediciones, y las pantallas con cifras los rotulan como tales: el código ECB-0427, su ficha digital y sus fechas, el lote 0147, las lecturas de prueba, los contadores, los recuentos 2/1/7 del capítulo 3, los módulos del paquete del desmontaje y el almacenamiento de segunda vida; las curvas y gráficos sin cifras son ilustrativos',
          'Sus valores son coherentes con los de referencia de la pestaña Datos: el lote 0147 pesa 324 kg porque son 18 baterías de 18 kg, la batería europea de referencia [90]; 12,6 V tras 24 h de reposo corresponde a una batería inundada cargada [9–11], y la prueba de carga no se supera si la tensión cae por debajo de unos 9,6 V [10, 92]',
          'Son datos reales la tensión nominal de 12 V [23, 91], la composición típica en masa de las barras del reciclaje (plomo 60 %, electrolito 30 % y plástico 7 %, aproximados; el 3 % restante no se desglosa) [26, 86] y el sulfato de sodio como producto del electrolito [27]; en el depósito, el código de residuo 16 06 01* [15, 109] y la clasificación de transporte UN 2794 [7]; en la ficha del laboratorio, el QR obligatorio desde el 18-2-2027 (art. 13.6) [12], y en el centro, el pasaporte nuevo de las baterías adaptadas o remanufacturadas (art. 77.7) [12]',
          '«Pasaporte EcoBat» es el nombre de la ficha del prototipo; no es el pasaporte para baterías del Reglamento (UE) 2023/1542, y las baterías de arranque no están entre las categorías que deben llevarlo [13]',
          'Los QR de las baterías del mundo son decorativos; las placas de alta tensión y el rombo de mercancías peligrosas del embalaje son señales ilustrativas, sin marcas',
        ],
      },
      { h4: 'Créditos de la presentación' },
      {
        list: [
          'Mundo 3D modelado en tiempo real con Three.js; cámara con GSAP ScrollTrigger',
          'Tipografía Archivo (SIL Open Font License)',
          'Las referencias visuales de la primera versión (panorámica, batería, taller, laboratorio, cruce, reciclaje, centro y borde de isla) se generaron con IA mediante Codex; son conceptuales y no muestran instalaciones reales',
          'En esta versión el polígono es un gestor de baterías: recibe dos tipos de batería, de arranque de plomo y de coche eléctrico, ya sueltas desde los talleres y desguaces de la ciudad, y el antiguo taller con coche es ahora la nave de reutilización',
          'Personas, vehículos, edificios y materiales PBR del mundo 3D (hormigón, roca, metal, plástico, caucho) generados por código; sin texturas ni modelos externos',
        ],
      },
    ],
  },
];
