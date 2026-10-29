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