import { useState, useEffect } from 'react';
import api from '../api';
import { formatCurrency, monthLabel } from '../utils/formatters';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, BarChart3 } from 'lucide-react';

const COLORS = ['#3b82f6','#ef4444','#f97316','#eab308','#22c55e','#6366f1','#8b5cf6','#ec4899','#06b6d4','#14b8a6'];

const tabs = [
  { key: 'cashflow', label: 'Fluxo de Caixa' },
  { key: 'category', label: 'Por Categoria' },
  { key: 'compare', label: 'Comparativo Mensal' },
  { key: 'forecast', label: 'Previsão' },
  { key: 'dre', label: 'DRE' },
  { key: 'budget', label: 'Orçamento' },
];

export default function Reports() {
  const [tab, setTab] = useState('cashflow');
  const [trend, setTrend] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [topExpenses, setTopExpenses] = useState([]);
  const [dre, setDre] = useState([]);
  const [budgetData, setBudgetData] = useState([]);

  useEffect(() => {
    api.get('/dashboard/monthly-trend').then(r => setTrend(r.data));
    api.get('/dashboard/expenses-by-category').then(r => setByCategory(r.data));
    api.get('/dashboard/cash-forecast').then(r => setForecast(r.data));
    api.get('/dashboard/top-expenses').then(r => setTopExpenses(r.data));
    api.get('/dashboard/dre').then(r => setDre(r.data));
    api.get('/dashboard/budget-vs-actual').then(r => setBudgetData(r.data));
  }, []);

  const exportCSV = () => {
    let csv = '';
    if (tab === 'cashflow') {
      csv = 'Mês,Pago,Pendente,Total\n' + trend.map(r => `${r.month},${r.paid},${r.pending},${r.total}`).join('\n');
    } else if (tab === 'category') {
      csv = 'Categoria,Total\n' + byCategory.map(r => `${r.name},${r.total}`).join('\n');
    } else if (tab === 'forecast' && forecast) {
      csv = 'Mês,Despesa Estimada,Agendado,Saldo Projetado\n' + forecast.forecast.map(r => `${r.month},${r.estimated_expense},${r.scheduled},${r.projected_balance}`).join('\n');
    } else if (tab === 'dre') {
      csv = 'Mês,Receitas,Despesas,Resultado\n' + dre.map(r => `${r.month},${r.receitas},${r.despesas},${r.resultado}`).join('\n');
    } else if (tab === 'budget') {
      csv = 'Categoria,Orçamento,Realizado,Diferença\n' + budgetData.map(r => `${r.name},${r.budget},${r.actual},${r.budget - r.actual}`).join('\n');
    }
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-${tab}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const fmtTooltip = (value) => formatCurrency(value);
  const fmtMonth = (m) => { const parts = m?.split('-'); return parts ? `${parts[1]}/${parts[0]?.slice(2)}` : m; };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Análise financeira detalhada</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2"><Download className="w-4 h-4" /> Exportar CSV</button>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cashflow' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Fluxo de Caixa — Últimos 6 Meses</h2>
          {trend.length === 0 ? <p className="text-gray-400 py-12 text-center">Sem dados</p> : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={fmtTooltip} labelFormatter={monthLabel} />
                <Legend />
                <Bar dataKey="paid" name="Pago" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="pending" name="Pendente" fill="#eab308" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === 'category' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Despesas por Categoria</h2>
            {byCategory.length === 0 ? <p className="text-gray-400 py-12 text-center">Sem dados</p> : (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie data={byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={120} innerRadius={60} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {byCategory.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={fmtTooltip} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Detalhamento</h2>
            <div className="space-y-3">
              {byCategory.map((cat, i) => {
                const total = byCategory.reduce((s, c) => s + c.total, 0);
                const pct = total > 0 ? (cat.total / total * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || COLORS[i] }} />{cat.name}</span>
                      <span className="font-medium">{formatCurrency(cat.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color || COLORS[i] }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'compare' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Comparativo Mensal</h2>
          {trend.length === 0 ? <p className="text-gray-400 py-12 text-center">Sem dados</p> : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={fmtTooltip} labelFormatter={monthLabel} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="paid" name="Pago" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {trend.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="text-left px-4 py-2">Mês</th><th className="text-right px-4 py-2">Total</th><th className="text-right px-4 py-2">Pago</th><th className="text-right px-4 py-2">Pendente</th></tr></thead>
                <tbody>{trend.map((r, i) => (
                  <tr key={i} className="border-t"><td className="px-4 py-2">{monthLabel(r.month)}</td><td className="px-4 py-2 text-right font-medium">{formatCurrency(r.total)}</td><td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(r.paid)}</td><td className="px-4 py-2 text-right text-amber-600">{formatCurrency(r.pending)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'forecast' && (
        <div className="space-y-6">
          {forecast && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card"><p className="text-sm text-gray-500">Saldo Atual</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(forecast.current_balance)}</p></div>
                <div className="card"><p className="text-sm text-gray-500">Média Mensal de Despesas</p><p className="text-2xl font-bold text-red-600">{formatCurrency(forecast.monthly_average)}</p></div>
              </div>
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Previsão para os Próximos 3 Meses</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={forecast.forecast}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={fmtTooltip} labelFormatter={monthLabel} />
                    <Legend />
                    <Line type="monotone" dataKey="projected_balance" name="Saldo Projetado" stroke="#3b82f6" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 5 }} />
                    <Line type="monotone" dataKey="estimated_expense" name="Despesa Estimada" stroke="#ef4444" strokeWidth={2} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50"><th className="text-left px-4 py-2">Mês</th><th className="text-right px-4 py-2">Despesa Estimada</th><th className="text-right px-4 py-2">Agendado</th><th className="text-right px-4 py-2">Saldo Projetado</th></tr></thead>
                    <tbody>{forecast.forecast.map((r, i) => (
                      <tr key={i} className="border-t"><td className="px-4 py-2">{monthLabel(r.month)}</td><td className="px-4 py-2 text-right text-red-600">{formatCurrency(r.estimated_expense)}</td><td className="px-4 py-2 text-right">{formatCurrency(r.scheduled)}</td><td className={`px-4 py-2 text-right font-bold ${r.projected_balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(r.projected_balance)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {!forecast && <div className="card text-center py-12 text-gray-400">Carregando previsão...</div>}
        </div>
      )}

      {tab === 'dre' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">DRE Simplificado — Últimos 6 Meses</h2>
            {dre.length === 0 ? <p className="text-gray-400 py-12 text-center">Sem dados</p> : (
              <>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={dre}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={fmtTooltip} labelFormatter={m => fmtMonth(m)} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-4 py-2">Mês</th>
                        <th className="text-right px-4 py-2 text-emerald-600">Receitas</th>
                        <th className="text-right px-4 py-2 text-red-600">Despesas</th>
                        <th className="text-right px-4 py-2">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dre.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-2">{fmtMonth(r.month)}</td>
                          <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(r.receitas)}</td>
                          <td className="px-4 py-2 text-right text-red-600">{formatCurrency(r.despesas)}</td>
                          <td className={`px-4 py-2 text-right font-bold ${r.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(r.resultado)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        <td className="px-4 py-2">Total</td>
                        <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(dre.reduce((s, r) => s + r.receitas, 0))}</td>
                        <td className="px-4 py-2 text-right text-red-600">{formatCurrency(dre.reduce((s, r) => s + r.despesas, 0))}</td>
                        <td className={`px-4 py-2 text-right ${dre.reduce((s, r) => s + r.resultado, 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(dre.reduce((s, r) => s + r.resultado, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'budget' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-2">Orçamento vs Realizado — Mês Atual</h2>
            <p className="text-gray-500 text-sm mb-4">Defina orçamentos em Categorias para acompanhar aqui</p>
            {budgetData.length === 0 ? <p className="text-gray-400 py-12 text-center">Nenhuma categoria com orçamento definido</p> : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={budgetData} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                    <Tooltip formatter={fmtTooltip} />
                    <Legend />
                    <Bar dataKey="budget" name="Orçamento" fill="#94a3b8" radius={[0,4,4,0]} />
                    <Bar dataKey="actual" name="Realizado" fill="#3b82f6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-6 space-y-3">
                  {budgetData.map((cat, i) => {
                    const pct = cat.budget > 0 ? Math.min((cat.actual / cat.budget) * 100, 150) : 0;
                    const over = cat.actual > cat.budget && cat.budget > 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}
                          </span>
                          <span className={`font-medium ${over ? 'text-red-600' : 'text-gray-700'}`}>
                            {formatCurrency(cat.actual)} / {formatCurrency(cat.budget)}
                            {cat.budget > 0 && <span className="text-xs ml-1">({pct.toFixed(0)}%)</span>}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
