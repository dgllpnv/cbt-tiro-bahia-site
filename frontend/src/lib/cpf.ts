// =====================================================
// Validacao e formatacao de CPF (Cadastro de Pessoa Fisica).
// Algoritmo oficial: dois digitos verificadores calculados a partir
// dos 9 primeiros digitos. Implementacao padrao usada em todo o BR.
// =====================================================

/** Remove tudo que nao for digito. */
export function stripCpf(input: string): string {
  return (input || '').replace(/\D/g, '');
}

/**
 * Valida um CPF (com ou sem mascara). Retorna true se passa nos dois
 * digitos verificadores E nao e uma sequencia repetida invalida
 * (ex.: 00000000000, 11111111111). CPFs repetidos passam matematicamente
 * mas sao bloqueados pela Receita Federal — entao bloqueamos tambem.
 */
export function isValidCpf(input: string): boolean {
  const cpf = stripCpf(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro digito verificador (DV1)
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let dv1 = (sum * 10) % 11;
  if (dv1 === 10) dv1 = 0;
  if (dv1 !== parseInt(cpf.charAt(9), 10)) return false;

  // Segundo digito verificador (DV2)
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  let dv2 = (sum * 10) % 11;
  if (dv2 === 10) dv2 = 0;
  if (dv2 !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
}

/**
 * Aplica mascara progressiva 000.000.000-00 enquanto o usuario digita.
 * Tolera input bruto, parcial ou ja mascarado — sempre normaliza para
 * a forma canonica baseada apenas nos digitos.
 *
 * Exemplos:
 *  ""             -> ""
 *  "123"          -> "123"
 *  "12345"        -> "123.45"
 *  "12345678"     -> "123.456.78"
 *  "123456789"    -> "123.456.789"
 *  "12345678901"  -> "123.456.789-01"
 *  "1234567890199"-> "123.456.789-01"   (corta no 11º digito)
 */
export function formatCpfMask(input: string): string {
  const digits = stripCpf(input).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
