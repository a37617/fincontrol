import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { Truck, Plus, Edit3, Trash2, Search, Phone, Mail, MapPin, Eye } from 'lucide-react';

export default function Suppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', trade_name: '', cnpj: '', phone: '', email: '', contact_person: '', address: '', city: '', state: '', notes: '', product_category: '' });

  const load = () => {
    const params = search ? `?search=${search}` : '';
    api.get(`/suppliers${params}`).then(r => setSuppliers(r.data));
  };
  useEffect(() => { load(); }, [search]);

  const handleSave = async () => {
    if (!form.name) return alert('Nome é obrigatório');
    try {
      if (editing) { await api.put(`/suppliers/${editing.id}`, form); }
      else { await api.post('/suppliers', form); }
      setShowModal(false); setEditing(null);
      setForm({ name: '', trade_name: '', cnpj: '', phone: '', email: '', contact_person: '', address: '', city: '', state: '', notes: '', product_category: '' });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, trade_name: s.trade_name || '', cnpj: s.cnpj || '', phone: s.phone || '', email: s.email || '', contact_person: s.contact_person || '', address: s.address || '', city: s.city || '', state: s.state || '', notes: s.notes || '', product_category: s.product_category || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este fornecedor?')) return;
    await api.delete(`/suppliers/${id}`); load();
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', trade_name: '', cnpj: '', phone: '', email: '', contact_person: '', address: '', city: '', state: '', notes: '' });
    setShowModal(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-gray-500 text-sm mt-1">Cadastro de fornecedores e parceiros</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Fornecedor</button>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar por nome, nome fantasia ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="card text-center py-12 text-gray-400"><Truck className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum fornecedor cadastrado</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <div key={s.id} className="card hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Truck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{s.name}</h3>
                    {s.trade_name && <p className="text-xs text-gray-500">{s.trade_name}</p>}
                  </div>
                </div>
              </div>
              {s.product_category && <p className="text-xs mb-2"><span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{s.product_category}</span></p>}
              {s.cnpj && <p className="text-sm text-gray-600 mb-1">CNPJ: {s.cnpj}</p>}
              {s.contact_person && <p className="text-sm text-gray-600 mb-1">Contato: {s.contact_person}</p>}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                {s.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.city}{s.state ? `/${s.state}` : ''}</span>}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => navigate(`/suppliers/${s.id}`)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Eye className="w-3 h-3" /> Detalhes</button>
                <button onClick={() => handleEdit(s)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editar</button>
                <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Razão social da empresa" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label><input type="text" value={form.trade_name} onChange={e => setForm({ ...form, trade_name: e.target.value })} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label><input type="text" value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} className="input-field" placeholder="00.000.000/0000-00" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label><input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="(00) 00000-0000" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Pessoa de Contato</label><input type="text" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoria de Produtos</label><input type="text" value={form.product_category} onChange={e => setForm({ ...form, product_category: e.target.value })} className="input-field" placeholder="Ex: Rolamentos, Fundição, Escritório..." /></div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label><input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label><input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">UF</label><input type="text" maxLength={2} value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} className="input-field" placeholder="RS" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Observações</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" rows={2} /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditing(null); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} className="btn-primary flex-1">{editing ? 'Atualizar' : 'Cadastrar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
