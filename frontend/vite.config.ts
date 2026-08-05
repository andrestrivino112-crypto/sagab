import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Desactivado: un sourcemap en el build de producción expone el código fuente legible
    // del bundle público e infla el tamaño del despliegue (ver INFORME_AUDITORIA.md, hallazgo #11).
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-charts': ['recharts'],
          'vendor-daypicker': ['react-day-picker'],
        },
      },
    },
    modulePreload: {
      // vendor-charts / vendor-daypicker solo se usan detrás de React.lazy() (Dashboard/Matrícula):
      // no deben precargarse en el <head> de cada página (p. ej. login), o compiten por ancho de
      // banda con el chunk crítico inicial bajo redes lentas.
      resolveDependencies: (_filename, deps) =>
        deps.filter(d => !d.includes('vendor-charts') && !d.includes('vendor-daypicker')),
    },
  },
})
