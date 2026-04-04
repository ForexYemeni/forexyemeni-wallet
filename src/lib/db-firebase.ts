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
  pinHash?: string | null
  pendingConfirmation?: string | null
  permissions?: string | null
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
  fee?: number
  netAmount?: number
  currency: string
  network: string
  txId?: string | null
  fromAddress?: string | null
  toAddress?: string | null
  status: string
  method: string
  merchantId?: string | null
  merchantNote?: string | null
  adminNote?: string | null
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
  netAmount?: number
  adminNote?: string | null
  screenshot?: string | null
  paymentMethodName?: string | null
  paymentMethodId?: string | null
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
    
    if (snapshot.empty) return []

    // Batch fetch all users in a single call
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as KYCRecord) }))
    const uniqueUserIds = [...new Set(records.map(r => r.userId))]
    const userDocs = await Promise.all(uniqueUserIds.map(uid => db.collection('users').doc(uid).get()))
    const userMap = new Map<string, { id: string; email: string; fullName: string | null; phone: string | null }>()
    for (const userDoc of userDocs) {
      if (userDoc.exists) {
        const ud = userDoc.data()
        userMap.set(userDoc.id, { id: userDoc.id, email: ud.email, fullName: ud.fullName || null, phone: ud.phone || null })
      }
    }

    const results = records.map(r => ({ ...r, user: userMap.get(r.userId) }))
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
    
    if (snapshot.empty) return []

    // Batch fetch all users in parallel
    const deposits = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Deposit) }))
    const uniqueUserIds = [...new Set(deposits.map(d => d.userId))]
    const userDocs = await Promise.all(uniqueUserIds.map(uid => db.collection('users').doc(uid).get()))
    const userMap = new Map<string, { id: string; email: string; fullName: string | null }>()
    for (const userDoc of userDocs) {
      if (userDoc.exists) {
        const ud = userDoc.data()
        userMap.set(userDoc.id, { id: userDoc.id, email: ud.email, fullName: ud.fullName || null })
      }
    }

    const results = deposits.map(d => ({ ...d, user: userMap.get(d.userId) }))
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
    
    if (snapshot.empty) return []

    // Batch fetch all users in parallel
    const withdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Withdrawal) }))
    const uniqueUserIds = [...new Set(withdrawals.map(w => w.userId))]
    const userDocs = await Promise.all(uniqueUserIds.map(uid => db.collection('users').doc(uid).get()))
    const userMap = new Map<string, { id: string; email: string; fullName: string | null; phone: string | null }>()
    for (const userDoc of userDocs) {
      if (userDoc.exists) {
        const ud = userDoc.data()
        userMap.set(userDoc.id, { id: userDoc.id, email: ud.email, fullName: ud.fullName || null, phone: ud.phone || null })
      }
    }

    const results = withdrawals.map(w => ({ ...w, user: userMap.get(w.userId) }))
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

  async findMany(userId: string, after?: string): Promise<Notification[]> {
    const db = getDb()
    let query: Query<DocumentData, Filter> = db.collection('notifications')
      .where('userId', '==', userId)
    if (after) {
      query = query.where('createdAt', '>', after)
    }
    const snapshot = await query.limit(50).get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Notification))
    // Sort by createdAt desc in JS to avoid composite index
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async countUnread(userId: string): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .limit(100)
      .get()
    return snapshot.docs.length
  },

  async markAllRead(userId: string): Promise<void> {
    const db = getDb()
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .limit(100)
      .get()
    const batch = db.batch()
    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { read: true })
    }
    await batch.commit()
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

// ===================== FAQ BOT OPERATIONS =====================

export interface FaqItem {
  id: string
  question: string
  keywords: string[]
  answer: string
  category: string // 'general' | 'deposit' | 'withdrawal' | 'kyc' | 'account' | 'fees'
  isActive: boolean
  priority: number // higher = shown first
  createdAt: string
  updatedAt: string
}

