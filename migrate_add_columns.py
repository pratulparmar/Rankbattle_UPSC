import psycopg2

DB_URL = "postgresql://postgres:TzkcmJIkHZrKZljfaGaQcKhBZHuwfkcr@hopper.proxy.rlwy.net:47135/railway"

migrations = [
    "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS marked_review BOOLEAN DEFAULT FALSE",
    "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rag_viewed BOOLEAN DEFAULT FALSE",
    "ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS score FLOAT",
    "ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP",
]

conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cur = conn.cursor()

for sql in migrations:
    try:
        cur.execute(sql)
        print(f"✅ {sql[:70]}...")
    except Exception as e:
        print(f"⚠️  {sql[:70]}... → {e}")

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name='attempts' 
    ORDER BY ordinal_position
""")
print("\n=== attempts columns ===")
for row in cur.fetchall():
    print(f"  {row[0]:30s} {row[1]}")

conn.close()
print("\n✅ Done")
