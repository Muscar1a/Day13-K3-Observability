import { useState, useEffect } from 'react';
import {
  Search,
  AlertTriangle,
  Zap,
  BarChart3,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Terminal,
  Layers,
  ArrowRight,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

interface ModelItem {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Voyage';
  logoText: string;
  status: 'Strong' | 'Stable' | 'Watch' | 'Degraded';
  requests: string;
  requestsRaw: number;
  successRate: number;
  p95Latency: number;
  errorRate: number;
  cost: string;
  costRaw: number;
  sparkline: number[];
  color: string;
}

const INITIAL_MODELS: ModelItem[] = [
  {
    id: '1',
    name: 'gpt-4o',
    provider: 'OpenAI',
    logoText: 'OA',
    status: 'Strong',
    requests: '1.2M',
    requestsRaw: 1200000,
    successRate: 98.70,
    p95Latency: 746,
    errorRate: 0.22,
    cost: '$6,210',
    costRaw: 6210,
    sparkline: [20, 25, 22, 30, 28, 35, 40],
    color: '#10b981'
  },
  {
    id: '2',
    name: 'gpt-4o-mini',
    provider: 'OpenAI',
    logoText: 'OA',
    status: 'Degraded',
    requests: '480K',
    requestsRaw: 480000,
    successRate: 91.20,
    p95Latency: 812,
    errorRate: 1.05,
    cost: '$2,360',
    costRaw: 2360,
    sparkline: [40, 35, 45, 30, 25, 20, 15],
    color: '#ef4444'
  },
  {
    id: '3',
    name: 'claude-3.5',
    provider: 'Anthropic',
    logoText: 'AN',
    status: 'Watch',
    requests: '310K',
    requestsRaw: 310000,
    successRate: 94.70,
    p95Latency: 774,
    errorRate: 0.42,
    cost: '$4,210',
    costRaw: 4210,
    sparkline: [25, 28, 26, 32, 30, 29, 31],
    color: '#f59e0b'
  },
  {
    id: '4',
    name: 'embedding-3',
    provider: 'OpenAI',
    logoText: 'OA',
    status: 'Strong',
    requests: '190K',
    requestsRaw: 190000,
    successRate: 99.20,
    p95Latency: 128,
    errorRate: 0.04,
    cost: '$1,880',
    costRaw: 1880,
    sparkline: [15, 18, 20, 22, 25, 28, 30],
    color: '#10b981'
  },
  {
    id: '5',
    name: 'vision-1',
    provider: 'OpenAI',
    logoText: 'OA',
    status: 'Stable',
    requests: '120K',
    requestsRaw: 120000,
    successRate: 97.30,
    p95Latency: 1243,
    errorRate: 0.28,
    cost: '$1,540',
    costRaw: 1540,
    sparkline: [30, 32, 31, 33, 35, 34, 36],
    color: '#3b82f6'
  },
  {
    id: '6',
    name: 'voyage-1',
    provider: 'Voyage',
    logoText: 'VO',
    status: 'Degraded',
    requests: '80K',
    requestsRaw: 80000,
    successRate: 90.40,
    p95Latency: 690,
    errorRate: 0.58,
    cost: '$920',
    costRaw: 920,
    sparkline: [35, 30, 28, 25, 22, 20, 18],
    color: '#ef4444'
  }
];

const TREND_DATA = [
  { time: '09:00', latencyP95: 720, errorRate: 0.20 },
  { time: '10:00', latencyP95: 735, errorRate: 0.22 },
  { time: '11:00', latencyP95: 750, errorRate: 0.35 },
  { time: '12:00', latencyP95: 2530, errorRate: 1.85 },
  { time: '13:00', latencyP95: 760, errorRate: 0.45 },
  { time: '14:00', latencyP95: 742, errorRate: 0.25 },
  { time: '15:00', latencyP95: 738, errorRate: 0.21 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'metrics' | 'traces' | 'logs' | 'incidents'>('metrics');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider] = useState<string>('All');
  const [selectedStatus] = useState<string>('All');
  const [models] = useState<ModelItem[]>(INITIAL_MODELS);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());
  
  // Real backend telemetry state
  const [kpiMetrics, setKpiMetrics] = useState({
    totalRequests: '2.7M',
    avgLatencyP95: '742ms',
    totalCost: '$23,740',
    avgSuccessRate: '99.57%'
  });
  const [traces, setTraces] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [filterCorrelationId, setFilterCorrelationId] = useState<string>('');
  const [incidentState, setIncidentState] = useState<Record<string, boolean>>({});
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationNotice, setSimulationNotice] = useState<string>('');

  const fetchBackendData = async () => {
    try {
      // 1. Fetch Metrics
      const mRes = await fetch('http://127.0.0.1:8000/metrics');
      if (mRes.ok) {
        const mData = await mRes.json();
        if (mData?.summary) {
          if (mData.summary.latency_p95_ms) {
            setKpiMetrics(prev => ({
              ...prev,
              avgLatencyP95: `${mData.summary.latency_p95_ms}ms`,
              avgSuccessRate: `${(100 - (mData.summary.error_rate_pct || 0)).toFixed(2)}%`,
            }));
          }
        }
      }

      // 2. Fetch Health/Incidents
      const hRes = await fetch('http://127.0.0.1:8000/health');
      if (hRes.ok) {
        const hData = await hRes.json();
        if (hData?.incidents) {
          setIncidentState(hData.incidents);
        }
      }

      // 3. Fetch Traces
      const tRes = await fetch('http://127.0.0.1:8000/traces?limit=30');
      if (tRes.ok) {
        const tData = await tRes.json();
        setTraces(tData);
      }

      // 4. Fetch Logs
      const url = filterCorrelationId 
        ? `http://127.0.0.1:8000/logs?correlation_id=${encodeURIComponent(filterCorrelationId)}&limit=100`
        : 'http://127.0.0.1:8000/logs?limit=100';
      const lRes = await fetch(url);
      if (lRes.ok) {
        const lData = await lRes.json();
        setLogs(lData);
      }

    } catch (err) {
      console.error('API Sync notice (using cached telemetry):', err);
    } finally {
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchBackendData();
    const interval = setInterval(fetchBackendData, 5000);
    return () => clearInterval(interval);
  }, [filterCorrelationId]);

  const handleSimulate = async (attackMode: boolean) => {
    setSimulating(true);
    setSimulationNotice(attackMode ? 'Simulating real latency attack (rag_slow)...' : 'Simulating normal traffic...');
    try {
      const res = await fetch(`http://127.0.0.1:8000/simulate?attack=${attackMode}&count=4`, { method: 'POST' });
      if (res.ok) {
        await fetchBackendData();
        setSimulationNotice(attackMode 
          ? '⚠️ Attack executed! Check Traces & Logs for latency > 2500ms.' 
          : '✅ Normal traffic generated.'
        );
      }
    } catch (err) {
      console.error(err);
      setSimulationNotice('Error connecting to backend.');
    } finally {
      setSimulating(false);
    }
  };

  const handleToggleIncident = async (name: string, enableAction: boolean) => {
    try {
      const endpoint = enableAction ? `http://127.0.0.1:8000/incidents/${name}/enable` : `http://127.0.0.1:8000/incidents/${name}/disable`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        fetchBackendData();
      }
    } catch (err) {
      console.error('Error toggling incident', err);
    }
  };

  const handleTraceClick = (cid: string) => {
    setFilterCorrelationId(cid);
    setActiveTab('logs');
  };

  const filteredModels = models.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvider = selectedProvider === 'All' || m.provider === selectedProvider;
    const matchesStatus = selectedStatus === 'All' || m.status === selectedStatus;
    return matchesSearch && matchesProvider && matchesStatus;
  });

  const renderStatusBadge = (status: ModelItem['status']) => {
    switch (status) {
      case 'Strong':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Strong
          </span>
        );
      case 'Stable':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Stable
          </span>
        );
      case 'Watch':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Watch
          </span>
        );
      case 'Degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Degraded
          </span>
        );
    }
  };

  const renderMiniSparkline = (points: number[], color: string) => {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const height = 18;
    const width = 60;
    const pathD = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / range) * (height - 4);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-slate-900">R.</span>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-900">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              AI Ops
            </div>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-900">Observability Workspace</span>
          </div>

          {/* Tab Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md transition-all ${
                activeTab === 'metrics' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> 1. Metrics
            </button>
            <button
              onClick={() => setActiveTab('traces')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md transition-all ${
                activeTab === 'traces' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> 2. Traces
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md transition-all ${
                activeTab === 'logs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" /> 3. Logs
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md transition-all ${
                activeTab === 'incidents' ? 'bg-white text-rose-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> 4. Attack Demo
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            Sync: {lastRefreshed}
          </div>
          <button onClick={fetchBackendData} className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-medium ml-1">
            PT
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-5">
          <button onClick={() => setActiveTab('metrics')} className={`p-2 rounded-xl ${activeTab === 'metrics' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <BarChart3 className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTab('traces')} className={`p-2 rounded-xl ${activeTab === 'traces' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <Layers className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTab('logs')} className={`p-2 rounded-xl ${activeTab === 'logs' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <Terminal className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTab('incidents')} className={`p-2 rounded-xl ${activeTab === 'incidents' ? 'text-rose-600 bg-rose-50 border border-rose-100' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <ShieldAlert className="w-5 h-5" />
          </button>
        </aside>

        {/* Main Workspace Body */}
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full">

          {/* TAB 1: METRICS */}
          {activeTab === 'metrics' && (
            <div>
              {/* Header Action Section */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Models Telemetry (Metrics)</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Live system-wide operational metrics, P95 latency, and SLO compliance status.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleSimulate(true)} 
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5" /> Trigger Attack Simulation
                  </button>
                </div>
              </div>

              {/* Top 4 KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <span className="text-xs font-medium text-slate-500">Total requests</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">{kpiMetrics.totalRequests}</span>
                    <div className="w-24 h-6">{renderMiniSparkline([15, 18, 22, 25, 28, 32, 35], '#10b981')}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <span className="text-xs font-medium text-slate-500">Backend P95 Latency</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className={`text-2xl font-bold tracking-tight ${parseInt(kpiMetrics.avgLatencyP95) > 2000 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {kpiMetrics.avgLatencyP95}
                    </span>
                    <div className="w-24 h-6">{renderMiniSparkline([35, 30, 28, 25, 22, 20, 18], '#ef4444')}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-2">
                    <span>Threshold: 2000ms</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <span className="text-xs font-medium text-slate-500">Total cost</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">{kpiMetrics.totalCost}</span>
                    <div className="w-24 h-6">{renderMiniSparkline([12, 14, 18, 20, 22, 25, 30], '#10b981')}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <span className="text-xs font-medium text-slate-500">Success Rate</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">{kpiMetrics.avgSuccessRate}</span>
                    <div className="w-24 h-6">{renderMiniSparkline([25, 26, 28, 29, 30, 31, 33], '#10b981')}</div>
                  </div>
                </div>
              </div>

              {/* Main Grid: All Models Table */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div className="relative w-full md:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search models..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 pl-8 pr-3 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                          <tr>
                            <th className="py-3 px-4">Model</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Requests</th>
                            <th className="py-3 px-4">Success rate</th>
                            <th className="py-3 px-4">p95 Latency</th>
                            <th className="py-3 px-4">Error rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredModels.map(model => (
                            <tr key={model.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 font-semibold">{model.name}</td>
                              <td className="py-3 px-4">{renderStatusBadge(model.status)}</td>
                              <td className="py-3 px-4 font-medium">{model.requests}</td>
                              <td className="py-3 px-4">{model.successRate.toFixed(2)}%</td>
                              <td className="py-3 px-4 font-mono">{model.p95Latency} ms</td>
                              <td className="py-3 px-4 font-mono text-rose-600">{model.errorRate.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                    <h3 className="text-sm font-bold text-slate-900 mb-4">Latency & Error Telemetry Trends</h3>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={TREND_DATA}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                          <Line type="monotone" dataKey="latencyP95" stroke="#3b82f6" strokeWidth={2} name="P95 Latency (ms)" />
                          <Line type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2} name="Error Rate (%)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-xs">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">
                      <Sparkles className="w-4 h-4 text-indigo-400" /> Observability Flow Guide
                    </div>
                    <ol className="space-y-3 text-xs text-indigo-100">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                        <span><strong>Metrics:</strong> Monitor backend P95 latency spikes (&gt;2000ms).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                        <span><strong>Traces:</strong> Go to Traces to find the specific slow request correlation ID.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                        <span><strong>Logs:</strong> Inspect exact event spans (e.g. <code>rag_retrieval_done</code>).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">4</span>
                        <span><strong>Root Cause:</strong> Identify artificial <code>rag_slow</code> bottleneck!</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRACES */}
          {activeTab === 'traces' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Trace Waterfall (Backend Spans)</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Drill down from high-level latency metrics into end-to-end request trace waterfalls.
                  </p>
                </div>
                <button onClick={fetchBackendData} className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Traces
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 flex justify-between">
                  <span>Showing recent {traces.length} request trace waterfalls</span>
                  <span>Click any row to inspect correlation logs</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white border-b border-slate-200 text-slate-500 font-medium">
                      <tr>
                        <th className="py-3 px-4">Correlation ID</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Feature</th>
                        <th className="py-3 px-4">Latency</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {traces.map((trace, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => handleTraceClick(trace.correlation_id)}
                          className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 text-indigo-600 font-semibold">{trace.correlation_id}</td>
                          <td className="py-3 px-4 text-slate-500">{new Date(trace.timestamp).toLocaleTimeString()}</td>
                          <td className="py-3 px-4 text-slate-700">{trace.feature}</td>
                          <td className={`py-3 px-4 font-bold ${trace.latency_ms > 2000 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {trace.latency_ms} ms
                          </td>
                          <td className="py-3 px-4">
                            {trace.has_slow_rag || trace.latency_ms > 2000 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700">
                                <AlertTriangle className="w-3 h-3" /> SLOW (rag_slow)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700">
                                <CheckCircle className="w-3 h-3" /> HEALTHY
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-indigo-600 hover:underline flex items-center justify-end gap-1 font-sans text-xs">
                              Logs <ArrowRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOGS */}
          {activeTab === 'logs' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Structured JSON Logs</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Exact log records streamed from <code>data/logs.jsonl</code> with PII Redaction verified.
                  </p>
                </div>
                {filterCorrelationId && (
                  <button 
                    onClick={() => setFilterCorrelationId('')}
                    className="flex items-center gap-1 bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    Clear Filter: {filterCorrelationId} <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto shadow-md">
                <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-800 text-slate-400 text-[11px]">
                  <span>Showing {logs.length} raw log records</span>
                  <span>Log File: data/logs.jsonl</span>
                </div>

                <div className="space-y-2">
                  {logs.map((record, i) => (
                    <div key={i} className="p-2.5 rounded bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all">
                      <div className="flex items-center gap-3 text-[11px] mb-1">
                        <span className="text-slate-500">{record.ts || record.timestamp}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${record.level === 'error' ? 'bg-rose-900 text-rose-200' : record.level === 'warning' ? 'bg-amber-900 text-amber-200' : 'bg-slate-800 text-slate-300'}`}>
                          {record.level || 'info'}
                        </span>
                        <span className="text-indigo-400 font-semibold">{record.event}</span>
                        {record.correlation_id && (
                          <span className="text-slate-400 ml-auto">cid: <strong className="text-indigo-300">{record.correlation_id}</strong></span>
                        )}
                      </div>
                      <pre className="text-[11px] text-slate-300 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(record, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INCIDENTS & ATTACK DEMO */}
          {activeTab === 'incidents' && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Incident & Attack Simulator</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Trigger artificial latency bottlenecks (e.g. <code>rag_slow</code>) and observe the end-to-end telemetry pipeline.
                </p>
              </div>

              {simulationNotice && (
                <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {simulationNotice}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Attack Simulator */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-base font-bold text-slate-900 mb-2">Simulate Traffic & Attacks</h3>
                  <p className="text-xs text-slate-500 mb-6">
                    Click below to generate live backend requests and simulate latency degradation.
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      disabled={simulating}
                      onClick={() => handleSimulate(false)}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 px-4 rounded-xl transition-all shadow-xs"
                    >
                      <CheckCircle className="w-4 h-4" /> Simulate Normal Traffic (Fast Response)
                    </button>

                    <button
                      disabled={simulating}
                      onClick={() => handleSimulate(true)}
                      className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-3 px-4 rounded-xl transition-all shadow-xs"
                    >
                      <Zap className="w-4 h-4" /> Simulate Real Attack (`rag_slow` Bottleneck)
                    </button>
                  </div>
                </div>

                {/* Incident Toggles */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-base font-bold text-slate-900 mb-2">Manual Incident Switches</h3>
                  <p className="text-xs text-slate-500 mb-6">
                    Direct control over backend simulated incident flags.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div>
                        <div className="font-bold text-xs text-slate-900">Incident: `rag_slow`</div>
                        <div className="text-[11px] text-slate-500">Injects 2.5s artificial delay into RAG vector search.</div>
                      </div>
                      <button
                        onClick={() => handleToggleIncident('rag_slow', !incidentState['rag_slow'])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          incidentState['rag_slow']
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {incidentState['rag_slow'] ? 'ACTIVE (Enabled)' : 'INACTIVE (Disabled)'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
