// Shared across every POS template's cart — Grid/Image/Mobile add optional
// fields (selectedAddons, itemNotes, serialNumber) on top of this same shape
// instead of each template inventing its own cart item type.
export interface CartItem {
  productId: number;
  productName: string;
  unitPrice: number;
  includesTax: boolean;
  quantity: number;
  discount: number;
  selectedAddons?: Array<{ groupName: string; optionName: string; priceDelta: number }>;
  itemNotes?: string;
  serialNumber?: string;
}

export interface PosCustomer {
  id: string;
  name: string;
  phone?: string | null;
  outstandingBalance?: number | null;
}

// A tenant-configured payment method (from /api/payment-methods). Cash/card are
// the built-in fallbacks when a company hasn't configured any methods yet.
export interface PaymentMethodOption {
  id: number;
  name: string;
  percentFee: string;
  fixedFee: string;
  showFeeToCustomer: boolean;
  isActive: boolean;
}

// One payment line in a split payment (or the single line of a plain checkout).
export interface CheckoutPaymentLine {
  methodName: string;
  paymentMethodId?: number;
  amount: number;
}

// What the PaymentPanel hands back to the template on checkout. The template
// maps this onto the createSale payload (paymentMethod/amountPaid/payments).
export interface CheckoutPayload {
  kind: "single" | "split" | "on_account" | "gateway";
  paymentMethod: string;
  paymentMethodId?: number;
  amountPaid: number;
  tendered?: number;
  payments?: CheckoutPaymentLine[];
  // Set when a configured online gateway (Tabby/Tamara/Moyasar) is selected:
  // the sale is created first, then a checkout link is generated and opened.
  gatewayProvider?: string;
}

export interface CompletedSale {
  id: number;
  total: number;
  amountPaid: number;
  outstanding: number;
  paymentMethod: string;
  paymentMethodId?: number | null;
  customerName: string;
  customerPhone?: string | null;
  itemCount: number;
  cartItems: Array<{ productName: string; quantity: number; unitPrice: number; subtotal: number }>;
  createdAt: string;
}

// A cart put on hold (suspend) — persisted to localStorage so a refresh keeps it.
export interface HeldCart {
  id: string;
  label: string;
  items: CartItem[];
  discount: number;
  createdAt: string;
}
