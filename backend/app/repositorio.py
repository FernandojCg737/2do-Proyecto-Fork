import json
from datetime import datetime, timedelta, timezone
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.orm import aliased
from sqlalchemy.exc import IntegrityError
from app.modelos_db import Evento, HistorialCambioAsistencia, Inscripcion, SesionEstudio, Usuario

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

def fecha_iso_utc(dt):
    """
    Convierte una fecha/hora datetime a formato ISO 8601 con sufijo 'Z' (UTC).
    Garantiza que el frontend en el navegador la convierta con precisión exacta
    a la hora local oficial de Bolivia (America/La_Paz, UTC-4).
    """
    if not dt:
        return None
    if isinstance(dt, str):
        if not dt.endswith("Z") and "+" not in dt:
            return dt + "Z"
        return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def motivo_para_unirse(sesion, usuario_id, inscritos, ya_inscrito, hoy=None):
    if bool(getattr(sesion, "cancelada", False)):
        return "No se puede solicitar unirse a una sesión que ha sido cancelada."
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

def solicitar_unirse(db, sesion_id, usuario_id, hoy=None, permitir_espera=True):
    """
    TAREA 5 y TAREA 6: El estudiante solicita unirse a una sesión de estudio.
    Reglas de Negocio aplicadas paso a paso:
      1. Verificar que la sesión exista en la base de datos.
      2. El creador/organizador no puede ser alumno de su propia sesión.
      3. Las inscripciones deben estar abiertas por el creador.
      4. La fecha de la sesión debe ser futura respecto a hoy.
      5. No se permite duplicar solicitudes pendientes ni duplicar cupo en lista de espera.
      6. Contar inscritos confirmados (estado='aceptada').
      7. REGLA TAREA 6: Si la sesión está llena (inscritos >= cupo):
         - Si permitir_espera=True: entra automáticamente a la LISTA DE ESPERA (estado='en_espera').
         - Si permitir_espera=False: arroja error (compatibilidad con pruebas legadas).
      8. Persistir la solicitud en la base de datos con la marca temporal UTC exacta (FIFO).
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    if sesion.usuario_id == usuario_id:
        raise ValueError("Eres el creador de esta sesión.")

    if not sesion.inscripciones_abiertas:
        raise ValueError("Las inscripciones están cerradas.")

    if bool(getattr(sesion, "cancelada", False)):
        raise ValueError("No se admiten nuevas solicitudes: la sesión ha sido cancelada por el organizador.")

    fecha_limite = (hoy or fecha_actual())
    if sesion.fecha < fecha_limite:
        raise ValueError("No puedes unirte a sesiones que ya ocurrieron en el pasado.")
    if bool(getattr(sesion, "finalizada", False)):
        raise ValueError("Las inscripciones están cerradas porque la sesión ya concluyó.")

    inscripcion = db.get(Inscripcion, (usuario_id, sesion_id))
    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    if inscripcion is not None:
        if inscripcion.estado == "cancelada":
            raise ValueError("No puedes volver a solicitar unirte a una sesión que fue cancelada.")
        if inscripcion.estado == "pendiente":
            raise ValueError("Ya tienes una solicitud pendiente para esta sesión.")
        if inscripcion.estado == "aceptada":
            raise ValueError("Ya estás inscrito en esta sesión.")
        if inscripcion.estado == "pendiente_reconfirmacion":
            raise ValueError("Ya tienes un cupo en esta sesión (pendiente de reconfirmar).")
        if inscripcion.estado == "en_espera":
            raise ValueError("Ya estás en la lista de espera de esta sesión.")
        if inscripcion.estado == "rechazada":
            inscripcion.fecha_inscripcion = ahora_utc
            inscripcion.fecha_respuesta = None

    inscritos_aceptados = db.scalar(
        select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado.in_(["aceptada", "pendiente_reconfirmacion"])
        )
    )

    esta_llena = (inscritos_aceptados >= sesion.cupo)

    if esta_llena:
        if not permitir_espera:
            raise ValueError("No quedan cupos disponibles.")
        nuevo_estado = "en_espera"
    else:
        nuevo_estado = "pendiente"

    if inscripcion is not None and inscripcion.estado == "rechazada":
        inscripcion.estado = nuevo_estado
        db.commit()
        db.refresh(inscripcion)
        return inscripcion

    nueva_solicitud = Inscripcion(
        usuario_id=usuario_id,
        sesion_id=sesion_id,
        estado=nuevo_estado,
        fecha_inscripcion=ahora_utc,
    )
    db.add(nueva_solicitud)
    db.commit()
    db.refresh(nueva_solicitud)
    return nueva_solicitud

def salir_de_sesion(db, sesion_id, usuario_id):
    """
    TAREA 6: REGLA CENTRAL DE LA PRÁCTICA:
    'si alguien sale, entra el primero. La prueba comprueba: El primero en espera pasa a confirmado.'

    Flujo paso a paso para la defensa:
      1. Validar que la sesión exista en la base de datos.
      2. Validar que el usuario que solicita salir esté registrado en la sesión.
      3. Guardar el estado previo ('aceptada', 'en_espera' o 'pendiente') antes de eliminar.
      4. Eliminar el registro de inscripción (liberando el cupo o la posición).
      5. SI EL ESTUDIANTE QUE SALIÓ ESTABA CONFIRMADO ('aceptada'):
         - Buscar al primer postulante en LISTA DE ESPERA (estado == 'en_espera').
         - Ordenar por fecha_inscripcion ascendente (orden FIFO estricto) y desempate por usuario_id.
         - Si existe alguien en la fila: PROMOVERLO AUTOMÁTICAMENTE a 'aceptada'.
         - Asignar fecha_respuesta con la marca de tiempo actual.
      6. Confirmar la transacción atómica con db.commit() para garantizar consistencia.
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    inscripcion = db.get(Inscripcion, (usuario_id, sesion_id))
    if inscripcion is None:
        raise ValueError("No estás registrado en esta sesión.")

    estado_anterior = inscripcion.estado

    db.delete(inscripcion)
    db.flush()

    promovido_info = None

    if estado_anterior in ("aceptada", "pendiente_reconfirmacion"):
        primer_en_espera = db.scalars(
            select(Inscripcion)
            .where(
                Inscripcion.sesion_id == sesion_id,
                Inscripcion.estado == "en_espera"
            )
            .order_by(
                Inscripcion.fecha_inscripcion.asc(),
                Inscripcion.usuario_id.asc()
            )
        ).first()

        if primer_en_espera is not None:
            primer_en_espera.estado = "aceptada"
            primer_en_espera.fecha_respuesta = datetime.now(timezone.utc).replace(tzinfo=None)
            db.flush()
            promovido_info = {
                "usuario_id": primer_en_espera.usuario_id,
                "sesion_id": primer_en_espera.sesion_id,
                "estado": primer_en_espera.estado,
            }

    db.commit()

    return {
        "mensaje": "Has salido de la sesión correctamente.",
        "promovido": promovido_info,
    }

