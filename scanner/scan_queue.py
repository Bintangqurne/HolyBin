"""
Offline queue berbasis SQLite.
Scan yang gagal (koneksi putus) disimpan di sini dan di-retry saat online.
"""
import sqlite3
import os
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "queue.db")
MAX_RETRY = 100
MAX_AGE_DAYS = 7


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pending_scans (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_code   TEXT    NOT NULL,
                bin_code    TEXT    NOT NULL,
                scanned_at  REAL    NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                created_at  REAL    NOT NULL DEFAULT 0
            )
        """)
        conn.commit()


def enqueue(user_code: str, bin_code: str, scanned_at: float) -> None:
    # created_at diisi dari Python (bukan unixepoch() SQLite, yang butuh SQLite >= 3.38)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO pending_scans (user_code, bin_code, scanned_at, created_at) "
            "VALUES (?, ?, ?, ?)",
            (user_code, bin_code, scanned_at, time.time()),
        )
        conn.commit()


def get_pending() -> list[dict]:
    cutoff = time.time() - MAX_AGE_DAYS * 86400
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            "SELECT id, user_code, bin_code, scanned_at, retry_count FROM pending_scans "
            "WHERE retry_count < ? AND created_at > ? ORDER BY scanned_at ASC LIMIT 20",
            (MAX_RETRY, cutoff),
        ).fetchall()
    return [{"id": r[0], "user_code": r[1], "bin_code": r[2], "scanned_at": r[3], "retry_count": r[4]} for r in rows]


def mark_synced(row_id: int) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM pending_scans WHERE id = ?", (row_id,))
        conn.commit()


def increment_retry(row_id: int) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE pending_scans SET retry_count = retry_count + 1 WHERE id = ?", (row_id,))
        conn.commit()


def pending_count() -> int:
    with sqlite3.connect(DB_PATH) as conn:
        return conn.execute("SELECT COUNT(*) FROM pending_scans").fetchone()[0]
