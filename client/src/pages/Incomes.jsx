import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { DollarSign, Plus, Search, CheckCircle, Trash2, Calendar, TrendingUp } from 'lucide-react';

export default function Incomes() {
  const [incomes, setIncomes] = useState([]);
  const [summary, setSummary] = useState({});
  const [bankAccounts, setBankAccounts] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [period, setPeriod] = useState('month');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [receiveModal, setReceiveModal] = useState(null);
  const [selectedBank, setSelectedBank] = useState('');
  const [form, setForm] = useState({ description: '', source: '', amount: '', date: '', category: 'Outros', bank_account_id: '', notes: '', status: 'received' });

  const load = () => {
    const params = new URLSearchParams();
    if (period && period !== 'all') params.set('period', period);
    if (search) params.set('search', search);
    if (catFilter) params.set('category', catFilter);
    api.get(`/incomes?${params}`).then(r => setIncomes(r.data));
    api.get('/incomes/summary').then(r => setSummary(r.data));
  };

  useEffect(() => {
    api.get('/bank-accounts').then(r => setBankAccounts(r.data));
    api.get('/incomes/categories').then(r => setIncomeCategories(r.data));
  }, []);
  useEffect(() => { load(); }, [period, search, catFilter]);

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) return alert('Preencha os campos obrigatórios');
    if (form.status === 'received' && !form.bank_account_id) return alert('Selecione a conta bancária para entradas já recebidas');
    await api.post('/incomes', { ...form, amount: parseFloat(form.amount) });
    setShowModal(false);
    setForm({ description: '', source: '', amount: '', date: '', category: 'Outros', bank_account_id: '', notes: '', status: 'received' });
    load();
  };

  const handleReceive = async () => {
    if (!selectedBank) return;
    await api.post(`/incomes/${receiveModal.id}/receive`, { bank_account_id: selectedBank });
    setReceiveModal(null); setSelectedBank(''); load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta entrada? O saldo da conta será estornado.')) return;
    await api.delete(`/incomes/${id}`); load();
  };

  const total = incomes.reduce((s, i) => s + i.amount, 0);
  const periods = [
    { key: 'day', label: 'Hoje', value: summary.today },
    { key: 'month', label: 'Mês', value: summary.month },
    { key: 'all', label: 'Todas', value: null },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entradas</h1>
          <p className="text-gray-500 text-sm mt-1">Receitas e valores recebidos</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Entrada</button>
      </div>

      {summary.pending_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-amber-800 font-medium">{summary.pending_count} entrada(s) prevista(s)</p>
            <p className="text-amber-600 text-sm">Total previsto: {formatCurrency(summary.pending)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-6">
        {periods.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${period === p.key ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'}`}>
            <div>{p.label}</div>
            {p.value != null && <div className="text-xs mt-1 opacity-80">{formatCurrency(p.value)}</div>}
          </button>
        ))}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por descrição ou origem..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-field w-auto">
            <option value="">Todas as categorias</option>
            {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Origem</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Conta</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {incomes.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">Nenhuma entrada encontrada</td></tr>
            ) : incomes.map(inc => (
              <tr key={inc.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-gray-400" />{formatDate(inc.date)}</div>
                </td>
                <td className="px-6 py-4"><p className="text-sm font-medium text-gray-900">{inc.description}</p></td>
                <td className="px-6 py-4 text-sm text-gray-600">{inc.source || '—'}</td>
                <td className="px-6 py-4"><span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{inc.category}</span></td>
                <td className="px-6 py-4 text-sm text-gray-600">{inc.bank_name || '—'}</td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-600">{formatCurrency(inc.amount)}</td>
                <td className="px-6 py-4 text-center">
                  {inc.status === 'received' ? (
                    <span className="badge-paid">Recebido</span>
                  ) : (
                    <span className="badge-pending">Previsto</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {inc.status === 'expected' && (
                      <button onClick={() => { setReceiveModal(inc); setSelectedBank(''); }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Marcar como recebido">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(inc.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incomes.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-500">{incomes.length} entrada(s)</span>
            <span className="text-sm font-semibold text-emerald-600">Total: {formatCurrency(total)}</span>
          </div>
        )}
      </div>

      {/* Nova Entrada */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Entrada" size="lg">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Ex: Venda de produto, Pagamento cliente X" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Origem / Cliente</label><input type="text" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="input-field" placeholder="De quem veio" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label><input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Data *</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field">
                {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, status: 'received' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.status === 'received' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>Já Recebido</button>
              <button type="button" onClick={() => setForm({ ...form, status: 'expected' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.status === 'expected' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>Previsto</button>
            </div>
          </div>
          {form.status === 'received' && (
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária *</label>
              <select value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })} className="input-field">
                <option value="">Selecione a conta</option>
                {bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.bank_name} - {ba.account_number}</option>)}
              </select>
            </div>
          )}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Observações</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" rows={2} /></div>
          <div className="flex gap-3 pt-2"><button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={handleSave} className="btn-primary flex-1">Registrar Entrada</button></div>
        </div>
      </Modal>

      {/* Receber */}
      <Modal isOpen={!!receiveModal} onClose={() => setReceiveModal(null)} title="Confirmar Recebimento">
        {receiveModal && (
          <div className="space-y-4">
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">{receiveModal.description}</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(receiveModal.amount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Em qual conta entrou? *</label>
              <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="input-field">
                <option value="">Selecione a conta</option>
                {bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.bank_name} - {ba.account_number}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2"><button onClick={() => setReceiveModal(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={handleReceive} disabled={!selectedBank} className="btn-success flex-1">Confirmar Recebimento</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
