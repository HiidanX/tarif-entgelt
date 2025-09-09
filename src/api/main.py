# src/api/main.py

import re
import sqlite3
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from src.utils.sorting import sort_entgeltgruppe_key

# -------------------------------
# Config: database
# -------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # Project root
DB_PATH = BASE_DIR / "data" / "salaries.db"

# Ensure data folder exists
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# -------------------------------
# FastAPI app
# -------------------------------
app = FastAPI(title="Tarif Salary API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------
# Models
# -------------------------------
class SalaryCell(BaseModel):
    table_name: str
    Entgeltgruppe: str
    Stufe: int
    Salary: float
    valid_from: str
    region: str


# -------------------------------
# Helper functions
# -------------------------------
def check_salaries_table():
    """Raise HTTPException if the salaries table is missing"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='salaries';"
    )
    if cur.fetchone() is None:
        conn.close()
        raise HTTPException(
            status_code=500, detail="Database table 'salaries' not found"
        )
    conn.close()


def query_salaries(table_name: str):
    """Return all rows for a table_name"""
    check_salaries_table()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        "SELECT table_name, Entgeltgruppe, Stufe, Salary, valid_from, region "
        "FROM salaries WHERE table_name=?",
        (table_name,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# -------------------------------
# Root
# -------------------------------
@app.get("/")
def root():
    """Redirect root to docs"""
    return RedirectResponse(url="/docs")


# -------------------------------
# Endpoints
# -------------------------------


@app.get("/v1/tables", response_model=List[str])
def get_tables():
    """Return a list of all available table names"""
    check_salaries_table()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT table_name FROM salaries")
    rows = cur.fetchall()
    conn.close()
    return [row["table_name"] for row in rows]


@app.get("/v1/cells", response_model=List[SalaryCell])
def get_cells(
    table_name: str = Query(..., description="Tarif table, e.g., TV-L, TVöD")
):
    data = query_salaries(table_name)
    if not data:
        raise HTTPException(status_code=404, detail=f"No data for table '{table_name}'")
    return data


@app.get("/v1/lookup", response_model=SalaryCell)
def lookup_salary(
    table_name: str = Query(..., description="Tarif table, e.g., TV-L, TVöD"),
    group: str = Query(..., description="Entgeltgruppe, e.g., E5"),
    step: int = Query(..., description="Stufe, e.g., 3"),
):
    check_salaries_table()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        "SELECT table_name, Entgeltgruppe, Stufe, Salary, valid_from, region "
        "FROM salaries WHERE table_name=? AND Entgeltgruppe=? AND Stufe=?",
        (table_name, group, step),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Salary cell not found")
    return dict(row)


@app.get("/v1/groups", response_model=List[str])
def get_groups(
    table_name: str = Query(..., description="Tarif table, e.g., TV-L, TVöD")
):
    """Return all distinct Entgeltgruppen for a given table, sorted naturally."""
    check_salaries_table()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT Entgeltgruppe
        FROM salaries
        WHERE table_name=?
        """,
        (table_name,),
    )
    groups = [row[0] for row in cur.fetchall()]
    conn.close()

    if not groups:
        raise HTTPException(
            status_code=404, detail=f"No groups found for table '{table_name}'"
        )

    # Sort with custom function
    groups_sorted = sorted(groups, key=sort_entgeltgruppe_key)
    return groups_sorted


@app.get("/v1/steps", response_model=List[int])
def get_steps(
    table_name: str = Query(..., description="Tarif table, e.g., TV-L, TVöD"),
    group: str = Query(..., description="Entgeltgruppe, e.g., E5"),
):
    """Return all available Stufen for a given table & Entgeltgruppe."""
    check_salaries_table()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT Stufe
        FROM salaries
        WHERE table_name=? AND Entgeltgruppe=?
        ORDER BY Stufe
        """,
        (table_name, group),
    )
    steps = [row[0] for row in cur.fetchall()]
    conn.close()
    if not steps:
        raise HTTPException(
            status_code=404,
            detail=f"No steps found for table '{table_name}', group '{group}'",
        )
    return steps
