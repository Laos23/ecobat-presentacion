import { defineConfig } from 'vite';

// Rutas relativas: el build funciona en GitHub Pages (subcarpeta del repositorio) y abierto en local.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    // El anexo con datos reales y 120 fuentes añade unos 65 kB de texto al único chunk (main.js importa content.js
    // de forma estática); el margen sigue avisando si crece el código del mundo 3D.
    chunkSizeWarningLimit: 1300,
  },
});
