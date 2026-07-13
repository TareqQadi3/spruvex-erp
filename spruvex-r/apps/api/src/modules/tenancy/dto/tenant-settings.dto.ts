import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

/** Establishment (ZATCA) data — editable from dashboard settings. */
export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  /** Registered legal entity name printed on invoices. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{15}$/, { message: "VAT number must be 15 digits" })
  vatNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  crNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
