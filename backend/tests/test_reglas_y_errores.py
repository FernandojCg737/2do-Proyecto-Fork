"""
Pruebas de las reglas de negocio y de los caminos de error del código agregado en el fork.

Las pruebas de cada tarea (test_tarea5 ... test_tarea8, test_http) recorren el camino feliz.
Este archivo comprueba lo que pasa cuando algo sale mal: sesión inexistente, usuario ajeno,
estado que no corresponde, texto demasiado corto, base de datos caída, etc. Así cada regla
queda verificada en ambos sentidos y diff-cover puede medir el 100 % del código agregado.

Se agrupan por capa:
  - Repositorio (app/repositorio.py): reglas de negocio.
  - Rutas (app/routes.py): traducción de cada error a su código HTTP (400, 403, 500).
  - Esquemas (app/models.py): validaciones del payload.
  - Autenticación (app/services.py), analítica (app/analitica.py),
    base de datos (app/database.py) y configuración (app/config.py).
"""
import os
import runpy
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text

from app import database, routes
from app.analitica import track
from app.modelos_db import Evento, Inscripcion, SesionEstudio
from app.models import (
    CancelarSesion,
    EliminarCuenta,
    EnviarJustificacion,
    ItemAsistencia,
    RegistrarAsistenciaBatch,
    ReprogramarSesion,
    ResponderJustificacion,
    ResponderSolicitud,
)
from app.repositorio import (
    buscar_sesiones,
    cancelar_sesion_estudio,
    eliminar_cuenta_usuario,
    fecha_iso_utc,
    finalizar_sesion,
    guardar_sesion,
    guardar_usuario,
    motivo_para_unirse,
    obtener_asistencia_sesion,
    obtener_expediente_mis_datos,
    obtener_historial,
    obtener_resumen_analitica,
    presentar_justificacion,
    reconfirmar_participacion,
    registrar_asistencia_batch,
    reprogramar_sesion,
    responder_justificacion,
    responder_solicitud,
    salir_de_sesion,
    solicitar_unirse,
)
from app.services import crear_token, hash_password, obtener_usuario_actual
from tests.base_db import PruebaConBaseDeDatos

FUTURA = date(2099, 1, 15)
PASADA = date(2020, 1, 15)
HOY = date(2026, 11, 5)
NO_EXISTE = 9999


class ConEscenario(PruebaConBaseDeDatos):
    """Organizador (self.usuario), una estudiante (Ana) y un tercero (Luis)."""

    def setUp(self):
        super().setUp()
        self.org = self.usuario
        self.ana = guardar_usuario(self.db, "Ana", "ana@example.test", hash_password("Clave123"))
        self.luis = guardar_usuario(self.db, "Luis", "luis@example.test", "hash")

    def sesion(self, fecha=FUTURA, cupo=3, abiertas=True, organizador=None):
        return guardar_sesion(self.db, "Repaso", fecha, "virtual", cupo, abiertas,
                              (organizador or self.org).id, "Física")

    def inscribir(self, usuario, sesion, estado="aceptada", fecha=datetime(2026, 1, 1, 10), **campos):
        inscripcion = Inscripcion(usuario_id=usuario.id, sesion_id=sesion.id, estado=estado,
                                  fecha_inscripcion=fecha, **campos)
        self.db.add(inscripcion)
        self.db.commit()
        return inscripcion

    def marcar(self, sesion, **campos):
        for campo, valor in campos.items():
            setattr(sesion, campo, valor)
        self.db.commit()

    def assertError(self, mensaje, funcion, *args, error=ValueError, **kwargs):
        with self.assertRaises(error) as contexto:
            funcion(*args, **kwargs)
        self.assertIn(mensaje, str(contexto.exception))


# =============================================================================
# Repositorio: reglas de negocio
# =============================================================================

