# frontend/app.py

import matplotlib.pyplot as plt
import pandas as pd
import requests
import seaborn as sns
import streamlit as st

# Base URL of your FastAPI backend
API_URL = "http://127.0.0.1:8000/v1"

st.set_page_config(page_title="TV-L Salary Viewer", layout="centered")
st.title("📊 TV-L Salary Viewer")

# Sidebar filters
st.sidebar.header("Lookup Salary")
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

# Lookup salary via API
if st.sidebar.button("Lookup Salary"):
    try:
        resp = requests.get(f"{API_URL}/lookup", params={"group": group, "step": step})
        resp.raise_for_status()
        data = resp.json()
        st.metric(
            label=f"{data['Entgeltgruppe']} Stufe {data['Stufe']}",
            value=f"{data['Salary']:.2f} €",
        )
        st.write(f"Valid from: {data['valid_from']}, Region: {data['region']}")
    except requests.exceptions.HTTPError:
        st.error("Salary cell not found!")

# Display full table
st.header("Full TV-L Table")
try:
    resp = requests.get(f"{API_URL}/cells")
    resp.raise_for_status()
    df = pd.DataFrame(resp.json())

    # Ensure Stufe is integer
    df["Stufe"] = df["Stufe"].astype(int)

    # Define natural order for Entgeltgruppe
    order = [
        'E 1',
        'E 2',
        'E 2Ü',
        'E 3',
        'E 4',
        'E 5',
        'E 6',
        'E 7',
        'E 8',
        'E 9a',
        'E 9b',
        'E 10',
        'E 11',
        'E 12',
        'E 13',
        'E 13Ü',
        'E 14',
        'E 15',
        'E 15Ü',
    ]

    # Pivot and reindex
    df["Salary"] = pd.to_numeric(
        df["Salary"], errors="coerce"
    )  # converts invalid strings to NaN

    df_pivot = df.pivot(index="Entgeltgruppe", columns="Stufe", values="Salary")
    df_pivot = df_pivot.reindex(order)  # reorder rows

    # Optional: sort columns (Stufen)
    df_pivot = df_pivot.sort_index(axis=1)

    st.dataframe(df_pivot.style.format("{:.2f} €"))

    # -----------------------------
    # Heatmap visualization
    # -----------------------------

    st.header("Salary Heatmap")

    # Use the same pivoted df
    plt.figure(figsize=(10, 6))
    sns.heatmap(
        df_pivot, annot=True, fmt=".0f", cmap="YlGnBu", cbar_kws={'label': 'Salary (€)'}
    )
    plt.title("TV-L Salary Heatmap")
    plt.xlabel("Stufe")
    plt.ylabel("Entgeltgruppe")
    st.pyplot(plt.gcf())
    plt.clf()


except requests.exceptions.RequestException as e:
    st.error(f"Error fetching data: {e}")
