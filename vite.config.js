import { defineConfig } from 'vite';

// Rutas relativas: el build funciona en GitHub Pages (subcarpeta del repositorio) y abierto en local.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    // El anexo con datos reales y más de cien fuentes añade unos 65 kB de texto al único chunk (main.js importa
    // content.js de forma estática). La v2 suma unos 40 kB de código del mundo (personas, vehículos y entorno del
    // polígono); el margen sigue avisando si crece más.
    chunkSizeWarningLimit: 1400,
  },
});
