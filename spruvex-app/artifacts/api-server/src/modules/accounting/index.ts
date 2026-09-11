import { Router } from "express";
import accountsRouter from "./routes/accounts";
import journalEntriesRouter from "./routes/journalEntries";
import trialBalanceRouter from "./routes/trialBalance";
import vatReturnsRouter from "./routes/vatReturns";

const router = Router();
router.use("/accounts", accountsRouter);
router.use("/journal-entries", journalEntriesRouter);
router.use("/trial-balance", trialBalanceRouter);
router.use("/vat-returns", vatReturnsRouter);

export default router;

export { postSaleEntry, postPurchaseEntry, postExpenseEntry, postVoucherEntry, postSaleReturnEntry, postPurchaseReturnEntry, postSalePaymentEntry } from "./services/postingService";
export { ensureSeeded } from "./services/chartOfAccountsService";