export const faqBotOperations = {
  async create(data: Omit<FaqItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<FaqItem> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const faq: FaqItem = { ...data, id, createdAt: now, updatedAt: now }
    await db.collection('faqBot').doc(id).set(faq)
    return faq
  },

  async findMany(options?: { activeOnly?: boolean }): Promise<FaqItem[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('faqBot')
    if (options?.activeOnly) {
      query = query.where('isActive', '==', true)
    }
    const snapshot = await query.limit(100).get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FaqItem))
    // Sort by priority desc
    results.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    return results
  },

  async update(id: string, data: Partial<FaqItem>): Promise<FaqItem> {
    const db = getDb()
    await db.collection('faqBot').doc(id).update({ ...data, updatedAt: nowTimestamp() })
    const doc = await db.collection('faqBot').doc(id).get()
    return { id: doc.id, ...doc.data() } as FaqItem
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection('faqBot').doc(id).delete()
  },

  async getBotSettings(): Promise<{ isEnabled: boolean; greeting: string }> {
    const db = getDb()
    const doc = await db.collection('systemSettings').doc('botSettings').get()
    if (!doc.exists) {
      return { isEnabled: true, greeting: 'مرحباً! كيف يمكنني مساعدتك اليوم؟ اطرح سؤالك وسأحاول الإجابة.' }
    }
    const data = doc.data()
    return {
      isEnabled: data?.isEnabled ?? true,
      greeting: data?.greeting || 'مرحباً! كيف يمكنني مساعدتك اليوم؟ اطرح سؤالك وسأحاول الإجابة.',
    }
  },

  async updateBotSettings(data: { isEnabled: boolean; greeting: string }): Promise<void> {
    const db = getDb()
    await db.collection('systemSettings').doc('botSettings').set({
      ...data,
      updatedAt: nowTimestamp(),
    }, { merge: true })
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

// ===================== REFERRAL TYPES =====================

export interface Referral {
  id: string
  referrerId: string
  referredId: string
  referredEmail: string
  referralCode: string
  level: number
  status: string // 'active' | 'inactive'
  totalEarnings: number
  createdAt: string
}

export interface ReferralCommission {
  id: string
  referrerId: string
  referredId: string
  referralId: string
  depositId?: string | null
  withdrawalId?: string | null
  amount: number
  level: number
  description: string
  createdAt: string
}

export interface ReferralSettings {
  isEnabled: boolean
  commissionType: string // 'percentage' | 'fixed'
  commissionLevels: number[] // e.g., [3, 1, 0.5]
  minDepositForCommission: number
  maxLevels: number
}

// ===================== REFERRAL OPERATIONS =====================

export const referralOperations = {
  async create(data: Omit<Referral, 'id' | 'createdAt' | 'totalEarnings'>): Promise<Referral> {
    const db = getDb()
    const id = generateId()
    const referral: Referral = { ...data, id, totalEarnings: 0, createdAt: nowTimestamp() }
    await db.collection('referrals').doc(id).set(referral)
    return referral
  },

  async findByReferrer(referrerId: string): Promise<Referral[]> {
    const db = getDb()
    const snapshot = await db.collection('referrals')
      .where('referrerId', '==', referrerId)
      .limit(200)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Referral))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findByReferred(referredId: string): Promise<Referral[]> {
    const db = getDb()
    const snapshot = await db.collection('referrals')
      .where('referredId', '==', referredId)
      .limit(10)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Referral))
    return results
  },

  async updateEarnings(id: string, additionalEarnings: number): Promise<void> {
    const db = getDb()
    const doc = await db.collection('referrals').doc(id).get()
    if (!doc.exists) return
    const current = (doc.data()?.totalEarnings || 0)
    await db.collection('referrals').doc(id).update({ totalEarnings: current + additionalEarnings })
  },

  async createCommission(data: Omit<ReferralCommission, 'id' | 'createdAt'>): Promise<ReferralCommission> {
    const db = getDb()
    const id = generateId()
    const commission: ReferralCommission = { ...data, id, createdAt: nowTimestamp() }
    await db.collection('referralCommissions').doc(id).set(commission)
    return commission
  },

  async findByReferrerCommissions(referrerId: string): Promise<ReferralCommission[]> {
    const db = getDb()
    const snapshot = await db.collection('referralCommissions')
      .where('referrerId', '==', referrerId)
      .limit(200)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ReferralCommission))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findAllCommissions(): Promise<ReferralCommission[]> {
    const db = getDb()
    const snapshot = await db.collection('referralCommissions').limit(500).get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ReferralCommission))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async countAllReferrals(): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection('referrals').limit(500).get()
    return snapshot.size
  },
}

