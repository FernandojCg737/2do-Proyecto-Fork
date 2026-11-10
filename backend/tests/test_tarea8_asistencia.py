from datetime import date, timedelta
from app.modelos_db import HistorialCambioAsistencia, Inscripcion, SesionEstudio
from app.models import ItemAsistencia
from app.repositorio import (
    finalizar_sesion,
    guardar_sesion,
    guardar_usuario,
    obtener_asistencia_sesion,
    presentar_justificacion,
    registrar_asistencia_batch,
    responder_justificacion,
    responder_solicitud,
    solicitar_unirse,
)
from tests.base_db import PruebaConBaseDeDatos


class TestTarea8AsistenciaJustificacion(PruebaConBaseDeDatos):
    """
    TAREA 8: Pruebas unitarias de la Funcionalidad Asignada:
    'Asistencia y justificación' (IHC Clase 20).

    Reglas de Negocio a verificar:
      1. Al terminar una sesión, el organizador registra presentes o ausentes entre confirmados.
      2. Cada participante consulta su resultado de asistencia de forma persistente.
      3. Un ausente puede presentar una justificación; el organizador la acepta o rechaza con motivo.
      4. Se conserva la historia completa de cambios (auditoría en HistorialCambioAsistencia).
      5. Restricción obligatoria: Bloqueo de modificaciones por un usuario ajeno (PermissionError).
    """

    def setUp(self):
        super().setUp()
        self.hoy = date(2026, 11, 9)
        self.organizador = self.usuario
        # Creamos participantes de prueba y un usuario ajeno
        self.estudiante_presente = guardar_usuario(self.db, "Fernando Calani", "fernando@test.bo", "hash1")
        self.estudiante_ausente = guardar_usuario(self.db, "Ana Gomez", "ana@test.bo", "hash2")
        self.usuario_ajeno = guardar_usuario(self.db, "Carlos Ajeno", "carlos.ajeno@test.bo", "hash3")

    def crear_sesion_con_participantes(self):
        """Crea una sesión con fecha futura, inscribe y acepta a los participantes y luego la da por concluida."""
        sesion = guardar_sesion(
            self.db,
            nombre="Grupo de Estudio IHC Tarea 8",
            fecha=self.hoy + timedelta(days=2),
            modalidad="presencial",
            cupo=5,
            abiertas=True,
            usuario_id=self.organizador.id,
            materia="Interacción Hombre-Computador",
        )
        # Inscribir y aceptar a los dos participantes cuando la sesión aún tiene inscripciones abiertas
        solicitar_unirse(self.db, sesion.id, self.estudiante_presente.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante_presente.id, self.organizador.id, "aceptar")

        solicitar_unirse(self.db, sesion.id, self.estudiante_ausente.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante_ausente.id, self.organizador.id, "aceptar")

        # Dar la sesión por concluida para habilitar el control de asistencia
        sesion.fecha = self.hoy
        sesion.finalizada = True
        self.db.commit()
        return sesion

    def test_01_organizador_registra_presentes_y_ausentes(self):
        """
        El organizador registra presentes o ausentes entre sus participantes confirmados.
        """
        sesion = self.crear_sesion_con_participantes()

        # Lista de asistencia enviada por el organizador
        batch = [
            ItemAsistencia(usuario_id=self.estudiante_presente.id, asistencia="presente"),
            ItemAsistencia(usuario_id=self.estudiante_ausente.id, asistencia="ausente"),
        ]

        resultado = registrar_asistencia_batch(
            self.db,
            sesion_id=sesion.id,
            organizador_id=self.organizador.id,
            asistencias=batch,
        )

        self.assertEqual(resultado["actualizados"], 2)

        # Verificar en base de datos la persistencia de los estados
        ins1 = self.db.get(Inscripcion, (self.estudiante_presente.id, sesion.id))
        ins2 = self.db.get(Inscripcion, (self.estudiante_ausente.id, sesion.id))

        self.assertEqual(ins1.asistencia, "presente")
        self.assertIsNotNone(ins1.fecha_asistencia)
        self.assertEqual(ins2.asistencia, "ausente")
        self.assertIsNotNone(ins2.fecha_asistencia)

    def test_02_bloqueo_modificacion_por_usuario_ajeno(self):
        """
        Restricción obligatoria: Un usuario ajeno que no es organizador no puede
        registrar asistencia, ni resolver justificaciones.
        """
        sesion = self.crear_sesion_con_participantes()

        batch = [
            ItemAsistencia(usuario_id=self.estudiante_presente.id, asistencia="presente"),
        ]

        # 1. Usuario ajeno intenta registrar asistencia -> Bloqueado con PermissionError
        with self.assertRaises(PermissionError):
            registrar_asistencia_batch(
                self.db,
                sesion_id=sesion.id,
                organizador_id=self.usuario_ajeno.id,
                asistencias=batch,
            )

        # 2. Usuario ajeno intenta consultar la lista de asistencia -> Bloqueado con PermissionError
        with self.assertRaises(PermissionError):
            obtener_asistencia_sesion(
                self.db,
                sesion_id=sesion.id,
                usuario_id=self.usuario_ajeno.id,
            )

    def test_03_estudiante_ausente_presenta_justificacion(self):
        """
        Un participante registrado como ausente puede presentar una justificación,
        la cual pasa al estado 'pendiente'.
        """
        sesion = self.crear_sesion_con_participantes()

        # Organizador marca como ausente
        registrar_asistencia_batch(
            self.db,
            sesion_id=sesion.id,
            organizador_id=self.organizador.id,
            asistencias=[ItemAsistencia(usuario_id=self.estudiante_ausente.id, asistencia="ausente")],
        )

        # El estudiante ausente presenta su justificación
        res = presentar_justificacion(
            self.db,
            sesion_id=sesion.id,
            estudiante_id=self.estudiante_ausente.id,
            texto_justificacion="Tuve cruce de horario con un examen médico oficial.",
        )

        self.assertEqual(res["estado_justificacion"], "pendiente")

        # Verificar persistencia en base de datos
        ins = self.db.get(Inscripcion, (self.estudiante_ausente.id, sesion.id))
        self.assertEqual(ins.estado_justificacion, "pendiente")
        self.assertEqual(ins.justificacion, "Tuve cruce de horario con un examen médico oficial.")
        self.assertIsNotNone(ins.fecha_justificacion)

    def test_04_estudiante_presente_no_puede_justificar(self):
        """
        Regla de negocio: Si el estudiante asistió (está 'presente'),
        no tiene motivo para justificar inasistencia y debe rechazarse.
        """
        sesion = self.crear_sesion_con_participantes()

        # Organizador marca como presente
        registrar_asistencia_batch(
            self.db,
            sesion_id=sesion.id,
            organizador_id=self.organizador.id,
            asistencias=[ItemAsistencia(usuario_id=self.estudiante_presente.id, asistencia="presente")],
        )

        # Intento de justificar siendo 'presente' -> Debe lanzar ValueError
        with self.assertRaises(ValueError):
            presentar_justificacion(
                self.db,
                sesion_id=sesion.id,
                estudiante_id=self.estudiante_presente.id,
                texto_justificacion="Intento innecesario de justificar.",
            )

    def test_05_organizador_acepta_justificacion_con_motivo(self):
        """
        El organizador acepta una justificación proporcionando un motivo obligatorio.
        El estado pasa a 'aceptada' y se conserva el motivo y fecha.
        """
        sesion = self.crear_sesion_con_participantes()

        # 1. Marcar ausente
        registrar_asistencia_batch(
            self.db,
            sesion_id=sesion.id,
            organizador_id=self.organizador.id,
            asistencias=[ItemAsistencia(usuario_id=self.estudiante_ausente.id, asistencia="ausente")],
        )

        # 2. Presentar justificación
        presentar_justificacion(
            self.db,
            sesion_id=sesion.id,
            estudiante_id=self.estudiante_ausente.id,
            texto_justificacion="Cruce con defensa de proyecto de Cálculo I.",
        )

        # 3. Organizador acepta la justificación con motivo
        res = responder_justificacion(
            self.db,
            sesion_id=sesion.id,
            estudiante_id=self.estudiante_ausente.id,
            organizador_id=self.organizador.id,
            decision="aceptar",
            motivo="Certificado de defensa académica presentado y validado.",
        )

        self.assertEqual(res["estado_justificacion"], "aceptada")
        self.assertEqual(res["motivo"], "Certificado de defensa académica presentado y validado.")

        # Verificar persistencia en base de datos
        ins = self.db.get(Inscripcion, (self.estudiante_ausente.id, sesion.id))
        self.assertEqual(ins.estado_justificacion, "aceptada")
        self.assertEqual(ins.motivo_respuesta_justificacion, "Certificado de defensa académica presentado y validado.")
        self.assertIsNotNone(ins.fecha_respuesta_justificacion)

    def test_06_organizador_rechaza_justificacion_con_motivo(self):
        """
        El organizador rechaza una justificación proporcionando el motivo del rechazo.
        """
        sesion = self.crear_sesion_con_participantes()

        registrar_asistencia_batch(
            self.db,
            sesion_id=sesion.id,
            organizador_id=self.organizador.id,
            asistencias=[ItemAsistencia(usuario_id=self.estudiante_ausente.id, asistencia="ausente")],
        )

        presentar_justificacion(
            self.db,
            sesion_id=sesion.id,
            estudiante_id=self.estudiante_ausente.id,
            texto_justificacion="Me quedé dormido y no pude llegar.",
        )

        res = responder_justificacion(
            self.db,
            sesion_id=sesion.id,
            estudiante_id=self.estudiante_ausente.id,
            organizador_id=self.organizador.id,
            decision="rechazar",
            motivo="Motivo no contemplado en el reglamento como causa de fuerza mayor.",
        )

        self.assertEqual(res["estado_justificacion"], "rechazada")

        ins = self.db.get(Inscripcion, (self.estudiante_ausente.id, sesion.id))
        self.assertEqual(ins.estado_justificacion, "rechazada")
        self.assertEqual(ins.motivo_respuesta_justificacion, "Motivo no contemplado en el reglamento como causa de fuerza mayor.")

    def test_07_resolucion_sin_motivo_es_rechazada(self):
        """
        Rúbrica: 'el organizador la acepta o rechaza con motivo'.
        Si se intenta responder con motivo vacío o menor a 3 caracteres, se rechaza.
        """
        sesion = self.crear_sesion_con_participantes()

        registrar_asistencia_batch(
            self.db,
            sesion_id=sesion.id,
            organizador_id=self.organizador.id,
            asistencias=[ItemAsistencia(usuario_id=self.estudiante_ausente.id, asistencia="ausente")],
        )

        presentar_justificacion(
            self.db,
            sesion_id=sesion.id,
            estudiante_id=self.estudiante_ausente.id,
            texto_justificacion="Motivo válido para probar rechazo de motivo vacío.",
        )

        with self.assertRaises(ValueError):
            responder_justificacion(
                self.db,
                sesion_id=sesion.id,
                estudiante_id=self.estudiante_ausente.id,
                organizador_id=self.organizador.id,
                decision="aceptar",
                motivo="   ",  # Vacío
            )

    def test_08_auditoria_historial_conserva_todos_los_cambios(self):
        """
        Rúbrica: 'Conserven el historial de cambios'.
        Verifica que en HistorialCambioAsistencia se registren en orden cronológico:
        1. Registro de asistencia.
        2. Envío de la justificación.
        3. Resolución de la justificación con motivo.
        """
        sesion = self.crear_sesion_con_participantes()

        # 1. Marcar ausencia
        registrar_asistencia_batch(
            self.db,
            sesion_id=sesion.id,
            organizador_id=self.organizador.id,
            asistencias=[ItemAsistencia(usuario_id=self.estudiante_ausente.id, asistencia="ausente")],
        )

        # 2. Enviar justificación
        presentar_justificacion(
            self.db,
            sesion_id=sesion.id,
            estudiante_id=self.estudiante_ausente.id,
            texto_justificacion="Tuve cita médica urgente en la CNS.",
        )

        # 3. Resolver justificación
        responder_justificacion(
            self.db,
            sesion_id=sesion.id,
            estudiante_id=self.estudiante_ausente.id,
            organizador_id=self.organizador.id,
            decision="aceptar",
            motivo="Baja médica presentada correctamente.",
        )

        # Consultar la tabla de auditoría para esta sesión y estudiante
        historial = (
            self.db.query(HistorialCambioAsistencia)
            .filter(
                HistorialCambioAsistencia.sesion_id == sesion.id,
                HistorialCambioAsistencia.usuario_id == self.estudiante_ausente.id,
            )
            .order_by(HistorialCambioAsistencia.id.asc())
            .all()
        )

        self.assertEqual(len(historial), 3)

        # Evento 1: Registro de asistencia
        self.assertEqual(historial[0].tipo_evento, "registro_asistencia")
        self.assertEqual(historial[0].estado_nuevo, "ausente")
        self.assertEqual(historial[0].actor_id, self.organizador.id)

        # Evento 2: Envío de justificación
        self.assertEqual(historial[1].tipo_evento, "envio_justificacion")
        self.assertEqual(historial[1].estado_nuevo, "pendiente")
        self.assertEqual(historial[1].actor_id, self.estudiante_ausente.id)

        # Evento 3: Resolución de justificación
        self.assertEqual(historial[2].tipo_evento, "resolucion_justificacion")
        self.assertEqual(historial[2].estado_nuevo, "aceptada")
        self.assertEqual(historial[2].actor_id, self.organizador.id)
        self.assertIn("Baja médica", historial[2].detalle)
