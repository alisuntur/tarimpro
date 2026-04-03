from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from .config import get_db_settings


@contextmanager
def get_connection(*, autocommit: bool = False, row_factory=dict_row):
    connection = psycopg.connect(
        **get_db_settings(),
        autocommit=autocommit,
        row_factory=row_factory,
    )
    try:
        yield connection
    finally:
        connection.close()


def test_connection() -> bool:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            return cursor.fetchone() is not None
