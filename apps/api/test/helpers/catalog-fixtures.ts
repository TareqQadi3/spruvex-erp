import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

/**
 * Direct-DB catalog + table fixtures for ordering tests (admin connection).
 */
export async function createOrderingFixtures(
  admin: PrismaClient,
  tenantId: string,
  branchId: string,
) {
  const category = await admin.category.create({
    data: { tenantId, name: "المشويات", nameEn: "Grills" },
  });

  const sizeGroup = await admin.modifierGroup.create({
    data: {
      tenantId,
      name: "الحجم",
      nameEn: "Size",
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
    },
  });
  const large = await admin.modifier.create({
    data: { tenantId, modifierGroupId: sizeGroup.id, name: "كبير", nameEn: "Large", priceAdjustment: "5.00" },
  });
  const regular = await admin.modifier.create({
    data: { tenantId, modifierGroupId: sizeGroup.id, name: "عادي", nameEn: "Regular", priceAdjustment: "0" },
  });

  const withSize = await admin.product.create({
    data: {
      tenantId,
      categoryId: category.id,
      name: "شيش طاووق",
      nameEn: "Shish Tawook",
      sku: "GRL-1",
      basePrice: "30.00",
    },
  });
  await admin.productModifierGroup.create({
    data: { tenantId, productId: withSize.id, modifierGroupId: sizeGroup.id },
  });

  const simple = await admin.product.create({
    data: {
      tenantId,
      categoryId: category.id,
      name: "عصير",
      nameEn: "Juice",
      sku: "DRK-1",
      basePrice: "12.00",
    },
  });

  const floor = await admin.floor.create({
    data: { tenantId, branchId, name: "الصالة", nameEn: "Hall" },
  });
  const table = await admin.table.create({
    data: {
      tenantId,
      branchId,
      floorId: floor.id,
      number: "T1",
      qrToken: randomBytes(12).toString("base64url"),
    },
  });

  return { category, sizeGroup, large, regular, withSize, simple, floor, table };
}
