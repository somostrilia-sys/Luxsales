/**
 * Resolve company filter for queries.
 * - "all" or Walk Holding → null (no filter = show all companies)
 * - specific company → that company_id
 * 
 * Walk Holding is the parent holding group, NOT an operational company.
 * It has no leads, templates, or operational data.
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
 * For operations that REQUIRE a company_id (e.g., inserting templates, scripts),
 * falls back to Objetivo when "all" is selected.
 */
export function resolveCompanyRequired(
  selectedCompanyId: string | undefined | null,
  collaboratorCompanyId: string | undefined | null,
): string {
  const filter = resolveCompanyFilter(selectedCompanyId, collaboratorCompanyId);
  return filter || OBJETIVO_COMPANY_ID;
}
