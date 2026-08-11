import { useState, useEffect } from 'react';
import {
  Search,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  LayoutGrid,
  List,
  AlertTriangle,
  Clock,
  Zap,
  Activity,
  Bell,
  Sun,
  UserPlus,
  Home,
  Box,
  MessageSquare,
  Database,
  BarChart3,
  FileText,
  Settings,
  RefreshCw,
  Sparkles
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
  },
  {
    id: '7',
    name: 'rerank-2',
    provider: 'Voyage',
    logoText: 'VO',
    status: 'Stable',
    requests: '50K',
    requestsRaw: 50000,
    successRate: 96.80,
    p95Latency: 184,
    errorRate: 0.09,
    cost: '$650',
    costRaw: 650,
    sparkline: [22, 24, 25, 26, 28, 29, 30],
    color: '#3b82f6'
  },
  {
    id: '8',
    name: 'audio-1',
    provider: 'OpenAI',
    logoText: 'OA',
    status: 'Stable',
    requests: '30K',
    requestsRaw: 30000,
    successRate: 96.40,
    p95Latency: 2104,
    errorRate: 0.40,
    cost: '$480',
    costRaw: 480,
    sparkline: [20, 22, 21, 23, 22, 24, 25],
    color: '#3b82f6'
  },
  {
    id: '9',
    name: 'gpt-4o-realtime',
    provider: 'OpenAI',
    logoText: 'OA',
    status: 'Stable',
    requests: '28K',
    requestsRaw: 28000,
    successRate: 96.10,
    p95Latency: 438,
    errorRate: 0.31,
    cost: '$1,290',
    costRaw: 1290,
    sparkline: [28, 29, 30, 31, 30, 32, 33],
    color: '#3b82f6'
  }
];

const TREND_DATA = [
  { time: '09:00', latencyP95: 720, errorRate: 0.20 },
  { time: '10:00', latencyP95: 735, errorRate: 0.22 },
  { time: '11:00', latencyP95: 750, errorRate: 0.35 },
  { time: '12:00', latencyP95: 810, errorRate: 0.85 },
  { time: '13:00', latencyP95: 760, errorRate: 0.45 },
  { time: '14:00', latencyP95: 742, errorRate: 0.25 },
  { time: '15:00', latencyP95: 738, errorRate: 0.21 },
];

