import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/formatters';
import { Repeat, Plus, Play, Trash2 } from 'lucide-react';

export default function BillsRecurring() {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', due_day: '', category_id: '', supplier: '', value_type: 'fixed', payment_source: '', due_type: 'fixed' });
  const [generating, setGenerating] = useState(false);

  const load = () => {
    api.get('/recurring').then(r => setTemplates(r.data));
    api.get('/categories').then(r => setCategories(r.data));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const isLastBizDay = form.due_type === 'last_business_day';
    if (!form.description || !form.amount || (!isLastBizDay && !form.due_day)) return alert('Preencha os campos obrigatórios');
    await api.post('/recurring', {
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      due_day: isLastBizDay ? 0 : parseInt(form.due_day),
      category_id: form.category_id || null,
      supplier: form.supplier,
      value_type: form.value_type,
      payment_source: form.payment_source,
    });
    setShowModal(false);
    setForm({ description: '', amount: '', due_day: '', category_id: '', supplier: '', value_type: 'fixed', payment_source: '', due_type: 'fixed' });
    load();
  };

  const generateMonth = async () => {
    if (!confirm('Gerar contas fixas para o mês atual? Contas já geradas não serão duplicadas.')) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/recurring/generate', {});
      alert(data.generated > 0 ? `${data.generated} conta(s) gerada(s) para ${data.month}` : 'Todas as contas do mês já foram geradas anteriormente.');
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao gerar');
    }
    setGenerating(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este modelo de conta fixa?')) return;
    await api.delete(`/recurring/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas Fixas (Recorrentes)</h1>
          <p className="text-gray-500 text-sm mt-1">Modelos de contas que se repetem todo mês</p>
        </div>
        <div className="flex gap-3">
          <button onClick={generateMonth} disabled={generating || templates.length === 0} className="btn-secondary flex items-center gap-2">
            <Play className="w-4 h-4" /> {generating ? 'Gerando...' : 'Gerar Mês Atual'}
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Conta Fixa</button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
        Cadastre aqui os modelos de contas fixas. Clique em <strong>"Gerar Mês Atual"</strong> para criar as contas do mês na lista principal. Contas já geradas não são duplicadas.
      </div>

      {templates.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Repeat className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma conta fixa cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tpl => (
            <div key={tpl.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{tpl.description}</h3>
                  {tpl.supplier && <p className="text-sm text-gray-500">{tpl.supplier}</p>}
                </div>
                <button onClick={() => handleDelete(tpl.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-3">{tpl.value_type === 'variable' ? 'Variável' : formatCurrency(tpl.amount)}</p>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <Repeat className="w-4 h-4" /> {tpl.due_day === 0 ? 'Último dia útil do mês' : `Dia ${tpl.due_day} de cada mês`}
              </div>
              <div className="flex gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${tpl.value_type === 'variable' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {tpl.value_type === 'variable' ? 'Valor Variável' : 'Valor Fixo'}
                </span>
                {tpl.payment_source && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {{ boleto: 'Boleto', dda: 'DDA', pix: 'PIX', debito_auto: 'Déb. Auto' }[tpl.payment_source] || tpl.payment_source}
                </span>}
              </div>
              {tpl.category_name && (
                <span className="inline-flex items-center gap-1 mt-2 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tpl.category_color }} />
                  {tpl.category_name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Conta Fixa">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Ex: Aluguel" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Valor</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, value_type: 'fixed' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.value_type === 'fixed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>Fixo (ex: Aluguel)</button>
              <button type="button" onClick={() => setForm({ ...form, value_type: 'variable' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.value_type === 'variable' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>Variável (ex: Luz)</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{form.value_type === 'variable' ? 'Valor Estimado (R$)' : 'Valor (R$) *'}</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input-field" placeholder={form.value_type === 'variable' ? 'Opcional' : ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dia do Vencimento {form.due_type !== 'last_business_day' ? '*' : ''}</label>
              {form.due_type === 'last_business_day' ? (
                <div className="input-field bg-gray-50 text-gray-500 flex items-center">Automático</div>
              ) : (
                <input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm({ ...form, due_day: e.target.value })} className="input-field" />
              )}
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                <input type="checkbox" checked={form.due_type === 'last_business_day'} onChange={e => setForm({ ...form, due_type: e.target.checked ? 'last_business_day' : 'fixed', due_day: e.target.checked ? '' : form.due_day })} className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                <span className="text-xs text-gray-500">Último dia útil do mês</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="input-field">
              <option value="">Selecione</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
              <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Como Pagar</label>
              <select value={form.payment_source} onChange={e => setForm({ ...form, payment_source: e.target.value })} className="input-field">
                <option value="">Selecione</option>
                <option value="boleto">Pegar Boleto</option>
                <option value="dda">DDA</option>
                <option value="pix">PIX</option>
                <option value="debito_auto">Débito Automático</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