class TestFechasYMotivos(ConEscenario):
    def test_fecha_iso_utc_con_texto(self):
        self.assertEqual(fecha_iso_utc("2026-11-05T10:00:00"), "2026-11-05T10:00:00Z")
        self.assertEqual(fecha_iso_utc("2026-11-05T10:00:00Z"), "2026-11-05T10:00:00Z")
        self.assertEqual(fecha_iso_utc("2026-11-05T10:00:00+00:00"), "2026-11-05T10:00:00+00:00")

    def test_no_se_puede_unir_a_una_sesion_cancelada(self):
        sesion = self.sesion()
        self.marcar(sesion, cancelada=True)
        self.assertIn("cancelada", motivo_para_unirse(sesion, self.ana.id, 0, False, HOY))


class TestSolicitarUnirse(ConEscenario):
    def test_sesion_inexistente(self):
        self.assertError("no existe", solicitar_unirse, self.db, NO_EXISTE, self.ana.id, HOY)

    def test_sesion_cancelada(self):
        sesion = self.sesion()
        self.marcar(sesion, cancelada=True)
        self.assertError("cancelada por el organizador", solicitar_unirse, self.db, sesion.id, self.ana.id, HOY)

    def test_sesion_pasada(self):
        sesion = self.sesion(fecha=PASADA)
        self.assertError("ya ocurrieron", solicitar_unirse, self.db, sesion.id, self.ana.id, HOY)

    def test_sesion_finalizada(self):
        sesion = self.sesion()
        self.marcar(sesion, finalizada=True)
        self.assertError("ya concluyó", solicitar_unirse, self.db, sesion.id, self.ana.id, HOY)

    def test_participacion_cancelada_no_puede_volver(self):
        sesion = self.sesion()
        self.inscribir(self.ana, sesion, "cancelada")
        self.assertError("fue cancelada", solicitar_unirse, self.db, sesion.id, self.ana.id, HOY)

    def test_ya_tiene_cupo_pendiente_de_reconfirmar(self):
        sesion = self.sesion()
        self.inscribir(self.ana, sesion, "pendiente_reconfirmacion")
        self.assertError("pendiente de reconfirmar", solicitar_unirse, self.db, sesion.id, self.ana.id, HOY)

    def test_rechazada_puede_volver_a_solicitar(self):
        sesion = self.sesion()
        self.inscribir(self.ana, sesion, "rechazada", fecha_respuesta=datetime(2026, 1, 2))
        inscripcion = solicitar_unirse(self.db, sesion.id, self.ana.id, HOY)
        self.assertEqual(inscripcion.estado, "pendiente")
        self.assertIsNone(inscripcion.fecha_respuesta)
        self.assertGreater(inscripcion.fecha_inscripcion, datetime(2026, 1, 1, 10))


class TestSalirReprogramarYReconfirmar(ConEscenario):
    def test_salir_de_sesion_inexistente(self):
        self.assertError("no existe", salir_de_sesion, self.db, NO_EXISTE, self.ana.id)

    def test_salir_sin_estar_registrado(self):
        sesion = self.sesion()
        self.assertError("No estás registrado", salir_de_sesion, self.db, sesion.id, self.ana.id)

    def test_reprogramar_sesion_inexistente(self):
        self.assertError("no existe", reprogramar_sesion, self.db, NO_EXISTE, FUTURA, "Cambio", self.org.id, HOY)

    def test_reconfirmar_sesion_inexistente(self):
        self.assertError("no existe", reconfirmar_participacion, self.db, NO_EXISTE, self.ana.id)

    def test_reconfirmar_sin_estar_registrado(self):
        sesion = self.sesion()
        self.assertError("No estás registrado", reconfirmar_participacion, self.db, sesion.id, self.ana.id)

    def test_reconfirmar_sin_reprogramacion_pendiente(self):
        sesion = self.sesion()
        self.inscribir(self.ana, sesion, "aceptada")
        self.assertError("No tienes reconfirmaciones", reconfirmar_participacion, self.db, sesion.id, self.ana.id)


