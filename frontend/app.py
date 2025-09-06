# frontend/app.py

import matplotlib.pyplot as plt
import pandas as pd
import requests
import seaborn as sns
import streamlit as st

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

# Entgeltgruppe and Stufe for lookup
entgelt_order = [
    "E 1",
    "E 2",
    "E 2Ü",
    "E 3",
    "E 4",
    "E 5",
    "E 6",
    "E 7",
    "E 8",
    "E 9a",
    "E 9b",
    "E 10",
    "E 11",
    "E 12",
    "E 13",
    "E 13Ü",
    "E 14",
    "E 15",
    "E 15Ü",
]

group = st.sidebar.selectbox("Entgeltgruppe", options=entgelt_order)
step = st.sidebar.selectbox("Stufe", options=[1, 2, 3, 4, 5, 6])

# Lookup Salary
if st.sidebar.button("Lookup Salary"):
    try:
        resp = requests.get(
            f"{API_URL}/lookup",
            params={"table_name": table_name, "group": group, "step": step},
        )
        resp.raise_for_status()
        data = resp.json()
        st.sidebar.metric(
            label=f"{data['Entgeltgruppe']} Stufe {data['Stufe']}",
            value=f"{data['Salary']:.2f} €",
        )
        st.sidebar.caption(f"Valid from: {data['valid_from']} ({data['region']})")
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
    df_pivot = df_pivot.reindex(entgelt_order)
    df_pivot = df_pivot.sort_index(axis=1)

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
