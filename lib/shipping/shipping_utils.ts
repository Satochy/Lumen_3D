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
  return cep.replace(/\D/g, '')
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

/**
 * Sanitiza o CPF mantendo apenas os dígitos numéricos
 */
export function sanitizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

/**
 * Valida o CPF através do algoritmo oficial dos dígitos verificadores
 * Rejeita dígitos repetidos (ex: 000.000.000-00) e sequências inválidas
 */
export function isValidCPF(cpf: string): boolean {
  const clean = sanitizeCPF(cpf)
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false

  let sum = 0
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(clean.substring(9, 10), 10)) return false

  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(clean.substring(10, 11), 10)) return false

  return true
}

/**
 * Formata o CPF no padrão brasileiro (000.000.000-00)
 */
export function formatCPF(cpf: string): string {
  const clean = sanitizeCPF(cpf).slice(0, 11)
  if (clean.length <= 3) return clean
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`
}