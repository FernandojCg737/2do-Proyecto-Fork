from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, DateTime
from app.database import Base

def fecha_inscripcion_actual():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True)
    nombre = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    reset_code = Column(String, nullable=False, default="")

    activo = Column(Boolean, nullable=False, default=True)
    fecha_eliminacion = Column(DateTime, nullable=True)

class SesionEstudio(Base):
    __tablename__ = "sesiones"

    id = Column(Integer, primary_key=True)
    nombre = Column(String, nullable=False)
    materia = Column(String, nullable=False, default="General")
    fecha = Column(Date, nullable=False)
    modalidad = Column(String, nullable=False)
    cupo = Column(Integer, nullable=False)
    inscripciones_abiertas = Column(Boolean, nullable=False, default=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    motivo_reprogramacion = Column(String, nullable=True)
    finalizada = Column(Boolean, nullable=False, default=False)
    cancelada = Column(Boolean, nullable=False, default=False)
    motivo_cancelacion = Column(String, nullable=True)
    fecha_cancelacion = Column(DateTime, nullable=True)

class Inscripcion(Base):
    __tablename__ = "inscriprciones"

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), primary_key=True)
    sesion_id = Column(Integer, ForeignKey("sesiones.id"), primary_key=True)

    estado = Column(String, nullable=False, default="pendiente")

    fecha_inscripcion = Column(
        DateTime,
        nullable=True,
        default=fecha_inscripcion_actual,
    )

    fecha_respuesta = Column(DateTime, nullable=True)

    asistencia = Column(String, nullable=True)
    fecha_asistencia = Column(DateTime, nullable=True)

    justificacion = Column(String, nullable=True)
    fecha_justificacion = Column(DateTime, nullable=True)

    estado_justificacion = Column(String, nullable=True)
    motivo_respuesta_justificacion = Column(String, nullable=True)
    fecha_respuesta_justificacion = Column(DateTime, nullable=True)

class HistorialCambioAsistencia(Base):
    __tablename__ = "historial_cambios_asistencia"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sesion_id = Column(Integer, ForeignKey("sesiones.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tipo_evento = Column(String, nullable=False)
    estado_anterior = Column(String, nullable=True)
    estado_nuevo = Column(String, nullable=False)
    detalle = Column(String, nullable=True)
    fecha = Column(DateTime, nullable=False, default=fecha_inscripcion_actual)

class Evento(Base):
    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    evento = Column(String, nullable=False)
    props = Column(String, nullable=False, default="{}")
    fecha = Column(String, nullable=False)

