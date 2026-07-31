import { useState, useCallback } from "react";
import { useGetCustomers } from "@workspace/api-client-react";
import type { PosCustomer } from "./types";

export function usePosCustomerSelection() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");

  const { data: customers } = useGetCustomers();
  const customerList = (customers ?? []) as unknown as PosCustomer[];
  const selectedCustomer = customerList.find(c => c.id === selectedCustomerId) ?? null;

  const selectCustomer = useCallback((id: string | null, name: string) => {
    setSelectedCustomerId(id);
    setSelectedCustomerName(name);
  }, []);

  const customerCreated = useCallback((c: { id: string; name: string }) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomerName(c.name);
  }, []);

  const resetCustomer = useCallback(() => {
    setSelectedCustomerId(null);
    setSelectedCustomerName("");
  }, []);

  return {
    customerList,
    selectedCustomer,
    selectedCustomerId,
    selectedCustomerName,
    selectCustomer,
    customerCreated,
    resetCustomer,
  };
}
