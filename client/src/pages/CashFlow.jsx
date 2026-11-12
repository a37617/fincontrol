import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
} from 'recharts';

const PERIOD_OPTIONS = [
  { days: 30, label: '30 dias' },
  { days: 60, label: '60 dias' },
  { days: 90, label: '90 dias' },
];

function KpiCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
  };
  const iconBgMap = {
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
  };
  const isNegative = value < 0;

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBgMap[color] || iconBgMap.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-slate-800'}`}>
        {formatCurrency(value)}
      </p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

function getWeekKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const jan1 = new Date(y, 0, 1);
  const diffDays = Math.floor((date - jan1) / 86400000);
  const weekNum = Math.ceil((diffDays + jan1.getDay() + 1) / 7);
  return `${y}-S${String(weekNum).padStart(2, '0')}`;
}

function groupByWeek(rows) {
  const weeks = [];
  let currentWeek = null;

  for (const row of rows) {
    const wk = getWeekKey(row.date);
    if (!currentWeek || currentWeek.key !== wk) {
      currentWeek = { key: wk, rows: [], totalExpenses: 0, totalIncomes: 0 };
      weeks.push(currentWeek);
    }
    currentWeek.rows.push(row);
    currentWeek.totalExpenses += row.expenses || 0;
    currentWeek.totalIncomes += row.incomes || 0;
  }

  return weeks;
}

export default function CashFlow() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/dashboard/cashflow-daily?days=90');
      setData(res.data);
    } catch {
      setError('Erro ao carregar dados do fluxo de caixa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDaily = useMemo(() => {
    if (!data?.daily) return [];
    return data.daily.slice(0, period);
  }, [data, period]);

  const kpis = useMemo(() => {
    if (!filteredDaily.length) return { current: 0, expenses: 0, incomes: 0, projected: 0 };
    const totalExpenses = filteredDaily.reduce((sum, d) => sum + (d.expenses || 0), 0);
    const totalIncomes = filteredDaily.reduce((sum, d) => sum + (d.incomes || 0), 0);
    const lastBalance = filteredDaily[filteredDaily.length - 1]?.balance ?? 0;
    return {
      current: data?.initial_balance ?? 0,
      expenses: totalExpenses,
      incomes: totalIncomes,
      projected: lastBalance,
    };
  }, [filteredDaily, data]);

  const chartData = useMemo(() => {
    return filteredDaily.map((d) => ({
      ...d,
      dateLabel: formatDate(d.date),
    }));
  }, [filteredDaily]);

  const weeks = useMemo(() => groupByWeek(filteredDaily), [filteredDaily]);

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
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
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
          <h1 className="text-2xl font-bold text-slate-800">Fluxo de Caixa Projetado</h1>
          <p className="text-sm text-slate-500">Projecao de entradas, saidas e saldo diario</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setPeriod(opt.days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                period === opt.days
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Saldo Atual"
          value={kpis.current}
          color="blue"
        />
        <KpiCard
          icon={ArrowDownCircle}
          label={`Total de Saidas no periodo`}
          value={kpis.expenses}
          color="red"
        />
        <KpiCard
          icon={ArrowUpCircle}
          label={`Total de Entradas no periodo`}
          value={kpis.incomes}
          color="emerald"
        />
        <KpiCard
          icon={kpis.projected >= 0 ? TrendingUp : TrendingDown}
          label="Saldo Projetado Final"
          value={kpis.projected}
          color={kpis.projected >= 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Evolucao Diaria</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(Math.floor(chartData.length / 10) - 1, 0)}
              />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="expenses" name="Saidas" fill="#ef4444" barSize={8} radius={[2, 2, 0, 0]} stackId="stack" />
              <Bar dataKey="incomes" name="Entradas" fill="#10b981" barSize={8} radius={[2, 2, 0, 0]} stackId="stack" />
              <Area
                type="monotone"
                dataKey="balance"
                name="Saldo"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.08}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table grouped by week */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Detalhamento Semanal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-slate-500 font-medium">Data</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium">Saidas</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium">Entradas</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <React.Fragment key={week.key}>
                  {week.rows.map((row, idx) => (
                    <tr
                      key={row.date}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition ${
                        idx === 0 ? 'border-t border-slate-200' : ''
                      }`}
                    >
                      <td className="py-2 px-4 text-slate-700">{formatDate(row.date)}</td>
                      <td className="py-2 px-4 text-right text-red-600 font-medium">
                        {row.expenses ? formatCurrency(row.expenses) : '-'}
                      </td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-medium">
                        {row.incomes ? formatCurrency(row.incomes) : '-'}
                      </td>
                      <td className={`py-2 px-4 text-right font-medium ${
                        row.balance < 0 ? 'text-red-600' : 'text-slate-800'
                      }`}>
                        {formatCurrency(row.balance)}
                      </td>
                    </tr>
                  ))}
                  {/* Week subtotal */}
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <td className="py-2 px-4 font-semibold text-slate-600">
                      Subtotal {week.key}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-red-700">
                      {formatCurrency(week.totalExpenses)}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-emerald-700">
                      {formatCurrency(week.totalIncomes)}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-slate-700">
                      {formatCurrency(week.rows[week.rows.length - 1]?.balance ?? 0)}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