// ===================== SYSTEM SETTINGS OPERATIONS =====================

export const systemSettingsOperations = {
  async getReferralSettings(): Promise<ReferralSettings> {
    const db = getDb()
    const doc = await db.collection('systemSettings').doc('referralSettings').get()
    if (!doc.exists) {
      const defaults: ReferralSettings = {
        isEnabled: false,
        commissionType: 'percentage',
        commissionLevels: [3, 1, 0.5],
        minDepositForCommission: 10,
        maxLevels: 3,
      }
      await db.collection('systemSettings').doc('referralSettings').set(defaults)
      return defaults
    }
    return doc.data() as ReferralSettings
  },

  async updateReferralSettings(data: Partial<ReferralSettings>): Promise<ReferralSettings> {
    const db = getDb()
    const current = await systemSettingsOperations.getReferralSettings()
    const updated = { ...current, ...data }
    await db.collection('systemSettings').doc('referralSettings').set(updated)
    return updated
  },

  async findByAffiliateCode(code: string): Promise<User | null> {
    const db = getDb()
    const snapshot = await db.collection('users')
      .where('affiliateCode', '==', code)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return { id: doc.id, ...doc.data() } as User
  },
}

// ===================== CHAT OPERATIONS =====================

export interface Chat {
  id: string
  userId: string
  adminId: string
  participants: string[]
  lastMessage: string
  lastMessageAt: string
  lastMessageBy: string
  userUnreadCount: number
  adminUnreadCount: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  senderType: string
  message: string
  type: string
  imageUrl?: string | null
  read: boolean
  createdAt: string
}

