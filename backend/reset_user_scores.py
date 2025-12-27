#!/usr/bin/env python3
"""Reset all user scores to 0 in users.db"""

import sqlite3
from pathlib import Path

# Path to users database
DB_PATH = Path(__file__).parent / "users.db"

def reset_scores():
    """Reset all scores to 0 in the users table"""
    try:
        # Connect to database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Update all scores to 0
        cursor.execute("UPDATE users SET score = 0")
        
        # Get count of affected rows
        affected_rows = cursor.rowcount
        
        # Commit changes
        conn.commit()
        
        print(f"Successfully reset {affected_rows} user scores to 0")
        
        # Verify the change
        cursor.execute("SELECT COUNT(*), SUM(score) FROM users")
        count, total_score = cursor.fetchone()
        print(f"Verification: {count} users, total score: {total_score}")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_scores()
