# Base de Datos StudyMatch (Servicio Exclusivo e Independiente)

Este directorio gestiona la base de datos independiente del proyecto.

## Detalles de Conexión (Docker)

- **Motor:** PostgreSQL 16 Alpine
- **Contenedor:** `studymatch_fork_db`
- **Host (en red Docker):** `db`
- **Host (desde tu máquina host/Windows):** `localhost` o `127.0.0.1`
- **Puerto interno:** `5432`
- **Puerto expuesto en host:** `5434`
- **Base de datos:** `studymatch`
- **Usuario:** `postgres`
- **Contraseña:** `studymatch123`
- **Volumen de persistencia:** `./database/pgdata`

## Datos de Prueba Poblados

El servicio ejecuta el script `seed_data.py` automáticamente al levantar, creando los 5 usuarios y las 7 sesiones de estudio.
