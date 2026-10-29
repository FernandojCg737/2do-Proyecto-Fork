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

# Obtener DATABASE_URL del entorno (.env o docker-compose)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Si no se define DATABASE_URL, usar SQLite en la carpeta externa 'database/'
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

        columnas_inscripciones = [
            columna["name"]
            for columna in inspect(conexion).get_columns("inscriprciones")
        ]

        if "fecha_inscripcion" not in columnas_inscripciones:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN fecha_inscripcion {tipo_dt}"
            ))

        # --- TAREA 5: Migración automática de la columna 'estado' ---
        # Si la tabla existente no tiene la columna 'estado', se agrega con valor por defecto 'aceptada'
        # para preservar compatibilidad con los registros previos de la base de datos.
        if "estado" not in columnas_inscripciones:
            tipo_estado = "VARCHAR(20)" if engine.dialect.name == "postgresql" else "TEXT"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN estado {tipo_estado} NOT NULL DEFAULT 'aceptada'"
            ))

        # --- TAREA 5: Migración automática de la columna 'fecha_respuesta' ---
        # Guarda la marca temporal de cuándo el organizador aceptó o rechazó la solicitud.
        if "fecha_respuesta" not in columnas_inscripciones:
            tipo_dt = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            conexion.execute(text(
                f"ALTER TABLE inscriprciones ADD COLUMN fecha_respuesta {tipo_dt}"
            ))