const RECENT_ACTIVITIES = [
  { id: 'a1', time: '12 mins ago', type: 'deployment', title: 'gpt-4o-mini version update v2.1.0 deployed', status: 'info' },
  { id: 'a2', time: '28 mins ago', type: 'alert', title: 'Latency spike (>2000ms) on audio-1 model', status: 'warning' },
  { id: 'a3', time: '1 hour ago', type: 'rate-limit', title: 'Rate limit trigger on Anthropic claude-3.5 pool', status: 'warning' },
  { id: 'a4', time: '3 hours ago', type: 'rollback', title: 'Prompt version rolled back to v1 for refund pipeline', status: 'success' },
];

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [models] = useState<ModelItem[]>(INITIAL_MODELS);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());
  const [kpiMetrics, setKpiMetrics] = useState({
    totalRequests: '2.7M',
    avgLatencyP95: '742ms',
    totalCost: '$23,740',
    avgSuccessRate: '99.57%'
  });

  const fetchBackendMetrics = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/metrics');
      if (res.ok) {
        const data = await res.json();
        if (data && data.summary) {
          if (data.summary.latency_p95_ms) {
            setKpiMetrics(prev => ({
              ...prev,
              avgLatencyP95: `${data.summary.latency_p95_ms}ms`,
              avgSuccessRate: `${(100 - (data.summary.error_rate_pct || 0)).toFixed(2)}%`,
            }));
          }
        }
      }
    } catch (err) {
      console.error('API Sync notice (using cached telemetry):', err);
    } finally {
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchBackendMetrics();
    const interval = setInterval(fetchBackendMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Strong
          </span>
        );
      case 'Stable':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Stable
          </span>
        );
      case 'Watch':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Watch
          </span>
        );
      case 'Degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
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
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-900">Models</span>
          </div>

          <div className="relative hidden md:block w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search models, prompts, pipelines... K"
              className="w-full bg-slate-100 hover:bg-slate-100/80 focus:bg-white focus:ring-2 focus:ring-slate-900 border-none rounded-lg text-xs py-1.5 pl-9 pr-3 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100">
            <UserPlus className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100">
            <Sun className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-medium ml-1">
            PT
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-5">
          <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <Home className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <Zap className="w-5 h-5" />
          </button>
          <button className="p-2 text-indigo-600 bg-indigo-50 rounded-xl border border-indigo-100">
            <Box className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <Activity className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <MessageSquare className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <Database className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <BarChart3 className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
            <FileText className="w-5 h-5" />
          </button>

          <div className="mt-auto">
            <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* Main Workspace Body */}
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full">
          {/* Header Action Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Models</h1>
              <p className="text-xs text-slate-500 mt-1">
                Monitor performance, cost, and health across 18 active models.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Jun 18 - Jul 1, 2026</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </div>

              <button className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-xs">
                <Plus className="w-3.5 h-3.5" />
                Add model
              </button>
            </div>
          </div>

          {/* Top 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* KPI 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-500">Total requests</span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{kpiMetrics.totalRequests}</span>
                <div className="w-24 h-6">
                  {renderMiniSparkline([15, 18, 22, 25, 28, 32, 35], '#10b981')}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-2">
                <ArrowUpRight className="w-3 h-3" />
                <span>+14.6%</span>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-500">Avg latency (p95)</span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{kpiMetrics.avgLatencyP95}</span>
                <div className="w-24 h-6">
                  {renderMiniSparkline([35, 30, 28, 25, 22, 20, 18], '#ef4444')}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-rose-600 mt-2">
                <ArrowDownRight className="w-3 h-3" />
                <span>-8.3%</span>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-500">Total cost</span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{kpiMetrics.totalCost}</span>
                <div className="w-24 h-6">
                  {renderMiniSparkline([12, 14, 18, 20, 22, 25, 30], '#10b981')}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-2">
                <ArrowUpRight className="w-3 h-3" />
                <span>+6.7%</span>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-500">Avg success rate</span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{kpiMetrics.avgSuccessRate}</span>
                <div className="w-24 h-6">
                  {renderMiniSparkline([25, 26, 28, 29, 30, 31, 33], '#10b981')}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-2">
                <ArrowUpRight className="w-3 h-3" />
                <span>+0.21%</span>
              </div>
            </div>
          </div>

          {/* Main Grid: Left Table + Right Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            {/* Left Column: All Models Table */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                {/* Table Header Controls */}
                <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="relative w-full md:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search models..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 pl-8 pr-3 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Provider Filter */}
                    <div className="relative">
                      <select
                        value={selectedProvider}
                        onChange={e => setSelectedProvider(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg text-xs text-slate-600 py-1.5 px-3 pr-7 appearance-none cursor-pointer focus:outline-none"
                      >
                        <option value="All">Provider</option>
                        <option value="OpenAI">OpenAI</option>
                        <option value="Anthropic">Anthropic</option>
                        <option value="Voyage">Voyage</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                      <select
                        value={selectedStatus}
                        onChange={e => setSelectedStatus(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg text-xs text-slate-600 py-1.5 px-3 pr-7 appearance-none cursor-pointer focus:outline-none"
                      >
                        <option value="All">Status</option>
                        <option value="Strong">Strong</option>
                        <option value="Stable">Stable</option>
                        <option value="Watch">Watch</option>
                        <option value="Degraded">Degraded</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <button className="bg-white border border-slate-200 rounded-lg text-xs text-slate-600 py-1.5 px-3 flex items-center gap-1">
                      Capability
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    <button className="bg-white border border-slate-200 rounded-lg text-xs text-slate-600 py-1.5 px-3 flex items-center gap-1">
                      Sort by
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden ml-auto">
                      <button className="p-1.5 bg-slate-100 text-slate-700">
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 bg-white text-slate-400 hover:text-slate-700">
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table Data */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <tr>
                        <th className="py-3 px-4">Model</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Requests ▼</th>
                        <th className="py-3 px-4">Success rate</th>
                        <th className="py-3 px-4">p95 Latency</th>
                        <th className="py-3 px-4">Error rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredModels.map(model => (
                        <tr key={model.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700">
                                {model.logoText}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{model.name}</div>
                                <div className="text-[10px] text-slate-400">{model.provider}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {renderStatusBadge(model.status)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-slate-900 w-10">{model.requests}</span>
                              {renderMiniSparkline(model.sparkline, model.color)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-36">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-slate-900">{model.successRate.toFixed(2)}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${model.successRate}%`,
                                    backgroundColor: model.color
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-mono text-xs ${model.p95Latency > 1000 ? 'text-rose-600 font-semibold' : 'text-slate-700'}`}>
                              {model.p95Latency.toLocaleString()} ms
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-mono text-xs ${model.errorRate > 0.5 ? 'text-rose-600 font-semibold' : 'text-slate-700'}`}>
                              {model.errorRate.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Latency & Error Trends Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Latency & Error Trends</h3>
                    <p className="text-xs text-slate-500">Real-time telemetry trace over time window</p>
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Updated {lastRefreshed}
                  </span>
                </div>

                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={TREND_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="latencyP95" stroke="#3b82f6" strokeWidth={2} dot={false} name="P95 Latency (ms)" />
                      <Line yAxisId="right" type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2} dot={false} name="Error Rate (%)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Column: Model Signal Map + Cost by Model + Insights */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Model Signal Map */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Model signal map</h3>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-4 pb-3 border-b border-slate-100">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Strong</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Stable</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Watch</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Degraded</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {models.slice(0, 7).map(m => (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 w-24 truncate">{m.name}</span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }}></span>
                      <span className="font-mono text-slate-600 text-[11px] w-12 text-right">{m.successRate.toFixed(2)}%</span>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${m.successRate}%`, backgroundColor: m.color }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost by Model */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Cost by model</h3>
                </div>

                <div className="space-y-3 text-xs">
                  {models.slice(0, 4).map(m => (
                    <div key={m.id} className="flex items-center justify-between pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                      <div>
                        <div className="font-semibold text-slate-900">{m.name}</div>
                        <div className="w-20 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-slate-800 rounded-full" style={{ width: `${(m.costRaw / 6210) * 100}%` }}></div>
                        </div>
                      </div>
                      <span className="font-bold text-slate-900 font-mono">{m.cost}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operational Insights */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl p-5 text-white shadow-xs">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Operational Insights
                </div>
                <ul className="space-y-2 text-xs text-indigo-100">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5"></span>
                    <span>Latency dropped 12% on <strong>embedding-3</strong> following index optimization.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5"></span>
                    <span>Error spike (1.05%) detected on <strong>gpt-4o-mini</strong> due to rate limits.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5"></span>
                    <span>OpenAI providers account for 68% of total monthly spending.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Section: Recent Model Activity */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Recent model activity</h3>
              <span className="text-xs text-slate-400">Deployments, alerts, version changes, and rate limits</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {RECENT_ACTIVITIES.map(act => (
                <div key={act.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${act.status === 'warning' ? 'bg-amber-100 text-amber-700' : act.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {act.type === 'deployment' ? <Box className="w-4 h-4" /> : act.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{act.title}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