def reprogramar_sesion(db, sesion_id, nueva_fecha, motivo, organizador_id, hoy=None):
    """
    TAREA 7: REGLA PRINCIPAL IHC CLASE 19 (Defensa paso a paso):
      1. El organizador cambia fecha u horario e indica el motivo.
      2. Los participantes confirmados pasan a pendientes de reconfirmación y conservan temporalmente su cupo.
      3. Mientras haya reconfirmaciones pendientes, no se admite otra reprogramación.
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    if sesion.usuario_id != organizador_id:
        raise ValueError("Solo el organizador de la sesión puede reprogramarla.")

    hoy_referencia = hoy or fecha_actual()
    if nueva_fecha <= hoy_referencia:
        raise ValueError("La nueva fecha de la sesión debe ser futura.")

    if not motivo or not motivo.strip():
        raise ValueError("Debes indicar un motivo para la reprogramación.")

    pendientes_reconfirmacion = db.scalar(
        select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado == "pendiente_reconfirmacion"
        )
    ) or 0

    if pendientes_reconfirmacion > 0:
        raise ValueError("No se admite otra reprogramación mientras existan participantes pendientes de reconfirmar.")

    sesion.fecha = nueva_fecha
    sesion.motivo_reprogramacion = motivo.strip()

    confirmados = db.scalars(
        select(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado == "aceptada"
        )
    ).all()

    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    cantidad_afectados = len(confirmados)

    for participante in confirmados:
        participante.estado = "pendiente_reconfirmacion"
        participante.fecha_respuesta = ahora_utc

    db.commit()
    db.refresh(sesion)

    return {
        "mensaje": f"Sesión reprogramada exitosamente para el {nueva_fecha}.",
        "participantes_en_reconfirmacion": cantidad_afectados,
        "nueva_fecha": sesion.fecha,
        "motivo": sesion.motivo_reprogramacion,
    }

def reconfirmar_participacion(db, sesion_id, usuario_id):
    """
    TAREA 7: El participante acepta la nueva fecha reprogramada por el organizador.
    Pasa de 'pendiente_reconfirmacion' de nuevo a 'aceptada' (confirmado en el cupo).
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    inscripcion = db.get(Inscripcion, (usuario_id, sesion_id))
    if inscripcion is None:
        raise ValueError("No estás registrado en esta sesión.")

    if inscripcion.estado != "pendiente_reconfirmacion":
        raise ValueError("No tienes reconfirmaciones pendientes en esta sesión.")

    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    inscripcion.estado = "aceptada"
    inscripcion.fecha_respuesta = ahora_utc

    db.commit()
    db.refresh(inscripcion)

    return {
        "mensaje": "Has reconfirmado tu asistencia a la sesión exitosamente.",
        "estado": inscripcion.estado,
    }

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

    inscritos = db.scalar(
        select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado.in_(["aceptada", "pendiente_reconfirmacion"])
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
    decision = decision.strip().lower()
    if decision not in ("aceptar", "rechazar"):
        raise ValueError("La decisión debe ser 'aceptar' o 'rechazar'.")

    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    if sesion.usuario_id != organizador_id:
        raise PermissionError("Solo el organizador de la sesión puede aceptar o rechazar solicitudes.")

    inscripcion = db.get(Inscripcion, (solicitante_id, sesion_id))
    if inscripcion is None:
        raise ValueError("No existe una solicitud de este usuario para esta sesión.")

    if inscripcion.estado != "pendiente":
        raise ValueError(f"La solicitud ya fue procesada anteriormente ({inscripcion.estado}).")

    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    if decision == "aceptar":
        aceptados = db.scalar(
            select(func.count()).select_from(Inscripcion).where(
                Inscripcion.sesion_id == sesion_id,
                Inscripcion.estado == "aceptada"
            )
        )
        if aceptados >= sesion.cupo:
            raise ValueError("No quedan cupos disponibles para aceptar esta solicitud.")
        inscripcion.estado = "aceptada"
    else:
        inscripcion.estado = "rechazada"

    inscripcion.fecha_respuesta = ahora_utc
    db.commit()
    db.refresh(inscripcion)
    return inscripcion

def listar_solicitudes_organizador(db, organizador_id, sesion_id=None):
    """
    TAREA 5: Retorna todas las solicitudes recibidas en las sesiones creadas por el organizador.
    Permite al organizador gestionar quién se une y quién no.
    """
    consulta = (
        select(Inscripcion, SesionEstudio, Usuario)
        .join(SesionEstudio, Inscripcion.sesion_id == SesionEstudio.id)
        .join(Usuario, Inscripcion.usuario_id == Usuario.id)
        .where(SesionEstudio.usuario_id == organizador_id)
    )
    if sesion_id:
        consulta = consulta.where(SesionEstudio.id == sesion_id)

    consulta = consulta.order_by(
        Inscripcion.fecha_inscripcion.desc(),
        Inscripcion.sesion_id
    )

    resultado = []
    for inscripcion, sesion, usuario in db.execute(consulta):
        posicion = None
        if inscripcion.estado == "en_espera":
            posicion = db.scalar(
                select(func.count()).select_from(Inscripcion).where(
                    Inscripcion.sesion_id == sesion.id,
                    Inscripcion.estado == "en_espera",
                    or_(
                        Inscripcion.fecha_inscripcion < inscripcion.fecha_inscripcion,
                        and_(
                            Inscripcion.fecha_inscripcion == inscripcion.fecha_inscripcion,
                            Inscripcion.usuario_id <= inscripcion.usuario_id
                        )
                    )
                )
            ) or 1

        resultado.append({
            "sesion_id": sesion.id,
            "sesion_nombre": sesion.nombre,
            "materia": sesion.materia,
            "cupo_total": sesion.cupo,
            "solicitante_id": usuario.id,
            "solicitante_nombre": usuario.nombre,
            "solicitante_email": usuario.email,
            "estado": inscripcion.estado,
            "posicion": posicion,
            "fecha_solicitud": inscripcion.fecha_inscripcion.isoformat() if inscripcion.fecha_inscripcion else None,
            "fecha_respuesta": inscripcion.fecha_respuesta.isoformat() if inscripcion.fecha_respuesta else None,
            "asistencia": inscripcion.asistencia,
            "fecha_asistencia": inscripcion.fecha_asistencia.isoformat() if inscripcion.fecha_asistencia else None,
            "justificacion": inscripcion.justificacion,
            "fecha_justificacion": inscripcion.fecha_justificacion.isoformat() if inscripcion.fecha_justificacion else None,
            "estado_justificacion": inscripcion.estado_justificacion,
            "motivo_respuesta_justificacion": inscripcion.motivo_respuesta_justificacion,
            "fecha_respuesta_justificacion": inscripcion.fecha_respuesta_justificacion.isoformat() if inscripcion.fecha_respuesta_justificacion else None,
        })
    return resultado

def listar_mis_solicitudes(db, usuario_id):
    """
    TAREA 5 y TAREA 6: Retorna todas las solicitudes enviadas por el estudiante logueado y su estado actual.
    Garantiza que el alumno vea el resultado persistente al recargar o volver a entrar,
    incluyendo su posición en lista de espera si está en_espera.
    """
    consulta = (
        select(Inscripcion, SesionEstudio, Usuario)
        .join(SesionEstudio, Inscripcion.sesion_id == SesionEstudio.id)
        .join(Usuario, SesionEstudio.usuario_id == Usuario.id)
        .where(Inscripcion.usuario_id == usuario_id)
        .order_by(Inscripcion.fecha_inscripcion.desc())
    )

    resultado = []
    for inscripcion, sesion, organizador in db.execute(consulta):
        posicion = None
        if inscripcion.estado == "en_espera":
            posicion = db.scalar(
                select(func.count()).select_from(Inscripcion).where(
                    Inscripcion.sesion_id == sesion.id,
                    Inscripcion.estado == "en_espera",
                    or_(
                        Inscripcion.fecha_inscripcion < inscripcion.fecha_inscripcion,
                        and_(
                            Inscripcion.fecha_inscripcion == inscripcion.fecha_inscripcion,
                            Inscripcion.usuario_id <= inscripcion.usuario_id
                        )
                    )
                )
            ) or 1

        resultado.append({
            "sesion_id": sesion.id,
            "sesion_nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad,
            "fecha_sesion": sesion.fecha.isoformat() if hasattr(sesion.fecha, "isoformat") else str(sesion.fecha),
            "organizador_nombre": organizador.nombre,
            "organizador_email": organizador.email,
            "estado": inscripcion.estado,
            "posicion": posicion,
            "fecha_solicitud": inscripcion.fecha_inscripcion.isoformat() if inscripcion.fecha_inscripcion else None,
            "fecha_respuesta": inscripcion.fecha_respuesta.isoformat() if inscripcion.fecha_respuesta else None,
            "asistencia": inscripcion.asistencia,
            "fecha_asistencia": fecha_iso_utc(inscripcion.fecha_asistencia),
            "justificacion": inscripcion.justificacion,
            "fecha_justificacion": fecha_iso_utc(inscripcion.fecha_justificacion),
            "estado_justificacion": inscripcion.estado_justificacion,
            "motivo_respuesta_justificacion": inscripcion.motivo_respuesta_justificacion,
            "fecha_respuesta_justificacion": fecha_iso_utc(inscripcion.fecha_respuesta_justificacion),
            "sesion_cancelada": bool(getattr(sesion, "cancelada", False)),
            "motivo_cancelacion": getattr(sesion, "motivo_cancelacion", None),
            "fecha_cancelacion": fecha_iso_utc(getattr(sesion, "fecha_cancelacion", None)),
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

    cantidades = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado.in_(["aceptada", "pendiente_reconfirmacion"])).group_by(Inscripcion.sesion_id)).all())

    en_espera_por_sesion = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado == "en_espera").group_by(Inscripcion.sesion_id)).all())

    reconfirmaciones_por_sesion = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado == "pendiente_reconfirmacion").group_by(Inscripcion.sesion_id)).all())

    mis_inscripciones_objs = {
        i.sesion_id: i
        for i in db.scalars(select(Inscripcion).where(
            Inscripcion.usuario_id == usuario_id
        )).all()
    }
    mis_inscripciones = {sid: ins.estado for sid, ins in mis_inscripciones_objs.items()}

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
        en_espera_total = en_espera_por_sesion.get(sesion.id, 0)
        reconfirmaciones_count = reconfirmaciones_por_sesion.get(sesion.id, 0)
        es_pasada = (sesion.fecha < hoy)

        posicion_espera = None
        if estado_solicitud == "en_espera":
            mi_ins = db.get(Inscripcion, (usuario_id, sesion.id))
            if mi_ins and mi_ins.fecha_inscripcion:
                posicion_espera = db.scalar(
                    select(func.count()).select_from(Inscripcion).where(
                        Inscripcion.sesion_id == sesion.id,
                        Inscripcion.estado == "en_espera",
                        or_(
                            Inscripcion.fecha_inscripcion < mi_ins.fecha_inscripcion,
                            and_(
                                Inscripcion.fecha_inscripcion == mi_ins.fecha_inscripcion,
                                Inscripcion.usuario_id <= usuario_id
                            )
                        )
                    )
                ) or 1
            else:
                posicion_espera = 1

        esta_cancelada = bool(getattr(sesion, "cancelada", False))
        motivo_cancelacion = getattr(sesion, "motivo_cancelacion", None)
        fecha_cancelacion = getattr(sesion, "fecha_cancelacion", None)

        if esta_cancelada:
            motivo = f"Sesión cancelada por el organizador. Motivo: '{motivo_cancelacion or 'Sin motivo informado'}'."
        elif estado_solicitud == "cancelada":
            motivo = f"Tu participación fue cancelada debido a la cancelación de la sesión. Motivo: '{motivo_cancelacion or 'Sin motivo'}'."
        elif estado_solicitud == "pendiente":
            motivo = "Tu solicitud está pendiente de aprobación."
        elif estado_solicitud == "en_espera":
            motivo = f"Estás en la lista de espera (Lugar #{posicion_espera})."
        elif estado_solicitud == "rechazada":
            motivo = "Tu solicitud fue rechazada por el organizador."
        elif estado_solicitud == "pendiente_reconfirmacion":
            motivo = f"La sesión fue reprogramada para el {sesion.fecha}. Motivo: '{getattr(sesion, 'motivo_reprogramacion', '') or 'Ajuste de horario'}'. Reconfirma tu asistencia para conservar tu lugar."
        else:
            motivo = motivo_para_unirse(sesion, usuario_id, inscritos, inscrito, hoy)

        if disponible and motivo:
            continue

        cupos_libres = max(0, sesion.cupo - inscritos)

        esta_finalizada = bool(getattr(sesion, "finalizada", False))

        puede_solicitar = (
            not es_organizador
            and not esta_cancelada
            and estado_solicitud is None
            and sesion.inscripciones_abiertas
            and not esta_finalizada
            and sesion.fecha >= hoy
            and cupos_libres > 0
        )

        puede_solicitar_espera = (
            not es_organizador
            and not esta_cancelada
            and estado_solicitud is None
            and sesion.inscripciones_abiertas
            and not esta_finalizada
            and sesion.fecha >= hoy
            and cupos_libres == 0
        )

        puede_abandonar = (
            not es_organizador
            and not esta_cancelada
            and estado_solicitud in ("aceptada", "en_espera", "pendiente", "pendiente_reconfirmacion")
        )

        puede_reconfirmar = (not esta_cancelada and estado_solicitud == "pendiente_reconfirmacion")

        puede_reprogramar = es_organizador and not esta_cancelada and (reconfirmaciones_count == 0) and (not es_pasada)

        puede_cancelar = (
            es_organizador
            and not esta_cancelada
            and not esta_finalizada
            and sesion.fecha >= hoy
        )

        resultado.append({
            "id": sesion.id,
            "nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad.lower(),
            "fecha": sesion.fecha,
            "cupo": sesion.cupo,
            "cupos_disponibles": cupos_libres,
            "inscripciones_abiertas": sesion.inscripciones_abiertas and not esta_cancelada,
            "inscrito": inscrito,
            "estado_solicitud": estado_solicitud,
            "es_organizador": es_organizador,
            "solicitudes_pendientes_count": pendientes_por_sesion.get(sesion.id, 0) if es_organizador else 0,
            "en_espera_count": en_espera_total,
            "posicion_espera": posicion_espera,
            "puede_unirse": puede_solicitar,
            "puede_solicitar": puede_solicitar,
            "puede_solicitar_espera": puede_solicitar_espera,
            "puede_abandonar": puede_abandonar,
            "puede_reconfirmar": puede_reconfirmar,
            "puede_reprogramar": puede_reprogramar,
            "puede_cancelar": puede_cancelar,
            "cancelada": esta_cancelada,
            "motivo_cancelacion": motivo_cancelacion,
            "fecha_cancelacion": fecha_cancelacion.isoformat() if fecha_cancelacion else None,
            "reconfirmaciones_pendientes_count": reconfirmaciones_count,
            "motivo_reprogramacion": getattr(sesion, "motivo_reprogramacion", None),
            "es_pasada": es_pasada,
            "finalizada": bool(getattr(sesion, "finalizada", False)),
            "puede_registrar_asistencia": es_organizador and not esta_cancelada and (es_pasada or bool(getattr(sesion, "finalizada", False))),
            "mi_asistencia": mis_inscripciones_objs.get(sesion.id).asistencia if mis_inscripciones_objs.get(sesion.id) else None,
            "mi_estado_justificacion": mis_inscripciones_objs.get(sesion.id).estado_justificacion if mis_inscripciones_objs.get(sesion.id) else None,
            "mi_justificacion": mis_inscripciones_objs.get(sesion.id).justificacion if mis_inscripciones_objs.get(sesion.id) else None,
            "mi_motivo_justificacion": mis_inscripciones_objs.get(sesion.id).motivo_respuesta_justificacion if mis_inscripciones_objs.get(sesion.id) else None,
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

        resultado_texto = "Inscripción aceptada"
        if inscripcion.estado == "pendiente":
            resultado_texto = "Solicitud pendiente"
        elif inscripcion.estado == "en_espera":
            resultado_texto = "En lista de espera"
        elif inscripcion.estado == "rechazada":
            resultado_texto = "Solicitud rechazada"

        if inscripcion.asistencia == "presente":
            resultado_texto = "✅ Asistencia confirmada (Presente)"
        elif inscripcion.asistencia == "ausente":
            if inscripcion.estado_justificacion == "aceptada":
                resultado_texto = f"✅ Ausencia justificada (Aceptada: {inscripcion.motivo_respuesta_justificacion or 'Aprobada'})"
            elif inscripcion.estado_justificacion == "rechazada":
                resultado_texto = f"❌ Ausencia injustificada (Rechazada: {inscripcion.motivo_respuesta_justificacion or 'Denegada'})"
            elif inscripcion.estado_justificacion == "pendiente":
                resultado_texto = "⏳ Ausente - Justificación en revisión"
            else:
                resultado_texto = "❌ Registrado como Ausente"

        historial.append({
            "sesion_id": sesion.id,
            "nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad,
            "fecha_sesion": sesion.fecha,
            "fecha_inscripcion": fecha_inscripcion,
            "estado": inscripcion.estado,
            "resultado": resultado_texto,
            "asistencia": inscripcion.asistencia,
            "fecha_asistencia": inscripcion.fecha_asistencia,
            "justificacion": inscripcion.justificacion,
            "fecha_justificacion": inscripcion.fecha_justificacion,
            "estado_justificacion": inscripcion.estado_justificacion,
            "motivo_respuesta_justificacion": inscripcion.motivo_respuesta_justificacion,
            "fecha_respuesta_justificacion": inscripcion.fecha_respuesta_justificacion,
        })

    return historial

def finalizar_sesion(db, sesion_id, usuario_id):
    """
    TAREA 8: Permite al organizador dar por terminada/finalizada una sesión de estudio.
    Restricción de seguridad: Solo el organizador creador puede finalizarla.
    Consecuencias: Cierra inscripciones y habilita el registro de asistencia.
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if not sesion:
        raise ValueError("La sesión de estudio no existe.")

    if sesion.usuario_id != usuario_id:
        raise PermissionError("Solo el organizador de la sesión tiene permisos para finalizarla.")

    sesion.finalizada = True
    sesion.inscripciones_abiertas = False
    db.commit()
    db.refresh(sesion)
    return sesion

def obtener_asistencia_sesion(db, sesion_id, usuario_id):
    """
    TAREA 8: Consulta el control de asistencia y justificaciones de una sesión.
    - Organizador: Consulta la lista de todos los participantes confirmados, su asistencia,
      justificaciones recibidas y el historial de cambios.
    - Participante confirmado: Consulta su propio estado de asistencia y justificación.
    - Usuario ajeno: Es bloqueado con PermissionError (403).
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if not sesion:
        raise ValueError("La sesión de estudio no existe.")

    es_organizador = (sesion.usuario_id == usuario_id)

    consulta = (
        select(Inscripcion, Usuario)
        .join(Usuario, Inscripcion.usuario_id == Usuario.id)
        .where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado == "aceptada"
        )
        .order_by(Usuario.nombre.asc())
    )

    participantes = []
    inscripcion_propia = None

    for ins, usu in db.execute(consulta):
        if usu.id == usuario_id:
            inscripcion_propia = ins

        participantes.append({
            "usuario_id": usu.id,
            "usuario_nombre": usu.nombre,
            "usuario_email": usu.email,
            "asistencia": ins.asistencia,
            "fecha_asistencia": fecha_iso_utc(ins.fecha_asistencia),
            "justificacion": ins.justificacion,
            "fecha_justificacion": fecha_iso_utc(ins.fecha_justificacion),
            "estado_justificacion": ins.estado_justificacion,
            "motivo_respuesta_justificacion": ins.motivo_respuesta_justificacion,
            "fecha_respuesta_justificacion": fecha_iso_utc(ins.fecha_respuesta_justificacion),
        })

    if not es_organizador and inscripcion_propia is None:
        raise PermissionError("No tienes permisos para consultar la asistencia de esta sesión.")

    UsuarioActor = aliased(Usuario, name="usuario_actor")
    UsuarioEstudiante = aliased(Usuario, name="usuario_estudiante")

    consulta_historial = (
        select(HistorialCambioAsistencia, UsuarioActor, UsuarioEstudiante)
        .join(UsuarioActor, HistorialCambioAsistencia.actor_id == UsuarioActor.id)
        .join(UsuarioEstudiante, HistorialCambioAsistencia.usuario_id == UsuarioEstudiante.id)
        .where(HistorialCambioAsistencia.sesion_id == sesion_id)
        .order_by(HistorialCambioAsistencia.fecha.asc(), HistorialCambioAsistencia.id.asc())
    )

    historial = []
    for h, actor, estudiante in db.execute(consulta_historial):
        if es_organizador or h.usuario_id == usuario_id:
            historial.append({
                "id": h.id,
                "usuario_id": h.usuario_id,
                "estudiante_nombre": estudiante.nombre,
                "estudiante_email": estudiante.email,
                "actor_id": h.actor_id,
                "actor_nombre": actor.nombre,
                "actor_rol": "Organizador" if h.actor_id == sesion.usuario_id else "Estudiante",
                "tipo_evento": h.tipo_evento,
                "estado_anterior": h.estado_anterior,
                "estado_nuevo": h.estado_nuevo,
                "detalle": h.detalle,
                "fecha": fecha_iso_utc(h.fecha),
            })

    hoy = fecha_actual()
    es_pasada = (sesion.fecha <= hoy)
    esta_concluida = es_pasada or bool(getattr(sesion, "finalizada", False))
    puede_gestionar = es_organizador and esta_concluida

    asistencia_registrada_previamente = any(
        p.get("asistencia") is not None for p in participantes
    )

    return {
        "sesion_id": sesion.id,
        "sesion_nombre": sesion.nombre,
        "fecha_sesion": sesion.fecha.isoformat() if hasattr(sesion.fecha, "isoformat") else str(sesion.fecha),
        "es_organizador": es_organizador,
        "finalizada": bool(getattr(sesion, "finalizada", False)),
        "es_pasada": es_pasada,
        "esta_concluida": esta_concluida,
        "puede_gestionar": puede_gestionar,
        "asistencia_registrada_previamente": asistencia_registrada_previamente,
        "participantes": participantes if es_organizador else [p for p in participantes if p["usuario_id"] == usuario_id],
        "historial": historial,
    }

def registrar_asistencia_batch(db, sesion_id, organizador_id, asistencias):
    """
    TAREA 8: El organizador registra presentes o ausentes para los participantes confirmados.
    Restricciones y reglas de negocio:
    1. Solo el organizador creador tiene permisos para registrar o modificar la asistencia.
    2. La sesión debe haber concluido (fecha <= hoy o finalizada); si no, se finaliza automáticamente al registrar.
    3. Solo se puede registrar asistencia de participantes con inscripción confirmada ('aceptada').
    4. Conserva el historial de cambios con tipo_evento='registro_asistencia'.
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if not sesion:
        raise ValueError("La sesión de estudio no existe.")

    if sesion.usuario_id != organizador_id:
        raise PermissionError("Solo el organizador de la sesión tiene permisos para registrar o modificar la asistencia.")

    if bool(getattr(sesion, "cancelada", False)):
        raise ValueError("No se puede registrar asistencia en una sesión que ha sido cancelada.")

    hoy = fecha_actual()
    es_pasada = (sesion.fecha <= hoy)
    if not (es_pasada or bool(getattr(sesion, "finalizada", False))):
        sesion.finalizada = True
        sesion.inscripciones_abiertas = False

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    actualizados = 0

    for item in asistencias:
        uid = item.usuario_id
        asist_val = item.asistencia.strip().lower()
        if asist_val not in ("presente", "ausente"):
            raise ValueError(f"Estado de asistencia inválido: '{asist_val}'. Debe ser 'presente' o 'ausente'.")

        inscripcion = db.get(Inscripcion, (uid, sesion_id))
        if not inscripcion:
            raise ValueError(f"El usuario con ID {uid} no está inscrito en esta sesión.")

        if inscripcion.estado != "aceptada":
            raise ValueError("Solo se puede registrar asistencia de participantes con inscripción confirmada (aceptada).")

        estado_anterior = inscripcion.asistencia
        inscripcion.asistencia = asist_val
        inscripcion.fecha_asistencia = ahora

        if asist_val == "presente" and inscripcion.estado_justificacion == "pendiente":
            inscripcion.estado_justificacion = None

        estudiante_obj = db.get(Usuario, uid)
        nombre_est = estudiante_obj.nombre if estudiante_obj else f"Usuario #{uid}"

        es_modificacion = (estado_anterior is not None)
        tipo_evento = "modificacion_asistencia" if es_modificacion else "registro_asistencia"

        if es_modificacion:
            detalle = f"Asistencia de {nombre_est} modificada de {estado_anterior.upper()} a: {asist_val.upper()}"
        else:
            detalle = f"Asistencia de {nombre_est} registrada como: {asist_val.upper()}"

        db.add(HistorialCambioAsistencia(
            sesion_id=sesion_id,
            usuario_id=uid,
            actor_id=organizador_id,
            tipo_evento=tipo_evento,
            estado_anterior=estado_anterior,
            estado_nuevo=asist_val,
            detalle=detalle,
            fecha=ahora,
        ))
        actualizados += 1

    db.commit()
    return {
        "mensaje": f"Se registró la asistencia de {actualizados} participante(s) correctamente.",
        "actualizados": actualizados,
    }

def presentar_justificacion(db, sesion_id, estudiante_id, texto_justificacion):
    """
    TAREA 8: Un estudiante registrado como ausente presenta su justificación.
    Restricciones y reglas de negocio:
    1. Solo el propio estudiante titular puede presentar su justificación.
    2. Debe estar inscrito en la sesión y figurar como 'ausente'.
    3. El texto no puede estar vacío (mínimo 5 caracteres).
    4. Pasa el estado de justificación a 'pendiente' y guarda la marca de tiempo y auditoría.
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if not sesion:
        raise ValueError("La sesión de estudio no existe.")

    inscripcion = db.get(Inscripcion, (estudiante_id, sesion_id))
    if not inscripcion:
        raise ValueError("No estás inscrito en esta sesión.")

    if inscripcion.asistencia != "ausente":
        raise ValueError("Solo los estudiantes registrados como ausentes pueden presentar una justificación.")

    texto_limpio = texto_justificacion.strip()
    if len(texto_limpio) < 5:
        raise ValueError("La justificación debe contener al menos 5 caracteres explicativos.")

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    estado_ant = inscripcion.estado_justificacion or "sin_justificar"

    inscripcion.justificacion = texto_limpio
    inscripcion.estado_justificacion = "pendiente"
    inscripcion.fecha_justificacion = ahora

    estudiante_obj = db.get(Usuario, estudiante_id)
    nombre_est = estudiante_obj.nombre if estudiante_obj else f"Usuario #{estudiante_id}"

    db.add(HistorialCambioAsistencia(
        sesion_id=sesion_id,
        usuario_id=estudiante_id,
        actor_id=estudiante_id,
        tipo_evento="envio_justificacion",
        estado_anterior=estado_ant,
        estado_nuevo="pendiente",
        detalle=f"Justificación enviada por {nombre_est}: '{texto_limpio}'",
        fecha=ahora,
    ))
    db.commit()

    return {
        "mensaje": "Justificación presentada correctamente. Queda en estado pendiente de evaluación por el organizador.",
        "estado_justificacion": "pendiente",
        "justificacion": texto_limpio,
    }

def responder_justificacion(db, sesion_id, estudiante_id, organizador_id, decision, motivo):
    """
    TAREA 8: El organizador acepta o rechaza una justificación con motivo obligatorio.
    Restricciones y reglas de negocio:
    1. Solo el organizador creador tiene permisos para resolver justificaciones.
    2. El motivo explicativo es obligatorio (mínimo 3 caracteres).
    3. Debe existir una justificación en estado 'pendiente'.
    4. Consecuencias: estado pasa a 'aceptada' o 'rechazada', persistiendo la fecha y el motivo.
    5. Conserva el historial de cambios con tipo_evento='resolucion_justificacion'.
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if not sesion:
        raise ValueError("La sesión de estudio no existe.")

    if sesion.usuario_id != organizador_id:
        raise PermissionError("Solo el organizador de la sesión puede aceptar o rechazar justificaciones.")

    inscripcion = db.get(Inscripcion, (estudiante_id, sesion_id))
    if not inscripcion:
        raise ValueError("El estudiante no está inscrito en esta sesión.")

    if inscripcion.estado_justificacion != "pendiente":
        raise ValueError("No existe una justificación pendiente para este participante.")

    dec = decision.strip().lower()
    if dec not in ("aceptar", "rechazar"):
        raise ValueError("La decisión debe ser 'aceptar' o 'rechazar'.")

    motivo_limpio = motivo.strip()
    if len(motivo_limpio) < 3:
        raise ValueError("El motivo de la decisión es obligatorio (mínimo 3 caracteres).")

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    nuevo_estado = "aceptada" if dec == "aceptar" else "rechazada"

    inscripcion.estado_justificacion = nuevo_estado
    inscripcion.motivo_respuesta_justificacion = motivo_limpio
    inscripcion.fecha_respuesta_justificacion = ahora

    estudiante_obj = db.get(Usuario, estudiante_id)
    nombre_est = estudiante_obj.nombre if estudiante_obj else f"Usuario #{estudiante_id}"

    db.add(HistorialCambioAsistencia(
        sesion_id=sesion_id,
        usuario_id=estudiante_id,
        actor_id=organizador_id,
        tipo_evento="resolucion_justificacion",
        estado_anterior="pendiente",
        estado_nuevo=nuevo_estado,
        detalle=f"Decisión para {nombre_est}: {dec.upper()}. Motivo: {motivo_limpio}",
        fecha=ahora,
    ))
    db.commit()

    return {
        "mensaje": f"Justificación {nuevo_estado} correctamente con motivo: '{motivo_limpio}'.",
        "estado_justificacion": nuevo_estado,
        "motivo": motivo_limpio,
    }

def cancelar_sesion_estudio(db, sesion_id: int, organizador_id: int, motivo: str):
    """
    TAREA 9 (PARTE B): El organizador cancela formalmente una sesión de estudio.
    Reglas de la Diapositiva 12/13:
    1. Solo el organizador creador tiene permisos para cancelar (HTTP 403 para usuarios ajenos).
    2. Solo antes de la fecha (sesion.fecha >= hoy y no finalizada).
    3. Motivo obligatorio provisto por el organizador (mínimo 5 caracteres).
    4. Consecuencia: Confirmados, pendientes y en espera pasan a 'cancelada' y ven el motivo.
    5. No se admiten nuevas solicitudes ni asistencia posterior.
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if not sesion:
        raise ValueError("La sesión de estudio no existe.")

    if sesion.usuario_id != organizador_id:
        raise PermissionError("Solo el organizador de la sesión tiene permisos para cancelarla.")

    if bool(getattr(sesion, "cancelada", False)):
        raise ValueError("Esta sesión de estudio ya ha sido cancelada previamente.")

    hoy = fecha_actual()
    if sesion.fecha < hoy or bool(getattr(sesion, "finalizada", False)):
        raise ValueError("No se puede cancelar una sesión que ya ha concluido o cuya fecha ya ha pasado.")

    motivo_limpio = (motivo or "").strip()
    if len(motivo_limpio) < 5:
        raise ValueError("El motivo de cancelación es obligatorio y debe tener al menos 5 caracteres.")

    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    sesion.cancelada = True
    sesion.motivo_cancelacion = motivo_limpio
    sesion.fecha_cancelacion = ahora_utc
    sesion.inscripciones_abiertas = False

    inscripciones = db.scalars(
        select(Inscripcion).where(Inscripcion.sesion_id == sesion_id)
    ).all()

    afectados = 0
    for insc in inscripciones:
        if insc.estado in ("aceptada", "pendiente", "en_espera", "pendiente_reconfirmacion"):
            insc.estado = "cancelada"
            afectados += 1

    db.commit()

    return {
        "mensaje": f"Sesión cancelada exitosamente con motivo: '{motivo_limpio}'.",
        "sesion_id": sesion.id,
        "motivo": motivo_limpio,
        "participantes_cancelados": afectados,
    }

def registrar_evento_db(db, nombre_evento: str, props: dict, fecha_iso: str | None = None):
    """
    Guarda un evento en la tabla 'eventos' de la base de datos de la aplicación.
    Cumple con la diapositiva 7/13:
    - Evento: objeto_accion_en_pasado (ej. 'solicitud_iniciada', 'solicitud_enviada')
    - Props: Diccionario mínimo serializado a JSON string
    - Fecha: Marca temporal ISO 8601
    """
    if not fecha_iso:
        fecha_iso = datetime.now(timezone.utc).isoformat()

    props_str = json.dumps(props or {})

    nuevo_evento = Evento(
        evento=nombre_evento.strip(),
        props=props_str,
        fecha=fecha_iso,
    )
    db.add(nuevo_evento)
    db.commit()
    db.refresh(nuevo_evento)

    return {
        "id": nuevo_evento.id,
        "evento": nuevo_evento.evento,
        "props": props,
        "fecha": nuevo_evento.fecha,
        "mensaje": "Evento registrado correctamente.",
    }

def obtener_resumen_analitica(db):
    """
    TAREA 9 (PARTE A): Analítica completa del producto con embudos de flujos principales.
    Consulta obligatoria solicitada por el docente en la diapositiva 10/13 y 11/13:
    SELECT evento, COUNT(*) FROM eventos GROUP BY evento;

    Calcula:
    1. Embudo 1: Solicitud de sesión (solicitud_iniciada -> solicitud_enviada / solicitud_fallida)
    2. Embudo 2: Creación de sesión (sesion_creacion_iniciada -> sesion_creada / sesion_creacion_fallida)
    3. Embudo 3: Justificaciones (justificacion_iniciada -> justificacion_enviada / justificacion_fallida)
    4. Embudo 4: Cancelaciones (cancelacion_sesion_iniciada -> sesion_cancelada / cancelacion_fallida)
    5. Métricas de búsqueda y filtros sin resultados (busqueda_sin_resultados)
    6. Identificación automática del paso con mayor caída (drop-off) para diseño IHC.
    """
    consulta_sql = text("SELECT evento, COUNT(*) as cantidad FROM eventos GROUP BY evento")
    filas = db.execute(consulta_sql).fetchall()

    conteos = {fila[0]: int(fila[1]) for fila in filas}

    def calcular_metricas_embudo(inicio_key, exito_key, error_key, nombre_flujo, pregunta_ihc):
        inicios = conteos.get(inicio_key, 0)
        exitos = conteos.get(exito_key, 0)
        errores = conteos.get(error_key, 0)
        tasa_exito = round((exitos / inicios) * 100) if inicios > 0 else 0
        caida = max(0, 100 - tasa_exito) if inicios > 0 else 0
        return {
            "flujo": nombre_flujo,
            "evento_inicio": inicio_key,
            "inicios": inicios,
            "evento_exito": exito_key,
            "exitos": exitos,
            "evento_error": error_key,
            "errores": errores,
            "tasa_exito": tasa_exito,
            "tasa_caida": caida,
            "pregunta": pregunta_ihc,
        }

    embudo_solicitud = calcular_metricas_embudo(
        "solicitud_iniciada", "solicitud_enviada", "solicitud_fallida",
        "Solicitud de ingreso a sesión",
        "¿Qué porcentaje de estudiantes desiste al abrir el formulario de postulación?"
    )

    embudo_creacion = calcular_metricas_embudo(
        "sesion_creacion_iniciada", "sesion_creada", "sesion_creacion_fallida",
        "Creación de sesión por organizador",
        "¿Cuántos organizadores abandonan la creación por formularios largos o errores de cupo?"
    )

    embudo_justificacion = calcular_metricas_embudo(
        "justificacion_iniciada", "justificacion_enviada", "justificacion_fallida",
        "Envío de justificación por estudiante ausente",
        "¿Cuántos estudiantes ausentes completan la redacción de su justificación?"
    )

    embudo_cancelacion = calcular_metricas_embudo(
        "cancelacion_sesion_iniciada", "sesion_cancelada", "cancelacion_fallida",
        "Cancelación formal de sesión",
        "¿Con qué frecuencia los organizadores confirman la cancelación tras ver el impacto?"
    )

    embudos = [embudo_solicitud, embudo_creacion, embudo_justificacion, embudo_cancelacion]

    embudos_con_datos = [e for e in embudos if e["inicios"] > 0]
    if embudos_con_datos:
        flujo_mayor_caida = max(embudos_con_datos, key=lambda x: x["tasa_caida"])
    else:
        flujo_mayor_caida = embudo_solicitud

    ultimos_query = select(Evento).order_by(Evento.id.desc()).limit(25)
    eventos_db = db.scalars(ultimos_query).all()

    ultimos_eventos = []
    for ev in eventos_db:
        try:
            p = json.loads(ev.props) if ev.props else {}
        except Exception:
            p = {}
        ultimos_eventos.append({
            "id": ev.id,
            "evento": ev.evento,
            "props": p,
            "fecha": ev.fecha,
        })

    return {
        "conteo": {
            "solicitud_iniciada": conteos.get("solicitud_iniciada", 0),
            "solicitud_enviada": conteos.get("solicitud_enviada", 0),
        },
        "porcentaje_terminan": embudo_solicitud["tasa_exito"],
        "embudos": embudos,
        "flujo_mayor_caida": flujo_mayor_caida,
        "busquedas_sin_resultados": conteos.get("busqueda_sin_resultados", 0),
        "ultimos_eventos": ultimos_eventos,
        "desglose_completo": conteos,
    }

def obtener_expediente_mis_datos(db, usuario_id: int) -> dict:
    """
    TAREA 10 (Parte 1): 'Mis datos: ver y descargar (JSON o CSV)'
    Recopila en un único expediente estructurado y transparente toda la
    información almacenada en la plataforma asociada al estudiante autenticado.
    Cumple con el principio ético de portabilidad de datos sin obstáculos.
    """
    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise ValueError("El usuario no existe en la base de datos.")

    query_organizadas = select(SesionEstudio).where(SesionEstudio.usuario_id == usuario_id).order_by(SesionEstudio.id.desc())
    sesiones_db = db.scalars(query_organizadas).all()

    sesiones_organizadas = []
    for s in sesiones_db:
        total_part = db.scalar(
            select(func.count()).select_from(Inscripcion).where(Inscripcion.sesion_id == s.id)
        ) or 0
        sesiones_organizadas.append({
            "id": s.id,
            "nombre": s.nombre,
            "materia": s.materia,
            "fecha": str(s.fecha),
            "modalidad": s.modalidad,
            "cupo": s.cupo,
            "inscripciones_abiertas": s.inscripciones_abiertas,
            "finalizada": bool(getattr(s, "finalizada", False)),
            "cancelada": bool(getattr(s, "cancelada", False)),
            "motivo_cancelacion": getattr(s, "motivo_cancelacion", None),
            "total_participantes": total_part,
        })

    query_inscripciones = (
        select(Inscripcion, SesionEstudio)
        .join(SesionEstudio, Inscripcion.sesion_id == SesionEstudio.id)
        .where(Inscripcion.usuario_id == usuario_id)
        .order_by(Inscripcion.sesion_id.desc())
    )
    inscripciones_db = db.execute(query_inscripciones).all()

    mis_inscripciones = []
    asistencias_presentes = 0
    for insc, ses in inscripciones_db:
        if insc.asistencia == "presente":
            asistencias_presentes += 1

        mis_inscripciones.append({
            "sesion_id": ses.id,
            "sesion_nombre": ses.nombre,
            "materia": ses.materia,
            "fecha_sesion": str(ses.fecha),
            "modalidad": ses.modalidad,
            "estado_solicitud": insc.estado,
            "fecha_inscripcion": str(insc.fecha_inscripcion) if insc.fecha_inscripcion else None,
            "asistencia": insc.asistencia,
            "justificacion": insc.justificacion,
            "estado_justificacion": insc.estado_justificacion,
        })

    return {
        "perfil": {
            "id": usuario.id,
            "nombre": usuario.nombre,
            "email": usuario.email,
            "activo": bool(getattr(usuario, "activo", True)),
            "fecha_eliminacion": str(getattr(usuario, "fecha_eliminacion", None)) if getattr(usuario, "fecha_eliminacion", None) else None,
        },
        "estadisticas": {
            "total_sesiones_organizadas": len(sesiones_organizadas),
            "total_solicitudes_e_inscripciones": len(mis_inscripciones),
            "total_asistencias_confirmadas": asistencias_presentes,
        },
        "sesiones_organizadas": sesiones_organizadas,
        "solicitudes_e_inscripciones": mis_inscripciones,
    }

def exportar_mis_datos_csv(expediente: dict) -> str:
    """
    TAREA 10 (Parte 1): Genera una representación en formato CSV plano
    a partir del expediente de datos del usuario, asegurando portabilidad
    en hojas de cálculo estándar (Excel, Google Sheets).
    """
    import io
    import csv

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["=== PERFIL DE USUARIO ==="])
    writer.writerow(["ID", "Nombre", "Email", "Estado Cuenta"])
    p = expediente.get("perfil", {})
    writer.writerow([p.get("id"), p.get("nombre"), p.get("email"), "Activo" if p.get("activo") else "Inactivo"])
    writer.writerow([])

    writer.writerow(["=== RESUMEN DE ACTIVIDAD ==="])
    est = expediente.get("estadisticas", {})
    writer.writerow(["Metrica", "Cantidad"])
    writer.writerow(["Sesiones Organizadas", est.get("total_sesiones_organizadas", 0)])
    writer.writerow(["Solicitudes e Inscripciones", est.get("total_solicitudes_e_inscripciones", 0)])
    writer.writerow(["Asistencias Confirmadas", est.get("total_asistencias_confirmadas", 0)])
    writer.writerow([])

    writer.writerow(["=== SESIONES ORGANIZADAS ==="])
    writer.writerow(["ID", "Nombre", "Materia", "Fecha", "Modalidad", "Cupo", "Estado"])
    for s in expediente.get("sesiones_organizadas", []):
        estado_txt = "Cancelada" if s.get("cancelada") else ("Finalizada" if s.get("finalizada") else "Activa")
        writer.writerow([s.get("id"), s.get("nombre"), s.get("materia"), s.get("fecha"), s.get("modalidad"), s.get("cupo"), estado_txt])
    writer.writerow([])

    writer.writerow(["=== MIS INSCRIPCIONES Y SOLICITUDES ==="])
    writer.writerow(["Sesion ID", "Nombre Sesion", "Materia", "Fecha Sesion", "Modalidad", "Estado Solicitud", "Asistencia"])
    for ins in expediente.get("solicitudes_e_inscripciones", []):
        writer.writerow([
            ins.get("sesion_id"),
            ins.get("sesion_nombre"),
            ins.get("materia"),
            ins.get("fecha_sesion"),
            ins.get("modalidad"),
            ins.get("estado_solicitud"),
            ins.get("asistencia") or "No registrada",
        ])

    return output.getvalue()

