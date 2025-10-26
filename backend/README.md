# Migraciones de base de datos

Este proyecto usa [Alembic](https://alembic.sqlalchemy.org/) para gestionar los cambios de esquema. El historial se mantiene **lineal**, por lo que cada nueva migración debe apuntar al `head` existente y evitar merges vacíos.

## Orden actual
Las últimas revisiones quedan encadenadas en este orden:

1. `52c5a276a25a` – Añadir campos detallados y fotos a órdenes de trabajo.
2. `0acfba2a2698` – Marcar `work_orders.customer_declined_check` como `NOT NULL`.
3. `0866cb4978c7` – Añadir la información de cliente a `sales` y retirar `work_order_notes`.
4. `1d64c9b6c9d0` – Agregar `customer_email` en `work_orders`.
5. `92d2f21907fd` – Forzar que los datos de cliente en `sales` sean obligatorios.

Usa `alembic history --verbose` para revisar el resto de la cadena si es necesario.

## Variables de entorno requeridas

- `DATABASE_URL`: cadena de conexión usada por SQLAlchemy y Alembic.
- `SECRET_KEY`: clave criptográfica para firmar los JWT. Debe ser una cadena larga y aleatoria.

## Generar nuevas migraciones
1. Asegúrate de que el contenedor de base de datos esté disponible y que la variable `sqlalchemy.url` de `alembic.ini` sea alcanzable.
2. Arranca desde una base sincronizada: `alembic upgrade head`.
3. Realiza tus cambios en los modelos de SQLAlchemy (`app/models`).
4. Crea la migración desde este directorio:
   ```bash
   alembic revision --autogenerate -m "Descripción del cambio" --head head
   ```
5. Revisa el script generado; ajusta el orden de las operaciones o los parámetros si es necesario.
6. Ejecuta `alembic upgrade head` para validar la migración y, si aplica, `alembic downgrade -1` para comprobar la reversión.

## Política para evitar merges vacíos
- Siempre apunta tu migración al `head` actual actualizando el campo `down_revision`.
- Si dos desarrolladores trabajan en paralelo, coordina para reordenar los `down_revision` antes de fusionar cambios.
- Solo crea revisiones de merge cuando existan diferencias reales entre ramas y el script contenga las operaciones necesarias para reconciliarlas.
- Usa `alembic heads` para confirmar que únicamente existe un `head` antes de fusionar al repositorio principal.

Seguir este flujo evita bifurcaciones divergentes y garantiza migraciones reproducibles desde un checkout limpio.
