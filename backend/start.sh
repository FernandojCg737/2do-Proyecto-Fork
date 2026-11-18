#!/bin/sh
# Arranque del backend en contenedor (Render / Docker).
# 1. Crea las tablas y carga los usuarios de prueba si la base está vacía.
# 2. Inicia la API en el puerto que asigna la plataforma (PORT) o en 10000 por defecto.
set -e
python seed_data.py
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-10000}"
