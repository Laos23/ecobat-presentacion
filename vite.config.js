import { defineConfig } from 'vite';

// Rutas relativas: el build funciona en GitHub Pages (subcarpeta del repositorio) y abierto en local.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
