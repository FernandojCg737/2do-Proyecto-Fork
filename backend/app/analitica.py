import json
from datetime import datetime, timezone
from app.modelos_db import Evento

# 4. Va a la tabla eventos (guarda en la misma base de datos que ya usa su app)
def guardarEvento(registro: dict, db):
    evento_obj = Evento(
        evento=registro["evento"],
        props=json.dumps(registro.get("props", {})),
        fecha=registro["fecha"],
    )
    db.add(evento_obj)
    db.commit()

# // analitica.py (Diapositiva 7/13)
def track(evento: str, props: dict, db):
    registro = {
        "evento": evento,
        "props": props,
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    guardarEvento(registro, db)
    print(f"[evento] {registro}")
    return registro

