import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

import { COST_RULE, QUANTITY_RULE } from "./ingredient.dto";

const QUANTITY_MESSAGE = "Quantity must be a positive decimal string with up to 3 fraction digits";
const COST_MESSAGE = "Unit cost must be a decimal string with up to 4 fraction digits";

/** Positive-only quantity (purchases/waste always move a positive amount; direction is implied by the endpoint). */
const POSITIVE_QUANTITY_RULE = /^\d{1,10}(\.\d{1,3})?$/;

export class RecordPurchaseDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  ingredientId!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsString()
  @Matches(POSITIVE_QUANTITY_RULE, { message: QUANTITY_MESSAGE })
  quantity!: string;

  /** Cost per base unit for this purchase — updates the ingredient's moving average. */
  @IsString()
  @Matches(COST_RULE, { message: COST_MESSAGE })
  unitCost!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RecordWasteDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  ingredientId!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsString()
  @Matches(POSITIVE_QUANTITY_RULE, { message: QUANTITY_MESSAGE })
  quantity!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class RecordAdjustmentDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  ingredientId!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  /** The physically counted quantity (base units) — the service computes the delta. */
  @IsString()
  @Matches(QUANTITY_RULE, { message: "Counted quantity must be a decimal string with up to 3 fraction digits" })
  countedQuantity!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
