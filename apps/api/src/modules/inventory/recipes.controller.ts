import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from "@nestjs/common";

import { RequirePermission } from "../../shared/rbac/require-permission.decorator";
import { SetRecipeDto } from "./dto/recipe-item.dto";
import { FoodCostService } from "./food-cost.service";
import { RecipesService } from "./recipes.service";

@Controller("products/:productId/recipe")
export class RecipesController {
  constructor(
    private readonly recipes: RecipesService,
    private readonly foodCost: FoodCostService,
  ) {}

  @RequirePermission("menu.view")
  @Get()
  get(@Param("productId", ParseUUIDPipe) productId: string) {
    return this.recipes.get(productId);
  }

  @RequirePermission("recipes.manage")
  @Put()
  set(@Param("productId", ParseUUIDPipe) productId: string, @Body() dto: SetRecipeDto) {
    return this.recipes.set(productId, dto);
  }

  @RequirePermission("menu.view")
  @Get("cost")
  cost(@Param("productId", ParseUUIDPipe) productId: string) {
    return this.foodCost.calculateProductCost(productId);
  }
}
