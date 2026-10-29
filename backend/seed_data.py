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
        # --- TAREA 5: Verificación de persistencia ---
        # Si la base de datos ya tiene usuarios, se conservan los datos existentes
        # (solicitudes respondidas, nuevas solicitudes) sin borrarlos al reiniciar Docker.
        hay_usuarios = db.query(Usuario).count() > 0
        if hay_usuarios and "--force" not in sys.argv:
            print("[*] Base de datos ya contiene datos. Persistencia activa.")
            return

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
                nombre="Taller Practico de Heuristicas de Nielsen",
                materia="Interaccion Hombre-Computador",
                fecha=hoy + timedelta(days=2),
                modalidad="virtual",
                cupo=6,
                inscripciones_abiertas=True,
                usuario_id=u_carlos.id
            ),
            SesionEstudio(
                nombre="Preparacion para el Parcial de Arboles y Grafos",
                materia="Estructuras de Datos",
                fecha=hoy + timedelta(days=3),
                modalidad="presencial",
                cupo=8,
                inscripciones_abiertas=True,
                usuario_id=u_ana.id
            ),
            SesionEstudio(
                nombre="Repaso General de Limites y Derivadas",
                materia="Calculo I",
                fecha=hoy + timedelta(days=1),
                modalidad="virtual",
                cupo=10,
                inscripciones_abiertas=True,
                usuario_id=u_fernando.id
            ),
            SesionEstudio(
                nombre="Arquitectura de Software y Patrones de Diseno",
                materia="Ingenieria de Software",
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
                nombre="Diseno y Normalizacion de Bases de Datos SQL",
                materia="Base de Datos",
                fecha=hoy + timedelta(days=6),
                modalidad="virtual",
                cupo=12,
                inscripciones_abiertas=True,
                usuario_id=u_carlos.id
            ),
            SesionEstudio(
                nombre="Sesion Extraordinaria de Repaso (Inscripciones Cerradas)",
                materia="Interaccion Hombre-Computador",
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

        print("[*] Creando solicitudes e inscripciones (Tarea 5)...")
        ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None)

        # --- TAREA 5: Solicitudes e inscripciones de prueba para los distintos roles y estados ---
        inscripciones = [
            # 1. Sesión de Carlos (IHC): Ana aceptada previamente, Fernando con solicitud pendiente
            Inscripcion(
                usuario_id=u_ana.id,
                sesion_id=sesiones[0].id,
                estado="aceptada",
                fecha_inscripcion=ahora_utc - timedelta(hours=2),
                fecha_respuesta=ahora_utc - timedelta(hours=1),
            ),
            Inscripcion(
                usuario_id=u_fernando.id,
                sesion_id=sesiones[0].id,
                estado="pendiente",  # Fernando espera respuesta de Carlos
                fecha_inscripcion=ahora_utc - timedelta(minutes=30),
            ),

            # 2. Sesión de Fernando (Cálculo I): Carlos con solicitud pendiente para que Fernando pueda responder
            Inscripcion(
                usuario_id=u_carlos.id,
                sesion_id=sesiones[2].id,
                estado="pendiente",  # Carlos solicita unirse a la sesión de Fernando
                fecha_inscripcion=ahora_utc - timedelta(minutes=45),
            ),
            Inscripcion(
                usuario_id=u_lucia.id,
                sesion_id=sesiones[2].id,
                estado="aceptada",  # Lucía ya fue aceptada por Fernando
                fecha_inscripcion=ahora_utc - timedelta(hours=3),
                fecha_respuesta=ahora_utc - timedelta(hours=2),
            ),

            # 3. Sesión de Ana (Estructuras de Datos): Brayan y Fernando aceptados
            Inscripcion(
                usuario_id=u_brayan.id,
                sesion_id=sesiones[1].id,
                estado="aceptada",
                fecha_inscripcion=ahora_utc - timedelta(hours=4),
                fecha_respuesta=ahora_utc - timedelta(hours=3),
            ),
            Inscripcion(
                usuario_id=u_fernando.id,
                sesion_id=sesiones[1].id,
                estado="aceptada",
                fecha_inscripcion=ahora_utc - timedelta(hours=5),
                fecha_respuesta=ahora_utc - timedelta(hours=4),
            ),

            # 4. Sesión de Brayan (Ing. Software): Solicitud de Fernando rechazada
            Inscripcion(
                usuario_id=u_fernando.id,
                sesion_id=sesiones[3].id,
                estado="rechazada",  # Muestra en la interfaz cómo se visualiza un rechazo
                fecha_inscripcion=ahora_utc - timedelta(days=1),
                fecha_respuesta=ahora_utc - timedelta(hours=12),
            ),
        ]

        db.add_all(inscripciones)
        db.commit()
        print(f"    -> {len(inscripciones)} solicitudes/inscripciones registradas (pendientes, aceptadas, rechazadas).")

    print('[OK] Base de datos poblada exitosamente!')

if __name__ == "__main__":
    seed()
