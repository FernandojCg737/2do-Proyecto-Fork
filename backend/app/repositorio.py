from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from app.modelos_db import Inscripcion, SesionEstudio, Usuario


def guardar_usuario(db, nombre, email, password_hash):
    usuario = Usuario(
        nombre=nombre.strip(),
        email=email.strip().lower(),
        password_hash=password_hash,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def get_user_by_email(db, email):
    consulta = select(Usuario).where(
        Usuario.email == email.strip().lower()
    )
    return db.scalars(consulta).first()


def guardar_sesion(db, nombre, fecha, modalidad, cupo, abiertas, usuario_id, materia="General"):
    if cupo <= 0:
        raise ValueError("el cupo tien que ser mayor a cero")
    
    sesion = SesionEstudio(
        nombre=nombre.strip(),
        materia=materia.strip(),
        fecha=fecha,
        modalidad=modalidad.strip().lower(),
        cupo=cupo,
        inscripciones_abiertas=abiertas,
        usuario_id=usuario_id,
    )
    db.add(sesion)
    db.commit()
    db.refresh(sesion)
    return sesion


def fecha_actual():
    return datetime.now(timezone(timedelta(hours=-4))).date()


def motivo_para_unirse(sesion, usuario_id, inscritos, ya_inscrito, hoy=None):
    if sesion.usuario_id == usuario_id:
        return "Eres el creador de esta sesión."
    if ya_inscrito:
        return "Ya estás inscrito en esta sesión."
    if not sesion.inscripciones_abiertas:
        return "Las inscripciones están cerradas."
    if sesion.fecha <= (hoy or fecha_actual()):
        return "Solo puedes unirte a sesiones con fecha futura."
    if inscritos >= sesion.cupo:
        return "No quedan cupos disponibles."
    return ""


# ==============================================================================
# --- TAREA 5: Flujo de Solicitud de Unión a Sesiones de Estudio ---
# ==============================================================================

def solicitar_unirse(db, sesion_id, usuario_id, hoy=None):
    """
    TAREA 5: El estudiante solicita unirse a una sesión de estudio.
    Crea una solicitud con estado='pendiente', esperando la aprobación o rechazo del organizador.
    """
    # 1. Obtener la sesión y validar que exista
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    # 2. Regla: El creador/organizador de la sesión no puede solicitar unirse a su propia sesión
    if sesion.usuario_id == usuario_id:
        raise ValueError("Eres el creador de esta sesión.")

    # 3. Regla: La sesión debe tener inscripciones abiertas
    if not sesion.inscripciones_abiertas:
        raise ValueError("Las inscripciones están cerradas.")

    # 4. Regla: La sesión debe ser en una fecha futura
    if sesion.fecha <= (hoy or fecha_actual()):
        raise ValueError("Solo puedes unirte a sesiones con fecha futura.")

    # 5. Regla TAREA 5: Solo las solicitudes 'aceptadas' descuentan del cupo disponible;
    # se verifica si aún hay plazas libres para aceptar nuevas solicitudes
    inscritos_aceptados = db.scalar(
        select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado == "aceptada"
        )
    )
    if inscritos_aceptados >= sesion.cupo:
        raise ValueError("No quedan cupos disponibles.")

    # 6. Consultar si ya existe una solicitud o inscripción previa del estudiante
    inscripcion = db.get(Inscripcion, (usuario_id, sesion_id))
    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    if inscripcion is not None:
        # Si ya tiene una solicitud pendiente, evitar duplicación
        if inscripcion.estado == "pendiente":
            raise ValueError("Ya tienes una solicitud pendiente para esta sesión.")
        # Si ya fue aceptado, ya forma parte del grupo
        if inscripcion.estado == "aceptada":
            raise ValueError("Ya estás inscrito en esta sesión.")
        # Si fue rechazada previamente, se le permite volver a postular cambiando a 'pendiente'
        if inscripcion.estado == "rechazada":
            inscripcion.estado = "pendiente"
            inscripcion.fecha_inscripcion = ahora_utc
            inscripcion.fecha_respuesta = None
            db.commit()
            db.refresh(inscripcion)
            return inscripcion

    # 7. Registrar en la base de datos la nueva solicitud con estado='pendiente'
    nueva_solicitud = Inscripcion(
        usuario_id=usuario_id,
        sesion_id=sesion_id,
        estado="pendiente",  # Estado inicial: esperando respuesta del organizador
        fecha_inscripcion=ahora_utc,
    )
    db.add(nueva_solicitud)
    db.commit()
    db.refresh(nueva_solicitud)
    return nueva_solicitud