export const chatOperations = {
  // Create a new chat
  async createChat(userId: string, adminId: string, firstMessage: string): Promise<Chat> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const chat: Chat = {
      id,
      userId,
      adminId,
      participants: [userId, adminId],
      lastMessage: firstMessage,
      lastMessageAt: now,
      lastMessageBy: 'user',
      userUnreadCount: 0,
      adminUnreadCount: 1,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    }
    await db.collection('chats').doc(id).set(chat)
    // Also create the first message
    const messageId = generateId()
    const message: ChatMessage = {
      id: messageId,
      chatId: id,
      senderId: userId,
      senderType: 'user',
      message: firstMessage,
      type: 'text',
      read: false,
      createdAt: now,
    }
    await db.collection('chatMessages').doc(messageId).set(message)
    return chat
  },

  // List chats for a user or admin
  async findChats(options: { userId: string; role: string }): Promise<Chat[]> {
    const db = getDb()
    let snapshot: FirebaseFirestore.QuerySnapshot
    if (options.role === 'admin') {
      snapshot = await db.collection('chats').where('adminId', '==', options.userId).limit(100).get()
    } else {
      snapshot = await db.collection('chats').where('userId', '==', options.userId).limit(50).get()
    }
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Chat))
    results.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    return results
  },

  // Get chat by id
  async findChat(chatId: string): Promise<Chat | null> {
    const db = getDb()
    const doc = await db.collection('chats').doc(chatId).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as Chat
  },

  // Send a message
  async sendMessage(chatId: string, senderId: string, senderType: string, message: string, type: string = 'text', imageUrl?: string | null): Promise<ChatMessage> {
    const db = getDb()
    const now = nowTimestamp()
    const id = generateId()
    const msg: ChatMessage = {
      id,
      chatId,
      senderId,
      senderType,
      message,
      type,
      imageUrl: imageUrl || null,
      read: false,
      createdAt: now,
    }
    await db.collection('chatMessages').doc(id).set(msg)
    // Update chat header
    const chatDoc = await db.collection('chats').doc(chatId).get()
    if (chatDoc.exists) {
      const chatData = chatDoc.data() as Chat
      const updateFields: Partial<Chat> = {
        lastMessage: message,
        lastMessageAt: now,
        lastMessageBy: senderType,
        updatedAt: now,
      }
      // Increment unread for the other party
      if (senderType === 'user') {
        updateFields.adminUnreadCount = (chatData.adminUnreadCount || 0) + 1
      } else {
        updateFields.userUnreadCount = (chatData.userUnreadCount || 0) + 1
      }
      await db.collection('chats').doc(chatId).update(updateFields)
    }
    return msg
  },

  // Get messages for a chat (paginated)
  async findMessages(chatId: string, limit: number = 50, before?: string): Promise<ChatMessage[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('chatMessages').where('chatId', '==', chatId)
    if (before) {
      const beforeDoc = await db.collection('chatMessages').doc(before).get()
      if (beforeDoc.exists) {
        query = query.endBefore(beforeDoc)
      }
    }
    query = query.limit(limit)
    const snapshot = await query.get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage))
    // Sort in chronological order (oldest first)
    results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return results
  },

  // Get latest messages for polling (messages after a given timestamp)
  async findMessagesAfter(chatId: string, after: string): Promise<ChatMessage[]> {
    const db = getDb()
    const snapshot = await db.collection('chatMessages')
      .where('chatId', '==', chatId)
      .where('createdAt', '>', after)
      .limit(50)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage))
    results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return results
  },

  // Mark messages as read
  async markRead(chatId: string, readerType: string): Promise<void> {
    const db = getDb()
    // Mark unread messages as read
    const snapshot = await db.collection('chatMessages')
      .where('chatId', '==', chatId)
      .where('read', '==', false)
      .limit(100)
      .get()
    const batch = db.batch()
    for (const doc of snapshot.docs) {
      const data = doc.data()
      // Only mark messages from the other party as read
      if (data.senderType !== readerType) {
        batch.update(doc.ref, { read: true })
      }
    }
    if (snapshot.docs.length > 0) {
      await batch.commit()
    }
    // Reset unread count for the reader
    const chatDoc = await db.collection('chats').doc(chatId).get()
    if (chatDoc.exists) {
      if (readerType === 'user') {
        await db.collection('chats').doc(chatId).update({ userUnreadCount: 0 })
      } else {
        await db.collection('chats').doc(chatId).update({ adminUnreadCount: 0 })
      }
    }
  },

  // Close a chat (admin only)
  async closeChat(chatId: string): Promise<void> {
    const db = getDb()
    await db.collection('chats').doc(chatId).update({
      status: 'closed',
      updatedAt: nowTimestamp(),
    })
  },

  // Count total unread for admin
  async countAdminUnread(adminId: string): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection('chats')
      .where('adminId', '==', adminId)
      .where('adminUnreadCount', '>', 0)
      .limit(100)
      .get()
    let total = 0
    for (const doc of snapshot.docs) {
      total += (doc.data().adminUnreadCount || 0)
    }
    return total
  },

  // Count total unread for user
  async countUserUnread(userId: string): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection('chats')
      .where('userId', '==', userId)
      .where('userUnreadCount', '>', 0)
      .limit(100)
      .get()
    let total = 0
    for (const doc of snapshot.docs) {
      total += (doc.data().userUnreadCount || 0)
    }
    return total
  },
}

// ===================== P2P MERCHANT TYPES =====================

