// Índices de los capítulos del recorrido (story.index en world.update). 0 es la portada y el último, el cierre.
// Las estaciones deciden cuándo animarse con estos nombres, nunca con números sueltos.
export const CH = {
  portada: 0,
  recogida: 1,
  identificacion: 2, // identificación y diagnóstico (laboratorio)
  clasificacion: 3, // cruce
  reutilizacion: 4, // nave de reutilización (antiguo taller, isla s2)
  desmontaje: 5, // baterías de coche eléctrico (isla sB)
  segundaVida: 6, // almacenamiento estacionario (isla sA)
  reciclaje: 7, // gestor de plomo-ácido (isla s5)
  trazabilidad: 8, // centro con el pasaporte (isla s6)
  cierre: 9,
};
