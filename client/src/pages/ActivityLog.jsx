import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
  Activity,
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  Clock,
  User,
  Filter,
} from 'lucide-react';

const LIMIT = 50;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

const ACTION_ICONS = {
  create: Plus,
  update: Edit3,
  delete: Trash2,
  payment: CheckCircle,
};

const ENTITY_BADGE_COLORS = {
  bill: 'bg-red-100 text-red-700',
  purchase_order: 'bg-blue-100 text-blue-700',
  payment: 'bg-green-100 text-green-700',
  income: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-orange-100 text-orange-700',
  client: 'bg-purple-100 text-purple-700',
  supplier: 'bg-indigo-100 text-indigo-700',
};

const ENTITY_LABELS = {
  bill: 'Conta',
  purchase_order: 'Ordem de Compra',
  payment: 'Pagamento',
  income: 'Receita',
  expense: 'Despesa',
  client: 'Cliente',
  supplier: 'Fornecedor',
};

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'bill', label: 'Contas' },
  { value: 'purchase_order', label: 'Ordens de Compra' },
  { value: 'payment', label: 'Pagamentos' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'client', label: 'Clientes' },
  { value: 'supplier', label: 'Fornecedores' },
];

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = useCallback(
    async (currentOffset, append = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: LIMIT,
          offset: currentOffset,
        });
        if (entityFilter) {
          params.append('entity_type', entityFilter);
        }
        const { data } = await api.get(`/activity-log?${params.toString()}`);
        setLogs((prev) => (append ? [...prev, ...data.logs] : data.logs));
        setTotal(data.total);
      } catch (err) {
        console.error('Erro ao carregar log de atividades:', err);
      } finally {
        setLoading(false);
      }
    },
    [entityFilter]
  );

  useEffect(() => {
    setOffset(0);
    fetchLogs(0, false);
  }, [fetchLogs]);

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchLogs(newOffset, true);
  };

  const hasMore = logs.length < total;

  const getActionIcon = (action) => {
    const Icon = ACTION_ICONS[action] || Activity;
    return Icon;
  };

  const getBadgeColor = (entityType) =>
    ENTITY_BADGE_COLORS[entityType] || 'bg-gray-100 text-gray-700';

  const getEntityLabel = (entityType) =>
    ENTITY_LABELS[entityType] || entityType;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Log de Atividades</h1>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      {logs.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Clock className="w-12 h-12 mb-4" />
          <p className="text-lg font-medium">Nenhuma atividade registrada</p>
          <p className="text-sm mt-1">As atividades aparecerão aqui conforme forem realizadas.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

          <ul className="space-y-4">
            {logs.map((log) => {
              const Icon = getActionIcon(log.action);
              return (
                <li key={log.id} className="relative flex items-start gap-4 pl-12">
                  {/* Icon circle */}
                  <div className="absolute left-2.5 w-5 h-5 rounded-full bg-white border-2 border-indigo-400 flex items-center justify-center">
                    <Icon className="w-3 h-3 text-indigo-600" />
                  </div>

                  {/* Card */}
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-800">
                          {log.user_name}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(
                            log.entity_type
                          )}`}
                        >
                          {getEntityLabel(log.entity_type)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(log.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{log.details}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}
