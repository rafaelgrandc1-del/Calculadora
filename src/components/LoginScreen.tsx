import React, { useState } from 'react';
import { UserRole, UserAccount } from '../types';
import { ShieldCheck, User, Sparkles, UserPlus, Key, Info } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
  sellers: UserAccount[];
  onRegisterSeller: (name: string, email: string, commRate: number) => UserAccount;
}

export function LoginScreen({ onLoginSuccess, sellers, onRegisterSeller }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Simulated password
  
  // Registration form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newComm, setNewComm] = useState(50); // Default 50% according to store policy

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.toLowerCase().trim();

    // Check Admin default credentials
    if (cleanEmail === 'admin@3dmemories.com') {
      const adminUser: UserAccount = {
        id: 'admin',
        email: 'admin@3dmemories.com',
        name: '3D Memories (Admin)',
        role: UserRole.ADMIN,
        commissionRate: 0,
        createdAt: new Date().toISOString(),
      };
      onLoginSuccess(adminUser);
      return;
    }

    // Check Seller list
    const foundSeller = sellers.find(s => s.email.toLowerCase().trim() === cleanEmail);
    if (foundSeller) {
      onLoginSuccess(foundSeller);
    } else {
      setErrorMsg('E-mail não encontrado. Digite um e-mail válido ou use os atalhos abaixo.');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newName.trim() || !newEmail.trim()) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const cleanEmail = newEmail.toLowerCase().trim();
    if (cleanEmail === 'admin@3dmemories.com' || sellers.some(s => s.email.toLowerCase().trim() === cleanEmail)) {
      setErrorMsg('Este e-mail já está sendo utilizado no sistema.');
      return;
    }

    const newSeller = onRegisterSeller(newName, newEmail, Number(newComm));
    setSuccessMsg(`Cadastro realizado com sucesso! Você já pode entrar com o e-mail: ${cleanEmail}`);
    setEmail(cleanEmail);
    setIsRegistering(false);
    
    // Clear registration fields
    setNewName('');
    setNewEmail('');
    setNewComm(50);
  };

  // Quick testing accounts trigger
  const handleQuickLogin = (role: UserRole, sellerAccount?: UserAccount) => {
    if (role === UserRole.ADMIN) {
      onLoginSuccess({
        id: 'admin',
        email: 'admin@3dmemories.com',
        name: '3D Memories (Admin)',
        role: UserRole.ADMIN,
        commissionRate: 0,
        createdAt: new Date().toISOString(),
      });
    } else if (sellerAccount) {
      onLoginSuccess(sellerAccount);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden" id="login-container">
      {/* Decorative background details */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Container holding Logo and card */}
      <div className="w-full max-w-md z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8" id="brand-header">
          <div className="inline-flex items-center justify-center p-3.5 bg-gradient-to-br from-cyan-400 to-indigo-500 rounded-2xl shadow-xl shadow-cyan-950/40 mb-3 animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
            3D Memories
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Calculadora de Margens & Comissões Shopee
          </p>
        </div>

        {/* Login/Register Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative" id="auth-card">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-800 mb-6" id="auth-tabs">
            <button
              id="tab-login"
              type="button"
              onClick={() => { setIsRegistering(false); setErrorMsg(''); }}
              className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
                !isRegistering
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Entrar na Conta
            </button>
            <button
              id="tab-register"
              type="button"
              onClick={() => { setIsRegistering(true); setErrorMsg(''); }}
              className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
                isRegistering
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Criar Cadastro Vendedor
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-800/60 text-red-300 text-xs px-3.5 py-2.5 rounded-lg mb-4 flex items-start gap-2" id="login-error-alert">
              <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs px-3.5 py-2.5 rounded-lg mb-4 flex items-start gap-2" id="login-success-alert">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {!isRegistering ? (
            /* Login Form */
            <form onSubmit={handleLogin} id="login-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    E-mail de Cadastro
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      id="login-input-email"
                      type="email"
                      required
                      placeholder="seu-nome@parceiro.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 flex justify-between">
                    <span>Senha</span>
                    <span className="text-slate-500 normal-case font-normal">(Qualquer senha p/ teste)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Key className="w-4 h-4" />
                    </span>
                    <input
                      id="login-input-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <button
                  id="btn-submit-login"
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-95 text-white py-2.5 rounded-xl text-sm font-semibold transition-all mt-4 hover:shadow-lg hover:shadow-cyan-950/20 active:scale-[0.98]"
                >
                  Entrar no Painel
                </button>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegister} id="register-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Nome Completo do Vendedor
                  </label>
                  <input
                    id="register-input-name"
                    type="text"
                    required
                    placeholder="Ex: João Pedro Sales"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white rounded-xl py-2.5 px-4 text-sm outline-none transition-all placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    E-mail de Acesso
                  </label>
                  <input
                    id="register-input-email"
                    type="email"
                    required
                    placeholder="joao@parceiro.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white rounded-xl py-2.5 px-4 text-sm outline-none transition-all placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 flex justify-between">
                    <span>% de Comissão de Venda</span>
                    <span className="text-cyan-400 font-bold">{newComm}%</span>
                  </label>
                  <input
                    id="register-input-comm"
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={newComm}
                    onChange={(e) => setNewComm(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1%</span>
                    <span className="text-cyan-400 font-semibold font-mono">50% (Padrão)</span>
                    <span>100%</span>
                  </div>
                </div>

                <button
                  id="btn-submit-register"
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-95 text-white py-2.5 rounded-xl text-sm font-semibold transition-all mt-4 hover:shadow-lg active:scale-[0.98]"
                >
                  Registrar Nova Conta
                </button>
              </div>
            </form>
          )}

          {/* Quick-Access Credentials Section */}
          <div className="mt-8 border-t border-slate-800/80 pt-5" id="quick-login-section">
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 text-center">
              Acesso Rápido para Teste
            </h3>
            
            <div className="grid grid-cols-1 gap-2.5">
              {/* Producer Access Button */}
              <button
                id="quick-admin-login"
                type="button"
                onClick={() => handleQuickLogin(UserRole.ADMIN)}
                className="flex items-center gap-3 bg-slate-950 hover:bg-slate-800 border border-cyan-950/55 hover:border-cyan-800/50 rounded-xl p-3 text-left transition-all"
              >
                <div className="p-2.5 bg-cyan-950 rounded-lg text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-200">
                    Entrar como Produtor (3D Memories)
                  Admin principal
                  </span>
                  <span className="block text-[10px] text-cyan-400 font-mono">admin@3dmemories.com</span>
                </div>
              </button>

              {/* Sellers Access Section */}
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/50">
                <span className="block text-[10px] text-slate-500 font-semibold mb-1.5 ml-1 text-center">
                  VENDEDORES PARCEIROS REGISTRADOS:
                </span>
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {sellers.map((s) => (
                    <button
                      id={`quick-seller-${s.id}`}
                      key={s.id}
                      type="button"
                      onClick={() => handleQuickLogin(UserRole.SELLER, s)}
                      className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-cyan-400 text-[10px] font-mono font-bold">
                        {s.commissionRate}% Com.
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-5">
            <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1">
              <span>Sua base de dados local é persistida no seu navegador.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
