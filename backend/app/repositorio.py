from datetime import datetime, timedelta, timezone
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.orm import aliased
from sqlalchemy.exc import IntegrityError
from app.modelos_db import HistorialCambioAsistencia, Inscripcion, SesionEstudio, Usuario


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
# --- TAREA 5 y TAREA 6: Flujo de Solicitudes y Lista de Espera ---
# ==============================================================================

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
    # Paso 1: Obtener la sesión por su ID y validar que exista en la tabla 'sesiones'
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    # Paso 2: Regla: El organizador que creó la sesión no puede postularse como alumno
    if sesion.usuario_id == usuario_id:
        raise ValueError("Eres el creador de esta sesión.")

    # Paso 3: Regla: Comprobar que el organizador no haya cerrado las inscripciones
    if not sesion.inscripciones_abiertas:
        raise ValueError("Las inscripciones están cerradas.")

    # Paso 4: Regla: Permitir unirse si la sesión es HOY o en el futuro (sesion.fecha >= hoy)
    # Se rechaza si la sesión ya ocurrió en el pasado (sesion.fecha < hoy) o si ya fue concluida
    fecha_limite = (hoy or fecha_actual())
    if sesion.fecha < fecha_limite:
        raise ValueError("No puedes unirte a sesiones que ya ocurrieron en el pasado.")
    if bool(getattr(sesion, "finalizada", False)):
        raise ValueError("Las inscripciones están cerradas porque la sesión ya concluyó.")

    # Paso 5: Consultar si ya existe un registro de este estudiante para esta sesión
    inscripcion = db.get(Inscripcion, (usuario_id, sesion_id))
    # Marca de tiempo exacta en UTC sin timezone para compatibilidad con Postgres y SQLite
    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    if inscripcion is not None:
        # Si ya tiene una solicitud pendiente de aprobación, no duplicar
        if inscripcion.estado == "pendiente":
            raise ValueError("Ya tienes una solicitud pendiente para esta sesión.")
        # Si ya fue aceptado, ya forma parte del grupo confirmado
        if inscripcion.estado == "aceptada":
            raise ValueError("Ya estás inscrito en esta sesión.")
        # TAREA 7: Si está en proceso de reconfirmación, ya tiene su vacante reservada
        if inscripcion.estado == "pendiente_reconfirmacion":
            raise ValueError("Ya tienes un cupo en esta sesión (pendiente de reconfirmar).")
        # TAREA 6: Si ya está en la lista de espera, evitar que ocupe dos turnos
        if inscripcion.estado == "en_espera":
            raise ValueError("Ya estás en la lista de espera de esta sesión.")
        # Si fue rechazada previamente, se le permite volver a postularse actualizando la fecha
        if inscripcion.estado == "rechazada":
            inscripcion.fecha_inscripcion = ahora_utc
            inscripcion.fecha_respuesta = None

    # Paso 6: Contar cuántos cupos reales están ocupados
    # TAREA 7: Los participantes confirmados y los que están en 'pendiente_reconfirmacion' conservan su cupo
    inscritos_aceptados = db.scalar(
        select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado.in_(["aceptada", "pendiente_reconfirmacion"])
        )
    )

    # Paso 7: Determinar si la sesión ya alcanzó su capacidad máxima de cupos
    esta_llena = (inscritos_aceptados >= sesion.cupo)

    if esta_llena:
        if not permitir_espera:
            # Compatibilidad estricta con pruebas de rechazo sin lista de espera
            raise ValueError("No quedan cupos disponibles.")
        # REGLA TAREA 6: Al estar llena, el estado asignado es 'en_espera' (Lista de Espera FIFO)
        nuevo_estado = "en_espera"
    else:
        # Si aún hay cupo libre, el estado es 'pendiente' esperando revisión del organizador
        nuevo_estado = "pendiente"

    # Si venía de una inscripción previa rechazada, reutilizamos la tupla actualizando el estado
    if inscripcion is not None and inscripcion.estado == "rechazada":
        inscripcion.estado = nuevo_estado  # Cambia a 'en_espera' o 'pendiente'
        db.commit()                        # Guarda en la base de datos
        db.refresh(inscripcion)            # Refresca el objeto en memoria
        return inscripcion

    # Paso 8: Registrar en la tabla 'inscriprciones' la nueva solicitud con su estado correspondiente
    nueva_solicitud = Inscripcion(
        usuario_id=usuario_id,         # Clave foránea al usuario estudiante
        sesion_id=sesion_id,           # Clave foránea a la sesión de estudio
        estado=nuevo_estado,           # 'en_espera' (si llena) o 'pendiente' (si hay cupo)
        fecha_inscripcion=ahora_utc,   # Marca temporal exacta para garantizar orden FIFO
    )
    db.add(nueva_solicitud)            # Agrega la entidad a la sesión de SQLAlchemy
    db.commit()                        # Confirma la transacción en la BD
    db.refresh(nueva_solicitud)        # Actualiza el objeto con los datos persistidos
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
    # Paso 1: Validar que la sesión exista
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    # Paso 2: Validar que el usuario esté inscrito o en lista de espera en esta sesión
    inscripcion = db.get(Inscripcion, (usuario_id, sesion_id))
    if inscripcion is None:
        raise ValueError("No estás registrado en esta sesión.")

    # Paso 3: Guardar el estado que tenía el alumno antes de borrarlo de la base de datos
    estado_anterior = inscripcion.estado

    # Paso 4: Eliminar la inscripción actual para liberar el cupo o su lugar en la fila
    db.delete(inscripcion)
    db.flush()  # Aplica el borrado en la transacción SQL sin cerrarla todavía

    promovido_info = None  # Almacenará los datos del estudiante promovido (si hubo alguno)

    # Paso 5: REGLA CENTRAL TAREA 6 & TAREA 7:
    # Si el usuario que salió tenía cupo confirmado ('aceptada') O estaba en 'pendiente_reconfirmacion':
    # Regla IHC Clase 19: 'Cada uno acepta o se retira; retirarse libera el cupo y promueve al primero en espera.'
    if estado_anterior in ("aceptada", "pendiente_reconfirmacion"):
        # Consulta SQL para seleccionar al primer estudiante en espera por orden de llegada (FIFO)
        primer_en_espera = db.scalars(
            select(Inscripcion)
            .where(
                Inscripcion.sesion_id == sesion_id,  # Para la misma sesión
                Inscripcion.estado == "en_espera"    # Que esté en la lista de espera
            )
            .order_by(
                Inscripcion.fecha_inscripcion.asc(), # Primero en llegar (FIFO)
                Inscripcion.usuario_id.asc()         # Desempate determinista por ID
            )
        ).first()  # Obtener el primer postulante de la fila

        # Si hay un estudiante en espera, se le promueve de forma automática e inmediata (asciende una sola vez)
        if primer_en_espera is not None:
            primer_en_espera.estado = "aceptada"  # Pasa automáticamente a Confirmado ('aceptada')
            # Marca de tiempo de cuándo el sistema lo promovió automáticamente
            primer_en_espera.fecha_respuesta = datetime.now(timezone.utc).replace(tzinfo=None)
            db.flush()  # Aplica los cambios en la BD
            promovido_info = {
                "usuario_id": primer_en_espera.usuario_id,
                "sesion_id": primer_en_espera.sesion_id,
                "estado": primer_en_espera.estado,
            }

    # Paso 6: Confirmar la transacción atómica en la base de datos
    db.commit()

    # Devolver el resultado de la operación
    return {
        "mensaje": "Has salido de la sesión correctamente.",
        "promovido": promovido_info,
    }


