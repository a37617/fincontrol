import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) {
          setError('Informe seu nome.');
          setLoading(false);
          return;
        }
        await register(name, email, password);
      }
      navigate('/');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Ocorreu um erro. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t) => {
    setTab(t);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="w-full max-w-4xl mx-4 grid grid-cols-1 md:grid-cols-2 rounded-2xl shadow-2xl overflow-hidden">
        {/* Left branding panel */}
        <div className="hidden md:flex flex-col justify-between bg-gradient-to-b from-slate-900 to-slate-800 text-white p-10">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-lg">
                FC
              </div>
              <span className="text-2xl font-bold tracking-tight">FinControl</span>
            </div>
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Controle financeiro
              <br />
              simples e eficiente
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Gerencie contas a pagar, acompanhe despesas por categoria,
              visualize tendencias e mantenha suas financas em dia.
            </p>
          </div>

          <div className="space-y-4 mt-8">
            <div className="flex items-center gap-3 text-slate-300 text-sm">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-emerald-400 text-xs font-bold">$</span>
              </div>
              Dashboard com KPIs em tempo real
            </div>
            <div className="flex items-center gap-3 text-slate-300 text-sm">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-blue-400 text-xs font-bold">%</span>
              </div>
              Graficos de despesas e previsao de caixa
            </div>
            <div className="flex items-center gap-3 text-slate-300 text-sm">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-amber-400 text-xs font-bold">!</span>
              </div>
              Alertas de contas vencidas e a vencer
            </div>
          </div>

          <p className="text-slate-600 text-xs mt-10">&copy; 2026 FinControl</p>
        </div>

        {/* Right form panel */}
        <div className="bg-white p-8 md:p-10 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white">
              FC
            </div>
            <span className="text-xl font-bold text-slate-800">FinControl</span>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-slate-100 rounded-lg p-1 mb-8">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                tab === 'login'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LogIn className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              Entrar
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                tab === 'register'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserPlus className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              Criar conta
            </button>
          </div>

          <h3 className="text-xl font-bold text-slate-800 mb-1">
            {tab === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            {tab === 'login'
              ? 'Acesse sua conta para continuar'
              : 'Preencha os dados para comecar'}
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nome
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Aguarde...'
                : tab === 'login'
                ? 'Entrar'
                : 'Criar conta'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
