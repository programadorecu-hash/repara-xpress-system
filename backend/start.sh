#!/bin/sh
set -e # ¡ESTA ES LA LÍNEA MÁGICA! Significa "¡Detente si algo falla!"

# Paso 1: Llamar al "constructor de estantes" (Alembic)
echo "--- Iniciando migración de la base de datos (Alembic)..."
python -m alembic upgrade head

# Paso 2: Encender la "oficina" (Uvicorn)
echo "--- Migración completa. Iniciando el servidor (Uvicorn)..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000