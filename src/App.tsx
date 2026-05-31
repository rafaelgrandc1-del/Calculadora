import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, ProductCost, ConcludedOrder } from './types';
import { LoginScreen } from './components/LoginScreen';
import { DashboardAdmin } from './components/DashboardAdmin';
import { DashboardSeller } from './components/DashboardSeller';
import { getDefault3DMemoriesCosts, getDefaultSellers } from './utils/shopeeParser';
import { Sparkles } from 'lucide-react';
import {
  fetchUsersFromFirestore,
  saveUserToFirestore,
  deleteUserFromFirestore,
  fetchProductCostsFromFirestore,
  saveProductCostToFirestore,
  deleteProductCostFromFirestore,
  fetchOrdersFromFirestore,
  saveOrderToFirestore,
  saveOrdersBulkToFirestore,
  deleteOrderFromFirestore,
  clearAllOrdersFromFirestore,
  testFirestoreConnection
} from './firebaseService';

export default function App() {
  // --- Persistent Local Database State Engine ---

  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);
  const [sellers, setSellers] = useState<UserAccount[]>([]);
  const [productCosts, setProductCosts] = useState<ProductCost[]>([]);
  const [orders, setOrders] = useState<ConcludedOrder[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Initialize Database from Firestore with fallbacks to LocalStorage & defaults
  useEffect(() => {
    async function initDatabase() {
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

        // Test Connection
        await testFirestoreConnection();

        // 2. Load custom sellers from Firestore
        let dbSellers = await fetchUsersFromFirestore();
        
        // Ensure existence of the helper producer account rafaelgrandc1@gmail.com as ADMIN
        const producerEmail = 'rafaelgrandc1@gmail.com';
        const hasProducer = dbSellers.some(u => u.email.toLowerCase().trim() === producerEmail);
        
        if (!hasProducer) {
          const producerUser: UserAccount = {
            id: 'admin_rafael',
            email: producerEmail,
            name: 'Rafael (Produtor)',
            role: UserRole.ADMIN,
            commissionRate: 0,
            createdAt: new Date().toISOString(),
            password: 'rafael123' // Default secure password for Rafael
          };
          await saveUserToFirestore(producerUser);
          dbSellers.push(producerUser);
        }

        setSellers(dbSellers);
        localStorage.setItem('3d_mem_sellers_db', JSON.stringify(dbSellers));

        // 3. Load product production costs from Firestore
        const dbCosts = await fetchProductCostsFromFirestore();
        if (dbCosts.length > 0) {
          setProductCosts(dbCosts);
        } else {
          const localCostsStr = localStorage.getItem('3d_mem_costs_db');
          let fallbackCosts = getDefault3DMemoriesCosts();
          if (localCostsStr) {
            try {
              const parsed = JSON.parse(localCostsStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                fallbackCosts = parsed;
              }
            } catch (_) {}
          }
          setProductCosts(fallbackCosts);
          localStorage.setItem('3d_mem_costs_db', JSON.stringify(fallbackCosts));
          // Seed to Firestore asynchronously
          for (const c of fallbackCosts) {
            await saveProductCostToFirestore(c);
          }
        }

        // 4. Load parsed Shopee orders from Firestore
        const dbOrders = await fetchOrdersFromFirestore();
        if (dbOrders.length > 0) {
          setOrders(dbOrders);
        } else {
          const localOrdersStr = localStorage.getItem('3d_mem_orders_db');
          if (localOrdersStr) {
            try {
              const parsed = JSON.parse(localOrdersStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setOrders(parsed);
                // Seed existing orders to firestore
                await saveOrdersBulkToFirestore(parsed);
              }
            } catch (_) {}
          }
        }

      } catch (err) {
        console.error('Falha ao sincronizar com banco Firestore:', err);
      } finally {
        setDbLoaded(true);
      }
    }

    initDatabase();
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
  const handleAddSeller = (name: string, email: string, commRate: number, password?: string): UserAccount => {
    const newSeller: UserAccount = {
      id: `sell_${Date.now()}`,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: UserRole.SELLER,
      commissionRate: commRate,
      createdAt: new Date().toISOString(),
      password: password || '123456' // default if none provided
    };

    const updated = [...sellers, newSeller];
    setSellers(updated);
    localStorage.setItem('3d_mem_sellers_db', JSON.stringify(updated));
    // Synchronize to Firestore
    saveUserToFirestore(newSeller);
    return newSeller;
  };

  const handleDeleteSeller = (id: string) => {
    const updated = sellers.filter(s => s.id !== id);
    setSellers(updated);
    localStorage.setItem('3d_mem_sellers_db', JSON.stringify(updated));
    // Synchronize to Firestore
    deleteUserFromFirestore(id);

    // Cleanup: If orders belonged to this deleted seller, make them unassigned (organic)
    const updatedOrders = orders.map(o => {
      if (o.sellerId === id) {
        const updatedOrd = {
          ...o,
          sellerId: 'unassigned',
          sellerName: 'Orgânico / Sem Vendedor',
          sellerCommissionAmount: 0 // Revert commission to 0 for organic sales
        };
        // Save back individually to Firestore
        saveOrderToFirestore(updatedOrd);
        return updatedOrd;
      }
      return o;
    });
    setOrders(updatedOrders);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(updatedOrders));
  };

  const handleUpdateSellerCommission = (id: string, rate: number) => {
    const updated = sellers.map(s => {
      if (s.id === id) {
        const updatedS = { ...s, commissionRate: rate };
        // Sync user update
        saveUserToFirestore(updatedS);
        return updatedS;
      }
      return s;
    });
    setSellers(updated);
    localStorage.setItem('3d_mem_sellers_db', JSON.stringify(updated));

    // Re-calculate commissions for already loaded orders belonging to this seller
    const updatedOrders = orders.map(o => {
      if (o.sellerId === id) {
        const commAmount = o.revenue * (rate / 100);
        const netProfit = o.revenue - o.shopeeFee - o.calculatedCost - commAmount;
        const updatedOrd = {
          ...o,
          sellerCommissionRate: rate,
          sellerCommissionAmount: commAmount,
          netProfit,
          profitMargin: o.revenue > 0 ? (netProfit / o.revenue) * 100 : 0
        };
        saveOrderToFirestore(updatedOrd);
        return updatedOrd;
      }
      return o;
    });
    setOrders(updatedOrders);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(updatedOrders));
  };

  // Handle custom catalog products costs database
  const handleAddProductCost = (
    pattern: string, 
    cost: number, 
    shopeeCommissionRate?: number, 
    customSellerCommission?: number
  ) => {
    const newCost: ProductCost = {
      id: `cost_${Date.now()}`,
      nameOrSku: pattern.trim(),
      productionCost: cost,
      shopeeCommissionRate,
      customSellerCommission
    };
    const updated = [...productCosts, newCost];
    setProductCosts(updated);
    localStorage.setItem('3d_mem_costs_db', JSON.stringify(updated));
    // Synchronize to Firestore
    saveProductCostToFirestore(newCost);
  };

  const handleDeleteProductCost = (id: string) => {
    const updated = productCosts.filter(c => c.id !== id);
    setSellers(prev => [...prev]); // trigger side effect to ensure update
    setProductCosts(updated);
    localStorage.setItem('3d_mem_costs_db', JSON.stringify(updated));
    // Synchronize to Firestore
    deleteProductCostFromFirestore(id);
  };

  const handleUpdateProductCost = (
    id: string, 
    cost: number, 
    shopeeCommissionRate?: number, 
    customSellerCommission?: number
  ) => {
    const updated = productCosts.map(c => {
      if (c.id === id) {
        const updatedC = { ...c, productionCost: cost, shopeeCommissionRate, customSellerCommission };
        // Sync to Firestore
        saveProductCostToFirestore(updatedC);
        return updatedC;
      }
      return c;
    });
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
    
    // Synchronize bulk import to Firestore
    saveOrdersBulkToFirestore(newOrders);
  };

  const handleClearOrders = () => {
    const currentOrders = [...orders];
    setOrders([]);
    localStorage.removeItem('3d_mem_orders_db');
    // Synchronize delete orders from Firestore
    clearAllOrdersFromFirestore(currentOrders);
  };

  const handleDeleteOrder = (orderId: string) => {
    const updated = orders.filter(o => o.orderId !== orderId);
    setOrders(updated);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(updated));
    // Synchronize delete from Firestore
    deleteOrderFromFirestore(orderId);
  };

  // Save or update a product's unit cost, and instantly recalculate all matching transactions
  const handleSaveOrUpdateCostAndRecalculate = (skuOrName: string, newUnitCost: number) => {
    const cleanPattern = skuOrName.trim();
    if (!cleanPattern) return;

    let updatedCosts: ProductCost[] = [];
    const existingIndex = productCosts.findIndex(
      (c) => c.nameOrSku.toLowerCase().trim() === cleanPattern.toLowerCase().trim()
    );

    let targetCostObj: ProductCost;
    if (existingIndex !== -1) {
      // Update existing
      targetCostObj = { ...productCosts[existingIndex], productionCost: newUnitCost };
      updatedCosts = productCosts.map((c, idx) => 
        idx === existingIndex ? targetCostObj : c
      );
    } else {
      // Create new
      targetCostObj = {
        id: `cost_${Date.now()}`,
        nameOrSku: cleanPattern,
        productionCost: newUnitCost
      };
      updatedCosts = [...productCosts, targetCostObj];
    }

    setProductCosts(updatedCosts);
    localStorage.setItem('3d_mem_costs_db', JSON.stringify(updatedCosts));
    // Save/Update in Firestore
    saveProductCostToFirestore(targetCostObj);

    // Instantly map and update existing orders
    const updatedOrders = orders.map((order) => {
      const matchBySku = order.sku && order.sku.toLowerCase().trim() === cleanPattern.toLowerCase().trim();
      const matchByName = order.productName && order.productName.toLowerCase().trim() === cleanPattern.toLowerCase().trim();

      if (matchBySku || matchByName) {
        const foundCost = newUnitCost * order.quantity;
        const shopeeFee = order.revenue * (order.shopeeCommissionRate / 100);
        const netAvailableMargin = order.revenue - shopeeFee - foundCost;
        
        let sellerCommissionAmount = 0;
        if (order.sellerId !== 'unassigned') {
          sellerCommissionAmount = Math.max(0, netAvailableMargin) * (order.sellerCommissionRate / 100);
        }
        
        const netProfit = netAvailableMargin - sellerCommissionAmount;
        const profitMargin = order.revenue > 0 ? (netProfit / order.revenue) * 100 : 0;

        const updatedOrder = {
          ...order,
          calculatedCost: foundCost,
          sellerCommissionAmount,
          netProfit,
          profitMargin
        };
        // Update order in Firestore
        saveOrderToFirestore(updatedOrder);
        return updatedOrder;
      }
      return order;
    });

    setOrders(updatedOrders);
    localStorage.setItem('3d_mem_orders_db', JSON.stringify(updatedOrders));
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

        const updatedOrder = {
          ...o,
          sellerId: sellerId,
          sellerName: targetSeller ? targetSeller.name : 'Orgânico / Sem Vendedor',
          sellerCommissionRate: sellerRate,
          sellerCommissionAmount: commAmt,
          netProfit: profit,
          profitMargin: o.revenue > 0 ? (profit / o.revenue) * 100 : 0
        };
        // Save order change to firestore
        saveOrderToFirestore(updatedOrder);
        return updatedOrder;
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
        onSaveOrUpdateCostAndRecalculate={handleSaveOrUpdateCostAndRecalculate}
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
      productCosts={productCosts}
      onImportOrders={handleImportOrders}
      onDeleteOrder={handleDeleteOrder}
      onSaveOrUpdateCostAndRecalculate={handleSaveOrUpdateCostAndRecalculate}
      onLogOut={handleLogOut}
    />
  );
}
