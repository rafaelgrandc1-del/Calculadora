import { ConcludedOrder, ProductCost, UserAccount, UserRole } from '../types';

// Typical column headers used by Shopee (in Portuguese)
export const SHOPEE_POSSIBLE_HEADERS = {
  orderId: ['Nº do pedido', 'ID do pedido', 'No. do Pedido', 'Nº pedido', 'Numero do Pedido', 'id_pedido', 'order_id'],
  productName: ['Nome do Produto', 'Nome produto', 'Produto', 'product_name', 'Nome do item'],
  variation: ['Opção de variação', 'Opção Variação', 'Variação', 'Venda de Variação', 'variation'],
  sku: ['SKU', 'Referência', 'Código de referência', 'SKU Parent Parent SKU', 'sku'],
  quantity: ['Quantidade', 'Qtd', 'Quant.', 'quantity', 'qtd'],
  revenue: ['Total pago pelo comprador', 'Preço Unitário', 'Preço de Venda', 'Preço do Produto', 'Preço', 'Preço cobrado de cada item', 'Subtotal', 'total_amount', 'Receita'],
  date: ['Data de criação do pedido', 'Hora de criação do pedido', 'Data do pedido', 'Data do Pedido', 'Hora do pagamento', 'Data concluído', 'date_created'],
};

/**
 * Normalizes a string to compare headers reliably
 */
export function normalizeHeader(val: string): string {
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '') // remove special characters
    .trim();
}

/**
 * Automatically discovers matching column headers based on possible candidates
 */
export function detectShopeeColumns(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {
    orderIdCol: '',
    productNameCol: '',
    variationCol: '',
    skuCol: '',
    quantityCol: '',
    revenueCol: '',
    dateCol: '',
  };

  const normalizedHeaders = headers.map((h) => ({ original: h, clean: normalizeHeader(h) }));

  for (const [key, candidates] of Object.entries(SHOPEE_POSSIBLE_HEADERS)) {
    const candidateCleans = candidates.map((c) => normalizeHeader(c));
    const matched = normalizedHeaders.find((nh) =>
      candidateCleans.some((cc) => nh.clean.includes(cc) || cc.includes(nh.clean))
    );

    if (matched) {
      result[`${key}Col`] = matched.original;
    }
  }

  // Fallback defaults if not found
  if (!result.orderIdCol) result.orderIdCol = headers[0] || '';
  if (!result.productNameCol) result.productNameCol = headers.find(h => normalizeHeader(h).includes('prod')) || headers[1] || '';
  if (!result.variationCol) result.variationCol = headers.find(h => normalizeHeader(h).includes('var')) || '';
  if (!result.skuCol) result.skuCol = headers.find(h => normalizeHeader(h).includes('sku')) || '';
  if (!result.quantityCol) result.quantityCol = headers.find(h => normalizeHeader(h).includes('qtd') || normalizeHeader(h).includes('quant')) || '';
  if (!result.revenueCol) result.revenueCol = headers.find(h => normalizeHeader(h).includes('total') || normalizeHeader(h).includes('prec') || normalizeHeader(h).includes('pago')) || '';
  if (!result.dateCol) result.dateCol = headers.find(h => normalizeHeader(h).includes('data') || normalizeHeader(h).includes('hora') || normalizeHeader(h).includes('criac')) || '';

  return result;
}

/**
 * Normalizes numeric inputs (e.g., converts BRL format "R$ 49,90" or "49,90" to 49.90)
 */
export function parseBRLNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).trim();
  str = str.replace('R$', '').replace(/\s/g, '');
  
  // Checking if format is like 1.234,56
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // 1.234,56 -> 1234.56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 -> 1234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // 49,90 -> 49.90
    str = str.replace(',', '.');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Generates commission and cost calculations for a raw order line
 */
