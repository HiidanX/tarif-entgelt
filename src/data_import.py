# src/data_import.py

import sqlite3
from pathlib import Path

import pandas as pd

# -------------------------------
# Config: database path
# -------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "salaries.db"


def clean_entgeltgruppe(val: str) -> str:
    """Clean Entgeltgruppe string: remove non-breaking spaces and trim."""
    if pd.isna(val):
        return val
    return val.replace("\xa0", " ").strip()


def import_csv(
    csv_path: Path,
    table_name: str,
    region: str = "ALL",
    valid_from: str = "2025-02-01",
):
    """
    Read a raw CSV, normalize it, and insert into the unified SQLite salaries table.

    Parameters:
        csv_path: Path to raw CSV
        table_name: TV-L, TVöD, etc.
        region: Optional region metadata
        valid_from: Effective date of the salary table
    """

    # -------------------------------
    # Step 1: Read CSV
    # -------------------------------
    df = pd.read_csv(csv_path, sep=";")

    # Remove empty columns
    df = df.loc[:, df.columns.str.strip() != ""]

    # Clean Entgeltgruppe
    df["Entgeltgruppe"] = df["Entgeltgruppe"].apply(clean_entgeltgruppe)

    # Identify Stufe columns (numeric)
    stufe_cols = [col for col in df.columns if col.isdigit()]

    # Normalize from wide → long
    df_long = df.melt(
        id_vars=["Entgeltgruppe"],
        value_vars=stufe_cols,
        var_name="Stufe",
        value_name="Salary",
    )

    # Clean Salary column
    df_long["Salary"] = (
        df_long["Salary"].astype(str).str.replace("\xa0", "").str.strip()
    )
    df_long["Salary"] = pd.to_numeric(df_long["Salary"], errors="coerce")

    # Drop missing salaries
    df_long = df_long.dropna(subset=["Salary"])

    # Cast Stufe to int
    df_long["Stufe"] = df_long["Stufe"].astype(int)

    # Add metadata
    df_long["table_name"] = table_name
    df_long["region"] = region
    df_long["valid_from"] = valid_from

    # -------------------------------
    # Step 2: Save to SQLite
    # -------------------------------
    conn = sqlite3.connect(DB_PATH)
    df_long.to_sql(
        "salaries",
        conn,
        if_exists="append",  # append new table data
        index=False,
    )
    conn.close()

    print(
        f"[INFO] Imported {len(df_long)} rows for table '{table_name}' from {csv_path}"
    )


if __name__ == "__main__":
    # Example usage
    import_csv(BASE_DIR / "Entgelttabelle_raw" / "TV-L.csv", table_name="TV-L")
    import_csv(BASE_DIR / "Entgelttabelle_raw" / "TVoED.csv", table_name="TVöD")
