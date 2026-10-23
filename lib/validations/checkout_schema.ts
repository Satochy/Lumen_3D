'use client'

import { z } from 'zod'

/**
 * Schema de validação para o payload de checkout.
 * Usado tanto no Client Component (formulário) quanto na Server Action (validação final).
 *
 * Endereço: campos conforme modelo Address em prisma/schema.prisma
 * Itens: productId (obrigatório), variantId (opcional), quantity (obrigatório)
 */
export const checkoutSchema = z.object({
  endereco: z.object({
    street: z
      .string()
      .min(1, 'Logradouro é obrigatório')
      .max(200, 'Logradouro muito longo'),
    number: z
      .string()
      .min(1, 'Número é obrigatório')
      .max(20, 'Número muito longo'),
    complement: z
      .string()
      .max(100, 'Complemento muito longo')
      .optional(),
    neighborhood: z
      .string()
      .min(1, 'Bairro é obrigatório')
      .max(100, 'Bairro muito longo'),
    city: z
      .string()
      .min(1, 'Cidade é obrigatória')
      .max(100, 'Cidade muito longa'),
    state: z
      .string()
      .min(2, 'UF é obrigatória')
      .max(2, 'UF deve ter 2 dígitos')
      .toUpperCase(),
    zipCode: z
      .string()
      .min(1, 'CEP é obrigatório')
      .max(9, 'CEP inválido')
      .regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato 00000-000'),
  }),
  itens: z
    .array(
      z.object({
        productId: z
          .string()
          .uuid('ID de produto inválido'),
        variantId: z
          .string()
          .uuid('ID de variante inválido')
          .optional(),
        quantity: z
          .number()
          .int('Quantidade deve ser um número inteiro')
          .positive('Quantidade deve ser maior que zero'),
      }),
    )
    .min(1, 'O carrinho está vazio'),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>