import { getDb, generateId, generateAffiliateCode, nowTimestamp, fromFirestoreTimestamp } from './firebase'
import type { Query, DocumentData, Filter } from 'firebase-admin/firestore'

// ===================== TYPES =====================

export interface User {
  id: string
  email: string
  passwordHash: string
  fullName?: string | null
  phone?: string | null
  country?: string | null
  role: string
  status: string
  emailVerified: boolean
  phoneVerified: boolean
  kycStatus: string
  kycIdPhoto?: string | null
  kycSelfie?: string | null
  kycNotes?: string | null
  balance: number
  frozenBalance: number
  mustChangePassword: boolean
  affiliateCode: string
  referredBy?: string | null
  merchantId?: string | null
  createdAt: string
  updatedAt: string
}

export interface OtpCode {
  id: string
  userId?: string | null
  email: string
  phone?: string | null
  code: string
  type: string
  purpose?: string | null
  verified: boolean
  expiresAt: string
  createdAt: string
}

export interface KYCRecord {
  id: string
  userId: string
  type: string
  fileUrl: string
  status: string
  reviewedAt?: string | null
  reviewerId?: string | null
  notes?: string | null
  createdAt: string
}

export interface Deposit {
  id: string
  userId: string
  amount: number
  currency: string
  network: string
  txId?: string | null
  fromAddress?: string | null
  toAddress?: string | null
  status: string
  method: string
  merchantId?: string | null
  merchantNote?: string | null
  screenshot?: string | null
  createdAt: string
  updatedAt: string
}

export interface Withdrawal {
  id: string
  userId: string
  amount: number
  currency: string
  network: string
  toAddress: string
  status: string
  method: string
  merchantId?: string | null
  txId?: string | null
  fee: number
  adminNote?: string | null
  screenshot?: string | null
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description?: string | null
  referenceId?: string | null
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

export interface PaymentMethod {
  id: string
  name: string
  type: string // 'bank_transfer' | 'bank_deposit' | 'atm_transfer' | 'crypto'
  category: string // 'bank' | 'crypto'
  purpose: string // 'deposit' | 'withdrawal' | 'both'
  isActive: boolean
  network?: string | null
  walletAddress?: string | null
  accountName?: string | null
  accountNumber?: string | null
  beneficiaryName?: string | null
  phone?: string | null
  recipientName?: string | null
  recipientPhone?: string | null
  minAmount?: number | null
  maxAmount?: number | null
  instructions?: string | null
  createdAt: string
  updatedAt: string
}

export interface UserPaymentMethod {
  id: string
  userId: string
  name: string // e.g., "حسابي البنكي", "محفظة TRC20"
  type: string // 'bank_transfer' | 'bank_deposit' | 'atm_transfer' | 'crypto'
  category: string // 'bank' | 'crypto'
  isActive: boolean
  network?: string | null
  walletAddress?: string | null
  accountName?: string | null
  accountNumber?: string | null
  beneficiaryName?: string | null
  phone?: string | null
  recipientName?: string | null
  recipientPhone?: string | null
  createdAt: string
  updatedAt: string
}

// ===================== USER OPERATIONS =====================

export const userOperations = {
  async findUnique(where: { email?: string; id?: string }): Promise<User | null> {
    const db = getDb()
    if (where.email) {
      const snapshot = await db.collection('users').where('email', '==', where.email).limit(1).get()
      if (snapshot.empty) return null
      const doc = snapshot.docs[0]
      return { id: doc.id, ...doc.data() } as User
    }
    if (where.id) {
      const doc = await db.collection('users').doc(where.id).get()
      if (!doc.exists) return null
      return { id: doc.id, ...doc.data() } as User
    }
    return null
  },

  async findMany(options?: { orderBy?: string; take?: number; select?: string[] }): Promise<User[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('users')
    
    if (options?.take) {
      query = query.limit(options.take)
    }
    
    const snapshot = await query.get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as User))
    // Sort in JS
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const user: User = {
      ...data,
      id,
      affiliateCode: data.affiliateCode || generateAffiliateCode(),
      createdAt: now,
      updatedAt: now,
    }
    await db.collection('users').doc(id).set(user)
    return user
  },

  async update(where: { id: string }, data: Partial<User>): Promise<User> {
    const db = getDb()
    const now = nowTimestamp()
    const updateData = { ...data, updatedAt: now }
    await db.collection('users').doc(where.id).update(updateData)
    const doc = await db.collection('users').doc(where.id).get()
    return { id: doc.id, ...doc.data() } as User
  },

  async incrementBalance(userId: string, amount: number): Promise<void> {
    const db = getDb()
    const userRef = db.collection('users').doc(userId)
    const doc = await userRef.get()
    if (!doc.exists) return
    const currentBalance = (doc.data()?.balance || 0)
    await userRef.update({
      balance: currentBalance + amount,
      updatedAt: nowTimestamp(),
    })
  },

  async updateBalance(userId: string, newBalance: number): Promise<void> {
    const db = getDb()
    await db.collection('users').doc(userId).update({
      balance: newBalance,
      updatedAt: nowTimestamp(),
    })
  },

  async updateFrozenBalance(userId: string, newFrozenBalance: number): Promise<void> {
    const db = getDb()
    await db.collection('users').doc(userId).update({
      frozenBalance: newFrozenBalance,
      updatedAt: nowTimestamp(),
    })
  },
}

