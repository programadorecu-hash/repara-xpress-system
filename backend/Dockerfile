# backend/Dockerfile
FROM python:3.11-slim

# 1) Ajustes útiles de Python en contenedor
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 2) Carpeta de trabajo
WORKDIR /code

# 3) Instala dependencias antes (mejor cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4) Copia el código (luego el volumen de compose lo sobre-monta para hot-reload)
COPY app ./app

# 5) ¡AQUÍ ESTÁ EL ARREGLO!
#    Le decimos a Docker que cree la carpeta "uploads" que el script app/main.py necesita.
RUN mkdir uploads

# 6) Exponemos el puerto del API
EXPOSE 8000

# 7) ¡¡AQUÍ ESTÁ LA SOLUCIÓN DEFINITIVA!!
#    Cambiamos el comando de inicio para que sea un shell
#    que PRIMERO ejecute alembic y LUEGO ejecute uvicorn.
CMD ["/bin/sh", "-c", "python -m alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"]