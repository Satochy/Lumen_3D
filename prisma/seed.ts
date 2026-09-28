import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()
  await prisma.filamentStock.deleteMany()

  // 1. Filamentos
  await prisma.filamentStock.createMany({
    data: [
      { material: 'PLA', color: 'Preto Fosco', hexColor: '#111111', remainingGrams: 800, minThresholdGrams: 200 },
      { material: 'PLA', color: 'Branco Neve', hexColor: '#FFFFFF', remainingGrams: 150, minThresholdGrams: 200 },
    ],
  })

  // 2. Produto
  const product = await prisma.product.create({
    data: {
      title: 'Vaso Poligonal 20cm',
      slug: 'vaso-poligonal-20cm',
      description: 'Vaso moderno impresso em 3D',
      category: 'Decoração',
      price: 49.90,
      stock: 10,
      images: [],
    },
  })

  // 3. Pedido (Passando o campo 'user' necessário)
  // Nota: Se a sua relação for um objeto ou userId, ajuste conforme o seu schema:
  // Se 'user' for uma relação nested com User:
  /*
  await prisma.order.create({
    data: {
      status: 'PENDING',
      totalAmount: 99.80,
      user: {
        connectOrCreate: {
          where: { email: 'cliente@exemplo.com' },
          create: { email: 'cliente@exemplo.com', name: 'Cliente Teste' },
        },
      },
      items: {
        create: [
          {
            productId: product.id,
            quantity: 2,
            priceUnit: 49.90,
          },
        ],
      },
    },
  })
  */
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })