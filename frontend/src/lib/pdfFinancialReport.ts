// Re-export do builder consolidado em lib/reports/pdfFinancialReport.ts.
// O builder novo usa o template compartilhado de relatorios (header em todas paginas).
import { buildFinancialReportPdf, type FinancialReportInput } from './reports/pdfFinancialReport';

export type { FinancialReportInput };

export async function generateFinancialReportPdf(input: FinancialReportInput) {
  return buildFinancialReportPdf(input);
}
