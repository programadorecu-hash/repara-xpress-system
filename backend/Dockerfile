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

# 4) ¡¡AQUÍ ESTÁ EL ARREGLO!!
#    Copiamos los "planos" (Alembic) ANTES que el resto de la app.
COPY alembic.ini .
COPY alembic ./alembic

# 5) Copia el código de la app
COPY app ./app

# 6) Copiamos nuestro script de arranque
COPY start.sh .
#    Le damos permisos de "ejecución"
RUN chmod +x ./start.sh

# 7) Creamos la carpeta de uploads
RUN mkdir uploads

# 8) Exponemos el puerto del API
EXPOSE 8000

# 9) ¡EL NUEVO COMANDO DE INICIO!
#    Simplemente le decimos que ejecute nuestro script.
CMD ["./start.sh"]