export interface Merchant {
  id: string
  userId: string
  status: 'pending' | 'approved' | 'rejected'
  idPhoto: string
  selfiePhoto: string
  addressProof: string
  fullName: string
  phone: string
  submittedAt: string
  reviewedAt?: string | null
  reviewNote?: string | null
  reviewedBy?: string | null
}

export interface P2PListing {
  id: string
  merchantId: string
  type: 'sell' | 'buy'
  amount: number
  price: number
  currency: string
  minAmount: number
  maxAmount: number
  paymentMethods: string[]
  network: 'TRC20' | 'ERC20'
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  totalTrades: number
  successRate: number
  createdAt: string
  updatedAt: string
}

export interface P2PTrade {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  amount: number
  price: number
  total: number
  status: 'pending' | 'escrowed' | 'paid' | 'released' | 'disputed' | 'cancelled' | 'expired'
  buyerPaymentMethod: string
  buyerPaymentRef: string
  escrowTxId: string
  rating?: number | null
  review?: string | null
  disputeReason?: string | null
  disputeResolvedBy?: string | null
  disputeNote?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

// ===================== MERCHANT OPERATIONS =====================

export const merchantOperations = {
  async create(data: Omit<Merchant, 'id' | 'submittedAt' | 'status'>): Promise<Merchant> {
    const db = getDb()
    const id = generateId()
    const merchant: Merchant = { ...data, id, status: 'pending', submittedAt: nowTimestamp() }
    await db.collection('merchants').doc(id).set(merchant)
    return merchant
  },

  async findPending(): Promise<Merchant[]> {
    const db = getDb()
    const snapshot = await db.collection('merchants').where('status', '==', 'pending').limit(100).get()
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Merchant))
    results.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    return results
  },

  async findAll(): Promise<Merchant[]> {
    const db = getDb()
    const snapshot = await db.collection('merchants').limit(200).get()
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Merchant))
    results.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    return results
  },

  async findByUser(userId: string): Promise<Merchant[]> {
    const db = getDb()
    const snapshot = await db.collection('merchants').where('userId', '==', userId).limit(10).get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Merchant))
  },

  async findApprovedByUser(userId: string): Promise<Merchant | null> {
    const db = getDb()
    const snapshot = await db.collection('merchants')
      .where('userId', '==', userId)
      .where('status', '==', 'approved')
      .limit(1)
      .get()
    if (snapshot.empty) return null
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Merchant
  },

  async updateStatus(id: string, status: 'approved' | 'rejected', reviewNote?: string, reviewedBy?: string): Promise<void> {
    const db = getDb()
    await db.collection('merchants').doc(id).update({
      status,
      reviewNote: reviewNote || null,
      reviewedBy: reviewedBy || null,
      reviewedAt: nowTimestamp(),
    })
  },

  async findUnique(id: string): Promise<Merchant | null> {
    const db = getDb()
    const doc = await db.collection('merchants').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as Merchant
  },
}

// ===================== P2P LISTING OPERATIONS =====================

