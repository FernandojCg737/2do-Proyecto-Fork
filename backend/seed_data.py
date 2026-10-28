import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.database import engine, get_db, inicializar_db, Base
from app.modelos_db import Usuario, SesionEstudio, Inscripcion
from app.services import hash_password
from sqlalchemy.orm import Session
from sqlalchemy import text

def fecha_actual_bolivia():
    return datetime.now(timezone(timedelta(hours=-4))).date()

def seed():
    print("[*] Inicializando estructura de base de datos...")
    inicializar_db()

    with Session(engine) as db:
        print("[*] Limpiando datos anteriores para carga limpia...")
        db.query(Inscripcion).delete()
        db.query(SesionEstudio).delete()
        db.query(Usuario).delete()
        db.commit()

        print("[*] Creando usuarios...")
        pwd_hash = hash_password("Password123!")

        usuarios = [
            Usuario(nombre="Carlos Mendoza", email="carlos.mendoza@studymatch.com", password_hash=pwd_hash),
            Usuario(nombre="Ana Torres", email="ana.torres@studymatch.com", password_hash=pwd_hash),
            Usuario(nombre="Brayan Gonzales", email="brayan.gonzales@studymatch.com", password_hash=pwd_hash),
            Usuario(nombre="Fernando Calani", email="fernando.calani@studymatch.com", password_hash=pwd_hash),
            Usuario(nombre="Lucia Paredes", email="lucia.paredes@studymatch.com", password_hash=pwd_hash),
        ]

        db.add_all(usuarios)
        db.commit()
        for u in usuarios:
            db.refresh(u)
        print(f"    -> {len(usuarios)} usuarios creados (Password para todos: Password123!)")

        print("[*] Creando sesiones de estudio...")
        hoy = fecha_actual_bolivia()

        u_carlos = usuarios[0]
        u_ana = usuarios[1]
        u_brayan = usuarios[2]
        u_fernando = usuarios[3]
        u_lucia = usuarios[4]

        sesiones = [
            SesionEstudio(
                nombre="Taller Práctico de Heurísticas de Nielsen",
                materia="Interacción Hombre-Computador",
                fecha=hoy + timedelta(days=2),
                modalidad="virtual",
                cupo=6,
                inscripciones_abiertas=True,
                usuario_id=u_carlos.id
            ),
            SesionEstudio(
                nombre="Preparación para el Parcial de Árboles y Grafos",
                materia="Estructuras de Datos",
                fecha=hoy + timedelta(days=3),
                modalidad="presencial",
                cupo=8,
                inscripciones_abiertas=True,
                usuario_id=u_ana.id
            ),
            SesionEstudio(
                nombre="Repaso General de Límites y Derivadas",
                materia="Cálculo I",
                fecha=hoy + timedelta(days=1),
                modalidad="virtual",
                cupo=10,
                inscripciones_abiertas=True,
                usuario_id=u_fernando.id
            ),
            SesionEstudio(
                nombre="Arquitectura de Software y Patrones de Diseño",
                materia="Ingeniería de Software",
                fecha=hoy + timedelta(days=5),
                modalidad="presencial",
                cupo=5,
                inscripciones_abiertas=True,
                usuario_id=u_brayan.id
            ),
            SesionEstudio(
                nombre="Laboratorio de Hilos y Concurrencia en C/Linux",
                materia="Sistemas Operativos",
                fecha=hoy + timedelta(days=4),
                modalidad="presencial",
                cupo=4,
                inscripciones_abiertas=True,
                usuario_id=u_lucia.id
            ),
            SesionEstudio(
                nombre="Diseño y Normalización de Bases de Datos SQL",
                materia="Base de Datos",
                fecha=hoy + timedelta(days=6),
                modalidad="virtual",
                cupo=12,
                inscripciones_abiertas=True,
                usuario_id=u_carlos.id
            ),
            SesionEstudio(
                nombre="Sesión Extraordinaria de Repaso (Inscripciones Cerradas)",
                materia="Interacción Hombre-Computador",
                fecha=hoy + timedelta(days=2),
                modalidad="presencial",
                cupo=5,
                inscripciones_abiertas=False,
                usuario_id=u_ana.id
            ),
        ]

        db.add_all(sesiones)
        db.commit()
        for s in sesiones:
            db.refresh(s)
        print(f"    -> {len(sesiones)} sesiones de estudio creadas.")

        print("[*] Creando inscripciones...")
        ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)

        inscripciones = [
            Inscripcion(usuario_id=u_ana.id, sesion_id=sesiones[0].id, fecha_inscripcion=ahora_utc),
            Inscripcion(usuario_id=u_fernando.id, sesion_id=sesiones[0].id, fecha_inscripcion=ahora_utc),
            Inscripcion(usuario_id=u_carlos.id, sesion_id=sesiones[2].id, fecha_inscripcion=ahora_utc),
            Inscripcion(usuario_id=u_lucia.id, sesion_id=sesiones[2].id, fecha_inscripcion=ahora_utc),
            Inscripcion(usuario_id=u_brayan.id, sesion_id=sesiones[1].id, fecha_inscripcion=ahora_utc),
            Inscripcion(usuario_id=u_fernando.id, sesion_id=sesiones[1].id, fecha_inscripcion=ahora_utc),
        ]

        db.add_all(inscripciones)
        db.commit()
        print(f"    -> {len(inscripciones)} inscripciones registradas.")

    print("\n[OK] Base de datos poblada exitosamente en studymatch.db!")

if __name__ == "__main__":
    seed()
