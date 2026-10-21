/**
 * Utilitários para manipulação e validação de CEP
 * Funções puras para uso em validações de frete
 */

/**
 * Sanitiza o CEP mantendo apenas os 8 dígitos numéricos
 * Remove pontos, hífens e outros caracteres não numéricos
 * @param cep - CEP original (pode estar formatado como "12345-678" ou "12.345-678")
 * @returns CEP sanitizado com exatamente 8 dígitos, ou string vazia se inválido
 */
export function sanitizeCEP(cep: string): string {
  return cep.replace(/\D/g, '').slice(0, 8)
}

/**
 * Valida se o CEP tem 8 dígitos válidos
 * @param cep - CEP sanitizado (apenas números)
 * @returns true se tiver exatamente 8 dígitos numéricos
 */
export function isValidCEP(cep: string): boolean {
  return /^\d{8}$/.test(cep)
}

/**
 * Formata o CEP no padrão brasileiro (XXXXX-XXX)
 * @param cep - CEP sanitizado (apenas números)
 * @returns CEP formatado ou string vazia se inválido
 */
export function formatCEP(cep: string): string {
  if (!isValidCEP(cep)) return ''
  return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')
}

/**
 * Verifica se o CEP pertence à região de Itapetininga e municípios limítrofes
 * (Itapetininga, Angatuba, Buri, Campina do Monte Alegre, Capão Bonito,
 * Capela do Alto, Guareí, Pilar do Sul, São Miguel Arcanjo, Sarapuí, Tatuí)
 * @param cep - CEP formatado ou sanitizado
 */
export function isLocalShippingRegion(cep: string): boolean {
  const cleanCep = sanitizeCEP(cep)
  if (!isValidCEP(cleanCep)) return false

  const cepNum = parseInt(cleanCep, 10)

  // Faixa de CEPs da Região de Itapetininga/SW Paulista (18200-000 a 18285-999)
  return cepNum >= 18200000 && cepNum <= 18285999
}