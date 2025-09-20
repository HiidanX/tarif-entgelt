# Tarif-Entgelt Salary Dashboard

A full-stack application for exploring and visualizing salary tables (e.g. TV-L).  
The project consists of:

- **Backend (FastAPI + SQLite)**  
  Provides an API to query salary tables and lookup values.  
  Located in: `src/api`

- **Frontend Options**
  - **Streamlit Dashboard** (`frontend/`) → quick data exploration with tables and heatmaps.
  - **Next.js App** (`frontend-next/`) → modern, styled web frontend using TailwindCSS and Nivo charts.

---

## 📂 Project Structure

# Run FastAPI backend
uvicorn src.api.main:app --reload

# Run Streamlit app
cd frontend
streamlit run app.py

# Run Next.js frontend
cd frontend-next
npm run dev

# Build Next.js frontend for production
cd frontend-next
npm run build
npm run start

# Run tests
pytest -v
