import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/** Money as a decimal string with up to 2 fraction digits — floats are forbidden. */
export const PRICE_RULE = /^\d{1,10}(\.\d{1,2})?$/;
export const PRICE_MESSAGE = "Price must be a decimal string with up to 2 fraction digits";

export class CreateProductDto {
  /** Arabic name (primary) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionEn?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string;

  /** Internal code / SKU — unique per restaurant */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsUUID()
  categoryId!: string;

  @IsString()
  @Matches(PRICE_RULE, { message: PRICE_MESSAGE })
  basePrice!: string;

  /** VAT rate percent override; omit for the tenant default (15%). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}(\.\d{1,2})?$/, { message: "Tax rate must be a decimal percent" })
  taxRate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class BranchSettingDto {
  /** null/omitted = base price applies */
  @IsOptional()
  @IsString()
  @Matches(PRICE_RULE, { message: PRICE_MESSAGE })
  priceOverride?: string | null;

  @IsBoolean()
  isAvailable!: boolean;
}

export class ProductModifierGroupLinkDto {
  @IsUUID()
  modifierGroupId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SetProductModifierGroupsDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductModifierGroupLinkDto)
  groups!: ProductModifierGroupLinkDto[];
}
