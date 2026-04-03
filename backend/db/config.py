import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
SCHEMA_FILE = BASE_DIR / "db" / "schema.sql"


def get_db_settings() -> dict[str, object]:
    return {
        "host": os.getenv("PGHOST", "127.0.0.1"),
        "port": int(os.getenv("PGPORT", "5432")),
        "dbname": os.getenv("PGDATABASE", "tarimpro"),
        "user": os.getenv("PGUSER", "postgres"),
        "password": os.getenv("PGPASSWORD") or None,
    }
