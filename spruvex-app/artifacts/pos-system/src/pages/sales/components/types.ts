export interface Sale {
  id: string;
  customerId: string | null;
  customerName: string | null;
  total: string;
  amountPaid: string;
  outstanding: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  returnedQuantity: number;
  subtotal: string;
}

export interface SaleDetails extends Sale {
  items: SaleItem[];
}

export interface InstallmentPlan {
  id: string;
  months: number;
  interestPercent: string;
  isActive: boolean;
}

export interface InstallmentPayment {
  id: string;
  installmentSaleId: string;
  amount: string;
  dueDate: string;
  paidDate: string | null;
  isPaid: boolean;
}

export interface InstallmentSale {
  id: string;
  saleId: string | null;
  customerId: string | null;
  principal: string;
  interestPercent: string;
  totalAmount: string;
  months: number;
  monthlyAmount: string;
  downPayment: string;
  status: string;
  startDate: string;
}

export interface PaymentMethodOption {
  id: number;
  name: string;
  percentFee: string;
  fixedFee: string;
  isActive: boolean;
}