# ==============================================================================
# --- TAREA 7: REPROGRAMAR SESIÓN CON RECONFIRMACIÓN ---
# ==============================================================================

def reprogramar_sesion(db, sesion_id, nueva_fecha, motivo, organizador_id, hoy=None):
    """
    TAREA 7: REGLA PRINCIPAL IHC CLASE 19 (Defensa paso a paso):
      1. El organizador cambia fecha u horario e indica el motivo.
      2. Los participantes confirmados pasan a pendientes de reconfirmación y conservan temporalmente su cupo.
      3. Mientras haya reconfirmaciones pendientes, no se admite otra reprogramación.
    """
    # Paso 1: Validar existencia de la sesión en la base de datos
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    # Paso 2: Validar que quien intenta reprogramar sea el organizador creador
    if sesion.usuario_id != organizador_id:
        raise ValueError("Solo el organizador de la sesión puede reprogramarla.")

    # Paso 3: Validar que la nueva fecha sea estrictamente futura
    hoy_referencia = hoy or fecha_actual()
    if nueva_fecha <= hoy_referencia:
        raise ValueError("La nueva fecha de la sesión debe ser futura.")

    # Paso 4: Validar que el motivo esté presente y no sea texto en blanco
    if not motivo or not motivo.strip():
        raise ValueError("Debes indicar un motivo para la reprogramación.")

    # Paso 5: REGLA CENTRAL TAREA 7:
    # "Mientras haya reconfirmaciones pendientes, no se admite otra reprogramación."
    pendientes_reconfirmacion = db.scalar(
        select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado == "pendiente_reconfirmacion"
        )
    ) or 0

    if pendientes_reconfirmacion > 0:
        raise ValueError("No se admite otra reprogramación mientras existan participantes pendientes de reconfirmar.")

    # Paso 6: Actualizar la fecha y el motivo en la sesión
    sesion.fecha = nueva_fecha
    sesion.motivo_reprogramacion = motivo.strip()

    # Paso 7: REGLA TAREA 7:
    # "Los participantes confirmados pasan a pendientes de reconfirmación y conservan temporalmente su cupo."
    confirmados = db.scalars(
        select(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado == "aceptada"
        )
    ).all()

    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    cantidad_afectados = len(confirmados)

    # Cada alumno confirmado pasa a 'pendiente_reconfirmacion'
    for participante in confirmados:
        participante.estado = "pendiente_reconfirmacion"
        participante.fecha_respuesta = ahora_utc

    # Paso 8: Confirmar los cambios en la base de datos
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
    # Paso 1: Validar que la sesión exista
    sesion = db.get(SesionEstudio, sesion_id)
    if sesion is None:
        raise ValueError("La sesión no existe.")

    # Paso 2: Obtener la inscripción del estudiante
    inscripcion = db.get(Inscripcion, (usuario_id, sesion_id))
    if inscripcion is None:
        raise ValueError("No estás registrado en esta sesión.")

    # Paso 3: Validar que su estado requiera efectivamente reconfirmación
    if inscripcion.estado != "pendiente_reconfirmacion":
        raise ValueError("No tienes reconfirmaciones pendientes en esta sesión.")

    # Paso 4: Cambiar de estado a 'aceptada' (confirmado)
    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    inscripcion.estado = "aceptada"
    inscripcion.fecha_respuesta = ahora_utc

    # Paso 5: Confirmar en base de datos
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

    # Contar únicamente las solicitudes aceptadas o en reconfirmación (conservan cupo)
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
        # TAREA 6: Calcular posición en lista de espera si corresponde
        posicion = None
        if inscripcion.estado == "en_espera":
            # Cuenta cuántas personas entraron en espera antes o con menor id (desempate FIFO)
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
            "estado": inscripcion.estado,  # 'pendiente', 'aceptada', 'en_espera' o 'rechazada'
            "posicion": posicion,          # Número de orden FIFO en lista de espera
            "fecha_solicitud": inscripcion.fecha_inscripcion.isoformat() if inscripcion.fecha_inscripcion else None,
            "fecha_respuesta": inscripcion.fecha_respuesta.isoformat() if inscripcion.fecha_respuesta else None,
            # TAREA 8: Estado de asistencia y trámite de justificación para el organizador
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
        .join(Usuario, SesionEstudio.usuario_id == Usuario.id)  # Usuario organizador de la sesión
        .where(Inscripcion.usuario_id == usuario_id)
        .order_by(Inscripcion.fecha_inscripcion.desc())
    )

    resultado = []
    for inscripcion, sesion, organizador in db.execute(consulta):
        # TAREA 6: Si está en espera, calcular su posición ordinal FIFO
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
            "estado": inscripcion.estado,  # 'pendiente', 'aceptada', 'en_espera' o 'rechazada'
            "posicion": posicion,          # Posición en lista de espera (si estado == 'en_espera')
            "fecha_solicitud": inscripcion.fecha_inscripcion.isoformat() if inscripcion.fecha_inscripcion else None,
            "fecha_respuesta": inscripcion.fecha_respuesta.isoformat() if inscripcion.fecha_respuesta else None,
            # TAREA 8: El estudiante consulta su resultado de asistencia y estado de justificación
            "asistencia": inscripcion.asistencia,
            "fecha_asistencia": fecha_iso_utc(inscripcion.fecha_asistencia),
            "justificacion": inscripcion.justificacion,
            "fecha_justificacion": fecha_iso_utc(inscripcion.fecha_justificacion),
            "estado_justificacion": inscripcion.estado_justificacion,
            "motivo_respuesta_justificacion": inscripcion.motivo_respuesta_justificacion,
            "fecha_respuesta_justificacion": fecha_iso_utc(inscripcion.fecha_respuesta_justificacion),
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

    # TAREA 5 & 7: Solicitudes aceptadas y en reconfirmación ocupan cupo (conservan temporalmente su cupo)
    cantidades = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado.in_(["aceptada", "pendiente_reconfirmacion"])).group_by(Inscripcion.sesion_id)).all())

    # TAREA 6: Conteo de postulantes en lista de espera ('en_espera') por sesión
    en_espera_por_sesion = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado == "en_espera").group_by(Inscripcion.sesion_id)).all())

    # TAREA 7: Conteo de participantes en reconfirmación pendiente por sesión
    reconfirmaciones_por_sesion = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado == "pendiente_reconfirmacion").group_by(Inscripcion.sesion_id)).all())

    # Diccionario de objetos de inscripción del usuario actual para cada sesión
    mis_inscripciones_objs = {
        i.sesion_id: i
        for i in db.scalars(select(Inscripcion).where(
            Inscripcion.usuario_id == usuario_id
        )).all()
    }
    mis_inscripciones = {sid: ins.estado for sid, ins in mis_inscripciones_objs.items()}

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

        # --- TAREA 6 & 7: Variables de estado y lógica de negocio por cada sesión ---
        inscritos = cantidades.get(sesion.id, 0)                  # Cantidad de solicitudes confirmadas o en reconfirmación
        estado_solicitud = mis_inscripciones.get(sesion.id, None) # Estado del usuario actual ('aceptada', 'en_espera', etc.)
        inscrito = (estado_solicitud == "aceptada")               # True si el usuario ya está confirmado
        es_organizador = (sesion.usuario_id == usuario_id)        # True si el usuario logueado es el creador
        en_espera_total = en_espera_por_sesion.get(sesion.id, 0)  # Total de alumnos actualmente en lista de espera
        reconfirmaciones_count = reconfirmaciones_por_sesion.get(sesion.id, 0) # Alumnos pendientes de reconfirmar
        # Una sesión ya es del pasado únicamente si su fecha es anterior a hoy (fecha < hoy)
        es_pasada = (sesion.fecha < hoy)

        # TAREA 6: Cálculo de la posición exacta (1º, 2º, etc.) en la fila de espera si el usuario está en_espera
        posicion_espera = None
        if estado_solicitud == "en_espera":
            mi_ins = db.get(Inscripcion, (usuario_id, sesion.id))
            if mi_ins and mi_ins.fecha_inscripcion:
                # Consulta SQL para contar cuántos entraron antes que este alumno (orden FIFO)
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

        # Mensaje explicativo según el estado de la solicitud para guiar al usuario en la UI
        if estado_solicitud == "pendiente":
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

        # Cálculo de cupos disponibles reales (restando solicitudes aceptadas y en reconfirmación)
        cupos_libres = max(0, sesion.cupo - inscritos)

        # Estado de finalización de la sesión
        esta_finalizada = bool(getattr(sesion, "finalizada", False))

        # Determina si el estudiante puede enviar una solicitud normal (hay cupos libres disponibles)
        # REGLA: Los participantes pueden unirse incluso el mismo día de la sesión (sesion.fecha >= hoy)
        # siempre que la sesión no haya sido dada por concluida
        puede_solicitar = (
            not es_organizador
            and estado_solicitud is None
            and sesion.inscripciones_abiertas
            and not esta_finalizada
            and sesion.fecha >= hoy
            and cupos_libres > 0
        )

        # TAREA 6: Determina si el estudiante puede unirse a la LISTA DE ESPERA (la sesión está al 100% llena)
        # REGLA: Permitido incluso el mismo día programado si la sesión aún no ha concluido
        puede_solicitar_espera = (
            not es_organizador
            and estado_solicitud is None
            and sesion.inscripciones_abiertas
            and not esta_finalizada
            and sesion.fecha >= hoy
            and cupos_libres == 0
        )

        # TAREA 6 & 7: Determina si el estudiante puede salir / abandonar (liberando cupo o saliendo de la fila)
        puede_abandonar = (
            not es_organizador
            and estado_solicitud in ("aceptada", "en_espera", "pendiente", "pendiente_reconfirmacion")
        )

        # TAREA 7: Determina si el usuario puede reconfirmar su participación
        puede_reconfirmar = (estado_solicitud == "pendiente_reconfirmacion")

        # TAREA 7: REGLA 'Mientras haya reconfirmaciones pendientes, no se admite otra reprogramación'
        puede_reprogramar = es_organizador and (reconfirmaciones_count == 0) and (not es_pasada)

        # Construcción del diccionario con todas las propiedades que consume el frontend React
        resultado.append({
            "id": sesion.id,
            "nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad.lower(),
            "fecha": sesion.fecha,
            "cupo": sesion.cupo,
            "cupos_disponibles": cupos_libres,  # Descuenta únicamente aceptadas y en reconfirmación
            "inscripciones_abiertas": sesion.inscripciones_abiertas,
            "inscrito": inscrito,
            "estado_solicitud": estado_solicitud,  # 'pendiente', 'aceptada', 'en_espera', 'pendiente_reconfirmacion', 'rechazada' o None
            "es_organizador": es_organizador,      # True si el usuario creó esta sesión
            "solicitudes_pendientes_count": pendientes_por_sesion.get(sesion.id, 0) if es_organizador else 0,
            "en_espera_count": en_espera_total,    # Total de personas en lista de espera
            "posicion_espera": posicion_espera,    # Posición específica del usuario actual (si está en espera)
            "puede_unirse": puede_solicitar,
            "puede_solicitar": puede_solicitar,
            "puede_solicitar_espera": puede_solicitar_espera,  # True si puede entrar a la lista de espera
            "puede_abandonar": puede_abandonar,                # True si puede salir / liberar cupo
            "puede_reconfirmar": puede_reconfirmar,            # True si tiene reconfirmación pendiente
            "puede_reprogramar": puede_reprogramar,            # True si el organizador puede reprogramar
            "reconfirmaciones_pendientes_count": reconfirmaciones_count, # Total en reconfirmación
            "motivo_reprogramacion": getattr(sesion, "motivo_reprogramacion", None),
            "es_pasada": es_pasada,                            # True si la fecha ya pasó (Feedback Clase 19)
            "finalizada": bool(getattr(sesion, "finalizada", False)), # True si la sesión fue terminada (Tarea 8)
            "puede_registrar_asistencia": es_organizador and (es_pasada or bool(getattr(sesion, "finalizada", False))), # Control de asistencia para organizador (Tarea 8)
            "mi_asistencia": mis_inscripciones_objs.get(sesion.id).asistencia if mis_inscripciones_objs.get(sesion.id) else None, # Resultado de asistencia (Tarea 8)
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

        # TAREA 5 & 6: Etiqueta descriptiva según el estado de la solicitud o lista de espera
        resultado_texto = "Inscripción aceptada"
        if inscripcion.estado == "pendiente":
            resultado_texto = "Solicitud pendiente"
        elif inscripcion.estado == "en_espera":
            resultado_texto = "En lista de espera"
        elif inscripcion.estado == "rechazada":
            resultado_texto = "Solicitud rechazada"

        # TAREA 8: Si el organizador ya tomó asistencia, actualizar la etiqueta descriptiva
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
            "estado": inscripcion.estado,        # 'pendiente', 'aceptada', 'en_espera', 'rechazada'
            "resultado": resultado_texto,        # Texto legible para la interfaz
            # TAREA 8: Datos de asistencia y justificación
            "asistencia": inscripcion.asistencia,
            "fecha_asistencia": inscripcion.fecha_asistencia,
            "justificacion": inscripcion.justificacion,
            "fecha_justificacion": inscripcion.fecha_justificacion,
            "estado_justificacion": inscripcion.estado_justificacion,
            "motivo_respuesta_justificacion": inscripcion.motivo_respuesta_justificacion,
            "fecha_respuesta_justificacion": inscripcion.fecha_respuesta_justificacion,
        })

    return historial


