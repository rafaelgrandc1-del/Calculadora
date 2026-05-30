import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, ProductCost, ConcludedOrder } from './types';
import { LoginScreen } from './components/LoginScreen';
import { DashboardAdmin } from './components/DashboardAdmin';
import { DashboardSeller } from './components/DashboardSeller';
import { getDefault3DMemoriesCosts, getDefaultSellers } from './utils/shopeeParser';
import { Sparkles } from 'lucide-react';

export default function App() {
  // --- Persistent Local Database State Engine ---

  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);
  const [sellers, setSellers] = useState<UserAccount[]>([]);
  const [productCosts, setProductCosts] = useState<ProductCost[]>([]);
  const [orders, setOrders] = useState<ConcludedOrder[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Initialize Database from LocalStorage or default templates
  useEffect(() => {
    try {
      // 1. Load active session
      const storedUser = localStorage.getItem('3d_mem_active_session');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && typeof parsed === 'object' && parsed.email) {
            setActiveUser(parsed);
          } else {
            localStorage.removeItem('3d_mem_active_session');
          }
        } catch (_) {
          localStorage.removeItem('3d_mem_active_session');
        }
      }

      // 2. Load custom sellers (or fallback to defaults)
      const storedSellers = localStorage.getItem('3d_mem_sellers_db');
      if (storedSellers) {
        try {
          const parsed = JSON.parse(storedSellers);
          if (Array.isArray(parsed)) {
            // Filter out invalid items
            const cleaned = parsed.filter(s => s && typeof s === 'object' && s.id && s.name);
            setSellers(cleaned);
          } else {
            throw new Error();
          }
        } catch (_) {
          const fallbacks = getDefaultSellers();
          setSellers(fallbacks);
          localStorage.setItem('3d_mem_sellers_db', JSON.stringify(fallbacks));
        }
      } else {
        const fallbacks = getDefaultSellers();
        setSellers(fallbacks);
        localStorage.setItem('3d_mem_sellers_db', JSON.stringify(fallbacks));
      }

      // 3. Load product production costs (or fallback to defaults)
      const storedCosts = localStorage.getItem('3d_mem_costs_db');
      if (storedCosts) {
        try {
          const parsed = JSON.parse(storedCosts);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(c => c && typeof c === 'object' && c.id && c.nameOrSku);
            setProductCosts(cleaned);
          } else {
            throw new Error();
          }
        } catch (_) {
          const fallbackCosts = getDefault3DMemoriesCosts();
          setProductCosts(fallbackCosts);
          localStorage.setItem('3d_mem_costs_db', JSON.stringify(fallbackCosts));
        }
      } else {
        const fallbackCosts = getDefault3DMemoriesCosts();
        setProductCosts(fallbackCosts);
        localStorage.setItem('3d_mem_costs_db', JSON.stringify(fallbackCosts));
      }

      // 4. Load parsed Shopee orders
      const storedOrders = localStorage.getItem('3d_mem_orders_db');
      if (storedOrders) {
        try {
          const parsed = JSON.parse(storedOrders);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(o => o && typeof o === 'object' && o.orderId);
            setOrders(cleaned);
          } else {
            localStorage.removeItem('3d_mem_orders_db');
          }
        } catch (_) {
          localStorage.removeItem('3d_mem_orders_db');
        }
      }

    } catch (e) {
      console.error('Falha ao restaurar banco local:', e);
    } finally {
      setDbLoaded(true);
    }
  }, []);

  // --- Handlers for Database State Synchronization ---

  // Handle active session login
  const handleLoginSuccess = (user: UserAccount) => {
    setActiveUser(user);
    localStorage.setItem('3d_mem_active_session', JSON.stringify(user));
  };

  // Handle active session logout
  const handleLogOut = () => {
    setActiveUser(null);
    localStorage.removeItem('3d_mem_active_session');
  };

  // Handle seller registration & persistence
  const handleAddSeller = (name: string, email: string, commRate: number): UserAccount => {
    const newSeller: UserAccount = {
      id: `sell_${Date.now()}`,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: UserRole.SELLER,
      commissionRate: commRate,
      createdAt: new Date().toISOString()
    };

    const updated = [...sellers, newSeller];
    setSellers(updated);
    localStorage.setItem('3d_mem_sellers_db', JSON.stringify(updated));
    return newSeller;
  };

  const handleDeleteSeller = (id: string) => {
    const updated = sellers.filter(s => s.id !== id);
    setSellers(updated);
    localStorage.setItem('3d_mem_sellers_db', JSON.stringify(updated));

    // Cleanup: If orders belonged to this deleted seller, make them unassigned (organic)
    const updatedOrders = orders.map(o => {
      if (o.sellerId === id) {
        return {
          ...o,
          sellerId: 'unassigned',
          sellerName: 'Orgânico / Sem Vendedor',
          sellerCommissionAmount: 0 // Revert commission to 0 for organic sales
        };
      }
      return o;
    });
    setOrders(updatedOrders);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(updatedOrders));
  };

  const handleUpdateSellerCommission = (id: string, rate: number) => {
    const updated = sellers.map(s => s.id === id ? { ...s, commissionRate: rate } : s);
    setSellers(updated);
    localStorage.setItem('3d_mem_sellers_db', JSON.stringify(updated));

    // Re-calculate commissions for already loaded orders belonging to this seller
    const updatedOrders = orders.map(o => {
      if (o.sellerId === id) {
        const commAmount = o.revenue * (rate / 100);
        const netProfit = o.revenue - o.shopeeFee - o.calculatedCost - commAmount;
        return {
          ...o,
          sellerCommissionRate: rate,
          sellerCommissionAmount: commAmount,
          netProfit,
          profitMargin: o.revenue > 0 ? (netProfit / o.revenue) * 100 : 0
        };
      }
      return o;
    });
    setOrders(updatedOrders);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(updatedOrders));
  };

  // Handle custom catalog products costs database
  const handleAddProductCost = (pattern: string, cost: number) => {
    const newCost: ProductCost = {
      id: `cost_${Date.now()}`,
      nameOrSku: pattern.trim(),
      productionCost: cost
    };
    const updated = [...productCosts, newCost];
    setProductCosts(updated);
    localStorage.setItem('3d_mem_costs_db', JSON.stringify(updated));
  };

  const handleDeleteProductCost = (id: string) => {
    const updated = productCosts.filter(c => c.id !== id);
    setProductCosts(updated);
    localStorage.setItem('3d_mem_costs_db', JSON.stringify(updated));
  };

  const handleUpdateProductCost = (id: string, cost: number) => {
    const updated = productCosts.map(c => c.id === id ? { ...c, productionCost: cost } : c);
    setProductCosts(updated);
    localStorage.setItem('3d_mem_costs_db', JSON.stringify(updated));
  };

  // Manage imported files / orders
  const handleImportOrders = (newOrders: ConcludedOrder[]) => {
    // Avoid duplicates by analyzing Order IDs
    const currentOrdersMap = new Map(orders.map(o => [o.orderId, o]));
    newOrders.forEach(o => {
      currentOrdersMap.set(o.orderId, o);
    });

    const combined = Array.from(currentOrdersMap.values());
    setOrders(combined);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(combined));
  };

  const handleClearOrders = () => {
    setOrders([]);
    localStorage.removeItem('3d_mem_orders_db');
  };

  const handleDeleteOrder = (orderId: string) => {
    const updated = orders.filter(o => o.orderId !== orderId);
    setOrders(updated);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(updated));
  };

  // Allow admin/vendedor assignment mapping for unassigned transactions
  const handleAssignSellerToOrder = (orderId: string, sellerId: string) => {
    const targetSeller = sellers.find(s => s.id === sellerId) || null;
    const updated = orders.map((o) => {
      if (o.orderId === orderId) {
        const sellerRate = targetSeller ? targetSeller.commissionRate : 0;
        const commAmt = o.revenue * (sellerRate / 100);
        
        // Recompute net profit for this transaction
        const profit = o.revenue - o.shopeeFee - o.calculatedCost - commAmt;

        return {
          ...o,
          sellerId: sellerId,
          sellerName: targetSeller ? targetSeller.name : 'Orgânico / Sem Vendedor',
          sellerCommissionRate: sellerRate,
          sellerCommissionAmount: commAmt,
          netProfit: profit,
          profitMargin: o.revenue > 0 ? (profit / o.revenue) * 100 : 0
        };
      }
      return o;
    });

    setOrders(updated);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(updated));
  };

  if (!dbLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-400 gap-4" id="db-loading-state">
        <Sparkles className="w-10 h-10 text-cyan-400 animate-spin" />
        <span className="text-sm font-semibold">Carregando Banco de Dados 3D Memories...</span>
      </div>
    );
  }

  // Session routing resolver
  if (!activeUser) {
    return (
      <LoginScreen
        sellers={sellers}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSeller={handleAddSeller}
      />
    );
  }

  if (activeUser.role === UserRole.ADMIN) {
    return (
      <DashboardAdmin
        currentUser={activeUser}
        sellers={sellers}
        onAddSeller={handleAddSeller}
        onDeleteSeller={handleDeleteSeller}
        onUpdateSellerCommission={handleUpdateSellerCommission}
        productCosts={productCosts}
        onAddProductCost={handleAddProductCost}
        onDeleteProductCost={handleDeleteProductCost}
        onUpdateProductCost={handleUpdateProductCost}
        orders={orders}
        onImportOrders={handleImportOrders}
        onClearOrders={handleClearOrders}
        onDeleteOrder={handleDeleteOrder}
        onAssignSellerToOrder={handleAssignSellerToOrder}
        onLogOut={handleLogOut}
      />
    );
  }

  // Otherwise, it is a Seller login
  return (
    <DashboardSeller
      currentUser={activeUser}
      orders={orders}
      onLogOut={handleLogOut}
    />
  );
}