class TestResponderSolicitud(ConEscenario):
    def test_decision_invalida(self):
        sesion = self.sesion()
        self.assertError("'aceptar' o 'rechazar'", responder_solicitud, self.db, sesion.id, self.ana.id, self.org.id, "talvez")

    def test_sesion_inexistente(self):
        self.assertError("no existe", responder_solicitud, self.db, NO_EXISTE, self.ana.id, self.org.id, "aceptar")

    def test_solicitud_inexistente(self):
        sesion = self.sesion()
        self.assertError("No existe una solicitud", responder_solicitud, self.db, sesion.id, self.ana.id, self.org.id, "aceptar")

    def test_solicitud_ya_procesada(self):
        sesion = self.sesion()
        self.inscribir(self.ana, sesion, "aceptada")
        self.assertError("ya fue procesada", responder_solicitud, self.db, sesion.id, self.ana.id, self.org.id, "rechazar")

    def test_sin_cupos_para_aceptar(self):
        sesion = self.sesion(cupo=1)
        self.inscribir(self.luis, sesion, "aceptada")
        self.inscribir(self.ana, sesion, "pendiente")
        self.assertError("No quedan cupos", responder_solicitud, self.db, sesion.id, self.ana.id, self.org.id, "aceptar")


class TestBuscarSesionesEHistorial(ConEscenario):
    def test_en_espera_sin_fecha_de_inscripcion_queda_primero(self):
        # Registros antiguos (antes de la Tarea 6) no tienen fecha de inscripción.
        sesion = self.sesion()
        inscripcion = self.inscribir(self.ana, sesion, "en_espera")
        inscripcion.fecha_inscripcion = None
        self.db.commit()
        self.assertIsNone(self.db.get(Inscripcion, (self.ana.id, sesion.id)).fecha_inscripcion)
        (resultado,) = buscar_sesiones(self.db, self.ana.id, hoy=HOY)
        self.assertEqual(resultado["posicion_espera"], 1)

    def test_participacion_cancelada_muestra_el_motivo(self):
        sesion = self.sesion()
        self.inscribir(self.ana, sesion, "cancelada")
        self.marcar(sesion, motivo_cancelacion="Feriado")
        (resultado,) = buscar_sesiones(self.db, self.ana.id, hoy=HOY)
        self.assertIn("Tu participación fue cancelada", resultado["motivo"])
        self.assertIn("Feriado", resultado["motivo"])

    def test_historial_describe_cada_estado(self):
        casos = [
            ({"estado": "en_espera"}, "En lista de espera"),
            ({"asistencia": "presente"}, "Asistencia confirmada"),
            ({"asistencia": "ausente", "estado_justificacion": "aceptada",
              "motivo_respuesta_justificacion": "Certificado"}, "Ausencia justificada (Aceptada: Certificado)"),
            ({"asistencia": "ausente", "estado_justificacion": "rechazada"}, "Ausencia injustificada (Rechazada: Denegada)"),
            ({"asistencia": "ausente", "estado_justificacion": "pendiente"}, "Justificación en revisión"),
            ({"asistencia": "ausente"}, "Registrado como Ausente"),
        ]
        for dia, (campos, _) in enumerate(casos, start=1):
            campos = dict(campos)
            estado = campos.pop("estado", "aceptada")
            self.inscribir(self.ana, self.sesion(), estado, fecha=datetime(2026, 1, dia), **campos)

        resultados = [fila["resultado"] for fila in reversed(obtener_historial(self.db, self.ana.id))]
        for resultado, (_, esperado) in zip(resultados, casos):
            self.assertIn(esperado, resultado)


