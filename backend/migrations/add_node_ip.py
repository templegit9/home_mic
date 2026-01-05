#!/usr/bin/env python3
"""
Database migration: Add ip_address column to nodes table
Run this once on the server to update the schema.
"""
import sqlite3
import os

DB_PATH = os.environ.get("DATABASE_PATH", "/opt/homemic/data/homemic.db")

def migrate():
    print(f"Migrating database: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if ip_address column exists in nodes table
    cursor.execute("PRAGMA table_info(nodes)")
    columns = {row[1] for row in cursor.fetchall()}
    
    if 'ip_address' not in columns:
        print("Adding ip_address column to nodes table...")
        cursor.execute("ALTER TABLE nodes ADD COLUMN ip_address TEXT")
        conn.commit()
        print("ip_address column added successfully")
    else:
        print("ip_address column already exists")
    
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
