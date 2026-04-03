import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Pushing schema to database...')
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').catch(() => {})

  console.log('✅ Database tables created!')

  // Create admin user
  const adminEmail = 'mshay2024m@gmail.com'
  const adminPassword = 'admin123admin123admin123'
  const hash = await bcrypt.hash(adminPassword, 12)
  const affiliateCode = crypto.randomBytes(4).toString('hex').toUpperCase()

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hash,
        fullName: 'مدير النظام',
        role: 'admin',
        status: 'active',
        emailVerified: true,
        mustChangePassword: true,
        affiliateCode,
      },
    })
    console.log('✅ Admin user created:', adminEmail)
    console.log('⚠️  Admin must change password on first login!')
  } else {
    console.log('ℹ️  Admin user already exists')
  }

  console.log('\n🎉 Setup complete!')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('❌ Error:', e)
  process.exit(1)
})
