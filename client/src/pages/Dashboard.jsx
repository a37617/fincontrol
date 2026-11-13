import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { formatCurrency, formatDate, monthLabel } from '../utils/formatters';
import {
  DollarSign,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Landmark,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  ChevronDown,
  PieChart as PieIcon,
  BarChart3,
  LineChart as LineIcon,
  RefreshCw,
  Database,
  X,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

const TABS = [
  { key: 'operational', label: 'Despesas Operacionais' },
  { key: 'debts', label: 'Dividas' },
  { key: 'investments', label: 'Investimentos' },
  { key: 'taxes', label: 'Impostos' },
  { key: 'all', label: 'Todas' },
];

const PIE_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#6366f1',
];

function KpiCard({ icon: Icon, label, value, color, trend }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  const iconBgMap = {
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBgMap[color] || iconBgMap.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{formatCurrency(value)}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function AlertCard({ bill, variant = 'red' }) {
  const variantMap = {
    red: { bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100', iconText: 'text-red-600', amountText: 'text-red-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconText: 'text-amber-600', amountText: 'text-amber-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', iconText: 'text-blue-600', amountText: 'text-blue-700' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', iconBg: 'bg-slate-100', iconText: 'text-slate-600', amountText: 'text-slate-700' },
  };
  const v = variantMap[variant] || variantMap.red;
  return (
    <div className={`flex items-center gap-3 ${v.bg} border ${v.border} rounded-lg p-3`}>
      <div className={`w-9 h-9 rounded-full ${v.iconBg} flex items-center justify-center shrink-0`}>
        <Clock className={`w-4 h-4 ${v.iconText}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{bill.description}</p>
        <p className="text-xs text-slate-500">{bill.supplier || bill.category}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${v.amountText} whitespace-nowrap`}>{formatCurrency(bill.amount)}</p>
        {bill.due_date && <p className="text-xs text-slate-400">{formatDate(bill.due_date)}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, isCurrency = true }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {isCurrency ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [alerts, setAlerts] = useState({ today: [], tomorrow: [], week: [], overdue: [] });
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [topExpenses, setTopExpenses] = useState([]);
  const [cashForecast, setCashForecast] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [activeTab, setActiveTab] = useState('operational');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [backupDismissed, setBackupDismissed] = useState(false);

  const lastBackup = localStorage.getItem('lastBackupDate');
  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null;
  const showBackupReminder = !backupDismissed && (daysSinceBackup === null || daysSinceBackup >= 7);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [kpiRes, alertRes, catRes, trendRes, topRes, forecastRes] = await Promise.all([
        api.get('/dashboard/kpis'),
        api.get('/dashboard/alerts'),
        api.get('/dashboard/expenses-by-category'),
        api.get('/dashboard/monthly-trend'),
        api.get('/dashboard/top-expenses'),
        api.get('/dashboard/cash-forecast'),
      ]);
      setKpis(kpiRes.data);
      setAlerts(alertRes.data);
      setExpensesByCategory((catRes.data || []).map(c => ({ ...c, value: c.total ?? c.value ?? 0 })));
      setMonthlyTrend(trendRes.data);
      setTopExpenses((topRes.data || []).map(c => ({ ...c, value: c.total ?? c.value ?? 0 })));
      const fc = forecastRes.data;
      setCashForecast(fc.forecast ? fc.forecast.map(f => ({ ...f, forecast: f.projected_balance })) : fc);
    } catch (err) {
      setError('Erro ao carregar dados do dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBreakdown = useCallback(async (type) => {
    if (type === 'all') {
      try {
        const res = await api.get('/dashboard/expenses-by-category');
        setCategoryBreakdown(res.data);
      } catch { /* ignore */ }
      return;
    }
    try {
      const res = await api.get(`/dashboard/category-breakdown?type=${type}`);
      setCategoryBreakdown(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchBreakdown(activeTab);
  }, [activeTab, fetchBreakdown]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-slate-600">{error}</p>
        <button onClick={fetchAll} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Visao geral financeira</p>
        </div>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Backup Reminder */}
      {showBackupReminder && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {daysSinceBackup === null ? 'Voce ainda nao fez nenhum backup!' : `Ultimo backup foi ha ${daysSinceBackup} dias`}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Faca backup regularmente clicando em "Backup" no menu lateral</p>
          </div>
          <button onClick={() => setBackupDismissed(true)} className="p-1 rounded-lg hover:bg-amber-100 text-amber-400 hover:text-amber-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Total Hoje"
          value={kpis?.today_due ?? kpis?.totalToday ?? 0}
          color="blue"
        />
        <KpiCard
          icon={CalendarDays}
          label="Total Semana"
          value={kpis?.week_due ?? kpis?.totalWeek ?? 0}
          color="purple"
        />
        <KpiCard
          icon={CalendarCheck}
          label="Total Mes"
          value={kpis?.month_due ?? kpis?.totalMonth ?? 0}
          color="slate"
        />
        <KpiCard
          icon={Wallet}
          label="Total Pago no Mes"
          value={kpis?.month_paid ?? kpis?.totalPaidMonth ?? 0}
          color="emerald"
        />
        <KpiCard
          icon={Landmark}
          label="Saldo Bancario"
          value={kpis?.bank_balance ?? kpis?.bankBalance ?? 0}
          color="blue"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Contas Atrasadas"
          value={kpis?.overdue_total ?? 0}
          color="red"
        />
        <KpiCard
          icon={TrendingUp}
          label="Entradas do Mes"
          value={kpis?.month_income ?? 0}
          color="emerald"
        />
      </div>

      {/* Alerts */}
      {(alerts.overdue?.length > 0 || alerts.today?.length > 0 || alerts.tomorrow?.length > 0 || alerts.week?.length > 0) && (
        <div className="space-y-3">
          {alerts.overdue?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {alerts.overdue.length} conta(s) atrasada(s) — {formatCurrency(alerts.overdue.reduce((s, b) => s + b.amount, 0))}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {alerts.overdue.map((bill, i) => <AlertCard key={bill.id || i} bill={bill} />)}
              </div>
            </div>
          )}
          {alerts.today?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Vencendo hoje ({alerts.today.length}) — {formatCurrency(alerts.today.reduce((s, b) => s + b.amount, 0))}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {alerts.today.map((bill, i) => <AlertCard key={bill.id || i} bill={bill} />)}
              </div>
            </div>
          )}
          {alerts.tomorrow?.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Vencendo amanha ({alerts.tomorrow.length}) — {formatCurrency(alerts.tomorrow.reduce((s, b) => s + b.amount, 0))}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {alerts.tomorrow.map((bill, i) => <AlertCard key={bill.id || i} bill={bill} />)}
              </div>
            </div>
          )}
          {alerts.week?.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Proximos 7 dias ({alerts.week.length}) — {formatCurrency(alerts.week.reduce((s, b) => s + b.amount, 0))}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {alerts.week.map((bill, i) => <AlertCard key={bill.id || i} bill={bill} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <ChartCard title="Despesas por Categoria" icon={PieIcon}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {expensesByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Monthly Trend */}
        <ChartCard title="Tendencia Mensal (6 meses)" icon={BarChart3}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(v) => {
                    try { return monthLabel(v).split(' ')[0].slice(0, 3); } catch { return v; }
                  }}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="paid" name="Pago" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Top 5 Expenses */}
        <ChartCard title="Top 5 Maiores Gastos" icon={BarChart3}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topExpenses} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Valor" fill="#ef4444" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Cash Forecast */}
        <ChartCard title="Previsao de Caixa (3 meses)" icon={LineIcon}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(v) => {
                    try { return monthLabel(v).split(' ')[0].slice(0, 3); } catch { return v; }
                  }}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Realizado"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#3b82f6' }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Previsao"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  strokeDasharray="8 4"
                  dot={{ r: 4, fill: '#8b5cf6', strokeDasharray: '' }}
                  connectNulls
                />
                <Legend iconType="line" iconSize={14} wrapperStyle={{ fontSize: '12px' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Category Breakdown Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Detalhamento por Tipo</h3>
        <div className="flex flex-wrap gap-2 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {categoryBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nenhum dado disponivel para esta categoria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Categoria</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">Valor</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((item, i) => {
                  const total = categoryBreakdown.reduce((s, r) => s + (r.value || 0), 0);
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="py-3 px-4 text-slate-700 flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        {item.name}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="py-3 px-4 font-semibold text-slate-800">Total</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-800">
                    {formatCurrency(categoryBreakdown.reduce((s, r) => s + (r.value || 0), 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-slate-500">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
