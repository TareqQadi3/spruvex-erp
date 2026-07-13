import { Injectable, NotFoundException } from "@nestjs/common";

import { calculateRecipeCostUnits } from "../../shared/common/food-cost";
import { costUnitsToSar, sarToHalalas } from "../../shared/common/money";
import { PrismaService } from "../../shared/prisma/prisma.service";

export interface ProductCostBreakdown {
  productId: string;
  productName: string;
  sellingPrice: string;
  cost: string;
  grossMargin: string;
  grossMarginPercent: string;
  hasRecipe: boolean;
}

/**
 * Live product cost & gross-margin calculation from the current recipe and
 * ingredient prices — used by the recipe editor UI and the Reports module.
 * Distinct from OrderItem.unitCost/lineCost, which are frozen at order time.
 */
@Injectable()
export class FoodCostService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateProductCost(productId: string): Promise<ProductCostBreakdown> {
    const product = await this.prisma.scoped.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: { recipeItems: { include: { ingredient: true, unit: true } } },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const hasRecipe = product.recipeItems.length > 0;
    const costUnits = hasRecipe
      ? calculateRecipeCostUnits(
          product.recipeItems.map((recipeItem) => ({
            quantity: recipeItem.quantity.toString(),
            unitToBaseFactor: recipeItem.unit.toBaseFactor.toString(),
            ingredientAverageCost: recipeItem.ingredient.averageCost.toString(),
          })),
        )
      : 0;
    const costSar = costUnitsToSar(costUnits);

    const priceHalalas = sarToHalalas(product.basePrice.toString());
    const costHalalasRounded = Math.round(costUnits / 100); // cost units -> halalas
    const marginHalalas = priceHalalas - costHalalasRounded;
    const marginPercent =
      priceHalalas > 0 ? ((marginHalalas / priceHalalas) * 100).toFixed(2) : "0.00";

    return {
      productId: product.id,
      productName: product.name,
      sellingPrice: product.basePrice.toString(),
      cost: costSar,
      grossMargin: (marginHalalas / 100).toFixed(2),
      grossMarginPercent: marginPercent,
      hasRecipe,
    };
  }
}
