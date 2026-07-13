import { IsBoolean, IsOptional } from "class-validator";

/**
 * Per-branch self-ordering settings (stored in branches.ordering_settings
 * JSONB, plan §9.3). Controls whether the QR table-ordering flow accepts
 * new orders for this branch — the external pickup link is unaffected.
 */
export class UpdateOrderingSettingsDto {
  @IsOptional()
  @IsBoolean()
  qrOrderingEnabled?: boolean;

  /** Self-ordered items require cashier confirmation before reaching the kitchen. */
  @IsOptional()
  @IsBoolean()
  requireCashierConfirmation?: boolean;
}
