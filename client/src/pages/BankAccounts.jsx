import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/formatters';
import { Building2, Plus, Edit3, Trash2 } from 'lucide-react';

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ bank_name: '', account_number: '', description: '', balance: '' });

  const load = () => api.get('/bank-accounts').then(r => setAccounts(r.data));
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.bank_name || !form.account_number) return alert('Banco e número da conta são obrigatórios');
    const payload = { ...form, balance: parseFloat(form.balance) || 0 };
    if (editing) { await api.put(`/bank-accounts/${editing.id}`, payload); }
    else { await api.post('/bank-accounts', payload); }
    setShowModal(false); setEditing(null); setForm({ bank_name: '', account_number: '', description: '', balance: '' }); load();
  };

  const handleEdit = (acc) => { setEditing(acc); setForm({ bank_name: acc.bank_name, account_number: acc.account_number, description: acc.description || '', balance: String(acc.balance) }); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta conta bancária?')) return;
    await api.delete(`/bank-accounts/${id}`); load();
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas Bancárias</h1>
          <p className="text-gray-500 text-sm mt-1">Saldo total: <span className={`font-semibold ${totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totalBalance)}</span></p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ bank_name: '', account_number: '', description: '', balance: '' }); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Conta</button>
      </div>

      {accounts.length === 0 ? (
        <div className="card text-center py-12 text-gray-400"><Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhuma conta bancária cadastrada</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="card hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center"><Building2 className="w-6 h-6 text-primary-600" /></div>
                  <div>
                    <h3 className="font-bold text-gray-900">{acc.bank_name}</h3>
                    <p className="text-sm text-gray-500">Conta {acc.account_number}</p>
                  </div>
                </div>
              </div>
              {acc.description && <p className="text-sm text-gray-500 mt-3">{acc.description}</p>}
              <p className={`text-2xl font-bold mt-4 ${acc.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(acc.balance)}</p>
              <div className="flex gap-3 mt-4 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(acc)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editar</button>
                <button onClick={() => handleDelete(acc.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Editar Conta' : 'Nova Conta Bancária'}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label><input type="text" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="input-field" placeholder="Ex: Sicredi, Bradesco, Itaú..." /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Número da Conta *</label><input type="text" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} className="input-field" placeholder="Ex: 12345-6" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Ex: Conta principal" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial (R$)</label><input type="number" step="0.01" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} className="input-field" /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditing(null); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} className="btn-primary flex-1">{editing ? 'Atualizar' : 'Cadastrar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