export const p2pListingOperations = {
  async create(data: Omit<P2PListing, 'id' | 'createdAt' | 'updatedAt' | 'totalTrades' | 'successRate'>): Promise<P2PListing> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const listing: P2PListing = { ...data, id, totalTrades: 0, successRate: 100, createdAt: now, updatedAt: now }
    await db.collection('p2pListings').doc(id).set(listing)
    return listing
  },

  async findActive(filters?: { type?: string; network?: string; paymentMethod?: string }): Promise<P2PListing[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('p2pListings').where('status', '==', 'active').limit(100)
    const snapshot = await query.get()
    let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as P2PListing))
    if (filters?.type) results = results.filter(l => l.type === filters.type)
    if (filters?.network) results = results.filter(l => l.network === filters.network)
    if (filters?.paymentMethod) results = results.filter(l => l.paymentMethods.includes(filters.paymentMethod!))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findByMerchant(merchantId: string): Promise<P2PListing[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pListings').where('merchantId', '==', merchantId).limit(50).get()
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as P2PListing))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findUnique(id: string): Promise<P2PListing | null> {
    const db = getDb()
    const doc = await db.collection('p2pListings').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as P2PListing
  },

  async update(id: string, data: Partial<P2PListing>): Promise<P2PListing> {
    const db = getDb()
    await db.collection('p2pListings').doc(id).update({ ...data, updatedAt: nowTimestamp() })
    const doc = await db.collection('p2pListings').doc(id).get()
    return { id: doc.id, ...doc.data() } as P2PListing
  },

  async pause(id: string): Promise<void> {
    const db = getDb()
    await db.collection('p2pListings').doc(id).update({ status: 'paused', updatedAt: nowTimestamp() })
  },

  async activate(id: string): Promise<void> {
    const db = getDb()
    await db.collection('p2pListings').doc(id).update({ status: 'active', updatedAt: nowTimestamp() })
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection('p2pListings').doc(id).delete()
  },

  async incrementTrades(listingId: string, success: boolean): Promise<void> {
    const db = getDb()
    const doc = await db.collection('p2pListings').doc(listingId).get()
    if (!doc.exists) return
    const data = doc.data() as P2PListing
    const totalTrades = (data.totalTrades || 0) + 1
    const completedTrades = Math.round(((data.successRate || 100) / 100) * (data.totalTrades || 0)) + (success ? 1 : 0)
    const successRate = totalTrades > 0 ? Math.round((completedTrades / totalTrades) * 100) : 100
    await db.collection('p2pListings').doc(listingId).update({ totalTrades, successRate, updatedAt: nowTimestamp() })
  },
}

// ===================== P2P TRADE OPERATIONS =====================

export const p2pTradeOperations = {
  async create(data: Omit<P2PTrade, 'id' | 'createdAt' | 'updatedAt'>): Promise<P2PTrade> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const trade: P2PTrade = { ...data, id, createdAt: now, updatedAt: now }
    await db.collection('p2pTrades').doc(id).set(trade)
    return trade
  },

  async findActive(): Promise<P2PTrade[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pTrades')
      .where('status', 'in', ['pending', 'escrowed', 'paid'])
      .limit(200).get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as P2PTrade))
  },

  async findByUser(userId: string): Promise<P2PTrade[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pTrades')
      .where('buyerId', '==', userId)
      .limit(100).get()
    const asBuyer = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as P2PTrade))
    const snapshot2 = await db.collection('p2pTrades')
      .where('sellerId', '==', userId)
      .limit(100).get()
    const asSeller = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() } as P2PTrade))
    const all = [...asBuyer, ...asSeller]
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return all
  },

  async findUnique(id: string): Promise<P2PTrade | null> {
    const db = getDb()
    const doc = await db.collection('p2pTrades').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as P2PTrade
  },

  async updateStatus(id: string, status: P2PTrade['status'], extra?: Partial<P2PTrade>): Promise<P2PTrade> {
    const db = getDb()
    const updateData: any = { status, updatedAt: nowTimestamp() }
    if (status === 'released' || status === 'cancelled' || status === 'expired') {
      updateData.completedAt = nowTimestamp()
    }
    if (extra) Object.assign(updateData, extra)
    await db.collection('p2pTrades').doc(id).update(updateData)
    const doc = await db.collection('p2pTrades').doc(id).get()
    return { id: doc.id, ...doc.data() } as P2PTrade
  },

  async addDispute(id: string, reason: string): Promise<void> {
    const db = getDb()
    await db.collection('p2pTrades').doc(id).update({
      status: 'disputed',
      disputeReason: reason,
      updatedAt: nowTimestamp(),
    })
  },

  async resolveDispute(id: string, resolvedBy: string, note: string): Promise<void> {
    const db = getDb()
    await db.collection('p2pTrades').doc(id).update({
      disputeResolvedBy: resolvedBy,
      disputeNote: note,
      updatedAt: nowTimestamp(),
    })
  },

  async findAllDisputed(): Promise<P2PTrade[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pTrades').where('status', '==', 'disputed').limit(100).get()
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as P2PTrade))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findAll(): Promise<P2PTrade[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pTrades').limit(200).get()
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as P2PTrade))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },
}

