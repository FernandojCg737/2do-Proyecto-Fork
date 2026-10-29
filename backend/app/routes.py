import secrets
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    CambiarPassword,
    Login,
    RecuperarPassword,
    Registro,
    ResponderSolicitud,
    SesionDeEstudio,
)

from app.repositorio import (
    buscar_sesiones,
    cerrar_inscripciones as cerrar_inscripciones_db,
    get_user_by_email,
    guardar_sesion,
    guardar_usuario,
    listar_mis_solicitudes,
    listar_sesiones,
    listar_solicitudes_organizador,
    obtener_historial,
    responder_solicitud,
    solicitar_unirse,
    unirse_a_sesion,
)

from app.services import (
    crear_token, 
    hash_password, 
    normalizar_email,
    obtener_usuario_actual, 
    verificar_password,
)

router = APIRouter()


def validar_password(password):
    if not password:
        raise HTTPException(
            status_code=400, 
            detail="La contraseña es obligatoria"
        )
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400, 
            detail="La contraseña admite hasta 72 bytes."
        )


@router.post("/registro")
def registrar_usuario(data: Registro, db: Session = Depends(get_db)):
    email = normalizar_email(data.email)

    if not data.nombre.strip():
        raise HTTPException(
            status_code=400, 
            detail="El nombre es obligatorio."
        )
    
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Ingresa un correo válido.")
    
    validar_password(data.password)

    if get_user_by_email(db, email):
        raise HTTPException(status_code=409, detail="El correo ya está registrado.")
    
    try:
        usuario = guardar_usuario(db, data.nombre, email, hash_password(data.password))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="El correo ya está registrado.")
    
    return {"mensaje": "Cuenta registrada correctamente.", "id": usuario.id}


@router.post("/login")
def iniciar_sesion(data: Login, db: Session = Depends(get_db)):
    email = normalizar_email(data.email)
    usuario = get_user_by_email(db, email)

    if not usuario or not verificar_password(data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )
    
    return {
        "mensaje": "Inicio de sesión correcto.",
        "token": crear_token(email),
        "usuario": {"id": usuario.id, "nombre": usuario.nombre, "email": usuario.email},
    }


@router.get("/perfil")
def perfil(usuario=Depends(obtener_usuario_actual)):
    return {"nombre": usuario.nombre, "email": usuario.email}


