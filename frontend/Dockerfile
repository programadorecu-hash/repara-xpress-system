# frontend/Dockerfile
FROM node:20-alpine

# 1) Carpeta de trabajo
WORKDIR /app

# 2) Copiamos package.json y lockfiles primero (cache de dependencias)
COPY package*.json ./

# 3) Instala dependencias. Forzamos la instalación aunque haya conflictos de versiones menores (como React 18 vs 19)
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

# 4) Copiamos el resto del código
COPY . .

# 5) Variables para Vite dev server
ENV HOST=0.0.0.0
ENV PORT=5173

# 6) Exponemos el puerto
EXPOSE 5173

# 7) Arrancamos Vite en modo dev, escuchando en 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

