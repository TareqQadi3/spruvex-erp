CREATE INDEX "customers_company_idx" ON "customers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sale_items_company_sale_idx" ON "sale_items" USING btree ("company_id","sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_company_product_idx" ON "sale_items" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "sale_payments_company_sale_idx" ON "sale_payments" USING btree ("company_id","sale_id");--> statement-breakpoint
CREATE INDEX "sale_return_items_company_return_idx" ON "sale_return_items" USING btree ("company_id","sale_return_id");--> statement-breakpoint
CREATE INDEX "sale_returns_company_sale_idx" ON "sale_returns" USING btree ("company_id","sale_id");--> statement-breakpoint
CREATE INDEX "sales_company_created_idx" ON "sales" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_company_customer_idx" ON "sales" USING btree ("company_id","customer_id");--> statement-breakpoint
CREATE INDEX "expenses_company_date_idx" ON "expenses" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "purchase_returns_company_purchase_idx" ON "purchase_returns" USING btree ("company_id","purchase_id");--> statement-breakpoint
CREATE INDEX "purchases_company_created_idx" ON "purchases" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "purchases_company_supplier_idx" ON "purchases" USING btree ("company_id","supplier_id");--> statement-breakpoint
CREATE INDEX "stock_company_idx" ON "stock" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_movements_company_product_idx" ON "stock_movements" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_company_created_idx" ON "stock_movements" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_company_status_idx" ON "invoices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "invoices_company_sale_idx" ON "invoices" USING btree ("company_id","sale_id");