class TestAsistenciaYJustificaciones(ConEscenario):
    def setUp(self):
        super().setUp()
        self.ses = self.sesion(fecha=PASADA)

    def test_finalizar(self):
        self.assertError("no existe", finalizar_sesion, self.db, NO_EXISTE, self.org.id)
        sesion = finalizar_sesion(self.db, self.ses.id, self.org.id)
        self.assertTrue(sesion.finalizada)
        self.assertFalse(sesion.inscripciones_abiertas)

    def test_consultar_asistencia(self):
        self.assertError("no existe", obtener_asistencia_sesion, self.db, NO_EXISTE, self.org.id)
        self.inscribir(self.ana, self.ses, "aceptada", asistencia="presente")
        datos = obtener_asistencia_sesion(self.db, self.ses.id, self.ana.id)
        self.assertEqual(datos["participantes"][0]["usuario_id"], self.ana.id)

    def test_registrar_asistencia_errores(self):
        presente = [ItemAsistencia(usuario_id=self.ana.id, asistencia="presente")]
        self.assertError("no existe", registrar_asistencia_batch, self.db, NO_EXISTE, self.org.id, presente)
        self.assertError("no está inscrito", registrar_asistencia_batch, self.db, self.ses.id, self.org.id, presente)
        self.inscribir(self.ana, self.ses, "pendiente")
        self.assertError("inscripción confirmada", registrar_asistencia_batch, self.db, self.ses.id, self.org.id, presente)
        # El esquema ya filtra estados inválidos; el repositorio lo vuelve a comprobar por si se llama directo.
        tarde = [SimpleNamespace(usuario_id=self.ana.id, asistencia="tarde")]
        self.assertError("inválido", registrar_asistencia_batch, self.db, self.ses.id, self.org.id, tarde)
        self.marcar(self.ses, cancelada=True)
        self.assertError("cancelada", registrar_asistencia_batch, self.db, self.ses.id, self.org.id, presente)

    def test_cambiar_ausente_a_presente_anula_la_justificacion_pendiente(self):
        self.inscribir(self.ana, self.ses, "aceptada", asistencia="ausente",
                       justificacion="Estuve enfermo", estado_justificacion="pendiente")
        registrar_asistencia_batch(self.db, self.ses.id, self.org.id,
                                   [ItemAsistencia(usuario_id=self.ana.id, asistencia="presente")])
        inscripcion = self.db.get(Inscripcion, (self.ana.id, self.ses.id))
        self.assertEqual(inscripcion.asistencia, "presente")
        self.assertIsNone(inscripcion.estado_justificacion)
        historial = obtener_asistencia_sesion(self.db, self.ses.id, self.org.id)["historial"]
        self.assertTrue(any("modificada de AUSENTE a: PRESENTE" in h["detalle"] for h in historial))

    def test_presentar_justificacion_errores(self):
        self.assertError("no existe", presentar_justificacion, self.db, NO_EXISTE, self.ana.id, "Estuve enfermo")
        self.inscribir(self.ana, self.ses, "aceptada", asistencia="ausente")
        self.assertError("al menos 5", presentar_justificacion, self.db, self.ses.id, self.ana.id, "  no ")

    def test_responder_justificacion_errores(self):
        self.assertError("no existe", responder_justificacion, self.db, NO_EXISTE, self.ana.id, self.org.id, "aceptar", "Ok")
        self.assertError("no está inscrito", responder_justificacion, self.db, self.ses.id, self.ana.id, self.org.id, "aceptar", "Ok")
        self.inscribir(self.ana, self.ses, "aceptada", asistencia="ausente")
        self.assertError("No existe una justificación pendiente", responder_justificacion,
                         self.db, self.ses.id, self.ana.id, self.org.id, "aceptar", "Ok")
        presentar_justificacion(self.db, self.ses.id, self.ana.id, "Estuve enfermo")
        self.assertError("'aceptar' o 'rechazar'", responder_justificacion,
                         self.db, self.ses.id, self.ana.id, self.org.id, "talvez", "Ok")


class TestCancelarSesion(ConEscenario):
    def test_errores(self):
        self.assertError("no existe", cancelar_sesion_estudio, self.db, NO_EXISTE, self.org.id, "Feriado largo")
        pasada = self.sesion(fecha=PASADA)
        self.assertError("ya ha concluido", cancelar_sesion_estudio, self.db, pasada.id, self.org.id, "Feriado largo")
        futura = self.sesion()
        self.assertError("al menos 5", cancelar_sesion_estudio, self.db, futura.id, self.org.id, " no ")
        cancelar_sesion_estudio(self.db, futura.id, self.org.id, "Feriado largo")
        self.assertError("ya ha sido cancelada", cancelar_sesion_estudio, self.db, futura.id, self.org.id, "Otra vez")


