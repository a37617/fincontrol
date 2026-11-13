import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { LayoutDashboard, FileText, FilePlus, Repeat, CreditCard, FolderTree, Package, Tags, Building2, Upload, BarChart3, LogOut, ListChecks, Users, TrendingUp, Truck, ShoppingBag, ClipboardList, Activity, Wallet, Database } from 'lucide-react';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/incomes', icon: TrendingUp, label: 'Entradas' },
  { to: '/bills', icon: FileText, label: 'Contas a Pagar' },
  { to: '/bills/new', icon: FilePlus, label: 'Nova Conta' },
  { to: '/bills/recurring', icon: Repeat, label: 'Contas Fixas' },
  { to: '/installments', icon: ListChecks, label: 'Parcelamentos' },
  { to: '/nfe-import', icon: Upload, label: 'Importar NF-e' },
  { to: '/cost-centers', icon: FolderTree, label: 'Centro de Custos' },
  { to: '/inventory', icon: Package, label: 'Estoque' },
  { to: '/categories', icon: Tags, label: 'Categorias' },
  { to: '/bank-accounts', icon: Building2, label: 'Contas Bancárias' },
  { to: '/suppliers', icon: Truck, label: 'Fornecedores' },
  { to: '/purchase-tabs', icon: ShoppingBag, label: 'Compras em Vale' },
  { to: '/purchase-orders', icon: ClipboardList, label: 'Ordens de Compra' },
  { to: '/cashflow', icon: Wallet, label: 'Fluxo de Caixa' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/activity-log', icon: Activity, label: 'Log de Atividades' },
  { to: '/users', icon: Users, label: 'Usuários' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-sidebar min-h-screen flex flex-col fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">FinControl</h1>
            <p className="text-gray-400 text-xs">Sistema Financeiro</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-sidebar-light hover:text-white'}`
          }>
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 px-3">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-gray-400 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={async () => {
          try {
            const res = await api.get('/backup/download', { responseType: 'blob' });
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fincontrol-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            localStorage.setItem('lastBackupDate', new Date().toISOString());
          } catch { alert('Erro ao gerar backup'); }
        }} className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-blue-400 text-sm w-full rounded-lg hover:bg-sidebar-light transition-colors mb-1">
          <Database className="w-4 h-4" /> Backup
        </button>
        <button onClick={logout} className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 text-sm w-full rounded-lg hover:bg-sidebar-light transition-colors">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
