import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/formatters';
import { Package, Plus, ArrowUpCircle, ArrowDownCircle, Search, AlertTriangle, Edit3, Trash2, Image, Eye } from 'lucide-react';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showMove, setShowMove] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', unit: 'un', quantity: '', unit_cost: '', sale_price: '', supplier: '', min_stock: '', photo_url: '' });
  const [moveForm, setMoveForm] = useState({ type: 'in', quantity: '', unit_cost: '', notes: '' });

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (lowStock) params.set('low_stock', 'true');
    api.get(`/inventory?${params}`).then(r => setItems(r.data));
  };
  useEffect(() => { load(); }, [search, lowStock]);

  const emptyForm = { name: '', category: '', unit: 'un', quantity: '', unit_cost: '', sale_price: '', supplier: '', min_stock: '', photo_url: '' };

  const handleSave = async () => {
    if (!form.name) return;
    const data = { ...form, quantity: parseFloat(form.quantity) || 0, unit_cost: parseFloat(form.unit_cost) || 0, sale_price: parseFloat(form.sale_price) || 0, min_stock: parseFloat(form.min_stock) || 0 };
    if (editing) {
      await api.put(`/inventory/${editing.id}`, data);
    } else {
      await api.post('/inventory', data);
    }
    setShowAdd(false); setEditing(null); setForm(emptyForm); load();
  };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category || '', unit: item.unit || 'un', quantity: item.quantity, unit_cost: item.unit_cost, sale_price: item.sale_price || '', supplier: item.supplier || '', min_stock: item.min_stock || '', photo_url: item.photo_url || '' });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este item do estoque?')) return;
    await api.delete(`/inventory/${id}`); load();
  };

  const handleMove = async () => {
    if (!moveForm.quantity) return;
    await api.post(`/inventory/${showMove.id}/movement`, { ...moveForm, quantity: parseFloat(moveForm.quantity), unit_cost: parseFloat(moveForm.unit_cost) || 0 });
    setShowMove(null); setMoveForm({ type: 'in', quantity: '', unit_cost: '', notes: '' }); load();
  };

  const loadDetail = async (item) => {
    const { data } = await api.get(`/inventory/${item.id}`);
    setShowDetail(data);
  };

  const totalValue = items.reduce((s, i) => s + i.total_cost, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">Valor total em estoque: {formatCurrency(totalValue)}</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowAdd(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Item</button>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por nome, categoria ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Estoque baixo
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Produto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Un</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Custo Unit.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Preço Venda</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Custo Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">Nenhum item no estoque</td></tr>
              ) : items.map(item => {
                const isLow = item.min_stock > 0 && item.quantity <= item.min_stock;
                const markup = item.sale_price > 0 && item.unit_cost > 0 ? (((item.sale_price - item.unit_cost) / item.unit_cost) * 100) : null;
                return (
                  <tr key={item.id} className={`hover:bg-gray-50/50 ${isLow ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.photo_url ? (
                          <img src={item.photo_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1">
                            {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          </div>
                          {item.nfe_number && <p className="text-xs text-gray-400">NF {item.nfe_number}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.category || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.unit}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(item.unit_cost)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {item.sale_price > 0 ? (
                        <div>
                          <span className="text-gray-900 font-medium">{formatCurrency(item.sale_price)}</span>
                          {markup !== null && <span className={`block text-xs ${markup >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{markup >= 0 ? '+' : ''}{markup.toFixed(1)}%</span>}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(item.total_cost)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.supplier || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => loadDetail(item)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Detalhes"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handleEdit(item)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg" title="Editar"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => { setShowMove(item); setMoveForm({ type: 'in', quantity: '', unit_cost: '', notes: '' }); }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Entrada"><ArrowUpCircle className="w-4 h-4" /></button>
                        <button onClick={() => { setShowMove(item); setMoveForm({ type: 'out', quantity: '', unit_cost: '', notes: '' }); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Saída"><ArrowDownCircle className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); setEditing(null); }} title={editing ? 'Editar Item' : 'Novo Item de Estoque'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label><input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">URL da Foto</label><input type="text" value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })} className="input-field" placeholder="https://... ou caminho local da imagem" /></div>
          {form.photo_url && (
            <div className="flex justify-center">
              <img src={form.photo_url} alt="Preview" className="w-32 h-32 object-cover rounded-lg border" onError={e => e.target.style.display = 'none'} />
            </div>
          )}
          <div className="grid grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label><input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="input-field" placeholder="un, kg, m..." /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{editing ? 'Qtd Atual' : 'Qtd Inicial'}</label><input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="input-field" disabled={!!editing} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Custo Unit.</label><input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} className="input-field" disabled={!!editing} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mín.</label><input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda (R$)</label><input type="number" step="0.01" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} className="input-field" placeholder="0,00" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label><input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="input-field" /></div>
          </div>
          <div className="flex gap-3"><button onClick={() => { setShowAdd(false); setEditing(null); }} className="btn-secondary flex-1">Cancelar</button><button onClick={handleSave} className="btn-primary flex-1">{editing ? 'Atualizar' : 'Adicionar'}</button></div>
        </div>
      </Modal>

      <Modal isOpen={!!showMove} onClose={() => setShowMove(null)} title={showMove ? `${moveForm.type === 'in' ? 'Entrada' : 'Saída'} - ${showMove.name}` : ''}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setMoveForm({ ...moveForm, type: 'in' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${moveForm.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>Entrada</button>
            <button onClick={() => setMoveForm({ ...moveForm, type: 'out' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${moveForm.type === 'out' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>Saída</button>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label><input type="number" value={moveForm.quantity} onChange={e => setMoveForm({ ...moveForm, quantity: e.target.value })} className="input-field" /></div>
          {moveForm.type === 'in' && <div><label className="block text-sm font-medium text-gray-700 mb-1">Custo Unitário</label><input type="number" step="0.01" value={moveForm.unit_cost} onChange={e => setMoveForm({ ...moveForm, unit_cost: e.target.value })} className="input-field" /></div>}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Observação</label><input type="text" value={moveForm.notes} onChange={e => setMoveForm({ ...moveForm, notes: e.target.value })} className="input-field" /></div>
          <div className="flex gap-3"><button onClick={() => setShowMove(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={handleMove} className="btn-primary flex-1">Registrar</button></div>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail ? `Detalhes - ${showDetail.name}` : ''} size="lg">
        {showDetail && (
          <div>
            <div className="flex gap-4 mb-6">
              {showDetail.photo_url && <img src={showDetail.photo_url} alt={showDetail.name} className="w-24 h-24 object-cover rounded-lg border" />}
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600">Custo Unitário</p><p className="font-bold">{formatCurrency(showDetail.unit_cost)}</p></div>
                <div className="bg-emerald-50 p-3 rounded-lg"><p className="text-xs text-emerald-600">Preço Venda</p><p className="font-bold">{showDetail.sale_price > 0 ? formatCurrency(showDetail.sale_price) : '—'}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-600">Em Estoque</p><p className="font-bold">{showDetail.quantity} {showDetail.unit}</p></div>
              </div>
            </div>
            {showDetail.sale_price > 0 && showDetail.unit_cost > 0 && (
              <div className="bg-amber-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-amber-700">Margem: <span className="font-bold">{(((showDetail.sale_price - showDetail.unit_cost) / showDetail.unit_cost) * 100).toFixed(1)}%</span> ({formatCurrency(showDetail.sale_price - showDetail.unit_cost)} por {showDetail.unit})</p>
              </div>
            )}
            <h4 className="font-semibold text-gray-700 mb-2">Movimentações</h4>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2">Data</th><th className="text-center px-3 py-2">Tipo</th><th className="text-right px-3 py-2">Qtd</th><th className="text-right px-3 py-2">Custo Unit.</th><th className="text-left px-3 py-2">Obs</th></tr></thead>
              <tbody>{(showDetail.movements || []).map((m, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 text-gray-500">{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${m.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{m.type === 'in' ? 'Entrada' : 'Saída'}</span></td>
                  <td className="px-3 py-2 text-right font-medium">{m.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(m.unit_cost)}</td>
                  <td className="px-3 py-2 text-gray-500">{m.notes || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            {(!showDetail.movements || showDetail.movements.length === 0) && <p className="text-center text-gray-400 py-4">Nenhuma movimentação</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