class TestAnaliticaYMisDatos(ConEscenario):
    def test_resumen_sin_inicios_y_con_props_daniadas(self):
        self.db.add(Evento(evento="evento_suelto", props="{esto no es json", fecha="2026-11-05T10:00:00Z"))
        self.db.commit()
        resumen = obtener_resumen_analitica(self.db)
        self.assertEqual(resumen["flujo_mayor_caida"]["inicios"], 0)
        self.assertEqual(resumen["ultimos_eventos"][0]["props"], {})

    def test_track_guarda_el_evento(self):
        registro = track("sesion_creada", {"modalidad": "virtual"}, self.db)
        self.assertEqual(registro["evento"], "sesion_creada")
        guardado = self.db.query(Evento).one()
        self.assertEqual((guardado.evento, guardado.props), ("sesion_creada", '{"modalidad": "virtual"}'))

    def test_expediente(self):
        self.assertError("no existe", obtener_expediente_mis_datos, self.db, NO_EXISTE)
        self.inscribir(self.ana, self.sesion(fecha=PASADA), "aceptada", asistencia="presente")
        expediente = obtener_expediente_mis_datos(self.db, self.ana.id)
        self.assertEqual(expediente["estadisticas"]["total_asistencias_confirmadas"], 1)



class TestEliminarCuenta(ConEscenario):
    def test_errores(self):
        self.assertError("no existe", eliminar_cuenta_usuario, self.db, NO_EXISTE, "Clave123")
        self.assertError("incorrecta", eliminar_cuenta_usuario, self.db, self.ana.id, "OtraClave")

    def test_sale_de_cupos_y_listas_de_espera(self):
        # Ana ocupa un cupo en la sesión A (Luis espera) y está en la lista de espera de la sesión B.
        sesion_a = self.sesion(cupo=1)
        sesion_b = self.sesion(cupo=1)
        self.inscribir(self.ana, sesion_a, "aceptada")
        self.inscribir(self.luis, sesion_a, "en_espera")
        self.inscribir(self.luis, sesion_b, "aceptada")
        self.inscribir(self.ana, sesion_b, "en_espera")

        resultado = eliminar_cuenta_usuario(self.db, self.ana.id, "Clave123")

        self.assertFalse(resultado["bloqueado"])
        self.assertFalse(self.ana.activo)
        self.assertEqual(self.db.get(Inscripcion, (self.luis.id, sesion_a.id)).estado, "aceptada")
        self.assertIsNone(self.db.get(Inscripcion, (self.ana.id, sesion_b.id)))


# =============================================================================
# Rutas: cada error de negocio se traduce a su código HTTP
# =============================================================================

class BaseDeDatosCaida:
    """Simula una base de datos que falla en cualquier operación."""

    def __getattr__(self, nombre):
        raise RuntimeError("base de datos no disponible")


