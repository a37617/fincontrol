import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { Save, Plus, ArrowLeft, AlertTriangle, Trash2, Package } from 'lucide-react';
import { adjustWeekend } from '../utils/formatters';

const emptyItem = () => ({ description: '', quantity: 1, unit: 'un', unit_price: '' });

export default function BillForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [form, setForm] = useState({ description: '', supplier: '', amount: '', due_date: '', category_id: '', cost_center_id: '', nfe_number: '', notes: '', paid_at_sight: false, bank_account_id: '', payment_method: 'Transferência', payment_source: '', due_type: 'fixed' });
  const [installments, setInstallments] = useState(1);
  const [installmentDates, setInstallmentDates] = useState([]);
  const [items, setItems] = useState([]);
  const [showItems, setShowItems] = useState(false);
  const [categories, setCategories] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/cost-centers'), api.get('/bank-accounts')]).then(([c, cc, ba]) => {
      setCategories(c.data); setCostCenters(cc.data); setBankAccounts(ba.data);
    });
    if (editId) {
      api.get(`/bills/${editId}`).then(r => setForm({ ...r.data, amount: String(r.data.amount), paid_at_sight: !!r.data.paid_at_sight }));
      api.get(`/bills/${editId}/items`).then(r => {
        if (r.data.length > 0) { setItems(r.data.map(it => ({ description: it.description, quantity: it.quantity, unit: it.unit, unit_price: String(it.unit_price) }))); setShowItems(true); }
      });
    }
  }, [editId]);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const { data } = await api.post('/categories', { name: newCat });
    setCategories([...categories, data]);
    setForm(f => ({ ...f, category_id: data.id }));
    setNewCat(''); setShowNewCat(false);
  };

  const getInstallmentDate = (baseDate, monthOffset) => {
    const [y, m, d] = baseDate.split('-').map(Number);
    const date = new Date(y, m - 1 + monthOffset, d);
    if (date.getDate() !== d) date.setDate(0);
    return date.toISOString().split('T')[0];
  };

  const generateDates = (baseDate, count) => {
    if (!baseDate) return Array(count).fill('');
    return Array.from({ length: count }, (_, i) => getInstallmentDate(baseDate, i));
  };

  useEffect(() => {
    if (installments > 1) {
      setInstallmentDates(prev => {
        const dates = generateDates(form.due_date, installments);
        return dates.map((d, i) => prev[i] || d);
      });
    } else {
      setInstallmentDates([]);
    }
  }, [installments]);

  const handleFirstDateChange = (newDate) => {
    handleChange('due_date', newDate);
    if (installments > 1 && newDate) {
      setInstallmentDates(generateDates(newDate, installments));
    }
  };

  const handleInstallmentDateChange = (index, value) => {
    setInstallmentDates(prev => { const next = [...prev]; next[index] = value; return next; });
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; });
  };
  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (index) => setItems(prev => prev.filter((_, i) => i !== index));

  const itemsTotal = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const saveItems = async (billId) => {
    const validItems = items.filter(it => it.description.trim());
    if (validItems.length > 0) {
      await api.post(`/bills/${billId}/items`, { items: validItems.map(it => ({ ...it, quantity: parseFloat(it.quantity) || 1, unit_price: parseFloat(it.unit_price) || 0 })) });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.due_date) return alert('Preencha os campos obrigatórios');
    setSaving(true);

    const totalAmount = parseFloat(form.amount);
    const numInstallments = Math.max(1, installments);
    const installmentAmount = Math.round((totalAmount / numInstallments) * 100) / 100;

    try {
      if (editId) {
        await api.put(`/bills/${editId}`, { ...form, amount: totalAmount, category_id: form.category_id || null, cost_center_id: form.cost_center_id || null, bank_account_id: form.bank_account_id || null });
        await saveItems(editId);
        setCreatedCount(1);
      } else if (numInstallments === 1) {
        const { data } = await api.post('/bills', { ...form, amount: totalAmount, category_id: form.category_id || null, cost_center_id: form.cost_center_id || null, bank_account_id: form.bank_account_id || null });
        await saveItems(data.id);
        setCreatedCount(1);
      } else {
        const missing = installmentDates.some(d => !d);
        if (missing) { alert('Preencha todas as datas de vencimento'); setSaving(false); return; }
        let created = 0;
        for (let i = 0; i < numInstallments; i++) {
          const desc = `${form.description} - Parcela ${i + 1}/${numInstallments}`;
          const amt = i === numInstallments - 1 ? Math.round((totalAmount - installmentAmount * (numInstallments - 1)) * 100) / 100 : installmentAmount;
          const { data } = await api.post('/bills', {
            ...form, description: desc, amount: amt, due_date: installmentDates[i],
            category_id: form.category_id || null, cost_center_id: form.cost_center_id || null,
            bank_account_id: form.bank_account_id || null, nfe_number: form.nfe_number || null,
          });
          if (i === 0) await saveItems(data.id);
          created++;
        }
        setCreatedCount(created);
      }
      setSuccess(true);
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar'); }
    setSaving(false);
  };

  const resetForm = () => {
    setForm({ description: '', supplier: '', amount: '', due_date: '', category_id: '', cost_center_id: '', nfe_number: '', notes: '', paid_at_sight: false, bank_account_id: '', payment_method: 'Transferência', payment_source: '', due_type: 'fixed' });
    setInstallments(1); setInstallmentDates([]); setItems([]); setShowItems(false);
    setSuccess(false); setCreatedCount(0);
  };

  if (success) return (
    <div className="max-w-lg mx-auto mt-20 text-center">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Save className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {editId ? 'Conta atualizada com sucesso!' : createdCount > 1 ? `${createdCount} parcelas cadastradas com sucesso!` : 'Conta cadastrada com sucesso!'}
      </h2>
      {createdCount > 1 && <p className="text-gray-500 text-sm">As parcelas foram criadas com os vencimentos informados.</p>}
      <div className="flex gap-3 justify-center mt-6">
        <button onClick={resetForm} className="btn-primary">Nova Conta</button>
        <button onClick={() => navigate('/bills')} className="btn-secondary">Ver Lista</button>
      </div>
    </div>
  );

  const totalAmount = parseFloat(form.amount) || 0;
  const numInstallments = Math.max(1, installments);
  const installmentAmount = numInstallments > 1 ? (totalAmount / numInstallments) : 0;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/bills')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{editId ? 'Editar Conta' : 'Nova Conta a Pagar'}</h1>
          <p className="text-gray-500 text-sm mt-1">Preencha os dados da conta</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="card space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
              <input type="text" value={form.description} onChange={e => handleChange('description', e.target.value)} className="input-field" placeholder="Ex: Compra de materiais" required />
              {installments > 1 && form.description && (
                <p className="text-xs text-gray-400 mt-1">Será salva como: "{form.description} - Parcela 1/{installments}" ... "{form.description} - Parcela {installments}/{installments}"</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
              <input type="text" value={form.supplier} onChange={e => handleChange('supplier', e.target.value)} className="input-field" placeholder="Nome do fornecedor" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{installments > 1 ? 'Valor Total (R$) *' : 'Valor (R$) *'}</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => handleChange('amount', e.target.value)} className="input-field" placeholder="0,00" required />
              {installments > 1 && totalAmount > 0 && (
                <p className="text-xs text-blue-600 mt-1 font-medium">Valor por parcela: R$ {installmentAmount.toFixed(2).replace('.', ',')}</p>
              )}
            </div>

            {!editId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                <select value={installments} onChange={e => {
                  const n = parseInt(e.target.value);
                  setInstallments(n);
                  if (n > 1 && form.due_date) { setInstallmentDates(generateDates(form.due_date, n)); }
                  else { setInstallmentDates([]); }
                }} className="input-field">
                  <option value={1}>À vista (1x)</option>
                  {[2,3,4,5,6,7,8,9,10,12,15,18,24,36,48,60].map(n => (
                    <option key={n} value={n}>{n}x</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {installments > 1 ? 'Vencimento 1ª Parcela *' : 'Data de Vencimento *'}
              </label>
              {form.due_type === 'last_business_day' ? (
                <input type="month" value={form.due_date?.slice(0, 7) || ''} onChange={e => {
                  if (e.target.value) {
                    const [y, m] = e.target.value.split('-').map(Number);
                    const lastDay = new Date(y, m, 0).getDate();
                    const date = new Date(y, m - 1, lastDay);
                    while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
                    handleFirstDateChange(date.toISOString().split('T')[0]);
                  }
                }} className="input-field" required />
              ) : (
                <input type="date" value={form.due_date} onChange={e => handleFirstDateChange(e.target.value)} className="input-field" required />
              )}
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                <input type="checkbox" checked={form.due_type === 'last_business_day'} onChange={e => {
                  const newType = e.target.checked ? 'last_business_day' : 'fixed';
                  handleChange('due_type', newType);
                  if (newType === 'last_business_day' && form.due_date) {
                    const [y, m] = form.due_date.split('-').map(Number);
                    const lastDay = new Date(y, m, 0).getDate();
                    const date = new Date(y, m - 1, lastDay);
                    while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
                    handleFirstDateChange(date.toISOString().split('T')[0]);
                  }
                }} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                <span className="text-xs text-gray-500">Último dia útil do mês</span>
              </label>
              {form.due_date && form.due_type !== 'last_business_day' && installments <= 1 && (() => {
                const info = adjustWeekend(form.due_date);
                if (info.adjusted) return (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Cai em {info.dayName}.</span>
                    <button type="button" onClick={() => handleChange('due_date', info.date)} className="underline font-medium">Mover para {info.newDay}?</button>
                  </div>
                );
                return null;
              })()}
            </div>
          </div>

          {installments > 1 && (
            <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">Vencimentos das Parcelas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {installmentDates.map((date, i) => (
                  <div key={i}>
                    <label className="block text-xs font-medium text-blue-700 mb-1">Parcela {i + 1}/{installments}</label>
                    <input type="date" value={date} onChange={e => handleInstallmentDateChange(i, e.target.value)}
                      className="w-full text-sm px-2.5 py-1.5 border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400" required />
                    {totalAmount > 0 && (
                      <span className="text-xs text-blue-500">
                        R$ {(i === installments - 1 ? Math.round((totalAmount - installmentAmount * (installments - 1)) * 100) / 100 : installmentAmount).toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itens / Produtos */}
          <div className="border-t pt-4">
            <button type="button" onClick={() => { setShowItems(!showItems); if (!showItems && items.length === 0) addItem(); }}
              className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700">
              <Package className="w-4 h-4" />
              {showItems ? 'Ocultar itens da compra' : 'Adicionar itens / produtos (opcional)'}
            </button>

            {showItems && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-[1fr_80px_60px_100px_32px] gap-2 text-xs font-medium text-gray-500 px-1">
                  <span>Produto / Descrição</span>
                  <span>Qtd</span>
                  <span>Un</span>
                  <span>Valor Unit.</span>
                  <span></span>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_60px_100px_32px] gap-2 items-center">
                    <input type="text" value={item.description} onChange={e => handleItemChange(i, 'description', e.target.value)}
                      className="input-field text-sm" placeholder="Ex: Rolamento 6205" />
                    <input type="number" step="0.01" min="0" value={item.quantity} onChange={e => handleItemChange(i, 'quantity', e.target.value)}
                      className="input-field text-sm text-center" />
                    <select value={item.unit} onChange={e => handleItemChange(i, 'unit', e.target.value)} className="input-field text-sm px-1">
                      <option value="un">un</option>
                      <option value="kg">kg</option>
                      <option value="m">m</option>
                      <option value="lt">lt</option>
                      <option value="cx">cx</option>
                      <option value="pc">pç</option>
                      <option value="jg">jg</option>
                      <option value="hr">hr</option>
                    </select>
                    <input type="number" step="0.01" min="0" value={item.unit_price} onChange={e => handleItemChange(i, 'unit_price', e.target.value)}
                      className="input-field text-sm" placeholder="0,00" />
                    <button type="button" onClick={() => removeItem(i)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                    <Plus className="w-4 h-4" /> Adicionar item
                  </button>
                  {itemsTotal > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">Total itens: <strong className="text-gray-800">R$ {itemsTotal.toFixed(2).replace('.', ',')}</strong></span>
                      {!form.amount && (
                        <button type="button" onClick={() => handleChange('amount', itemsTotal.toFixed(2))}
                          className="text-xs text-primary-600 underline hover:text-primary-700">Usar como valor da conta</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              {showNewCat ? (
                <div className="flex gap-2">
                  <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} className="input-field" placeholder="Nome da categoria" autoFocus />
                  <button type="button" onClick={addCategory} className="btn-primary whitespace-nowrap">Criar</button>
                  <button type="button" onClick={() => setShowNewCat(false)} className="btn-secondary">X</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select value={form.category_id} onChange={e => handleChange('category_id', e.target.value)} className="input-field flex-1">
                    <option value="">Selecione</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewCat(true)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg" title="Nova categoria"><Plus className="w-5 h-5" /></button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custos</label>
              <select value={form.cost_center_id} onChange={e => handleChange('cost_center_id', e.target.value)} className="input-field">
                <option value="">Nenhum</option>
                {costCenters.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número NF-e</label>
              <input type="text" value={form.nfe_number} onChange={e => handleChange('nfe_number', e.target.value)} className="input-field" placeholder="Opcional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Como pagar</label>
              <select value={form.payment_source} onChange={e => handleChange('payment_source', e.target.value)} className="input-field">
                <option value="">Selecione</option>
                <option value="boleto">Pegar Boleto</option>
                <option value="dda">DDA (Débito Direto)</option>
                <option value="pix">PIX</option>
                <option value="debito_auto">Débito Automático</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} className="input-field" rows={3} placeholder="Anotações opcionais..." />
          </div>

          <div className="border-t pt-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.paid_at_sight} onChange={e => handleChange('paid_at_sight', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="font-medium text-gray-700">Pago à vista</span>
            </label>
            {form.paid_at_sight && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 pl-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária *</label>
                  <select value={form.bank_account_id} onChange={e => handleChange('bank_account_id', e.target.value)} className="input-field" required={form.paid_at_sight}>
                    <option value="">Selecione</option>
                    {bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.bank_name} - {ba.account_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                  <select value={form.payment_method} onChange={e => handleChange('payment_method', e.target.value)} className="input-field">
                    <option>Transferência</option><option>PIX</option><option>Boleto</option><option>Cartão</option><option>Dinheiro</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Salvando...' : editId ? 'Atualizar' : installments > 1 ? `Cadastrar ${installments} Parcelas` : 'Cadastrar Conta'}
            </button>
            <button type="button" onClick={() => navigate('/bills')} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      </form>
    </div>
  );
}
