import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { formatCurrency, formatDate, getDayName } from '../utils/formatters';
import { ArrowLeft, Printer } from 'lucide-react';

export default function BillsPrint() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const period = searchParams.get('period') || 'month';
  const statusFilter = searchParams.get('status') || '';
  const categoryFilter = searchParams.get('category_id') || '';
  const searchQ = searchParams.get('search') || '';

  useEffect(() => {
    const params = new URLSearchParams();
    if (period && period !== 'all') params.set('period', period);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category_id', categoryFilter);
    if (searchQ) params.set('search', searchQ);
    api.get(`/bills?${params}`).then(r => { setBills(r.data); setLoading(false); });
  }, [period, statusFilter, categoryFilter, searchQ]);

  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';
  const monthEndDate = new Date();
  monthEndDate.setMonth(monthEndDate.getMonth() + 1);
  monthEndDate.setDate(0);
  const monthEnd = monthEndDate.toISOString().split('T')[0];

  const weekBills = bills.filter(b => b.due_date >= today && b.due_date <= weekEndStr);
  const monthBills = bills.filter(b => b.due_date >= monthStart && b.due_date <= monthEnd);

  const totalGeral = bills.reduce((s, b) => s + b.amount, 0);
  const totalSemana = weekBills.reduce((s, b) => s + b.amount, 0);
  const totalMes = monthBills.reduce((s, b) => s + b.amount, 0);
  const totalPendente = bills.filter(b => b.status !== 'paid').reduce((s, b) => s + b.amount, 0);
  const totalPago = bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0);

  const periodLabel = { day: 'Hoje', week: 'Semana', month: 'Mês', all: 'Todas' }[period] || period;

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>;

  return (
    <div>
      <div className="print:hidden flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/bills')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Impressão de Contas</h1>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div className="print-content">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-content, .print-content * { visibility: visible; }
            .print-content { position: absolute; left: 0; top: 0; width: 100%; padding: 10mm; }
            .print\\:hidden { display: none !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
          }
          .print-content { font-family: Arial, sans-serif; color: #111; }
          .print-content table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
          .print-content th, .print-content td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-size: 12px; }
          .print-content th { background-color: #f3f4f6; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #374151; }
          .print-content td.right, .print-content th.right { text-align: right; }
          .print-content .summary-box { display: inline-block; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 16px; margin-right: 12px; margin-bottom: 8px; }
          .print-content .status-paid { color: #16a34a; font-weight: 600; }
          .print-content .status-pending { color: #ca8a04; font-weight: 600; }
          .print-content .status-overdue { color: #dc2626; font-weight: 600; }
        `}</style>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Contas a Pagar — {periodLabel}</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
            Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <div className="summary-box">
            <div style={{ fontSize: 11, color: '#6b7280' }}>Total Listado</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(totalGeral)}</div>
          </div>
          <div className="summary-box">
            <div style={{ fontSize: 11, color: '#6b7280' }}>Semana</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(totalSemana)}</div>
          </div>
          <div className="summary-box">
            <div style={{ fontSize: 11, color: '#6b7280' }}>Mês</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(totalMes)}</div>
          </div>
          <div className="summary-box">
            <div style={{ fontSize: 11, color: '#16a34a' }}>Pago</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{formatCurrency(totalPago)}</div>
          </div>
          <div className="summary-box">
            <div style={{ fontSize: 11, color: '#ca8a04' }}>Pendente</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ca8a04' }}>{formatCurrency(totalPendente)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Vencimento</th>
              <th>Descrição</th>
              <th>Fornecedor</th>
              <th>Categoria</th>
              <th>Como Pagar</th>
              <th className="right">Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill, idx) => {
              const realStatus = bill.status === 'pending' && bill.due_date < today ? 'overdue' : bill.status;
              const statusLabel = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado' }[realStatus] || realStatus;
              const statusClass = { paid: 'status-paid', pending: 'status-pending', overdue: 'status-overdue' }[realStatus] || '';
              const sourceLabel = { boleto: 'Boleto', dda: 'DDA', pix: 'PIX', debito_auto: 'Déb. Auto' }[bill.payment_source] || '';
              return (
                <tr key={bill.id}>
                  <td>{idx + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(bill.due_date)} <span style={{ fontSize: 10, color: '#9ca3af' }}>{getDayName(bill.due_date)}</span></td>
                  <td>{bill.description}{bill.nfe_number ? ` (NF ${bill.nfe_number})` : ''}</td>
                  <td>{bill.supplier || '—'}</td>
                  <td>{bill.category_name || '—'}</td>
                  <td>{sourceLabel || '—'}</td>
                  <td className="right" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(bill.amount)}</td>
                  <td className={statusClass}>{statusLabel}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, backgroundColor: '#f9fafb' }}>
              <td colSpan={6} style={{ textAlign: 'right' }}>Total ({bills.length} contas)</td>
              <td className="right" style={{ whiteSpace: 'nowrap' }}>{formatCurrency(totalGeral)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
