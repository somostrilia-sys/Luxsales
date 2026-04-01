/**
 * Resolve company filter for queries.
 * - "all" → null (no filter = show all companies for group CEOs)
 * - specific company → that company_id
 *
 * @deprecated WALK_HOLDING_ID e OBJETIVO_COMPANY_ID mantidos para compatibilidade
 * mas não devem ser usados em código novo. Use OrganizationContext.
 */
export const WALK_HOLDING_ID = "d33b6a84-8f72-4441-b2eb-dd151a31ac12";
export const OBJETIVO_COMPANY_ID = "70967469-9a9b-4e29-a744-410e41eb47a5";

/**
 * Returns the company_id to filter by, or null if should show ALL companies.
 */
export function resolveCompanyFilter(
  selectedCompanyId: string | undefined | null,
  collaboratorCompanyId: string | undefined | null,
): string | null {
  const selected = selectedCompanyId && selectedCompanyId !== "all" ? selectedCompanyId : null;
  const effective = selected || collaboratorCompanyId || null;

  // Walk Holding = show all (it's the group, not an operational company)
  if (!effective || effective === WALK_HOLDING_ID) return null;

  return effective;
}

/**
 * For operations that REQUIRE a company_id, falls back to collaborator's company.
 * Se nenhum disponível, usa a primeira empresa da lista.
 */
export function resolveCompanyRequired(
  selectedCompanyId: string | undefined | null,
  collaboratorCompanyId: string | undefined | null,
  availableCompanyIds?: string[],
): string {
  const filter = resolveCompanyFilter(selectedCompanyId, collaboratorCompanyId);
  if (filter) return filter;

  // Usar a empresa do colaborador
  if (collaboratorCompanyId && collaboratorCompanyId !== WALK_HOLDING_ID) {
    return collaboratorCompanyId;
  }

  // Fallback: primeira empresa disponível
  if (availableCompanyIds?.length) {
    const nonHolding = availableCompanyIds.find(id => id !== WALK_HOLDING_ID);
    if (nonHolding) return nonHolding;
  }

  // Último recurso (legado)
  return OBJETIVO_COMPANY_ID;
}
