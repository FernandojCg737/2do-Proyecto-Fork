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
    # TAREA 7: Motivo por el cual el organizador reprogramó la sesión (si fue reprogramada)
    motivo_reprogramacion = Column(String, nullable=True)
    # TAREA 8: Indica si la sesión concluyó explícitamente para habilitar el registro de asistencia
    finalizada = Column(Boolean, nullable=False, default=False)

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

    # --- TAREA 8: Control de Asistencia y Justificaciones ---
    # Registra si el estudiante asistió ('presente') o faltó ('ausente') a la sesión
    asistencia = Column(String, nullable=True)
    # Marca de tiempo en que el organizador registró la asistencia del estudiante
    fecha_asistencia = Column(DateTime, nullable=True)

    # Texto explicativo que el estudiante ausente envía para justificar su inasistencia
    justificacion = Column(String, nullable=True)
    # Marca de tiempo exacta en que el estudiante remitió su justificación
    fecha_justificacion = Column(DateTime, nullable=True)

    # Estado del trámite de justificación: 'pendiente', 'aceptada' o 'rechazada'
    estado_justificacion = Column(String, nullable=True)
    # Motivo obligatorio provisto por el organizador al evaluar la justificación
    motivo_respuesta_justificacion = Column(String, nullable=True)
    # Marca de tiempo en que el organizador resolvió la justificación
    fecha_respuesta_justificacion = Column(DateTime, nullable=True)


# --- TAREA 8: Tabla de Auditoría e Historial de Cambios de Asistencia ---
# Registra de forma inmutable cada transición de estado (quién cambió qué, cuándo y por qué)
class HistorialCambioAsistencia(Base):
    __tablename__ = "historial_cambios_asistencia"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sesion_id = Column(Integer, ForeignKey("sesiones.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False) # Estudiante afectado
    actor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)   # Quien ejecutó la acción
    tipo_evento = Column(String, nullable=False) # 'registro_asistencia', 'envio_justificacion', 'resolucion_justificacion'
    estado_anterior = Column(String, nullable=True)
    estado_nuevo = Column(String, nullable=False)
    detalle = Column(String, nullable=True)      # Justificación del alumno o motivo del organizador
    fecha = Column(DateTime, nullable=False, default=fecha_inscripcion_actual)