class TestRutasCodigosHTTP(ConEscenario):
    def assertHTTP(self, codigo, funcion, *args, **kwargs):
        with self.assertRaises(HTTPException) as contexto:
            funcion(*args, **kwargs)
        self.assertEqual(contexto.exception.status_code, codigo)

    def test_errores_400_y_403(self):
        sesion = self.sesion()
        motivo = ReprogramarSesion(fecha=FUTURA, motivo="Cambio de aula")
        self.assertHTTP(400, routes.endpoint_salir_de_sesion, sesion.id, self.db, self.ana)
        self.assertHTTP(400, routes.endpoint_reprogramar_sesion, NO_EXISTE, motivo, self.db, self.org)
        self.assertHTTP(400, routes.endpoint_reconfirmar_participacion, sesion.id, self.db, self.ana)
        self.assertHTTP(403, routes.endpoint_responder_solicitud, sesion.id, self.ana.id,
                        ResponderSolicitud(decision="aceptar"), self.db, self.luis)
        self.assertHTTP(400, routes.endpoint_responder_solicitud, sesion.id, self.ana.id,
                        ResponderSolicitud(decision="aceptar"), self.db, self.org)
        self.assertHTTP(400, routes.endpoint_finalizar_sesion, NO_EXISTE, self.db, self.org)
        self.assertHTTP(403, routes.endpoint_consultar_asistencia, sesion.id, self.db, self.luis)
        self.assertHTTP(400, routes.endpoint_consultar_asistencia, NO_EXISTE, self.db, self.org)
        self.assertHTTP(400, routes.endpoint_registrar_asistencia, NO_EXISTE,
                        RegistrarAsistenciaBatch(asistencias=[{"usuario_id": self.ana.id, "asistencia": "presente"}]), self.db, self.org)
        self.assertHTTP(400, routes.endpoint_responder_justificacion, NO_EXISTE, self.ana.id,
                        ResponderJustificacion(decision="aceptar", motivo="Ok!"), self.db, self.org)
        self.assertHTTP(400, routes.endpoint_cancelar_sesion, NO_EXISTE,
                        CancelarSesion(motivo="Feriado largo"), self.db, self.org)
        self.assertHTTP(400, routes.endpoint_eliminar_cuenta,
                        EliminarCuenta(password_confirmacion="OtraClave"), self.db, self.ana)

    def test_justificar_sin_permiso_es_403(self):
        with mock.patch.object(routes, "presentar_justificacion", side_effect=PermissionError("ajeno")):
            self.assertHTTP(403, routes.endpoint_presentar_justificacion, 1,
                            EnviarJustificacion(justificacion="Estuve enfermo"), self.db, self.ana)

    def test_finalizar_responde_mensaje(self):
        sesion = self.sesion()
        respuesta = routes.endpoint_finalizar_sesion(sesion.id, self.db, self.org)
        self.assertIn("concluida", respuesta["mensaje"])

    def test_fallo_de_base_de_datos_es_500(self):
        caida = BaseDeDatosCaida()
        evento = routes.EventoCreate(evento="sesion_creada", props={})
        self.assertHTTP(500, routes.endpoint_registrar_evento, evento, caida)
        self.assertHTTP(500, routes.endpoint_obtener_analitica, caida)
        self.assertHTTP(500, routes.endpoint_ver_mis_datos, caida, self.ana)
        self.assertHTTP(500, routes.endpoint_descargar_mis_datos, "json", caida, self.ana)
        self.assertHTTP(500, routes.endpoint_eliminar_cuenta,
                        EliminarCuenta(password_confirmacion="Clave123"), caida, self.ana)


# =============================================================================
# Esquemas, autenticación, base de datos y configuración
# =============================================================================

class TestEsquemas(unittest.TestCase):
    def test_validaciones_del_payload(self):
        invalidos = [
            (ResponderSolicitud, {"decision": "talvez"}),
            (ItemAsistencia, {"usuario_id": 1, "asistencia": "tarde"}),
            (ResponderJustificacion, {"decision": "talvez", "motivo": "Ok!"}),
            (CancelarSesion, {"motivo": "  ab   "}),
            (EliminarCuenta, {"password_confirmacion": "   "}),
        ]
        for esquema, datos in invalidos:
            with self.subTest(esquema=esquema.__name__), self.assertRaises(ValidationError):
                esquema(**datos)


class TestCuentaEliminada(ConEscenario):
    def test_token_de_cuenta_eliminada_es_rechazado(self):
        self.ana.activo = False
        self.db.commit()
        credenciales = HTTPAuthorizationCredentials(scheme="Bearer", credentials=crear_token(self.ana.email))
        with self.assertRaises(HTTPException) as contexto:
            obtener_usuario_actual(credenciales, self.db)
        self.assertEqual(contexto.exception.status_code, 401)
        self.assertIn("eliminada", contexto.exception.detail)


