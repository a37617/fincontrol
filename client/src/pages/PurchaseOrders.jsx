import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/formatters';
import { ClipboardList, Plus, Trash2, FileDown, Send, Eye, Pencil, Settings, ChevronLeft, Package, Upload, X, History, Copy } from 'lucide-react';

const emptyItem = { description: '', quantity: 1, unit: 'un', unit_price: 0, ipi_percent: 0 };

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [view, setView] = useState('list');
  const [current, setCurrent] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [company, setCompany] = useState({ name: '', trade_name: '', cnpj: '', ie: '', phone: '', email: '', address: '', city: '', state: '', zip: '', nfe_email: '' });
  const [priceHistory, setPriceHistory] = useState({});
  const [showPriceHistory, setShowPriceHistory] = useState(null);
  const [form, setForm] = useState({
    supplier_id: '', supplier_name: '', supplier_cnpj: '', supplier_phone: '', supplier_email: '', supplier_address: '', supplier_contact: '',
    payment_type: 'vista', payment_condition: '', freight_type: 'included', carrier: '', freight_value: 0, delivery_deadline: '', notes: '',
    buyer_name: '', delivery_address: '', discount_percent: 0, items: [{ ...emptyItem }]
  });

  const load = () => {
    api.get('/purchase-orders').then(r => setOrders(r.data));
    api.get('/suppliers').then(r => setSuppliers(r.data));
    api.get('/purchase-orders/company').then(r => { if (r.data.name !== undefined) setCompany(r.data); });
  };
  useEffect(() => { load(); }, []);

  const selectSupplier = (id) => {
    const s = suppliers.find(s => s.id === parseInt(id));
    if (s) {
      setForm(f => ({ ...f, supplier_id: s.id, supplier_name: s.name, supplier_cnpj: s.cnpj || '', supplier_phone: s.phone || '', supplier_email: s.email || '', supplier_address: `${s.address || ''}${s.city ? ' - ' + s.city : ''}${s.state ? '/' + s.state : ''}`, supplier_contact: s.contact_person || '' }));
      fetchPriceHistory(s.id);
    } else {
      setForm(f => ({ ...f, supplier_id: '', supplier_cnpj: '', supplier_phone: '', supplier_email: '', supplier_address: '', supplier_contact: '' }));
    }
  };

  const fetchPriceHistory = async (supplierId) => {
    if (!supplierId) return;
    try {
      const res = await api.get(`/price-history/supplier/${supplierId}`);
      setPriceHistory(res.data);
    } catch (_) {}
  };

  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const calcItemTotal = (item) => {
    const base = (item.quantity || 0) * (item.unit_price || 0);
    return base + base * ((item.ipi_percent || 0) / 100);
  };

  const calcSubtotal = () => form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
  const calcIpi = () => form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0) * ((i.ipi_percent || 0) / 100), 0);
  const calcDiscount = () => {
    const base = calcSubtotal() + calcIpi();
    return base * ((parseFloat(form.discount_percent) || 0) / 100);
  };
  const calcTotal = () => calcSubtotal() + calcIpi() - calcDiscount() + (parseFloat(form.freight_value) || 0);

  const handleSave = async () => {
    if (!form.supplier_name || form.items.length === 0 || !form.items[0].description) return alert('Preencha o fornecedor e ao menos um item');
    const payload = {
      ...form,
      items: form.items.map(i => ({ ...i, quantity: parseFloat(i.quantity) || 1, unit_price: parseFloat(i.unit_price) || 0, ipi_percent: parseFloat(i.ipi_percent) || 0 })),
      freight_value: parseFloat(form.freight_value) || 0,
      discount_percent: parseFloat(form.discount_percent) || 0
    };
    if (current) {
      await api.put(`/purchase-orders/${current.id}`, payload);
    } else {
      await api.post('/purchase-orders', payload);
    }
    setShowForm(false);
    resetForm();
    load();
  };

  const resetForm = () => {
    setCurrent(null);
    setForm({ supplier_id: '', supplier_name: '', supplier_cnpj: '', supplier_phone: '', supplier_email: '', supplier_address: '', supplier_contact: '', payment_type: 'vista', payment_condition: '', freight_type: 'included', carrier: '', freight_value: 0, delivery_deadline: '', notes: '', discount_percent: 0, items: [{ ...emptyItem }] });
  };

  const openEdit = async (order) => {
    const r = await api.get(`/purchase-orders/${order.id}`);
    const data = r.data;
    setCurrent(data);
    setForm({
      supplier_id: data.supplier_id || '', supplier_name: data.supplier_name, supplier_cnpj: data.supplier_cnpj || '', supplier_phone: data.supplier_phone || '', supplier_email: data.supplier_email || '', supplier_address: data.supplier_address || '', supplier_contact: data.supplier_contact || '',
      payment_type: data.payment_type || 'vista', payment_condition: data.payment_condition || '', freight_type: data.freight_type || 'included', carrier: data.carrier || '', freight_value: data.freight_value || 0, delivery_deadline: data.delivery_deadline || '', notes: data.notes || '',
      buyer_name: data.buyer_name || '', delivery_address: data.delivery_address || '', discount_percent: data.discount_percent || 0,
      items: data.items.length > 0 ? data.items.map(i => ({ description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, ipi_percent: i.ipi_percent })) : [{ ...emptyItem }]
    });
    setShowForm(true);
  };

  const duplicateOrder = async (order) => {
    const r = await api.get(`/purchase-orders/${order.id}`);
    const data = r.data;
    setCurrent(null);
    setForm({
      supplier_id: data.supplier_id || '', supplier_name: data.supplier_name, supplier_cnpj: data.supplier_cnpj || '', supplier_phone: data.supplier_phone || '', supplier_email: data.supplier_email || '', supplier_address: data.supplier_address || '', supplier_contact: data.supplier_contact || '',
      payment_type: data.payment_type || 'vista', payment_condition: data.payment_condition || '', freight_type: data.freight_type || 'included', carrier: data.carrier || '', freight_value: data.freight_value || 0, delivery_deadline: data.delivery_deadline || '', notes: data.notes || '',
      buyer_name: data.buyer_name || '', delivery_address: data.delivery_address || '', discount_percent: data.discount_percent || 0,
      items: data.items.length > 0 ? data.items.map(i => ({ description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, ipi_percent: i.ipi_percent })) : [{ ...emptyItem }]
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta ordem de compra?')) return;
    await api.delete(`/purchase-orders/${id}`);
    load();
  };

  const updateStatus = async (id, status) => {
    await api.patch(`/purchase-orders/${id}/status`, { status });
    load();
  };

  const openPdf = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/purchase-orders/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { alert('Erro ao gerar PDF'); }
  };

  const saveCompany = async () => {
    await api.put('/purchase-orders/company', company);
    setShowCompany(false);
    alert('Dados da empresa salvos!');
  };

  const statusColors = { draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700', confirmed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
  const statusLabels = { draft: 'Rascunho', sent: 'Enviada', confirmed: 'Confirmada', cancelled: 'Cancelada' };
  const readOnly = current && current.status !== 'draft';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ordens de Compra</h1>
          <p className="text-gray-500 text-sm mt-1">Gere ordens de compra e exporte como PDF</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCompany(true)} className="btn-secondary flex items-center gap-2"><Settings className="w-4 h-4" /> Dados da Empresa</button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Ordem</button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma ordem de compra criada</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">N.</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Pagamento</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono font-medium text-primary-600">{o.order_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{o.supplier_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {o.payment_type === 'vista' ? 'À Vista' : o.payment_type === 'credito' ? 'Crédito' : 'Faturamento'}
                    {o.payment_type === 'faturamento' && o.payment_condition && <span className="text-xs text-gray-400 ml-1">({o.payment_condition})</span>}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">{formatCurrency(o.total)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[o.status]}`}>{statusLabels[o.status]}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openPdf(o.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver PDF"><FileDown className="w-4 h-4" /></button>
                      {o.status === 'draft' ? (
                        <button onClick={() => openEdit(o)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Editar"><Pencil className="w-4 h-4" /></button>
                      ) : (
                        <button onClick={() => openEdit(o)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="Visualizar"><Eye className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => duplicateOrder(o)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Duplicar"><Copy className="w-4 h-4" /></button>
                      {o.status === 'draft' && <button onClick={() => updateStatus(o.id, 'sent')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Marcar como Enviada"><Send className="w-4 h-4" /></button>}
                      {o.status === 'sent' && <button onClick={() => { if (confirm('Voltar esta OC para rascunho? Você poderá editá-la novamente.')) updateStatus(o.id, 'draft'); }} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Voltar para Rascunho"><ChevronLeft className="w-4 h-4" /></button>}
                      {(o.status === 'draft' || o.status === 'cancelled') && <button onClick={() => handleDelete(o.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Form Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={current ? (current.status === 'draft' ? `Editar ${current.order_number}` : `Visualizar ${current.order_number}`) : 'Nova Ordem de Compra'} size="xl">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
          {current && current.status !== 'draft' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
              Esta OC já foi <strong>{statusLabels[current.status]?.toLowerCase()}</strong> e não pode ser editada. Use o botão <strong>Duplicar</strong> para criar uma nova baseada nesta.
            </div>
          )}
          {/* Supplier */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Fornecedor</h3>
            <div className="grid grid-cols-2 gap-3">
              {!readOnly && <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Selecionar Fornecedor Cadastrado</label>
                <select value={form.supplier_id} onChange={e => { selectSupplier(e.target.value); }} className="input-field">
                  <option value="">Digitar manualmente</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.cnpj ? ` (${s.cnpj})` : ''}</option>)}
                </select>
              </div>}}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Razão Social *</label>
                <input type="text" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className="input-field" readOnly={!!readOnly} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CNPJ</label>
                <input type="text" value={form.supplier_cnpj} onChange={e => setForm(f => ({ ...f, supplier_cnpj: e.target.value }))} className="input-field" readOnly={!!readOnly} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
                <input type="text" value={form.supplier_phone} onChange={e => setForm(f => ({ ...f, supplier_phone: e.target.value }))} className="input-field" readOnly={!!readOnly} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="text" value={form.supplier_email} onChange={e => setForm(f => ({ ...f, supplier_email: e.target.value }))} className="input-field" readOnly={!!readOnly} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Endereço</label>
                <input type="text" value={form.supplier_address} onChange={e => setForm(f => ({ ...f, supplier_address: e.target.value }))} className="input-field" readOnly={!!readOnly} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contato</label>
                <input type="text" value={form.supplier_contact} onChange={e => setForm(f => ({ ...f, supplier_contact: e.target.value }))} className="input-field" readOnly={!!readOnly} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Itens</h3>
              {!readOnly && <button onClick={addItem} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Item</button>}
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                <div className="col-span-4">Descrição</div>
                <div className="col-span-1">Qtd</div>
                <div className="col-span-1">Un</div>
                <div className="col-span-2">Vlr Unit.</div>
                <div className="col-span-1">IPI %</div>
                <div className="col-span-2">Total</div>
                <div className="col-span-1"></div>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className={readOnly ? 'col-span-5 relative' : 'col-span-4 relative'}>
                    <input className="input-field text-sm w-full" placeholder="Descrição do item" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} readOnly={!!readOnly} />
                    {!readOnly && item.description && Object.keys(priceHistory).some(k => k.toLowerCase().includes(item.description.toLowerCase())) && (
                      <button type="button" onClick={() => setShowPriceHistory(showPriceHistory === idx ? null : idx)} className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-600" title="Ver histórico de preços">
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {showPriceHistory === idx && (
                      <div className="absolute z-10 top-full mt-1 left-0 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                        <p className="font-semibold text-gray-700 mb-2">Histórico de Preços</p>
                        {Object.entries(priceHistory).filter(([k]) => k.toLowerCase().includes(item.description.toLowerCase())).slice(0, 3).map(([name, entries]) => (
                          <div key={name} className="mb-2">
                            <p className="font-medium text-gray-600">{name}</p>
                            {entries.slice(0, 3).map((e, i) => (
                              <p key={i} className="text-gray-500 flex justify-between"><span>{e.date}</span><span className="font-medium text-gray-700">R$ {Number(e.unit_price).toFixed(2)}</span></p>
                            ))}
                          </div>
                        ))}
                        <button onClick={() => setShowPriceHistory(null)} className="text-primary-600 hover:underline mt-1">Fechar</button>
                      </div>
                    )}
                  </div>
                  <input type="number" className="input-field col-span-1 text-sm" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min="0.01" step="0.01" readOnly={!!readOnly} />
                  {readOnly ? (
                    <input className="input-field col-span-1 text-sm" value={item.unit} readOnly />
                  ) : (
                    <select className="input-field col-span-1 text-sm" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>
                      <option>un</option><option>kg</option><option>m</option><option>m²</option><option>m³</option><option>L</option><option>cx</option><option>pç</option><option>par</option><option>rolo</option><option>sc</option>
                    </select>
                  )}
                  <input type="number" className="input-field col-span-2 text-sm" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} min="0" step="0.01" readOnly={!!readOnly} />
                  <input type="number" className="input-field col-span-1 text-sm" value={item.ipi_percent} onChange={e => updateItem(idx, 'ipi_percent', e.target.value)} min="0" step="0.5" readOnly={!!readOnly} />
                  <div className="col-span-2 text-sm font-medium text-gray-900 text-right pr-1">{formatCurrency(calcItemTotal(item))}</div>
                  {!readOnly && <button onClick={() => removeItem(idx)} disabled={form.items.length === 1} className="col-span-1 p-1 text-red-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">Desconto (%)</label>
                <input type="number" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} className="input-field w-24 text-sm" min="0" max="100" step="0.5" readOnly={!!readOnly} />
              </div>
              <div className="text-right space-y-1 text-sm">
                <p className="text-gray-500">Subtotal: <span className="font-medium text-gray-900">{formatCurrency(calcSubtotal())}</span></p>
                {calcIpi() > 0 && <p className="text-gray-500">IPI: <span className="font-medium text-gray-900">{formatCurrency(calcIpi())}</span></p>}
                {calcDiscount() > 0 && <p className="text-green-600">Desconto ({parseFloat(form.discount_percent) || 0}%): <span className="font-medium">-{formatCurrency(calcDiscount())}</span></p>}
                {parseFloat(form.freight_value) > 0 && <p className="text-gray-500">Frete: <span className="font-medium text-gray-900">{formatCurrency(parseFloat(form.freight_value) || 0)}</span></p>}
                <p className="text-lg font-bold text-primary-700">Total: {formatCurrency(calcTotal())}</p>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pagamento</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Forma de Pagamento</label>
                {readOnly ? (
                  <input className="input-field" value={{vista:'À Vista', credito:'Cartão de Crédito', faturamento:'Faturamento'}[form.payment_type] || form.payment_type} readOnly />
                ) : (
                  <select value={form.payment_type} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))} className="input-field">
                    <option value="vista">À Vista</option>
                    <option value="credito">Cartão de Crédito</option>
                    <option value="faturamento">Faturamento</option>
                  </select>
                )}
              </div>
              {form.payment_type === 'faturamento' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Condição de Pagamento</label>
                  <input type="text" value={form.payment_condition} onChange={e => setForm(f => ({ ...f, payment_condition: e.target.value }))} className="input-field" placeholder="Ex: 28/56 DDL, 30/60/90 dias..." readOnly={!!readOnly} />
                </div>
              )}
            </div>
          </div>

          {/* Freight */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Frete</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Frete</label>
                {readOnly ? (
                  <input className="input-field" value={{included:'Incluso (CIF)', fob:'FOB', cif:'CIF'}[form.freight_type] || form.freight_type} readOnly />
                ) : (
                  <select value={form.freight_type} onChange={e => setForm(f => ({ ...f, freight_type: e.target.value }))} className="input-field">
                    <option value="included">Incluso (CIF)</option>
                    <option value="fob">FOB (por conta do comprador)</option>
                    <option value="cif">CIF (por conta do vendedor)</option>
                  </select>
                )}
              </div>
              {form.freight_type === 'fob' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Transportadora</label>
                  <input type="text" value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} className="input-field" readOnly={!!readOnly} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor do Frete (R$)</label>
                <input type="number" value={form.freight_value} onChange={e => setForm(f => ({ ...f, freight_value: e.target.value }))} className="input-field" min="0" step="0.01" readOnly={!!readOnly} />
              </div>
            </div>
          </div>

          {/* Buyer & Delivery */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Comprador / Entrega</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome do Comprador</label>
                <input type="text" value={form.buyer_name} onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))} className="input-field" placeholder="Quem está solicitando a compra" readOnly={!!readOnly} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prazo de Entrega</label>
                <input type="text" value={form.delivery_deadline} onChange={e => setForm(f => ({ ...f, delivery_deadline: e.target.value }))} className="input-field" placeholder="Ex: 15 dias úteis" readOnly={!!readOnly} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Endereço de Entrega (se diferente do endereço da empresa)</label>
                <input type="text" value={form.delivery_address} onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))} className="input-field" placeholder="Endereço completo para entrega" readOnly={!!readOnly} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field" placeholder="Observações gerais" readOnly={!!readOnly} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t">
            {readOnly ? (
              <>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary flex-1">Fechar</button>
                <button onClick={() => { setCurrent(null); }} className="btn-primary flex-1 flex items-center justify-center gap-2"><Copy className="w-4 h-4" /> Duplicar como Nova</button>
              </>
            ) : (
              <>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} className="btn-primary flex-1">{current ? 'Salvar Alterações' : 'Salvar Ordem'}</button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Company Settings Modal */}
      <Modal isOpen={showCompany} onClose={() => setShowCompany(false)} title="Dados da Empresa (para o PDF)">
        <div className="space-y-3">
          {/* Logo upload */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Logotipo</label>
            <div className="flex items-center gap-4">
              {company.logo_base64 ? (
                <div className="relative">
                  <img src={company.logo_base64} alt="Logo" className="h-16 max-w-[200px] object-contain border rounded-lg p-1" />
                  <button onClick={() => setCompany(c => ({ ...c, logo_base64: '' }))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Carregar logo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 500000) return alert('Imagem muito grande (máx 500KB)');
                    const reader = new FileReader();
                    reader.onload = (ev) => setCompany(c => ({ ...c, logo_base64: ev.target.result }));
                    reader.readAsDataURL(file);
                  }} />
                </label>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Razão Social</label><input type="text" value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome Fantasia</label><input type="text" value={company.trade_name} onChange={e => setCompany(c => ({ ...c, trade_name: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">CNPJ</label><input type="text" value={company.cnpj} onChange={e => setCompany(c => ({ ...c, cnpj: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Inscrição Estadual</label><input type="text" value={company.ie} onChange={e => setCompany(c => ({ ...c, ie: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label><input type="text" value={company.phone} onChange={e => setCompany(c => ({ ...c, phone: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="text" value={company.email} onChange={e => setCompany(c => ({ ...c, email: e.target.value }))} className="input-field" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Endereço</label><input type="text" value={company.address} onChange={e => setCompany(c => ({ ...c, address: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Cidade</label><input type="text" value={company.city} onChange={e => setCompany(c => ({ ...c, city: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Estado</label><input type="text" value={company.state} onChange={e => setCompany(c => ({ ...c, state: e.target.value }))} className="input-field" maxLength={2} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">CEP</label><input type="text" value={company.zip} onChange={e => setCompany(c => ({ ...c, zip: e.target.value }))} className="input-field" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Email para envio de NF-e</label><input type="email" value={company.nfe_email} onChange={e => setCompany(c => ({ ...c, nfe_email: e.target.value }))} className="input-field" placeholder="nfe@suaempresa.com" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCompany(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveCompany} className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