# =============================================================================
# --- TAREA 8: LÓGICA DE NEGOCIO, PERMISOS Y AUDITORÍA DE ASISTENCIA ---
# =============================================================================

def finalizar_sesion(db, sesion_id, usuario_id):
    """
    TAREA 8: Permite al organizador dar por terminada/finalizada una sesión de estudio.
    Restricción de seguridad: Solo el organizador creador puede finalizarla.
    Consecuencias: Cierra inscripciones y habilita el registro de asistencia.
    """
    sesion = db.get(SesionEstudio, sesion_id)
    if not sesion:
        raise ValueError("La sesión de estudio no existe.")

    # REGLA DE SEGURIDAD: Solo el organizador puede finalizar la sesión
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

    # Consulta participantes confirmados con estado 'aceptada'
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

    # REGLA DE PERMISOS: Si no es el organizador y no es un participante confirmado, bloquear acceso
    if not es_organizador and inscripcion_propia is None:
        raise PermissionError("No tienes permisos para consultar la asistencia de esta sesión.")

    # Consulta el historial de cambios auditados vinculando tanto al Actor como al Estudiante afectado
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
        # Si es organizador ve todo el historial; si es estudiante, solo los eventos de su propio registro
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
    # Verifica si la fecha de la sesión es hoy o anterior (ya llegó el día de la sesión)
    es_pasada = (sesion.fecha <= hoy)
    # Una sesión se considera concluida si su fecha ya ocurrió/es hoy, o si el organizador la finalizó explícitamente
    esta_concluida = es_pasada or bool(getattr(sesion, "finalizada", False))
    # El organizador puede gestionar la asistencia únicamente cuando la sesión está concluida
    puede_gestionar = es_organizador and esta_concluida

    # TAREA 8: Determina si ya se registró la asistencia de participantes previamente en esta sesión
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

    # REGLA DE SEGURIDAD 1: Verificación estricta de organizador
    if sesion.usuario_id != organizador_id:
        raise PermissionError("Solo el organizador de la sesión tiene permisos para registrar o modificar la asistencia.")

    # Comprobar que la sesión esté terminada o darla por concluida
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

        # REGLA: Solo participantes con cupo confirmado (aceptada)
        if inscripcion.estado != "aceptada":
            raise ValueError("Solo se puede registrar asistencia de participantes con inscripción confirmada (aceptada).")

        estado_anterior = inscripcion.asistencia
        inscripcion.asistencia = asist_val
        inscripcion.fecha_asistencia = ahora

        # Si el usuario era ausente y se le cambia a presente, se resetea la justificación pendiente
        if asist_val == "presente" and inscripcion.estado_justificacion == "pendiente":
            inscripcion.estado_justificacion = None

        # Obtenemos el nombre del estudiante para identificarlo claramente en la auditoría
        estudiante_obj = db.get(Usuario, uid)
        nombre_est = estudiante_obj.nombre if estudiante_obj else f"Usuario #{uid}"

        # REGLA TAREA 8: Distinguir si es el primer registro o una edición posterior
        # Si estado_anterior es None -> Es el primer registro de asistencia
        # Si estado_anterior ya tenía un valor -> Es una modificación/edición de asistencia
        es_modificacion = (estado_anterior is not None)
        tipo_evento = "modificacion_asistencia" if es_modificacion else "registro_asistencia"

        if es_modificacion:
            detalle = f"Asistencia de {nombre_est} modificada de {estado_anterior.upper()} a: {asist_val.upper()}"
        else:
            detalle = f"Asistencia de {nombre_est} registrada como: {asist_val.upper()}"

        # REGISTRO DE AUDITORÍA: Guardar evento en HistorialCambioAsistencia identificando al alumno
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

    # REGLA DE ESTADOS: Solo los ausentes pueden justificar inasistencia
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

    # REGISTRO DE AUDITORÍA: Guardar el evento de envío en el historial identificando al estudiante
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

    # REGLA DE SEGURIDAD: Solo el organizador puede resolver justificaciones
    if sesion.usuario_id != organizador_id:
        raise PermissionError("Solo el organizador de la sesión puede aceptar o rechazar justificaciones.")

    inscripcion = db.get(Inscripcion, (estudiante_id, sesion_id))
    if not inscripcion:
        raise ValueError("El estudiante no está inscrito en esta sesión.")

    # REGLA DE ESTADOS: Solo se pueden responder justificaciones en estado pendiente
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

    # REGISTRO DE AUDITORÍA: Guardar la resolución en el historial de cambios identificando al estudiante
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
