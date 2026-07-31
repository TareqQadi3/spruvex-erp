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
}

export interface CompletedSale {
  id: number;
  total: number;
  paymentMethod: "cash" | "card";
  customerName: string;
  customerPhone?: string | null;
  itemCount: number;
  cartItems: Array<{ productName: string; quantity: number; unitPrice: number; subtotal: number }>;
  createdAt: string;
}
