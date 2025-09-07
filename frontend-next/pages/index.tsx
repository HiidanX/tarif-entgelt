// pages/index.tsx

import React, { useEffect, useMemo, useState } from "react";

// This is a single-file Next.js page (TypeScript/React). Drop it into
// frontend-next/pages/index.tsx inside a Next.js app created with
// `npx create-next-app@latest frontend-next --ts` and Tailwind (optional).

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/v1";

type SalaryCell = {
  table_name: string;
  Entgeltgruppe: string;
  Stufe: number;
  Salary: number;
  valid_from: string;
  region: string;
};

export default function HomePage() {
  const [tables, setTables] = useState<string[]>([]);
  const [tableName, setTableName] = useState<string>("");
  const [cells, setCells] = useState<SalaryCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // lookup state
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [lookupResult, setLookupResult] = useState<SalaryCell | null>(null);

  // fetch available tables
  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/tables`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setTables(data);
        if (data.length > 0) setTableName((t) => (t || data[0]));
      })
      .catch((err) => {
        console.error(err);
        setError(String(err));
      });
    return () => {
      mounted = false;
    };
  }, []);

  // fetch cells when tableName changes
  useEffect(() => {
    if (!tableName) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/cells?table_name=${encodeURIComponent(tableName)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then((data: SalaryCell[]) => {
        setCells(data);
        // set defaults
        const groups = Array.from(new Set(data.map((d) => d.Entgeltgruppe))).sort();
        setSelectedGroup((g) => g || (groups.length ? groups[0] : ""));
        setSelectedStep((s) => s || 1);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [tableName]);

  const entgeltOrder = useMemo(() => [
    "E 1","E 2","E 2Ü","E 3","E 4","E 5","E 6","E 7","E 8","E 9a","E 9b","E 10","E 11","E 12","E 13","E 13Ü","E 14","E 15","E 15Ü"
  ], []);

  // pivoted matrix
  const pivot = useMemo(() => {
    if (!cells || cells.length === 0) return null;
    const map: Record<string, Record<number, number>> = {};
    let min = Infinity, max = -Infinity;
    cells.forEach(c => {
      const g = (c.Entgeltgruppe || "").replace(/\u00A0/g, ' ').trim();
      if (!map[g]) map[g] = {};
      map[g][c.Stufe] = Number(c.Salary);
      if (Number(c.Salary) < min) min = Number(c.Salary);
      if (Number(c.Salary) > max) max = Number(c.Salary);
    });
    return {map, min: isFinite(min)?min:null, max: isFinite(max)?max:null};
  }, [cells]);

  const groups = useMemo(() => {
    if (!cells) return [];
    const s = Array.from(new Set(cells.map(c => (c.Entgeltgruppe||"").replace(/\u00A0/g,' ').trim())));
    // sort by entgeltOrder if present
    s.sort((a,b)=>{
      const ia = entgeltOrder.indexOf(a);
      const ib = entgeltOrder.indexOf(b);
      if (ia===-1 && ib===-1) return a.localeCompare(b);
      if (ia===-1) return 1;
      if (ib===-1) return -1;
      return ia-ib;
    });
    return s;
  }, [cells, entgeltOrder]);

  const steps = useMemo(()=>{
    if (!cells) return [1,2,3,4,5,6];
    return Array.from(new Set(cells.map(c=>c.Stufe))).sort((a,b)=>a-b);
  }, [cells]);

  async function doLookup(){
    setLookupResult(null);
    try{
      const r = await fetch(`${API_BASE}/lookup?table_name=${encodeURIComponent(tableName)}&group=${encodeURIComponent(selectedGroup)}&step=${selectedStep}`);
      if (!r.ok) throw new Error(`Lookup failed: ${r.status}`);
      const data = await r.json();
      setLookupResult(data);
    }catch(e:any){
      setError(String(e));
    }
  }

  function colorFor(value:number|null, min:number|null, max:number|null){
    if (value==null || min==null || max==null) return '#eee';
    // simple linear hue from green (low) to blue (high)
    const t = (value-min)/(max-min||1);
    const hue = 200 - Math.round(120*t); // 200..80
    return `hsl(${hue}deg 80% ${40 - Math.round(10*t)}%)`;
  }

  function downloadCSV(){
    if(!pivot) return;
    const rows = [];
    const header = ['Entgeltgruppe', ...steps];
    rows.push(header.join(','));
    for(const g of groups){
      const cellsRow = [g];
      for(const s of steps){
        const val = pivot.map[g] && pivot.map[g][s] != null ? pivot.map[g][s] : '';
        cellsRow.push(String(val));
      }
      rows.push(cellsRow.join(','));
    }
    const blob = new Blob([rows.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tableName}_salaries.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 p-6" style={{fontFamily:'Inter, system-ui'}}>
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">📊 Tarif Salary Explorer</h1>
            <p className="text-sm text-gray-600">Compare tariff tables (TV-L, TVöD, ...) — data from your FastAPI backend.</p>
          </div>
          <div>
            <label className="text-sm text-gray-600 mr-2">Table</label>
            <select value={tableName} onChange={e=>setTableName(e.target.value)} className="border rounded px-2 py-1">
              {tables.map(t=> <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </header>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm text-gray-600">Entgeltgruppe</label>
                  <select value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)} className="border rounded px-2 py-1">
                    {groups.map(g=> <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Stufe</label>
                  <select value={selectedStep} onChange={e=>setSelectedStep(Number(e.target.value))} className="border rounded px-2 py-1">
                    {steps.map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <button onClick={doLookup} className="bg-blue-600 text-white px-3 py-1 rounded">Lookup</button>
                </div>
                <div>
                  <button onClick={downloadCSV} className="bg-gray-200 px-3 py-1 rounded">Download CSV</button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Valid from</div>
                <div className="font-medium text-slate-700">{cells.length? cells[0].valid_from : '-'}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="grid grid-cols-6 gap-1 text-xs mb-2">
                {steps.map(s=> <div key={s} className="text-center">St {s}</div>)}
              </div>
              <div>
                <div className="overflow-auto border rounded">
                  <div style={{minWidth: 600}}>
                    {groups.map((g, idx)=> (
                      <div key={g} className="flex">
                        <div style={{width:160}} className="p-2 border-r bg-gray-50">{g}</div>
                        {steps.map(s=>{
                          const v = pivot && pivot.map[g] ? pivot.map[g][s] ?? null : null;
                          const bg = colorFor(v, pivot?.min ?? null, pivot?.max ?? null);
                          return (
                            <div key={s} style={{flex:1, minWidth:80}} className="p-2 border-r text-center" title={v!=null?`${v} €`:'missing'}>
                              <div style={{background:bg, color: '#0b1220', padding:'6px 4px', borderRadius:4}}>
                                {v!=null? Math.round(v).toLocaleString() : '—'}
                              </div>
                            </div>
                          )})}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {lookupResult && (
              <div className="bg-white border rounded p-3 mt-2">
                <strong>Lookup:</strong> {lookupResult.Entgeltgruppe} Stufe {lookupResult.Stufe} — {lookupResult.Salary.toFixed(2)} €
              </div>
            )}

          </div>

          <aside className="bg-white p-4 rounded shadow">
            <h3 className="font-medium mb-2">Summary</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div>Min: {pivot?.min ? Math.round(pivot.min).toLocaleString() + ' €' : '-'}</div>
              <div>Max: {pivot?.max ? Math.round(pivot.max).toLocaleString() + ' €' : '-'}</div>
              <div>Groups: {groups.length}</div>
              <div>Steps: {steps.length}</div>
            </div>
          </aside>
        </div>

        <section className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Heatmap</h2>
          <div className="overflow-auto">
            <div style={{minWidth: 700}}>
              <div style={{display:'grid', gridTemplateColumns:`160px repeat(${steps.length}, 1fr)`, gap:8}}>
                <div style={{gridColumn:'1 / -1', textAlign:'center', color:'#666'}}>Higher salaries → darker</div>
                {groups.map(g=> (
                  <React.Fragment key={g}>
                    <div style={{padding:6, background:'#f9fafb', borderRight:'1px solid #eee'}}>{g}</div>
                    {steps.map(s=>{
                      const v = pivot && pivot.map[g] ? pivot.map[g][s] ?? null : null;
                      const bg = colorFor(v, pivot?.min ?? null, pivot?.max ?? null);
                      return (
                        <div key={s} style={{padding:6, background:bg, textAlign:'center'}}>
                          {v!=null? Math.round(v).toLocaleString() : '—'}
                        </div>
                      )})}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
