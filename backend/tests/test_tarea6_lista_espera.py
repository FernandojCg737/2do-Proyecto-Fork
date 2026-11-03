from datetime import date, timedelta
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modelos_db import Inscripcion, SesionEstudio
from app.repositorio import (
    buscar_sesiones,
    guardar_sesion,
    guardar_usuario,
    listar_mis_solicitudes,
    responder_solicitud,
    salir_de_sesion,
    solicitar_unirse,
)
from tests.base_db import PruebaConBaseDeDatos


class TestTarea6ListaDeEspera(PruebaConBaseDeDatos):
    """
    TAREA 6: Pruebas unitarias de la Feature 'Lista de espera' para StudyMatch.
    Reglas a comprobar:
    1. Cupo máximo por sesión.
    2. Si la sesión está llena, la solicitud entra a la lista de espera (orden FIFO).
    3. Si un usuario confirmado sale de la sesión, el primer usuario en espera pasa automáticamente a confirmado.
    4. La persistencia mantiene el estado tras cualquier recarga o consulta.
    """

    def setUp(self):
        super().setUp()
        self.hoy = date(2026, 11, 3)
        self.organizador = self.usuario
        # Creamos 3 estudiantes de prueba
        self.estudiante1 = guardar_usuario(self.db, "Estudiante Uno", "uno@test.bo", "hash1")
        self.estudiante2 = guardar_usuario(self.db, "Estudiante Dos", "dos@test.bo", "hash2")
        self.estudiante3 = guardar_usuario(self.db, "Estudiante Tres", "tres@test.bo", "hash3")

    def crear_sesion(self, cupo=1, abiertas=True, dias=2):
        """Crea una sesión de estudio con cupo configurable para pruebas de concurrencia y límites."""
        return guardar_sesion(
            self.db,
            nombre="Taller Práctico Lista de Espera",
            fecha=self.hoy + timedelta(days=dias),
            modalidad="virtual",
            cupo=cupo,
            abiertas=abiertas,
            usuario_id=self.organizador.id,
            materia="Interacción Hombre-Computador",
        )

    def test_sesion_llena_solicitud_entra_a_lista_de_espera(self):
        """
        Regla 1 & 2: Cuando una sesión con cupo máximo = 1 está llena (1 aceptado),
        la siguiente solicitud no se rechaza, sino que entra en estado 'en_espera'.
        """
        sesion = self.crear_sesion(cupo=1)

        # 1. Estudiante 1 solicita y es aceptado por el organizador (la sesión se llena: 1/1)
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")

        # 2. Estudiante 2 intenta unirse a la sesión que ya está llena
        solicitud_espera = solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)

        # 3. Comprobar que la solicitud quedó guardada como 'en_espera'
        self.assertEqual(solicitud_espera.estado, "en_espera")
        self.assertEqual(solicitud_espera.usuario_id, self.estudiante2.id)

        # 4. Comprobar en base de datos persistente
        with Session(self.engine) as db:
            ins_db = db.get(Inscripcion, (self.estudiante2.id, sesion.id))
            self.assertIsNotNone(ins_db)
            self.assertEqual(ins_db.estado, "en_espera")

    def test_lista_espera_mantiene_orden_fifo(self):
        """
        Regla: Los estudiantes que entran a la lista de espera se ordenan por llegada (FIFO).
        El primero que solicitó tiene posición 1; el segundo tiene posición 2.
        """
        sesion = self.crear_sesion(cupo=1)

        # Estudiante 1 ocupa el único cupo disponible
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")

        # Estudiante 2 se une a la lista de espera (Posición 1)
        solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)

        # Estudiante 3 se une a la lista de espera (Posición 2)
        solicitar_unirse(self.db, sesion.id, self.estudiante3.id, hoy=self.hoy)

        # Verificar orden en buscar_sesiones para cada estudiante
        res_e2 = buscar_sesiones(self.db, self.estudiante2.id, hoy=self.hoy)
        tarjeta_e2 = next(s for s in res_e2 if s["id"] == sesion.id)
        self.assertEqual(tarjeta_e2["posicion_espera"], 1)
        self.assertEqual(tarjeta_e2["en_espera_count"], 2)

        res_e3 = buscar_sesiones(self.db, self.estudiante3.id, hoy=self.hoy)
        tarjeta_e3 = next(s for s in res_e3 if s["id"] == sesion.id)
        self.assertEqual(tarjeta_e3["posicion_espera"], 2)

    def test_usuario_confirmado_sale_y_primer_en_espera_pasa_a_confirmado(self):
        """
        REGLA CENTRAL DE LA TAREA 6:
        'si alguien sale, entra el primero. La prueba comprueba: El primero en espera pasa a confirmado.'
        """
        sesion = self.crear_sesion(cupo=1)

        # 1. Estudiante 1 queda confirmado / aceptado
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")

        # 2. Estudiante 2 entra a la lista de espera (Posición #1)
        solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)

        # 3. Estudiante 3 entra a la lista de espera (Posición #2)
        solicitar_unirse(self.db, sesion.id, self.estudiante3.id, hoy=self.hoy)

        # Verificar estados antes de la salida
        ins_e1_antes = self.db.get(Inscripcion, (self.estudiante1.id, sesion.id))
        ins_e2_antes = self.db.get(Inscripcion, (self.estudiante2.id, sesion.id))
        self.assertEqual(ins_e1_antes.estado, "aceptada")
        self.assertEqual(ins_e2_antes.estado, "en_espera")

        # 4. ACCIÓN: Estudiante 1 sale de la sesión (libera su cupo)
        resultado_salida = salir_de_sesion(self.db, sesion.id, self.estudiante1.id)
        self.assertIsNotNone(resultado_salida["promovido"])
        self.assertEqual(resultado_salida["promovido"]["usuario_id"], self.estudiante2.id)

        # 5. COMPROBACIÓN REQUERIDA:
        # - Estudiante 1 ya no forma parte de la sesión
        self.assertIsNone(self.db.get(Inscripcion, (self.estudiante1.id, sesion.id)))

        # - Estudiante 2 (el primero en espera) PASA A CONFIRMADO ('aceptada') automáticamente
        ins_e2_despues = self.db.get(Inscripcion, (self.estudiante2.id, sesion.id))
        self.assertEqual(ins_e2_despues.estado, "aceptada")
        self.assertIsNotNone(ins_e2_despues.fecha_respuesta)

        # - Estudiante 3 ahora avanza a la posición #1 de la lista de espera
        res_e3 = buscar_sesiones(self.db, self.estudiante3.id, hoy=self.hoy)
        tarjeta_e3 = next(s for s in res_e3 if s["id"] == sesion.id)
        self.assertEqual(tarjeta_e3["posicion_espera"], 1)
        self.assertEqual(tarjeta_e3["en_espera_count"], 1)

    def test_usuario_en_espera_puede_salir_sin_afectar_a_confirmados(self):
        """Un usuario que estaba en lista de espera puede cancelar su lugar sin alterar los cupos de los confirmados."""
        sesion = self.crear_sesion(cupo=1)

        # Estudiante 1 confirmado
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")

        # Estudiante 2 en espera
        solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)

        # Estudiante 2 decide salir de la lista de espera
        res = salir_de_sesion(self.db, sesion.id, self.estudiante2.id)
        self.assertIsNone(res["promovido"])

        # Estudiante 1 sigue confirmado y ya no hay nadie en espera
        ins_e1 = self.db.get(Inscripcion, (self.estudiante1.id, sesion.id))
        self.assertEqual(ins_e1.estado, "aceptada")
        self.assertIsNone(self.db.get(Inscripcion, (self.estudiante2.id, sesion.id)))

    def test_no_permite_duplicar_en_lista_de_espera(self):
        """Un estudiante que ya está en lista de espera no puede enviar otra solicitud a la misma sesión."""
        sesion = self.crear_sesion(cupo=1)
        solicitar_unirse(self.db, sesion.id, self.estudiante1.id, hoy=self.hoy)
        responder_solicitud(self.db, sesion.id, self.estudiante1.id, self.organizador.id, "aceptar")

        # Entra a la lista de espera
        solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)

        # Intento de duplicación
        with self.assertRaisesRegex(ValueError, "lista de espera"):
            solicitar_unirse(self.db, sesion.id, self.estudiante2.id, hoy=self.hoy)

