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
  generateDemoShopeeCSV
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

  // File parsing states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [importCount, setImportCount] = useState(0);
  const [importError, setImportError] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMappingStep, setShowMappingStep] = useState(false);

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

  // Handle Drag-and-Drop & File uploaded
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // Main file reader (CSV or xlsx)
  const handleFile = (file: File) => {
    setImportStatus('loading');
    setImportError('');
    setShowMappingStep(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let headers: string[] = [];
        let rows: any[][] = [];

        if (file.name.endsWith('.csv')) {
          // Parse CSV text manually for immediate parsing without errors
          const text = new TextDecoder('utf-8').decode(new Uint8Array(data as ArrayBuffer));
          const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
          if (lines.length > 0) {
            const d = lines[0].includes(';') ? ';' : ',';
            headers = lines[0].split(d).map(h => h.replace(/^["']|["']$/g, '').trim());
            rows = lines.slice(1).map(l => l.split(d).map(cell => cell.replace(/^["']|["']$/g, '').trim()));
          }
        } else {
          // Parse Binary Excel with XLSX package
          let typedArray: Uint8Array;
          if (data instanceof ArrayBuffer) {
            typedArray = new Uint8Array(data);
          } else if (typeof data === 'string') {
            const arr = new Array(data.length);
            for (let i = 0; i < data.length; i++) arr[i] = data.charCodeAt(i) & 0xFF;
            typedArray = new Uint8Array(arr);
          } else {
            throw new Error("Formato de arquivo incompatível.");
          }

          const workbook = XLSX.read(typedArray, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const parsed = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (parsed && parsed.length > 0) {
            headers = parsed[0].map((h: any) => String(h || '').trim());
            rows = parsed.slice(1).filter(r => r.some(cell => cell !== null && cell !== ''));
          }
        }

        if (headers.length === 0 || rows.length === 0) {
          throw new Error('Nenhum dado legível e com headers pôde ser extraído da planilha.');
        }

        // Auto-detect mappings
        const detected = detectShopeeColumns(headers);
        setRawHeaders(headers);
        setRawRows(rows);
        setColumnMapping(detected);
        setImportStatus('idle');
        setShowMappingStep(true);

      } catch (err: any) {
        setImportStatus('error');
        setImportError(err.message || 'Erro ao decodificar a planilha. Verifique o formato.');
      }
    };

    reader.onerror = () => {
      setImportStatus('error');
      setImportError('Erro ao ler o arquivo.');
    };

    reader.readAsArrayBuffer(file);
  };

  // Convert raw rows using verified mapping and add to state
  const confirmMappingAndImport = () => {
    setImportStatus('loading');
    try {
      const orderIdIdx = rawHeaders.indexOf(columnMapping.orderIdCol);
      const prodNameIdx = rawHeaders.indexOf(columnMapping.productNameCol);
      const variationIdx = rawHeaders.indexOf(columnMapping.variationCol);
      const skuIdx = rawHeaders.indexOf(columnMapping.skuCol);
      const quantityIdx = rawHeaders.indexOf(columnMapping.quantityCol);
      const revenueIdx = rawHeaders.indexOf(columnMapping.revenueCol);
      const dateIdx = rawHeaders.indexOf(columnMapping.dateCol);

      if (revenueIdx === -1 || prodNameIdx === -1) {
        throw new Error('As colunas de "Nome do Produto" e "Total pago / receita" são obrigatórias.');
      }

      const calculatedOrders: ConcludedOrder[] = [];

      rawRows.forEach((row) => {
        const orderIdVal = orderIdIdx !== -1 ? String(row[orderIdIdx] || '').trim() : '';
        const prodNameVal = prodNameIdx !== -1 ? String(row[prodNameIdx] || '').trim() : '';
        const variationVal = variationIdx !== -1 ? String(row[variationIdx] || '').trim() : '';
        const skuVal = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : '';
        const qtyVal = quantityIdx !== -1 ? parseInt(String(row[quantityIdx] || '1'), 10) || 1 : 1;
        const revVal = revenueIdx !== -1 ? parseBRLNumber(row[revenueIdx]) : 0;
        const dateVal = dateIdx !== -1 ? String(row[dateIdx] || '').substring(0, 10) : new Date().toISOString().split('T')[0];

        if (!prodNameVal && revVal === 0) return; // Skip blank rows

        // Auto-map this imported record directly to this logged-in Seller!
        const calculated = calculateOrderMetrics({
          orderId: orderIdVal || `shopee_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          productName: prodNameVal,
          variation: variationVal,
          sku: skuVal,
          quantity: qtyVal,
          revenue: revVal,
          date: dateVal,
          seller: currentUser, // Autoassigned to current logged-in seller!
          productCosts,
          shopeeCommissionRate: 20.0, // Standard 20% Shopee rate fallback
        });

        calculatedOrders.push(calculated);
      });

      onImportOrders(calculatedOrders);
      setImportCount(calculatedOrders.length);
      setImportStatus('success');
      setShowMappingStep(false);
      
      // Reset inputs
      setRawHeaders([]);
      setRawRows([]);

    } catch (err: any) {
      setImportStatus('error');
      setImportError(err.message || 'Erro ao realizar o processamento dos dados.');
    }
  };

  const handleDownloadDemoCSV = () => {
    const csvContent = generateDemoShopeeCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'planilha_exemplo_shopee.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" /> Enviar Minha Planilha Shopee / Relatório de Vendas
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Todos os pedidos importados nesta seção serão automaticamente vinculados e comissionados a você (<strong className="text-cyan-400 font-semibold">{currentUser.name}</strong>).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Drop Zone Box */}
            <div className="md:col-span-2">
              <div
                id="seller-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-cyan-500/70 bg-slate-950/40 hover:bg-slate-950/85 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 group relative overflow-hidden"
              >
                <input
                  id="seller-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {importStatus === 'loading' ? (
                  <div className="py-6 flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
                    <span className="text-xs font-semibold text-slate-300">Decodificando relatório...</span>
                  </div>
                ) : (
                  <div className="py-2.5">
                    <UploadCloud className="w-10 h-10 text-slate-600 group-hover:text-cyan-400 mx-auto mb-2 transition-colors" />
                    <p className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                      Arraste sua planilha Shopee pra cá ou clique para explorar
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Suporta arquivos formatados em .XLSX, .XLS ou .CSV exportados da sua loja Shopee
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Instruction and Demo download box */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between" id="seller-help-box">
              <div className="space-y-1.5 text-xs text-slate-400">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] block">Dica de Envio</span>
                <p>Nós detectamos os campos automaticamente. Ganhos do produtor e suas comissões de {currentUser.commissionRate}% serão re-calculadas em cima do lucro de cada peça impressa.</p>
              </div>

              <div className="pt-4 border-t border-slate-800/60 mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDemoCSV}
                  className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-850 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar Planilha Teste
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportStatus('loading');
                    const csvContent = generateDemoShopeeCSV();
                    const lines = csvContent.split(/\n/);
                    const d = ';';
                    const headers = lines[0].split(d);
                    const rows = lines.slice(1).map(l => l.split(d));
                    
                    setRawHeaders(headers);
                    setRawRows(rows);
                    setColumnMapping(detectShopeeColumns(headers));
                    setShowMappingStep(true);
                    setImportStatus('idle');
                  }}
                  className="w-full bg-cyan-950/60 hover:bg-cyan-900/50 border border-cyan-800/40 text-cyan-400 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Injetar Relatório Teste
                </button>
              </div>
            </div>
          </div>

          {/* Import feedbacks */}
          {importStatus === 'error' && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 text-xs text-red-300" id="seller-import-error">
              <p className="font-bold">Houve um erro de leitura:</p>
              <p className="mt-1">{importError}</p>
            </div>
          )}

          {importStatus === 'success' && (
            <div className="bg-emerald-950/40 border border-emerald-800/45 rounded-xl p-4 text-xs text-emerald-300 flex items-center justify-between" id="seller-import-success">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Planilha importada com sucesso! <strong>{importCount}</strong> vendas foram adicionadas aos seus registros.</span>
              </div>
            </div>
          )}

          {/* Column adjustment screen before saving */}
          {showMappingStep && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mt-2 space-y-4" id="seller-mapping-box">
              <div className="flex items-center gap-2 text-cyan-400">
                <Sliders className="w-4.5 h-4.5" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Confirmar Cabeçalhos Identificados</h3>
              </div>
              <p className="text-[11px] text-slate-400">
                O mapeamento abaixo foi detectado automaticamente. Se necessário, ajuste os campos e cofira os dados abaixo:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.keys(columnMapping).map((mapKey) => {
                  const translations: Record<string, string> = {
                    orderIdCol: 'Nº do Pedido',
                    productNameCol: 'Nome do Item',
                    variationCol: 'Var',
                    skuCol: 'Código SKU',
                    quantityCol: 'Quantidade',
                    revenueCol: 'Preço Pago',
                    dateCol: 'Data',
                  };

                  return (
                    <div key={mapKey} className="bg-slate-900 p-2 text-[11px] rounded-lg border border-slate-850">
                      <label className="block text-[9px] text-slate-500 font-bold uppercase mb-1">
                        {translations[mapKey]}
                      </label>
                      <select
                        id={`seller-map-${mapKey}`}
                        value={columnMapping[mapKey]}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [mapKey]: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-300 p-1 rounded outline-none focus:border-cyan-500"
                      >
                        <option value="">Ignorar Coluna</option>
                        {rawHeaders.map((headerName) => (
                          <option key={headerName} value={headerName}>
                            {headerName}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowMappingStep(false); setRawHeaders([]); setRawRows([]); }}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmMappingAndImport}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-950/20"
                >
                  Confirmar e Sincronizar Pedidos
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
