import { PartialType } from "@nestjs/mapped-types";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

import { UNIT_TYPES } from "@spruvex-r/types";

/** Cost per base unit — up to 4 decimal places (matches Decimal(12,4)). */
export const COST_RULE = /^\d{1,10}(\.\d{1,4})?$/;
const COST_MESSAGE = "Cost must be a decimal string with up to 4 fraction digits";

/** Stock quantities — up to 3 decimal places (matches Decimal(10-14,3)). */
export const QUANTITY_RULE = /^-?\d{1,10}(\.\d{1,3})?$/;
const QUANTITY_MESSAGE = "Quantity must be a decimal string with up to 3 fraction digits";

export class CreateIngredientDto {
  /** Arabic name (primary) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @IsIn(UNIT_TYPES as unknown as string[])
  unitType!: "mass" | "volume" | "count";

  /** Starting moving-average cost per base unit (SAR). Defaults to 0. */
  @IsOptional()
  @IsString()
  @Matches(COST_RULE, { message: COST_MESSAGE })
  averageCost?: string;

  /** Low-stock threshold, in base units. */
  @IsOptional()
  @IsString()
  @Matches(QUANTITY_RULE, { message: QUANTITY_MESSAGE })
  reorderLevel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {
  /** Changing the measurement family would silently corrupt existing stock/recipes. */
  declare unitType: never;
}
