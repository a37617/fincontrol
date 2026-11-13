import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BillsList from './pages/BillsList';
import BillForm from './pages/BillForm';
import BillsRecurring from './pages/BillsRecurring';
import NfeImport from './pages/NfeImport';
import CostCenters from './pages/CostCenters';
import Inventory from './pages/Inventory';
import Categories from './pages/Categories';
import BankAccounts from './pages/BankAccounts';
import Reports from './pages/Reports';
import Installments from './pages/Installments';
import Users from './pages/Users';
import Incomes from './pages/Incomes';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import PurchaseTabs from './pages/PurchaseTabs';
import PurchaseOrders from './pages/PurchaseOrders';
import CashFlow from './pages/CashFlow';
import ActivityLog from './pages/ActivityLog';
import BillsPrint from './pages/BillsPrint';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen bg-gray-50">
        <div className="p-8">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/bills" element={<ProtectedRoute><BillsList /></ProtectedRoute>} />
            <Route path="/bills/new" element={<ProtectedRoute><BillForm /></ProtectedRoute>} />
            <Route path="/bills/print" element={<ProtectedRoute><BillsPrint /></ProtectedRoute>} />
            <Route path="/bills/recurring" element={<ProtectedRoute><BillsRecurring /></ProtectedRoute>} />
            <Route path="/nfe-import" element={<ProtectedRoute><NfeImport /></ProtectedRoute>} />
            <Route path="/cost-centers" element={<ProtectedRoute><CostCenters /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
            <Route path="/bank-accounts" element={<ProtectedRoute><BankAccounts /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/installments" element={<ProtectedRoute><Installments /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="/incomes" element={<ProtectedRoute><Incomes /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="/suppliers/:id" element={<ProtectedRoute><SupplierDetail /></ProtectedRoute>} />
            <Route path="/purchase-tabs" element={<ProtectedRoute><PurchaseTabs /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
            <Route path="/cashflow" element={<ProtectedRoute><CashFlow /></ProtectedRoute>} />
            <Route path="/activity-log" element={<ProtectedRoute><ActivityLog /></ProtectedRoute>} />
            <Route path="/login" element={<Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
