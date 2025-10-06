import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Leemos la variable de entorno que definimos en docker-compose
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Creamos el "motor" de SQLAlchemy. Es el punto de entrada a la base de datos.
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Creamos una "Sesión". Cada sesión es una conversación con la base de datos.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Creamos una clase "Base". Nuestros modelos de la base de datos heredarán de esta clase.
Base = declarative_base()

# Esta función se encarga de las sesiones de la base de datos.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()