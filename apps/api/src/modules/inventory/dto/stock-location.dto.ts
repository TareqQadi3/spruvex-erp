import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateStockLocationDto {
  @IsUUID()
  branchId!: string;

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
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateStockLocationDto extends PartialType(CreateStockLocationDto) {
  declare branchId: never;
}
