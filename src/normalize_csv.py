# src/normalize_csv.py

from pathlib import Path

import pandas as pd

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
INPUT = BASE_DIR / "Entgelttabelle_raw" / "TV-L.csv"
OUTPUT = BASE_DIR / "Entgelttabelle_clean" / "TV-L_clean.csv"


def main():
    # Read CSV (tab-separated, since your file has tabs)
    df_raw = pd.read_csv(INPUT, sep=";")

    print("Columns found:", list(df_raw.columns))
    print(df_raw.head())

    # Normalize from wide (1–6 columns) to long format
    df_clean = df_raw.melt(
        id_vars=["Entgeltgruppe"],
        value_vars=["1", "2", "3", "4", "5", "6"],
        var_name="Stufe",
        value_name="Salary",
    )
    # Clean group labels
    df_clean["Entgeltgruppe"] = (
        df_clean["Entgeltgruppe"]
        .astype(str)  # make sure it's string
        .str.replace("\u00A0", " ", regex=False)  # replace non-breaking spaces
        .str.strip()  # trim whitespace
    )

    # Drop missing values (some empty cells in the table)
    df_clean = df_clean.dropna(subset=["Salary"])

    # Cast to numeric types
    df_clean["Stufe"] = df_clean["Stufe"].astype(int)
    df_clean["Salary"] = df_clean["Salary"].astype(float)

    # Add metadata (adjust date to correct validity)
    df_clean["valid_from"] = "2025-02-01"
    df_clean["region"] = "ALL"

    # Save result
    df_clean.to_csv(OUTPUT, index=False)

    assert (df_clean["Salary"] > 1000).all()

    print(f"Normalized data written to {OUTPUT}")

    print("Unique groups:", df_clean["Entgeltgruppe"].unique())
    print("Unique steps:", df_clean["Stufe"].unique())
    print("Row count:", len(df_clean))


if __name__ == "__main__":
    main()
