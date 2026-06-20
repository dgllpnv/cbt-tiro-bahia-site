// =====================================================
// reportRegistry.ts — catalogo dos 14 relatorios
//
// Define cada relatorio com metadados (titulo, descricao, categoria,
// se eh oficial, base legal) e a funcao que executa fetch+build+save.
// Usado pela ReportsPage para renderizar os cards e pelo
// ReportGenerateDialog para coletar filtros e gerar o PDF.
// =====================================================

import type { ReportCategory, ReportClubInfo } from './reportBase';
import { savePdf, pdfToBlobUrl } from './reportBase';
import type { ClubSettings } from '@/services/clubSettingsService';
import { reportsService } from '@/services/reportsService';
import { getHabitualityDeclarationData } from '@/services/documentsService';

import { buildBirthdaysPdf } from '../pdfBirthdays';
import { buildMembersActivePdf } from '../pdfMembersActive';
import { buildMembersInactivePdf } from '../pdfMembersInactive';
import { buildMembersExpiringPdf } from '../pdfMembersExpiring';
import { buildMembersOverduePdf } from '../pdfMembersOverdue';
import { buildHabitualityBookPdf } from '../pdfHabitualityBook';
import { buildHabitualityIndividualPdf, buildHabitualityIndividualMultiPdf } from '../pdfHabitualityIndividual';
import { buildHabitualityLowPdf } from '../pdfHabitualityLow';
import { buildEquipmentInventoryPdf } from '../pdfEquipmentInventory';
import { buildAmmoInPdf } from '../pdfAmmoIn';
import { buildAmmoOutPdf } from '../pdfAmmoOut';
import { buildShootersAmmoPdf } from '../pdfShootersAmmo';
import { buildAnnualPlanPdf } from '../pdfAnnualPlan';
import { buildComplianceChecklistPdf } from '../pdfComplianceChecklist';
import { buildDGAPdf } from '../declarations/pdfDGA';
import { buildDGA2Pdf } from '../declarations/pdfDGA2';
import { buildDSAPdf } from '../declarations/pdfDSA';
import { buildDSA2Pdf } from '../declarations/pdfDSA2';
import { buildDICPdf } from '../declarations/pdfDIC';
import { buildDCPdf } from '../declarations/pdfDC';
import { buildFiliacaoPdf } from '../declarations/pdfFiliacao';
import { buildDMPPdf } from '../declarations/pdfDMP';
import { buildDHIPdf } from '../declarations/pdfDHI';
import { buildDSFPdf } from '../declarations/pdfDSF';
import { buildRSDPdf } from '../declarations/pdfRSD';

export type FilterKind =
  | 'monthYear'      // ex: aniversariantes
  | 'period'         // from + to
  | 'days'           // numero de dias
  | 'year'           // ano
  | 'memberSelect'   // associado
  | 'quarterYear'    // trimestre + ano
  | 'select'         // dropdown de opcoes fixas
  | 'multiSelect';   // checkboxes

export interface ReportFilter {
  kind: FilterKind;
  key: string;
  label: string;
  default?: any;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface ReportFilterValues {
  [key: string]: any;
}

export interface ReportConfig {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  isOfficial: boolean;
  legalRef?: string;
  filters: ReportFilter[];
  generate: (filters: ReportFilterValues, club: ClubSettings) => Promise<{ filename: string; blobUrl: string; save: () => void }>;
}

function clubToInfo(c: ClubSettings): ReportClubInfo {
  return {
    name: c.clubName,
    cnpj: c.cnpj,
    crPj: c.crPj,
    addressLine: c.addressLine,
    city: c.city,
    state: c.state,
    zipCode: c.zipCode,
    phone: c.phone,
    email: c.email,
    responsibleName: c.responsibleName,
    responsibleCpf: c.responsibleCpf,
    responsibleRole: c.responsibleRole,
  };
}

function fileSafeDate(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

const today = () => new Date().toISOString().slice(0, 10);
const startOfYearISO = (year = new Date().getFullYear()) => `${year}-01-01`;
const endOfYearISO = (year = new Date().getFullYear()) => `${year}-12-31`;

// Anos disponiveis para selecao (2023 ate o ano corrente), do mais novo
// para o mais antigo. Usado no relatorio de Habitualidade Individual.
const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const opts: Array<{ value: string; label: string }> = [];
  for (let y = current; y >= 2023; y--) opts.push({ value: String(y), label: String(y) });
  return opts;
})();

