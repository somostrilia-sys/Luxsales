/**
 * Normaliza número de telefone brasileiro para formato WhatsApp (Meta Business API)
 * Retorna: "5511987654321" (sem + nem espaços) ou null se inválido
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Remove tudo que não é dígito
  let digits = raw.replace(/\D/g, "");

  // Remove +55 ou 55 no início (código do Brasil)
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  // Agora deve ter DDD (2) + número (8 ou 9) = 10 ou 11 dígitos
  if (digits.length < 10 || digits.length > 11) return null;

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);

  // Valida DDD (11-99)
  const dddNum = parseInt(ddd, 10);
  if (dddNum < 11 || dddNum > 99) return null;

  let finalNumber = number;

  if (number.length === 8) {
    const firstDigit = parseInt(number[0], 10);
    // Celular começa com 6, 7, 8 ou 9 → adiciona o 9
    if (firstDigit >= 6) {
      finalNumber = "9" + number;
    }
    // Fixo (2-5) → mantém como está
  }

  // Resultado final: 55 + DDD + número (12 ou 13 dígitos no total)
  return "55" + ddd + finalNumber;
}

/**
 * Testa se o número final parece válido para WhatsApp
 */
export function isValidWhatsAppNumber(normalized: string | null): boolean {
  if (!normalized) return false;
  // Brasil: 55 + 2 DDD + 9 número = 13 dígitos (celular) ou 12 (fixo)
  return normalized.length === 13 || normalized.length === 12;
}
