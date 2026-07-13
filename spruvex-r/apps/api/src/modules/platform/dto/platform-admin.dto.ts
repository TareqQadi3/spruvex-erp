import { IsIn, IsNotEmpty, IsString } from "class-validator";

const TENANT_STATUSES = ["active", "suspended"] as const;
const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "suspended", "cancelled"] as const;

export class UpdateTenantStatusDto {
  @IsIn(TENANT_STATUSES)
  status!: (typeof TENANT_STATUSES)[number];
}

export class UpdateSubscriptionDto {
  @IsIn(SUBSCRIPTION_STATUSES)
  status!: (typeof SUBSCRIPTION_STATUSES)[number];
}

export class ChangeTenantPlanDto {
  @IsString()
  @IsNotEmpty()
  planKey!: string;
}