// ===================== OTP CODE OPERATIONS =====================

export const otpCodeOperations = {
  async create(data: Omit<OtpCode, 'id' | 'createdAt'>): Promise<OtpCode> {
    const db = getDb()
    const id = generateId()
    const otp: OtpCode = { ...data, id, createdAt: nowTimestamp(), verified: false }
    await db.collection('otpCodes').doc(id).set(otp)
    return otp
  },

  async findFirst(options: {
    where: {
      email?: string
      userId?: string
      type: string
      verified: boolean
    }
    orderBy?: string
  }): Promise<OtpCode | null> {
    const db = getDb()

    let query: Query<DocumentData> = db.collection('otpCodes')

    // Only use equality filters - NO orderBy to avoid composite index errors
    if (options.where.email) {
      query = query.where('email', '==', options.where.email)
    }
    if (options.where.userId) {
      query = query.where('userId', '==', options.where.userId)
    }
    query = query.where('type', '==', options.where.type)
    query = query.where('verified', '==', false)
    query = query.limit(10) // fetch a few and sort in JS
    
    const snapshot = await query.get()
    if (snapshot.empty) return null
    
    // Sort in JS by createdAt desc and find the latest non-expired one
    const results = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as OtpCode))
      .filter((r) => new Date(r.expiresAt) >= new Date())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    if (results.length === 0) return null
    return results[0]
  },

  async update(id: string, data: Partial<OtpCode>): Promise<void> {
    const db = getDb()
    await db.collection('otpCodes').doc(id).update(data)
  },
}

// ===================== KYC RECORD OPERATIONS =====================

export const kycRecordOperations = {
  async create(data: Omit<KYCRecord, 'id' | 'createdAt'>): Promise<KYCRecord> {
    const db = getDb()
    const id = generateId()
    const record: KYCRecord = { ...data, id, createdAt: nowTimestamp() }
    await db.collection('kycRecords').doc(id).set(record)
    return record
  },

  async findMany(): Promise<(KYCRecord & { user?: { id: string; email: string; fullName: string | null; phone: string | null } })[]> {
    const db = getDb()
    const snapshot = await db.collection('kycRecords').limit(100).get()
    
    const results: (KYCRecord & { user?: { id: string; email: string; fullName: string | null; phone: string | null } })[] = []
    
    for (const doc of snapshot.docs) {
      const data = doc.data() as KYCRecord
      const userDoc = await db.collection('users').doc(data.userId).get()
      let user: { id: string; email: string; fullName: string | null; phone: string | null } | undefined
      if (userDoc.exists) {
        const ud = userDoc.data()
        user = { id: userDoc.id, email: ud.email, fullName: ud.fullName || null, phone: ud.phone || null }
      }
      results.push({ id: doc.id, ...data, user })
    }
    
    // Sort in JS
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async update(id: string, data: Partial<KYCRecord>): Promise<KYCRecord> {
    const db = getDb()
    await db.collection('kycRecords').doc(id).update(data)
    const doc = await db.collection('kycRecords').doc(id).get()
    return { id: doc.id, ...doc.data() } as KYCRecord
  },

  async countPending(userId: string): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection('kycRecords')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get()
    return snapshot.size
  },
}