export function calculateOrderMetrics(params: {
  orderId: string;
  productName: string;
  variation: string;
  sku: string;
  quantity: number;
  revenue: number;
  date: string;
  seller: UserAccount | null;
  productCosts: ProductCost[];
  shopeeCommissionRate: number; // typically 20%
}): ConcludedOrder {
  const {
    orderId,
    productName,
    variation,
    sku,
    quantity,
    revenue,
    date,
    seller,
    productCosts,
    shopeeCommissionRate: globalShopeeRate,
  } = params;

  // Find cost in list
  // Best match algorithm: look for matching SKU first, then matching Product Name
  let foundCost = 0;
  let customShopeeRate: number | undefined;
  let customSellerComm: number | undefined;
  
  const lowercaseSku = (sku || '').toLowerCase().trim();
  const lowercaseName = (productName || '').toLowerCase().trim();
  const lowercaseVar = (variation || '').toLowerCase().trim();

  // Try exact SKU or substring SKU match
  let matchedCostItem = productCosts.find((c) => {
    const costPattern = c.nameOrSku.toLowerCase().trim();
    return (
      (lowercaseSku && lowercaseSku === costPattern) ||
      (lowercaseSku && lowercaseSku.includes(costPattern)) ||
      (lowercaseName && lowercaseName === costPattern) ||
      (lowercaseName && lowercaseName.includes(costPattern)) ||
      (lowercaseVar && lowercaseVar.includes(costPattern))
    );
  });

  if (matchedCostItem) {
    foundCost = matchedCostItem.productionCost * quantity;
    customShopeeRate = matchedCostItem.shopeeCommissionRate;
    customSellerComm = matchedCostItem.customSellerCommission;
  } else {
    // Standard default cost: BRL 15.00 per item if not configured
    foundCost = 15.00 * quantity;
  }

  // Effective Shopee rate (custom overrides global)
  const effectiveShopeeRate = (customShopeeRate !== undefined && customShopeeRate !== null && customShopeeRate > 0)
    ? customShopeeRate
    : globalShopeeRate;

  // Calculate Shopee fee BRL
  const shopeeFee = revenue * (effectiveShopeeRate / 100);
  
  // Available Margin (Unidade Faturável Líquida) = Revenue - Shopee Fee - Production Cost
  const netAvailableMargin = revenue - shopeeFee - foundCost;
  
  // Seller commission BRL:
  // In our logistics:
  // - Seller gets 50% of the Available Margin (unless a custom per-item commission is defined)
  // - Direct/unassigned sales have 0 seller commission.
  const sellerRate = seller ? seller.commissionRate : 50.0; // Defaults to 50%
  let sellerCommissionAmount = 0;

  if (seller && seller.id !== 'unassigned') {
    if (customSellerComm !== undefined && customSellerComm !== null && customSellerComm > 0) {
      // Use custom BRL fixed seller commission per item
      sellerCommissionAmount = customSellerComm * quantity;
    } else {
      // 50% (or seller rate) of the Net Available Margin
      // Guard against negative margins so seller doesn't pay for losses unless they share it,
      // but let's base it on positive net available margin.
      sellerCommissionAmount = Math.max(0, netAvailableMargin) * (sellerRate / 100);
    }
  }

  // Net Profit (Producer profit):
  // The producer gets 50% of commission (remaining NAM) + the production cost.
  // Since we represent Net Profit as Revenue - Shopee Fee - Found Cost - Seller Commission,
  // Net Profit becomes NAM - Seller Commission, which is precisely equal to 50% of NAM!
  const netProfit = netAvailableMargin - sellerCommissionAmount;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    orderId: orderId || `SP-${Math.floor(100000 + Math.random() * 900000)}`,
    productName: productName || 'Produto Sem Nome',
    variation: variation || 'Padrão',
    sku: sku || 'S/ SKU',
    quantity: quantity || 1,
    revenue,
    date: date || new Date().toISOString().split('T')[0],
    sellerId: seller ? seller.id : 'unassigned',
    sellerName: seller ? seller.name : 'Orgânico / Sem Vendedor',
    calculatedCost: foundCost,
    sellerCommissionRate: sellerRate,
    sellerCommissionAmount,
    shopeeCommissionRate: effectiveShopeeRate,
    shopeeFee,
    netProfit,
    profitMargin,
  };
}

