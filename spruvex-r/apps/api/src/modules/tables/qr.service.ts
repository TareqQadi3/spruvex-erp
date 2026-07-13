import { Injectable, NotFoundException } from "@nestjs/common";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as QRCode from "qrcode";

import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";
import { TablesService } from "./tables.service";

/** SpruVex R brand green for printed sheets. */
const BRAND_GREEN = rgb(0.18, 0.49, 0.2); // #2E7D32

@Injectable()
export class QrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly tables: TablesService,
  ) {}

  private get orderingBaseUrl(): string {
    return (process.env.ORDERING_BASE_URL ?? "http://localhost:5174").replace(/\/+$/, "");
  }

  /**
   * Public QR URL for a table: /menu/{restaurant-slug}/table/{token}.
   * Identifies restaurant + branch + table through the non-guessable token —
   * database IDs are never exposed.
   */
  async qrUrl(tableId: string): Promise<{ url: string; number: string }> {
    const table = await this.tables.get(tableId);
    const tenant = await this.prisma.scoped.tenant.findUnique({
      where: { id: this.tenantContext.tenantIdOrThrow },
      select: { slug: true },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    return {
      url: `${this.orderingBaseUrl}/menu/${tenant.slug}/table/${table.qrToken}`,
      number: table.number,
    };
  }

  /** PNG image of a single table's QR (for download). */
  async qrPng(tableId: string): Promise<{ png: Buffer; number: string }> {
    const { url, number } = await this.qrUrl(tableId);
    const png = await QRCode.toBuffer(url, {
      type: "png",
      width: 600,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1B5E20", light: "#FFFFFF" },
    });
    return { png, number };
  }

  /**
   * A4 print sheet: one QR card per table (2 x 3 grid per page).
   * Labels use Latin text/numerals (standard PDF fonts don't shape Arabic —
   * an embedded Arabic font can be added later without API changes).
   */
  async printSheet(filter: { branchId?: string; floorId?: string }): Promise<Buffer> {
    const tables = await this.tables.list(filter);
    if (tables.length === 0) {
      throw new NotFoundException("No tables to print");
    }
    const tenant = await this.prisma.scoped.tenant.findUnique({
      where: { id: this.tenantContext.tenantIdOrThrow },
      select: { slug: true, nameEn: true, name: true },
    });

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontLight = await pdf.embedFont(StandardFonts.Helvetica);

    const pageWidth = 595.28; // A4 portrait, points
    const pageHeight = 841.89;
    const cols = 2;
    const rows = 3;
    const cellW = pageWidth / cols;
    const cellH = pageHeight / rows;
    const qrSize = 180;

    for (let i = 0; i < tables.length; i++) {
      const pageIndex = Math.floor(i / (cols * rows));
      if (pdf.getPageCount() <= pageIndex) {
        pdf.addPage([pageWidth, pageHeight]);
      }
      const page = pdf.getPage(pageIndex);

      const slot = i % (cols * rows);
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const cx = col * cellW + cellW / 2;
      const cyTop = pageHeight - row * cellH;

      const url = `${this.orderingBaseUrl}/menu/${tenant?.slug}/table/${tables[i].qrToken}`;
      const pngBytes = await QRCode.toBuffer(url, {
        type: "png",
        width: 400,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#1B5E20", light: "#FFFFFF" },
      });
      const png = await pdf.embedPng(pngBytes);

      // Card frame
      const cardW = cellW - 40;
      const cardH = cellH - 40;
      page.drawRectangle({
        x: cx - cardW / 2,
        y: cyTop - cellH + 20,
        width: cardW,
        height: cardH,
        borderColor: BRAND_GREEN,
        borderWidth: 1.5,
      });

      const brand = tenant?.nameEn || tenant?.slug || "SpruVex R";
      page.drawText(brand, {
        x: cx - font.widthOfTextAtSize(brand, 14) / 2,
        y: cyTop - 50,
        size: 14,
        font,
        color: BRAND_GREEN,
      });

      page.drawImage(png, {
        x: cx - qrSize / 2,
        y: cyTop - 60 - qrSize - 8,
        width: qrSize,
        height: qrSize,
      });

      const label = `Table ${tables[i].number}`;
      page.drawText(label, {
        x: cx - font.widthOfTextAtSize(label, 18) / 2,
        y: cyTop - 60 - qrSize - 34,
        size: 18,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      const hint = "Scan to order";
      page.drawText(hint, {
        x: cx - fontLight.widthOfTextAtSize(hint, 10) / 2,
        y: cyTop - 60 - qrSize - 50,
        size: 10,
        font: fontLight,
        color: rgb(0.45, 0.45, 0.45),
      });
    }

    return Buffer.from(await pdf.save());
  }
}
