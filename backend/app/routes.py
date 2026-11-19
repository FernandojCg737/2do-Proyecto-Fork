import secrets
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.modelos_db import Inscripcion
from app.models import (
    ActualizarPasswordPerfil,
    CambiarPassword,
    CancelarSesion,
    EliminarCuenta,
    EnviarJustificacion,
    EventoCreate,
    ItemAsistencia,
    Login,
    RecuperarPassword,
    RegistrarAsistenciaBatch,
    Registro,
    ReprogramarSesion,
    ResponderJustificacion,
    ResponderSolicitud,
    SesionDeEstudio,
)

from app.repositorio import (
    buscar_sesiones,
    cancelar_sesion_estudio,
    cerrar_inscripciones as cerrar_inscripciones_db,
    eliminar_cuenta_usuario,
    exportar_mis_datos_csv,
    finalizar_sesion,
    get_user_by_email,
    guardar_sesion,
    guardar_usuario,
    listar_mis_solicitudes,
    listar_sesiones,
    listar_solicitudes_organizador,
    obtener_asistencia_sesion,
    obtener_expediente_mis_datos,
    obtener_historial,
    obtener_resumen_analitica,
    presentar_justificacion,
    reconfirmar_participacion,
    registrar_asistencia_batch,
    registrar_evento_db,
    reprogramar_sesion,
    responder_justificacion,
    responder_solicitud,
    salir_de_sesion,
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

    if hasattr(usuario, "activo") and not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esta cuenta ha sido eliminada permanentemente y no puede iniciar sesión.",
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

@router.post("/sesiones/{sesion_id}/solicitar")
def endpoint_solicitar_unirse(
    sesion_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 6 (Defensa):
    1. Si hay cupo libre: la solicitud se guarda con estado 'pendiente' para aprobación del creador.
    2. Si el cupo está agotado: entra automáticamente a la LISTA DE ESPERA (estado='en_espera').
    3. Retorna un JSON con el mensaje amigable, el estado asignado y su posición FIFO en la fila.
    """
    try:
        solicitud = solicitar_unirse(db, sesion_id, usuario.id)

        if solicitud.estado == "en_espera":
            posicion = db.scalar(
                select(func.count()).select_from(Inscripcion).where(
                    Inscripcion.sesion_id == sesion_id,
                    Inscripcion.estado == "en_espera",
                    or_(
                        Inscripcion.fecha_inscripcion < solicitud.fecha_inscripcion,
                        and_(
                            Inscripcion.fecha_inscripcion == solicitud.fecha_inscripcion,
                            Inscripcion.usuario_id <= usuario.id
                        )
                    )
                )
            ) or 1

            return {
                "mensaje": f"La sesión está llena. Has ingresado a la lista de espera en la posición #{posicion}.",
                "estado": solicitud.estado,
                "posicion": posicion,
            }
        else:
            return {
                "mensaje": "Solicitud enviada correctamente. Esperando aprobación del organizador.",
                "estado": solicitud.estado,
            }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

@router.post("/sesiones/{sesion_id}/salir")
def endpoint_salir_de_sesion(
    sesion_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 6 (Defensa - REGLA CENTRAL):
    - Si el estudiante que sale estaba CONFIRMADO (ocupaba cupo disponible):
        * Su registro se elimina liberando el cupo.
        * El primer estudiante en lista de espera (FIFO) pasa AUTOMÁTICAMENTE a 'aceptada' (confirmado).
    - Si el estudiante estaba en LISTA DE ESPERA:
        * Simplemente se retira de la fila sin alterar los cupos de los demás.
    """
    try:
        resultado = salir_de_sesion(db, sesion_id, usuario.id)

        return resultado
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

@router.post("/sesiones/{sesion_id}/reprogramar")
def endpoint_reprogramar_sesion(
    sesion_id: int,
    datos: ReprogramarSesion,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 7 (Defensa):
    1. Valida que el usuario sea el organizador de la sesión.
    2. REGLA: Mientras haya reconfirmaciones pendientes, no se admite otra reprogramación.
    3. Cambia la fecha de la sesión y persiste el motivo explicativo.
    4. REGLA: Pasa a todos los confirmados ('aceptada') a 'pendiente_reconfirmacion'.
    """
    try:
        resultado = reprogramar_sesion(
            db=db,
            sesion_id=sesion_id,
            nueva_fecha=datos.fecha,
            motivo=datos.motivo,
            organizador_id=usuario.id,
        )
        return resultado
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

@router.post("/sesiones/{sesion_id}/reconfirmar")
def endpoint_reconfirmar_participacion(
    sesion_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 7 (Defensa):
    1. Valida que el estudiante tenga una vacante en estado 'pendiente_reconfirmacion'.
    2. Transiciona su estado de vuelta a 'aceptada' (confirmado en el cupo).
    """
    try:
        resultado = reconfirmar_participacion(
            db=db,
            sesion_id=sesion_id,
            usuario_id=usuario.id,
        )
        return resultado
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

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

@router.get("/organizador/solicitudes")
def get_solicitudes_organizador(
    sesion_id: int | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 5: Retorna todas las solicitudes pendientes o resueltas de las sesiones creadas por el organizador.
    """
    return listar_solicitudes_organizador(db, usuario.id, sesion_id)

@router.post("/solicitudes/{sesion_id}/usuarios/{solicitante_id}/responder")
@router.post("/solicitudes/{sesion_id}/{solicitante_id}/responder")
def endpoint_responder_solicitud(
    sesion_id: int,
    solicitante_id: int,
    data: ResponderSolicitud,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 5: El organizador acepta o rechaza una solicitud.
    Si acepta, se descuenta un cupo disponible. La decisión queda guardada de forma persistente.
    """
    try:
        inscripcion = responder_solicitud(db, sesion_id, solicitante_id, usuario.id, data.decision)
        verbo = "aceptada" if data.decision == "aceptar" else "rechazada"
        return {
            "mensaje": f"Solicitud {verbo} correctamente.",
            "estado": inscripcion.estado,
        }
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

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

@router.post("/mis-datos/cambiar-password")
def cambiar_password_autenticado(
    data: ActualizarPasswordPerfil,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    if not verificar_password(data.password_actual, usuario.password_hash):
        raise HTTPException(
            status_code=400,
            detail="La contraseña actual ingresada es incorrecta."
        )

    validar_password(data.nueva_password)

    usuario.password_hash = hash_password(data.nueva_password)
    db.commit()

    return {"mensaje": "¡Tu contraseña ha sido actualizada exitosamente!"}

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

@router.post("/sesiones/{sesion_id}/finalizar")
def endpoint_finalizar_sesion(
    sesion_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 8: Da por terminada la sesión para habilitar el control de asistencia.
    Restricción: Solo el organizador creador tiene autorización (HTTP 403 si es ajeno).
    """
    try:
        finalizar_sesion(db, sesion_id, usuario.id)
        return {"mensaje": "Sesión dada por concluida exitosamente."}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/sesiones/{sesion_id}/asistencia")
def endpoint_consultar_asistencia(
    sesion_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 8: Consulta el estado de asistencia y el historial de cambios.
    - Organizador: Lista completa de participantes confirmados y bitácora de auditoría.
    - Participante: Su propio resultado y estado de justificación.
    - Usuario ajeno: HTTP 403 Forbidden.
    """
    try:
        return obtener_asistencia_sesion(db, sesion_id, usuario.id)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/sesiones/{sesion_id}/asistencia")
def endpoint_registrar_asistencia(
    sesion_id: int,
    data: RegistrarAsistenciaBatch,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 8: El organizador registra presentes o ausentes para los participantes confirmados.
    Restricciones:
    - Solo el organizador creador puede registrar o modificar asistencia (HTTP 403).
    - Solo participantes con cupo confirmado (HTTP 400 si se intenta con otros).
    - Conserva el historial de auditoría de cada modificación.
    """
    try:
        return registrar_asistencia_batch(db, sesion_id, usuario.id, data.asistencias)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/sesiones/{sesion_id}/justificar")
def endpoint_presentar_justificacion(
    sesion_id: int,
    data: EnviarJustificacion,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 8: Un estudiante registrado como ausente remite su justificación de inasistencia.
    Restricciones:
    - Solo el propio estudiante ausente puede justificar (HTTP 400 si no es ausente).
    - El texto explicativo no puede estar vacío (mínimo 5 caracteres).
    - Estado pasa a 'pendiente' y se registra en el historial de cambios.
    """
    try:
        return presentar_justificacion(db, sesion_id, usuario.id, data.justificacion)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/sesiones/{sesion_id}/usuarios/{estudiante_id}/responder-justificacion")
def endpoint_responder_justificacion(
    sesion_id: int,
    estudiante_id: int,
    data: ResponderJustificacion,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 8: El organizador evalúa la justificación recibida (Aceptar o Rechazar).
    Restricciones:
    - Solo el organizador creador puede resolver la justificación (HTTP 403 para usuarios ajenos).
    - El motivo explicativo es obligatorio (mínimo 3 caracteres).
    - Consecuencia: Se actualiza el estado y se conserva la bitácora en el historial de cambios.
    """
    try:
        return responder_justificacion(
            db=db,
            sesion_id=sesion_id,
            estudiante_id=estudiante_id,
            organizador_id=usuario.id,
            decision=data.decision,
            motivo=data.motivo,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/sesiones/{sesion_id}/cancelar")
def endpoint_cancelar_sesion(
    sesion_id: int,
    data: CancelarSesion,
    db: Session = Depends(get_db),
    usuario=Depends(obtener_usuario_actual),
):
    """
    TAREA 9 (PARTE B): El organizador cancela formalmente una sesión de estudio.
    Reglas de la Diapositiva 12/13:
    - Solo el organizador creador tiene permisos para cancelar (HTTP 403 para ajenos).
    - Solo antes de la fecha programada (HTTP 400 si ya pasó o concluyó).
    - Motivo obligatorio (mínimo 5 caracteres).
    - Pasa los participantes de estados aceptada, pendiente y en_espera a 'cancelada'.
    """
    try:
        return cancelar_sesion_estudio(
            db=db,
            sesion_id=sesion_id,
            organizador_id=usuario.id,
            motivo=data.motivo,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/eventos", status_code=status.HTTP_201_CREATED)
def endpoint_registrar_evento(
    data: EventoCreate,
    db: Session = Depends(get_db),
):
    """
    CLASE 21: Registra un evento en la tabla 'eventos' cumpliendo con la diapositiva 7/13.
    - No requiere autenticación obligatoria para permitir telemetría anónima.
    - Filtra datos personales (nombres, correos) protegiendo la privacidad.
    """
    try:
        return registrar_evento_db(
            db=db,
            nombre_evento=data.evento,
            props=data.props,
            fecha_iso=data.fecha,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/eventos")
@router.get("/analitica/metricas")
def endpoint_obtener_analitica(
    db: Session = Depends(get_db),
):
    """
    CLASE 21: Consulta obligatoria del panel /analitica (diapositiva 10/13):
    SELECT evento, COUNT(*) FROM eventos GROUP BY evento;
    Retorna los conteos, el porcentaje de conversión y los últimos eventos.
    """
    try:
        return obtener_resumen_analitica(db)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/mis-datos")
def endpoint_ver_mis_datos(
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual),
):
    """
    TAREA 10 (Paso 1): 'Mis datos: ver y descargar (JSON o CSV)'
    Permite al estudiante ver con transparencia total todos los datos que
    la plataforma StudyMatch almacena sobre su perfil y actividad académica.
    """
    try:
        return obtener_expediente_mis_datos(db, usuario.id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/mis-datos/descargar")
def endpoint_descargar_mis_datos(
    formato: Literal["json", "csv"] = "json",
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual),
):
    """
    TAREA 10 (Paso 1): Descarga de los datos en formatos abiertos (JSON o CSV).
    Garantiza el derecho a la portabilidad de datos sin trabas técnicas.
    """
    try:
        expediente = obtener_expediente_mis_datos(db, usuario.id)

        if formato == "csv":
            contenido_csv = exportar_mis_datos_csv(expediente)
            return Response(
                content=contenido_csv,
                media_type="text/csv; charset=utf-8",
                headers={
                    "Content-Disposition": f"attachment; filename=studymatch_mis_datos_usuario_{usuario.id}.csv"
                },
            )
        else:
            import json
            contenido_json = json.dumps(expediente, indent=2, ensure_ascii=False)
            return Response(
                content=contenido_json,
                media_type="application/json; charset=utf-8",
                headers={
                    "Content-Disposition": f"attachment; filename=studymatch_mis_datos_usuario_{usuario.id}.json"
                },
            )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/cuenta/eliminar")
def endpoint_eliminar_cuenta(
    data: EliminarCuenta,
    db: Session = Depends(get_db),
    usuario = Depends(obtener_usuario_actual),
):
    """
    TAREA 10 (Pasos 2 y 3): Eliminación honesta con la regla de la app (Diapositiva 12/16 y 13/16).
    Regla asignada a StudyMatch:
      'Las sesiones que organiza se cancelan y los participantes ven el motivo.
       Sale de las listas de espera sin afectar el orden de los demás.'
      'si la regla bloquea la eliminación, el mensaje dice por qué y qué hacer para poder eliminarla.'
    """
    try:
        resultado = eliminar_cuenta_usuario(
            db=db,
            usuario_id=usuario.id,
            password_confirmacion=data.password_confirmacion,
            motivo_cancelacion_sesiones=data.motivo_cancelacion_sesiones,
        )

        if resultado.get("bloqueado"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=resultado,
            )

        return resultado
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

