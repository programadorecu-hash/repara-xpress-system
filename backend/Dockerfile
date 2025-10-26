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

# 5) Exponemos el puerto del API
EXPOSE 8000

# 6) Comando por defecto (compose puede sobreescribir con --reload)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
