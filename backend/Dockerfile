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

# 4) Copia el código
COPY app ./app

# 5) ¡AQUÍ ESTÁ LA NUEVA PARTE!
#    Copiamos nuestro script de arranque
COPY start.sh .
#    Le damos permisos de "ejecución"
RUN chmod +x ./start.sh

# 6) Creamos la carpeta de uploads
RUN mkdir uploads

# 7) Exponemos el puerto del API
EXPOSE 8000

# 8) ¡EL NUEVO COMANDO DE INICIO!
#    Simplemente le decimos que ejecute nuestro script.
CMD ["./start.sh"]