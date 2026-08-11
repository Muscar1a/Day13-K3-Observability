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
  XCircle,
  Play,
  Pause,
  Activity
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
  { id: '1', name: 'gpt-4o', provider: 'OpenAI', logoText: 'OA', status: 'Strong', requests: '0', requestsRaw: 0, successRate: 100.0, p95Latency: 0, errorRate: 0.0, cost: '$0.00', costRaw: 0, sparkline: [10, 15, 12, 14, 15], color: '#10b981' },
  { id: '2', name: 'gpt-4o-mini', provider: 'OpenAI', logoText: 'OA', status: 'Strong', requests: '0', requestsRaw: 0, successRate: 100.0, p95Latency: 0, errorRate: 0.0, cost: '$0.00', costRaw: 0, sparkline: [10, 12, 11, 13, 14], color: '#10b981' },
  { id: '3', name: 'claude-3.5', provider: 'Anthropic', logoText: 'AN', status: 'Strong', requests: '0', requestsRaw: 0, successRate: 100.0, p95Latency: 0, errorRate: 0.0, cost: '$0.00', costRaw: 0, sparkline: [12, 14, 13, 15, 16], color: '#10b981' },
  { id: '4', name: 'embedding-3', provider: 'OpenAI', logoText: 'OA', status: 'Strong', requests: '0', requestsRaw: 0, successRate: 100.0, p95Latency: 0, errorRate: 0.0, cost: '$0.00', costRaw: 0, sparkline: [5, 6, 5, 7, 8], color: '#10b981' },
  { id: '5', name: 'vision-1', provider: 'OpenAI', logoText: 'OA', status: 'Strong', requests: '0', requestsRaw: 0, successRate: 100.0, p95Latency: 0, errorRate: 0.0, cost: '$0.00', costRaw: 0, sparkline: [15, 18, 16, 17, 19], color: '#3b82f6' },
  { id: '6', name: 'voyage-1', provider: 'Voyage', logoText: 'VO', status: 'Strong', requests: '0', requestsRaw: 0, successRate: 100.0, p95Latency: 0, errorRate: 0.0, cost: '$0.00', costRaw: 0, sparkline: [8, 9, 8, 10, 11], color: '#10b981' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'metrics' | 'traces' | 'logs' | 'incidents'>('metrics');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider] = useState<string>('All');
  const [selectedStatus] = useState<string>('All');
  const [models, setModels] = useState<ModelItem[]>(INITIAL_MODELS);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());
  const [autoSimulate, setAutoSimulate] = useState<boolean>(true);
  
  // Real backend telemetry state
  const [kpiMetrics, setKpiMetrics] = useState({
    totalRequests: '2,710,480',
    avgLatencyP95: '742ms',
    totalCost: '$23,740',
    avgSuccessRate: '99.57%'
  });
  const [trendData, setTrendData] = useState<any[]>([
    { time: '09:00', latencyP95: 720, errorRate: 0.20 },
    { time: '10:00', latencyP95: 735, errorRate: 0.22 },
    { time: '11:00', latencyP95: 750, errorRate: 0.35 },
    { time: '12:00', latencyP95: 2530, errorRate: 1.85 },
    { time: '13:00', latencyP95: 760, errorRate: 0.45 },
    { time: '14:00', latencyP95: 742, errorRate: 0.25 },
    { time: '15:00', latencyP95: 738, errorRate: 0.21 },
  ]);
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
          const s = mData.summary;
          setKpiMetrics(prev => ({
            ...prev,
            totalRequests: s.total_requests ? s.total_requests.toLocaleString() : prev.totalRequests,
            avgLatencyP95: s.latency_p95_ms ? `${s.latency_p95_ms}ms` : prev.avgLatencyP95,
            totalCost: s.total_cost_usd ? `$${s.total_cost_usd.toLocaleString()}` : prev.totalCost,
            avgSuccessRate: s.error_rate_pct !== undefined ? `${(100 - s.error_rate_pct).toFixed(2)}%` : prev.avgSuccessRate,
          }));

          // Dynamically update model breakdown
          if (s.model_breakdown) {
            setModels(prev => prev.map(m => {
              const b = s.model_breakdown[m.name];
              if (b) {
                const reqCount = b.requests;
                const errRate = b.recent_error_rate !== undefined ? b.recent_error_rate : (b.requests ? (b.errors / b.requests) * 100 : 0);
                const modelP95 = b.latency_p95 !== undefined ? b.latency_p95 : (b.latencies?.length ? Math.max(...b.latencies) : 0);
                const costVal = b.cost || 0;
                const formatReqs = reqCount >= 1000000 ? `${(reqCount / 1000000).toFixed(2)}M` : reqCount >= 1000 ? `${(reqCount / 1000).toFixed(1)}K` : `${reqCount}`;
                
                let modelStatus: 'Strong' | 'Stable' | 'Watch' | 'Degraded' = 'Strong';
                let modelColor = '#10b981';

                if (modelP95 > 2000 || errRate >= 5.0) {
                  modelStatus = 'Degraded';
                  modelColor = '#ef4444';
                } else if (modelP95 > 600 || errRate > 0.5) {
                  modelStatus = 'Watch';
                  modelColor = '#f59e0b';
                } else if (modelP95 > 300) {
                  modelStatus = 'Stable';
                  modelColor = '#3b82f6';
                }

                return {
                  ...m,
                  requestsRaw: reqCount,
                  requests: formatReqs,
                  successRate: Number(Math.max(0, 100 - errRate).toFixed(2)),
                  errorRate: Number(errRate.toFixed(2)),
                  p95Latency: modelP95,
                  cost: `$${costVal.toFixed(2)}`,
                  costRaw: costVal,
                  status: modelStatus,
                  color: modelColor
                };
              }
              return m;
            }));
          }

          // Live trend update
          const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const curP95 = s.latency_p95_ms || 120;
          const curErr = s.error_rate_pct !== undefined ? s.error_rate_pct : 0.0;
          setTrendData(prev => {
            const next = [...prev, { time: nowTime, latencyP95: curP95, errorRate: curErr }];
            return next.length > 12 ? next.slice(next.length - 12) : next;
          });
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
      console.error('API Sync notice:', err);
    } finally {
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  };

  // Auto traffic polling timer
  useEffect(() => {
    fetchBackendData();
    const interval = setInterval(fetchBackendData, 2000);
    return () => clearInterval(interval);
  }, [filterCorrelationId]);

  const handleSimulate = async (attackMode: boolean) => {
    setSimulating(true);
    setSimulationNotice(attackMode ? '⚡ Triggering cascading incident (rag_slow + cost_spike)...' : '✨ Generating normal traffic...');
    try {
      const endpoint = attackMode ? 'http://127.0.0.1:8000/incidents/demo_attack' : 'http://127.0.0.1:8000/simulate?attack=false&count=3';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        await fetchBackendData();
        setSimulationNotice(attackMode 
          ? '🚨 Attack executed! Check Traces & Logs for latency > 2500ms and cost spikes.' 
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Strong
          </span>
        );
      case 'Stable':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Stable
          </span>
        );
      case 'Watch':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Watch
          </span>
        );
      case 'Degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            Degraded
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">R.</span>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              AI Ops Workspace
            </div>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">Live Telemetry</span>
          </div>

          {/* Tab Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'metrics' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" /> 1. Metrics
            </button>
            <button
              onClick={() => setActiveTab('traces')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'traces' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-violet-600" /> 2. Traces
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'logs' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-slate-700" /> 3. Logs
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'incidents' ? 'bg-white text-rose-600 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> 4. Attack Demo
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto Simulator Toggle */}
          <button
            onClick={() => setAutoSimulate(!autoSimulate)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
              autoSimulate
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {autoSimulate ? <Play className="w-3 h-3 text-emerald-600 fill-emerald-600 animate-pulse" /> : <Pause className="w-3 h-3 text-slate-400" />}
            <span>Auto-Traffic: {autoSimulate ? 'ON' : 'OFF'}</span>
          </button>

          <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
            {lastRefreshed}
          </div>
          <button onClick={fetchBackendData} className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
            PT
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-5">
          <button onClick={() => setActiveTab('metrics')} className={`p-2 rounded-xl transition-all ${activeTab === 'metrics' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100 shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <BarChart3 className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTab('traces')} className={`p-2 rounded-xl transition-all ${activeTab === 'traces' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100 shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <Layers className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTab('logs')} className={`p-2 rounded-xl transition-all ${activeTab === 'logs' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100 shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <Terminal className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTab('incidents')} className={`p-2 rounded-xl transition-all ${activeTab === 'incidents' ? 'text-rose-600 bg-rose-50 border border-rose-100 shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
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
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Models Telemetry</h1>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Activity className="w-3 h-3 text-emerald-600 animate-pulse" /> LIVE STREAMING
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Real-time operational intelligence, P95 latency thresholds, and model health.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleSimulate(true)} 
                    className="flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    <Zap className="w-4 h-4 animate-bounce" /> Trigger Latency Attack
                  </button>
                </div>
              </div>

              {/* Top 4 KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all">
                  <span className="text-xs font-semibold text-slate-500">Total Requests Processed</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpiMetrics.totalRequests}</span>
                    <div className="w-24 h-6">{renderMiniSparkline([15, 18, 22, 25, 28, 32, 35], '#10b981')}</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all">
                  <span className="text-xs font-semibold text-slate-500">Average P95 Latency</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className={`text-3xl font-extrabold tracking-tight ${parseInt(kpiMetrics.avgLatencyP95) > 2000 ? 'text-rose-600 animate-pulse' : 'text-slate-900'}`}>
                      {kpiMetrics.avgLatencyP95}
                    </span>
                    <div className="w-24 h-6">
                      {renderMiniSparkline(
                        trendData.map(t => t.latencyP95).slice(-7),
                        parseInt(kpiMetrics.avgLatencyP95) > 2000 ? '#ef4444' : '#10b981'
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mt-2">
                    <span>Threshold: 2000ms</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all">
                  <span className="text-xs font-semibold text-slate-500">Total Operational Cost</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpiMetrics.totalCost}</span>
                    <div className="w-24 h-6">{renderMiniSparkline([12, 14, 18, 20, 22, 25, 30], '#10b981')}</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all">
                  <span className="text-xs font-semibold text-slate-500">Avg Success Rate</span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{kpiMetrics.avgSuccessRate}</span>
                    <div className="w-24 h-6">{renderMiniSparkline([25, 26, 28, 29, 30, 31, 33], '#10b981')}</div>
                  </div>
                </div>
              </div>

              {/* Main Grid: All Models Table */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div className="relative w-full md:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search models..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="text-xs font-semibold text-slate-400">
                        Active Models: {filteredModels.length}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3.5 px-4">Model</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4">Requests</th>
                            <th className="py-3.5 px-4">Success Rate</th>
                            <th className="py-3.5 px-4">p95 Latency</th>
                            <th className="py-3.5 px-4">Error Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredModels.map(model => (
                            <tr key={model.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-[10px] text-indigo-700 shadow-2xs">
                                    {model.logoText}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900">{model.name}</div>
                                    <div className="text-[10px] text-slate-400">{model.provider}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">{renderStatusBadge(model.status)}</td>
                              <td className="py-3.5 px-4 font-bold text-slate-800">{model.requests}</td>
                              <td className="py-3.5 px-4 font-semibold text-slate-700">{model.successRate.toFixed(2)}%</td>
                              <td className={`py-3.5 px-4 font-mono text-xs ${model.p95Latency > 2000 ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                                {model.p95Latency} ms
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-rose-600 font-semibold">{model.errorRate.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Real-Time Telemetry Trends</h3>
                        <p className="text-xs text-slate-400">Avg P95 Latency (ms) vs Error Rate (%) over time window</p>
                      </div>
                      <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 animate-pulse" /> Stream Sync
                      </span>
                    </div>
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }} />
                          <Line type="monotone" dataKey="latencyP95" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} name="Avg P95 (ms)" />
                          <Line type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name="Error Rate (%)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-6">
                  {/* Observability Guide Card */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-extrabold uppercase tracking-wider mb-3">
                      <Sparkles className="w-4 h-4 text-indigo-400" /> Observability Flow Guide
                    </div>
                    <ol className="space-y-3.5 text-xs text-indigo-100">
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                        <span><strong>Metrics:</strong> Monitor system P95 latency spikes (&gt;2000ms).</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                        <span><strong>Traces:</strong> Switch to Traces tab to isolate the exact correlation ID.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                        <span><strong>Logs:</strong> Inspect structured log waterfall events (e.g. <code>rag_retrieval_done</code>).</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
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
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Trace Waterfall (Backend Spans)</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Drill down from high-level metrics into end-to-end trace waterfalls.
                  </p>
                </div>
                <button onClick={fetchBackendData} className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xs hover:bg-slate-50">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Refresh Traces
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 flex justify-between items-center">
                  <span>Recent {traces.length} request trace waterfalls</span>
                  <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Click any row to drill into logs</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3.5 px-4">Correlation ID</th>
                        <th className="py-3.5 px-4">Timestamp</th>
                        <th className="py-3.5 px-4">Feature</th>
                        <th className="py-3.5 px-4">Latency</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {traces.map((trace, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => handleTraceClick(trace.correlation_id)}
                          className="hover:bg-indigo-50/60 cursor-pointer transition-colors"
                        >
                          <td className="py-3.5 px-4 text-indigo-600 font-extrabold">{trace.correlation_id}</td>
                          <td className="py-3.5 px-4 text-slate-500">{new Date(trace.timestamp).toLocaleTimeString()}</td>
                          <td className="py-3.5 px-4 text-slate-700">{trace.feature}</td>
                          <td className={`py-3.5 px-4 font-extrabold ${trace.latency_ms > 2000 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {trace.latency_ms} ms
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            {trace.has_slow_rag || trace.latency_ms > 2000 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                                <AlertTriangle className="w-3 h-3" /> SLOW (rag_slow)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" /> HEALTHY
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-indigo-600 hover:underline flex items-center justify-end gap-1 font-sans text-xs font-bold">
                              Inspect Logs <ArrowRight className="w-3.5 h-3.5" />
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
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Structured JSON Logs</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Exact log records streamed from <code>data/logs.jsonl</code> with PII Redaction verified.
                  </p>
                </div>
                {filterCorrelationId && (
                  <button 
                    onClick={() => setFilterCorrelationId('')}
                    className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-900 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    Clear Filter: {filterCorrelationId} <XCircle className="w-4 h-4 text-slate-600" />
                  </button>
                )}
              </div>

              <div className="bg-slate-950 text-slate-100 rounded-2xl p-5 font-mono text-xs overflow-x-auto shadow-xl border border-slate-800">
                <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-800 text-slate-400 text-[11px]">
                  <span className="font-bold text-indigo-400">Stream: data/logs.jsonl</span>
                  <span>Total Records: {logs.length}</span>
                </div>

                <div className="space-y-3">
                  {logs.map((record, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition-all">
                      <div className="flex items-center gap-3 text-[11px] mb-1.5">
                        <span className="text-slate-500">{record.ts || record.timestamp}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${record.level === 'error' ? 'bg-rose-950 text-rose-300 border border-rose-800' : record.level === 'warning' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-indigo-300 border border-slate-700'}`}>
                          {record.level || 'info'}
                        </span>
                        <span className="text-indigo-300 font-extrabold text-xs">{record.event}</span>
                        {record.correlation_id && (
                          <span className="text-slate-400 ml-auto">cid: <strong className="text-indigo-400">{record.correlation_id}</strong></span>
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
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Incident & Attack Simulator</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Trigger artificial latency bottlenecks (e.g. <code>rag_slow</code>) and observe the end-to-end telemetry pipeline.
                </p>
              </div>

              {simulationNotice && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 shadow-2xs animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {simulationNotice}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Attack Simulator */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">Simulate Traffic & Attacks</h3>
                  <p className="text-xs text-slate-500 mb-6">
                    Generate live backend requests to test telemetry and incident detection.
                  </p>

                  <div className="flex flex-col gap-3.5">
                    <button
                      disabled={simulating}
                      onClick={() => handleSimulate(false)}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-md"
                    >
                      <CheckCircle className="w-4 h-4" /> Simulate Normal Traffic (Fast Response)
                    </button>

                    <button
                      disabled={simulating}
                      onClick={() => handleSimulate(true)}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-98 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl transition-all shadow-md"
                    >
                      <Zap className="w-4 h-4 animate-bounce" /> Simulate Real Attack (`rag_slow` Bottleneck)
                    </button>
                  </div>
                </div>

                {/* Incident Toggles */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">Manual Incident Controls</h3>
                  <p className="text-xs text-slate-500 mb-6">
                    Direct toggle switches for backend incident flags.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div>
                        <div className="font-extrabold text-xs text-slate-900">Incident: `rag_slow`</div>
                        <div className="text-[11px] text-slate-500">Injects 2.5s artificial delay into RAG vector search.</div>
                      </div>
                      <button
                        onClick={() => handleToggleIncident('rag_slow', !incidentState['rag_slow'])}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-2xs ${
                          incidentState['rag_slow']
                            ? 'bg-rose-600 text-white animate-pulse'
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
