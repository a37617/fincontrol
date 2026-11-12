import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Users as UsersIcon, Plus, Edit3, Trash2, Shield, User } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.email) return alert('Nome e email são obrigatórios');
    if (!editing && !form.password) return alert('Senha é obrigatória para novos usuários');
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post('/users', form);
      }
      setShowModal(false); setEditing(null); setForm({ name: '', email: '', password: '', role: 'user' }); load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar');
    }
  };

  const handleEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este usuário?')) return;
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os acessos ao sistema</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', email: '', password: '', role: 'user' }); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Usuário</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <div key={u.id} className="card hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${u.role === 'admin' ? 'bg-amber-100' : 'bg-primary-100'}`}>
                  {u.role === 'admin' ? <Shield className="w-6 h-6 text-amber-600" /> : <User className="w-6 h-6 text-primary-600" />}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{u.name}</h3>
                  <p className="text-sm text-gray-500">{u.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                {u.role === 'admin' ? 'Administrador' : 'Usuário'}
              </span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(u)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editar</button>
                <button onClick={() => handleDelete(u.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Editar Usuário' : 'Novo Usuário'}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nome completo" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="email@empresa.com" /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{editing ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field" placeholder={editing ? 'Deixe vazio para não alterar' : 'Mínimo 6 caracteres'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field">
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditing(null); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} className="btn-primary flex-1">{editing ? 'Atualizar' : 'Criar Usuário'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
