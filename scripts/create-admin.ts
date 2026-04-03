import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function createAdmin() {
  const email = 'mshay2024m@gmail.com'
  const password = 'admin123admin123admin123'
  const hash = await bcrypt.hash(password, 12)
  const affiliateCode = crypto.randomBytes(4).toString('hex').toUpperCase()

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: hash,
      fullName: 'مدير النظام',
      role: 'admin',
      status: 'active',
      emailVerified: true,
      phoneVerified: false,
      kycStatus: 'approved',
      balance: 0,
      frozenBalance: 0,
      affiliateCode,
    },
  })

  console.log('Admin user created:', user.id, user.email, user.role)
  await prisma.$disconnect()
}

createAdmin().catch((e) => {
  console.error(e)
  process.exit(1)
})
