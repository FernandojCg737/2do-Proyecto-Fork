from datetime import datetime, timedelta, timezone
from sqlalchemy import and_, func, or_, select, text
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

    # Paso 4: Regla: La sesión debe ser en una fecha futura respecto a hoy
    if sesion.fecha <= (hoy or fecha_actual()):
        raise ValueError("Solo puedes unirte a sesiones con fecha futura.")

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
        # TAREA 6: Si ya está en la lista de espera, evitar que ocupe dos turnos
        if inscripcion.estado == "en_espera":
            raise ValueError("Ya estás en la lista de espera de esta sesión.")
        # Si fue rechazada previamente, se le permite volver a postularse actualizando la fecha
        if inscripcion.estado == "rechazada":
            inscripcion.fecha_inscripcion = ahora_utc
            inscripcion.fecha_respuesta = None

    # Paso 6: Contar cuántos cupos reales están ocupados (únicamente solicitudes aceptadas)
    inscritos_aceptados = db.scalar(
        select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id,
            Inscripcion.estado == "aceptada"
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

    # Paso 5: REGLA CENTRAL TAREA 6:
    # Si el usuario que salió tenía cupo confirmado ('aceptada'), el cupo quedó libre.
    # Por lo tanto, el PRIMERO en la fila de espera ingresa automáticamente a confirmado.
    if estado_anterior == "aceptada":
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

        # Si hay un estudiante en espera, se le promueve de forma automática e inmediata
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

    # TAREA 6: Conteo de postulantes en lista de espera ('en_espera') por sesión
    en_espera_por_sesion = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).where(Inscripcion.estado == "en_espera").group_by(Inscripcion.sesion_id)).all())

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

        # --- TAREA 6: Variables de estado y lógica de lista de espera por cada sesión ---
        inscritos = cantidades.get(sesion.id, 0)                  # Cantidad de solicitudes ya aceptadas
        estado_solicitud = mis_inscripciones.get(sesion.id, None) # Estado del usuario actual ('aceptada', 'en_espera', etc.)
        inscrito = (estado_solicitud == "aceptada")               # True si el usuario ya está confirmado
        es_organizador = (sesion.usuario_id == usuario_id)        # True si el usuario logueado es el creador
        en_espera_total = en_espera_por_sesion.get(sesion.id, 0)  # Total de alumnos actualmente en lista de espera

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
        else:
            motivo = motivo_para_unirse(sesion, usuario_id, inscritos, inscrito, hoy)

        if disponible and motivo:
            continue

        # Cálculo de cupos disponibles reales (restando únicamente las solicitudes aceptadas)
        cupos_libres = max(0, sesion.cupo - inscritos)

        # Determina si el estudiante puede enviar una solicitud normal (hay cupos libres disponibles)
        puede_solicitar = (
            not es_organizador
            and estado_solicitud is None
            and sesion.inscripciones_abiertas
            and sesion.fecha > hoy
            and cupos_libres > 0
        )

        # TAREA 6: Determina si el estudiante puede unirse a la LISTA DE ESPERA (la sesión está al 100% llena)
        puede_solicitar_espera = (
            not es_organizador
            and estado_solicitud is None
            and sesion.inscripciones_abiertas
            and sesion.fecha > hoy
            and cupos_libres == 0
        )

        # TAREA 6: Determina si el estudiante puede salir / abandonar (liberando cupo o saliendo de la fila)
        puede_abandonar = (
            not es_organizador
            and estado_solicitud in ("aceptada", "en_espera", "pendiente")
        )

        # Construcción del diccionario con todas las propiedades que consume el frontend React
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
            "estado_solicitud": estado_solicitud,  # 'pendiente', 'aceptada', 'en_espera', 'rechazada' o None
            "es_organizador": es_organizador,      # True si el usuario creó esta sesión
            "solicitudes_pendientes_count": pendientes_por_sesion.get(sesion.id, 0) if es_organizador else 0,
            "en_espera_count": en_espera_total,    # Total de personas en lista de espera
            "posicion_espera": posicion_espera,    # Posición específica del usuario actual (si está en espera)
            "puede_unirse": puede_solicitar,
            "puede_solicitar": puede_solicitar,
            "puede_solicitar_espera": puede_solicitar_espera,  # True si puede entrar a la lista de espera
            "puede_abandonar": puede_abandonar,                # True si puede salir / liberar cupo
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

        historial.append({
            "sesion_id": sesion.id,
            "nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad,
            "fecha_sesion": sesion.fecha,
            "fecha_inscripcion": fecha_inscripcion,
            "estado": inscripcion.estado,        # 'pendiente', 'aceptada', 'en_espera', 'rechazada'
            "resultado": resultado_texto,        # Texto legible para la interfaz
        })

    return historial
