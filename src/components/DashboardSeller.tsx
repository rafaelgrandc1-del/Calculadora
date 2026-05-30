import React, { useMemo, useState } from 'react';
import { UserAccount, ConcludedOrder } from '../types';
import { 
  DollarSign, 
  TrendingUp, 
  FileSpreadsheet, 
  LogOut, 
  Sparkles, 
  Info, 
  HelpCircle, 
  Calendar, 
  Clock, 
  Award 
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

interface DashboardSellerProps {
  currentUser: UserAccount;
  orders: ConcludedOrder[];
  onLogOut: () => void;
}

export function DashboardSeller({
  currentUser,
  orders,
  onLogOut
}: DashboardSellerProps) {
  // Target commission goal for the month (gamification)
  const [comissionGoal, setComissionGoal] = useState<number>(300); // 300 BRL comission target

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Filter orders related only to this logged-in seller
  const sellerOrders = useMemo(() => {
    return orders.filter((o) => o.sellerId === currentUser.id);
  }, [orders, currentUser]);

  // Calculations for KPI cards
  const stats = useMemo(() => {
    let totalRevenueGenerated = 0;
    let totalComissionsEarned = 0;
    let totalItemsCount = 0;

    sellerOrders.forEach((o) => {
      totalRevenueGenerated += o.revenue;
      totalComissionsEarned += o.sellerCommissionAmount;
      totalItemsCount += o.quantity;
    });

    const goalProgressPercent = comissionGoal > 0 ? (totalComissionsEarned / comissionGoal) * 100 : 0;
    const itemsAverageValue = sellerOrders.length > 0 ? totalRevenueGenerated / sellerOrders.length : 0;

    return {
      totalRevenueGenerated,
      totalComissionsEarned,
      totalItemsCount,
      goalProgressPercent,
      itemsAverageValue,
      salesCount: sellerOrders.length
    };
  }, [sellerOrders, comissionGoal]);

  // Chronological progress
  const sellerTimelineData = useMemo(() => {
    const map: Record<string, { date: string; vaturamento: number; comissao: number }> = {};
    
    // Fill last 10 days structure
    sellerOrders.forEach((o) => {
      const dateKey = String(o.date || '').substring(0, 10);
      if (!map[dateKey]) {
        map[dateKey] = { date: dateKey, vaturamento: 0, comissao: 0 };
      }
      map[dateKey].vaturamento += o.revenue;
      map[dateKey].comissao += o.sellerCommissionAmount;
    });

    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10); // Show last 10 active days.
  }, [sellerOrders]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-12" id="seller-dashboard-root">
      
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 p-5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="seller-navbar">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-xl text-white">
            <Sparkles className="w-5 h-5 animate-spin duration-3000" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
              3D Memories - Painel do Vendedor
            </h1>
            <p className="text-xs text-cyan-400 font-medium">Acompanhamento Diário e Mensal de Resultados</p>
          </div>
        </div>

        {/* User Badge Info & Action */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="block text-xs font-bold text-slate-300">{currentUser.name}</span>
            <span className="text-[10px] text-zinc-500 font-mono italic">{currentUser.email}</span>
          </div>
          <button
            id="seller-btn-logout"
            onClick={onLogOut}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-950 hover:bg-red-950/20 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/60 rounded-xl text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </header>

      {/* Main dashboard space */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6" id="seller-workspace">
        
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="seller-kpis-grid">
          
          {/* Card 1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
              Minha Comissão Acumulada <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-emerald-400 font-sans">
              {formatBRL(stats.totalComissionsEarned)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Sua comissão ativa: <strong className="font-bold text-cyan-400">{currentUser.commissionRate}%</strong></p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
              Volume Total Faturado <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-white font-sans">
              {formatBRL(stats.totalRevenueGenerated)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Valor gerado para a 3D Memories</p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
              Nº de Pedidos Concluídos <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-indigo-400 font-sans">
              {stats.salesCount} ped.
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Com {stats.totalItemsCount} peças entregues</p>
          </div>

          {/* Card 4 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
              Média do Ticket / Venda <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-amber-500 font-sans">
              {formatBRL(stats.itemsAverageValue)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Por transação concluída</p>
          </div>
        </div>

        {/* Dynamic Goal Progress Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="seller-goals-card">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Award className="w-4.5 h-4.5 text-cyan-400" /> Meta de Comissionamento Mensal
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">Determine sua meta de ganhos em dinheiro no mês e acompanhe seu rendimento</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Meta:</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-bold text-xs">R$</span>
                <input
                  id="comission-goal-input"
                  type="number"
                  value={comissionGoal}
                  onChange={(e) => setComissionGoal(Math.max(1, Number(e.target.value)))}
                  className="w-20 bg-slate-950 border border-slate-800 font-bold text-xs p-1 rounded-lg text-center font-sans tracking-wide outline-none text-white focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {/* Progress Bar background layout */}
            <div className="w-full bg-slate-950 rounded-full h-4 overflow-hidden border border-slate-800 p-0.5 flex">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500 transition-all duration-1000"
                style={{ width: `${Math.min(100, stats.goalProgressPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
              <span>Faturado: {formatBRL(stats.totalComissionsEarned)} ({stats.goalProgressPercent.toFixed(1)}%)</span>
              <span>Meta: {formatBRL(comissionGoal)}</span>
            </div>

            {/* Motivational text logic */}
            <div className="mt-4 p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                {stats.totalComissionsEarned >= comissionGoal ? (
                  <strong className="text-emerald-400 font-extrabold">Parabéns! Você alcançou e superou sua meta do mês! Continue assim para maximizar seus lucros!</strong>
                ) : (
                  <span>Você está a <strong className="text-cyan-400">{formatBRL(comissionGoal - stats.totalComissionsEarned)}</strong> de alcançar sua meta mensal de comissões de {formatBRL(comissionGoal)}. Faltam poucas vendas adicionais!</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Charts & Listings split row layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="seller-visualizers-split">
          
          {/* Chart timeline component */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5" id="seller-timeline-box">
            <h3 className="text-sm font-bold text-white mb-1">Meus Ganhos Diários</h3>
            <p className="text-slate-400 text-xs mb-5">Evolução diária das suas comissões faturadas</p>
            
            {sellerTimelineData.length === 0 ? (
              <div className="h-56 flex flex-col justify-center items-center text-slate-500 italic text-xs">
                Nenhum dado diário cumulativo para plotagem. Carregue mais vendas com seu login.
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sellerTimelineData}>
                    <defs>
                      <linearGradient id="colorSellerComm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `R$${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 11 }}
                      formatter={(name: any) => formatBRL(Number(name))}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" name="Minha Comissão (R$)" dataKey="comissao" stroke="#10b981" fillOpacity={1} fill="url(#colorSellerComm)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* List of Sales attributed to this seller */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="seller-transactions-box">
            <h3 className="text-sm font-bold text-white mb-1">Minhas Vendas Realizadas</h3>
            <p className="text-slate-400 text-xs mb-4">Lista detalhada de suas vendas registradas</p>

            <div className="space-y-3.5 max-h-[290px] overflow-y-auto pr-1">
              {sellerOrders.map((o) => (
                <div key={o.orderId} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700/60 transition-all flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-slate-200 truncate max-w-[170px]" title={o.productName}>
                      {o.productName}
                    </span>
                    <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">
                      ID: {o.orderId} | Qtd: {o.quantity} ({o.date})
                    </span>
                  </div>
                  
                  <div className="text-right">
                    <span className="block text-xs font-mono text-slate-400">Venda: {formatBRL(o.revenue)}</span>
                    <span className="block text-xs font-bold text-emerald-400 mt-0.5">+{formatBRL(o.sellerCommissionAmount)}</span>
                  </div>
                </div>
              ))}

              {sellerOrders.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs italic">
                  Você ainda não possui vendas atribuídas neste mês. Entre em contato com o Admin da 3D Memories para comissionar suas vendas.
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
