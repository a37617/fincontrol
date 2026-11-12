import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency, formatDate, getStatusLabel, getStatusClass, getDayName, isWeekend } from '../utils/formatters';
import { Search, Filter, Plus, CheckCircle, Trash2, AlertTriangle, Calendar, CalendarClock, ChevronDown, Paperclip, Upload, X, Download, Printer } from 'lucide-react';

export default function BillsList() {
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({});
  const [categories, setCategories] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [period, setPeriod] = useState('month');
  const [status, setStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [payModal, setPayModal] = useState(null);
  const [selectedBank, setSelectedBank] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transferência');
  const [loading, setLoading] = useState(true);
  const [attachModal, setAttachModal] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [newDueDate, setNewDueDate] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/categories'),
      api.get('/bank-accounts'),
      api.get('/bills/summary')
    ]).then(([cats, banks, sum]) => {
      setCategories(cats.data);
      setBankAccounts(banks.data);
      setSummary(sum.data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (period && period !== 'all') params.set('period', period);
    if (status) params.set('status', status);
    if (categoryFilter) params.set('category_id', categoryFilter);
    if (search) params.set('search', search);
    api.get(`/bills?${params}`).then(r => { setBills(r.data); setLoading(false); });
  }, [period, status, categoryFilter, search]);

  const handlePay = async () => {
    await api.post(`/payments/${payModal.id}/pay`, { bank_account_id: selectedBank || null, payment_method: paymentMethod });
    setPayModal(null);
    setSelectedBank('');
    const [billsRes, sumRes] = await Promise.all([
      api.get(`/bills?period=${period}${status ? '&status=' + status : ''}${search ? '&search=' + search : ''}`),
      api.get('/bills/summary')
    ]);
    setBills(billsRes.data);
    setSummary(sumRes.data);
  };

  const openReschedule = (bill) => {
    setPayModal(null);
    setRescheduleModal(bill);
    setNewDueDate(bill.due_date);
  };

  const handleReschedule = async () => {
    if (!newDueDate) return;
    await api.post(`/bills/${rescheduleModal.id}/reschedule`, { new_due_date: newDueDate });
    setRescheduleModal(null);
    const [billsRes, sumRes] = await Promise.all([
      api.get(`/bills?period=${period}${status ? '&status=' + status : ''}${search ? '&search=' + search : ''}`),
      api.get('/bills/summary')
    ]);
    setBills(billsRes.data);
    setSummary(sumRes.data);
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
    await api.delete(`/bills/${id}`);
    setBills(bills.filter(b => b.id !== id));
  };

  const openAttachments = async (bill) => {
    setAttachModal(bill);
    const res = await api.get(`/attachments/bill/${bill.id}`);
    setAttachments(res.data);
  };

  const handleUploadAttachment = async (e) => {
    const file = e.target.files[0];
    if (!file || !attachModal) return;
    if (file.size > 5 * 1024 * 1024) { alert('Arquivo muito grande (máx 5MB)'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      await api.post(`/attachments/bill/${attachModal.id}`, { filename: file.name, content_type: file.type, file_data: reader.result });
      const res = await api.get(`/attachments/bill/${attachModal.id}`);
      setAttachments(res.data);
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteAttachment = async (id) => {
    if (!confirm('Excluir este anexo?')) return;
    await api.delete(`/attachments/${id}`);
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const total = bills.reduce((s, b) => s + b.amount, 0);
  const periods = [
    { key: 'day', label: 'Hoje', value: summary.today },
    { key: 'week', label: 'Semana', value: summary.week },
    { key: 'month', label: 'Mês', value: summary.month },
    { key: 'all', label: 'Todas', value: null },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie suas contas e pagamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/bills/print?period=${period}${status ? '&status=' + status : ''}${categoryFilter ? '&category_id=' + categoryFilter : ''}${search ? '&search=' + encodeURIComponent(search) : ''}`}
            className="btn-secondary flex items-center gap-2"><Printer className="w-4 h-4" /> Imprimir</Link>
          <Link to="/bills/new" className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Conta</Link>
        </div>
      </div>

      {summary.overdue_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">{summary.overdue_count} conta(s) atrasada(s)</p>
            <p className="text-red-600 text-sm">Total em atraso: {formatCurrency(summary.overdue)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-6">
        {periods.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${period === p.key ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'}`}>
            <div>{p.label}</div>
            {p.value != null && <div className="text-xs mt-1 opacity-80">{formatCurrency(p.value)}</div>}
          </button>
        ))}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por descrição ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-field w-auto">
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input-field w-auto">
            <option value="">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="paid">Pagas</option>
            <option value="overdue">Atrasadas</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Vencimento</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Carregando...</td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Nenhuma conta encontrada</td></tr>
            ) : bills.map(bill => {
              const today = new Date().toISOString().split('T')[0];
              const realStatus = bill.status === 'pending' && bill.due_date < today ? 'overdue' : bill.status;
              const rowBg = realStatus === 'overdue' ? 'bg-red-50 hover:bg-red-100/70' : (realStatus !== 'paid' && bill.due_date === today) ? 'bg-amber-50 hover:bg-amber-100/70' : 'hover:bg-gray-50/50';
              return (
                <tr key={bill.id} className={`${rowBg} transition-colors`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(bill.due_date)}
                      <span className={`text-xs ${isWeekend(bill.due_date) ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>{getDayName(bill.due_date)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{bill.description}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {bill.nfe_number && <span className="text-xs text-gray-400">NF {bill.nfe_number}</span>}
                      {bill.installment_number && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">Parcela {bill.installment_number}/{bill.plan_total}</span>}
                      {bill.payment_source === 'boleto' && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">Pegar Boleto</span>}
                      {bill.payment_source === 'dda' && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-600">DDA</span>}
                      {bill.payment_source === 'pix' && <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">PIX</span>}
                      {bill.payment_source === 'debito_auto' && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">Déb. Auto</span>}
                      {bill.is_recurring === 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Fixa</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{bill.supplier || '—'}</td>
                  <td className="px-6 py-4">
                    {bill.category_name ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bill.category_color }} />
                        {bill.category_name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">{formatCurrency(bill.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={getStatusClass(realStatus)}>{getStatusLabel(realStatus)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openAttachments(bill)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg" title="Anexos">
                        <Paperclip className="w-4 h-4" />
                      </button>
                      {realStatus !== 'paid' && (
                        <button onClick={() => setPayModal(bill)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Marcar como pago">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {realStatus !== 'paid' && (
                        <button onClick={() => openReschedule(bill)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Reagendar vencimento">
                          <CalendarClock className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(bill.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {bills.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-500">{bills.length} conta(s)</span>
            <span className="text-sm font-semibold text-gray-900">Total: {formatCurrency(total)}</span>
          </div>
        )}
      </div>

      <Modal isOpen={!!attachModal} onClose={() => { setAttachModal(null); setAttachments([]); }} title={`Anexos — ${attachModal?.description || ''}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="btn-primary flex items-center gap-2 cursor-pointer text-sm">
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Enviar Arquivo'}
              <input type="file" className="hidden" onChange={handleUploadAttachment} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" disabled={uploading} />
            </label>
            <span className="text-xs text-gray-400">PDF, imagens, documentos (máx 5MB)</span>
          </div>
          {attachments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum anexo</p>
          ) : (
            <div className="space-y-2">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{att.filename}</p>
                    <p className="text-xs text-gray-400">{new Date(att.uploaded_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <a href={`/api/attachments/${att.id}/download`} target="_blank" rel="noreferrer" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Baixar">
                    <Download className="w-4 h-4" />
                  </a>
                  <button onClick={() => handleDeleteAttachment(att.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title="Registrar Pagamento">
        {payModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">{payModal.description}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(payModal.amount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária</label>
              <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="input-field">
                <option value="">Dinheiro / Sem conta</option>
                {bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.bank_name} - {ba.account_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field">
                <option>Transferência</option>
                <option>PIX</option>
                <option>Boleto</option>
                <option>Cartão</option>
                <option>Dinheiro</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPayModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handlePay} className="btn-success flex-1">Confirmar Pagamento</button>
            </div>
            <button onClick={() => openReschedule(payModal)} className="w-full flex items-center justify-center gap-2 text-sm text-amber-700 hover:bg-amber-50 rounded-lg py-2 border border-dashed border-amber-300">
              <CalendarClock className="w-4 h-4" /> Não foi paga? Reagendar este vencimento
            </button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!rescheduleModal} onClose={() => setRescheduleModal(null)} title="Reagendar Vencimento">
        {rescheduleModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">{rescheduleModal.description}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(rescheduleModal.amount)}</p>
              <p className="text-xs text-gray-500 mt-1">Vencimento atual: {formatDate(rescheduleModal.due_date)} ({getDayName(rescheduleModal.due_date)})</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova data de vencimento</label>
              <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="input-field" />
              {newDueDate && isWeekend(newDueDate) && (
                <p className="text-xs text-amber-600 mt-1">Atenção: a nova data cai em {getDayName(newDueDate)}.</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setRescheduleModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleReschedule} disabled={!newDueDate || newDueDate === rescheduleModal.due_date} className="btn-primary flex-1 disabled:opacity-50">Reagendar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
