// Contenido de la presentación. Fuente: context/Proyecto de sostenibilidad informática_ EcoBat.docx
// Las cifras de ejemplo del documento son hipotéticas y se etiquetan como tales.

export const SITE_URL = 'https://laos23.github.io/ecobat-presentacion/';

export const intro = {
  title: 'EcoBat',
  tagline: 'Una batería. Más de una vida.',
  lede: 'Gestión, reutilización y reciclaje de baterías de coche, con trazabilidad digital.',
  note: 'Proyecto académico de sostenibilidad informática',
};

export const chapters = [
  {
    id: 'recogida',
    label: 'Recogida',
    title: '¿Aquí termina todo?',
    body: 'Una batería usada contiene plomo, ácido y materiales valiosos. Necesita una gestión adecuada, no un vertedero.',
  },
  {
    id: 'taller',
    label: 'Identificación',
    title: 'Ahora tiene historia.',
    body: 'Un código QR vincula cada batería a su ficha digital: tipo, entrada, procedencia y estado. Sin datos personales.',
  },
  {
    id: 'diagnostico',
    label: 'Diagnóstico',
    title: 'Medir antes de decidir.',
    body: 'Un técnico hace las pruebas adecuadas a cada química y registra los resultados. Los datos fundamentan la decisión.',
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
    simulation: 'Simulación hipotética con 10 baterías, no son resultados reales',
  },
  {
    id: 'reciclaje',
    label: 'Reciclaje',
    title: 'Los materiales siguen.',
    body: 'Un gestor autorizado recupera los materiales. EcoBat registra la entrega y su destino documentado.',
  },
  {
    id: 'trazabilidad',
    label: 'Trazabilidad',
    title: 'Todo queda conectado.',
    body: 'La informática conserva el historial de cada batería y permite medir la gestión.',
    passport: ['Registro y QR', 'Diagnóstico', 'Ruta validada', 'Destino documentado'],
  },
];

export const closing = {
  title: 'Conocer su estado. Documentar su destino.',
  body: 'Antes de desechar una batería, hay que conocer su estado. Cuando ya no pueda aprovecharse de forma segura, hay que asegurar que llegue al circuito de reciclaje adecuado.',
};