// ===================== DEPOSIT OPERATIONS =====================

export const depositOperations = {
  async create(data: Omit<Deposit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deposit> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const deposit: Deposit = { ...data, id, createdAt: now, updatedAt: now }
    await db.collection('deposits').doc(id).set(deposit)
    return deposit
  },

  async findMany(options?: { status?: string }): Promise<(Deposit & { user?: { id: string; email: string; fullName: string | null } })[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('deposits')
    
    if (options?.status && options.status !== 'all') {
      query = query.where('status', '==', options.status)
    }
    
    query = query.limit(100)
    const snapshot = await query.get()
    
    const results: (Deposit & { user?: { id: string; email: string; fullName: string | null } })[] = []
    
    for (const doc of snapshot.docs) {
      const data = doc.data() as Deposit
      const userDoc = await db.collection('users').doc(data.userId).get()
      let user: { id: string; email: string; fullName: string | null } | undefined
      if (userDoc.exists) {
        const ud = userDoc.data()
        user = { id: userDoc.id, email: ud.email, fullName: ud.fullName || null }
      }
      results.push({ id: doc.id, ...data, user })
    }
    
    // Sort in JS
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findUnique(id: string): Promise<(Deposit & { id: string }) | null> {
    const db = getDb()
    const doc = await db.collection('deposits').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as Deposit
  },

  async update(id: string, data: Partial<Deposit>): Promise<Deposit> {
    const db = getDb()
    await db.collection('deposits').doc(id).update({ ...data, updatedAt: nowTimestamp() })
    const doc = await db.collection('deposits').doc(id).get()
    return { id: doc.id, ...doc.data() } as Deposit
  },
}

// ===================== WITHDRAWAL OPERATIONS =====================

export const withdrawalOperations = {
  async create(data: Omit<Withdrawal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Withdrawal> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const withdrawal: Withdrawal = { ...data, id, createdAt: now, updatedAt: now }
    await db.collection('withdrawals').doc(id).set(withdrawal)
    return withdrawal
  },

  async findMany(options?: { status?: string }): Promise<(Withdrawal & { user?: { id: string; email: string; fullName: string | null; phone: string | null } })[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('withdrawals')
    
    if (options?.status && options.status !== 'all') {
      query = query.where('status', '==', options.status)
    }
    
    query = query.limit(100)
    const snapshot = await query.get()
    
    const results: (Withdrawal & { user?: { id: string; email: string; fullName: string | null; phone: string | null } })[] = []
    
    for (const doc of snapshot.docs) {
      const data = doc.data() as Withdrawal
      const userDoc = await db.collection('users').doc(data.userId).get()
      let user: { id: string; email: string; fullName: string | null; phone: string | null } | undefined
      if (userDoc.exists) {
        const ud = userDoc.data()
        user = { id: userDoc.id, email: ud.email, fullName: ud.fullName || null, phone: ud.phone || null }
      }
      results.push({ id: doc.id, ...data, user })
    }
    
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findUnique(id: string): Promise<(Withdrawal & { id: string }) | null> {
    const db = getDb()
    const doc = await db.collection('withdrawals').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as Withdrawal
  },

  async update(id: string, data: Partial<Withdrawal>): Promise<Withdrawal> {
    const db = getDb()
    await db.collection('withdrawals').doc(id).update({ ...data, updatedAt: nowTimestamp() })
    const doc = await db.collection('withdrawals').doc(id).get()
    return { id: doc.id, ...doc.data() } as Withdrawal
  },
}

// ===================== TRANSACTION OPERATIONS =====================

export const transactionOperations = {
  async create(data: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const db = getDb()
    const id = generateId()
    const transaction: Transaction = { ...data, id, createdAt: nowTimestamp() }
    await db.collection('transactions').doc(id).set(transaction)
    return transaction
  },

  async findMany(userId: string): Promise<Transaction[]> {
    const db = getDb()
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .limit(100)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction))
    // Sort by createdAt desc in JS to avoid composite index
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },
}

