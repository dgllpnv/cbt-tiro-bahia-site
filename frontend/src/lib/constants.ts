// Mapas de tradução de enums do backend para português

export const categoryLabels: Record<string, string> = {
  AMMUNITION: 'Munição',
  TARGET: 'Alvo',
  ACCESSORY: 'Acessório',
  SAFETY_EQUIPMENT: 'Equip. de Segurança',
  RENTAL_ITEM: 'Item de Aluguel',
  COURSE: 'Curso',
  CANTINA: 'Cantina',
  OTHER: 'Outro',
};

export const transactionTypeLabels: Record<string, string> = {
  AMMUNITION_SALE: 'Venda de Munição',
  TARGET_SALE: 'Venda de Alvo',
  EQUIPMENT_RENTAL: 'Aluguel de Equipamento',
  MAGAZINE_RENTAL: 'Aluguel de Carregador',
  LANE_RENTAL: 'Aluguel de Baia',
  ANNUITY_PAYMENT: 'Pagamento de Anuidade',
  COURSE_ENROLLMENT: 'Inscrição em Curso',
  GUEST_ENTRY: 'Entrada de Convidado',
  OTHER_SALE: 'Outra Venda',
};

export const equipmentTypeLabels: Record<string, string> = {
  FIREARM: 'Arma de Fogo',
  HOLSTER: 'Coldre',
  EAR_PROTECTION: 'Proteção Auricular',
  EYE_PROTECTION: 'Proteção Ocular',
  MAGAZINE: 'Carregador',
  OTHER: 'Outro',
};

export const equipmentConditionLabels: Record<string, string> = {
  EXCELLENT: 'Excelente',
  GOOD: 'Bom',
  FAIR: 'Regular',
  NEEDS_REPAIR: 'Precisa Reparo',
  DECOMMISSIONED: 'Desativado',
};

export const loanStatusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  RETURNED: 'Devolvido',
  OVERDUE: 'Atrasado',
  LOST: 'Perdido',
  TRANSFERRED: 'Transferido',
};

export const expenseCategoryLabels: Record<string, string> = {
  INVENTORY_PURCHASE: 'Compra de Estoque',
  MAINTENANCE: 'Manutenção',
  UTILITIES: 'Utilidades',
  STAFF: 'Pessoal',
  INSURANCE: 'Seguro',
  AMMUNITION_RESTOCK: 'Reposição de Munição',
  EQUIPMENT_PURCHASE: 'Compra de Equipamento',
  OTHER: 'Outro',
};

export const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  CASHIER: 'Caixa',
  ASSOCIATE: 'Associado',
  admin: 'Administrador',
  cashier: 'Caixa',
  associate: 'Associado',
};

// Tipo de municao usada no disparo. 'Original' (fabrica) vs 'Recarregada'
// (recarregada pelo proprio atirador). Aparece no ShotEntryDialog,
// declaracao de habitualidade individual e livro de habitualidade.
export const ammunitionTypeLabels: Record<string, string> = {
  FACTORY: 'Original',
  RELOADED: 'Recarregada',
};

// Versao curta para uso em tabelas estreitas (PDFs).
export const ammunitionTypeShortLabels: Record<string, string> = {
  FACTORY: 'Orig.',
  RELOADED: 'Rec.',
};
