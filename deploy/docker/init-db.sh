#!/bin/sh
set -eu

SAGAB_SQL_DIR="${SAGAB_SQL_DIR:-/database}"

# Orden verificado de dependencias del esquema. PostgreSQL ejecuta este archivo únicamente al
# crear el volumen por primera vez; los reinicios posteriores conservan la base existente.
for script in \
  01_schema.sql 02_indices.sql 03_auditoria.sql 04_roles_bd.sql \
  06_matricula_campos.sql 09_estudiante_usuario.sql \
  12_indice_check_pagos.sql 13_particion_auditoria_automatica.sql \
  14_notificaciones.sql 15_deberes.sql 16_pagos_transferencia.sql \
  17_pago_asunto.sql 32_catalogo_academico_2025_2026.sql \
  18_rubros_motivos_pago.sql 19_tarea_parcial.sql \
  20_recursos_academicos.sql 21_entrega_tarea_nota.sql 22_audit_notificacion.sql \
  23_indice_asistencia_dashboard.sql 25_notificacion_generica.sql \
  26_recursos_clase_semanal.sql 27_tarea_puntaje_adjuntos.sql \
  28_calendario_institucional.sql 29_seguimiento_dece.sql \
  30_reparar_rol_estudiante.sql 31_super_admin_gestion_cuentas.sql
do
  echo "Inicializando SAGAB: $script"
  psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --file "$SAGAB_SQL_DIR/$script"
done
