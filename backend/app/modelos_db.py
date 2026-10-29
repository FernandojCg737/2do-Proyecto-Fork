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

class Inscripcion(Base):
    __tablename__ = "inscriprciones"

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), primary_key=True)
    sesion_id = Column(Integer, ForeignKey("sesiones.id"), primary_key=True)

    # --- TAREA 5: Estado de la solicitud (pendiente, aceptada o rechazada) ---
    # Registra si el estudiante solo envió la solicitud o si el organizador ya la aprobó o rechazó.
    estado = Column(String, nullable=False, default="pendiente")

    fecha_inscripcion = Column(
        DateTime,
        nullable=True,
        default=fecha_inscripcion_actual,
    )

    # --- TAREA 5: Fecha y hora en que el organizador respondió la solicitud ---
    # Permite persistir la marca temporal exacta de la aceptación o rechazo.
    fecha_respuesta = Column(DateTime, nullable=True)