export const REPORT_REGISTRY: ReportConfig[] = [
  // ── ASSOCIADOS ──────────────────────────────────────────────────────────
  {
    id: 'birthdays',
    title: 'Aniversariantes do mês',
    description: 'Lista de aniversariantes do mês selecionado, com idade que farão e contato.',
    category: 'MEMBERS',
    isOfficial: false,
    filters: [
      { kind: 'monthYear', key: 'month', label: 'Mês', default: new Date().getMonth() + 1 },
      {
        kind: 'multiSelect',
        key: 'roles',
        label: 'Tipos',
        default: ['ADMIN', 'ASSOCIATE', 'VISITOR'],
        options: [
          { value: 'ADMIN', label: 'Admins' },
          { value: 'ASSOCIATE', label: 'Associados' },
          { value: 'VISITOR', label: 'Visitantes' },
        ],
      },
    ],
    async generate(f, club) {
      const data = await reportsService.birthdays(f.month, f.roles);
      const pdf = await buildBirthdaysPdf(data, clubToInfo(club));
      const filename = `aniversariantes-${String(f.month).padStart(2, '0')}-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'members-active',
    title: 'Associados ativos',
    description: 'Snapshot de todos os associados ativos com filiação válida.',
    category: 'MEMBERS',
    isOfficial: false,
    filters: [],
    async generate(_, club) {
      const data = await reportsService.membersActive();
      const pdf = await buildMembersActivePdf(data, clubToInfo(club));
      const filename = `associados-ativos-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'members-inactive',
    title: 'Associados inativos',
    description: 'Lista de associados desativados ou com status inativo.',
    category: 'MEMBERS',
    isOfficial: false,
    filters: [],
    async generate(_, club) {
      const data = await reportsService.membersInactive();
      const pdf = await buildMembersInactivePdf(data, clubToInfo(club));
      const filename = `associados-inativos-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'members-active-with-cr',
    title: 'Associados ativos com CR',
    description: 'Apenas associados ativos que possuem Certificado de Registro (CR) preenchido — com nível.',
    category: 'MEMBERS',
    isOfficial: false,
    filters: [],
    async generate(_, club) {
      const data = await reportsService.membersActive(true);
      const pdf = await buildMembersActivePdf(data, clubToInfo(club), { crVariant: 'with' });
      const filename = `associados-ativos-com-cr-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'members-active-without-cr',
    title: 'Associados ativos sem CR',
    description: 'Apenas associados ativos que ainda não possuem Certificado de Registro (CR) cadastrado.',
    category: 'MEMBERS',
    isOfficial: false,
    filters: [],
    async generate(_, club) {
      const data = await reportsService.membersActive(false);
      const pdf = await buildMembersActivePdf(data, clubToInfo(club), { crVariant: 'without' });
      const filename = `associados-ativos-sem-cr-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'members-inactive-with-cr',
    title: 'Associados inativos com CR',
    description: 'Associados inativos/desativados que possuíam Certificado de Registro (CR) cadastrado.',
    category: 'MEMBERS',
    isOfficial: false,
    filters: [],
    async generate(_, club) {
      const data = await reportsService.membersInactive(true);
      const pdf = await buildMembersInactivePdf(data, clubToInfo(club), { crVariant: 'with' });
      const filename = `associados-inativos-com-cr-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'members-inactive-without-cr',
    title: 'Associados inativos sem CR',
    description: 'Associados inativos/desativados que não possuem Certificado de Registro (CR) cadastrado.',
    category: 'MEMBERS',
    isOfficial: false,
    filters: [],
    async generate(_, club) {
      const data = await reportsService.membersInactive(false);
      const pdf = await buildMembersInactivePdf(data, clubToInfo(club), { crVariant: 'without' });
      const filename = `associados-inativos-sem-cr-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'members-expiring',
    title: 'Anuidades a vencer',
    description: 'Associados com anuidade vencendo nos próximos X dias — ajuda a contatar para renovação.',
    category: 'MEMBERS',
    isOfficial: false,
    legalRef: 'IN DG/PF 311/2025, art. 20',
    filters: [
      { kind: 'days', key: 'days', label: 'Próximos dias', default: 30, min: 1, max: 365 },
    ],
    async generate(f, club) {
      const data = await reportsService.membersExpiring(f.days);
      const pdf = await buildMembersExpiringPdf(data, clubToInfo(club));
      const filename = `anuidades-vencendo-${f.days}d-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'members-overdue',
    title: 'Anuidades vencidas',
    description: 'Associados vencidos há ≥ X dias. Sem filiação ativa, não pode computar habitualidade.',
    category: 'MEMBERS',
    isOfficial: false,
    legalRef: 'IN DG/PF 311/2025, art. 20',
    filters: [
      { kind: 'days', key: 'days', label: 'Vencidos há (dias)', default: 30, min: 1, max: 730 },
    ],
    async generate(f, club) {
      const data = await reportsService.membersOverdue(f.days);
      const pdf = await buildMembersOverduePdf(data, clubToInfo(club));
      const filename = `anuidades-vencidas-${f.days}d-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  // ── HABITUALIDADE ───────────────────────────────────────────────────────
  {
    id: 'habituality-book',
    title: 'Livro de habitualidade',
    description: 'Consolidado oficial de todas as atividades no período (Anexo E + Portaria 260).',
    category: 'HABITUALIDADE',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023, art. 11; Portaria 166-COLOG/2023, Anexo E',
    filters: [
      { kind: 'period', key: 'period', label: 'Período', default: { from: startOfYearISO(), to: today() } },
    ],
    async generate(f, club) {
      const data = await reportsService.habitualityBook(f.period.from, f.period.to);
      const pdf = await buildHabitualityBookPdf(data, clubToInfo(club));
      const filename = `livro-habitualidade-${f.period.from}-a-${f.period.to}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'habituality-individual',
    title: 'Habitualidade individual (Anexo E)',
    description: 'Declaração individual completa do atirador para apresentação ao Exército. Selecione um ou mais anos — com 2+ anos o PDF traz uma seção por ano.',
    category: 'HABITUALIDADE',
    isOfficial: true,
    legalRef: 'Portaria 166-COLOG/2023 (Anexo E); Portaria 260-COLOG/2025',
    filters: [
      { kind: 'memberSelect', key: 'memberId', label: 'Associado' },
      { kind: 'multiSelect', key: 'years', label: 'Anos', default: [String(new Date().getFullYear())], options: YEAR_OPTIONS },
    ],
    async generate(f) {
      // Anos selecionados (strings dos checkboxes) -> numeros, do mais novo ao mais antigo.
      const years: number[] = ((f.years as string[]) ?? [])
        .map((y) => Number(y))
        .filter((y) => !Number.isNaN(y))
        .sort((a, b) => b - a);
      if (years.length === 0) throw new Error('Selecione ao menos um ano');

      // Busca o pacote de cada ano (endpoint existente, 1 chamada por ano).
      const packets = [];
      for (const year of years) {
        const result = await getHabitualityDeclarationData(f.memberId, year);
        if (!result.success) throw new Error(result.error || `Falha ao carregar dados de ${year}`);
        packets.push(result.data);
      }

      const memberName = packets[0].member.fullName.replace(/\s+/g, '_');
      // 1 ano -> layout oficial de sempre; 2+ anos -> uma secao por ano.
      const pdf =
        packets.length === 1
          ? await buildHabitualityIndividualPdf(packets[0])
          : await buildHabitualityIndividualMultiPdf(packets);
      const filename = `habitualidade-${memberName}-${years.join('-')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'habituality-low',
    title: 'Habitualidade inferior',
    description: 'Associados abaixo do mínimo de 8 atividades por calibre no ano (Portaria 260).',
    category: 'HABITUALIDADE',
    isOfficial: false,
    legalRef: 'Portaria 260-COLOG/2025',
    filters: [
      { kind: 'year', key: 'year', label: 'Ano', default: new Date().getFullYear() },
    ],
    async generate(f, club) {
      const data = await reportsService.habitualityLow(f.year);
      const pdf = await buildHabitualityLowPdf(data, clubToInfo(club));
      const filename = `habitualidade-inferior-${f.year}-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  // ── ACERVO & MUNICOES ──────────────────────────────────────────────────
  {
    id: 'equipment-inventory',
    title: 'Acervo do clube',
    description: 'Inventário oficial de equipamentos, armamentos e EPIs com SIGMA, condição e disponibilidade.',
    category: 'ACERVO_MUNICOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023, art. 66',
    filters: [],
    async generate(_, club) {
      const data = await reportsService.equipmentInventory();
      const pdf = await buildEquipmentInventoryPdf(data, clubToInfo(club));
      const filename = `acervo-clube-${fileSafeDate()}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'ammo-in',
    title: 'Entrada de munições',
    description: 'Movimentações de entrada de munições no período (compras, ajustes positivos).',
    category: 'ACERVO_MUNICOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023; SIGMA',
    filters: [
      { kind: 'period', key: 'period', label: 'Período', default: { from: startOfYearISO(), to: today() } },
    ],
    async generate(f, club) {
      const data = await reportsService.ammoIn(f.period.from, f.period.to);
      const pdf = await buildAmmoInPdf(data, clubToInfo(club));
      const filename = `municoes-entrada-${f.period.from}-a-${f.period.to}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'ammo-out',
    title: 'Saída de munições',
    description: 'Movimentações de saída de munições com identificação do atirador (vendas).',
    category: 'ACERVO_MUNICOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023; SIGMA',
    filters: [
      { kind: 'period', key: 'period', label: 'Período', default: { from: startOfYearISO(), to: today() } },
    ],
    async generate(f, club) {
      const data = await reportsService.ammoOut(f.period.from, f.period.to);
      const pdf = await buildAmmoOutPdf(data, clubToInfo(club));
      const filename = `municoes-saida-${f.period.from}-a-${f.period.to}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'shooters-ammo',
    title: 'Atiradores e munições utilizadas',
    description: 'Ranking de atiradores por consumo de munição no período, com detalhamento por calibre.',
    category: 'ACERVO_MUNICOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023',
    filters: [
      { kind: 'period', key: 'period', label: 'Período', default: { from: startOfYearISO(), to: today() } },
    ],
    async generate(f, club) {
      const data = await reportsService.shootersAmmo(f.period.from, f.period.to);
      const pdf = await buildShootersAmmoPdf(data, clubToInfo(club));
      const filename = `atiradores-municoes-${f.period.from}-a-${f.period.to}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  // ── COMPLIANCE & GESTAO ────────────────────────────────────────────────
  {
    id: 'annual-plan',
    title: 'Plano anual de atividades',
    description: 'Modalidades, calendário de eventos e expectativa do ano — para apresentação à PF.',
    category: 'COMPLIANCE',
    isOfficial: false,
    legalRef: 'IN DG/PF 311/2025, art. 84',
    filters: [
      { kind: 'year', key: 'year', label: 'Ano', default: new Date().getFullYear() },
    ],
    async generate(f, club) {
      const data = await reportsService.annualPlan(f.year);
      const pdf = await buildAnnualPlanPdf(data, clubToInfo(club));
      const filename = `plano-anual-${f.year}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  {
    id: 'compliance-checklist',
    title: 'Conformidade trimestral',
    description: 'Checklist consolidado da conformidade do trimestre — habitualidade, anuidades, acervo, CRs.',
    category: 'COMPLIANCE',
    isOfficial: false,
    legalRef: 'Decreto 11.615/2023; Portarias 166/2023 e 260/2025; IN 311/2025',
    filters: [
      { kind: 'quarterYear', key: 'quarter', label: 'Trimestre', default: { quarter: Math.floor(new Date().getMonth() / 3) + 1, year: new Date().getFullYear() } },
    ],
    async generate(f, club) {
      const data = await reportsService.complianceChecklist(f.quarter.quarter, f.quarter.year);
      const pdf = await buildComplianceChecklistPdf(data, clubToInfo(club));
      const filename = `conformidade-Q${f.quarter.quarter}-${f.quarter.year}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },

  // ── DECLARACOES OFICIAIS (9) ───────────────────────────────────────────
  // Todas exigem memberSelect e usam o endpoint declaration-data.
  {
    id: 'decl-dga',
    title: 'DGA — Declaração de Guarda de Acervo',
    description: 'Declaração de endereço de guarda do acervo (primeiro endereço) — atende Anexo A da Portaria 166-COLOG/2023.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Portaria 166-COLOG/2023, Anexo A; Lei 10.826/2003, art. 13',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = buildDGAPdf(data);
      const filename = `DGA-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-dga2',
    title: 'DGA2 — Declaração de Guarda de Acervo 2',
    description: 'Declaração de guarda em segundo endereço — para associados com mais de um local de guarda.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Portaria 166-COLOG/2023, Anexo A; Lei 10.826/2003, art. 13',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = buildDGA2Pdf(data);
      const filename = `DGA2-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-dsa',
    title: 'DSA — Declaração de Segurança de Acervo',
    description: 'Declaração de Segurança do Acervo (Anexo A) — primeiro endereço, com cofre/lugar seguro.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Portaria 166-COLOG/2023, Anexo A; Lei 10.826/2003',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = buildDSAPdf(data);
      const filename = `DSA-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-dsa2',
    title: 'DSA2 — Declaração de Segurança de Acervo 2',
    description: 'Declaração de Segurança do Acervo (Anexo A) — segundo endereço.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Portaria 166-COLOG/2023, Anexo A; Lei 10.826/2003',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = buildDSA2Pdf(data);
      const filename = `DSA2-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-dic',
    title: 'DIC — Declaração de Inexistência de Inquéritos',
    description: 'Declaração de inexistência de inquéritos policiais ou processos criminais (auto-declaratória).',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Código Penal, art. 299',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = buildDICPdf(data);
      const filename = `DIC-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-dc',
    title: 'DC — Compromisso em Treinamentos e Competições',
    description: 'Declaração de compromisso de participação em treinamentos e competições (Anexo C).',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023, art. 35',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = buildDCPdf(data);
      const filename = `DC-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-filiacao',
    title: 'FILIAÇÃO — Declaração de Filiação',
    description: 'Declaração de Filiação a Entidade de Tiro (Anexo B) — emitida pelo clube.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023, art. 2º, XVII; Anexo B',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = await buildFiliacaoPdf(data);
      const filename = `FILIACAO-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-dmp',
    title: 'DMP — Declaração de Modalidade e Prova',
    description: 'Declaração das modalidades e provas de tiro desportivo realizadas pela entidade.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023; Portaria 166-COLOG/2023',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = await buildDMPPdf(data);
      const filename = `DMP-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-dhi',
    title: 'DHI — Declaração de Habitualidade Inicial',
    description: 'Declaração de habitualidade inicial — para atiradores que estão começando a prática.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023; Portaria 166-COLOG/2023',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = await buildDHIPdf(data);
      const filename = `DHI-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-dsf',
    title: 'DSF — Declaração de Desfiliação',
    description: 'Declaração de desfiliação a entidade de tiro desportivo — emitida quando o associado é desligado do clube.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Decreto 11.615/2023',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = await buildDSFPdf(data);
      const filename = `DSF-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
  {
    id: 'decl-rsd',
    title: 'RSD — Comprovação de Residência',
    description: 'Declaração de comprovação de residência (últimos 5 anos) — para concessão/revalidação de CR e aquisição de PCE.',
    category: 'DECLARACOES',
    isOfficial: true,
    legalRef: 'Lei 7.115/1983, art. 2º; Código Penal, art. 299',
    filters: [{ kind: 'memberSelect', key: 'memberId', label: 'Associado' }],
    async generate(f) {
      const data = await reportsService.declarationData(f.memberId);
      const pdf = buildRSDPdf(data);
      const filename = `RSD-${data.member.fullName.replace(/\s+/g, '_')}.pdf`;
      return { filename, blobUrl: pdfToBlobUrl(pdf), save: () => savePdf(pdf, filename) };
    },
  },
];

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  MEMBERS: 'Associados',
  HABITUALIDADE: 'Habitualidade',
  ACERVO_MUNICOES: 'Acervo & Munições',
  FINANCEIRO: 'Financeiro',
  COMPLIANCE: 'Compliance & Gestão',
  DECLARACOES: 'Declarações',
};
