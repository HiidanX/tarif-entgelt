import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

// Types
interface SalaryData {
  Entgeltgruppe: string;
  Stufe: number;
  Salary: number;
  valid_from: string;
  region: string;
}

interface LookupResult {
  Entgeltgruppe: string;
  Stufe: number;
  Salary: number;
  valid_from: string;
  region: string;
}

interface PivotData {
  [key: string]: { [step: number]: number };
}

interface ChartDataItem {
  group: string;
  step: number;
  salary: number;
  label: string;
}

// Mock data for demonstration
const mockSalaryData: SalaryData[] = [
  { Entgeltgruppe: 'E 1', Stufe: 1, Salary: 2230, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 1', Stufe: 2, Salary: 2340, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 1', Stufe: 3, Salary: 2450, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 2', Stufe: 1, Salary: 2450, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 2', Stufe: 2, Salary: 2560, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 2', Stufe: 3, Salary: 2670, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 3', Stufe: 1, Salary: 2670, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 3', Stufe: 2, Salary: 2780, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 3', Stufe: 3, Salary: 2890, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 4', Stufe: 1, Salary: 2890, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 4', Stufe: 2, Salary: 3000, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 4', Stufe: 3, Salary: 3110, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 5', Stufe: 1, Salary: 3200, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 5', Stufe: 2, Salary: 3350, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 5', Stufe: 3, Salary: 3500, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 6', Stufe: 1, Salary: 3600, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 6', Stufe: 2, Salary: 3800, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 6', Stufe: 3, Salary: 4000, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 7', Stufe: 1, Salary: 4200, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 7', Stufe: 2, Salary: 4450, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 7', Stufe: 3, Salary: 4700, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 8', Stufe: 1, Salary: 4800, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 8', Stufe: 2, Salary: 5100, valid_from: '2024-01-01', region: 'Bund' },
  { Entgeltgruppe: 'E 8', Stufe: 3, Salary: 5400, valid_from: '2024-01-01', region: 'Bund' },
];

