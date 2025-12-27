"""
Migration script to add boosters column to teams table
"""
import sqlite3
from pathlib import Path

# Path to the database
DB_PATH = Path(__file__).parent / "users.db"

def add_boosters_column():
    """Add boosters column to teams table if it doesn't exist"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(teams)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'boosters' not in columns:
            print("Adding 'boosters' column to teams table...")
            cursor.execute("""
                ALTER TABLE teams 
                ADD COLUMN boosters TEXT DEFAULT '{}'
            """)
            conn.commit()
            print("✓ Successfully added 'boosters' column")
        else:
            print("'boosters' column already exists")
            
    except Exception as e:
        print(f"✗ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("Running database migration...")
    add_boosters_column()
    print("Migration complete!")
