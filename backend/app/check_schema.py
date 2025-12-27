import sqlite3
conn = sqlite3.connect('players.db')
cursor = conn.cursor()
cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
print("Tables:", cursor.fetchall())
cursor.execute('PRAGMA table_info("2025owc")')
cols = cursor.fetchall()
print("Columns:")
for col in cols:
    print(f"  {col[1]} ({col[2]})")
conn.close()
