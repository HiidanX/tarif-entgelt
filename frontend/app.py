# frontend/app.py

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import requests
import seaborn as sns
import streamlit as st

# Add project root/src to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent / "src"))

from utils.sorting import sort_entgeltgruppe_key

# -------------------------------
# Config
# -------------------------------
API_URL = "http://127.0.0.1:8000/v1"

st.set_page_config(
    page_title="Tarif Salary Dashboard",
    layout="wide",
    initial_sidebar_state="expanded",
)

# -------------------------------
# Title & Intro
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

st.markdown(
    """
    <h1 style='text-align: center; color: #0E76A8;'>📊 Tarif Salary Dashboard</h1>
    <p style='text-align: center;'>Compare salaries across Entgeltgruppen and Stufen</p>
    """,
    unsafe_allow_html=True,
)

# -------------------------------
# Sidebar: Table & Salary Lookup
# -------------------------------
st.sidebar.header("🔧 Select Table & Lookup Salary")

# Fetch available tables dynamically
try:
    tables_resp = requests.get(f"{API_URL}/tables")
    tables_resp.raise_for_status()
    available_tables = tables_resp.json()
except requests.exceptions.RequestException:
    available_tables = ["TV-L"]  # fallback

table_name = st.sidebar.selectbox("Tarif Table", options=available_tables)

# Fetch available groups and steps dynamically for the selected table
try:
    groups_resp = requests.get(f"{API_URL}/groups", params={"table_name": table_name})
    groups_resp.raise_for_status()
    available_groups = groups_resp.json()
except requests.exceptions.RequestException:
    available_groups = []

group = st.sidebar.selectbox("Entgeltgruppe", options=available_groups)

try:
    steps_resp = requests.get(
        f"{API_URL}/steps", params={"table_name": table_name, "group": group}
    )
    steps_resp.raise_for_status()
    available_steps = steps_resp.json()
except requests.exceptions.RequestException:
    available_steps = []

step = st.sidebar.selectbox("Stufe", options=available_steps)

# Weekly working hours (before salary lookup)
st.sidebar.markdown("---")
weekly_hours = st.sidebar.slider(
    "Weekly Hours", min_value=8, max_value=50, value=40, step=1
)

# Weihnachtsgeld and Sonderzahlung
weihnachtsgeld_pct = st.sidebar.slider(
    "Weihnachtsgeld (% of monthly)", min_value=0, max_value=100, value=0, step=5
)
sonderzahlung = st.sidebar.number_input(
    "Sonderzahlung (€)", min_value=0, value=0, step=100
)

# Lookup Salary
if st.sidebar.button("Lookup Salary"):
    try:
        resp = requests.get(
            f"{API_URL}/lookup",
            params={"table_name": table_name, "group": group, "step": step},
        )
        resp.raise_for_status()
        data = resp.json()

        base_monthly_salary = data["Salary"]

        # Adjust for working hours
        monthly_salary = base_monthly_salary * (weekly_hours / 40)

        # Add Weihnachtsgeld (once per year, % of monthly)
        yearly_salary = monthly_salary * 12
        yearly_salary += monthly_salary * (weihnachtsgeld_pct / 100)

        # Add Sonderzahlung (flat amount)
        yearly_salary += sonderzahlung

        # Recompute monthly including extras (for display only)
        effective_monthly = yearly_salary / 12

        # Hourly salary based on yearly & weekly hours
        yearly_hours = weekly_hours * 52
        hourly_salary = yearly_salary / yearly_hours

        # Show main salary metric
        st.sidebar.metric(
            label=f"{data['Entgeltgruppe']} Stufe {data['Stufe']}",
            value=f"{effective_monthly:,.2f} € / month",
        )
        st.sidebar.caption(f"Valid from: {data['valid_from']} ({data['region']})")

        # Separator
        st.sidebar.markdown("---")

        # Additional salary breakdowns
        st.sidebar.metric("📅 Yearly Salary", f"{yearly_salary:,.2f} €")
        st.sidebar.metric("⏱ Hourly Salary", f"{hourly_salary:,.2f} €")

    except requests.exceptions.HTTPError:
        st.sidebar.error("Salary cell not found!")

# -------------------------------
# Fetch Table Data
# -------------------------------
try:
    resp = requests.get(f"{API_URL}/cells", params={"table_name": table_name})
    resp.raise_for_status()
    df = pd.DataFrame(resp.json())
    df["Stufe"] = df["Stufe"].astype(int)
    df["Entgeltgruppe"] = df["Entgeltgruppe"].str.replace("\xa0", " ").str.strip()

    # Pivot and reindex
    df_pivot = df.groupby(["Entgeltgruppe", "Stufe"])["Salary"].first().unstack()
    # Sort rows with custom key
    df_pivot = df_pivot.reindex(sorted(df_pivot.index, key=sort_entgeltgruppe_key))

    # Sort columns numerically (Stufen)
    df_pivot = df_pivot[sorted(df_pivot.columns)]
    df_pivot = df_pivot.dropna(how="all")

    # -------------------------------
    # KPI Metrics
    # -------------------------------
    col1, col2, col3 = st.columns(3)
    col1.metric("💶 Lowest Salary", f"{df['Salary'].min():.0f} €")
    col2.metric("💶 Highest Salary", f"{df['Salary'].max():.0f} €")
    col3.metric("📊 Median Salary", f"{df['Salary'].median():.0f} €")

    # -------------------------------
    # Tabs: Table & Heatmap
    # -------------------------------
    tab1, tab2 = st.tabs(["📋 Table", "🔥 Heatmap"])

    with tab1:
        st.subheader(f"Full {table_name} Table")
        st.dataframe(df_pivot.style.format("{:.2f} €"))

        st.download_button(
            "📥 Download Table (CSV)",
            df_pivot.to_csv().encode("utf-8"),
            f"{table_name}_salaries.csv",
            "text/csv",
        )

    with tab2:
        st.subheader(f"{table_name} Salary Heatmap")
        plt.figure(figsize=(12, 8))
        sns.heatmap(
            df_pivot,
            annot=True,
            fmt=".0f",
            cmap="YlGnBu",
            cbar_kws={"label": "Salary (€)"},
            linewidths=0.5,
            linecolor="gray",
        )
        plt.title(f"{table_name} Salary Heatmap")
        plt.xlabel("Stufe")
        plt.ylabel("Entgeltgruppe")
        st.pyplot(plt.gcf())
        plt.clf()

except requests.exceptions.RequestException as e:
    st.error(f"Error fetching data: {e}")