// ===================== NOTIFICATION OPERATIONS =====================

export const notificationOperations = {
  async create(data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const db = getDb()
    const id = generateId()
    const notification: Notification = { ...data, id, createdAt: nowTimestamp() }
    await db.collection('notifications').doc(id).set(notification)
    return notification
  },

  async findMany(userId: string): Promise<Notification[]> {
    const db = getDb()
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .limit(50)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Notification))
    // Sort by createdAt desc in JS to avoid composite index
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },
}

// ===================== PAYMENT METHOD OPERATIONS =====================

export const paymentMethodOperations = {
  async create(data: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentMethod> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const method: PaymentMethod = { ...data, id, createdAt: now, updatedAt: now }
    await db.collection('paymentMethods').doc(id).set(method)
    return method
  },

  async findMany(): Promise<PaymentMethod[]> {
    const db = getDb()
    const snapshot = await db.collection('paymentMethods').limit(50).get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PaymentMethod))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findActive(purpose?: string): Promise<PaymentMethod[]> {
    const db = getDb()
    const snapshot = await db.collection('paymentMethods')
      .where('isActive', '==', true)
      .limit(50)
      .get()
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PaymentMethod))
    // Filter by purpose in JS
    if (purpose) {
      results = results.filter((m) => m.purpose === purpose || m.purpose === 'both')
    }
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async update(id: string, data: Partial<PaymentMethod>): Promise<void> {
    const db = getDb()
    await db.collection('paymentMethods').doc(id).update({ ...data, updatedAt: nowTimestamp() })
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection('paymentMethods').doc(id).delete()
  },
}

// ===================== USER PAYMENT METHOD OPERATIONS =====================

export const userPaymentMethodOperations = {
  async create(data: Omit<UserPaymentMethod, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserPaymentMethod> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const method: UserPaymentMethod = { ...data, id, createdAt: now, updatedAt: now }
    await db.collection('userPaymentMethods').doc(id).set(method)
    return method
  },

  async findByUserId(userId: string): Promise<UserPaymentMethod[]> {
    const db = getDb()
    const snapshot = await db.collection('userPaymentMethods')
      .where('userId', '==', userId)
      .limit(50)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as UserPaymentMethod))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async update(id: string, data: Partial<UserPaymentMethod>): Promise<void> {
    const db = getDb()
    await db.collection('userPaymentMethods').doc(id).update({ ...data, updatedAt: nowTimestamp() })
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection('userPaymentMethods').doc(id).delete()
  },
}

// ===================== SEED (Create Admin + Firestore Indexes) =====================

export async function seedDatabase() {
  const db = getDb()
  const bcrypt = await import('bcryptjs')

  // Check if admin already exists
  const existingAdmin = await userOperations.findUnique({ email: 'mshay2024m@gmail.com' })
  if (existingAdmin) {
    console.log('Admin user already exists.')
    return
  }

  const passwordHash = await bcrypt.default.hash('admin123admin123admin123', 12)

  const admin: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
    email: 'mshay2024m@gmail.com',
    passwordHash,
    fullName: 'مدير النظام',
    phone: null,
    country: null,
    role: 'admin',
    status: 'active',
    emailVerified: true,
    phoneVerified: false,
    kycStatus: 'none',
    kycIdPhoto: null,
    kycSelfie: null,
    kycNotes: null,
    balance: 0,
    frozenBalance: 0,
    mustChangePassword: true,
    affiliateCode: 'ADMIN',
    referredBy: null,
    merchantId: null,
  }

  await userOperations.create(admin)
  console.log('Admin user created successfully with email: mshay2024m@gmail.com')
}
