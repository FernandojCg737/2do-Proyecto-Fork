import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

class Base(DeclarativeBase):
    pass

if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parents[2]

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    db_folder = BASE_DIR / "database"
    db_folder.mkdir(parents=True, exist_ok=True)
    DB_PATH = db_folder / "studymatch.db"
    DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

is_sqlite = DATABASE_URL.startswith("sqlite")
engine_kwargs = {}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **engine_kwargs)

if not is_sqlite:
    try:
        with engine.connect() as test_conn:
            pass
    except Exception as error_conexion:
        print(
            "[AVISO] No se pudo conectar a PostgreSQL "
            f"({type(error_conexion).__name__}: {error_conexion}). Se usará SQLite local.",
            flush=True,
        )
        db_folder = BASE_DIR / "database"
        db_folder.mkdir(parents=True, exist_ok=True)
        DB_PATH = db_folder / "studymatch.db"
        DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"
        is_sqlite = True
        engine_kwargs = {"connect_args": {"check_same_thread": False}}
        engine = create_engine(DATABASE_URL, **engine_kwargs)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def activar_referencias(conexion, registro):
        cursor = conexion.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

def get_db():
    with SessionLocal() as db:
        try:
            yield db
        except Exception:
            db.rollback()
            raise

def inicializar_db():
    from app import modelos_db

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conexion:
        columnas = [
            columna["name"] 
            for columna in inspect(conexion).get_columns("sesiones")
        ]

        if "materia" not in columnas:
            tipo_materia = "VARCHAR(255)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE sesiones ADD COLUMN materia {tipo_materia} NOT NULL DEFAULT 'General'"
            ))

        if "motivo_reprogramacion" not in columnas:
            tipo_str = "VARCHAR(500)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE sesiones ADD COLUMN motivo_reprogramacion {tipo_str}"
            ))

        if "finalizada" not in columnas:
            tipo_bool = "BOOLEAN"
            val_default = "FALSE" if engine.dialect.name == "postgresql" else "0"
            conexion.execute(text(
                f"ALTER TABLE sesiones ADD COLUMN finalizada {tipo_bool} NOT NULL DEFAULT {val_default}"
            ))

        if "cancelada" not in columnas:
            tipo_bool = "BOOLEAN"
            val_default = "FALSE" if engine.dialect.name == "postgresql" else "0"
            conexion.execute(text(
                f"ALTER TABLE sesiones ADD COLUMN cancelada {tipo_bool} NOT NULL DEFAULT {val_default}"
            ))

        if "motivo_cancelacion" not in columnas:
            tipo_str = "VARCHAR(1000)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE sesiones ADD COLUMN motivo_cancelacion {tipo_str}"
            ))

        if "fecha_cancelacion" not in columnas:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE sesiones ADD COLUMN fecha_cancelacion {tipo_dt}"
            ))

        columnas_inscripciones = [
            columna["name"]
            for columna in inspect(conexion).get_columns("inscriprciones")
        ]

        if "fecha_inscripcion" not in columnas_inscripciones:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN fecha_inscripcion {tipo_dt}"
            ))

        if "estado" not in columnas_inscripciones:
            tipo_estado = "VARCHAR(20)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN estado {tipo_estado} NOT NULL DEFAULT 'aceptada'"
            ))

        if "fecha_respuesta" not in columnas_inscripciones:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN fecha_respuesta {tipo_dt}"
            ))

        if "asistencia" not in columnas_inscripciones:
            tipo_str = "VARCHAR(20)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN asistencia {tipo_str}"
            ))

        if "fecha_asistencia" not in columnas_inscripciones:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN fecha_asistencia {tipo_dt}"
            ))

        if "justificacion" not in columnas_inscripciones:
            tipo_str = "VARCHAR(1000)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN justificacion {tipo_str}"
            ))

        if "fecha_justificacion" not in columnas_inscripciones:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN fecha_justificacion {tipo_dt}"
            ))

        if "estado_justificacion" not in columnas_inscripciones:
            tipo_str = "VARCHAR(20)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN estado_justificacion {tipo_str}"
            ))

        if "motivo_respuesta_justificacion" not in columnas_inscripciones:
            tipo_str = "VARCHAR(1000)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN motivo_respuesta_justificacion {tipo_str}"
            ))

        if "fecha_respuesta_justificacion" not in columnas_inscripciones:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN fecha_respuesta_justificacion {tipo_dt}"
            ))

        columnas_usuarios = [
            columna["name"]
            for columna in inspect(conexion).get_columns("usuarios")
        ]

        if "activo" not in columnas_usuarios:
            tipo_bool = "BOOLEAN"
            val_default = "TRUE" if engine.dialect.name == "postgresql" else "1"
            conexion.execute(text(
                f"ALTER TABLE usuarios ADD COLUMN activo {tipo_bool} NOT NULL DEFAULT {val_default}"
            ))

        if "fecha_eliminacion" not in columnas_usuarios:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE usuarios ADD COLUMN fecha_eliminacion {tipo_dt}"
            ))