def eliminar_cuenta_usuario(db, usuario_id: int, password_confirmacion: str, motivo_cancelacion_sesiones: str | None = None) -> dict:
    """
    TAREA 10 (Partes 2 y 3): Salida Honesta y Regla Difícil de StudyMatch (Diapositiva 13/16).
    Regla asignada:
      'Las sesiones que organiza se cancelan y los participantes ven el motivo.
       Sale de las listas de espera sin afectar el orden de los demás.'
      'si la regla bloquea la eliminación, el mensaje dice por qué y qué hacer para poder eliminarla.'
    """
    from app.services import verificar_password

    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise ValueError("El usuario que intenta eliminar la cuenta no existe.")

    if not verificar_password(password_confirmacion, usuario.password_hash):
        raise ValueError("La contraseña de confirmación es incorrecta. Ingrésala nuevamente para verificar tu identidad.")

    query_sesiones_activas = select(SesionEstudio).where(
        SesionEstudio.usuario_id == usuario_id,
        SesionEstudio.cancelada == False,
    )
    sesiones_activas = db.scalars(query_sesiones_activas).all()

    sesiones_con_participantes = []
    total_participantes_afectados = 0
    for s in sesiones_activas:
        part_count = db.scalar(
            select(func.count()).select_from(Inscripcion).where(
                Inscripcion.sesion_id == s.id,
                Inscripcion.estado.in_(["aceptada", "pendiente", "en_espera", "pendiente_reconfirmacion"])
            )
        ) or 0
        if part_count > 0:
            sesiones_con_participantes.append(s)
            total_participantes_afectados += part_count

    motivo_limpio = (motivo_cancelacion_sesiones or "").strip()
    if len(sesiones_con_participantes) > 0 and len(motivo_limpio) < 5:
        return {
            "bloqueado": True,
            "por_que": f"Tienes {len(sesiones_con_participantes)} sesión(es) activa(s) como organizador con {total_participantes_afectados} estudiante(s) inscrito(s).",
            "que_hacer": "Ingresa el motivo de cancelación obligatorio (mínimo 5 caracteres) que verán tus participantes para que sean notificados formalmente antes de eliminar tu cuenta.",
            "sesiones_afectadas": len(sesiones_con_participantes),
            "participantes_afectados": total_participantes_afectados,
        }

    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    motivo_final = motivo_limpio if motivo_limpio else "El organizador ha eliminado su cuenta de la plataforma."
    sesiones_canceladas_count = 0

    for s in sesiones_activas:
        s.cancelada = True
        s.motivo_cancelacion = motivo_final
        s.fecha_cancelacion = ahora_utc
        s.inscripciones_abiertas = False
        sesiones_canceladas_count += 1

        inscriptions_s = db.scalars(select(Inscripcion).where(Inscripcion.sesion_id == s.id)).all()
        for ins in inscriptions_s:
            if ins.estado in ("aceptada", "pendiente", "en_espera", "pendiente_reconfirmacion"):
                ins.estado = "cancelada"

    query_mis_inscripciones = select(Inscripcion).where(Inscripcion.usuario_id == usuario_id)
    mis_inscripciones = db.scalars(query_mis_inscripciones).all()
    filas_espera_liberadas = 0

    for ins in mis_inscripciones:
        ses_id = ins.sesion_id
        estado_previo = ins.estado

        db.delete(ins)

        if estado_previo == "aceptada":
            primer_espera = db.scalars(
                select(Inscripcion)
                .where(Inscripcion.sesion_id == ses_id, Inscripcion.estado == "en_espera")
                .order_by(Inscripcion.fecha_inscripcion.asc(), Inscripcion.usuario_id.asc())
            ).first()
            if primer_espera:
                primer_espera.estado = "aceptada"
                primer_espera.fecha_respuesta = ahora_utc

        if estado_previo == "en_espera":
            filas_espera_liberadas += 1

    usuario.activo = False
    usuario.fecha_eliminacion = ahora_utc

    db.commit()

    return {
        "bloqueado": False,
        "mensaje": "Tu cuenta ha sido eliminada permanentemente y de manera honesta.",
        "sesiones_canceladas": sesiones_canceladas_count,
        "participantes_notificados": total_participantes_afectados,
        "filas_espera_liberadas": filas_espera_liberadas,
    }

