import { useState, useEffect } from 'react';
import api from '../api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Upload, FileText, Package, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

export default function NfeImport() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [categories, setCategories] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data));
    api.get('/cost-centers').then(r => setCostCenters(r.data));
  }, []);

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xml')) {
      setError('Selecione um arquivo .xml');
      return;
    }
    setFile(f); setError(''); setParsed(null); setResult(null);
    setLoading(true);
    const formData = new FormData();
    formData.append('xml', f);
    try {
      const { data } = await api.post('/nfe/parse', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (!data.supplier && !data.products?.length) {
        setError('XML processado mas não contém dados de NF-e válidos');
      } else {
        setParsed(data);
      }
    } catch (err) {
      console.error('Erro NF-e:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao processar XML');
    }
    setLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith('.xml')) {
      const dt = new DataTransfer(); dt.items.add(f);
      handleFileChange({ target: { files: dt.files } });
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setLoading(true);
    try {
      const { data } = await api.post('/nfe/import', { ...parsed, category_id: categoryId || null, cost_center_id: costCenterId || null });
      setResult(data);
    } catch (err) { setError(err.response?.data?.error || 'Erro ao importar'); }
    setLoading(false);
  };

  const reset = () => { setFile(null); setParsed(null); setResult(null); setError(''); setCategoryId(''); setCostCenterId(''); };

  if (result) return (
    <div className="max-w-lg mx-auto mt-12 text-center">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">NF-e Importada com Sucesso!</h2>
      <div className="bg-gray-50 rounded-xl p-4 mt-4 space-y-2 text-sm">
        <p><span className="font-medium">{result.bills_created}</span> conta(s) a pagar criada(s)</p>
        <p><span className="font-medium">{result.inventory_updated}</span> item(ns) adicionado(s) ao estoque</p>
      </div>
      <button onClick={reset} className="btn-primary mt-6">Importar Outra NF-e</button>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Importar Nota Fiscal Eletrônica</h1>
      <p className="text-gray-500 text-sm mb-6">Faça upload do XML da NF-e para cadastrar contas e estoque automaticamente</p>

      {!parsed ? (
        <div className="card">
          <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-primary-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById('xmlInput').click()}>
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Arraste o arquivo XML aqui ou clique para selecionar</p>
            <p className="text-gray-400 text-sm mt-2">Aceita arquivos .xml de NF-e (padrão SEFAZ)</p>
            <input id="xmlInput" type="file" accept=".xml" onChange={handleFileChange} className="hidden" />
          </div>
          {loading && <p className="text-center mt-4 text-primary-600">Processando XML...</p>}
          {error && <div className="mt-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary-500" /> Dados da Nota</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-xs text-gray-500">Fornecedor</p><p className="font-medium">{parsed.supplier}</p></div>
              <div><p className="text-xs text-gray-500">Número NF</p><p className="font-medium">{parsed.nfeNumber}</p></div>
              <div><p className="text-xs text-gray-500">Valor Total</p><p className="font-bold text-lg">{formatCurrency(parsed.totalValue)}</p></div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-primary-500" /> Produtos ({parsed.products.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="text-left px-4 py-2">Produto</th><th className="text-right px-4 py-2">Qtd</th><th className="text-center px-4 py-2">Un</th><th className="text-right px-4 py-2">V. Unit.</th><th className="text-right px-4 py-2">Total</th></tr></thead>
                <tbody>{parsed.products.map((p, i) => (
                  <tr key={i} className="border-t"><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2 text-right">{p.quantity}</td><td className="px-4 py-2 text-center">{p.unit}</td><td className="px-4 py-2 text-right">{formatCurrency(p.unit_cost)}</td><td className="px-4 py-2 text-right font-medium">{formatCurrency(p.total)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-primary-500" /> Parcelas ({parsed.installments.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="text-left px-4 py-2">Parcela</th><th className="text-left px-4 py-2">Vencimento</th><th className="text-right px-4 py-2">Valor</th></tr></thead>
                <tbody>{parsed.installments.map((inst, i) => (
                  <tr key={i} className="border-t"><td className="px-4 py-2">{inst.number}</td><td className="px-4 py-2">{formatDate(inst.due_date)}</td><td className="px-4 py-2 text-right font-medium">{formatCurrency(inst.amount)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Configuração da Importação</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria das Contas</label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input-field">
                  <option value="">Selecione</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custos (opcional)</label>
                <select value={costCenterId} onChange={e => setCostCenterId(e.target.value)} className="input-field">
                  <option value="">Nenhum</option>
                  {costCenters.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleImport} disabled={loading} className="btn-primary flex items-center gap-2">{loading ? 'Importando...' : 'Importar NF-e'}</button>
              <button onClick={reset} className="btn-secondary">Cancelar</button>
            </div>
          </div>
          {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
        </div>
      )}
    </div>
  );
}