// ===================== MERCHANT APPLICATION TYPES =====================

export interface MerchantApplication {
  id: string
  userId: string
  userFullName: string
  userEmail: string
  userPhone: string
  idPhotoUrl: string
  selfiePhotoUrl: string
  addressProofUrl: string
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string | null
  appliedAt: string
  reviewedAt?: string | null
  reviewedBy?: string | null
}

// ===================== P2P ORDER TYPES =====================

export interface P2POrder {
  id: string
  merchantId: string
  merchantName: string
  merchantEmail: string
  type: 'sell' | 'buy'
  asset: string
  network: string
  amount: number
  price: number
  minAmount: number
  maxAmount: number
  paymentMethods: string[]
  paymentDetails: string
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed'
  buyerId?: string | null
  buyerName?: string | null
  buyerEmail?: string | null
  buyerPaidAt?: string | null
  buyerConfirmedAt?: string | null
  sellerReleasedAt?: string | null
  escrowAmount: number
  p2pFee: number
  totalAmount: number
  createdAt: string
  updatedAt: string
  expiresAt: string
}

// ===================== P2P DISPUTE TYPES =====================

export interface P2PDispute {
  id: string
  orderId: string
  reporterId: string
  reporterName: string
  reporterType: string
  reason: string
  status: 'open' | 'resolved'
  resolution?: string | null
  resolvedBy?: string | null
  resolvedAt?: string | null
  createdAt: string
}

// ===================== MERCHANT APPLICATION OPERATIONS =====================

export const merchantApplicationOperations = {
  async create(data: Omit<MerchantApplication, 'id' | 'appliedAt' | 'status'>): Promise<MerchantApplication> {
    const db = getDb()
    const id = generateId()
    const application: MerchantApplication = {
      ...data,
      id,
      status: 'pending',
      appliedAt: nowTimestamp(),
    }
    await db.collection('merchantApplications').doc(id).set(application)
    return application
  },

  async findMany(options?: { status?: string }): Promise<MerchantApplication[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('merchantApplications')

    if (options?.status && options.status !== 'all') {
      query = query.where('status', '==', options.status)
    }

    const snapshot = await query.limit(100).get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MerchantApplication))
    results.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    return results
  },

  async findByUser(userId: string): Promise<MerchantApplication[]> {
    const db = getDb()
    const snapshot = await db.collection('merchantApplications')
      .where('userId', '==', userId)
      .limit(10)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MerchantApplication))
    results.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    return results
  },

  async findById(id: string): Promise<MerchantApplication | null> {
    const db = getDb()
    const doc = await db.collection('merchantApplications').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as MerchantApplication
  },

  async update(id: string, data: Partial<MerchantApplication>): Promise<MerchantApplication> {
    const db = getDb()
    await db.collection('merchantApplications').doc(id).update(data)
    const doc = await db.collection('merchantApplications').doc(id).get()
    return { id: doc.id, ...doc.data() } as MerchantApplication
  },

  async approve(id: string, reviewedBy: string): Promise<MerchantApplication> {
    const db = getDb()
    await db.collection('merchantApplications').doc(id).update({
      status: 'approved',
      reviewedBy,
      reviewedAt: nowTimestamp(),
      rejectionReason: null,
    })
    const doc = await db.collection('merchantApplications').doc(id).get()
    return { id: doc.id, ...doc.data() } as MerchantApplication
  },

  async reject(id: string, reviewedBy: string, rejectionReason: string): Promise<MerchantApplication> {
    const db = getDb()
    await db.collection('merchantApplications').doc(id).update({
      status: 'rejected',
      reviewedBy,
      reviewedAt: nowTimestamp(),
      rejectionReason,
    })
    const doc = await db.collection('merchantApplications').doc(id).get()
    return { id: doc.id, ...doc.data() } as MerchantApplication
  },
}

