import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch,
  query,
  getDocFromServer
} from 'firebase/firestore';
import { db } from './firebase';
import { UserAccount, ProductCost, ConcludedOrder } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check Firestore availability
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_test', 'test'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('client is offline')) {
      console.warn("Please check your Firebase configuration or internet connection.");
    }
    return false;
  }
}

// -----------------------------------------------------------------
// Sellers/Users Collection
// -----------------------------------------------------------------
const PATH_USERS = 'users';

export async function fetchUsersFromFirestore(): Promise<UserAccount[]> {
  try {
    const q = collection(db, PATH_USERS);
    const snap = await getDocs(q);
    const users: UserAccount[] = [];
    snap.forEach((doc) => {
      users.push(doc.data() as UserAccount);
    });
    return users;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PATH_USERS);
    return [];
  }
}

export async function saveUserToFirestore(user: UserAccount): Promise<void> {
  const path = `${PATH_USERS}/${user.id}`;
  try {
    await setDoc(doc(db, PATH_USERS, user.id), user);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  const path = `${PATH_USERS}/${userId}`;
  try {
    await deleteDoc(doc(db, PATH_USERS, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -----------------------------------------------------------------
// Product Costs Collection
// -----------------------------------------------------------------
const PATH_PRODUCT_COSTS = 'productCosts';

export async function fetchProductCostsFromFirestore(): Promise<ProductCost[]> {
  try {
    const q = collection(db, PATH_PRODUCT_COSTS);
    const snap = await getDocs(q);
    const costs: ProductCost[] = [];
    snap.forEach((doc) => {
      costs.push(doc.data() as ProductCost);
    });
    return costs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PATH_PRODUCT_COSTS);
    return [];
  }
}

export async function saveProductCostToFirestore(cost: ProductCost): Promise<void> {
  const path = `${PATH_PRODUCT_COSTS}/${cost.id}`;
  try {
    await setDoc(doc(db, PATH_PRODUCT_COSTS, cost.id), cost);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProductCostFromFirestore(costId: string): Promise<void> {
  const path = `${PATH_PRODUCT_COSTS}/${costId}`;
  try {
    await deleteDoc(doc(db, PATH_PRODUCT_COSTS, costId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -----------------------------------------------------------------
// Concluded Orders Collection
// -----------------------------------------------------------------
const PATH_ORDERS = 'orders';

export async function fetchOrdersFromFirestore(): Promise<ConcludedOrder[]> {
  try {
    const q = collection(db, PATH_ORDERS);
    const snap = await getDocs(q);
    const orders: ConcludedOrder[] = [];
    snap.forEach((doc) => {
      orders.push(doc.data() as ConcludedOrder);
    });
    return orders;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PATH_ORDERS);
    return [];
  }
}

export async function saveOrderToFirestore(order: ConcludedOrder): Promise<void> {
  const path = `${PATH_ORDERS}/${order.orderId}`;
  try {
    await setDoc(doc(db, PATH_ORDERS, order.orderId), order);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveOrdersBulkToFirestore(orders: ConcludedOrder[]): Promise<void> {
  try {
    // If there are many orders, write them in batches of 500 (Firestore limits batch to 500)
    const BATCH_LIMIT = 400; 
    for (let i = 0; i < orders.length; i += BATCH_LIMIT) {
      const chunk = orders.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((order) => {
        const docRef = doc(db, PATH_ORDERS, order.orderId);
        batch.set(docRef, order);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${PATH_ORDERS}/bulk`);
  }
}

export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const path = `${PATH_ORDERS}/${orderId}`;
  try {
    await deleteDoc(doc(db, PATH_ORDERS, orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllOrdersFromFirestore(orders: ConcludedOrder[]): Promise<void> {
  try {
    const BATCH_LIMIT = 400;
    for (let i = 0; i < orders.length; i += BATCH_LIMIT) {
      const chunk = orders.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((order) => {
        const docRef = doc(db, PATH_ORDERS, order.orderId);
        batch.delete(docRef);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PATH_ORDERS}/all`);
  }
}
