# frontend/app.py

import sys
from pathlib import Path

# -------------------------------
# Add src to path for utils import
# -------------------------------
sys.path.append(str(Path(__file__).resolve().parent.parent / "src"))

import matplotlib.pyplot as plt
import pandas as pd
import requests
import seaborn as sns
import streamlit as st

from utils.sorting import sort_entgeltgruppe_key

# -------------------------------
# Konfiguration
# -------------------------------
API_URL = "http://127.0.0.1:8000/v1"

st.set_page_config(
    page_title="Tarif Gehalt Dashboard",
    layout="wide",
    initial_sidebar_state="expanded",
)

# -------------------------------
# Sidebar Logo
# -------------------------------
st.sidebar.markdown(
    """
    <h1 style="
        text-align: left;
        font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
        font-weight: 800;
        font-size: 32px;
        color: #e63946;
        text-shadow: 1px 1px 4px rgba(0,0,0,0.4);
        letter-spacing: 1px;
        margin-bottom: 10px;
    ">
        Tarif Gehalt
    </h1>
    """,
    unsafe_allow_html=True,
)

# -------------------------------
# Session State für Seiten-Navigation
# -------------------------------
if "page" not in st.session_state:
    st.session_state.page = "übersicht"

# -------------------------------
# Obere Navigationsleiste (rechtsbündig)
# -------------------------------
nav_items = ["Überblick", "Tarifrunden", "Tariftabellen", "Blog"]
nav_keys = ["übersicht", "tarifrunden", "tariftabellen", "blog"]

cols = st.columns([6] + [1] * len(nav_items))  # Spacer links + Buttons rechts

for i, (label, key) in enumerate(zip(nav_items, nav_keys)):
    with cols[i + 1]:
        if st.button(label, key=key):
            st.session_state.page = key