export const annex = [
  {
    id: 'arquitectura',
    label: 'Arquitectura',
    title: 'Arquitectura propuesta del prototipo',
    intro: 'Primera versión: aplicación web con base de datos y panel de control, sin hardware complejo. Tecnologías orientativas; se podría usar Java, PHP o MySQL.',
    table: {
      head: ['Componente', 'Tecnología', 'Función'],
      rows: [
        ['Interfaz web', 'HTML, CSS y JavaScript', 'Formularios, fichas y estadísticas'],
        ['Aplicación', 'Python con Flask', 'Lógica del sistema'],
        ['Base de datos', 'SQLite', 'Baterías, pruebas y movimientos'],
        ['Identificación', 'Códigos QR', 'Acceso a la ficha de cada batería'],
        ['Visualización', 'Chart.js', 'Gráficos de sostenibilidad'],
        ['Alojamiento', 'Ordenador local o servidor web', 'Acceso a la aplicación'],
      ],
    },
    lists: [
      {
        title: 'Tablas principales',
        items: [
          'Baterías: id, código QR, tipo, fabricante, fecha de fabricación si se conoce, recepción, estado actual',
          'Diagnósticos: id, batería, fecha, tensión, capacidad estimada según el tipo, resultado, técnico',
          'Movimientos: id, batería, fecha, origen, destino, tipo de movimiento, justificante',
          'Entidades: talleres, puntos de recogida y gestores, con autorización cuando corresponda',
        ],
      },
      {
        title: 'Pantallas de la primera versión',
        items: ['Inicio', 'Registrar batería', 'Consultar batería por QR', 'Registrar diagnóstico', 'Gestionar destino', 'Panel ambiental'],
      },
    ],
  },
  {
    id: 'calendario',
    label: 'Calendario',
    title: 'Plan de desarrollo: ocho semanas',
    timeline: [
      ['Semana 1', 'Análisis y planificación', 'Investigar el problema, definir requisitos y delimitar el tipo de baterías.'],
      ['Semana 2', 'Diseño de la base de datos', 'Modelo de datos, tablas y relaciones.'],
      ['Semanas 3–4', 'Desarrollo de la interfaz', 'Formularios de registro, consulta y diagnóstico.'],
      ['Semana 5', 'Implementación de la lógica', 'Reglas de clasificación y registro de movimientos.'],
      ['Semana 6', 'Códigos QR y estadísticas', 'Identificadores y panel de control.'],
      ['Semana 7', 'Pruebas y evaluación', 'Formularios, permisos, integridad de datos e indicadores.'],
      ['Semana 8', 'Memoria y presentación', 'Resultados, limitaciones y mejoras futuras.'],
    ],
    intro: 'Equipo de dos o tres personas: base de datos y servidor, interfaz web, y pruebas con documentación y análisis ambiental.',
  },
  {
    id: 'presupuesto',
    label: 'Presupuesto',
    title: 'Presupuesto orientativo del prototipo',
    table: {
      head: ['Recurso', 'Coste estimado'],
      rows: [
        ['Python, Flask, SQLite y herramientas libres', '0 €'],
        ['Ordenador existente', '0 € adicionales'],
        ['Generación e impresión de códigos QR', '10–30 €'],
        ['Alojamiento web opcional', '0–60 €'],
        ['Material de presentación y documentación', '10–30 €'],
        ['Total orientativo', '20–120 €'],
      ],
    },
    intro: 'Estimaciones de planificación, no precios comerciales verificados. No incluyen equipos profesionales de diagnóstico, baterías, transporte de residuos, seguros ni instalaciones de tratamiento.',
  },
  {
    id: 'indicadores',
    label: 'Indicadores',
    title: 'Cómo se mediría el resultado',
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
    example: {
      label: 'Ejemplo hipotético',
      text: 'Un piloto con 100 baterías registradas y 90 con destino documentado daría una trazabilidad del 90 %. No demostraría, por sí solo, una reducción del 90 % del impacto ambiental.',
    },
    intro: 'Actividad no es impacto: registrar cien baterías no significa haber evitado cien residuos, y una batería reciclada no se cuenta también como reutilizada.',
  },
  {
    id: 'ods',
    label: 'ODS',
    title: 'Objetivos de Desarrollo Sostenible',
    goals: [
      ['12', 'Producción y consumo responsables', 'Reducción de residuos, gestión de materiales peligrosos y aprovechamiento mediante reparación, reutilización y reciclaje.'],
      ['13', 'Acción por el clima', 'Una mejor gestión puede contribuir a reducir impactos asociados a fabricar baterías nuevas; la reducción debe medirse, no darse por supuesta.'],
      ['9', 'Industria, innovación e infraestructura', 'Tecnologías digitales para mejorar mantenimiento, recuperación de materiales y gestión de residuos industriales.'],
    ],
  },
  {
    id: 'limites',
    label: 'Límites',
    title: 'Normativa, seguridad y limitaciones',
    intro: 'El Reglamento (UE) 2023/1542 regula sostenibilidad, recogida, tratamiento y reciclaje de baterías, y prevé el pasaporte digital para ciertas categorías, incluidas las de vehículos eléctricos, desde el 18 de febrero de 2027. EcoBat es un prototipo académico: no sustituye los sistemas oficiales, las autorizaciones ni las obligaciones legales.',
    lists: [
      {
        title: 'Seguridad',
        items: [
          'La aplicación no toma decisiones de seguridad por sí sola',
          'No abrir baterías ni manipular electrolitos',
          'Sin pruebas de alta tensión en baterías de eléctricos sin personal y equipos especializados',
          'Baterías dañadas, con fugas o de química desconocida: derivación especializada',
          'Sin datos personales innecesarios; permisos y copias de seguridad',
        ],
      },
      {
        title: 'Limitaciones reconocidas',
        items: [
          'El software no recicla físicamente los materiales: mejora información y coordinación',
          'Datos incompletos: se permite «desconocido» y evaluación adicional',
          'Diagnósticos: validación técnica y equipos apropiados',
          'Una batería de arranque agotada no sirve directamente para almacenar energía solar',
        ],
      },
    ],
  },
  {
    id: 'fuentes',
    label: 'Fuentes',
    title: 'Fuentes y créditos',
    links: [
      ['Comisión Europea. Batteries, Environment', 'https://environment.ec.europa.eu/topics/waste-and-recycling/batteries_en'],
      ['Reglamento (UE) 2023/1542 relativo a las pilas y baterías y sus residuos', 'https://eur-lex.europa.eu/eli/reg/2023/1542/oj'],
    ],
    intro: 'La arquitectura, el calendario y el presupuesto son decisiones de diseño del proyecto, no datos extraídos de estas fuentes.',
    lists: [
      {
        title: 'Créditos de la presentación',
        items: [
          'Mundo 3D modelado en tiempo real con Three.js; cámara con GSAP ScrollTrigger',
          'Tipografía Archivo (SIL Open Font License)',
          'Las referencias visuales (panorámica, batería, taller, laboratorio, cruce, reciclaje, centro y borde de isla) se generaron con IA mediante Codex; son conceptuales y no muestran instalaciones reales',
          'Materiales PBR del mundo 3D (hormigón, roca, metal, plástico, caucho) generados por código; sin texturas ni modelos externos',
          'Los QR de las baterías del mundo son decorativos',
        ],
      },
    ],
  },
];