def unirse_a_sesion(db, sesion_id, usuario_id, hoy=None, estado="aceptada"):
    """
    Función de compatibilidad: Permite la inscripción directa para las pruebas automáticas heredadas.
    """
    try:
        if getattr(db.bind, 'dialect', None) and db.bind.dialect.name == 'sqlite':
            db.execute(text("BEGIN IMMEDIATE"))
    except Exception:
        pass

    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("no existe la sesion")

    # Contar únicamente las solicitudes aceptadas
    inscritos = db.scalar(
        select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado == "aceptada"
        )
    )
    ya_inscrito = db.get(Inscripcion, (usuario_id, sesion_id)) is not None
    motivo = motivo_para_unirse(sesion, usuario_id, inscritos, ya_inscrito, hoy)
    if motivo:
        raise ValueError(motivo)

    try:
        inscripcion = Inscripcion(
            usuario_id=usuario_id,
            sesion_id=sesion_id,
            estado=estado,
            fecha_inscripcion=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(inscripcion)
        db.commit()
        return inscripcion
    except IntegrityError:
        db.rollback()
        raise ValueError("Ya estás inscrito en esta sesión.")
    except Exception:
        db.rollback()
        raise


def responder_solicitud(db, sesion_id, solicitante_id, organizador_id, decision: str):
    """
    TAREA 5: El organizador acepta o rechaza una solicitud de unión pendiente.
    - 'aceptar': cambia estado a 'aceptada' y descuenta un cupo disponible.
    - 'rechazar': cambia estado a 'rechazada' y mantiene los cupos intactos.
    """
    # 1. Validar que la decisión sea exactamente 'aceptar' o 'rechazar'
    decision = decision.strip().lower()
    if decision not in ("aceptar", "rechazar"):
        raise ValueError("La decisión debe ser 'aceptar' o 'rechazar'.")

    # 2. Validar que la sesión exista
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    # 3. Regla de Autorización TAREA 5: Solo el creador de la sesión puede aceptar o rechazar
    if sesion.usuario_id != organizador_id:
        raise PermissionError("Solo el organizador de la sesión puede aceptar o rechazar solicitudes.")

    # 4. Buscar la solicitud del postulante
    inscripcion = db.get(Inscripcion, (solicitante_id, sesion_id))
    if inscripcion is None:
        raise ValueError("No existe una solicitud de este usuario para esta sesión.")

    # 5. Regla: Solo se pueden responder solicitudes que aún estén en estado 'pendiente'
    if inscripcion.estado != "pendiente":
        raise ValueError(f"La solicitud ya fue procesada anteriormente ({inscripcion.estado}).")

    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    # 6. Ejecutar la acción según la decisión del organizador
    if decision == "aceptar":
        # Comprobar que todavía existan cupos antes de aceptar
        aceptados = db.scalar(
            select(func.count()).select_from(Inscripcion).where(
                Inscripcion.sesion_id == sesion_id,
                Inscripcion.estado == "aceptada"
            )
        )
        if aceptados >= sesion.cupo:
            raise ValueError("No quedan cupos disponibles para aceptar esta solicitud.")
        # Se acepta la solicitud (a partir de ahora descuenta del cupo disponible)
        inscripcion.estado = "aceptada"
    else:
        # Se rechaza la solicitud (no descuenta cupo disponible)
        inscripcion.estado = "rechazada"

    # 7. Registrar fecha de respuesta y persistir en la base de datos
    inscripcion.fecha_respuesta = ahora_utc
    db.commit()
    db.refresh(inscripcion)
    return inscripcion


def listar_solicitudes_organizador(db, organizador_id, sesion_id=None):
    """
    TAREA 5: Retorna todas las solicitudes recibidas en las sesiones creadas por el organizador.
    Permite al organizador gestionar quién se une y quién no.
    """
    # Consulta uniendo Inscripcion, SesionEstudio y Usuario solicitante
    consulta = (
        select(Inscripcion, SesionEstudio, Usuario)
        .join(SesionEstudio, Inscripcion.sesion_id == SesionEstudio.id)
        .join(Usuario, Inscripcion.usuario_id == Usuario.id)
        .where(SesionEstudio.usuario_id == organizador_id)  # Filtrar solo sesiones del organizador
    )
    if sesion_id:
        consulta = consulta.where(SesionEstudio.id == sesion_id)
    
    # Ordenar por fecha de solicitud descendente
    consulta = consulta.order_by(
        Inscripcion.fecha_inscripcion.desc(),
        Inscripcion.sesion_id
    )

    resultado = []
    for inscripcion, sesion, usuario in db.execute(consulta):
        resultado.append({
            "sesion_id": sesion.id,
            "sesion_nombre": sesion.nombre,
            "materia": sesion.materia,
            "cupo_total": sesion.cupo,
            "solicitante_id": usuario.id,
            "solicitante_nombre": usuario.nombre,
            "solicitante_email": usuario.email,
            "estado": inscripcion.estado,  # 'pendiente', 'aceptada' o 'rechazada'
            "fecha_solicitud": inscripcion.fecha_inscripcion.isoformat() if inscripcion.fecha_inscripcion else None,
            "fecha_respuesta": inscripcion.fecha_respuesta.isoformat() if inscripcion.fecha_respuesta else None,
        })
    return resultado


def listar_mis_solicitudes(db, usuario_id):
    """
    TAREA 5: Retorna todas las solicitudes enviadas por el estudiante logueado y su estado actual.
    Garantiza que el alumno vea el resultado persistente al recargar o volver a entrar.
    """
    consulta = (
        select(Inscripcion, SesionEstudio, Usuario)
        .join(SesionEstudio, Inscripcion.sesion_id == SesionEstudio.id)
        .join(Usuario, SesionEstudio.usuario_id == Usuario.id)  # Usuario organizador de la sesión
        .where(Inscripcion.usuario_id == usuario_id)
        .order_by(Inscripcion.fecha_inscripcion.desc())
    )

    resultado = []
    for inscripcion, sesion, organizador in db.execute(consulta):
        resultado.append({
            "sesion_id": sesion.id,
            "sesion_nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad,
            "fecha_sesion": sesion.fecha.isoformat() if hasattr(sesion.fecha, "isoformat") else str(sesion.fecha),
            "organizador_nombre": organizador.nombre,
            "organizador_email": organizador.email,
            "estado": inscripcion.estado,  # 'pendiente', 'aceptada' o 'rechazada'
            "fecha_solicitud": inscripcion.fecha_inscripcion.isoformat() if inscripcion.fecha_inscripcion else None,
            "fecha_respuesta": inscripcion.fecha_respuesta.isoformat() if inscripcion.fecha_respuesta else None,
        })
    return resultado


def buscar_sesiones(db, usuario_id, nombre="", materia="", modalidad="",
                    periodo="", desde=None, hasta=None, disponible=False, hoy=None):
    """
    Búsqueda y listado de sesiones de estudio con filtros combinados.
    Se actualizó para la Tarea 5 para reflejar cupos reales basados en solicitudes aceptadas.
    """
    hoy = hoy or fecha_actual()
    if periodo == "hoy":
        desde = hasta = hoy
    elif periodo == "proximos7":
        desde, hasta = hoy + timedelta(days=1), hoy + timedelta(days=7)
    elif periodo == "rango" and (desde is None or hasta is None):
        raise ValueError("Indica la fecha inicial y la final.")

    if desde and hasta and desde > hasta:
        raise ValueError("La fecha inicial no puede ser posterior a la final.")

    consulta = select(SesionEstudio)
    if modalidad:
        consulta = consulta.where(func.lower(SesionEstudio.modalidad) == modalidad.lower())
    if desde:
        consulta = consulta.where(SesionEstudio.fecha >= desde)
    if hasta:
        consulta = consulta.where(SesionEstudio.fecha <= hasta)

    sesiones = db.scalars(consulta.order_by(SesionEstudio.fecha, SesionEstudio.id)).all()

    # TAREA 5: Solo las solicitudes en estado 'aceptada' descuentan del cupo disponible
    cantidades = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado == "aceptada").group_by(Inscripcion.sesion_id)).all())

    # Diccionario de estados de solicitud del usuario actual para cada sesión
    mis_inscripciones = {
        i.sesion_id: i.estado
        for i in db.scalars(select(Inscripcion).where(
            Inscripcion.usuario_id == usuario_id
        )).all()
    }

    # TAREA 5: Conteo de solicitudes pendientes para mostrar en el panel del organizador
    pendientes_por_sesion = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado == "pendiente").group_by(Inscripcion.sesion_id)).all())

    resultado = []
    for sesion in sesiones:
        if nombre.strip().casefold() not in sesion.nombre.casefold():
            continue
        if materia.strip() and materia.strip().casefold() != sesion.materia.casefold():
            continue

        inscritos = cantidades.get(sesion.id, 0)
        estado_solicitud = mis_inscripciones.get(sesion.id, None)
        inscrito = (estado_solicitud == "aceptada")
        es_organizador = (sesion.usuario_id == usuario_id)

        # Mensaje explicativo según el estado de la solicitud
        if estado_solicitud == "pendiente":
            motivo = "Tu solicitud está pendiente de aprobación."
        elif estado_solicitud == "rechazada":
            motivo = "Tu solicitud fue rechazada por el organizador."
        else:
            motivo = motivo_para_unirse(sesion, usuario_id, inscritos, inscrito, hoy)

        if disponible and motivo:
            continue

        # Cálculo de cupos disponibles reales
        cupos_libres = max(0, sesion.cupo - inscritos)

        # Determina si el estudiante puede enviar una solicitud de unión
        puede_solicitar = (
            not es_organizador
            and estado_solicitud != "pendiente"
            and estado_solicitud != "aceptada"
            and sesion.inscripciones_abiertas
            and sesion.fecha > hoy
            and cupos_libres > 0
        )

        resultado.append({
            "id": sesion.id,
            "nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad.lower(),
            "fecha": sesion.fecha,
            "cupo": sesion.cupo,
            "cupos_disponibles": cupos_libres,  # Descuenta únicamente aceptadas
            "inscripciones_abiertas": sesion.inscripciones_abiertas,
            "inscrito": inscrito,
            "estado_solicitud": estado_solicitud,  # 'pendiente', 'aceptada', 'rechazada' o None
            "es_organizador": es_organizador,      # True si el usuario creó esta sesión
            "solicitudes_pendientes_count": pendientes_por_sesion.get(sesion.id, 0) if es_organizador else 0,
            "puede_unirse": puede_solicitar,
            "puede_solicitar": puede_solicitar,
            "motivo": motivo,
        })
    return resultado


