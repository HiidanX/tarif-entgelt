import sqlite3
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "data" / "salaries.db"

app = FastAPI(title="TV-L Salary API", version="1.0")


# -----------------------------
# Pydantic models
# -----------------------------
class PayCell(BaseModel):
    Entgeltgruppe: str
    Stufe: int
    Salary: float
    valid_from: str
    region: str


# -----------------------------
# Helper to query DB
# -----------------------------
def get_db_connection():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


# -----------------------------
# Endpoints
# -----------------------------
@app.get("/v1/cells", response_model=List[PayCell])
def list_cells(group: Optional[str] = None, step: Optional[int] = None):
    """
    Return all cells or filtered by Entgeltgruppe and/or Stufe
    """
    con = get_db_connection()
    cur = con.cursor()
    query = "SELECT * FROM tvl_salaries WHERE 1=1"
    params = []
    if group:
        query += " AND Entgeltgruppe = ?"
        params.append(group)
    if step:
        query += " AND Stufe = ?"
        params.append(step)
    query += " ORDER BY Entgeltgruppe, Stufe"

    rows = cur.execute(query, params).fetchall()
    con.close()

    if not rows:
        raise HTTPException(status_code=404, detail="No matching cells found")

    return [PayCell(**dict(r)) for r in rows]


@app.get("/v1/lookup", response_model=PayCell)
def lookup(
    group: str = Query(..., description="Entgeltgruppe"),
    step: int = Query(..., ge=1, le=6, description="Stufe"),
):
    """
    Lookup a single salary cell
    """
    con = get_db_connection()
    cur = con.cursor()
    query = """
        SELECT * FROM tvl_salaries
        WHERE Entgeltgruppe = ? AND Stufe = ?
        LIMIT 1
    """
    row = cur.execute(query, (group, step)).fetchone()
    con.close()

    if not row:
        raise HTTPException(status_code=404, detail="Cell not found")

    return PayCell(**dict(row))
