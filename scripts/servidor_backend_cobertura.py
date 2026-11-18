"""
Levanta el backend de StudyMatch midiendo cobertura (coverage.py) mientras corren las pruebas E2E.

Uso (lo llama scripts/cobertura.mjs):
    python scripts/servidor_backend_cobertura.py <archivo-de-parada>

El servidor se detiene en orden cuando aparece <archivo-de-parada>; recién entonces
coverage guarda los datos (matarlo con Ctrl+C o taskkill los perdería en Windows).
"""
import sys
import threading
import time
from pathlib import Path

import coverage

BACKEND = Path(__file__).resolve().parents[1] / "backend"
archivo_parada = Path(sys.argv[1])

cov = coverage.Coverage(config_file=str(BACKEND / ".coveragerc"), data_file=str(BACKEND / ".coverage"))
cov.start()

sys.path.insert(0, str(BACKEND))
import uvicorn  # noqa: E402
from main import app  # noqa: E402  (se importa después de iniciar coverage)

servidor = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning"))


def vigilar_parada():
    while not archivo_parada.exists():
        time.sleep(0.5)
    servidor.should_exit = True


threading.Thread(target=vigilar_parada, daemon=True).start()
servidor.run()
cov.stop()
cov.save()
print("[cobertura] datos del backend guardados", flush=True)