const TarifDashboard = () => {
  // State management
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [availableTables, setAvailableTables] = useState<string[]>(['TV-L']);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [availableSteps, setAvailableSteps] = useState<number[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('TV-L');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [weeklyHours, setWeeklyHours] = useState<number>(40);
  const [weihnachtsgeldPct, setWeihnachtsgeldPct] = useState<number>(0);
  const [sonderzahlung, setSonderzahlung] = useState<number>(0);
  const [salaryData, setSalaryData] = useState<SalaryData[]>([]);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('table');

  const API_URL = 'http://127.0.0.1:8000/v1';

  // Sorting function for Entgeltgruppen
  const sortEntgeltgruppe = (a: string, b: string): number => {
    const getNumeric = (str: string) => {
      const match = str.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    };
    return getNumeric(a) - getNumeric(b);
  };

  // Mock fetch functions with fallback to real API
  const fetchTables = async () => {
    try {
      const response = await fetch(`${API_URL}/tables`);
      if (response.ok) {
        const tables = await response.json();
        setAvailableTables(tables);
      } else {
        throw new Error('API not available');
      }
    } catch (error) {
      console.log('Using mock data - API not available');
      setAvailableTables(['TV-L', 'TV-Ö', 'TVAöD']);
    }
  };

  const fetchGroups = useCallback(async (tableName: string) => {
    try {
      const response = await fetch(`${API_URL}/groups?table_name=${tableName}`);
      if (response.ok) {
        const groups = await response.json();
        const sortedGroups = groups.sort(sortEntgeltgruppe);
        setAvailableGroups(sortedGroups);
        if (sortedGroups.length > 0) {
          setSelectedGroup(sortedGroups[0]);
        }
      } else {
        throw new Error('API not available');
      }
    } catch (error) {
      console.log('Using mock data for groups - API not available');
      // Extract unique groups from mock data
      const groups = Array.from(new Set(mockSalaryData.map(d => d.Entgeltgruppe))).sort(sortEntgeltgruppe);
      setAvailableGroups(groups);
      if (groups.length > 0) {
        setSelectedGroup(groups[0]);
      }
    }
  }, []);

  const fetchSteps = useCallback(async (tableName: string, group: string) => {
    try {
      const response = await fetch(`${API_URL}/steps?table_name=${tableName}&group=${group}`);
      if (response.ok) {
        const steps = await response.json();
        setAvailableSteps(steps.sort((a: number, b: number) => a - b));
        if (steps.length > 0) {
          setSelectedStep(steps[0]);
        }
      } else {
        throw new Error('API not available');
      }
    } catch (error) {
      console.log('Using mock data for steps - API not available');
      // Extract steps for the selected group from mock data
      const steps = Array.from(new Set(
        mockSalaryData
          .filter(d => d.Entgeltgruppe === group)
          .map(d => d.Stufe)
      )).sort((a, b) => a - b);
      setAvailableSteps(steps);
      if (steps.length > 0) {
        setSelectedStep(steps[0]);
      }
    }
  }, []);

  const fetchSalaryData = useCallback(async (tableName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/cells?table_name=${tableName}`);
      if (response.ok) {
        const data = await response.json();
        setSalaryData(data);
        setError('');
      } else {
        throw new Error('API not available');
      }
    } catch (error) {
      console.log('Using mock salary data - API not available');
      setSalaryData(mockSalaryData);
      setError('');
    }
    setLoading(false);
  }, []);

  const lookupSalary = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/lookup?table_name=${selectedTable}&group=${selectedGroup}&step=${selectedStep}`
      );
      if (response.ok) {
        const data = await response.json();
        setLookupResult(data);
        setError('');
      } else {
        throw new Error('API not available');
      }
    } catch (error) {
      console.log('Using mock lookup data - API not available');
      // Find the salary in mock data
      const result = mockSalaryData.find(
        d => d.Entgeltgruppe === selectedGroup && d.Stufe === selectedStep
      );
      if (result) {
        setLookupResult(result);
        setError('');
      } else {
        setError('Gehaltszelle nicht gefunden!');
        setLookupResult(null);
      }
    }
    setLoading(false);
  };

  const calculateSalaryMetrics = () => {
    if (!lookupResult) return null;
    
    const baseMonthlySalary = lookupResult.Salary;
    const monthlySalary = baseMonthlySalary * (weeklyHours / 40);
    const yearlySalary = monthlySalary * 12 + monthlySalary * (weihnachtsgeldPct / 100) + sonderzahlung;
    const hourlySalary = yearlySalary / (weeklyHours * 52);
    const effectiveMonthly = yearlySalary / 12;

    return {
      monthly: monthlySalary,
      yearly: yearlySalary,
      hourly: hourlySalary,
      effective: effectiveMonthly
    };
  };

  const createPivotData = (): PivotData => {
    const pivot: PivotData = {};
    salaryData.forEach(item => {
      const group = item.Entgeltgruppe.replace(/\xa0/g, ' ').trim();
      if (!pivot[group]) {
        pivot[group] = {};
      }
      pivot[group][item.Stufe] = item.Salary;
    });
    return pivot;
  };

  const getStatistics = () => {
    if (salaryData.length === 0) return { min: 0, max: 0, median: 0 };
    
    const salaries = salaryData.map(d => d.Salary).sort((a, b) => a - b);
    const min = salaries[0];
    const max = salaries[salaries.length - 1];
    const median = salaries[Math.floor(salaries.length / 2)];
    
    return { min, max, median };
  };

  const createChartData = (): ChartDataItem[] => {
    const pivot = createPivotData();
    const chartData: ChartDataItem[] = [];
    
    Object.keys(pivot).sort(sortEntgeltgruppe).forEach(group => {
      const steps = Object.keys(pivot[group]).sort((a, b) => parseInt(a) - parseInt(b));
      steps.forEach(step => {
        chartData.push({
          group,
          step: parseInt(step),
          salary: pivot[group][parseInt(step)],
          label: `${group}.${step}`
        });
      });
    });
    
    return chartData.slice(0, 15);
  };

  // Effects
  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchGroups(selectedTable);
      fetchSalaryData(selectedTable);
    }
  }, [selectedTable, fetchGroups, fetchSalaryData]);

  useEffect(() => {
    if (selectedTable && selectedGroup) {
      fetchSteps(selectedTable, selectedGroup);
    }
  }, [selectedTable, selectedGroup, fetchSteps]);

  const salaryMetrics = calculateSalaryMetrics();
  const statistics = getStatistics();
  const chartData = createChartData();
  const pivotData = createPivotData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TG</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Tarif Gehalt</h1>
            </div>
            
            <nav className="flex space-x-1">
              {[
                { label: 'Dashboard', key: 'dashboard', icon: '📊' },
                { label: 'Tarifrunden', key: 'tarifrunden', icon: '💼' },
                { label: 'Tabellen', key: 'tariftabellen', icon: '📋' },
                { label: 'Blog', key: 'blog', icon: '✍️' }
              ].map(({ label, key, icon }) => (
                <button
                  key={key}
                  onClick={() => setCurrentPage(key)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    currentPage === key
                      ? 'bg-blue-100 text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2">{icon}</span>
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'dashboard' && (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Gehälter-Dashboard
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Analysieren Sie Gehälter nach Entgeltgruppen und Stufen. Berechnen Sie Ihr individuelles Gehalt mit personalisierten Parametern.
              </p>
            </div>

            {/* Controls Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Gehaltsrechner</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tariftabelle
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
                  >
                    {availableTables.map(table => (
                      <option key={table} value={table}>{table}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entgeltgruppe
                  </label>
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
                  >
                    {availableGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stufe
                  </label>
                  <select
                    value={selectedStep}
                    onChange={(e) => setSelectedStep(parseInt(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
                  >
                    {availableSteps.map(step => (
                      <option key={step} value={step}>{step}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wochenstunden: {weeklyHours}h
                  </label>
                  <div className="relative">
                    <input
                      type="range"
                      min="20"
                      max="50"
                      value={weeklyHours}
                      onChange={(e) => setWeeklyHours(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((weeklyHours - 20) / (50 - 20)) * 100}%, #E5E7EB ${((weeklyHours - 20) / (50 - 20)) * 100}%, #E5E7EB 100%)`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>20h</span>
                    <span>50h</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weihnachtsgeld: {weihnachtsgeldPct}%
                  </label>
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={weihnachtsgeldPct}
                      onChange={(e) => setWeihnachtsgeldPct(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${weihnachtsgeldPct}%, #E5E7EB ${weihnachtsgeldPct}%, #E5E7EB 100%)`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sonderzahlung (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={sonderzahlung}
                    onChange={(e) => setSonderzahlung(parseInt(e.target.value) || 0)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={lookupSalary}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Berechne...</span>
                    </div>
                  ) : (
                    '💰 Gehalt berechnen'
                  )}
                </button>
              </div>
              
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">❌ {error}</p>
                </div>
              )}
            </div>

            {/* Results Section */}
            {lookupResult && salaryMetrics && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-sm border border-green-200 p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {lookupResult.Entgeltgruppe} Stufe {lookupResult.Stufe}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Gültig ab {lookupResult.valid_from} • {lookupResult.region}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {salaryMetrics.effective.toLocaleString('de-DE', {minimumFractionDigits: 2})} €
                    </div>
                    <div className="text-gray-600 font-medium">Monatlich (effektiv)</div>
                  </div>
                  
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {salaryMetrics.yearly.toLocaleString('de-DE', {minimumFractionDigits: 0})} €
                    </div>
                    <div className="text-gray-600 font-medium">Jährlich</div>
                  </div>
                  
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <div className="text-3xl font-bold text-purple-600 mb-1">
                      {salaryMetrics.hourly.toLocaleString('de-DE', {minimumFractionDigits: 2})} €
                    </div>
                    <div className="text-gray-600 font-medium">Stündlich</div>
                  </div>
                </div>
              </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📉</span>
                </div>
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {statistics.min.toLocaleString('de-DE')} €
                </div>
                <div className="text-gray-600">Niedrigstes Gehalt</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {statistics.median.toLocaleString('de-DE')} €
                </div>
                <div className="text-gray-600">Median-Gehalt</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📈</span>
                </div>
                <div className="text-2xl font-bold text-red-600 mb-1">
                  {statistics.max.toLocaleString('de-DE')} €
                </div>
                <div className="text-gray-600">Höchstes Gehalt</div>
              </div>
            </div>

            {/* Data Visualization */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedTable} Datenanalyse
                  </h3>
                  <div className="flex rounded-lg bg-gray-100 p-1">
                    <button
                      onClick={() => setActiveTab('table')}
                      className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                        activeTab === 'table'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📋 Tabelle
                    </button>
                    <button
                      onClick={() => setActiveTab('chart')}
                      className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                        activeTab === 'chart'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📊 Diagramm
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {activeTab === 'table' && Object.keys(pivotData).length > 0 && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">
                              Entgeltgruppe
                            </th>
                            {Array.from(new Set(salaryData.map(d => d.Stufe))).sort((a, b) => a - b).map(step => (
                              <th key={step} className="text-left py-3 px-4 font-semibold text-gray-900">
                                Stufe {step}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Object.keys(pivotData).sort(sortEntgeltgruppe).map(group => (
                            <tr key={group} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 font-medium text-gray-900">
                                {group}
                              </td>
                              {Array.from(new Set(salaryData.map(d => d.Stufe))).sort((a, b) => a - b).map(step => (
                                <td key={step} className="py-3 px-4 text-gray-700">
                                  {pivotData[group][step] ? 
                                    `${pivotData[group][step].toLocaleString('de-DE')} €` : 
                                    <span className="text-gray-400">—</span>
                                  }
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="flex justify-center">
                      <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        📥 CSV herunterladen
                      </button>
                    </div>
                  </div>
                )}
                
                {activeTab === 'chart' && chartData.length > 0 && (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#1E40AF" stopOpacity={0.6}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis 
                          dataKey="label" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          interval={0}
                          fontSize={11}
                          stroke="#6B7280"
                        />
                        <YAxis 
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                          stroke="#6B7280"
                          fontSize={12}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${value.toLocaleString('de-DE')} €`, 'Gehalt']}
                          labelFormatter={(label) => `${label}`}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Bar dataKey="salary" fill="url(#barGradient)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Other Pages */}
        {currentPage === 'tarifrunden' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💼</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tarifrunden</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Hier werden zukünftig Informationen über aktuelle und vergangene Tarifrunden angezeigt.
            </p>
          </div>
        )}

        {currentPage === 'tariftabellen' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📋</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tariftabellen</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Hier finden Sie zukünftig eine Übersicht aller verfügbaren Tariftabellen.
            </p>
          </div>
        )}

        {currentPage === 'blog' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✍️</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Blog</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Hier werden zukünftig Artikel und News rund um das Thema Tarifgehälter veröffentlicht.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TarifDashboard;