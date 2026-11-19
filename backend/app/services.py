from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import ALGORITHM, SECRET_KEY, TOKEN_EXPIRE_HOURS

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.database import get_db
from app.repositorio import get_user_by_email
from sqlalchemy.orm import Session

security = HTTPBearer(auto_error=False)

def normalizar_email(email: str) -> str:
    return email.strip().lower()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

def verificar_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8")
        )
    except ValueError:
        return False

def crear_token(email: str) -> str:
    ahora = datetime.now(timezone.utc)
    expiracion = ahora + timedelta(hours=TOKEN_EXPIRE_HOURS)

    payload = {
        "sub": email,
        "iat": ahora,
        "exp": expiracion,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="debes iniciar sesion",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

    except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="token invalido o expirado"
            )

    email = payload.get("sub")

    if not isinstance(email, str) or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no válida",
        )

    usuario = get_user_by_email(db, email)

    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El usuario de esta sesión ya no existe",
        )

    if hasattr(usuario, "activo") and not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esta cuenta ha sido eliminada permanentemente y ya no tiene acceso a la plataforma.",
        )

    return usuario
