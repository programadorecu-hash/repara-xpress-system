# EN backend/app/security.py

import os
from typing import List
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session


# Importamos las herramientas que necesitamos
from . import crud, schemas
from .database import get_db

# --- Configuración de Seguridad ---
SECRET_KEY = os.getenv("SECRET_KEY", "solo-dev_cambia_esto")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Funciones de Contraseña ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# --- Funciones de Token JWT ---
def create_access_token(data: dict):
    """
    Crea una 'llave digital' (Token) con fecha de caducidad.
    data: Diccionario con info del usuario (email, rol, company_id).
    """
    to_encode = data.copy()
    
    # 1. Definimos cuándo caduca la llave
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # 2. Convertimos todo a texto si es necesario (seguridad extra)
    # Por ejemplo, aseguramos que company_id sea un número o string válido
    if "company_id" in to_encode and to_encode["company_id"] is not None:
        to_encode["company_id"] = str(to_encode["company_id"])

    # 3. Sellamos la llave con nuestra firma secreta
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- EL VIGILANTE Y SU CONFIGURACIÓN ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Error estándar para intrusos
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # 1. Intentamos leer la 'pulsera' (Token)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 2. Buscamos el nombre del dueño (email)
        email: str = payload.get("sub")
        
        # 3. Validamos que la pulsera tenga dueño
        if email is None:
            raise credentials_exception
            
    except JWTError:
        # Si la firma es falsa o expiró, lanzamos alerta
        raise credentials_exception

    # 4. Buscamos al dueño en el registro real (Base de Datos)
    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception

    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario está deshabilitado"
        )

    # --- NUEVO: Validar si la Empresa está activa (SaaS) ---
    # Si el usuario pertenece a una empresa, y esa empresa está desactivada (ej. falta de pago)
    # SQLAlchemy carga user.company automáticamente cuando lo pedimos aquí.
    if user.company_id and user.company and not user.company.is_active:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"La empresa '{user.company.name}' está desactivada. Contacte a soporte."
        )
    # ------------------------------------------------------

    # Devolvemos el usuario completo obtenido de la base de datos
    return user

# --- REQUIRE ROLE

# --- NUEVA FUNCIÓN DE AUTORIZACIÓN POR ROLES ---
def require_role(required_roles: List[str]):

    # Esta es una función interna que será nuestra dependencia
    async def role_checker(current_user: schemas.User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción"
            )
    return role_checker

def require_internal_roles():
    """
    Acceso a usuarios internos del negocio (roles actuales).
    Agregamos 'super_admin' para que el Jefe pueda usar cualquier función del sistema si lo desea.
    """
    return require_role(required_roles=["super_admin", "admin", "inventory_manager", "warehouse_operator"])

# --- NUEVO: REGLA DE ACCESO POR MÓDULOS (EL PORTERO SaaS) ---
def require_module(module_name: str):
    """
    Verifica si la empresa del usuario tiene contratado/activado un módulo específico.
    Si el módulo está apagado (False), prohíbe el paso.
    """
    async def module_checker(current_user: schemas.User = Depends(get_current_user)):
        # 1. El Super Admin siempre pasa (es el dueño del edificio)
        if current_user.role == 'super_admin':
            return

        # 2. Si el usuario no tiene empresa (raro), no pasa
        if not current_user.company:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario no asociado a ninguna empresa."
            )

        # 3. Revisamos los permisos en el cajón 'modules'
        # modules es un Diccionario (JSON). Ej: {"pos": False, "inventory": True}
        modules_config = current_user.company.modules

        # Si la configuración existe y el módulo específico está explícitamente en FALSE...
        if modules_config and isinstance(modules_config, dict):
            if modules_config.get(module_name) is False:
                # ...¡ALTO AHÍ! Mostramos el mensaje de venta.
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED, # Error 402 = Pago Requerido
                    detail=f"ACCESO DENEGADO: El módulo '{module_name}' no está activo en su plan. Contacte a soporte."
                )
        
        # Si no hay configuración o el módulo es True (o no existe la llave), dejamos pasar.
        # Esto asegura que las empresas antiguas sigan funcionando hasta que las configures.
        return True

    return module_checker
