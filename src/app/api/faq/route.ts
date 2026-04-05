import { NextRequest, NextResponse } from 'next/server'
import { faqBotOperations } from '@/lib/db-firebase'

// GET - Returns active FAQ items (for bot and user display)
export async function GET() {
  try {
    const items = await faqBotOperations.findMany({ activeOnly: true })
    return NextResponse.json({ success: true, items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST - actions: create, update, delete, search, get_bot_settings, update_bot_settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // === SEARCH FAQs (user action, no auth required) ===
    if (action === 'search') {
      const { query: searchQuery } = body
      if (!searchQuery || typeof searchQuery !== 'string') {
        return NextResponse.json({ success: false, message: 'كلمة البحث مطلوبة' }, { status: 400 })
      }

      const allItems = await faqBotOperations.findMany({ activeOnly: true })
      const normalizedQuery = searchQuery.toLowerCase().trim()

      // Score each FAQ item based on relevance
      const scored = allItems.map(item => {
        let score = 0

        // Exact question match
        if (item.question.toLowerCase().includes(normalizedQuery)) {
          score += 10
        }

        // Keyword match
        if (item.keywords && Array.isArray(item.keywords)) {
          const queryWords = normalizedQuery.split(/\s+/)
          for (const kw of item.keywords) {
            const normalizedKw = kw.toLowerCase()
            if (normalizedKw === normalizedQuery) {
              score += 8 // exact keyword match
            } else if (normalizedQuery.includes(normalizedKw)) {
              score += 5
            } else {
              for (const word of queryWords) {
                if (normalizedKw.includes(word)) {
                  score += 2
                }
              }
            }
          }
        }

        // Partial word match in question
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1)
        for (const word of queryWords) {
          if (item.question.toLowerCase().includes(word)) {
            score += 3
          }
        }

        return { item, score }
      })

      // Filter items with a score > 0, sort by score desc, take top 5
      const results = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.item)

      return NextResponse.json({ success: true, results })
    }

    // === GET BOT SETTINGS (public, no auth) ===
    if (action === 'get_bot_settings') {
      const settings = await faqBotOperations.getBotSettings()
      return NextResponse.json({ success: true, settings })
    }

    // === ADMIN ACTIONS (require userId) ===
    const { userId } = body
    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    // Verify admin (reuse pattern from other admin routes)
    const { userOperations } = await import('@/lib/db-firebase')
    const user = await userOperations.findUnique({ id: userId })
    if (!user || (user.role !== 'admin' && !(user.permissions && Object.values(user.permissions).some(v => v)))) {
      return NextResponse.json({ success: false, message: 'ليس لديك صلاحية' }, { status: 403 })
    }

    // === CREATE FAQ ===
    if (action === 'create') {
      const { question, keywords, answer, category, priority } = body
      if (!question || !answer || !category) {
        return NextResponse.json({ success: false, message: 'السؤال والإجابة والتصنيف مطلوبان' }, { status: 400 })
      }
      const validCategories = ['general', 'deposit', 'withdrawal', 'kyc', 'account', 'fees']
      if (!validCategories.includes(category)) {
        return NextResponse.json({ success: false, message: 'تصنيف غير صالح' }, { status: 400 })
      }
      const faq = await faqBotOperations.create({
        question,
        keywords: keywords || [],
        answer,
        category,
        isActive: true,
        priority: priority || 0,
      })
      return NextResponse.json({ success: true, faq })
    }

    // === UPDATE FAQ ===
    if (action === 'update') {
      const { faqId, question, keywords, answer, category, isActive, priority } = body
      if (!faqId) {
        return NextResponse.json({ success: false, message: 'معرف السؤال مطلوب' }, { status: 400 })
      }
      const updateData: Record<string, unknown> = {}
      if (question !== undefined) updateData.question = question
      if (keywords !== undefined) updateData.keywords = keywords
      if (answer !== undefined) updateData.answer = answer
      if (category !== undefined) updateData.category = category
      if (isActive !== undefined) updateData.isActive = isActive
      if (priority !== undefined) updateData.priority = priority

      const faq = await faqBotOperations.update(faqId, updateData)
      return NextResponse.json({ success: true, faq })
    }

    // === DELETE FAQ ===
    if (action === 'delete') {
      const { faqId } = body
      if (!faqId) {
        return NextResponse.json({ success: false, message: 'معرف السؤال مطلوب' }, { status: 400 })
      }
      await faqBotOperations.delete(faqId)
      return NextResponse.json({ success: true, message: 'تم حذف السؤال' })
    }

    // === UPDATE BOT SETTINGS (admin) ===
    if (action === 'update_bot_settings') {
      const { isEnabled, greeting } = body
      if (typeof isEnabled !== 'boolean') {
        return NextResponse.json({ success: false, message: 'حالة التفعيل مطلوبة' }, { status: 400 })
      }
      await faqBotOperations.updateBotSettings({
        isEnabled,
        greeting: greeting || 'مرحباً! كيف يمكنني مساعدتك اليوم؟',
      })
      return NextResponse.json({ success: true, message: 'تم تحديث إعدادات البوت' })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
