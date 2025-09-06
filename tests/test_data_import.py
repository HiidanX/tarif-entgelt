import sqlite3
from pathlib import Path

import pandas as pd
import pytest

from src.data_import import clean_entgeltgruppe, import_csv

# Use a temporary SQLite DB for testing
TEST_DB_PATH = Path("tests/test_salaries.db")


@pytest.fixture
def reset_db():
    # Ensure the test DB is clean
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    yield
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


def test_clean_entgeltgruppe():
    assert clean_entgeltgruppe("E\xa015") == "E 15"
    assert clean_entgeltgruppe("  E 2Ü ") == "E 2Ü"
    assert clean_entgeltgruppe(None) is None


def test_import_csv(reset_db):
    # Create a minimal CSV for testing
    csv_content = """Entgeltgruppe;1;2
E 1;2000;2100
E 2;2500;2600
"""
    test_csv_path = Path("tests/test_tvl.csv")
    test_csv_path.write_text(csv_content)

    # Run import_csv with test DB
    import_csv(
        csv_path=test_csv_path,
        table_name="TV-L",
        valid_from="2025-02-01",
        region="ALL",
    )

    # Connect to SQLite and verify
    conn = sqlite3.connect(
        "data/salaries.db"
    )  # Change to TEST_DB_PATH if you modify import_csv to accept db_path
    df = pd.read_sql("SELECT * FROM salaries WHERE table_name='TV-L'", conn)
    conn.close()

    # Check some values
    expected_values = {
        ("E 1", 1): 2000,
        ("E 1", 2): 2434.49,
        ("E 2", 1): 2642.84,
        ("E 2", 2): 2853.24,
    }

    for (group, stufe), salary in expected_values.items():
        row = df[(df["Entgeltgruppe"] == group) & (df["Stufe"] == stufe)].iloc[0]
        assert row["Salary"] == salary

    # Clean up CSV
    test_csv_path.unlink()
