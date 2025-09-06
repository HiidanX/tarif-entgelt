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
    page_title="TV-L Salary Dashboard",
    layout="wide",
    initial_sidebar_state="expanded",
)

# -------------------------------
# Title & Intro
# -------------------------------
st.markdown(
    """
    <h1 style='text-align: center; color: #0E76A8;'>📊 TV-L Salary Dashboard</h1>
    <p style='text-align: center;'>Compare salaries across Entgeltgruppen and Stufen</p>
    """,
    unsafe_allow_html=True,
)

# -------------------------------
# Sidebar: Salary Lookup
# -------------------------------
st.sidebar.header("🔎 Lookup Salary")
group = st.sidebar.selectbox(
    "Entgeltgruppe",
    options=[
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
    ],
)
step = st.sidebar.selectbox("Stufe", options=[1, 2, 3, 4, 5, 6])

if st.sidebar.button("Lookup Salary"):
    try:
        resp = requests.get(f"{API_URL}/lookup", params={"group": group, "step": step})
        resp.raise_for_status()
        data = resp.json()
        st.sidebar.metric(
            label=f"{data['Entgeltgruppe']} Stufe {data['Stufe']}",
            value=f"{data['Salary']:.2f} €",
        )
        #st.sidebar.caption(f"Valid from: {data['valid_from']} ({data['region']})")
    except requests.exceptions.HTTPError:
        st.sidebar.error("Salary cell not found!")

# -------------------------------
# Fetch Data
# -------------------------------
try:
    resp = requests.get(f"{API_URL}/cells")
    resp.raise_for_status()
    df = pd.DataFrame(resp.json())
    df["Stufe"] = df["Stufe"].astype(int)
    df["Entgeltgruppe"] = df["Entgeltgruppe"].str.replace("\xa0", " ").str.strip()

    # Reorder Entgeltgruppen
    order = [
    "E 1", "E 2", "E 2Ü", "E 3", "E 4", "E 5", "E 6",
    "E 7", "E 8", "E 9a", "E 9b", "E 10", "E 11",
    "E 12", "E 13", "E 13Ü", "E 14", "E 15", "E 15Ü"
    ]

    df_pivot = df.pivot(index="Entgeltgruppe", columns="Stufe", values="Salary")
    df_pivot = df_pivot.reindex(order)  # reindex rows
    df_pivot = df_pivot.sort_index(axis=1)  # sort Stufen columns


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
        st.subheader("Full TV-L Table")
        st.dataframe(df_pivot.style.format("{:.2f} €"))

        st.download_button(
            "📥 Download Table (CSV)",
            df_pivot.to_csv().encode("utf-8"),
            "tvl_salaries.csv",
            "text/csv",
        )

    with tab2:
        st.subheader("Salary Heatmap")

        plt.figure(figsize=(12, 8))
        sns.heatmap(
            df_pivot,
            annot=True,  # only shows actual numbers
            fmt=".0f",
            cmap="YlGnBu",
            cbar_kws={"label": "Salary (€)"},
        )
        plt.title("TV-L Salary Heatmap")
        plt.xlabel("Stufe")
        plt.ylabel("Entgeltgruppe")
        st.pyplot(plt.gcf())
        plt.clf()


except requests.exceptions.RequestException as e:
    st.error(f"Error fetching data: {e}")
