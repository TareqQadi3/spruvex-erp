import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** ISO date (yyyy-mm-dd) or datetime. Defaults to 30 days ago. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** ISO date (yyyy-mm-dd) or datetime. Defaults to now. */
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class DailySalesQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** ISO date (yyyy-mm-dd). Defaults to today (UTC). */
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class BestSellersQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
