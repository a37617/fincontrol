import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Tags, Plus, Edit3, Trash2 } from 'lucide-react';

const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#6366f1','#8b5cf6','#ec4899','#06b6d4','#14b8a6','#94a3b8','#0ea5e9'];

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#3b82f6', budget: 0 });

  const load = () => api.get('/categories').then(r => setCategories(r.data));
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name) return;
    if (editing) { await api.put(`/categories/${editing.id}`, form); }
    else { await api.post('/categories', form); }
    setShowModal(false); setEditing(null); setForm({ name: '', color: '#3b82f6', budget: 0 }); load();
  };

  const handleEdit = (cat) => { setEditing(cat); setForm({ name: cat.name, color: cat.color, budget: cat.budget || 0 }); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta categoria?')) return;
    await api.delete(`/categories/${id}`); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-gray-500 text-sm mt-1">Organize suas contas por tipo</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', color: '#3b82f6' }); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Categoria</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
              </div>
              <h3 className="font-semibold text-gray-900 flex-1">{cat.name}</h3>
            </div>
            {cat.budget > 0 && <p className="text-xs text-gray-500 mb-2">Orçamento: R$ {Number(cat.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleEdit(cat)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editar</button>
              <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Excluir</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Editar Categoria' : 'Nova Categoria'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Ex: Insumos para Produção" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Orçamento Mensal (R$)</label>
            <input type="number" step="0.01" min="0" value={form.budget || ''} onChange={e => setForm({ ...form, budget: parseFloat(e.target.value) || 0 })} className="input-field" placeholder="0,00 (opcional)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(color => (
                <button key={color} onClick={() => setForm({ ...form, color })}
                  className={`w-8 h-8 rounded-lg transition-all ${form.color === color ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditing(null); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} className="btn-primary flex-1">{editing ? 'Atualizar' : 'Criar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
