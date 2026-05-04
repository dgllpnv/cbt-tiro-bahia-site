// Re-export do builder consolidado em lib/reports/pdfHabitualityIndividual.ts.
// O builder novo usa o template compartilhado de relatorios (header em todas paginas,
// citacao Portaria 260/2025, marca d'agua de documento oficial).
import { buildHabitualityIndividualPdf } from './reports/pdfHabitualityIndividual';
import type { HabitualityDeclarationPacket } from '@/services/documentsService';

export async function generateHabitualityPdf(packet: HabitualityDeclarationPacket) {
  return buildHabitualityIndividualPdf(packet);
}