// ===================== P2P ORDER OPERATIONS =====================

export const p2pOrderOperations = {
  async create(data: Omit<P2POrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<P2POrder> {
    const db = getDb()
    const id = generateId()
    const now = nowTimestamp()
    const order: P2POrder = { ...data, id, createdAt: now, updatedAt: now }
    await db.collection('p2pOrders').doc(id).set(order)
    return order
  },

  async findOpen(filters?: { type?: string; network?: string }): Promise<P2POrder[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('p2pOrders')
      .where('status', '==', 'open')
      .limit(100)

    const snapshot = await query.get()
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as P2POrder))

    // Filter additional fields in JS to avoid composite index requirements
    if (filters?.type) {
      results = results.filter((o) => o.type === filters.type)
    }
    if (filters?.network) {
      results = results.filter((o) => o.network === filters.network)
    }

    // Filter out expired orders
    const now = new Date()
    results = results.filter((o) => new Date(o.expiresAt) >= now)

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findById(id: string): Promise<P2POrder | null> {
    const db = getDb()
    const doc = await db.collection('p2pOrders').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as P2POrder
  },

  async findMerchantOrders(merchantId: string): Promise<P2POrder[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pOrders')
      .where('merchantId', '==', merchantId)
      .limit(100)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as P2POrder))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findBuyerOrders(buyerId: string): Promise<P2POrder[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pOrders')
      .where('buyerId', '==', buyerId)
      .limit(100)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as P2POrder))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async updateStatus(id: string, status: P2POrder['status'], extra?: Partial<P2POrder>): Promise<P2POrder> {
    const db = getDb()
    const updateData: Partial<P2POrder> = { status, updatedAt: nowTimestamp() }
    if (extra) Object.assign(updateData, extra)
    await db.collection('p2pOrders').doc(id).update(updateData)
    const doc = await db.collection('p2pOrders').doc(id).get()
    return { id: doc.id, ...doc.data() } as P2POrder
  },

  async findDisputedOrders(): Promise<P2POrder[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pOrders')
      .where('status', '==', 'disputed')
      .limit(100)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as P2POrder))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async findMany(options?: { status?: string }): Promise<P2POrder[]> {
    const db = getDb()
    let query: Query<DocumentData> = db.collection('p2pOrders')

    if (options?.status && options.status !== 'all') {
      query = query.where('status', '==', options.status)
    }

    query = query.limit(200)
    const snapshot = await query.get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as P2POrder))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },
}

// ===================== P2P DISPUTE OPERATIONS =====================

export const p2pDisputeOperations = {
  async create(data: Omit<P2PDispute, 'id' | 'createdAt' | 'status'>): Promise<P2PDispute> {
    const db = getDb()
    const id = generateId()
    const dispute: P2PDispute = {
      ...data,
      id,
      status: 'open',
      createdAt: nowTimestamp(),
    }
    await db.collection('p2pDisputes').doc(id).set(dispute)
    return dispute
  },

  async findByOrder(orderId: string): Promise<P2PDispute[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pDisputes')
      .where('orderId', '==', orderId)
      .limit(20)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as P2PDispute))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },

  async update(id: string, data: Partial<P2PDispute>): Promise<P2PDispute> {
    const db = getDb()
    await db.collection('p2pDisputes').doc(id).update(data)
    const doc = await db.collection('p2pDisputes').doc(id).get()
    return { id: doc.id, ...doc.data() } as P2PDispute
  },

  async findOpen(): Promise<P2PDispute[]> {
    const db = getDb()
    const snapshot = await db.collection('p2pDisputes')
      .where('status', '==', 'open')
      .limit(100)
      .get()
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as P2PDispute))
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  },
}
