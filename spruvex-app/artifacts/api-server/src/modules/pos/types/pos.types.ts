export interface CreateSaleItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
}

export interface CreateSalePaymentInput {
  paymentMethodId: string;
  amount: number;
}

export interface CreateSaleInput {
  customerId?: string;
  cashSessionId?: string;
  items: CreateSaleItemInput[];
  payments: CreateSalePaymentInput[];
  discount?: number;
  notes?: string;
}

export interface SaleItemResult {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  subtotal: string;
}

export interface SalePaymentResult {
  id: string;
  paymentMethodId: string | null;
  methodName: string;
  amount: string;
}

export interface SaleResult {
  id: string;
  companyId: string;
  customerId: string | null;
  cashSessionId: string | null;
  subtotal: string;
  discount: string;
  total: string;
  amountPaid: string;
  paymentFee: string;
  status: string;
  items: SaleItemResult[];
  payments: SalePaymentResult[];
  createdAt: Date;
}
