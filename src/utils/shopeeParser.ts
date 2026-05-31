import { ConcludedOrder, ProductCost, UserAccount, UserRole } from '../types';

// Typical column headers used by Shopee (in Portuguese)
export const SHOPEE_POSSIBLE_HEADERS = {
  orderId: ['Nº do pedido', 'ID do pedido', 'No. do Pedido', 'Nº pedido', 'Numero do Pedido', 'id_pedido', 'order_id', 'Código do pedido', 'No. de Pedido'],
  productName: ['Nome do Produto', 'Nome produto', 'Produto', 'product_name', 'Nome do item', 'Item Name', 'Nome de Produto / Nome da variação'],
  variation: ['Opção de variação', 'Opção Variação', 'Variação', 'Venda de Variação', 'variation', 'Nome da Var.', 'Nome da Variação'],
  sku: ['SKU', 'Referência', 'Código de referência', 'SKU Parent Parent SKU', 'sku', 'Código SKU', 'SKU Ref'],
  quantity: ['Quantidade', 'Qtd', 'Quant.', 'quantity', 'qtd', 'Qtd.'],
  revenue: ['Total pago pelo comprador', 'Preço Unitário', 'Preço de Venda', 'Preço do Produto', 'Preço', 'Preço Pago', 'Preco Pago', 'Total Pago', 'Preço cobrado de cada item', 'Subtotal', 'total_amount', 'Receita', 'Preço Unitário do Produto'],
  date: ['Data de criação do pedido', 'Hora de criação do pedido', 'Data do pedido', 'Data do Pedido', 'Hora do pagamento', 'Data concluído', 'date_created', 'Data de envio', 'Data de Criação do Pedido'],
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
 * Checks if a single string matches any candidate header in SHOPEE_POSSIBLE_HEADERS
 */
export function isShopeeHeaderField(cell: string): boolean {
  const norm = normalizeHeader(cell);
  if (!norm) return false;
  for (const candidates of Object.values(SHOPEE_POSSIBLE_HEADERS)) {
    const candidateCleans = candidates.map((c) => normalizeHeader(c));
    if (candidateCleans.some((cc) => norm.includes(cc) || cc.includes(norm))) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts headers and rows from a two-dimensional array of strings,
 * finding the best row to act as the column headers based on candidate match score.
 */
export function extractHeadersAndRows(grid: any[][]): { headers: string[]; rows: any[][] } {
  if (!grid || grid.length === 0) {
    return { headers: [], rows: [] };
  }

  let maxScore = -1;
  let headerIndex = 0;

  // Search the first 15 rows for the best header row (most matched Shopee keywords)
  const limit = Math.min(15, grid.length);
  for (let i = 0; i < limit; i++) {
    const row = grid[i];
    if (!row) continue;
    let score = 0;
    for (const cell of row) {
      if (cell && isShopeeHeaderField(String(cell))) {
        score++;
      }
    }
    // Boost score if it contains key elements like orderId or productName
    const rowStr = row.map(c => normalizeHeader(String(c || ''))).join(' ');
    if (rowStr.includes('ndopedido') || rowStr.includes('iddopedido')) score += 2;
    if (rowStr.includes('nomedoproduto') || rowStr.includes('nomedoitem')) score += 1;

    if (score > maxScore) {
      maxScore = score;
      headerIndex = i;
    }
  }

  // If no row matched any headers sensibly, default to 0
  const finalHeaderIndex = maxScore > 0 ? headerIndex : 0;

  const headers = (grid[finalHeaderIndex] || []).map((h) => String(h || '').trim());
  
  // Rows are everything after the finalHeaderIndex that are not empty
  const rows = grid.slice(finalHeaderIndex + 1).filter((r) => r && r.some((cell) => cell !== null && cell !== ''));

  return { headers, rows };
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
  if (!result.orderIdCol) result.orderIdCol = headers.find(h => normalizeHeader(h).includes('ped') || normalizeHeader(h).includes('ord')) || headers[0] || '';
  if (!result.productNameCol) result.productNameCol = headers.find(h => normalizeHeader(h).includes('prod') || normalizeHeader(h).includes('item')) || headers[1] || '';
  if (!result.variationCol) result.variationCol = headers.find(h => normalizeHeader(h).includes('var') || normalizeHeader(h).includes('opc')) || '';
  if (!result.skuCol) result.skuCol = headers.find(h => normalizeHeader(h).includes('sku') || normalizeHeader(h).includes('ref')) || '';
  if (!result.quantityCol) result.quantityCol = headers.find(h => normalizeHeader(h).includes('qtd') || normalizeHeader(h).includes('quant') || normalizeHeader(h).includes('unid')) || '';
  if (!result.revenueCol) result.revenueCol = headers.find(h => normalizeHeader(h).includes('total') || normalizeHeader(h).includes('prec') || normalizeHeader(h).includes('pago') || normalizeHeader(h).includes('recei')) || '';
  if (!result.dateCol) result.dateCol = headers.find(h => normalizeHeader(h).includes('data') || normalizeHeader(h).includes('hora') || normalizeHeader(h).includes('criac') || normalizeHeader(h).includes('concl')) || '';

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
  return [];
}

export interface ParsedPasteOrder {
  orderId: string;
  date: string;
  revenue: number; // Valor liberado
  buyerName?: string;
  paymentMethod?: string;
  status?: string;
  productId?: string; // Associated product cost ID, if mapped
  sellerId?: string;  // Associated seller ID, if mapped
}

export function parsePastedShopeeText(text: string): ParsedPasteOrder[] {
  if (!text) return [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
  if (lines.length === 0) return [];

  const hasTabs = lines.some(line => line.includes('\t'));
  const parsedOrders: ParsedPasteOrder[] = [];

  if (hasTabs) {
    lines.forEach(line => {
      const cells = line.split('\t').map(c => c.trim());
      if (cells.length < 2) return;
      
      const orderIdIdx = cells.findIndex(c => /^[A-Z5-9]{12,18}$/i.test(c) || /^\d{12,18}$/.test(c) || /^[A-Z0-9]+$/i.test(c) && c.length >= 10 && c.length <= 18);
      if (orderIdIdx === -1) return;
      
      const orderId = cells[orderIdIdx];
      const dateCell = cells.find(c => /\b\d{2}\/\d{2}\/\d{4}\b/.test(c)) || '';
      
      const buyerCell = cells.find(c => /comprador:|comprador\s*:/i.test(c)) || '';
      const buyerName = buyerCell ? buyerCell.replace(/comprador\s*:/i, '').trim() : '';

      let revenue = 0;
      const moneyCell = cells.find(c => /R\$\s*[\d.,]+/i.test(c) || (/\d+,\d{2}/.test(c) && c !== orderId));
      if (moneyCell) {
        revenue = parseBRLNumber(moneyCell);
      }

      const paymentMethod = cells.find(c => /pix|cart\u00E3o|cred|deb|boleto|transfer/i.test(c)) || '';
      const status = cells.find(c => /pago|complet|sucesso|transfer/i.test(c)) || '';

      parsedOrders.push({
        orderId,
        date: dateCell || new Date().toISOString().split('T')[0],
        revenue,
        buyerName,
        paymentMethod,
        status,
      });
    });

    if (parsedOrders.length > 0) {
      return parsedOrders;
    }
  }

  // Interleaved parsing (line-by-line)
  let i = 0;
  while (i < lines.length) {
    const currentLine = lines[i];
    
    // Check if line looks like an Order ID
    if (/^[A-Z0-9]{12,18}$/i.test(currentLine)) {
      const orderId = currentLine;
      const blockLines: string[] = [];
      
      let j = i + 1;
      while (j < lines.length && !/^[A-Z0-9]{12,18}$/i.test(lines[j])) {
        blockLines.push(lines[j]);
        j++;
      }
      
      let buyerName = '';
      let dateVal = '';
      let statusVal = '';
      let paymentVal = '';
      let revenueVal = 0;

      blockLines.forEach(line => {
        if (/comprador\s*:/i.test(line)) {
          buyerName = line.replace(/comprador\s*:/i, '').trim();
        } else if (/\b\d{2}\/\d{2}\/\d{4}\b/.test(line)) {
          dateVal = line;
        } else if (/pix|cart\u00E3o|cred|deb|boleto|transfer/i.test(line)) {
          paymentVal = line;
        } else if (/R\$\s*[\d.,]+/i.test(line) || /\d+,\d{2}/.test(line)) {
          revenueVal = parseBRLNumber(line);
        } else {
          if (line.length > 5) {
            statusVal = line;
          }
        }
      });

      parsedOrders.push({
        orderId,
        date: dateVal || new Date().toISOString().split('T')[0],
        revenue: revenueVal,
        buyerName,
        paymentMethod: paymentVal,
        status: statusVal,
      });

      i = j;
    } else {
      i++;
    }
  }

  return parsedOrders;
}
