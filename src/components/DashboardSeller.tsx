import React, { useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UserAccount, ConcludedOrder, ProductCost } from '../types';
import { 
  DollarSign, 
  TrendingUp, 
  FileSpreadsheet, 
  LogOut, 
  Sparkles, 
  Info, 
  Calendar, 
  Clock, 
  Award,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Sliders,
  Download
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
import { 
  detectShopeeColumns, 
  parseBRLNumber, 
  calculateOrderMetrics,
  generateDemoShopeeCSV,
  extractHeadersAndRows,
  parsePastedShopeeText,
  ParsedPasteOrder
} from '../utils/shopeeParser';

interface DashboardSellerProps {
  currentUser: UserAccount;
  orders: ConcludedOrder[];
  productCosts: ProductCost[];
  onImportOrders: (newOrders: ConcludedOrder[]) => void;
  onDeleteOrder?: (id: string) => void;
  onSaveOrUpdateCostAndRecalculate: (skuOrName: string, newUnitCost: number) => void;
  onLogOut: () => void;
}

export function DashboardSeller({
  currentUser,
  orders,
  productCosts,
  onImportOrders,
  onDeleteOrder,
  onSaveOrUpdateCostAndRecalculate,
  onLogOut
}: DashboardSellerProps) {
  // Target commission goal for the month (gamification)
  const [comissionGoal, setComissionGoal] = useState<number>(300); // 300 BRL comission target

  // Copy-paste text area states
  const [pasteText, setPasteText] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [importCount, setImportCount] = useState(0);
  const [importError, setImportError] = useState('');
  const [showMappingStep, setShowMappingStep] = useState(false);
  const [reviewOrders, setReviewOrders] = useState<ParsedPasteOrder[]>([]);
  const [defaultProductId, setDefaultProductId] = useState('');

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
    
    // Fill last 12 days structure
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
      .slice(-12); // Show last 12 active days
  }, [sellerOrders]);

  // Process the copy-pasted text
  const handleProcessPaste = () => {
    setImportStatus('idle');
    setImportError('');
    setShowMappingStep(false);

    if (!pasteText.trim()) {
      setImportStatus('error');
      setImportError('Por favor, cole o texto copiado de finanças da Shopee na caixa de texto.');
      return;
    }

    try {
      const parsed = parsePastedShopeeText(pasteText);
      if (parsed.length === 0) {
        throw new Error('Nenhum pedido legível pôde ser identificado. Verifique se o formato do texto colado é compatível (ex: ID do pedido, Data, Método de pagamento, Valor liberado).');
      }

      // Assign default product if found
      const initialProductId = defaultProductId || (productCosts.length > 0 ? productCosts[0].id : '');
      const withProducts = parsed.map(order => ({
        ...order,
        productId: initialProductId
      }));

      setReviewOrders(withProducts);
      setShowMappingStep(true);
    } catch (err: any) {
      setImportStatus('error');
      setImportError(err.message || 'Erro ao processar as linhas coladas.');
    }
  };

  const handleInjectSample = () => {
    const sample = `260515EHMQXRH5
Comprador:lizandrocavalcante815
30/05/2026
Pagamento transferido com sucesso
Pix
R$38,25
260518NX8TKSU8
Comprador:gilsonsantos126
30/05/2026
Pagamento transferido com sucesso
Cartão de Crédito
R$21,31
260517MVC3SCT1
Comprador:4wsc2owius
29/05/2026
Pagamento transferido com sucesso
Cartão de Crédito
R$21,23`;
    setPasteText(sample);
  };

  const confirmMappingAndImport = () => {
    setImportStatus('loading');
    try {
      if (reviewOrders.length === 0) {
        throw new Error('Nenhum pedido na fila para importação.');
      }

      const calculatedOrders: ConcludedOrder[] = [];

      reviewOrders.forEach((item) => {
        const matchedProduct = productCosts.find(p => p.id === item.productId);
        const prodNameVal = matchedProduct ? matchedProduct.nameOrSku : 'Peça Customizada';
        const skuVal = matchedProduct ? matchedProduct.nameOrSku : 'S/ SKU';

        const calculated = calculateOrderMetrics({
          orderId: item.orderId || `shopee_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          productName: prodNameVal,
          variation: item.paymentMethod || 'Padrão',
          sku: skuVal,
          quantity: 1,
          revenue: item.revenue,
          date: item.date,
          seller: currentUser,
          productCosts,
          shopeeCommissionRate: 0.0, // Pre-processed/already discounted on paste
        });

        calculatedOrders.push(calculated);
      });

      onImportOrders(calculatedOrders);
      setImportCount(calculatedOrders.length);
      setImportStatus('success');
      setShowMappingStep(false);
      
      setPasteText('');
      setReviewOrders([]);
    } catch (err: any) {
      setImportStatus('error');
      setImportError(err.message || 'Erro ao realizar o processamento dos dados.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-12" id="seller-dashboard-root">
      
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 p-5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="seller-navbar">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-xl text-white">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
              3D Memories - Painel de Vendedor
            </h1>
            <p className="text-xs text-cyan-400 font-medium">Controle de Comissão e Envio de Planilhas</p>
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
                <Award className="w-4.5 h-4.5 text-cyan-400" /> Minha Meta de Comissão Mensal
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

        {/* SECTION FOR RELATÓRIO DO VENDEDOR (IMPORT EXCEL/PLANILHA) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4" id="seller-import-card">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" /> Copiar e Colar Dados de Venda (Shopee Finanças)
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Todos os pedidos importados nesta seção serão vinculados e comissionados a você (<strong className="text-cyan-400 font-semibold">{currentUser.name}</strong>). Os ganhos serão calculados com base no valor liberado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Paste Box */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label htmlFor="shopee-paste-box" className="text-xs text-slate-300 font-medium">Cole as linhas financeiras copiadas da Shopee abaixo:</label>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Lote: Peça Padrão</span>
                  <select
                    id="batch-product-select"
                    value={defaultProductId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setDefaultProductId(id);
                      setReviewOrders(prev => prev.map(o => ({ ...o, productId: id })));
                    }}
                    className="bg-slate-950 border border-slate-850 text-[10.5px] text-slate-300 p-1.5 rounded-lg outline-none focus:border-cyan-500"
                  >
                    <option value="">Abaixo (Definir na Revisão)</option>
                    {productCosts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameOrSku}
                      </option>
                    ))}
                    <option value="default_p">Custo Geral (R$ 15,00)</option>
                  </select>
                </div>
              </div>

              <div className="relative">
                <textarea
                  id="shopee-paste-box"
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 font-mono outline-none resize-y transition-colors duration-200"
                  placeholder="Cole as linhas aqui...&#10;Exemplo de Formato:&#10;260515EHMQXRH5&#10;Comprador:lizandrocavalcante815&#10;30/05/2026&#10;Pagamento transferido com sucesso&#10;Pix&#10;R$38,25"
                />
              </div>

              <div className="flex justify-between items-center">
                <p className="text-[10px] text-slate-500">
                  Nosso leitor inteligente identifica automaticamente transações individuais, métodos de pagamento, datas e os valores de repasse.
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleInjectSample}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-lg text-[10.5px] font-semibold transition-colors shrink-0"
                  >
                    Injetar Exemplo Teste
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessPaste}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 rounded-lg text-[10.5px] font-bold transition-colors shadow-md shadow-cyan-950/40 shrink-0"
                  >
                    Processar Texto
                  </button>
                </div>
              </div>
            </div>

            {/* Help / Informational Card */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between" id="seller-help-box">
              <div className="space-y-2 text-xs text-slate-400">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] block">Dica de Importação</span>
                <p>Copie e cole diretamente as linhas da sua aba de Finanças / Saldo da Shopee.</p>
                <p>Nós não precisamos de planilhas locais! Você pode mudar a Peça de cada item na etapa de revisão antes de confirmar a gravação.</p>
              </div>

              <div className="pt-3 border-t border-slate-800/50 mt-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Como copiar na Shopee:</span>
                <p className="text-[10px] text-slate-500">Visite o Portal de Vendas &gt; Finanças &gt; Selecione as linhas da tabela e dê Ctrl+C. Cole diretamente na caixa ao lado.</p>
              </div>
            </div>
          </div>

          {/* Import feedbacks */}
          {importStatus === 'error' && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 text-xs text-red-300 font-mono" id="seller-import-error">
              <p className="font-bold">❌ Houve um erro de leitura:</p>
              <p className="mt-1">{importError}</p>
            </div>
          )}

          {importStatus === 'success' && (
            <div className="bg-emerald-950/40 border border-emerald-800/45 rounded-xl p-4 text-xs text-emerald-300 flex items-center justify-between" id="seller-import-success">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Integração de saldo completa! <strong>{importCount}</strong> pedidos adicionados e sincronizados com sucesso.</span>
              </div>
            </div>
          )}

          {/* Tabular review and map screen before saving */}
          {showMappingStep && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 mt-4 space-y-4" id="seller-review-box">
              <div className="flex items-center gap-2 text-cyan-400">
                <Sliders className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Revisar e Associar Peças do Lote</h3>
              </div>
              <p className="text-xs text-slate-400">
                Encontramos <strong className="text-cyan-400">{reviewOrders.length}</strong> pedidos no texto enviado. Agora, indique qual modelo/peça 3D corresponde a cada pedido para calcular o custo e a comissão de {currentUser.commissionRate}%:
              </p>

              <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                      <th className="p-3">Nº do Pedido</th>
                      <th className="p-3">Data</th>
                      <th className="p-3">Forma / Status</th>
                      <th className="p-3">Valor Liberado</th>
                      <th className="p-3 text-cyan-400">Associar à Peça (Produção)</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewOrders.map((order, idx) => (
                      <tr key={idx} className="border-b border-slate-900/60 hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-300">{order.orderId}</td>
                        <td className="p-3 text-slate-400">{order.date}</td>
                        <td className="p-3">
                          <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-semibold border border-slate-800/80">
                            {order.paymentMethod || 'Outro'}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-emerald-400 font-sans">
                          {formatBRL(order.revenue)}
                        </td>
                        <td className="p-3">
                          <select
                            id={`seller-product-select-${idx}`}
                            value={order.productId || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReviewOrders(prev => prev.map((curr, cidx) => cidx === idx ? { ...curr, productId: val } : curr));
                            }}
                            className="w-full bg-slate-900 border border-slate-850 hover:border-cyan-500/50 text-xs text-slate-100 p-1.5 rounded-lg outline-none focus:border-cyan-500 transition-colors"
                          >
                            <option value="">-- Escolha o Modelo / Peça --</option>
                            {productCosts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nameOrSku} (Custo: R$ {p.productionCost.toFixed(2)})
                              </option>
                            ))}
                            <option value="default_p">Custo Geral / Padrão (R$ 15,00 / item)</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            id={`btn-remove-review-${idx}`}
                            type="button"
                            title="Remover este pedido do lote"
                            onClick={() => {
                              setReviewOrders(prev => prev.filter((_, cidx) => cidx !== idx));
                            }}
                            className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-950/30 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => { setShowMappingStep(false); setReviewOrders([]); }}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  id="confirm-sync-btn"
                  type="button"
                  onClick={confirmMappingAndImport}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-950/20"
                >
                  Confirmar e Importar {reviewOrders.length} Pedidos
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Charts & Listings split row layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="seller-visualizers-split">
          
          {/* Chart timeline component */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5" id="seller-timeline-box">
            <h3 className="text-sm font-bold text-white mb-1">Meus Ganhos Diários</h3>
            <p className="text-slate-400 text-xs mb-5">Evolução diária das suas comissões faturadas</p>
            
            {sellerTimelineData.length === 0 ? (
              <div className="h-56 flex flex-col justify-center items-center text-slate-500 italic text-xs">
                Nenhum dado diário acumulativo para plotagem. Carregue mais vendas enviando uma planilha Shopee acima.
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
                      formatter={(name: any) => formatBRL(name)}
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
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white">Minhas Vendas Realizadas</h3>
              <span className="text-[10px] bg-slate-950 font-mono text-cyan-400 font-bold py-0.5 px-2 border border-slate-800 rounded-md">
                {sellerOrders.length} ped.
              </span>
            </div>
            <p className="text-slate-400 text-xs mb-4">Lista detalhada de suas vendas registradas</p>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {sellerOrders.map((o) => (
                <div key={o.orderId} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700/65 transition-all flex flex-col gap-2 group">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1 mr-2">
                      <span className="block text-xs font-bold text-slate-200 truncate" title={o.productName}>
                        {o.productName}
                      </span>
                      <span className="block text-[9px] text-zinc-500 font-mono mt-0.5 truncate">
                        ID: {o.orderId} | Qtd: {o.quantity} | {o.date}
                      </span>
                      {o.sku && (
                        <span className="inline-block mt-1 text-[8px] uppercase tracking-wider font-extrabold bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
                          SKU: {o.sku}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <span className="block text-xs font-mono text-slate-400">Venda: {formatBRL(o.revenue)}</span>
                        <span className="block text-xs font-bold text-emerald-400 mt-0.5">+{formatBRL(o.sellerCommissionAmount)}</span>
                      </div>

                      {onDeleteOrder && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Tem certeza de que deseja remover o pedido ${o.orderId} dos seus lançamentos?`)) {
                              onDeleteOrder(o.orderId);
                            }
                          }}
                          className="p-1.5 bg-slate-900 border border-slate-850 hover:bg-red-950/20 text-slate-500 hover:text-red-400 hover:border-red-900/40 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline cost editor saving for future matching */}
                  <div className="pt-2 border-t border-slate-900/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Custo Unitário (Grave p/ Próximos):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-600 font-mono">R$</span>
                      <input
                        key={`cost-sell-${o.orderId}-${o.calculatedCost}`}
                        type="number"
                        step="0.50"
                        min="0"
                        defaultValue={(o.calculatedCost / o.quantity).toFixed(2)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            const currentUnitCost = o.calculatedCost / o.quantity;
                            if (Math.abs(val - currentUnitCost) > 0.005) {
                              const key = o.sku && o.sku !== 'S/ SKU' ? o.sku : o.productName;
                              onSaveOrUpdateCostAndRecalculate(key, val);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            if (!isNaN(val) && val >= 0) {
                              const key = o.sku && o.sku !== 'S/ SKU' ? o.sku : o.productName;
                              onSaveOrUpdateCostAndRecalculate(key, val);
                              (e.target as HTMLInputElement).blur();
                            }
                          }
                        }}
                        className="w-14 bg-slate-900 focus:bg-slate-850 hover:border-slate-700 focus:border-cyan-500 border border-slate-800 text-[10px] text-white p-0.5 rounded text-right outline-none transition-all font-mono"
                        title="Configure o custo unitário. Ele salvará para futuras extrações automaticamente."
                      />
                    </div>
                  </div>
                </div>
              ))}

              {sellerOrders.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs italic">
                  Você ainda não possui vendas atribuídas neste mês. Arraste e adicione seu relatório Shopee usando nossa ferramenta acima!
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
