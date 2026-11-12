import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency, formatDate, today, monthLabel } from '../utils/formatters';
import { ShoppingBag, Plus, Trash2, FileText, ChevronRight, X, Save, Package } from 'lucide-react';

export default function PurchaseTabs() {
  const [tabs, setTabs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ supplier_name: '', month: new Date().toISOString().slice(0, 7), notes: '' });
  const [detail, setDetail] = useState(null);
  const [itemForm, setItemForm] = useState({ description: '', quantity: '1', unit: 'un', unit_price: '', purchase_date: today(), notes: '' });
  const [showBill, setShowBill] = useState(false);
  const [billForm, setBillForm] = useState({ due_date: '', category_id: '', payment_source: '' });

  const load = () => api.get('/purchase-tabs').then(r => setTabs(r.data));

  useEffect(() => {
    load();
    api.get('/suppliers').then(r => setSuppliers(r.data));
    api.get('/categories').then(r => setCategories(r.data));
  }, []);

  const loadDetail = (id) => api.get(`/purchase-tabs/${id}`).then(r => setDetail(r.data));

  const handleCreate = async () => {
    if (!newForm.supplier_name || !newForm.month) return alert('Preencha fornecedor e mês');
    await api.post('/purchase-tabs', newForm);
    setShowNew(false);
    setNewForm({ supplier_name: '', month: new Date().toISOString().slice(0, 7), notes: '' });
    load();
  };

  const handleAddItem = async () => {
    if (!itemForm.description || !itemForm.unit_price) return alert('Preencha descrição e valor');
    await api.post(`/purchase-tabs/${detail.id}/items`, { ...itemForm, quantity: parseFloat(itemForm.quantity) || 1, unit_price: parseFloat(itemForm.unit_price) || 0 });
    setItemForm({ description: '', quantity: '1', unit: 'un', unit_price: '', purchase_date: today(), notes: '' });
    loadDetail(detail.id);
    load();
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Excluir este item?')) return;
    await api.delete(`/purchase-tabs/${detail.id}/items/${itemId}`);
    loadDetail(detail.id);
    load();
  };

  const handleDeleteTab = async (id) => {
    if (!confirm('Excluir este vale e todos os itens?')) return;
    await api.delete(`/purchase-tabs/${id}`);
    if (detail?.id === id) setDetail(null);
    load();
  };

  const handleGenerateBill = async () => {
    if (!billForm.due_date) return alert('Informe a data de vencimento');
    try {
      const { data } = await api.post(`/purchase-tabs/${detail.id}/generate-bill`, billForm);
      alert(`Conta criada: ${data.description} - ${formatCurrency(data.total)}`);
      setShowBill(false);
      setDetail(null);
      load();
    } catch (err) { alert(err.response?.data?.error || 'Erro ao gerar conta'); }
  };

  const openTabs = tabs.filter(t => t.status === 'open');
  const closedTabs = tabs.filter(t => t.status === 'closed');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras em Vale</h1>
          <p className="text-gray-500 text-sm mt-1">Registre compras ao longo do mês e gere a conta quando a fatura chegar</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Vale</button>
      </div>

      {detail ? (
        <div>
          <button onClick={() => setDetail(null)} className="text-sm text-primary-600 hover:underline mb-4 flex items-center gap-1">
            <ChevronRight className="w-4 h-4 rotate-180" /> Voltar
          </button>

          <div className="card mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{detail.supplier_name}</h2>
                <p className="text-gray-500 text-sm">{monthLabel(detail.month)}</p>
                {detail.notes && <p className="text-gray-400 text-sm mt-1">{detail.notes}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(detail.total_amount)}</p>
                <p className="text-sm text-gray-500">{detail.items?.length || 0} item(ns)</p>
                {detail.status === 'open' && (
                  <button onClick={() => { setBillForm({ due_date: '', category_id: '', payment_source: '' }); setShowBill(true); }}
                    className="btn-primary mt-3 flex items-center gap-2 ml-auto">
                    <FileText className="w-4 h-4" /> Gerar Conta a Pagar
                  </button>
                )}
              </div>
            </div>
          </div>

          {detail.status === 'open' && (
            <div className="card mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Adicionar Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <input type="text" placeholder="Descrição do produto *" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} className="input-field" />
                </div>
                <div>
                  <input type="number" placeholder="Qtd" min="0.01" step="0.01" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} className="input-field" />
                </div>
                <div>
                  <select value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} className="input-field">
                    <option value="un">un</option>
                    <option value="pc">pc</option>
                    <option value="kg">kg</option>
                    <option value="m">m</option>
                    <option value="l">l</option>
                    <option value="cx">cx</option>
                  </select>
                </div>
                <div>
                  <input type="number" placeholder="Valor unit. *" min="0" step="0.01" value={itemForm.unit_price} onChange={e => setItemForm({ ...itemForm, unit_price: e.target.value })} className="input-field" />
                </div>
                <div>
                  <input type="date" value={itemForm.purchase_date} onChange={e => setItemForm({ ...itemForm, purchase_date: e.target.value })} className="input-field" />
                </div>
              </div>
              <button onClick={handleAddItem} className="btn-primary mt-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar</button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Produto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Un</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">V. Unit.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                  {detail.status === 'open' && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(!detail.items || detail.items.length === 0) ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum item adicionado</td></tr>
                ) : detail.items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.purchase_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-500">{item.unit}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                    {detail.status === 'open' && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.items?.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm text-gray-500">{detail.items.length} item(ns)</span>
                <span className="text-sm font-bold text-gray-900">Total: {formatCurrency(detail.total_amount)}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {openTabs.length === 0 && closedTabs.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum vale cadastrado</p>
              <p className="text-sm mt-1">Crie um vale para registrar compras ao longo do mês</p>
            </div>
          ) : (
            <>
              {openTabs.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Vales Abertos</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {openTabs.map(tab => (
                      <div key={tab.id} className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => loadDetail(tab.id)}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">{tab.supplier_name}</h3>
                            <p className="text-sm text-gray-500">{monthLabel(tab.month)}</p>
                          </div>
                          <button onClick={e => { e.stopPropagation(); handleDeleteTab(tab.id); }} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 mt-3">{formatCurrency(tab.total_amount)}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                          <Package className="w-4 h-4" /> {tab.item_count} item(ns)
                        </div>
                        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Aberto</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {closedTabs.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Vales Fechados</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {closedTabs.map(tab => (
                      <div key={tab.id} className="card hover:shadow-md transition-shadow cursor-pointer opacity-75" onClick={() => loadDetail(tab.id)}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">{tab.supplier_name}</h3>
                            <p className="text-sm text-gray-500">{monthLabel(tab.month)}</p>
                          </div>
                          <button onClick={e => { e.stopPropagation(); handleDeleteTab(tab.id); }} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 mt-3">{formatCurrency(tab.total_amount)}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                          <Package className="w-4 h-4" /> {tab.item_count} item(ns)
                        </div>
                        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Faturado</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Novo Vale">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor *</label>
            {suppliers.length > 0 ? (
              <div>
                <select value={newForm.supplier_name} onChange={e => setNewForm({ ...newForm, supplier_name: e.target.value })} className="input-field">
                  <option value="">Selecione ou digite abaixo</option>
                  {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <input type="text" value={newForm.supplier_name} onChange={e => setNewForm({ ...newForm, supplier_name: e.target.value })} className="input-field mt-2" placeholder="Ou digite o nome do fornecedor" />
              </div>
            ) : (
              <input type="text" value={newForm.supplier_name} onChange={e => setNewForm({ ...newForm, supplier_name: e.target.value })} className="input-field" placeholder="Nome do fornecedor" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mês de Referência *</label>
            <input type="month" value={newForm.month} onChange={e => setNewForm({ ...newForm, month: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes: e.target.value })} className="input-field" rows={2} placeholder="Opcional" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleCreate} className="btn-primary flex-1">Criar Vale</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showBill} onClose={() => setShowBill(false)} title="Gerar Conta a Pagar">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Vale: {detail?.supplier_name} - {detail?.month ? monthLabel(detail.month) : ''}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(detail?.total_amount || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">{detail?.items?.length || 0} item(ns)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento *</label>
            <input type="date" value={billForm.due_date} onChange={e => setBillForm({ ...billForm, due_date: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select value={billForm.category_id} onChange={e => setBillForm({ ...billForm, category_id: e.target.value })} className="input-field">
              <option value="">Selecione</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Como Pagar</label>
            <select value={billForm.payment_source} onChange={e => setBillForm({ ...billForm, payment_source: e.target.value })} className="input-field">
              <option value="">Selecione</option>
              <option value="boleto">Pegar Boleto</option>
              <option value="dda">DDA</option>
              <option value="pix">PIX</option>
              <option value="debito_auto">Débito Automático</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowBill(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleGenerateBill} className="btn-primary flex-1">Gerar Conta</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
