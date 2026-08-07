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

# Orden real de ejecución (verificado contra una base de datos limpia): NO es el orden
# numérico literal. 09_estudiante_usuario.sql debe correr antes que 07_usuario_username.sql
# pese a que 09 se numeró después — 09 solo depende de 01-04/06, no de 07/08. Todos los
# scripts de este bloque son estructurales (tablas, triggers, funciones) y no contienen
# credenciales de personas reales, así que es seguro automatizarlos en cualquier entorno.
echo "Ejecutando scripts de esquema, roles y todos los módulos (estructural, sin credenciales reales)..."
for script in \
  01_schema.sql 02_indices.sql 03_auditoria.sql 04_roles_bd.sql \
  06_matricula_campos.sql 09_estudiante_usuario.sql \
  12_indice_check_pagos.sql 13_particion_auditoria_automatica.sql \
  14_notificaciones.sql 15_deberes.sql 16_pagos_transferencia.sql \
  17_pago_asunto.sql 18_rubros_motivos_pago.sql 19_tarea_parcial.sql \
  20_recursos_academicos.sql 21_entrega_tarea_nota.sql 22_audit_notificacion.sql \
  23_indice_asistencia_dashboard.sql; do
  echo "  -> $script"
  psql -d "$DB_NAME" -f "$SCRIPT_DIR/$script"
done

echo ""
echo "Base de datos estructural inicializada (19 scripts). Quedan pendientes de tu decisión,"
echo "en este orden si los ejecutas, porque contienen datos de prueba o cuentas de personas reales:"
echo ""
echo "  Solo desarrollo (datos ficticios, NO producción):"
echo "    psql -d $DB_NAME -f $SCRIPT_DIR/05_datos_prueba.sql"
echo "    psql -d $DB_NAME -f $SCRIPT_DIR/11_fix_usernames_demo.sql   # repara username de las cuentas de 05"
echo "    psql -d $DB_NAME -f $SCRIPT_DIR/08_usuario_aaron.sql        # representante de prueba adicional"
echo "    psql -d $DB_NAME -f $SCRIPT_DIR/24_usuario_dece_demo.sql    # cuenta DECE de prueba (rol sin cuenta demo previa)"
echo ""
echo "  Cuentas de personal reales (ejecutar manualmente una sola vez, credenciales reales embebidas):"
echo "    psql -d $DB_NAME -f $SCRIPT_DIR/07_usuario_username.sql"
echo "    psql -d $DB_NAME -f $SCRIPT_DIR/10_asignacion_saida_historia.sql   # requiere 07 (crea a Saida)"
echo ""
echo "Asegúrate de definir las variables de entorno antes de arrancar el backend:"
echo "  export SAGAB_DB_USER=sagab_app"
echo "  export SAGAB_DB_PASSWORD='CAMBIAR_EN_PRODUCCION_app'   # o la que hayas puesto en 04_roles_bd.sql"
echo "  export SAGAB_JWT_SECRET=\"\$(openssl rand -base64 48)\""
echo ""
echo "Luego ejecuta desde backend: mvn spring-boot:run"
