# src/load_sqlite.py
import sqlite3
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT = BASE_DIR / "Entgelttabelle_clean" / "TV-L_clean.csv"
DB_PATH = BASE_DIR / "data" / "salaries.db"


def main():
    # Load the normalized CSV
    df = pd.read_csv(INPUT)

    # Create data folder if missing
    DB_PATH.parent.mkdir(exist_ok=True)

    # Connect to SQLite
    con = sqlite3.connect(DB_PATH)

    # Write to table "tvl_salaries"
    df.to_sql("tvl_salaries", con, if_exists="replace", index=False)

    # Create helpful indexes for queries
    cur = con.cursor()
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_tvl_group_stufe ON tvl_salaries(Entgeltgruppe, Stufe)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_tvl_valid_from ON tvl_salaries(valid_from)"
    )
    con.commit()
    con.close()

    print(f"✅ Loaded {len(df)} rows into {DB_PATH} (table: tvl_salaries)")


if __name__ == "__main__":
    main()
