import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

const QUANTITY_MESSAGE = "Quantity must be a positive decimal string with up to 3 fraction digits";
const POSITIVE_QUANTITY_RULE = /^\d{1,10}(\.\d{1,3})?$/;

export class RecipeItemLineDto {
  @IsUUID()
  ingredientId!: string;

  @IsUUID()
  unitId!: string;

  @IsString()
  @Matches(POSITIVE_QUANTITY_RULE, { message: QUANTITY_MESSAGE })
  quantity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Replaces the entire recipe for a product in one call — simplest, race-free API for an editor UI. */
export class SetRecipeDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RecipeItemLineDto)
  items!: RecipeItemLineDto[];
}
