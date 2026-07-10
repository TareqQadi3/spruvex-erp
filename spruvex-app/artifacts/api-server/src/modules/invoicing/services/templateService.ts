import {
  INVOICE_TEMPLATE_KINDS,
  INVOICE_TEMPLATE_PRINT_TYPES,
  type InvoiceTemplate,
  type InvoiceTemplateKind,
  type InvoiceTemplatePrintType,
} from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import { withTransaction } from "../../../core/database/transaction";
import { invoiceTemplateRepository } from "../repositories/invoiceTemplateRepository";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { DEFAULT_TEMPLATE_CONFIG, type TemplateConfig } from "../types/print.types";

export interface CreateTemplateInput {
  name: string;
  documentKind: InvoiceTemplateKind;
  printType: InvoiceTemplatePrintType;
  isDefault?: boolean;
  config?: Partial<TemplateConfig>;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export interface ResolvedTemplate {
  id: string | null;
  name: string;
  documentKind: InvoiceTemplateKind;
  printType: InvoiceTemplatePrintType;
  isDefault: boolean;
  config: TemplateConfig;
}

function isTemplateKind(value: string): value is InvoiceTemplateKind {
  return (INVOICE_TEMPLATE_KINDS as readonly string[]).includes(value);
}

function isPrintType(value: string): value is InvoiceTemplatePrintType {
  return (INVOICE_TEMPLATE_PRINT_TYPES as readonly string[]).includes(value);
}

function mergeConfig(config?: Partial<TemplateConfig>): TemplateConfig {
  return { ...DEFAULT_TEMPLATE_CONFIG, ...(config ?? {}) };
}

export async function listTemplates(companyId: string): Promise<InvoiceTemplate[]> {
  return invoiceTemplateRepository.list(companyId);
}

export async function getTemplate(companyId: string, id: string): Promise<InvoiceTemplate> {
  const template = await invoiceTemplateRepository.findById(companyId, id);
  if (!template) throw AppError.notFound("Template not found");
  return template;
}

export async function createTemplate(tenant: TenantContext, input: CreateTemplateInput): Promise<InvoiceTemplate> {
  if (!isTemplateKind(input.documentKind)) {
    throw AppError.validation(`Invalid documentKind: ${input.documentKind}`);
  }
  if (!isPrintType(input.printType)) {
    throw AppError.validation(`Invalid printType: ${input.printType}`);
  }

  const config = mergeConfig(input.config);

  if (input.isDefault) {
    return withTransaction(async (tx) => {
      await invoiceTemplateRepository.clearDefaults(tenant.companyId, input.documentKind, input.printType, tx);
      return invoiceTemplateRepository.create(
        {
          companyId: tenant.companyId,
          name: input.name,
          documentKind: input.documentKind,
          printType: input.printType,
          isDefault: true,
          config,
        },
        tx,
      );
    });
  }

  return invoiceTemplateRepository.create({
    companyId: tenant.companyId,
    name: input.name,
    documentKind: input.documentKind,
    printType: input.printType,
    isDefault: false,
    config,
  });
}

export async function updateTemplate(
  tenant: TenantContext,
  id: string,
  input: UpdateTemplateInput,
): Promise<InvoiceTemplate> {
  const existing = await getTemplate(tenant.companyId, id);

  if (input.documentKind !== undefined && !isTemplateKind(input.documentKind)) {
    throw AppError.validation(`Invalid documentKind: ${input.documentKind}`);
  }
  if (input.printType !== undefined && !isPrintType(input.printType)) {
    throw AppError.validation(`Invalid printType: ${input.printType}`);
  }

  const documentKind = (input.documentKind ?? existing.documentKind) as InvoiceTemplateKind;
  const printType = (input.printType ?? existing.printType) as InvoiceTemplatePrintType;

  const fields: Record<string, unknown> = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.documentKind !== undefined) fields.documentKind = input.documentKind;
  if (input.printType !== undefined) fields.printType = input.printType;
  if (input.config !== undefined) {
    fields.config = { ...(existing.config as Partial<TemplateConfig>), ...input.config };
  }

  if (input.isDefault) {
    const updated = await withTransaction(async (tx) => {
      await invoiceTemplateRepository.clearDefaults(tenant.companyId, documentKind, printType, tx);
      return invoiceTemplateRepository.update(tenant.companyId, id, { ...fields, isDefault: true }, tx);
    });
    if (!updated) throw AppError.notFound("Template not found");
    return updated;
  }

  if (input.isDefault === false) {
    fields.isDefault = false;
  }

  const updated = await invoiceTemplateRepository.update(tenant.companyId, id, fields);
  if (!updated) throw AppError.notFound("Template not found");
  return updated;
}

export async function deleteTemplate(tenant: TenantContext, id: string): Promise<void> {
  const deleted = await invoiceTemplateRepository.delete(tenant.companyId, id);
  if (!deleted) throw AppError.notFound("Template not found");
}

// Resolves the template to render a document with: explicit templateId wins
// (validated to belong to this company and match documentKind/printType),
// else the company's configured default, else a hardcoded built-in fallback
// so printing never hard-fails just because no template was ever configured.
export async function resolveTemplate(
  companyId: string,
  documentKind: InvoiceTemplateKind,
  printType: InvoiceTemplatePrintType,
  templateId?: string,
): Promise<ResolvedTemplate> {
  if (templateId) {
    const template = await invoiceTemplateRepository.findById(companyId, templateId);
    if (!template || template.documentKind !== documentKind || template.printType !== printType) {
      throw AppError.validation("Template not found or does not match the requested document type");
    }
    return {
      id: template.id,
      name: template.name,
      documentKind,
      printType,
      isDefault: template.isDefault,
      config: mergeConfig(template.config as Partial<TemplateConfig>),
    };
  }

  const defaultTemplate = await invoiceTemplateRepository.findDefault(companyId, documentKind, printType);
  if (defaultTemplate) {
    return {
      id: defaultTemplate.id,
      name: defaultTemplate.name,
      documentKind,
      printType,
      isDefault: true,
      config: mergeConfig(defaultTemplate.config as Partial<TemplateConfig>),
    };
  }

  return {
    id: null,
    name: "Default",
    documentKind,
    printType,
    isDefault: false,
    config: DEFAULT_TEMPLATE_CONFIG,
  };
}
