






from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.modelos_db import Inscripcion, SesionEstudio, Usuario


def guardar_usuario(db, nombre, email, password_hash):
    usuario = Usuario(
        nombre = nombre.strip(),
        email = email.strip().lower(),
        password_hash = password_hash,
    )

    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def get_user_by_email(db, email):
    
    consulta = select(Usuario).where(
        Usuario.email == email.strip().lower()
    )
    return db.scalar(consulta)


def guardar_sesion(db, nombre, fecha, modalidad, cupo, abiertas, usuario_id, materia="General"):

    if cupo <= 0:
        raise ValueError("el cupo tien que ser mayor a cero")
    
    sesion = SesionEstudio(
        nombre = nombre.strip(),
        materia = materia.strip(),
        fecha = fecha,
        modalidad=modalidad.strip().lower(),
        cupo=cupo,
        inscripciones_abiertas=abiertas,
        usuario_id = usuario_id,
    )

    db.add(sesion)
    db.commit()
    db.refresh(sesion)
    return sesion


def fecha_actual():
    return datetime.now(timezone(timedelta(hours=-4))).date()


def motivo_para_unirse(sesion, usuario_id, inscritos, ya_inscrito, hoy=None):

    if sesion.usuario_id == usuario_id:
        return "Eres el creador de esta sesiÃ³n."
    if ya_inscrito:
        return "Ya estÃ¡s inscrito en esta sesiÃ³n."
    if not sesion.inscripciones_abiertas:
        return "Las inscripciones estÃ¡n cerradas."
    if sesion.fecha <= (hoy or fecha_actual()):
        return "Solo puedes unirte a sesiones con fecha futura."
    if inscritos >= sesion.cupo:
        return "No quedan cupos disponibles."
    
    return ""


def unirse_a_sesion(db, sesion_id, usuario_id, hoy=None):
    
    try:
        if getattr(db.bind, 'dialect', None) and db.bind.dialect.name == 'sqlite':
            db.execute(text('BEGIN IMMEDIATE'))
        sesion = db.get(SesionEstudio, sesion_id, populate_existing=True)

        if sesion is None:
            raise ValueError("La sesiÃ³n no existe.")

        inscritos = db.scalar(select(func.count()).select_from(Inscripcion).where(
            Inscripcion.sesion_id == sesion_id
        ))

        ya_inscrito = db.get(Inscripcion, (usuario_id, sesion_id)) is not None
        motivo = motivo_para_unirse(sesion, usuario_id, inscritos, ya_inscrito, hoy)

        if motivo:
            raise ValueError(motivo)

        db.add(Inscripcion(usuario_id=usuario_id, sesion_id=sesion_id))
        db.commit()

    except IntegrityError:
        db.rollback()
        raise ValueError("Ya estÃ¡s inscrito en esta sesiÃ³n.")
    except Exception:
        db.rollback()
        raise


def buscar_sesiones(db, usuario_id, nombre="", materia="", modalidad="",
                    periodo="", desde=None, hasta=None, disponible=False, hoy=None):
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

    # Consultamos las inscripciones guardadas, no datos de ejemplo del frontend.
    cantidades = dict(db.execute(select(
        Inscripcion.sesion_id, func.count()
    ).group_by(Inscripcion.sesion_id)).all())
    mis_sesiones = set(db.scalars(select(Inscripcion.sesion_id).where(
        Inscripcion.usuario_id == usuario_id
    )))

    resultado = []
    for sesion in sesiones:
        # casefold permite comparar tambiÃ©n nombres con mayÃºsculas acentuadas.
        if nombre.strip().casefold() not in sesion.nombre.casefold():
            continue
        if materia.strip() and materia.strip().casefold() != sesion.materia.casefold():
            continue
        inscritos = cantidades.get(sesion.id, 0)
        inscrito = sesion.id in mis_sesiones
        motivo = motivo_para_unirse(sesion, usuario_id, inscritos, inscrito, hoy)
        if disponible and motivo:
            continue
        resultado.append({
            "id": sesion.id,
            "nombre": sesion.nombre,
            "materia": sesion.materia,
            "modalidad": sesion.modalidad.lower(),
            "fecha": sesion.fecha,
            "cupo": sesion.cupo,
            "cupos_disponibles": max(0, sesion.cupo - inscritos),
            "inscripciones_abiertas": sesion.inscripciones_abiertas,
            "inscrito": inscrito,
            "puede_unirse": not motivo,
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
            fecha_inscripcion = fecha_inscripcion.replace(
                tzinfo=timezone.utc
            )

        historial.append({
            "sesion_id" : sesion.id,
            "nombre"    : sesion.nombre,
            "materia"   : sesion.materia,
            "modalidad" : sesion.modalidad,
            "fecha_sesion": sesion.fecha,
            "fecha_inscripcion": fecha_inscripcion,
            "resultado": "InscripciÃ³n registrada",
        })

    return historial