def listar_sesiones(db):
    return db.scalars(select(SesionEstudio)).all()


def cerrar_inscripciones(db, sesion_id, usuario_id):
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("no existe la sesion")
    if sesion.usuario_id != usuario_id:
        raise ValueError("solo el creador puede cerrar la inscripcion")
    if not sesion.inscripciones_abiertas:
        raise ValueError("inscripciones cerrdas")

    sesion.inscripciones_abiertas = False
    db.commit()


def obtener_historial(db, usuario_id):
    """
    Retorna el historial de sesiones e inscripciones del usuario con su estado persistente.
    """
    consulta = (
        select(Inscripcion, SesionEstudio)
        .join(
            SesionEstudio,
            Inscripcion.sesion_id == SesionEstudio.id,
        )
        .where(Inscripcion.usuario_id == usuario_id)
        .order_by(
            Inscripcion.fecha_inscripcion.desc(),
            SesionEstudio.id.desc(),
        )
    )

    historial = []
    for inscripcion, sesion in db.execute(consulta):
        fecha_inscripcion = inscripcion.fecha_inscripcion
        if fecha_inscripcion is not None:
            fecha_inscripcion = fecha_inscripcion.replace(tzinfo=timezone.utc)

        # TAREA 5: Etiqueta descriptiva según el estado de la solicitud
        resultado_texto = "Inscripción aceptada"
        if inscripcion.estado == "pendiente":
            resultado_texto = "Solicitud pendiente"
        elif inscripcion.estado == "rechazada":
            resultado_texto = "Solicitud rechazada"

        historial.append({
            "sesion_id": sesion.id,
            "nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad,
            "fecha_sesion": sesion.fecha,
            "fecha_inscripcion": fecha_inscripcion,
            "estado": inscripcion.estado,        # 'pendiente', 'aceptada', 'rechazada'
            "resultado": resultado_texto,        # Texto legible para la interfaz
        })

    return historial
