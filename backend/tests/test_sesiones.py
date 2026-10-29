from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session

from app.database import Base, inicializar_db
from app.modelos_db import Inscripcion, SesionEstudio
from app.repositorio import (
    buscar_sesiones, guardar_sesion, guardar_usuario,
    motivo_para_unirse, unirse_a_sesion,
)
from tests.base_db import PruebaConBaseDeDatos


class TestInscripcionesYFiltros(PruebaConBaseDeDatos):
    def setUp(self):
        super().setUp()
        self.hoy = date(2026, 10, 20)
        self.alumno = guardar_usuario(self.db, "Alumno", "alumno@example.test", "hash")
        self.otro = guardar_usuario(self.db, "Otro", "otro@example.test", "hash")

    def crear(self, nombre="Repaso de Ãlgebra", materia="MatemÃ¡tica", dias=1,
              modalidad="virtual", cupo=2, abiertas=True):
        return guardar_sesion(self.db, nombre, self.hoy + timedelta(days=dias),
                              modalidad, cupo, abiertas, self.usuario.id, materia)

    def buscar(self, **filtros):
        return buscar_sesiones(self.db, self.alumno.id, hoy=self.hoy, **filtros)

    def test_inscripcion_se_guarda_sin_cambiar_capacidad(self):
        sesion = self.crear()
        unirse_a_sesion(self.db, sesion.id, self.alumno.id, self.hoy)
        with Session(self.engine) as db:
            self.assertIsNotNone(db.get(Inscripcion, (self.alumno.id, sesion.id)))
            self.assertEqual(db.get(SesionEstudio, sesion.id).cupo, 2)
            tarjeta = buscar_sesiones(db, self.alumno.id, hoy=self.hoy)[0]
            self.assertEqual(tarjeta["cupos_disponibles"], 1)
            self.assertTrue(tarjeta["inscrito"])
            self.assertFalse(tarjeta["puede_unirse"])

    def test_rechaza_cerrada_pasada_hoy_creador_y_sin_cupos(self):
        for dias, abiertas, cupo, usuario_id in [
            (1, False, 2, self.alumno.id),
            (-1, True, 2, self.alumno.id),
            (0, True, 2, self.alumno.id),
            (1, True, 2, self.usuario.id),
            (1, True, 1, self.alumno.id),
        ]:
            with self.subTest(dias=dias, abiertas=abiertas, cupo=cupo, usuario=usuario_id):
                sesion = self.crear(dias=dias, abiertas=abiertas, cupo=cupo)
                if cupo == 1:
                    unirse_a_sesion(self.db, sesion.id, self.otro.id, self.hoy)
                with self.assertRaises(ValueError):
                    unirse_a_sesion(self.db, sesion.id, usuario_id, self.hoy)
                self.assertIsNone(self.db.get(Inscripcion, (usuario_id, sesion.id)))

    def test_rechaza_duplicado_y_sesion_inexistente(self):
        sesion = self.crear()
        unirse_a_sesion(self.db, sesion.id, self.alumno.id, self.hoy)
        with self.assertRaisesRegex(ValueError, r"inscrito"):
            unirse_a_sesion(self.db, sesion.id, self.alumno.id, self.hoy)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Inscripcion)), 1)
        with self.assertRaisesRegex(ValueError, "no existe"):
            unirse_a_sesion(self.db, 999, self.alumno.id, self.hoy)

    def test_regla_se_puede_probar_sin_interfaz_ni_base(self):
        sesion = SesionEstudio(usuario_id=1, cupo=3, fecha=self.hoy + timedelta(days=1),
                              inscripciones_abiertas=True)
        self.assertEqual(motivo_para_unirse(sesion, 2, 0, False, self.hoy), "")
        self.assertIn("cerradas", motivo_para_unirse(
            SesionEstudio(usuario_id=1, cupo=3, fecha=sesion.fecha, inscripciones_abiertas=False),
            2, 0, False, self.hoy,
        ))

    def test_filtros_combinados_y_busqueda_con_acentos(self):
        esperada = self.crear()
        self.crear(nombre="Otra sesiÃ³n", modalidad="presencial")
        self.crear(nombre="Repaso de Ãlgebra", materia="FÃ­sica")
        resultado = self.buscar(nombre="ÃLGEBRA", materia="matemÃ¡tica", modalidad="virtual",
                                periodo="proximos7", disponible=True)
        self.assertEqual([s["id"] for s in resultado], [esperada.id])
        self.assertEqual(self.buscar(nombre="No existe"), [])
        self.assertEqual(self.buscar(materia="QuÃ­mica"), [])

    def test_fechas_hoy_siete_dias_y_rango_inclusivo(self):
        sesiones = {dias: self.crear(dias=dias) for dias in (-1, 0, 1, 7, 8)}
        self.assertEqual([s["id"] for s in self.buscar(periodo="hoy")], [sesiones[0].id])
        self.assertEqual([s["id"] for s in self.buscar(periodo="proximos7")],
                         [sesiones[1].id, sesiones[7].id])
        self.assertEqual([s["id"] for s in self.buscar(periodo="rango", desde=self.hoy,
                         hasta=self.hoy + timedelta(days=1))], [sesiones[0].id, sesiones[1].id])
        with self.assertRaises(ValueError):
            self.buscar(periodo="rango")
        with self.assertRaises(ValueError):
            self.buscar(desde=self.hoy, hasta=self.hoy - timedelta(days=1))

    def test_disponibilidad_usa_la_misma_regla_de_inscripcion(self):
        disponible = self.crear()
        inscrita = self.crear()
        llena = self.crear(cupo=1)
        self.crear(abiertas=False)
        self.crear(dias=-1)
        self.crear(dias=0)
        unirse_a_sesion(self.db, inscrita.id, self.alumno.id, self.hoy)
        unirse_a_sesion(self.db, llena.id, self.otro.id, self.hoy)
        resultado = self.buscar(disponible=True)
        self.assertEqual([s["id"] for s in resultado], [disponible.id])
        # Para el creador, ninguna de sus propias sesiones estÃ¡ disponible.
        self.assertEqual(buscar_sesiones(self.db, self.usuario.id, disponible=True, hoy=self.hoy), [])

    def test_actualizacion_de_tabla_existente_conserva_datos(self):
        engine = create_engine("sqlite://")
        try:
            with engine.begin() as conexion:
                conexion.execute(text("CREATE TABLE sesiones (id INTEGER PRIMARY KEY, nombre TEXT)"))
                conexion.execute(text("INSERT INTO sesiones VALUES (1, 'Sesion anterior')"))
            with patch("app.database.engine", engine):
                inicializar_db()
                inicializar_db()
            with engine.connect() as conexion:
                fila = conexion.execute(text("SELECT nombre, materia FROM sesiones")).one()
                self.assertEqual(tuple(fila), ("Sesion anterior", "General"))
        finally:
            engine.dispose()

    def test_dos_personas_no_ocupan_el_ultimo_cupo(self):
        # Este caso usa un archivo temporal porque simula dos conexiones reales.
        carpeta_tests = Path(__file__).resolve().parent
        with TemporaryDirectory(dir=carpeta_tests) as carpeta:
            assert Path(carpeta).resolve().parent == carpeta_tests
            ruta = (Path(carpeta) / "concurrencia.db").as_posix()
            engine = create_engine(f"sqlite:///{ruta}", connect_args={"check_same_thread": False})
            try:
                Base.metadata.create_all(engine)
                with Session(engine, expire_on_commit=False) as db:
                    creador = guardar_usuario(db, "Creador", "c@example.test", "hash")
                    a = guardar_usuario(db, "A", "a@example.test", "hash")
                    b = guardar_usuario(db, "B", "b@example.test", "hash")
                    sesion = guardar_sesion(db, "Ultimo cupo", self.hoy + timedelta(days=1),
                                            "virtual", 1, True, creador.id)
                    sesion_id, usuarios = sesion.id, [a.id, b.id]

                def intentar(usuario_id):
                    with Session(engine) as db:
                        try:
                            unirse_a_sesion(db, sesion_id, usuario_id, self.hoy)
                            return True
                        except ValueError:
                            return False

                with ThreadPoolExecutor(max_workers=2) as tareas:
                    resultados = list(tareas.map(intentar, usuarios))
                self.assertEqual(sum(resultados), 1)
                with Session(engine) as db:
                    self.assertEqual(db.scalar(select(func.count()).select_from(Inscripcion)), 1)
            finally:
                engine.dispose()

