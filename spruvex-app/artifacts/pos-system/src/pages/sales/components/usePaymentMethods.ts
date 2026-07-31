import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaymentMethodOption } from "./types";

export function usePaymentMethods() {
  return useQuery<PaymentMethodOption[]>({
    queryKey: ["payment-methods"],
    queryFn: () => api("/payment-methods"),
  });
}
