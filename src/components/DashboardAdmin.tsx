import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  UserAccount, 
  ProductCost, 
  ConcludedOrder, 
  ShopeeColumnMapping 
} from '../types';
import { 
  detectShopeeColumns, 
  calculateOrderMetrics, 
  parseBRLNumber, 
  generateDemoShopeeCSV, 
  normalizeHeader 
} from '../utils/shopeeParser';
import {
  TrendingUp,
  DollarSign,
  Users,
  Database,
  UploadCloud,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  LogOut,
  Search,
  CheckCircle,
  HelpCircle,
  Percent,
  Download,
  Sliders,
  Sparkles,
  Info,
  ChevronRight,
  TrendingDown,
  UserCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardAdminProps {
  currentUser: UserAccount;
  sellers: UserAccount[];
  onAddSeller: (name: string, email: string, commRate: number) => void;
  onDeleteSeller: (id: string) => void;
  onUpdateSellerCommission: (id: string, rate: number) => void;
  productCosts: ProductCost[];
  onAddProductCost: (pattern: string, cost: number, shopeeCommissionRate?: number, customSellerCommission?: number) => void;
  onDeleteProductCost: (id: string) => void;
  onUpdateProductCost: (id: string, cost: number, shopeeCommissionRate?: number, customSellerCommission?: number) => void;
  onSaveOrUpdateCostAndRecalculate: (skuOrName: string, newUnitCost: number) => void;
  orders: ConcludedOrder[];
  onImportOrders: (newOrders: ConcludedOrder[]) => void;
  onClearOrders: () => void;
  onDeleteOrder: (orderId: string) => void;
  onAssignSellerToOrder: (orderId: string, sellerId: string) => void;
  onLogOut: () => void;
}

export function DashboardAdmin({
  currentUser,
  sellers,
  onAddSeller,
  onDeleteSeller,
  onUpdateSellerCommission,
  productCosts,
  onAddProductCost,
  onDeleteProductCost,
  onUpdateProductCost,
  onSaveOrUpdateCostAndRecalculate,
  orders,
  onImportOrders,
  onClearOrders,
  onDeleteOrder,
  onAssignSellerToOrder,
  onLogOut
}: DashboardAdminProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'metrics' | 'import' | 'costs' | 'sellers' | 'sales'>('metrics');

  // Shopee fee rate state - default is 20% commission on Shopee (Portuguese: Taxa Shopee)
  const [shopeeFeeRate, setShopeeFeeRate] = useState<number>(20);

  // New Seller inline form state
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerEmail, setNewSellerEmail] = useState('');
  const [newSellerComm, setNewSellerComm] = useState(50);

  // New Cost inline form state
  const [newCostPattern, setNewCostPattern] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newCostShopeeRate, setNewCostShopeeRate] = useState('');
  const [newCostSellerCommission, setNewCostSellerCommission] = useState('');

  // Editing states
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editingCostVal, setEditingCostVal] = useState<string>('');
  const [editingCostShopeeRate, setEditingCostShopeeRate] = useState<string>('');
  const [editingCostSellerComm, setEditingCostSellerComm] = useState<string>('');
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [editingSellerComm, setEditingSellerComm] = useState<number>(50);

  // Manual sale form state
  const [manualOrderId, setManualOrderId] = useState('');
  const [manualProdName, setManualProdName] = useState('');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualRevenue, setManualRevenue] = useState('');
  const [manualSku, setManualSku] = useState('');
  const [manualVar, setManualVar] = useState('');
  const [manualSellerId, setManualSellerId] = useState('unassigned');
  const [manualSaleDate, setManualSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [showManualForm, setShowManualForm] = useState(false);

  // File parsing states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [importCount, setImportCount] = useState(0);
  const [importError, setImportError] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMappingStep, setShowMappingStep] = useState(false);

  // Table filters
  const [salesSearch, setSalesSearch] = useState('');
  const [salesSellerFilter, setSalesSellerFilter] = useState('all');

  // Performance calculations
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalShopeeFee = 0;
    let totalSellerCommission = 0;

    orders.forEach((o) => {
      totalRevenue += o.revenue;
      totalCost += o.calculatedCost;
      totalShopeeFee += o.shopeeFee;
      totalSellerCommission += o.sellerCommissionAmount;
    });

    const netProfit = totalRevenue - totalCost - totalShopeeFee - totalSellerCommission;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      totalShopeeFee,
      totalSellerCommission,
      netProfit,
      profitMargin,
      totalSalesCount: orders.length,
    };
  }, [orders]);

  // Seller metrics analysis
  const sellerRankings = useMemo(() => {
    const listMap: Record<string, { id: string; name: string; revenue: number; commission: number; count: number }> = {};
    
    // Initialize with all sellers
    sellers.forEach((s) => {
      listMap[s.id] = { id: s.id, name: s.name, revenue: 0, commission: 0, count: 0 };
    });
    // Add unassigned
    listMap['unassigned'] = { id: 'unassigned', name: 'Orgânico / Direto', revenue: 0, commission: 0, count: 0 };

    orders.forEach((o) => {
      const sId = o.sellerId || 'unassigned';
      if (!listMap[sId]) {
        listMap[sId] = { id: sId, name: o.sellerName || 'Orgânico / Direto', revenue: 0, commission: 0, count: 0 };
      }
      listMap[sId].revenue += o.revenue;
      listMap[sId].commission += o.sellerCommissionAmount;
      listMap[sId].count += o.quantity;
    });

    return Object.values(listMap).sort((a, b) => b.revenue - a.revenue);
  }, [orders, sellers]);

  // Revenue chronological series (daily or monthly)
  const timelineData = useMemo(() => {
    const map: Record<string, { date: string; vaturamento: number; lucro: number; comissao: number }> = {};
    
    orders.forEach((o) => {
      const dateKey = String(o.date || '').substring(0, 10); // YYYY-MM-DD
      if (!map[dateKey]) {
        map[dateKey] = { date: dateKey, vaturamento: 0, lucro: 0, comissao: 0 };
      }
      map[dateKey].vaturamento += o.revenue;
      map[dateKey].lucro += o.netProfit;
      map[dateKey].comissao += o.sellerCommissionAmount;
    });

    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15); // Show last 15 active days
  }, [orders]);

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
          // Split into rows and clean up quotes/commas/semicolons
          const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
          if (lines.length > 0) {
            // Determine delimiter: comma or semicolon
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
        setImportError(err.message || 'Erro ao decodificar a planilha. Verifique a codificação.');
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
      const mapping = columnMapping as ShopeeColumnMapping;
      const orderIdIdx = rawHeaders.indexOf(mapping.orderIdCol);
      const prodNameIdx = rawHeaders.indexOf(mapping.productNameCol);
      const variationIdx = rawHeaders.indexOf(mapping.variationCol);
      const skuIdx = rawHeaders.indexOf(mapping.skuCol);
      const quantityIdx = rawHeaders.indexOf(mapping.quantityCol);
      const revenueIdx = rawHeaders.indexOf(mapping.revenueCol);
      const dateIdx = rawHeaders.indexOf(mapping.dateCol);

      if (revenueIdx === -1 || prodNameIdx === -1) {
        throw new Error('As colunas de "Nome do Produto" e "Total pago / receita" são obrigatórias para o mapeamento.');
      }

      const calculatedOrders: ConcludedOrder[] = [];

      rawRows.forEach((row, i) => {
        // Safe value readers based on index math
        const orderIdVal = orderIdIdx !== -1 ? String(row[orderIdIdx] || '').trim() : '';
        const prodNameVal = prodNameIdx !== -1 ? String(row[prodNameIdx] || '').trim() : '';
        const variationVal = variationIdx !== -1 ? String(row[variationIdx] || '').trim() : '';
        const skuVal = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : '';
        const qtyVal = quantityIdx !== -1 ? parseInt(String(row[quantityIdx] || '1'), 10) || 1 : 1;
        const revVal = revenueIdx !== -1 ? parseBRLNumber(row[revenueIdx]) : 0;
        const dateVal = dateIdx !== -1 ? String(row[dateIdx] || '').substring(0, 10) : new Date().toISOString().split('T')[0];

        if (!prodNameVal && revVal === 0) return; // Skip potential blank row

        // Assign to seller based on SKU pattern mapping, product string or assign to unassigned organic
        // Help map: we can check if some seller is present in the customer username or we can let it be unassigned
        // and mapped beautifully on the sales screen. Let's auto-map if there's any text in any column matching the seller name.
        let matchedSeller: UserAccount | null = null;
        row.forEach((cell) => {
          if (!matchedSeller && cell) {
            const cellStr = String(cell).toLowerCase();
            const found = sellers.find(s => cellStr.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(cellStr));
            if (found) matchedSeller = found;
          }
        });

        const calculated = calculateOrderMetrics({
          orderId: orderIdVal,
          productName: prodNameVal,
          variation: variationVal,
          sku: skuVal,
          quantity: qtyVal,
          revenue: revVal,
          date: dateVal,
          seller: matchedSeller,
          productCosts,
          shopeeCommissionRate: shopeeFeeRate,
        });

        calculatedOrders.push(calculated);
      });

      onImportOrders(calculatedOrders);
      setImportCount(calculatedOrders.length);
      setImportStatus('success');
      setShowMappingStep(false);
      
      // Select the metrics tab automatically to display results
      setTimeout(() => {
        setActiveTab('metrics');
      }, 1500);

    } catch (err: any) {
      setImportStatus('error');
      setImportError(err.message || 'Erro ao realizar o processamento dos dados da tabela.');
    }
  };

  // Generate and download mock shopee file for easy evaluation
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

  // Add seller
  const handleCreateSellerSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSellerName.trim() || !newSellerEmail.trim()) return;
    onAddSeller(newSellerName, newSellerEmail, Number(newSellerComm));
    setNewSellerName('');
    setNewSellerEmail('');
    setNewSellerComm(50);
  };

  // Add product cost rule
  const handleCreateCostSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCostPattern.trim() || !newCostPrice.trim()) return;
    
    const shopeeRateVal = newCostShopeeRate.trim() ? parseFloat(newCostShopeeRate) : undefined;
    const sellerCommVal = newCostSellerCommission.trim() ? parseFloat(newCostSellerCommission) : undefined;

    onAddProductCost(
      newCostPattern, 
      parseFloat(newCostPrice) || 0,
      shopeeRateVal,
      sellerCommVal
    );
    
    setNewCostPattern('');
    setNewCostPrice('');
    setNewCostShopeeRate('');
    setNewCostSellerCommission('');
  };

  const handleUpdateCost = (id: string) => {
    if (editingCostVal.trim()) {
      const shopeeRateVal = editingCostShopeeRate.trim() ? parseFloat(editingCostShopeeRate) : undefined;
      const sellerCommVal = editingCostSellerComm.trim() ? parseFloat(editingCostSellerComm) : undefined;

      onUpdateProductCost(
        id, 
        parseFloat(editingCostVal) || 0,
        shopeeRateVal,
        sellerCommVal
      );
      
      setEditingCostId(null);
      setEditingCostVal('');
      setEditingCostShopeeRate('');
      setEditingCostSellerComm('');
    }
  };

  const handleUpdateSellerComm = (id: string) => {
    onUpdateSellerCommission(id, editingSellerComm);
    setEditingSellerId(null);
  };

  // Format money inside labels
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Filtered sales items list
  const filteredSales = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch = 
        (o.productName || '').toLowerCase().includes((salesSearch || '').toLowerCase()) ||
        (o.orderId || '').toLowerCase().includes((salesSearch || '').toLowerCase()) ||
        (o.sku || '').toLowerCase().includes((salesSearch || '').toLowerCase());
      
      const matchSeller = salesSellerFilter === 'all' || o.sellerId === salesSellerFilter;
      
      return matchSearch && matchSeller;
    });
  }, [orders, salesSearch, salesSellerFilter]);

  // Submit manual sale item
  const handleManualSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualProdName.trim() || !manualRevenue) return;

    const matchedSeller = sellers.find(s => s.id === manualSellerId) || null;
    const computed = calculateOrderMetrics({
      orderId: manualOrderId.trim() || `MAN-${Date.now().toString().slice(-6)}`,
      productName: manualProdName,
      variation: manualVar,
      sku: manualSku,
      quantity: manualQuantity,
      revenue: parseFloat(manualRevenue) || 0,
      date: manualSaleDate,
      seller: matchedSeller,
      productCosts,
      shopeeCommissionRate: shopeeFeeRate,
    });

    onImportOrders([computed]);
    
    // Clear manual form
    setManualOrderId('');
    setManualProdName('');
    setManualVar('');
    setManualSku('');
    setManualQuantity(1);
    setManualRevenue('');
    setManualSellerId('unassigned');
    setShowManualForm(false);
  };

  // Re-run calculations for all current orders if Shopee comission changes 
  const handleRecalculateAll = () => {
    if (orders.length === 0) return;
    const recomputedList = orders.map((o) => {
      const matchedSeller = sellers.find(s => s.id === o.sellerId) || null;
      return calculateOrderMetrics({
        orderId: o.orderId,
        productName: o.productName,
        variation: o.variation,
        sku: o.sku,
        quantity: o.quantity,
        revenue: o.revenue,
         date: o.date,
        seller: matchedSeller,
        productCosts,
        shopeeCommissionRate: shopeeFeeRate,
      });
    });
    
    onClearOrders();
    onImportOrders(recomputedList);
  };

  // Graphic Colors Config
  const COLORS = ['#06b6d4', '#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  const PIE_COLORS = {
    costs: '#ef4444',
    shopee: '#f97316',
    comission: '#3b82f6',
    profit: '#10b981'
  };

  // Donut chart pie list mapping
  const pieDataCombined = [
    { name: 'Custo Produção', value: metrics.totalCost, color: PIE_COLORS.costs },
    { name: 'Comissão Shopee', value: metrics.totalShopeeFee, color: PIE_COLORS.shopee },
    { name: 'Comissão Vendedores', value: metrics.totalSellerCommission, color: PIE_COLORS.comission },
    { name: 'Lucro Líquido', value: Math.max(0, metrics.netProfit), color: PIE_COLORS.profit }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row pb-12" id="admin-dashboard-root">
      
      {/* Side Navigation panel */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 shrink-0 p-5 flex flex-col justify-between" id="admin-side-menu">
        <div>
          {/* Brand header snippet */}
          <div className="flex items-center gap-3 pb-6 border-b border-slate-800/80 mb-6">
            <div className="p-2 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-xl text-white">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-md font-extrabold tracking-tight text-white leading-tight">
                3D Memories
              </h2>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Produtor Admin</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 mb-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1">
                <Sliders className="w-3 h-3 text-cyan-400" /> Taxa Shopee GERAL
              </span>
              <span className="text-xs font-extrabold text-cyan-400">{shopeeFeeRate}%</span>
            </div>
            
            <div className="flex gap-1.5 items-center">
              <input
                id="shopee-fee-input"
                type="number"
                min="0"
                max="50"
                value={shopeeFeeRate}
                onChange={(e) => setShopeeFeeRate(Number(e.target.value))}
                className="w-16 text-center text-xs bg-slate-900 border border-slate-800 focus:border-cyan-500 py-1 px-1 text-white rounded-lg outline-none"
              />
              <button
                id="recalc-fee-btn"
                onClick={handleRecalculateAll}
                title="Recalcular todas as vendas com a nova taxaShopee"
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-wider py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3 h-3 animate-spin duration-1000" /> Aplicar
              </button>
            </div>
            <p className="text-[9px] text-slate-500 mt-1.5 leading-normal">
              Esta porcentagem do valor da venda faturada é cobrada pela Shopee.
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" id="admin-nav">
            <button
              id="nav-btn-metrics"
              onClick={() => setActiveTab('metrics')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'metrics'
                  ? 'bg-cyan-950/60 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Geral / Gráficos de Metas
            </button>

            <button
              id="nav-btn-import"
              onClick={() => setActiveTab('import')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all relative ${
                activeTab === 'import'
                  ? 'bg-cyan-950/60 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Importar Planilha Shopee
              {orders.length === 0 && (
                <span className="absolute right-3.5 top-3.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              )}
            </button>

            <button
              id="nav-btn-costs"
              onClick={() => setActiveTab('costs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'costs'
                  ? 'bg-cyan-950/60 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" />
              Cadastrar Custo de SKU
            </button>

            <button
              id="nav-btn-sellers"
              onClick={() => setActiveTab('sellers')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'sellers'
                  ? 'bg-cyan-950/60 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Vendedores Parceiros
            </button>

            <button
              id="nav-btn-sales"
              onClick={() => setActiveTab('sales')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'sales'
                  ? 'bg-cyan-950/60 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Visualizar Vendas ({orders.length})
            </button>
          </nav>
        </div>

        {/* User context footer */}
        <div className="pt-6 border-t border-slate-800/80 mt-6 space-y-3" id="admin-user-nav-footer">
          <div className="px-1">
            <span className="block text-[11px] text-slate-400 font-semibold">{currentUser.name}</span>
            <span className="block text-[9px] text-slate-500 font-mono truncate">{currentUser.email}</span>
          </div>
          <button
            id="admin-btn-logout"
            onClick={onLogOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-800 hover:bg-red-950/20 hover:border-red-900/60 text-slate-400 hover:text-red-400 text-xs font-semibold rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main dashboard content workspace */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto" id="admin-workspace">
        
        {/* Metric Overview Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" id="admin-kpis-grid">
          {/* Card 1: Faturamento */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm" id="kpi-card-revenue">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
              Faturamento Bruto <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-white font-sans">
              {formatBRL(metrics.totalRevenue)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Concluído dentro do mês</p>
          </div>

          {/* Card 2: Margem de Lucro */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm" id="kpi-card-margin">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
              Margem Média de Lucro <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-emerald-400 font-sans">
              {metrics.profitMargin.toFixed(1)}%
            </p>
            <span className={`inline-flex items-center text-[10px] py-0.5 rounded-full ${
              metrics.profitMargin > 30 ? 'text-emerald-400' : 'text-amber-500'
            }`}>
              {formatBRL(metrics.netProfit)} Líquido
            </span>
          </div>

          {/* Card 3: Custos de fabricação */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm" id="kpi-card-costs">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
              Custo de Material (Filamento) <Database className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-red-400 font-sans">
              {formatBRL(metrics.totalCost)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Produção 3D Memories</p>
          </div>

          {/* Card 4: Comissão da Equipe */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm" id="kpi-card-comms">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
              Comissão Vendedores <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-indigo-400 font-sans">
              {formatBRL(metrics.totalSellerCommission)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Valor distribuído</p>
          </div>
        </div>

        {/* Tab 1: METRICS AND CHARTS PANELS */}
        {activeTab === 'metrics' && (
          <div className="space-y-6" id="panel-metrics">
            {orders.length === 0 ? (
              <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl p-8 text-center" id="empty-state-metrics">
                <FileSpreadsheet className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-md font-bold text-slate-300">Sem dados para exibição de gráficos</h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto mt-1 mb-5">
                  Para visualizar as métricas de vendas e gráficos mensais detalhados, acesse a aba "Importar Planilha Shopee" e carregue o relatório de vendas.
                </p>
                <button
                  id="go-to-import-tab-btn"
                  onClick={() => setActiveTab('import')}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2 px-4 rounded-xl transition-colors"
                >
                  Importar Planilha
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Timeline Chart Box */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5" id="chart-earnings-timeline">
                  <h3 className="text-sm font-bold text-white mb-1">Acompanhamento de Vendas Diárias</h3>
                  <p className="text-slate-400 text-xs mb-4">Evolução do faturamento bruto vs lucro líquido de vendas concluídas</p>
                  
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
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
                        <Area type="monotone" name="Faturamento" dataKey="vaturamento" stroke="#06b6d4" fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" name="Lucro Líquido" dataKey="lucro" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Donut Profit Margins Breakdown */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="chart-margin-distribution">
                  <h3 className="text-sm font-bold text-white mb-1">Distribuição Financeira</h3>
                  <p className="text-slate-400 text-xs mb-4">Como cada real do faturamento é dividido</p>
                  
                  <div className="h-44 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieDataCombined}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieDataCombined.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 11 }}
                          formatter={(value: any) => formatBRL(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Stats overlay center */}
                    <div className="absolute text-center">
                      <span className="block text-[9px] text-slate-500 font-bold uppercase">MARGEM NET</span>
                      <span className="block text-lg font-black text-emerald-400">{metrics.profitMargin.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {pieDataCombined.map((p, idx) => (
                      <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex flex-col justify-between">
                        <span className="text-[9px] text-slate-400 flex items-center gap-1.5 font-semibold">
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>
                        <span className="text-xs font-bold text-white mt-1">
                          {formatBRL(p.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seller Rankings Bar Graph */}
                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5" id="chart-seller-rankings">
                  <h3 className="text-sm font-bold text-white mb-1">Análise de Performance dos Vendedores</h3>
                  <p className="text-slate-400 text-xs mb-4">Volume total de vendas e comissão faturada de cada vendedor parceiro</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sellerRankings}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `R$${val}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 11 }}
                            formatter={(value: any) => formatBRL(Number(value))}
                          />
                          <Bar name="Vendas Faturadas" dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                            {sellerRankings.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                          <Bar name="Comissões Pagas" dataKey="commission" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                        LÍDERES DE VENDAS NO MÊS
                      </span>
                      {sellerRankings.map((sr, idx) => (
                        <div key={sr.id} className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-cyan-400 px-1.5 py-0.5 bg-cyan-950 border border-cyan-800/20 rounded-md">
                              #{idx + 1}
                            </span>
                            <div>
                              <span className="block text-xs font-bold text-slate-200">{sr.name}</span>
                              <span className="block text-[9px] text-slate-500">{sr.count} itens vendidos</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="block text-xs font-bold text-white">{formatBRL(sr.revenue)}</span>
                            <span className="block text-[9px] text-indigo-400 font-bold">Com: {formatBRL(sr.commission)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Tab 2: IMPORT SHOPEE SHEET PANELS */}
        {activeTab === 'import' && (
          <div className="space-y-6" id="panel-import">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="import-uploader-box">
              <h3 className="text-sm font-bold text-white mb-1">Importar Relatório Consolidado da Shopee</h3>
              <p className="text-slate-400 text-xs mb-6">
                Para calcular os lucros, envie a planilha de produtos concluídos exportada diretamente da Shopee. Nós processamos tudo localmente no seu navegador.
              </p>

              {/* Upload Dropzone */}
              <div
                id="dropzone-area"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-cyan-500/60 bg-slate-950/40 hover:bg-slate-900/40 rounded-2xl p-10 cursor-pointer text-center transition-all group mb-4"
              >
                <input
                  id="excel-file-uploader"
                  type="file"
                  ref={fileInputRef}
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <UploadCloud className="w-12 h-12 text-slate-600 group-hover:text-cyan-400 mx-auto mb-3 transition-colors duration-300" />
                
                <h4 className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                  Arraste e solte sua planilha do mês aqui
                </h4>
                <p className="text-slate-500 text-xs mt-1">
                  Suporta arquivos formatados em .XLSX, .XLS ou .CSV da Shopee
                </p>
                <div className="mt-4 outline-none inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 group-hover:bg-cyan-950 border border-slate-800 group-hover:border-cyan-800 text-slate-400 group-hover:text-cyan-400 hover:text-white rounded-lg text-xs font-semibold tracking-wider transition-colors">
                  Procurar Arquivo Local
                </div>
              </div>

              {/* Status Alert logs */}
              {importStatus === 'loading' && (
                <div className="bg-slate-950 border border-cyan-950 rounded-xl p-4 flex items-center justify-center gap-3" id="import-state-loading">
                  <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                  <span className="text-xs font-semibold text-slate-300">Decodificando arquivo e extraindo registros...</span>
                </div>
              )}

              {importStatus === 'error' && (
                <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 text-xs text-red-300" id="import-state-error">
                  <p className="font-bold">Houve um erro de leitura:</p>
                  <p className="mt-1">{importError}</p>
                </div>
              )}

              {importStatus === 'success' && (
                <div className="bg-emerald-950/40 border border-emerald-800/45 rounded-xl p-4 text-xs text-emerald-300 flex items-center justify-between" id="import-state-success">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Planilha processada! <strong>{importCount}</strong> pedidos adicionados com sucesso ao sistema.</span>
                  </div>
                </div>
              )}

              {/* DEMO DATA QUICK ACCESSIBILITY */}
              <div className="mt-8 border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" id="sample-sheet-generator">
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Não possui uma planilha em mãos no momento?</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Baixe nosso arquivo modelo com produtos da 3D Memories ou use o botão para injetar dados teste.</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    id="download-demo-csv-btn"
                    onClick={handleDownloadDemoCSV}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar Planilha Teste (.CSV)
                  </button>
                  <button
                    id="inject-demo-data-btn"
                    onClick={() => {
                      setImportStatus('loading');
                      const csvContent = generateDemoShopeeCSV();
                      // Parse
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
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Carregar Simulador Teste
                  </button>
                </div>
              </div>
            </div>

            {/* Column Mapping Configuration Panel */}
            {showMappingStep && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="column-mapping-editor">
                <div className="flex items-center gap-2 text-cyan-400 mb-3">
                  <Sliders className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-white">Mapeamento de Colunas da Planilha</h3>
                </div>
                <p className="text-slate-400 text-xs mb-5">
                  Nós auto-detectamos os campos mais adequados, mas certifique-se de que correspondem exatamente à sua planilha nos campos abaixo para garantir o cálculo de margem exato:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                  {Object.keys(columnMapping).map((mapKey) => {
                    const translations: Record<string, string> = {
                      orderIdCol: 'ID/Número do Pedido',
                      productNameCol: 'Nome do Produto',
                      variationCol: 'Nome da Variação',
                      skuCol: 'Código SKU',
                      quantityCol: 'Quantidade Escrita',
                      revenueCol: 'Valor Pago Comprador',
                      dateCol: 'Data do Concluído',
                    };

                    return (
                      <div key={mapKey} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          {translations[mapKey]}
                        </label>
                        <select
                          id={`select-map-${mapKey}`}
                          value={columnMapping[mapKey]}
                          onChange={(e) => setColumnMapping({ ...columnMapping, [mapKey]: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-1.5 rounded-lg outline-none focus:border-cyan-500"
                        >
                          <option value="">Não mapear / Ignorar</option>
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

                <div className="flex justify-end gap-2">
                  <button
                    id="cancel-mapping-btn"
                    onClick={() => { setShowMappingStep(false); setRawHeaders([]); setRawRows([]); }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    id="confirm-import-btn"
                    onClick={confirmMappingAndImport}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-950/20"
                  >
                    Confirmar e Importar Registros
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

         {/* Tab 3: MANAGE PRODUCT PRODUCTION COST RULE DATABASE */}
        {activeTab === 'costs' && (
          <div className="space-y-6" id="panel-costs">
            
            {/* Inline creation form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="add-cost-rule-box">
              <h3 className="text-sm font-bold text-white mb-2">Configurar Custo e Comissões de SKU</h3>
              <p className="text-slate-400 text-xs mb-4">
                Cadastre as regras de custo e comissão de material para suas peças impressas 3D. O sistema aplicará estes valores quando encontrar correspondências no SKU ou Nome do item na planilha Shopee.
              </p>

              <form onSubmit={handleCreateCostSubmission} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      SKU / Nome para Correspondência
                    </label>
                    <input
                      id="input-cost-sku"
                      type="text"
                      required
                      placeholder="Ex: LUM-LITHO ou Batman 3D"
                      value={newCostPattern}
                      onChange={(e) => setNewCostPattern(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white p-2.5 rounded-xl outline-none"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">
                      Será aplicado ao item que contiver esse termo.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Custo de Produção (BRL)
                    </label>
                    <input
                      id="input-cost-price"
                      type="number"
                      step="0.01"
                      required
                      placeholder="R$ 0,00"
                      value={newCostPrice}
                      onChange={(e) => setNewCostPrice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white p-2.5 rounded-xl outline-none"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">
                      Ex: material + filamento + energia
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Taxa de Comissão Shopee (%) <span className="text-slate-500 italic lowercase">(opcional)</span>
                    </label>
                    <input
                      id="input-custom-shopee-rate"
                      type="number"
                      step="0.1"
                      placeholder="Padrão: 20%"
                      value={newCostShopeeRate}
                      onChange={(e) => setNewCostShopeeRate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white p-2.5 rounded-xl outline-none"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">
                      Deixe vazio para usar a Taxa Shopee Geral ({shopeeFeeRate}%).
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Comissão do Vendedor Fixo (BRL) <span className="text-slate-500 italic lowercase">(opcional)</span>
                    </label>
                    <input
                      id="input-custom-seller-comm"
                      type="number"
                      step="0.01"
                      placeholder="Padrão: 50% Líquido"
                      value={newCostSellerCommission}
                      onChange={(e) => setNewCostSellerCommission(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white p-2.5 rounded-xl outline-none"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">
                      Deixe vazio para usar a Logística Padrão (50/50).
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="btn-add-cost-record"
                    type="submit"
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950/20"
                  >
                    <Plus className="w-4 h-4" /> Cadastrar Custo e Comissão de SKU
                  </button>
                </div>
              </form>
            </div>

            {/* Current Product cost list table catalog */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="costs-catalog-box">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Catálogo de Custos e Regulamentações por Código</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Define custo de matéria-prima, comissão Shopee seletiva e taxas de vendas</p>
                </div>
                <span className="text-xs bg-slate-950 text-slate-400 font-bold py-1 px-3 border border-slate-800 rounded-lg">
                  {productCosts.length} SKU(s) cadastrados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" id="costs-table">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">SKU / Correspondência</th>
                      <th className="pb-3 text-right">Custo de Produção</th>
                      <th className="pb-3 text-right">Taxa Shopee (%)</th>
                      <th className="pb-3 text-right">Comissão Vendedor (R$ Fixo)</th>
                      <th className="pb-3 text-right pr-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productCosts.map((c) => (
                      <tr key={c.id} className="border-b border-slate-800/60 hover:bg-slate-950/20 text-xs">
                        <td className="py-3.5 pl-2 font-mono font-bold text-slate-200">
                          {c.nameOrSku}
                        </td>
                        <td className="py-3.5 text-right font-extrabold text-red-400">
                          {editingCostId === c.id ? (
                            <div className="flex justify-end gap-1 items-center">
                              <span className="text-slate-500 text-[11px]">R$</span>
                              <input
                                id={`edit-cost-input-${c.id}`}
                                type="number"
                                step="0.01"
                                value={editingCostVal}
                                onChange={(e) => setEditingCostVal(e.target.value)}
                                className="w-20 bg-slate-950 border border-slate-750 text-xs text-white p-1 rounded-md text-right outline-none focus:border-cyan-500"
                              />
                            </div>
                          ) : (
                            formatBRL(c.productionCost)
                          )}
                        </td>
                        <td className="py-3.5 text-right font-semibold text-slate-300">
                          {editingCostId === c.id ? (
                            <div className="flex justify-end gap-1 items-center">
                              <input
                                id={`edit-shopee-rate-${c.id}`}
                                type="number"
                                step="0.1"
                                placeholder={`Geral: ${shopeeFeeRate}%`}
                                value={editingCostShopeeRate}
                                onChange={(e) => setEditingCostShopeeRate(e.target.value)}
                                className="w-20 bg-slate-950 border border-slate-750 text-xs text-white p-1 rounded-md text-right outline-none focus:border-cyan-500"
                              />
                              <span className="text-slate-500 text-[11px]">%</span>
                            </div>
                          ) : (
                            c.shopeeCommissionRate ? `${c.shopeeCommissionRate}%` : <span className="text-slate-500 italic">Padrão ({shopeeFeeRate}%)</span>
                          )}
                        </td>
                        <td className="py-3.5 text-right font-medium text-emerald-400">
                          {editingCostId === c.id ? (
                            <div className="flex justify-end gap-1 items-center">
                              <span className="text-slate-500 text-[11px]">R$</span>
                              <input
                                id={`edit-seller-comm-${c.id}`}
                                type="number"
                                step="0.01"
                                placeholder="Padrão: 50%"
                                value={editingCostSellerComm}
                                onChange={(e) => setEditingCostSellerComm(e.target.value)}
                                className="w-24 bg-slate-950 border border-slate-750 text-xs text-white p-1 rounded-md text-right outline-none focus:border-cyan-500"
                              />
                            </div>
                          ) : (
                            c.customSellerCommission ? formatBRL(c.customSellerCommission) : <span className="text-slate-500 italic">Geral (50/50)</span>
                          )}
                        </td>
                        <td className="py-3.5 text-right pr-2">
                          <div className="flex items-center justify-end gap-2">
                            {editingCostId === c.id ? (
                              <>
                                <button
                                  id={`save-cost-${c.id}`}
                                  onClick={() => handleUpdateCost(c.id)}
                                  className="text-emerald-400 hover:text-emerald-500 font-bold text-[10px] uppercase bg-emerald-950 px-2 py-1 rounded border border-emerald-800"
                                >
                                  Salvar
                                </button>
                                <button
                                  id={`cancel-cost-${c.id}`}
                                  onClick={() => setEditingCostId(null)}
                                  className="text-slate-400 hover:text-slate-300 text-[10px] uppercase bg-slate-800 px-2 py-1 rounded"
                                >
                                  Sair
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  id={`edit-btn-${c.id}`}
                                  onClick={() => { 
                                    setEditingCostId(c.id); 
                                    setEditingCostVal(String(c.productionCost));
                                    setEditingCostShopeeRate(c.shopeeCommissionRate !== undefined ? String(c.shopeeCommissionRate) : '');
                                    setEditingCostSellerComm(c.customSellerCommission !== undefined ? String(c.customSellerCommission) : '');
                                  }}
                                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                                  title="Editar custo"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  id={`delete-btn-${c.id}`}
                                  onClick={() => onDeleteProductCost(c.id)}
                                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                  title="Excluir custo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {productCosts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                          Nenhum custo cadastrado no catálogo. Adicione regras acima ou use os dados demo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: SELLERS TEAM MANAGER AND COMMISSIONS CONFIG */}
        {activeTab === 'sellers' && (
          <div className="space-y-6" id="panel-sellers">
            
            {/* Seller registration form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="add-seller-box">
              <h3 className="text-sm font-bold text-white mb-2">Cadastrar Vendedor Parceiro</h3>
              <p className="text-slate-400 text-xs mb-4">
                Registre novos vendedores parceiros no sistema. Eles terão comissão individualizada sobre as vendas e poderão logar para acompanhar seu progresso diário e mensal.
              </p>

              <form onSubmit={handleCreateSellerSubmission} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Nome Completo do Parceiro
                  </label>
                  <input
                    id="input-seller-name"
                    type="text"
                    required
                    placeholder="Ex: João Pedro Sales"
                    value={newSellerName}
                    onChange={(e) => setNewSellerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white p-2 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    E-mail do Vendedor (Login)
                  </label>
                  <input
                    id="input-seller-email"
                    type="email"
                    required
                    placeholder="joao@parceiro.com"
                    value={newSellerEmail}
                    onChange={(e) => setNewSellerEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white p-2 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    <span>Taxa Comissão</span>
                    <span className="text-cyan-400 font-semibold">{newSellerComm}%</span>
                  </div>
                  <input
                    id="range-seller-comm"
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={newSellerComm}
                    onChange={(e) => setNewSellerComm(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div>
                  <button
                    id="btn-add-seller-record"
                    type="submit"
                    className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-95 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1 transition-all h-9"
                  >
                    <Plus className="w-4 h-4" /> Conectar Vendedor
                  </button>
                </div>
              </form>
            </div>

            {/* Current Sellers dynamic list */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="sellers-list-box">
              <h3 className="text-sm font-bold text-white mb-4">Membros da Equipe e Comissões Conectadas</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sellers.map((s) => {
                  const sellerSales = orders.filter(o => o.sellerId === s.id);
                  const totalFaturamento = sellerSales.reduce((acc, current) => acc + current.revenue, 0);
                  const totalComissao = sellerSales.reduce((acc, current) => acc + current.sellerCommissionAmount, 0);

                  return (
                    <div key={s.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
                      <div>
                        {/* Title header */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="block text-xs font-bold text-white">{s.name}</span>
                            <span className="block text-[9px] text-slate-500 font-mono mt-0.5">{s.email}</span>
                          </div>
                          
                          {s.commissionRate > 0 ? (
                            <span className="text-[10px] font-extrabold text-cyan-400 px-2 py-0.5 bg-cyan-950/60 border border-cyan-800/30 rounded-lg">
                              {s.commissionRate}% Comissão
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold text-amber-500 px-2 py-0.5 bg-amber-950/60 border border-amber-800/30 rounded-lg">
                              Orgânico / Direto
                            </span>
                          )}
                        </div>

                        {/* Earnings stats wrapper */}
                        <div className="grid grid-cols-2 gap-2 my-3 border-t border-b border-slate-900 py-3">
                          <div>
                            <span className="block text-[9px] text-slate-500 font-bold uppercase">FATURADO</span>
                            <span className="block text-xs font-extrabold text-slate-200">{formatBRL(totalFaturamento)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-500 font-bold uppercase">COMISSÕES</span>
                            <span className="block text-xs font-extrabold text-indigo-400">{formatBRL(totalComissao)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Editing panel triggers */}
                      <div className="flex items-center gap-1 justify-between pt-1 border-t border-slate-900">
                        {editingSellerId === s.id ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Ajustar:</span>
                            <input
                              id={`edit-seller-comm-${s.id}`}
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={editingSellerComm}
                              onChange={(e) => setEditingSellerComm(Number(e.target.value))}
                              className="w-14 bg-slate-900 border border-slate-700 text-[10px] text-white p-1 rounded-md text-center outline-none"
                            />
                            <span className="text-[10px] text-slate-400">%</span>
                            <button
                              id={`save-seller-${s.id}`}
                              onClick={() => handleUpdateSellerComm(s.id)}
                              className="text-emerald-400 bg-emerald-950 px-2 py-0.5 border border-emerald-800 rounded text-[9px] font-bold uppercase shrink-0"
                            >
                              Salvar
                            </button>
                            <button
                              id={`cancel-seller-${s.id}`}
                              onClick={() => setEditingSellerId(null)}
                              className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[9px] uppercase shrink-0"
                            >
                              Sair
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-[10px] text-slate-500 font-semibold">{sellerSales.length} transações</span>
                            <div className="flex gap-2">
                              {s.id !== 'sell_3dmem' && (
                                <>
                                  <button
                                    id={`edit-seller-btn-${s.id}`}
                                    onClick={() => { setEditingSellerId(s.id); setEditingSellerComm(s.commissionRate); }}
                                    className="bg-slate-900 hover:bg-slate-800 p-1 rounded-lg text-slate-400 hover:text-cyan-400 text-[10px] font-bold uppercase border border-slate-800 px-2"
                                  >
                                    Taxa %
                                  </button>
                                  <button
                                    id={`delete-seller-btn-${s.id}`}
                                    onClick={() => onDeleteSeller(s.id)}
                                    className="p-1.5 bg-slate-900 hover:bg-red-950 hover:text-red-400 border border-slate-800 rounded-lg text-slate-500 transition-colors"
                                    title="Remover vendedor"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* Tab 5: DETAILED TABLE OF SALES AND TRANSACTION CONTROL */}
        {activeTab === 'sales' && (
          <div className="space-y-6" id="panel-sales">
            
            {/* Header filters actions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="sales-search-filters">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Search Bar query inputs */}
                <div className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      id="search-orders-input"
                      type="text"
                      placeholder="Pesquisar por ID do pedido, SKU ou produto..."
                      value={salesSearch}
                      onChange={(e) => setSalesSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs py-2 pl-9 pr-4 rounded-xl text-white outline-none focus:border-cyan-500 placeholder:text-slate-600"
                    />
                  </div>

                  <select
                    id="filter-orders-seller"
                    value={salesSellerFilter}
                    onChange={(e) => setSalesSellerFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                  >
                    <option value="all">Filtrar por Vendedor (Todos)</option>
                    <option value="unassigned">Sem Vendedor (Orgânico)</option>
                    {sellers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Clear database or manual create button */}
                <div className="flex gap-2 shrink-0">
                  <button
                    id="trigger-manual-sale-form"
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Lancar Transação Manual
                  </button>
                  <button
                    id="clear-all-orders-btn"
                    onClick={() => {
                      if (window.confirm('Tem certeza que deseja zerar TODAS as vendas cadastradas neste mês?')) {
                        onClearOrders();
                      }
                    }}
                    className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-red-900/60 text-slate-400 hover:text-red-400 font-semibold text-xs py-2 px-3 rounded-xl transition-all"
                  >
                    Zerar Relatório
                  </button>
                </div>

              </div>

              {/* Collapsible Manual Transaction Insertion Form */}
              {showManualForm && (
                <form onSubmit={handleManualSaleSubmit} className="mt-5 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4 animate-fadeIn" id="manual-data-form">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Sliders className="w-4 h-4 text-indigo-400" /> Detalhes da venda manual offline / shopee
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Nº do Pedido (Opcional)</label>
                      <input
                        id="manual-input-order-id"
                        type="text"
                        placeholder="Ex: 240530X..."
                        value={manualOrderId}
                        onChange={(e) => setManualOrderId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Nome do Produto</label>
                      <input
                        id="manual-input-prod-name"
                        type="text"
                        required
                        placeholder="Ex: Miniatura Batman Articulado"
                        value={manualProdName}
                        onChange={(e) => setManualProdName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">SKU da Peça</label>
                      <input
                        id="manual-input-sku"
                        type="text"
                        placeholder="Para auto-carregar custo"
                        value={manualSku}
                        onChange={(e) => setManualSku(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Atribuir Comissão Vendedor</label>
                      <select
                        id="manual-select-seller"
                        value={manualSellerId}
                        onChange={(e) => setManualSellerId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
                      >
                        <option value="unassigned">Sem Vendedor / Orgânico</option>
                        {sellers.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.commissionRate}%)</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Venda de Variação (Opção)</label>
                      <input
                        id="manual-input-variation"
                        type="text"
                        value={manualVar}
                        onChange={(e) => setManualVar(e.target.value)}
                        placeholder="Ex: Preto fosco / Luminária"
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Quantidade Vendida</label>
                      <input
                        id="manual-input-qty"
                        type="number"
                        min="1"
                        required
                        value={manualQuantity}
                        onChange={(e) => setManualQuantity(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Preço Total Pago pelo Comprador (BRL)</label>
                      <input
                        id="manual-input-revenue"
                        type="number"
                        step="0.01"
                        required
                        placeholder="Ex: 89.90"
                        value={manualRevenue}
                        onChange={(e) => setManualRevenue(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Data da Conclusão</label>
                      <input
                        id="manual-input-date"
                        type="date"
                        value={manualSaleDate}
                        onChange={(e) => setManualSaleDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      id="cancel-manual-form-btn"
                      type="button"
                      onClick={() => setShowManualForm(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold px-4 py-2 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      id="save-manual-form-btn"
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2 rounded-xl"
                    >
                      Adicionar ao Relatório
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Sales items table list catalog */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="sales-metrics-table-box">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-400">Exibindo <strong>{filteredSales.length}</strong> de <strong>{orders.length}</strong> vendas concluídas</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" id="sales-detailed-table">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">ID do Pedido / Data</th>
                      <th className="pb-3">Item / SKU / Variação</th>
                      <th className="pb-3 text-right">Venda Bruta</th>
                      <th className="pb-3 text-right">Custo Unit. (Salva p/ Próximos)</th>
                      <th className="pb-3 text-right">Comissões (Taxa Shopee + Seller)</th>
                      <th className="pb-3 text-right">Lucro Líquido</th>
                      <th className="pb-3 pr-2 text-center">Atribuir Vendedor</th>
                      <th className="pb-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((item) => (
                      <tr key={item.orderId} className="border-b border-slate-800/55 hover:bg-slate-950/30 text-xs">
                        <td className="py-3.5 pl-2">
                          <span className="block font-mono font-bold text-slate-300">{item.orderId}</span>
                          <span className="block text-[9px] text-slate-500 font-mono">{item.date}</span>
                        </td>
                        <td className="py-3.5 max-w-sm">
                          <span className="block font-semibold text-slate-200 truncate">{item.productName}</span>
                          <span className="inline-flex gap-1.5 text-[9px] text-slate-400">
                            <strong>SKU:</strong> {item.sku} | <strong>Var:</strong> {item.variation} | <strong>Qtd:</strong> {item.quantity}
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-extrabold text-white">
                          {formatBRL(item.revenue)}
                        </td>
                        <td className="py-3.5 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-[10px] text-slate-500">R$</span>
                              <input
                                key={`cost-${item.orderId}-${item.calculatedCost}`}
                                id={`cost-edit-input-${item.orderId}`}
                                type="number"
                                step="0.50"
                                min="0"
                                defaultValue={(item.calculatedCost / item.quantity).toFixed(2)}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) {
                                    const currentUnitCost = item.calculatedCost / item.quantity;
                                    if (Math.abs(val - currentUnitCost) > 0.005) {
                                      const key = item.sku && item.sku !== 'S/ SKU' ? item.sku : item.productName;
                                      onSaveOrUpdateCostAndRecalculate(key, val);
                                    }
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat((e.target as HTMLInputElement).value);
                                    if (!isNaN(val) && val >= 0) {
                                      const key = item.sku && item.sku !== 'S/ SKU' ? item.sku : item.productName;
                                      onSaveOrUpdateCostAndRecalculate(key, val);
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }
                                }}
                                className="w-16 bg-slate-950 focus:bg-slate-900 hover:border-slate-700 focus:border-cyan-500 border border-slate-800 text-xs text-white p-1 rounded text-right outline-none transition-all font-mono"
                                title="Defina o valor de custo unitário para este produto. Salvamento imediato para as próximas simulações/extracões."
                              />
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">
                              Total: {formatBRL(item.calculatedCost)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 text-right">
                          <span className="block font-semibold text-amber-500">{formatBRL(item.shopeeFee)} <span className="text-[9px] text-slate-500">(Shopee)</span></span>
                          {item.sellerId !== 'unassigned' && (
                            <span className="block font-semibold text-indigo-400">{formatBRL(item.sellerCommissionAmount)} <span className="text-[9px] text-slate-500">({item.sellerName})</span></span>
                          )}
                        </td>
                        <td className="py-3.5 text-right">
                          <span className={`block font-black ${item.netProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatBRL(item.netProfit)}
                          </span>
                          <span className="block text-[9px] text-slate-500 font-semibold">({item.profitMargin.toFixed(1)}% margin)</span>
                        </td>
                        <td className="py-3.5 pr-2 text-center">
                          <select
                            id={`assign-seller-select-${item.orderId}`}
                            value={item.sellerId || 'unassigned'}
                            onChange={(e) => onAssignSellerToOrder(item.orderId, e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-[10px] text-slate-300 px-2 py-1 rounded-md outline-none focus:border-cyan-500"
                          >
                            <option value="unassigned">Sem Vendedor (Orgânico)</option>
                            {sellers.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.commissionRate}%)</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3.5 text-right pr-2">
                          <button
                            id={`delete-order-btn-${item.orderId}`}
                            onClick={() => onDeleteOrder(item.orderId)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                            title="Remover transação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredSales.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                          {orders.length === 0 ? 'Nenhuma venda carregada. Vá no menu "Importar Planilha" e faça o upload das vendas do mês.' : 'Nenhuma venda corresponde aos filtros inseridos.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
