import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { FolderTree, Plus, Eye, Wrench, Archive, Cog, Trash2, TrendingUp, TrendingDown, Calendar, FileText, ClipboardList } from 'lucide-react';

export default function CostCenters() {
  const [centers, setCenters] = useState([]);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddItem, setShowAddItem] = useState(null);
  const [showEdit, setShowEdit] = useState(null);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({
    name: '', description: '', budget: '', type: 'service',
    os_number: '', nf_remessa: '', repair_type: '', promised_deadline: '',
    actual_delivery: '', contracted_value: ''
  });
  const [itemForm, setItemForm] = useState({ description: '', amount: '', type: 'material' });

  const emptyForm = {
    name: '', description: '', budget: '', type: 'service',
    os_number: '', nf_remessa: '', repair_type: '', promised_deadline: '',
    actual_delivery: '', contracted_value: ''
  };

  const load = () => api.get('/cost-centers').then(r => setCenters(r.data));
  useEffect(() => { load(); }, []);

  const loadDetail = async (id) => {
    const { data } = await api.get(`/cost-centers/${id}`);
    setDetail(data);
  };

  const handleCreate = async () => {
    if (!form.name) return;
    await api.post('/cost-centers', {
      ...form,
      budget: parseFloat(form.budget) || 0,
      contracted_value: parseFloat(form.contracted_value) || 0
    });
    setShowCreate(false); setForm(emptyForm); load();
  };

  const handleEdit = async () => {
    if (!form.name) return;
    await api.put(`/cost-centers/${showEdit}`, {
      ...form,
      budget: parseFloat(form.budget) || 0,
      contracted_value: parseFloat(form.contracted_value) || 0
    });
    setShowEdit(null); setForm(emptyForm); load();
    if (detail && detail.id === showEdit) loadDetail(showEdit);
  };

  const openEdit = (c) => {
    setForm({
      name: c.name, description: c.description || '', budget: c.budget || '',
      type: c.type || 'service', os_number: c.os_number || '', nf_remessa: c.nf_remessa || '',
      repair_type: c.repair_type || '', promised_deadline: c.promised_deadline || '',
      actual_delivery: c.actual_delivery || '', contracted_value: c.contracted_value || ''
    });
    setShowEdit(c.id);
  };

  const handleAddItem = async () => {
    if (!itemForm.description || !itemForm.amount) return;
    await api.post(`/cost-centers/${showAddItem}/items`, { ...itemForm, amount: parseFloat(itemForm.amount) });
    setItemForm({ description: '', amount: '', type: 'material' }); setShowAddItem(null); load();
    if (detail && detail.id === showAddItem) loadDetail(showAddItem);
  };

  const handleDeleteItem = async (centerId, itemId) => {
    await api.delete(`/cost-centers/${centerId}/items/${itemId}`);
    loadDetail(centerId); load();
  };

  const toggleStatus = async (center) => {
    const newStatus = center.status === 'active' ? 'closed' : 'active';
    await api.put(`/cost-centers/${center.id}`, { status: newStatus }); load();
  };

  const filtered = filter === 'all' ? centers : centers.filter(c => c.type === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centro de Custos</h1>
          <p className="text-gray-500 text-sm mt-1">Acompanhe custos por serviço ou fabricação</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setShowCreate(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Centro</button>
      </div>

      <div className="flex gap-2 mb-6">
        {[['all', 'Todos'], ['service', 'Serviços'], ['manufacturing', 'Fabricação']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border'}`}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400"><FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum centro de custos</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const ref = c.contracted_value || c.budget || 0;
            const pct = ref > 0 ? Math.min((c.total_spent / ref) * 100, 100) : 0;
            const overBudget = ref > 0 && c.total_spent > ref;
            const margin = ref > 0 ? ref - c.total_spent : 0;
            const isService = (c.type || 'service') === 'service';
            return (
              <div key={c.id} className={`card hover:shadow-md transition-shadow ${c.status === 'closed' ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isService ? 'bg-blue-100' : 'bg-purple-100'}`}>
                      {isService ? <Wrench className="w-4 h-4 text-blue-600" /> : <Cog className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{c.name}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isService ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>{isService ? 'Serviço' : 'Fabricação'}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.status === 'active' ? 'Ativo' : 'Encerrado'}
                  </span>
                </div>
                {c.os_number && <p className="text-xs text-gray-500 mb-1">OS: {c.os_number}</p>}
                {c.repair_type && <p className="text-xs text-gray-500 mb-1">Tipo: {c.repair_type}</p>}
                <p className="text-xl font-bold text-gray-900 mt-2">Gasto: {formatCurrency(c.total_spent)}</p>
                {ref > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{isService ? 'Contratado' : 'Orçamento'}: {formatCurrency(ref)}</span>
                      <span className={`font-medium ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{margin >= 0 ? 'Lucro' : 'Prejuízo'}: {formatCurrency(Math.abs(margin))}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${overBudget ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">{c.items_count} item(ns)</p>
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                  <button onClick={() => loadDetail(c.id)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Eye className="w-3 h-3" /> Detalhes</button>
                  {c.status === 'active' && <button onClick={() => setShowAddItem(c.id)} className="text-xs text-amber-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Item</button>}
                  <button onClick={() => openEdit(c)} className="text-xs text-gray-600 hover:underline flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Editar</button>
                  <button onClick={() => toggleStatus(c)} className="text-xs text-gray-500 hover:underline flex items-center gap-1 ml-auto"><Archive className="w-3 h-3" /> {c.status === 'active' ? 'Encerrar' : 'Reativar'}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail?.name || ''} size="lg">
        {detail && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded-full ${(detail.type || 'service') === 'service' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                {(detail.type || 'service') === 'service' ? 'Serviço' : 'Fabricação'}
              </span>
              {detail.status === 'closed' && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Encerrado</span>}
            </div>

            {(detail.type || 'service') === 'service' && (detail.os_number || detail.nf_remessa || detail.repair_type || detail.promised_deadline) && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {detail.os_number && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Ordem de Serviço</p><p className="font-semibold text-sm">{detail.os_number}</p></div>}
                {detail.nf_remessa && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">NF Remessa</p><p className="font-semibold text-sm">{detail.nf_remessa}</p></div>}
                {detail.repair_type && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Tipo de Reforma</p><p className="font-semibold text-sm">{detail.repair_type}</p></div>}
                {detail.promised_deadline && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Prazo Prometido</p><p className="font-semibold text-sm">{formatDate(detail.promised_deadline)}</p></div>}
                {detail.actual_delivery && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Entrega Real</p><p className="font-semibold text-sm">{formatDate(detail.actual_delivery)}</p></div>}
                {detail.promised_deadline && detail.actual_delivery && (() => {
                  const promised = new Date(detail.promised_deadline);
                  const actual = new Date(detail.actual_delivery);
                  const diff = Math.ceil((actual - promised) / (1000 * 60 * 60 * 24));
                  return (
                    <div className={`p-3 rounded-lg ${diff <= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-gray-500">Status Prazo</p>
                      <p className={`font-semibold text-sm ${diff <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {diff <= 0 ? `${Math.abs(diff)} dia(s) adiantado` : `${diff} dia(s) atrasado`}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600">Material</p><p className="font-bold">{formatCurrency(detail.total_material)}</p></div>
              <div className="bg-amber-50 p-3 rounded-lg"><p className="text-xs text-amber-600">MOB</p><p className="font-bold">{formatCurrency(detail.total_mob)}</p></div>
              <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-600">Total Gasto</p><p className="font-bold">{formatCurrency(detail.total)}</p></div>
              {(detail.contracted_value > 0 || detail.budget > 0) && (
                <div className={`p-3 rounded-lg ${detail.margin >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className={`text-xs ${detail.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{detail.margin >= 0 ? 'Lucro' : 'Prejuízo'}</p>
                  <p className="font-bold">{formatCurrency(Math.abs(detail.margin))}</p>
                  <p className={`text-xs ${detail.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{detail.margin_pct >= 0 ? '+' : ''}{detail.margin_pct.toFixed(1)}%</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-700">{(detail.type || 'service') === 'manufacturing' ? 'Componentes / Itens Utilizados' : 'Itens do Centro'}</h4>
              {detail.status === 'active' && <button onClick={() => setShowAddItem(detail.id)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar</button>}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                <th className="text-left px-3 py-2">Descrição</th>
                <th className="text-center px-3 py-2">Tipo</th>
                <th className="text-right px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Fornecedor</th>
                <th className="text-right px-3 py-2"></th>
              </tr></thead>
              <tbody>{detail.items.map(item => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${item.type === 'mob' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{item.type === 'mob' ? 'MOB' : 'Material'}</span></td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                  <td className="px-3 py-2 text-gray-500">{item.supplier || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {detail.status === 'active' && <button onClick={() => handleDeleteItem(detail.id, item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {detail.items.length === 0 && <p className="text-center text-gray-400 py-6">Nenhum item registrado</p>}
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Novo Centro de Custos" size="lg">
        <CostCenterForm form={form} setForm={setForm} onSave={handleCreate} onCancel={() => setShowCreate(false)} buttonLabel="Criar" />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Editar Centro de Custos" size="lg">
        <CostCenterForm form={form} setForm={setForm} onSave={handleEdit} onCancel={() => setShowEdit(null)} buttonLabel="Atualizar" />
      </Modal>

      {/* Add Item Modal */}
      <Modal isOpen={!!showAddItem} onClose={() => setShowAddItem(null)} title="Adicionar Item ao Centro">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setItemForm({ ...itemForm, type: 'material' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${itemForm.type === 'material' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>Material / Componente</button>
            <button onClick={() => setItemForm({ ...itemForm, type: 'mob' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${itemForm.type === 'mob' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>Mão de Obra (MOB)</button>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label><input type="text" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} className="input-field" placeholder={itemForm.type === 'material' ? 'Ex: Rolamento 6205, Carcaça fundida...' : 'Ex: Usinagem CNC - 4h'} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label><input type="number" step="0.01" value={itemForm.amount} onChange={e => setItemForm({ ...itemForm, amount: e.target.value })} className="input-field" /></div>
          <div className="flex gap-3"><button onClick={() => setShowAddItem(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={handleAddItem} className="btn-primary flex-1">Adicionar</button></div>
        </div>
      </Modal>
    </div>
  );
}

function CostCenterForm({ form, setForm, onSave, onCancel, buttonLabel }) {
  const isService = form.type === 'service';
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setForm({ ...form, type: 'service' })} className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isService ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'bg-gray-100 text-gray-500'}`}>
          <Wrench className="w-4 h-4" /> Serviço / Reforma
        </button>
        <button onClick={() => setForm({ ...form, type: 'manufacturing' })} className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${!isService ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300' : 'bg-gray-100 text-gray-500'}`}>
          <Cog className="w-4 h-4" /> Fabricação de Peça
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder={isService ? 'Ex: Reforma União Rotativa #45' : 'Ex: União Rotativa Modelo X'} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{isService ? 'Valor Contratado (R$)' : 'Orçamento Previsto (R$)'}</label><input type="number" step="0.01" value={isService ? form.contracted_value : form.budget} onChange={e => setForm({ ...form, [isService ? 'contracted_value' : 'budget']: e.target.value })} className="input-field" /></div>
      </div>

      <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" placeholder={isService ? 'Detalhes do serviço' : 'Componentes: carcaça, rolamento, rotor...'} /></div>

      {isService && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">N° Ordem de Serviço</label><input type="text" value={form.os_number} onChange={e => setForm({ ...form, os_number: e.target.value })} className="input-field" placeholder="OS-001" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">NF de Remessa</label><input type="text" value={form.nf_remessa} onChange={e => setForm({ ...form, nf_remessa: e.target.value })} className="input-field" placeholder="NF 12345" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Reforma</label><input type="text" value={form.repair_type} onChange={e => setForm({ ...form, repair_type: e.target.value })} className="input-field" placeholder="Retífica, Recondicionamento..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Prazo Prometido</label><input type="date" value={form.promised_deadline} onChange={e => setForm({ ...form, promised_deadline: e.target.value })} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Entrega Real</label><input type="date" value={form.actual_delivery} onChange={e => setForm({ ...form, actual_delivery: e.target.value })} className="input-field" /></div>
          </div>
        </>
      )}

      <div className="flex gap-3"><button onClick={onCancel} className="btn-secondary flex-1">Cancelar</button><button onClick={onSave} className="btn-primary flex-1">{buttonLabel}</button></div>
    </div>
  );
}
