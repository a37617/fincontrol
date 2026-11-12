import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ListChecks, Plus, Eye, CheckCircle, XCircle, Archive, Trash2, Edit3, Save } from 'lucide-react';

export default function Installments() {
  const [plans, setPlans] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [selectedBank, setSelectedBank] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transferência');
  const [editingBill, setEditingBill] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [form, setForm] = useState({ description: '', creditor: '', total_amount: '', total_installments: '', first_due_date: '', first_installment_date: '', entry_amount: '', entry_installments: '1', category_id: '', notes: '', due_type: 'fixed', entry_due_type: 'fixed' });

  const load = () => api.get('/installments').then(r => setPlans(r.data));
  useEffect(() => { load(); api.get('/categories').then(r => setCategories(r.data)); api.get('/bank-accounts').then(r => setBankAccounts(r.data)); }, []);

  const loadDetail = async (id) => {
    const { data } = await api.get(`/installments/${id}`);
    setDetail(data);
  };

  const calc = () => {
    const total = parseFloat(form.total_amount) || 0;
    const entry = parseFloat(form.entry_amount) || 0;
    const entryN = parseInt(form.entry_installments) || 1;
    const n = parseInt(form.total_installments) || 0;
    if (n <= 0 || total <= 0) return { parcelaValue: 0, entryPerParcel: 0 };
    return {
      parcelaValue: (total - entry) / n,
      entryPerParcel: entry > 0 ? entry / entryN : 0
    };
  };

  const handleCreate = async () => {
    if (!form.description || !form.total_amount || !form.total_installments || !form.first_due_date) return alert('Preencha os campos obrigatórios');
    const entry = parseFloat(form.entry_amount) || 0;
    if (entry > 0 && !form.first_installment_date) return alert('Informe a data de vencimento da 1ª parcela');
    const total = parseFloat(form.total_amount) || 0;
    if (entry >= total) return alert('A entrada deve ser menor que o valor total');
    await api.post('/installments', {
      ...form,
      total_amount: total,
      total_installments: parseInt(form.total_installments),
      entry_amount: entry > 0 ? entry : null,
      entry_installments: entry > 0 ? (parseInt(form.entry_installments) || 1) : null,
      first_installment_date: entry > 0 && form.first_installment_date ? form.first_installment_date : null,
      due_type: form.due_type,
      entry_due_type: entry > 0 ? form.entry_due_type : null,
      category_id: form.category_id || null
    });
    setShowCreate(false);
    setForm({ description: '', creditor: '', total_amount: '', total_installments: '', first_due_date: '', first_installment_date: '', entry_amount: '', entry_installments: '1', category_id: '', notes: '', due_type: 'fixed', entry_due_type: 'fixed' });
    load();
  };

  const handleSettle = async (id) => {
    if (!confirm('Marcar parcelamento como extinto/quitado?')) return;
    await api.put(`/installments/${id}`, { status: 'settled' });
    load(); if (detail && detail.id === id) loadDetail(id);
  };

  const handleReactivate = async (id) => {
    await api.put(`/installments/${id}`, { status: 'active' });
    load(); if (detail && detail.id === id) loadDetail(id);
  };

  const handlePayBill = async () => {
    if (!selectedBank) return;
    await api.post(`/payments/${payModal.id}/pay`, { bank_account_id: selectedBank, payment_method: paymentMethod });
    setPayModal(null); setSelectedBank('');
    if (detail) loadDetail(detail.id);
    load();
  };

  const startEditBill = (bill) => {
    setEditingBill(bill.id);
    setEditDate(bill.due_date);
    setEditAmount(bill.amount.toString());
  };

  const saveEditBill = async (planId, billId) => {
    await api.put(`/installments/${planId}/bills/${billId}`, { due_date: editDate, amount: parseFloat(editAmount) });
    setEditingBill(null);
    loadDetail(planId);
    load();
  };

  const handleDelete = async (id) => {
    const choice = confirm('Excluir PERMANENTEMENTE este parcelamento e TODAS as parcelas (inclusive pagas)?');
    if (!choice) return;
    await api.delete(`/installments/${id}?force=true`);
    setDetail(null); load();
  };

  const { parcelaValue, entryPerParcel } = calc();
  const hasEntry = (parseFloat(form.entry_amount) || 0) > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parcelamentos</h1>
          <p className="text-gray-500 text-sm mt-1">Controle de IPTU, PGFN, negociações e parcelas</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Parcelamento</button>
      </div>

      {plans.length === 0 ? (
        <div className="card text-center py-12 text-gray-400"><ListChecks className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum parcelamento cadastrado</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(p => {
            const pct = p.total_bills > 0 ? (p.paid_bills / p.total_bills) * 100 : 0;
            const isSettled = p.status === 'settled';
            const parcelaVal = p.next_bill_amount || 0;
            return (
              <div key={p.id} className={`card hover:shadow-md transition-shadow ${isSettled ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.description}</h3>
                    {p.creditor && <p className="text-sm text-gray-500">{p.creditor}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isSettled ? 'bg-gray-100 text-gray-500' : pct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {isSettled ? 'Extinto' : pct === 100 ? 'Quitado' : 'Ativo'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-xs text-gray-500">Próxima Parcela</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(parcelaVal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-semibold text-gray-600">{formatCurrency(p.total_amount)}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{p.paid_bills} de {p.total_bills} parcelas pagas</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex gap-2 mt-2 text-xs text-gray-500">
                  <span>Pago: {formatCurrency(p.paid_amount)}</span>
                  <span>|</span>
                  <span>Restante: {formatCurrency(p.remaining_amount)}</span>
                </div>

                {p.category_name && (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.category_color }} />
                    {p.category_name}
                  </span>
                )}

                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <button onClick={() => loadDetail(p.id)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Eye className="w-3 h-3" /> Detalhes</button>
                  {!isSettled && <button onClick={() => handleSettle(p.id)} className="text-xs text-gray-500 hover:underline flex items-center gap-1"><Archive className="w-3 h-3" /> Extinguir</button>}
                  {isSettled && <button onClick={() => handleReactivate(p.id)} className="text-xs text-emerald-600 hover:underline flex items-center gap-1"><Archive className="w-3 h-3" /> Reativar</button>}
                  <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1 ml-auto"><Trash2 className="w-3 h-3" /> Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail?.description || ''} size="lg">
        {detail && (
          <div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600">Total</p><p className="font-bold text-sm">{formatCurrency(detail.total_amount)}</p></div>
              <div className="bg-emerald-50 p-3 rounded-lg"><p className="text-xs text-emerald-600">Pago</p><p className="font-bold text-sm">{formatCurrency(detail.bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0))}</p></div>
              <div className="bg-amber-50 p-3 rounded-lg"><p className="text-xs text-amber-600">Restante</p><p className="font-bold text-sm">{formatCurrency(detail.bills.filter(b => b.status !== 'paid').reduce((s, b) => s + b.amount, 0))}</p></div>
              <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-600">Parcelas</p><p className="font-bold text-sm">{detail.paid_count}/{detail.bills.length}</p></div>
            </div>
            {detail.notes && <p className="text-sm text-gray-500 mb-4 bg-gray-50 p-3 rounded-lg">{detail.notes}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Vencimento</th><th className="text-right px-3 py-2">Valor</th><th className="text-center px-3 py-2">Status</th><th className="text-right px-3 py-2">Ação</th></tr></thead>
                <tbody>{detail.bills.map(bill => {
                  const realStatus = bill.status === 'pending' && bill.due_date < new Date().toISOString().split('T')[0] ? 'overdue' : bill.status;
                  const isEntry = bill.installment_number === 0;
                  return (
                    <tr key={bill.id} className={`border-t ${realStatus === 'overdue' ? 'bg-red-50/50' : isEntry ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-3 py-2 font-medium">
                        {isEntry ? <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Entrada</span> : bill.installment_number}
                      </td>
                      <td className="px-3 py-2">
                        {editingBill === bill.id ? (
                          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="input-field text-sm py-1 px-2" />
                        ) : formatDate(bill.due_date)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {editingBill === bill.id ? (
                          <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="input-field text-sm py-1 px-2 w-28 text-right" />
                        ) : formatCurrency(bill.amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {realStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Pago</span>
                        ) : realStatus === 'overdue' ? (
                          <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="w-3.5 h-3.5" /> Atrasado</span>
                        ) : (
                          <span className="text-amber-600">Pendente</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right flex items-center justify-end gap-2">
                        {editingBill === bill.id ? (
                          <>
                            <button onClick={() => saveEditBill(detail.id, bill.id)} className="text-xs text-emerald-600 hover:underline flex items-center gap-1"><Save className="w-3 h-3" /> Salvar</button>
                            <button onClick={() => setEditingBill(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                          </>
                        ) : (
                          <>
                            {realStatus !== 'paid' && (
                              <>
                                <button onClick={() => startEditBill(bill)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editar</button>
                                <button onClick={() => { setPayModal(bill); setSelectedBank(''); }} className="text-xs text-emerald-600 hover:underline">Pagar</button>
                              </>
                            )}
                            {realStatus === 'paid' && bill.bank_name && (
                              <span className="text-xs text-gray-400">{bill.bank_name}</span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Novo Parcelamento" size="lg">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Ex: IPTU 2026, PGFN Negociação" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Credor</label><input type="text" value={form.creditor} onChange={e => setForm({ ...form, creditor: e.target.value })} className="input-field" placeholder="Ex: Prefeitura, Receita Federal" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="input-field">
                <option value="">Selecione</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor Total (R$) *</label><input type="number" step="0.01" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nº de Parcelas *</label><input type="number" min="1" value={form.total_installments} onChange={e => setForm({ ...form, total_installments: e.target.value })} className="input-field" placeholder="Ex: 24" /></div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Entrada (opcional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 mb-1">Valor da Entrada (R$)</label><input type="number" step="0.01" value={form.entry_amount} onChange={e => setForm({ ...form, entry_amount: e.target.value })} className="input-field" placeholder="0,00" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Parcelas da Entrada</label><input type="number" min="1" value={form.entry_installments} onChange={e => setForm({ ...form, entry_installments: e.target.value })} className="input-field" placeholder="1" disabled={!hasEntry} /></div>
            </div>
            {hasEntry && entryPerParcel > 0 && (
              <p className="text-xs text-indigo-600 mt-2">
                Entrada: {parseInt(form.entry_installments) || 1}x de {formatCurrency(entryPerParcel)}
              </p>
            )}
          </div>

          {parcelaValue > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className={`grid ${hasEntry ? 'grid-cols-3' : 'grid-cols-2'} gap-4 text-center`}>
                {hasEntry && (
                  <div>
                    <p className="text-xs text-indigo-600">Entrada</p>
                    <p className="text-lg font-bold text-indigo-700">{formatCurrency(entryPerParcel)}</p>
                    <p className="text-xs text-indigo-500">{parseInt(form.entry_installments) || 1}x</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-indigo-600">Valor da Parcela</p>
                  <p className="text-lg font-bold text-indigo-700">{formatCurrency(parcelaValue)}</p>
                  <p className="text-xs text-indigo-500">{form.total_installments}x</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600">Total</p>
                  <p className="text-lg font-bold text-indigo-700">{formatCurrency(parseFloat(form.total_amount))}</p>
                  <p className="text-xs text-indigo-500">
                    {hasEntry
                      ? `${parseInt(form.entry_installments) || 1}x entrada + ${form.total_installments}x parcela`
                      : `${form.total_installments} parcelas`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasEntry ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento da 1ª Entrada *</label>
                  <input type={form.entry_due_type === 'last_business_day' ? 'month' : 'date'} value={form.entry_due_type === 'last_business_day' && form.first_due_date ? form.first_due_date.substring(0, 7) : form.first_due_date} onChange={e => setForm({ ...form, first_due_date: form.entry_due_type === 'last_business_day' ? e.target.value + '-01' : e.target.value })} className="input-field" />
                  <label className="flex items-center gap-2 mt-1 cursor-pointer">
                    <input type="checkbox" checked={form.entry_due_type === 'last_business_day'} onChange={e => setForm({ ...form, entry_due_type: e.target.checked ? 'last_business_day' : 'fixed' })} className="rounded" />
                    <span className="text-xs text-gray-500">Último dia útil do mês</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento da 1ª Parcela *</label>
                  <input type={form.due_type === 'last_business_day' ? 'month' : 'date'} value={form.due_type === 'last_business_day' && form.first_installment_date ? form.first_installment_date.substring(0, 7) : form.first_installment_date} onChange={e => setForm({ ...form, first_installment_date: form.due_type === 'last_business_day' ? e.target.value + '-01' : e.target.value })} className="input-field" />
                  <label className="flex items-center gap-2 mt-1 cursor-pointer">
                    <input type="checkbox" checked={form.due_type === 'last_business_day'} onChange={e => setForm({ ...form, due_type: e.target.checked ? 'last_business_day' : 'fixed' })} className="rounded" />
                    <span className="text-xs text-gray-500">Último dia útil do mês</span>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">1º Vencimento *</label>
              <input type={form.due_type === 'last_business_day' ? 'month' : 'date'} value={form.due_type === 'last_business_day' && form.first_due_date ? form.first_due_date.substring(0, 7) : form.first_due_date} onChange={e => setForm({ ...form, first_due_date: form.due_type === 'last_business_day' ? e.target.value + '-01' : e.target.value })} className="input-field" />
              <label className="flex items-center gap-2 mt-1 cursor-pointer">
                <input type="checkbox" checked={form.due_type === 'last_business_day'} onChange={e => setForm({ ...form, due_type: e.target.checked ? 'last_business_day' : 'fixed' })} className="rounded" />
                <span className="text-xs text-gray-500">Último dia útil do mês</span>
              </label>
            </div>
          )}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Observações</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" rows={2} placeholder="Ex: Negociação feita em 01/2026, juros de 1% ao mês..." /></div>
          <div className="flex gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={handleCreate} className="btn-primary flex-1">Criar Parcelamento</button></div>
        </div>
      </Modal>

      {/* Pay Modal */}
      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title="Pagar Parcela">
        {payModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">{payModal.description}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(payModal.amount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária *</label>
              <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="input-field">
                <option value="">Selecione</option>
                {bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.bank_name} - {ba.account_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field">
                <option>Transferência</option><option>PIX</option><option>Boleto</option><option>Cartão</option><option>Dinheiro</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2"><button onClick={() => setPayModal(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={handlePayBill} disabled={!selectedBank} className="btn-success flex-1">Confirmar Pagamento</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
