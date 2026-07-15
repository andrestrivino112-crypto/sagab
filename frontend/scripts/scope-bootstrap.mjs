// Genera src/styles/bootstrap-scoped.css: Bootstrap 5 con todos sus selectores
// prefijados a ".matricula-form" para que nunca afecte al resto de la app,
// sin importar orden de carga ni cascade layers de Tailwind.
// Volver a ejecutar tras actualizar la dependencia "bootstrap": node scripts/scope-bootstrap.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import prefixSelector from "postcss-prefix-selector";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const inputPath = path.join(root, "node_modules/bootstrap/dist/css/bootstrap.min.css");
const outputPath = path.join(root, "src/styles/bootstrap-scoped.css");

const PREFIX = ".matricula-form";
const input = fs.readFileSync(inputPath, "utf8");

const result = postcss([
  prefixSelector({
    prefix: PREFIX,
    transform(prefix, selector, prefixedSelector) {
      if (selector === ":root") return prefix;
      if (selector.startsWith(":root")) return prefix + selector.slice(":root".length);
      return prefixedSelector;
    },
  }),
]).process(input, { from: inputPath, to: outputPath }).css;

// Este archivo se concatena vía @import dentro de index.css, donde @charset no
// puede aparecer (debe ser la primera regla del documento final); el HTML ya
// declara UTF-8 globalmente, así que lo quitamos para evitar el warning de PostCSS.
const withoutCharset = result.replace(/^@charset[^;]*;\s*/, "");
const banner = `/* Auto-generado por scripts/scope-bootstrap.mjs — NO editar a mano.\n   Bootstrap 5 con selectores prefijados a "${PREFIX}". */\n`;
fs.writeFileSync(outputPath, banner + withoutCharset);
console.log(`bootstrap-scoped.css generado (${(result.length / 1024).toFixed(0)} KB)`);
