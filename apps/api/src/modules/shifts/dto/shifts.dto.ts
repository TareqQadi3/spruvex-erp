import { IsOptional, IsString, IsUUID, Matches } from "class-validator";

const AMOUNT_RULE = /^\d{1,10}(\.\d{1,2})?$/;
const AMOUNT_MESSAGE = "Amount must be a decimal string with up to 2 fraction digits";

export class OpenShiftDto {
  @IsUUID()
  branchId!: string;

  /** Opening cash float (SAR). */
  @IsString()
  @Matches(AMOUNT_RULE, { message: AMOUNT_MESSAGE })
  openingCash!: string;
}

export class CloseShiftDto {
  /** Counted cash at close (SAR). Optional in the foundation phase. */
  @IsOptional()
  @IsString()
  @Matches(AMOUNT_RULE, { message: AMOUNT_MESSAGE })
  actualCash?: string;
}
