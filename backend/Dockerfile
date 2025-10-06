# Usamos una imagen oficial de Python como base.
FROM python:3.11-slim

# --- CAMBIO AQUÍ ---
# Establecemos un directorio de trabajo más genérico, como '/code'.
WORKDIR /code

# Copiamos primero el archivo de dependencias.
COPY requirements.txt .

# Instalamos las dependencias.
RUN pip install --no-cache-dir -r requirements.txt

# --- CAMBIO AQUÍ ---
# Copiamos nuestra carpeta local 'app' DENTRO de '/code'.
# Ahora la estructura interna será /code/app/main.py, lo cual es más claro.
COPY ./app ./app

# El comando que se ejecutará cuando el contenedor inicie.
# Este comando ahora funcionará porque se ejecuta desde /code y puede "ver" la carpeta 'app'.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]