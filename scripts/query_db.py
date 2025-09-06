import sqlite3
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "salaries.db"


def main():
    con = sqlite3.connect(DB_PATH)

    # Example 1: lookup E 13, Stufe 3
    query = """
    SELECT Entgeltgruppe, Stufe, Salary, valid_from
    FROM tvl_salaries
    WHERE Entgeltgruppe = 'E 13' AND Stufe = 3
    """
    df = pd.read_sql(query, con)
    print("Lookup E 13, Stufe 3:")
    print(df)

    # Example 2: show all Stufen for E 13
    query2 = """
    SELECT *
    FROM tvl_salaries
    WHERE Entgeltgruppe = 'E 13'
    ORDER BY Stufe
    """
    df2 = pd.read_sql(query2, con)
    print("\nAll Stufen for E 13:")
    print(df2)

    con.close()


if __name__ == "__main__":
    main()