class TestMigracionDeBaseAntigua(unittest.TestCase):
    """inicializar_db agrega las columnas nuevas a una base creada con una versión anterior."""

    def test_agrega_columnas_faltantes(self):
        motor = create_engine("sqlite://")
        with motor.begin() as conexion:
            conexion.execute(text("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT, "
                                  "email TEXT, password_hash TEXT, reset_code TEXT)"))
            conexion.execute(text("CREATE TABLE sesiones (id INTEGER PRIMARY KEY, nombre TEXT, fecha DATE, "
                                  "modalidad TEXT, cupo INTEGER, inscripciones_abiertas BOOLEAN, usuario_id INTEGER)"))
            conexion.execute(text("CREATE TABLE inscriprciones (usuario_id INTEGER, sesion_id INTEGER, "
                                  "PRIMARY KEY (usuario_id, sesion_id))"))
        with mock.patch.object(database, "engine", motor):
            database.inicializar_db()

        columnas = lambda tabla: {c["name"] for c in inspect(motor).get_columns(tabla)}
        self.assertTrue({"activo", "fecha_eliminacion"} <= columnas("usuarios"))
        self.assertTrue({"materia", "finalizada", "cancelada"} <= columnas("sesiones"))
        self.assertTrue({"estado", "fecha_respuesta", "asistencia", "fecha_asistencia", "justificacion",
                         "fecha_justificacion", "estado_justificacion", "motivo_respuesta_justificacion",
                         "fecha_respuesta_justificacion", "fecha_inscripcion"} <= columnas("inscriprciones"))
        motor.dispose()


class TestArranqueSegunEntorno(unittest.TestCase):
    """
    database.py y config.py deciden al importarse qué base y qué .env usar.
    Se ejecutan de nuevo en un espacio aislado (runpy) simulando cada entorno:
    ejecutable empaquetado (sys.frozen), sin DATABASE_URL y con PostgreSQL apagado.
    """

    def setUp(self):
        carpeta = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(carpeta.cleanup)
        self.dir = Path(carpeta.name)
        self.app_dir = Path(database.__file__).resolve().parent

    def ejecutar(self, modulo, entorno):
        with mock.patch.object(sys, "frozen", True, create=True), \
             mock.patch.object(sys, "_MEIPASS", str(self.dir), create=True), \
             mock.patch.dict(os.environ, entorno), \
             mock.patch("builtins.print"):
            # Solo cuentan las variables del escenario: se quitan las que traiga la terminal.
            for variable in ("DATABASE_URL", "ALLOWED_ORIGINS"):
                if variable not in entorno:
                    os.environ.pop(variable, None)
            return runpy.run_path(str(self.app_dir / modulo))

    def test_sin_database_url_usa_sqlite_local(self):
        espacio = self.ejecutar("database.py", {})
        espacio["engine"].dispose()
        self.assertTrue(espacio["is_sqlite"])
        self.assertEqual(espacio["BASE_DIR"], self.dir)
        self.assertTrue((self.dir / "database").is_dir())

    def test_postgres_apagado_cae_a_sqlite(self):
        espacio = self.ejecutar("database.py", {
            "DATABASE_URL": "postgresql://usuario:clave@127.0.0.1:1/studymatch?connect_timeout=1",
        })
        espacio["engine"].dispose()
        self.assertTrue(espacio["is_sqlite"])
        self.assertTrue(espacio["DATABASE_URL"].startswith("sqlite:///"))

    def test_postgres_disponible_se_usa_directamente(self):
        motor_postgres = mock.MagicMock()
        with mock.patch("sqlalchemy.create_engine", return_value=motor_postgres) as crear:
            espacio = self.ejecutar("database.py", {"DATABASE_URL": "postgresql://usuario:clave@db:5432/studymatch"})
        crear.assert_called_once_with("postgresql://usuario:clave@db:5432/studymatch", pool_pre_ping=True)
        motor_postgres.connect.assert_called_once()
        self.assertFalse(espacio["is_sqlite"])
        self.assertIs(espacio["engine"], motor_postgres)

    def test_config_lee_el_env_de_backend(self):
        (self.dir / "backend").mkdir()
        (self.dir / "backend" / ".env").write_text("ALLOWED_ORIGINS=https://ejemplo.test\n", encoding="utf-8")
        espacio = self.ejecutar("config.py", {})
        self.assertEqual(espacio["ALLOWED_ORIGINS"], ["https://ejemplo.test"])

    def test_config_sin_env(self):
        espacio = self.ejecutar("config.py", {"ALLOWED_ORIGINS": "https://otro.test"})
        self.assertEqual(espacio["ALLOWED_ORIGINS"], ["https://otro.test"])


if __name__ == "__main__":
    unittest.main()
