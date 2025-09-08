// pages/index.tsx

import React, { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/v1";

type SalaryCell = {
  table_name: string;
  Entgeltgruppe: string;
  Stufe: number;
  Salary: number;
  valid_from: string;
  region?: string;
};

export default function HomePage() {
  // State management...
  const [tables, setTables] = useState<string[]>([]);
  const [tableName, setTableName] = useState<string>("");
  const [cells, setCells] = useState<SalaryCell[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [lookupResult, setLookupResult] = useState<SalaryCell | null>(null);
  
  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/tables`)
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        setTables(data);
        setTableName(data[0] || "");
      })
      .catch(err => setError(String(err)));
    return () => { mounted = false; };
  }, []);
  
  useEffect(() => {
    if (!tableName) return;
    setError(null);
    fetch(`${API_BASE}/cells?table_name=${encodeURIComponent(tableName)}`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then((data: SalaryCell[]) => {
        setCells(data);
        const groups = Array.from(new Set(data.map(d => d.Entgeltgruppe))).sort();
        setSelectedGroup(groups[0] || "");
        setSelectedStep(1);
      })
      .catch(err => setError(String(err)));
  }, [tableName]);
  
  const entgeltOrder = useMemo(() => [
    "E 1","E 2","E 2Ü","E 3","E 4","E 5","E 6","E 7","E 8","E 9a","E 9b","E 9c","E 10","E 11","E 12","E 13","E 13Ü","E 14","E 15","E 15Ü"
  ], []);
  
  const pivot = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    cells.forEach(c => {
      const g = c.Entgeltgruppe.trim();
      map[g] ||= {};
      map[g][c.Stufe] = c.Salary;
    });
    return map;
  }, [cells]);
  
  const groups = useMemo(() => {
    return Object.keys(pivot).sort((a, b) => {
      const ia = entgeltOrder.indexOf(a), ib = entgeltOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return ia === -1 ? 1 : -1;
    });
  }, [pivot, entgeltOrder]);
  
  const steps = useMemo(() => {
    const allSteps = new Set<number>();
    cells.forEach(c => allSteps.add(c.Stufe));
    return Array.from(allSteps).sort((a, b) => a - b);
  }, [cells]);
  
  const doLookup = async () => {
    setLookupResult(null);
    try {
      const r = await fetch(`${API_BASE}/lookup?table_name=${encodeURIComponent(tableName)}&group=${encodeURIComponent(selectedGroup)}&step=${selectedStep}`);
      if (!r.ok) throw new Error(`Lookup failed: ${r.status}`);
      const data = await r.json();
      setLookupResult(data);
    } catch (e: any) {
      setError(e.message);
    }
  };
  
  const downloadCSV = () => {
    const rows = [["Entgeltgruppe", ...steps], ...groups.map(g => [
      g, ...steps.map(s => pivot[g]?.[s] ?? "")
    ])];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableName}_salaries.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header with branded look */}
        <header className="mb-6">
          <h1 className="text-5xl font-[cursive] font-bold text-red-500 drop-shadow-sm select-none">
            Tarif Gehalt
          </h1>
          <p className="text-gray-600 mt-1">
            Dein moderner Tarif-Gehaltsrechner – klar strukturiert und einfach zu bedienen.
          </p>
        </header>
        
        {/* Error display */}
        {error && <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded">{error}</div>}
        
        {/* Input and results card */}
        <div className="bg-white p-6 rounded-xl shadow-md grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="font-medium">Tariftabelle</label>
              <select
                className="mt-1 w-full border rounded px-3 py-2"
                value={tableName} onChange={e => setTableName(e.target.value)}
              >
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="font-medium">Entgeltgruppe</label>
              <select
                className="mt-1 w-full border rounded px-3 py-2"
                value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
              >
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="font-medium">Stufe</label>
              <select
                className="mt-1 w-full border rounded px-3 py-2"
                value={selectedStep} onChange={e => setSelectedStep(Number(e.target.value))}
              >
                {steps.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={doLookup}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >Lookup</button>
              <button
                onClick={downloadCSV}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition"
              >CSV</button>
            </div>
            
            {/* Lookup result */}
            {lookupResult && (
              <div className="mt-4 bg-green-50 border border-green-200 p-4 rounded">
                <div className="text-lg font-semibold mb-1">Gehalt:</div>
                <div>{lookupResult.Entgeltgruppe} Stufe {lookupResult.Stufe} &rarr; <strong>{lookupResult.Salary.toFixed(2)} €</strong></div>
                <div className="text-sm text-gray-500 mt-2">
                  Gültig ab {lookupResult.valid_from}
                </div>
              </div>
            )}
          </div>
          
          {/* Summary panel */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h2 className="font-semibold text-lg mb-2">Tabelle im Überblick</h2>
              <p>
                Gruppen: <strong>{groups.length}</strong> &bull; Stufen: <strong>{steps.length}</strong>
              </p>
            </div>
            
            {/* Salary table */}
            <div className="overflow-auto bg-white rounded-lg shadow-inner border">
              <table className="min-w-full">
                <thead className="bg-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Entgeltgruppe</th>
                    {steps.map(s => <th key={s} className="px-4 py-2 text-center">St {s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g} className="hover:bg-gray-100">
                      <td className="px-4 py-2">{g}</td>
                      {steps.map(s => (
                        <td key={s} className="px-4 py-2 text-center">
                          {pivot[g]?.[s] != null ? pivot[g][s].toLocaleString() + " €" : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <p className="mt-2 text-gray-500 text-sm">
              Hinweis: Werte dienen zur Orientierung. Individuelle Abweichungen möglich.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
