from datetime import date, timedelta
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modelos_db import Inscripcion, SesionEstudio
from app.repositorio import (
    buscar_sesiones,
    guardar_sesion,
    guardar_usuario,
    listar_mis_solicitudes,
    listar_solicitudes_organizador,
    responder_solicitud,
    solicitar_unirse,
)
from tests.base_db import PruebaConBaseDeDatos


class TestTarea5Solicitudes(PruebaConBaseDeDatos):
    def setUp(self):
        super().setUp()
        self.hoy = date(2026, 10, 28)
        self.organizador = self.usuario
        self.estudiante1 = guardar_usuario(self.db, "Estudiante Uno", "uno@example.test", "hash1")
        self.estudiante2 = guardar_usuario(self.db, "Estudiante Dos", "dos@example.test", "hash2")
        self.estudiante3 = guardar_usuario(self.db, "Estudiante Tres", "tres@example.test", "hash3")

    def crear_sesion(self, cupo=2, abiertas=True, dias=2):
        return guardar_sesion(
            self.db,
            nombre="Taller Tarea 5",
            fecha=self.hoy + timedelta(days=dias),
            modalidad="virtual",
            cupo=cupo,
            abiertas=abiertas,
            usuario_id=self.organizador.id,
            materia="Interaccion",
        )

    def test_estudiante_solicita_unirse_crea_estado_pendiente(self):
        sesion = self.crear_sesion()
        solicitud = solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        self.assertEqual(solicitud.estado, "pendiente")
        self.assertEqual(solicitud.usuario_id, self.estudiante1.id)
        self.assertEqual(solicitud.sesion_id, sesion.id)

        # Verificamos persistencia
        with Session(self.engine) as db:
            guardada = db.get(Inscripcion, (self.estudiante1.id, sesion.id))
            self.assertIsNotNone(guardada)
            self.assertEqual(guardada.estado, "pendiente")

    def test_solicitud_pendiente_no_descuenta_cupo(self):
        sesion = self.crear_sesion(cupo=2)
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)

        resultado = buscar_sesiones(self.db, self.estudiante1.id, hoy=self.hoy)
        tarjeta = next(s for s in resultado if s["id"] == sesion.id)
        # Los cupos disponibles deben seguir siendo 2 porque la solicitud esta pendiente
        self.assertEqual(tarjeta["cupos_disponibles"], 2)
        self.assertEqual(tarjeta["estado_solicitud"], "pendiente")
        self.assertFalse(tarjeta["inscrito"])
        self.assertFalse(tarjeta["puede_solicitar"])

    def test_organizador_acepta_solicitud_y_descuenta_cupo(self):
        sesion = self.crear_sesion(cupo=2)
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)

        # Organizador acepta la solicitud
        inscripcion = responder_solicitud(
            self.db,
            sesion_id=sesion.id,
            solicitante_id=self.estudiante1.id,
            organizador_id=self.organizador.id,
            decision="aceptar",
        )
        self.assertEqual(inscripcion.estado, "aceptada")
        self.assertIsNotNone(inscripcion.fecha_respuesta)

        # Ahora el cupo disponible debe reducirse de 2 a 1
        resultado = buscar_sesiones(self.db, self.estudiante1.id, hoy=self.hoy)
        tarjeta = next(s for s in resultado if s["id"] == sesion.id)
        self.assertEqual(tarjeta["cupos_disponibles"], 1)
        self.assertTrue(tarjeta["inscrito"])
        self.assertEqual(tarjeta["estado_solicitud"], "aceptada")

    def test_organizador_rechaza_solicitud_y_no_descuenta_cupo(self):
        sesion = self.crear_sesion(cupo=2)
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)

        # Organizador rechaza la solicitud
        inscripcion = responder_solicitud(
            self.db,
            sesion_id=sesion.id,
            solicitante_id=self.estudiante1.id,
            organizador_id=self.organizador.id,
            decision="rechazar",
        )
        self.assertEqual(inscripcion.estado, "rechazada")
        self.assertIsNotNone(inscripcion.fecha_respuesta)

        # El cupo disponible debe seguir siendo 2
        resultado = buscar_sesiones(self.db, self.estudiante1.id, hoy=self.hoy)
        tarjeta = next(s for s in resultado if s["id"] == sesion.id)
        self.assertEqual(tarjeta["cupos_disponibles"], 2)
        self.assertFalse(tarjeta["inscrito"])
        self.assertEqual(tarjeta["estado_solicitud"], "rechazada")

    def test_no_organizador_no_puede_responder(self):
        sesion = self.crear_sesion()
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)

        # Un usuario que NO es el creador intenta aceptar
        with self.assertRaises(PermissionError):
            responder_solicitud(
                self.db,
                sesion_id=sesion.id,
                solicitante_id=self.estudiante1.id,
                organizador_id=self.estudiante2.id,
                decision="aceptar",
            )

    def test_no_permite_solicitud_duplicada(self):
        sesion = self.crear_sesion()
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)

        with self.assertRaisesRegex(ValueError, "Ya tienes una solicitud pendiente"):
            solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)

        # Si se acepta, tampoco permite duplicado
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")
        with self.assertRaisesRegex(ValueError, "Ya est.*s inscrito"):
            solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)

    def test_creador_no_puede_solicitar_su_propia_sesion(self):
        sesion = self.crear_sesion()
        with self.assertRaisesRegex(ValueError, "creador"):
            solicitar_unirse(self.db, sesion.id, self.organizador.id, hoy=self.hoy)

    def test_sesion_cerrada_o_sin_cupo_rechaza_solicitud(self):
        sesion_cerrada = self.crear_sesion(abiertas=False)
        with self.assertRaisesRegex(ValueError, "cerradas"):
            solicitar_unirse(self.db, sesion_cerrada.id, self.estudiante1.id, hoy=self.hoy)

        sesion_llena = self.crear_sesion(cupo=1)
        solicitar_unirse(self.db, sesion_llena.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion_llena.id, self.estudiante1.id, self.organizador.id, "aceptar")

        with self.assertRaisesRegex(ValueError, "No quedan cupos"):
            solicitar_unirse(self.db, sesion_llena.id, self.estudiante2.id, hoy=self.hoy)

    def test_listar_solicitudes_organizador_y_mis_solicitudes(self):
        sesion = self.crear_sesion()
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)

        # Organizador consulta sus solicitudes pendientes
        solicitudes_org = listar_solicitudes_organizador(self.db, self.organizador.id)
        self.assertEqual(len(solicitudes_org), 2)
        solicitantes = [s["solicitante_email"] for s in solicitudes_org]
        self.assertIn("uno@example.test", solicitantes)
        self.assertIn("dos@example.test", solicitantes)

        # Estudiante 1 consulta sus solicitudes enviadas
        mis_sol = listar_mis_solicitudes(self.db, self.estudiante1.id)
        self.assertEqual(len(mis_sol), 1)
        self.assertEqual(mis_sol[0]["sesion_id"], sesion.id)
        self.assertEqual(mis_sol[0]["estado"], "pendiente")