st.markdown(
    """
    <style>
    div.stButton > button {
        border: none;
        background: none;
        color: #0E76A8;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        margin: 0;
        width: 100%;
        white-space: nowrap;
    }
    div.stButton > button:hover {
        text-decoration: underline;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# -------------------------------
# Seiteninhalte
# -------------------------------
if st.session_state.page == "übersicht":
    st.markdown(
        "<h1 style='text-align: center; color: #0E76A8;'>📊 Tarif Gehalt Dashboard</h1>",
        unsafe_allow_html=True,
    )
    st.markdown(
        "<p style='text-align: center;'>Vergleich der Gehälter nach Entgeltgruppen und Stufen</p>",
        unsafe_allow_html=True,
    )

    # -------------------------------
    # Sidebar: Tabelle & Gehaltsabfrage
    # -------------------------------
    st.sidebar.header("🔧 Tabelle auswählen & Gehalt prüfen")

    # Verfügbare Tabellen abrufen
    try:
        tables_resp = requests.get(f"{API_URL}/tables")
        tables_resp.raise_for_status()
        available_tables = tables_resp.json()
    except requests.exceptions.RequestException:
        available_tables = ["TV-L"]

    table_name = st.sidebar.selectbox("Tariftabelle", options=available_tables)

    # Entgeltgruppen dynamisch abrufen
    try:
        groups_resp = requests.get(
            f"{API_URL}/groups", params={"table_name": table_name}
        )
        groups_resp.raise_for_status()
        available_groups = groups_resp.json()
        available_groups = sorted(available_groups, key=sort_entgeltgruppe_key)
    except requests.exceptions.RequestException:
        available_groups = []

    group = st.sidebar.selectbox("Entgeltgruppe", options=available_groups)

    # Stufen dynamisch abrufen
    try:
        steps_resp = requests.get(
            f"{API_URL}/steps", params={"table_name": table_name, "group": group}
        )
        steps_resp.raise_for_status()
        available_steps = steps_resp.json()
    except requests.exceptions.RequestException:
        available_steps = []

    step = st.sidebar.selectbox("Stufe", options=available_steps)

    # Wöchentliche Arbeitsstunden
    st.sidebar.markdown("---")
    weekly_hours = st.sidebar.slider(
        "Wöchentliche Arbeitsstunden", min_value=8, max_value=50, value=40, step=1
    )

    # Weihnachtsgeld & Sonderzahlung
    weihnachtsgeld_pct = st.sidebar.slider(
        "Weihnachtsgeld (% vom Monatsgehalt)",
        min_value=0,
        max_value=100,
        value=0,
        step=5,
    )
    sonderzahlung = st.sidebar.number_input(
        "Sonderzahlung (€)", min_value=0, value=0, step=100
    )

    # Gehaltsabfrage
    if st.sidebar.button("Gehalt abrufen"):
        try:
            resp = requests.get(
                f"{API_URL}/lookup",
                params={"table_name": table_name, "group": group, "step": step},
            )
            resp.raise_for_status()
            data = resp.json()

            base_monthly_salary = data["Salary"]
            monthly_salary = base_monthly_salary * (weekly_hours / 40)
            yearly_salary = (
                monthly_salary * 12
                + monthly_salary * (weihnachtsgeld_pct / 100)
                + sonderzahlung
            )
            hourly_salary = yearly_salary / (weekly_hours * 52)
            effective_monthly = yearly_salary / 12

            st.sidebar.metric(
                label=f"{data['Entgeltgruppe']} Stufe {data['Stufe']}",
                value=f"{effective_monthly:,.2f} € / Monat",
            )
            st.sidebar.caption(f"Gültig ab: {data['valid_from']} ({data['region']})")

            st.sidebar.markdown("---")
            st.sidebar.metric("📅 Jahresgehalt", f"{yearly_salary:,.2f} €")
            st.sidebar.metric("⏱ Stundenlohn", f"{hourly_salary:,.2f} €")

        except requests.exceptions.HTTPError:
            st.sidebar.error("Gehaltszelle nicht gefunden!")

    # -------------------------------
    # Tabellen-Daten abrufen
    # -------------------------------
    try:
        resp = requests.get(f"{API_URL}/cells", params={"table_name": table_name})
        resp.raise_for_status()
        df = pd.DataFrame(resp.json())
        df["Stufe"] = df["Stufe"].astype(int)
        df["Entgeltgruppe"] = df["Entgeltgruppe"].str.replace("\xa0", " ").str.strip()

        # Pivot-Tabelle
        df_pivot = df.groupby(["Entgeltgruppe", "Stufe"])["Salary"].first().unstack()
        df_pivot = df_pivot.reindex(sorted(df_pivot.index, key=sort_entgeltgruppe_key))
        df_pivot = df_pivot[sorted(df_pivot.columns)]

        # -------------------------------
        # KPI-Metriken
        # -------------------------------
        col1, col2, col3 = st.columns(3)
        col1.metric("💶 Niedrigstes Gehalt", f"{df['Salary'].min():.0f} €")
        col2.metric("💶 Höchstes Gehalt", f"{df['Salary'].max():.0f} €")
        col3.metric("📊 Median-Gehalt", f"{df['Salary'].median():.0f} €")

        # -------------------------------
        # Tabs: Tabelle & Heatmap
        # -------------------------------
        tab1, tab2 = st.tabs(["📋 Tabelle", "🔥 Heatmap"])

        with tab1:
            st.subheader(f"Vollständige {table_name}-Tabelle")
            st.dataframe(df_pivot.style.format("{:.2f} €"))

            st.download_button(
                "📥 Tabelle herunterladen (CSV)",
                df_pivot.to_csv().encode("utf-8"),
                f"{table_name}_gehaelter.csv",
                "text/csv",
            )

        with tab2:
            st.subheader(f"{table_name} Gehalts-Heatmap")
            plt.figure(figsize=(12, 8))
            sns.heatmap(
                df_pivot,
                annot=True,
                fmt=".0f",
                cmap="YlGnBu",
                cbar_kws={"label": "Gehalt (€)"},
                linewidths=0.5,
                linecolor="gray",
            )
            plt.title(f"{table_name} Gehalts-Heatmap")
            plt.xlabel("Stufe")
            plt.ylabel("Entgeltgruppe")
            st.pyplot(plt.gcf())
            plt.clf()

    except requests.exceptions.RequestException as e:
        st.error(f"Fehler beim Abrufen der Daten: {e}")

# -------------------------------
# Andere Seiten
# -------------------------------
elif st.session_state.page == "tarifrunden":
    st.header("Tarifrunden")
    st.write("Platzhalterinhalt für die Seite 'Tarifrunden'")

elif st.session_state.page == "tariftabellen":
    st.header("Tariftabellen")
    st.write("Platzhalterinhalt für die Seite 'Tariftabellen'")

elif st.session_state.page == "blog":
    st.header("Blog")
    st.write("Platzhalterinhalt für die Seite 'Blog'")
