/**
 * Dados de contato e identificação do site em um único lugar.
 * Alterar aqui reflete na landing, no Header e no Footer.
 */
export const siteConfig = {
  email: 'lumenimpressao3d@gmail.com',
  instagram: {
    handle: '@lumen.3d_',
    url: 'https://instagram.com/lumen.3d_',
  },
  whatsapp: {
    atendimento: { number: '5515988324925', display: '(15) 98832-4925' },
    comercial: { number: '5515981159636', display: '(15) 98115-9636' },
  },
} as const

/** Monta um link do wa.me com a mensagem já codificada para a URL. */
export function whatsappLink(number: string, message?: string): string {
  const base = `https://wa.me/${number}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export const whatsappQuoteMessage =
  'Olá! Gostaria de fazer um orçamento de impressão 3D na Lúmen.'

export const whatsappDeliveryMessage =
  'Olá! Gostaria de confirmar a entrega grátis para o meu endereço em Itapetininga/região.'
