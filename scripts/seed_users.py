"""Seed de contas de teste no auth.db do ContalSpeak.

Grava diretamente no banco real do app (AppData/Roaming) e verifica
cada hash com bcrypt.checkpw antes de confirmar. Rodar com o app fechado.
"""
import os
import sqlite3
import uuid
from datetime import datetime, timezone

import bcrypt

DB_PATH = r"C:\Users\sarte\AppData\Roaming\com.contalspeak.app\auth.db"

USERS = [
    ("alice", "alice@contalspeak.local", "alice123", "Alice Silva"),
    ("bob", "bob@contalspeak.local", "bob12345", "Bob Santos"),
    ("carol", "carol@contalspeak.local", "carol123", "Carol Oliveira"),
    ("dave", "dave@contalspeak.local", "dave1234", "Dave Lima"),
]


def main() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL COLLATE NOCASE,
            email TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    for username, email, password, display_name in USERS:
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        uid = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        try:
            cur.execute(
                "INSERT INTO users (id, username, email, password_hash, display_name, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (uid, username, email, pw_hash, display_name, now),
            )
            print(f"INSERTED: {username}")
        except sqlite3.IntegrityError as exc:
            print(f"SKIP: {username} ({exc})")
    conn.commit()

    print("--- verification ---")
    for username, _email, password, _dn in USERS:
        row = cur.execute(
            "SELECT password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()
        if row is None:
            print(f"MISSING: {username}")
            continue
        ok = bcrypt.checkpw(password.encode(), row[0].encode())
        print(f"{username}: hash_prefix={row[0][:7]} checkpw={ok}")

    total = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    print(f"total users in db: {total}")
    conn.close()


if __name__ == "__main__":
    main()