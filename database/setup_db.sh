#!/usr/bin/env bash
set -euo pipefail

DB_NAME="sagab"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v psql >/dev/null 2>&1 || {
  echo "ERROR: psql no está instalado o no está en PATH." >&2
  exit 1
}

if ! psql -lqt | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
  echo "Creando base de datos '$DB_NAME'..."
  createdb "$DB_NAME"
else
  echo "Base de datos '$DB_NAME' ya existe."
fi

echo "Ejecutando scripts de esquema y roles..."
for script in 01_schema.sql 02_indices.sql 03_auditoria.sql 04_roles_bd.sql 06_matricula_campos.sql 09_estudiante_usuario.sql; do
  echo "  -> $script"
  psql -d "$DB_NAME" -f "$SCRIPT_DIR/$script"
done

echo "Si necesitas datos de desarrollo, ejecuta:"
echo "  psql -d $DB_NAME -f $SCRIPT_DIR/05_datos_prueba.sql"
echo "Cuentas de personal iniciales (usuario/contraseña reales, ejecutar manualmente una sola vez):"
echo "  psql -d $DB_NAME -f $SCRIPT_DIR/07_usuario_username.sql"
echo "  psql -d $DB_NAME -f $SCRIPT_DIR/08_usuario_aaron.sql"

echo "Base de datos inicializada. Asegúrate de definir las variables de entorno:" 

echo "  export SAGAB_DB_USER=sagab_app"
echo "  export SAGAB_DB_PASSWORD='CAMBIAR_EN_PRODUCCION_app'"

echo "Luego ejecuta desde backend: mvn spring-boot:run"
