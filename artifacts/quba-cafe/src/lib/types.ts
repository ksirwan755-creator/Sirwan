export type LocaleCode = 'ku' | 'ar';
export type PaymentMethod = 'cash' | 'card' | 'other';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'closed';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'cancelled';

export interface CafeCategory {
  id: string;
  nameKu: string;
  nameAr: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CafeProduct {
  id: string;
  nameKu: string;
  nameAr: string;
  categoryId: string | null;
  priceIqd: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CafeTable {
  id: string;
  label: string;
  seats: number;
  active: boolean;
  status?: TableStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  productId: string;
  nameKu: string;
  nameAr: string;
  quantity: number;
  unitPriceIqd: number;
}

export interface OrderPayment {
  amountIqd: number;
  method: PaymentMethod;
  createdAt: string;
}

export interface CafeOrder {
  id: string;
  tableId: string | null;
  customerId: string | null;
  items: OrderItem[];
  notes: string;
  status: OrderStatus;
  totalIqd: number;
  payments: OrderPayment[];
  createdAt: string;
  paidAt: string | null;
}

export interface CafeExpense {
  id: string;
  titleKu: string;
  titleAr: string;
  category: string;
  amountIqd: number;
  date: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CafeCustomer {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CafeSettings {
  restaurantNameKu: string;
  restaurantNameAr: string;
  defaultLocale: LocaleCode;
}

export interface CafeDataSnapshot {
  categories: CafeCategory[];
  products: CafeProduct[];
  tables: CafeTable[];
  orders: CafeOrder[];
  expenses: CafeExpense[];
  customers: CafeCustomer[];
  settings: (CafeSettings & { id: string }) | null;
}

export type RecordCollection =
  | 'categories'
  | 'products'
  | 'tables'
  | 'orders'
  | 'expenses'
  | 'customers';

export interface CreateOrderInput {
  tableId: string | null;
  customerId: string | null;
  items: OrderItem[];
  notes?: string;
  status?: OrderStatus;
}
