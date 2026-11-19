import json
from datetime import datetime, timezone
from app.modelos_db import Evento

def guardarEvento(registro: dict, db):
    evento_obj = Evento(
        evento=registro["evento"],
        props=json.dumps(registro.get("props", {})),
        fecha=registro["fecha"],
    )
    db.add(evento_obj)
    db.commit()

def track(evento: str, props: dict, db):
    registro = {
        "evento": evento,
        "props": props,
        "fecha": datetime.now(timezone.utc).isoformat()
    }
    guardarEvento(registro, db)
    print(f"[evento] {registro}")
    return registro