@router.get("/all-sesions")
def get_all_sesions(
    nombre: str = "",
    materia: str = "",
    modalidad: Literal["", "presencial", "virtual"] = "",
    periodo: Literal["", "hoy", "proximos7", "rango"] = "",
    desde: date | None = None,
    hasta: date | None = None,
    disponible: bool = False,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    try:
        return buscar_sesiones(db, usuario.id, nombre, materia, modalidad,
                               periodo, desde, hasta, disponible)
    except ValueError as error:
        raise HTTPException(
            status_code=400, 
            detail=str(error)
        )


@router.get("/materias")
def get_materias(db: Session = Depends(get_db), usuario=Depends(obtener_usuario_actual)):
    return sorted(
        {sesion.materia for sesion in listar_sesiones(db)}, 
        key=str.casefold
    )


# ==============================================================================
# --- TAREA 5: Endpoints para el Flujo de Solicitudes y Aprobación ---
# ==============================================================================

# Endpoint para que el estudiante envíe la solicitud de unión a una sesión
@router.post("/sesiones/{sesion_id}/solicitar")
def endpoint_solicitar_unirse(
    sesion_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 5: El estudiante solicita unirse a una sesión de estudio.
    La solicitud queda guardada con estado='pendiente' en espera de la aprobación del organizador.
    """
    try:
        # Invoca la regla de negocio para crear la solicitud en la base de datos
        solicitud = solicitar_unirse(db, sesion_id, usuario.id)
        return {
            "mensaje": "Solicitud enviada correctamente. Esperando aprobación del organizador.",
            "estado": solicitud.estado,
        }
    except ValueError as error:
        # Si no cumple reglas (ej. sin cupo, sesión cerrada, solicitud duplicada) retorna HTTP 400
        raise HTTPException(status_code=400, detail=str(error))


# Endpoint de compatibilidad para inscripciones directas en pruebas heredadas
@router.post("/sesiones/{sesion_id}/inscribirse")
def inscribirse(
    sesion_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    try:
        unirse_a_sesion(db, sesion_id, usuario.id)
    except ValueError as error:
        raise HTTPException(
            status_code=400, 
            detail=str(error)
        )
    return {"mensaje": "Te inscribiste en la sesión correctamente."}


# Endpoint para que el organizador consulte todas las solicitudes recibidas en sus sesiones
@router.get("/organizador/solicitudes")
def get_solicitudes_organizador(
    sesion_id: int | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 5: Retorna todas las solicitudes pendientes o resueltas de las sesiones creadas por el organizador.
    """
    # Consulta en la base de datos las solicitudes dirigidas a este organizador
    return listar_solicitudes_organizador(db, usuario.id, sesion_id)


# Endpoint para que el organizador acepte o rechace una solicitud específica
@router.post("/solicitudes/{sesion_id}/usuarios/{solicitante_id}/responder")
def endpoint_responder_solicitud(
    sesion_id: int,
    solicitante_id: int,
    data: ResponderSolicitud,  # Valida que data.decision sea 'aceptar' o 'rechazar'
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 5: El organizador acepta o rechaza una solicitud.
    Si acepta, se descuenta un cupo disponible. La decisión queda guardada de forma persistente.
    """
    try:
        # Ejecuta la decisión verificando que quien responde sea el organizador de la sesión
        inscripcion = responder_solicitud(db, sesion_id, solicitante_id, usuario.id, data.decision)
        verbo = "aceptada" if data.decision == "aceptar" else "rechazada"
        return {
            "mensaje": f"Solicitud {verbo} correctamente.",
            "estado": inscripcion.estado,
        }
    except PermissionError as error:
        # Si un usuario intenta responder una sesión ajena, se niega el acceso con HTTP 403 Forbidden
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        # Errores de validación (sesión inexistente, sin cupos, etc.)
        raise HTTPException(status_code=400, detail=str(error))


# Endpoint para que el estudiante consulte sus propias solicitudes enviadas
@router.get("/mis-solicitudes")
def get_mis_solicitudes(
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 5: Retorna todas las solicitudes enviadas por el estudiante logueado y su estado actual.
    El estudiante puede consultar el estado en cualquier momento tras recargar la página.
    """
    return listar_mis_solicitudes(db, usuario.id)


@router.post("/logout")
def cerrar_sesion(usuario=Depends(obtener_usuario_actual)):
    return {"mensaje": "Sesión cerrada correctamente."}


@router.post("/recuperar-password")
def recuperar_password(data: RecuperarPassword, db: Session = Depends(get_db)):
    usuario = get_user_by_email(db, normalizar_email(data.email))

    if not usuario:
        raise HTTPException(
            status_code=404, detail="No existe una cuenta con ese correo"
        )
    
    codigo = str(secrets.randbelow(900000) + 100000)
    usuario.reset_code = codigo
    db.commit()

    return {
        "mensaje": "Código de recuperación generado.",
        "codigo": codigo,
        "nota": "En un sistema real, este código se enviaría por correo.",
    }


@router.post("/cambiar-password")
def cambiar_password(data: CambiarPassword, db: Session = Depends(get_db)):
    usuario = get_user_by_email(db, normalizar_email(data.email))
    
    if not usuario:
        raise HTTPException(
            status_code=404, 
            detail="No existe esa cuenta"
        )
    
    if not usuario.reset_code or not secrets.compare_digest(data.codigo.strip(), usuario.reset_code):
        raise HTTPException(
            status_code=400, 
            detail="Código de recuperación no válido"
        )
    
    validar_password(data.nueva_password)
    usuario.password_hash = hash_password(data.nueva_password)
    usuario.reset_code = ""
    db.commit()

    return {"mensaje": "Contraseña cambiada correctamente."}


@router.post("/guardar-nuevo")
def crear_sesion(
    data: SesionDeEstudio,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    sesion = guardar_sesion(
        db=db,
        nombre=data.nombre,
        materia=data.materia,
        fecha=data.fecha,
        modalidad=data.modalidad,
        cupo=data.cupo,
        abiertas=data.inscripciones,
        usuario_id=usuario.id,
    )

    return {"mensaje": "Sesión de estudio registrada correctamente.", "id": sesion.id}


@router.post("/cerrar-inscripciones")
def cerrar_inscripciones(
    data: SesionDeEstudio,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    coincidencias = [s for s in listar_sesiones(db) if s.nombre == data.nombre and s.usuario_id == usuario.id]

    if len(coincidencias) != 1:
        raise HTTPException(
            status_code=400, 
            detail="No se encontró una sesión única de este usuario."
        )
    
    try:
        cerrar_inscripciones_db(db, coincidencias[0].id, usuario.id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    
    return {"mensaje": "Estado de inscripciones modificado correctamente."}


@router.get("/historial-sesiones")
def get_historial(
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    return obtener_historial(db, usuario.id)