/**
 * Creates mock Shopee concluded orders CSV for live demonstrations
 * Includes columns typical of a Shopee report in Portuguese
 */
export function generateDemoShopeeCSV(): string {
  const headers = [
    'Nº do pedido',
    'Status do pedido',
    'Nome do Produto',
    'Opção de variação',
    'SKU',
    'Quantidade',
    'Total pago pelo comprador',
    'Data de criação do pedido'
  ];

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');

  const rows = [
    [
      '240530A1BCDF',
      'Concluído',
      'Miniatura Action Figure Batman 3D Articulado',
      'Preto Fosco - 15cm',
      'BAT-3D-15',
      '1',
      '89,90',
      `${year}-${monthStr}-15 14:32`
    ],
    [
      '240530A2GGGH',
      'Concluído',
      'Luminária de Mesa LED Personalizada Lithophane',
      'Base Madeira USB',
      'LUM-LITHO',
      '1',
      '129,90',
      `${year}-${monthStr}-18 10:15`
    ],
    [
      '240530B48FDG',
      'Concluído',
      'Suporte de Headset Astronauta Estiloso',
      'Branco Cósmico',
      'SUP-ASTRO',
      '2',
      '199,80',
      `${year}-${monthStr}-20 18:44`
    ],
    [
      '240530C99JJK',
      'Concluído',
      'Vaso Geométrico Minimalista para Suculentas',
      'Cinza Mármore - P',
      'VASO-GEO-P',
      '3',
      '45,00',
      `${year}-${monthStr}-22 09:12`
    ],
    [
      '240530D72YTR',
      'Concluído',
      'Chaveiro Personalizado Logo Empresa 3D',
      'Kit 10 Unidades',
      'CHAV-LOGO-K10',
      '1',
      '60,00',
      `${year}-${monthStr}-25 11:30`
    ],
    [
      '240530E55HHI',
      'Concluído',
      'Miniatura Action Figure Batman 3D Articulado',
      'Dourado Luxo - 20cm',
      'BAT-3D-20',
      '1',
      '119,90',
      `${year}-${monthStr}-28 16:05`
    ]
  ];

  return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
}

/**
 * Returns default list of production costs for 3D Memories
 */
export function getDefault3DMemoriesCosts(): ProductCost[] {
  return [
    { id: '1', nameOrSku: 'BAT-3D', productionCost: 22.50 }, // Batman 3D Cost
    { id: '2', nameOrSku: 'LUM-LITHO', productionCost: 35.00 }, // Luminaria Lithophane Cost
    { id: '3', nameOrSku: 'SUP-ASTRO', productionCost: 28.00 }, // Astronaut Headset holder Cost
    { id: '4', nameOrSku: 'VASO-GEO', productionCost: 5.50 }, // Geometrical Vase Cost
    { id: '5', nameOrSku: 'CHAV-LOGO', productionCost: 12.00 }, // Keychain logo Cost
    { id: '6', nameOrSku: 'Miniatura', productionCost: 18.00 }, // general matches containing "Miniatura"
    { id: '7', nameOrSku: 'Luminária', productionCost: 30.00 }, // general matches containing "Luminária"
  ];
}

/**
 * Returns default system sellers setup for demo purposes
 */
export function getDefaultSellers(): UserAccount[] {
  return [
    {
      id: 'sell_joao',
      email: 'joao@parceiro.com',
      name: 'João Pedro Sales',
      role: UserRole.SELLER,
      commissionRate: 50.0, // 50% commission
      createdAt: '2026-01-10T12:00:00Z',
    },
    {
      id: 'sell_maria',
      email: 'maria@marketing.com',
      name: 'Maria Clara Souza',
      role: UserRole.SELLER,
      commissionRate: 50.0, // 50% commission
      createdAt: '2026-02-15T14:30:00Z',
    },
    {
      id: 'sell_3dmem',
      email: 'organico@3dmemories.com',
      name: 'Vendas Diretas Orgânicas',
      role: UserRole.SELLER,
      commissionRate: 0.0, // 0% commission direct sale
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];
}
