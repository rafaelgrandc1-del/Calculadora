export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  commissionRate: number; // Default commission % for this seller
  createdAt: string;
}

export interface ProductCost {
  id: string;
  nameOrSku: string; // SKU or Product Name match pattern
  productionCost: number; // Cost in BRL
}

export interface ConcludedOrder {
  orderId: string;
  productName: string;
  variation: string;
  sku: string;
  quantity: number;
  revenue: number; // Price paid by client (excluding Shopee fees or subtotal)
  date: string; // Order Concluded Date
  sellerId: string; // ID of the seller (can be unassigned)
  sellerName: string; // Friendly name of the seller
  calculatedCost: number; // Cost extracted from database or default
  sellerCommissionRate: number; // % applied for Seller commission
  sellerCommissionAmount: number; // BRL commission for the seller
  shopeeCommissionRate: number; // % applied for Shopee fee (default ~20%)
  shopeeFee: number; // BRL fee charged by Shopee
  netProfit: number; // BRL profit remaining
  profitMargin: number; // netProfit / revenue * 100
}

export interface ShopeeColumnMapping {
  orderIdCol: string;
  productNameCol: string;
  variationCol: string;
  skuCol: string;
  quantityCol: string;
  revenueCol: string;
  dateCol: string;
}

export interface MonthlyGoal {
  month: string; // "YYYY-MM"
  targetRevenue: number;
  targetCommission: number;
}
