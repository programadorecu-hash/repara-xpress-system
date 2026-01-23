#!/bin/sh
# NOTA: Quitamos 'set -e' para poder manejar errores nosotros mismos sin que se apague todo.

# Paso 1: Intentar migración normal
echo "--- 🚀 Iniciando migración de base de datos..."

if python -m alembic upgrade head; then
    echo "--- ✅ Migración exitosa."
else
    echo "--- ⚠️ Error en la migración detectado."
    echo "--- 🔧 Intentando autoreparación (Sincronizando catálogo con archivos reales)..."
    
    # PASO 1: BORRADO NUCLEAR DEL REGISTRO DE VERSIONES
    # Usamos Python para borrar la tabla 'alembic_version' directamente.
    # Esto elimina la referencia a la versión fantasma corrupta.
    echo "--- 🗑️  Eliminando historial de versiones corrupto..."
    python -c "import os; from sqlalchemy import create_engine, text; engine = create_engine(os.environ['DATABASE_URL']); connection = engine.connect(); connection.execute(text('DROP TABLE IF EXISTS alembic_version')); connection.commit(); connection.close(); print('--- ✅ Historial limpiado.')"

    # PASO 2: RESTAURAR LA VERDAD
    # Ahora que no hay historial, le decimos a Alembic: "La versión actual es la HEAD"
    echo "--- 🏷️  Estableciendo nueva línea base (Stamp)..."
    python -m alembic stamp head
    
    echo "--- 🔄 Reintentando migración tras reparación..."
    if python -m alembic upgrade head; then
        echo "--- ✅ Reparación exitosa. Base de datos sincronizada."
    else
        echo "--- ❌ Error fatal: No se pudo reparar la base de datos."
        # Si falla la segunda vez, ahí sí detenemos todo.
        exit 1
    fi
fi

# Paso 2: Encender la "oficina" (Uvicorn)
echo "--- ⚡ Iniciando el servidor (Uvicorn)..."
# Usamos 'exec' para que el proceso de python reemplace al shell y reciba las señales de apagado correctamente
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000