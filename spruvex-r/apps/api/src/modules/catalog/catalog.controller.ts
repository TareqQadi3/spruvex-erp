import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";

import { RequirePermission } from "../../shared/rbac/require-permission.decorator";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import {
  CreateModifierDto,
  CreateModifierGroupDto,
  UpdateModifierDto,
  UpdateModifierGroupDto,
} from "./dto/modifier.dto";
import {
  BranchSettingDto,
  CreateProductDto,
  SetProductModifierGroupsDto,
  UpdateProductDto,
} from "./dto/product.dto";
import { ModifiersService } from "./modifiers.service";
import { ProductsService } from "./products.service";

@Controller("catalog")
export class CatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
    private readonly modifiers: ModifiersService,
  ) {}

  // --- Categories ---

  @RequirePermission("menu.view")
  @Get("categories")
  listCategories() {
    return this.categories.list();
  }

  @RequirePermission("menu.manage")
  @Post("categories")
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @RequirePermission("menu.manage")
  @Patch("categories/:id")
  updateCategory(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @RequirePermission("menu.manage")
  @Delete("categories/:id")
  deleteCategory(@Param("id", ParseUUIDPipe) id: string) {
    return this.categories.softDelete(id);
  }

  // --- Products ---

  @RequirePermission("menu.view")
  @Get("products")
  listProducts(@Query("categoryId") categoryId?: string) {
    return this.products.list(categoryId);
  }

  @RequirePermission("menu.view")
  @Get("products/:id")
  getProduct(@Param("id", ParseUUIDPipe) id: string) {
    return this.products.get(id);
  }

  @RequirePermission("menu.manage")
  @Post("products")
  createProduct(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @RequirePermission("menu.manage")
  @Patch("products/:id")
  updateProduct(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @RequirePermission("menu.manage")
  @Delete("products/:id")
  deleteProduct(@Param("id", ParseUUIDPipe) id: string) {
    return this.products.softDelete(id);
  }

  @RequirePermission("menu.manage")
  @Put("products/:id/modifier-groups")
  setProductModifierGroups(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetProductModifierGroupsDto,
  ) {
    return this.products.setModifierGroups(id, dto);
  }

  @RequirePermission("menu.manage")
  @Put("products/:id/branch-settings/:branchId")
  setBranchSetting(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("branchId", ParseUUIDPipe) branchId: string,
    @Body() dto: BranchSettingDto,
  ) {
    return this.products.setBranchSetting(id, branchId, dto);
  }

  // --- Modifier groups & modifiers ---

  @RequirePermission("menu.view")
  @Get("modifier-groups")
  listModifierGroups() {
    return this.modifiers.listGroups();
  }

  @RequirePermission("menu.manage")
  @Post("modifier-groups")
  createModifierGroup(@Body() dto: CreateModifierGroupDto) {
    return this.modifiers.createGroup(dto);
  }

  @RequirePermission("menu.manage")
  @Patch("modifier-groups/:id")
  updateModifierGroup(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateModifierGroupDto,
  ) {
    return this.modifiers.updateGroup(id, dto);
  }

  @RequirePermission("menu.manage")
  @Delete("modifier-groups/:id")
  deleteModifierGroup(@Param("id", ParseUUIDPipe) id: string) {
    return this.modifiers.deleteGroup(id);
  }

  @RequirePermission("menu.manage")
  @Post("modifier-groups/:id/modifiers")
  createModifier(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateModifierDto) {
    return this.modifiers.createModifier(id, dto);
  }

  @RequirePermission("menu.manage")
  @Patch("modifiers/:id")
  updateModifier(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateModifierDto) {
    return this.modifiers.updateModifier(id, dto);
  }

  @RequirePermission("menu.manage")
  @Delete("modifiers/:id")
  deleteModifier(@Param("id", ParseUUIDPipe) id: string) {
    return this.modifiers.deleteModifier(id);
  }
}
