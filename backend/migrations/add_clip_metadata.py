#!/usr/bin/env python3
"""
Database migration: Add display_name and notes columns to batch_clips table
Run this once on the server to update the schema.
"""
import sqlite3
import os

DB_PATH = os.environ.get("DATABASE_PATH", "/opt/homemic/data/homemic.db")

def migrate():
    print(f"Migrating database: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if columns exist
    cursor.execute("PRAGMA table_info(batch_clips)")
    columns = {row[1] for row in cursor.fetchall()}
    
    migrations_run = 0
    
    # Add display_name if missing
    if 'display_name' not in columns:
        print("Adding display_name column...")
        cursor.execute("ALTER TABLE batch_clips ADD COLUMN display_name TEXT")
        migrations_run += 1
    else:
        print("display_name column already exists")
    
    # Add notes if missing
    if 'notes' not in columns:
        print("Adding notes column...")
        cursor.execute("ALTER TABLE batch_clips ADD COLUMN notes TEXT")
        migrations_run += 1
    else:
        print("notes column already exists")
    
    conn.commit()
    conn.close()
    
    print(f"Migration complete. {migrations_run} columns added.")

if __name__ == "__main__":
    migrate()
