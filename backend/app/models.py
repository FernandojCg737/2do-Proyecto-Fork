from datetime import date
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class Registro(BaseModel):
    nombre: str
    email: str
    password: str


class Login(BaseModel):
    email: str
    password: str


class RecuperarPassword(BaseModel):
    email: str


class CambiarPassword(BaseModel):
    email: str
    codigo: str
    nueva_password: str = Field(validation_alias=AliasChoices("nueva_password", "nuevo_password"))


class SesionDeEstudio(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=1)
    materia: str = Field(default="General", min_length=1)
    fecha: date
    modalidad: str = Field(min_length=1)
    cupo: int = Field(gt=0)
    inscripciones: bool

    @field_validator("modalidad")
    @classmethod
    def validar_modalidad(cls, valor):
        valor = valor.lower()
        if valor not in ("presencial", "virtual"):
            raise ValueError("Elige presencial o virtual.")
        return valor


# --- TAREA 5: Esquema de validación para responder solicitudes ---
# Valida el payload JSON que envía el organizador desde la interfaz o API.
class ResponderSolicitud(BaseModel):
    decision: str  # Campo que contiene la acción deseada ('aceptar' o 'rechazar')

    # Validador para asegurar que no se envíen valores diferentes a los permitidos
    @field_validator("decision")
    @classmethod
    def validar_decision(cls, valor):
        valor = valor.strip().lower()
        if valor not in ("aceptar", "rechazar"):
            raise ValueError("La decisión debe ser 'aceptar' o 'rechazar'.")
        return valor


# --- TAREA 7: Esquema de validación para reprogramar sesión de estudio ---
# Valida la nueva fecha y el motivo obligatorio ingresados por el organizador.
class ReprogramarSesion(BaseModel):
    fecha: date
    motivo: str = Field(min_length=3)


# =============================================================================
# --- TAREA 8: Esquemas Pydantic para Registro de Asistencia y Justificaciones ---
# Proporcionan tipado estricto, sanitización y validación defensiva en el backend
# =============================================================================

class ItemAsistencia(BaseModel):
    """
    Representa el estado de asistencia individual de un estudiante confirmado.
    - usuario_id: ID del estudiante participante
    - asistencia: 'presente' o 'ausente'
    """
    usuario_id: int
    asistencia: str

    @field_validator("asistencia")
    @classmethod
    def validar_asistencia(cls, valor: str) -> str:
        # Sanitizar y normalizar a minúsculas
        v = valor.strip().lower()
        if v not in ("presente", "ausente"):
            raise ValueError("El estado de asistencia debe ser exactamente 'presente' o 'ausente'.")
        return v


class RegistrarAsistenciaBatch(BaseModel):
    """
    Payload recibido cuando el organizador registra la lista de presentes y ausentes de su sesión.
    """
    asistencias: list[ItemAsistencia] = Field(min_length=1)


class EnviarJustificacion(BaseModel):
    """
    Payload que envía un estudiante ausente para justificar su inasistencia a la sesión.
    - justificacion: Explicación detallada con mínimo 5 caracteres para evitar envíos vacíos.
    """
    justificacion: str = Field(min_length=5, max_length=1000)


class ResponderJustificacion(BaseModel):
    """
    Payload que envía el organizador al evaluar una justificación de un alumno ausente.
    - decision: 'aceptar' o 'rechazar'
    - motivo: Explicación obligatoria requerida por la rúbrica (mínimo 3 caracteres).
    """
    decision: str
    motivo: str = Field(min_length=3, max_length=1000)

    @field_validator("decision")
    @classmethod
    def validar_decision(cls, valor: str) -> str:
        # Sanitizar y verificar que la decisión sea válida
        v = valor.strip().lower()
        if v not in ("aceptar", "rechazar"):
            raise ValueError("La decisión debe ser exactamente 'aceptar' o 'rechazar'.")
        return v
