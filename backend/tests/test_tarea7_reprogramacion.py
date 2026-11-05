from datetime import date, timedelta
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modelos_db import Inscripcion, SesionEstudio
from app.repositorio import (
    buscar_sesiones,
    guardar_sesion,
    guardar_usuario,
    reconfirmar_participacion,
    reprogramar_sesion,
    responder_solicitud,
    salir_de_sesion,
    solicitar_unirse,
)
from tests.base_db import PruebaConBaseDeDatos


class TestTarea7Reprogramacion(PruebaConBaseDeDatos):
    """
    TAREA 7: Pruebas unitarias de la Funcionalidad Obligatoria para StudyMatch:
    'Reprogramar una sesión con reconfirmación' (IHC Clase 19).

    Reglas de Negocio a comprobar:
      1. El organizador cambia fecha u horario e indica el motivo.
      2. Los participantes confirmados pasan a pendientes de reconfirmación y conservan temporalmente su cupo.
      3. Cada uno acepta o se retira; retirarse libera el cupo y promueve al primero en espera.
      4. Mientras haya reconfirmaciones pendientes, no se admite otra reprogramación.
      5. Escenario mínimo a demostrar:
         - Dos participantes: uno reconfirma y otro se retira.
         - La primera persona en espera asciende una sola vez.
    """

    def setUp(self):
        super().setUp()
        self.hoy = date(2026, 11, 5)
        self.organizador = self.usuario
        # Creamos 3 estudiantes de prueba
        self.estudiante1 = guardar_usuario(self.db, "Ana Torres", "ana@test.bo", "hash1")
        self.estudiante2 = guardar_usuario(self.db, "Juan Perez", "juan@test.bo", "hash2")
        self.estudiante3 = guardar_usuario(self.db, "Brayan Gonzales", "brayan@test.bo", "hash3")

    def crear_sesion(self, cupo=2, dias=2):
        """Crea una sesión de estudio para las pruebas de reprogramación."""
        return guardar_sesion(
            self.db,
            nombre="Taller IHC Reprogramación",
            fecha=self.hoy + timedelta(days=dias),
            modalidad="virtual",
            cupo=cupo,
            abiertas=True,
            usuario_id=self.organizador.id,
            materia="Interacción Hombre-Computador",
        )

    def test_01_reprogramar_pasa_confirmados_a_pendiente_reconfirmacion(self):
        """
        Regla 1 & 2: El organizador cambia fecha con motivo.
        Los participantes confirmados pasan a 'pendiente_reconfirmacion' y conservan su cupo.
        """
        sesion = self.crear_sesion(cupo=2)

        # 1. Los 2 estudiantes solicitan y son aceptados (Cupo 2/2 lleno)
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")

        solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante2.id, self.organizador.id, "aceptar")

        # 2. El organizador reprograma la sesión para 5 días después
        nueva_fecha = self.hoy + timedelta(days=5)
        motivo = "Cruce de horarios con el examen de Cálculo"
        resultado = reprogramar_sesion(self.db, sesion.id, nueva_fecha, motivo, self.organizador.id, hoy=self.hoy)

        self.assertEqual(resultado["participantes_en_reconfirmacion"], 2)
        self.assertEqual(sesion.fecha, nueva_fecha)
        self.assertEqual(sesion.motivo_reprogramacion, motivo)

        # 3. Comprobar que ambos participantes pasaron a 'pendiente_reconfirmacion'
        ins1 = self.db.get(Inscripcion, (self.estudiante1.id, sesion.id))
        ins2 = self.db.get(Inscripcion, (self.estudiante2.id, sesion.id))
        self.assertEqual(ins1.estado, "pendiente_reconfirmacion")
        self.assertEqual(ins2.estado, "pendiente_reconfirmacion")

        # 4. Conservan temporalmente su cupo (cupos_disponibles sigue siendo 0)
        sesiones_info = buscar_sesiones(self.db, usuario_id=self.organizador.id, hoy=self.hoy)
        info = [s for s in sesiones_info if s["id"] == sesion.id][0]
        self.assertEqual(info["cupos_disponibles"], 0)

    def test_02_bloqueo_de_segunda_reprogramacion_mientras_haya_pendientes(self):
        """
        Regla 4: 'Mientras haya reconfirmaciones pendientes, no se admite otra reprogramación.'
        """
        sesion = self.crear_sesion(cupo=2)

        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")

        # Primera reprogramación válida
        reprogramar_sesion(self.db, sesion.id, self.hoy + timedelta(days=4), "Motivo 1", self.organizador.id, hoy=self.hoy)

        # Intento de segunda reprogramación inmediata mientras el estudiante no ha respondido
        with self.assertRaises(ValueError) as error:
            reprogramar_sesion(self.db, sesion.id, self.hoy + timedelta(days=7), "Motivo 2", self.organizador.id, hoy=self.hoy)

        self.assertIn("No se admite otra reprogramación", str(error.exception))

    def test_03_escenario_minimo_uno_reconfirma_otro_se_retira_primero_en_espera_asciende_una_vez(self):
        """
        ESCENARIO MÍNIMO OBLIGATORIO (Rúbrica IHC Clase 19):
        'Dos participantes: uno reconfirma y otro se retira.
         La primera persona en espera asciende una sola vez.'
        """
        sesion = self.crear_sesion(cupo=2)

        # Paso A: Dos participantes confirmados (Estudiante 1 y 2)
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")

        solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante2.id, self.organizador.id, "aceptar")

        # Paso B: Estudiante 3 solicita pero como la sesión está llena (2/2), entra a LISTA DE ESPERA (Lugar #1)
        ins3 = solicitar_unirse(self.db, sesion.id, self.estudiante3.id, hoy=self.hoy)
        self.assertEqual(ins3.estado, "en_espera")

        # Paso C: Organizador reprograma la sesión
        nueva_fecha = self.hoy + timedelta(days=6)
        reprogramar_sesion(self.db, sesion.id, nueva_fecha, "Cambio de aula", self.organizador.id, hoy=self.hoy)

        # Ambos confirmados pasan a pendiente_reconfirmacion
        ins1 = self.db.get(Inscripcion, (self.estudiante1.id, sesion.id))
        ins2 = self.db.get(Inscripcion, (self.estudiante2.id, sesion.id))
        self.assertEqual(ins1.estado, "pendiente_reconfirmacion")
        self.assertEqual(ins2.estado, "pendiente_reconfirmacion")

        # Paso D: PARTICIPANTE 1 RECONFIRMA (Acepta la nueva fecha)
        res_reconf = reconfirmar_participacion(self.db, sesion.id, self.estudiante1.id)
        self.assertEqual(res_reconf["estado"], "aceptada")
        self.assertEqual(self.db.get(Inscripcion, (self.estudiante1.id, sesion.id)).estado, "aceptada")

        # Paso E: PARTICIPANTE 2 SE RETIRA (No puede en la nueva fecha)
        # Regla: Retirarse libera el cupo y promueve automáticamente al primero en espera
        res_salida = salir_de_sesion(self.db, sesion.id, self.estudiante2.id)

        # Verificar que el participante 2 ya no está inscrito
        self.assertIsNone(self.db.get(Inscripcion, (self.estudiante2.id, sesion.id)))

        # Paso F: LA PRIMERA PERSONA EN ESPERA (Estudiante 3) ASCIENDE UNA SOLA VEZ
        self.assertIsNotNone(res_salida["promovido"])
        self.assertEqual(res_salida["promovido"]["usuario_id"], self.estudiante3.id)
        self.assertEqual(res_salida["promovido"]["estado"], "aceptada")

        # Comprobar en base de datos que Estudiante 3 ahora está aceptado
        ins3_actualizado = self.db.get(Inscripcion, (self.estudiante3.id, sesion.id))
        self.assertEqual(ins3_actualizado.estado, "aceptada")

        # La capacidad vuelve a estar en 2/2 (Estudiante 1 reconfirmado y Estudiante 3 promovido)
        sesiones_info = buscar_sesiones(self.db, usuario_id=self.organizador.id, hoy=self.hoy)
        info = [s for s in sesiones_info if s["id"] == sesion.id][0]
        self.assertEqual(info["cupos_disponibles"], 0)

    def test_04_solo_organizador_puede_reprogramar(self):
        """Validar que un participante no pueda reprogramar la sesión de otro organizador."""
        sesion = self.crear_sesion(cupo=2)
        with self.assertRaises(ValueError) as error:
            reprogramar_sesion(self.db, sesion.id, self.hoy + timedelta(days=3), "Hack", self.estudiante1.id, hoy=self.hoy)
        self.assertIn("Solo el organizador", str(error.exception))

    def test_05_reprogramar_con_fecha_pasada_o_motivo_vacio_falla(self):
        """Validar que no se permita reprogramar con fecha pasada ni sin motivo explicativo."""
        sesion = self.crear_sesion(cupo=2)

        # Fecha pasada
        with self.assertRaises(ValueError) as error:
            reprogramar_sesion(self.db, sesion.id, self.hoy - timedelta(days=1), "Motivo", self.organizador.id, hoy=self.hoy)
        self.assertIn("debe ser futura", str(error.exception))

        # Motivo vacío
        with self.assertRaises(ValueError) as error:
            reprogramar_sesion(self.db, sesion.id, self.hoy + timedelta(days=2), "   ", self.organizador.id, hoy=self.hoy)
        self.assertIn("motivo", str(error.exception))

