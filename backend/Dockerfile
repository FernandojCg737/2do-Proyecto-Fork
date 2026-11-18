FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Normaliza los saltos de línea del script (por si se editó en Windows con CRLF)
RUN sed -i 's/\r$//' start.sh

# Render asigna el puerto con la variable PORT (10000 por defecto).
# docker-compose sobrescribe este comando con su propio "command" y usa el 8000.
EXPOSE 10000

CMD ["sh", "start.sh"]
