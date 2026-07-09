import { Router } from "express";
import { db } from "@workspace/db";
import type { AuthedRequest } from "../../../lib/auth-middleware";
import * as customerService from "../services/customerService";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const customers = await customerService.listCustomers(db, req.user!.companyId, req.query.search as string | undefined);
  res.json(customers);
});

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const customer = await customerService.createCustomer(db, req.user!.companyId, req.body);
    res.status(201).json(customer);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create customer" });
  }
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const customer = await customerService.getCustomerWithHistory(db, req.user!.companyId, req.params.id as string);
  if (!customer) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(customer);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const customer = await customerService.updateCustomer(db, req.user!.companyId, req.params.id as string, req.body);
  if (!customer) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(customer);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  await customerService.deleteCustomer(db, req.user!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;
