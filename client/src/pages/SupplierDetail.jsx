import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ArrowLeft, Truck, FileText, ShoppingBag, ClipboardList, TrendingDown, DollarSign, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bills');

  useEffect(() => {
    api.get(`/suppliers/${id}/history`).then(r => { setData(r.data); setLoading(false); }).catch(() => { setLoading(false); });
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-400">Fornecedor não encontrado</div>;

  const { supplier, bills, purchaseOrders, purchaseTabs, priceHistory, totals } = data;

  const statusLabel = (s) => {
    if (s === 'paid') return <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Pago</span>;
    if (s === 'overdue') return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Atrasado</span>;
    return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pendente</span>;
  };

  const today = new Date().toISOString().split('T')[0];

  const tabs = [
    { key: 'bills', label: 'Contas a Pagar', icon: FileText, count: bills.length },
    { key: 'orders', label: 'Ordens de Compra', icon: ClipboardList, count: purchaseOrders.length },
    { key: 'tabs', label: 'Compras em Vale', icon: ShoppingBag, count: purchaseTabs.length },
    { key: 'prices', label: 'Histórico de Preços', icon: TrendingDown, count: priceHistory.length },
  ];

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/suppliers')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <Truck className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
            <div className="flex gap-3 text-sm text-gray-500">
              {supplier.trade_name && <span>{supplier.trade_name}</span>}
              {supplier.cnpj && <span>CNPJ: {supplier.cnpj}</span>}
              {supplier.product_category && <span className="text-orange-600">{supplier.product_category}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-blue-500" /><span className="text-xs text-gray-500">Total Compras</span></div>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(totals.total_amount)}</p>
          <p className="text-xs text-gray-400">{totals.total_bills} conta(s)</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-gray-500">Total Pago</span></div>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.total_paid)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-gray-500">Pendente</span></div>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(totals.total_pending)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs text-gray-500">Atrasado</span></div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(bills.filter(b => b.status !== 'paid' && b.due_date < today).reduce((s, b) => s + (b.amount || 0), 0))}</p>
        </div>
      </div>

      {/* Info do fornecedor */}
      {(supplier.phone || supplier.email || supplier.address || supplier.contact_person) && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {supplier.contact_person && <div><span className="text-gray-400 text-xs block">Contato</span><span className="text-gray-800">{supplier.contact_person}</span></div>}
            {supplier.phone && <div><span className="text-gray-400 text-xs block">Telefone</span><span className="text-gray-800">{supplier.phone}</span></div>}
            {supplier.email && <div><span className="text-gray-400 text-xs block">Email</span><span className="text-gray-800">{supplier.email}</span></div>}
            {supplier.city && <div><span className="text-gray-400 text-xs block">Cidade</span><span className="text-gray-800">{supplier.city}{supplier.state ? `/${supplier.state}` : ''}</span></div>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo das tabs */}
      <div className="bg-white rounded-xl border">
        {activeTab === 'bills' && (
          bills.length === 0 ? <div className="text-center py-12 text-gray-400">Nenhuma conta encontrada</div> : (
            <div className="divide-y">
              {bills.map(b => (
                <div key={b.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{b.description}</p>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                      {b.nfe_number && <span>NF-e: {b.nfe_number}</span>}
                      {b.category_name && <span>{b.category_name}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-800">{formatCurrency(b.amount)}</p>
                    <p className="text-xs text-gray-400">{formatDate(b.due_date)}</p>
                  </div>
                  <div className="shrink-0">
                    {b.status === 'paid' ? statusLabel('paid') : b.due_date < today ? statusLabel('overdue') : statusLabel('pending')}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'orders' && (
          purchaseOrders.length === 0 ? <div className="text-center py-12 text-gray-400">Nenhuma ordem de compra</div> : (
            <div className="divide-y">
              {purchaseOrders.map(o => (
                <div key={o.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">OC #{o.order_number}</p>
                    <p className="text-xs text-gray-400">{o.notes || 'Sem observações'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{formatCurrency(o.total)}</p>
                    <p className="text-xs text-gray-400">{formatDate(o.created_at)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : o.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {o.status === 'draft' ? 'Rascunho' : o.status === 'sent' ? 'Enviada' : o.status === 'approved' ? 'Aprovada' : o.status}
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'tabs' && (
          purchaseTabs.length === 0 ? <div className="text-center py-12 text-gray-400">Nenhuma compra em vale</div> : (
            <div className="divide-y">
              {purchaseTabs.map(t => (
                <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{t.supplier_name}</p>
                    <p className="text-xs text-gray-400">Mês: {t.month}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {t.status === 'open' ? 'Aberto' : 'Fechado'}
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'prices' && (
          priceHistory.length === 0 ? <div className="text-center py-12 text-gray-400">Nenhum histórico de preços</div> : (
            <div className="divide-y">
              {priceHistory.map(p => (
                <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{p.item_description}</p>
                    <p className="text-xs text-gray-400">{p.source === 'nfe' ? 'Via NF-e' : 'Manual'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{formatCurrency(p.unit_price)}</p>
                    <p className="text-xs text-gray-400">{formatDate(p.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
