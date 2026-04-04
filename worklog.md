# Worklog - ForexYemeni Wallet Complete Rebuild

## Task ID: 1 - Full Rebuild of ForexYemeni Wallet as Next.js Application

### Work Task
Complete rebuild of the ForexYemeni Wallet application as a Next.js 16 app with RTL Arabic layout, dark crypto theme, email-based authentication, KYC verification, deposit/withdrawal functionality, and admin panel.

### Work Summary

#### 1. Database Schema (Prisma SQLite)
- Created comprehensive schema with 7 models: User, OtpCode, KYCRecord, Deposit, Withdrawal, Transaction, Notification
- All relationships properly defined with Prisma relations
- Database pushed and synced successfully

#### 2. API Routes (16 endpoints)
- **Auth**: `/api/auth/register`, `/api/auth/login`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`
- **KYC**: `/api/kyc/submit-phone`, `/api/kyc/verify-phone`, `/api/kyc/upload`
- **Operations**: `/api/deposits/create`, `/api/withdrawals/create`, `/api/transactions`, `/api/notifications`
- **Admin**: `/api/admin/users`, `/api/admin/deposits`, `/api/admin/withdrawals`, `/api/admin/kyc`
- All OTP codes returned in response for testing purposes
- Password hashing with bcryptjs
- Phone verification OTP sent to user's email (not SMS)

#### 3. State Management (Zustand)
- Created persisted auth store with user data, token, current screen, and pending registration state
- Persists auth state to localStorage for session persistence

#### 4. UI Components Built
- **Auth**: LoginForm, RegisterForm, ForgotPasswordForm (with OTP steps)
- **Wallet**: Dashboard (balance, quick actions, recent transactions), DepositForm, WithdrawForm, TransactionHistory
- **KYC**: KYCVerification (phone submit, OTP verify, document upload)
- **Settings**: SettingsPage (profile, password, notifications, about tabs), NotificationsPage
- **Admin**: AdminPanel (users, deposits, withdrawals, KYC management)
- **Layout**: AppLayout, BottomNav (mobile), Sidebar (desktop)

#### 5. Styling & Theme
- RTL Arabic layout with Tajawal font from Google Fonts
- Dark crypto theme with gold (#F0B90B) primary color
- Glassmorphism card effects
- Custom animations (fadeIn, slideUp, pulse-gold, shimmer)
- Custom scrollbar styling
- Status badge classes for pending/confirmed/rejected states
- Responsive design with mobile-first approach

#### 6. Key Features
- Email-only registration with OTP verification
- Password recovery flow via email OTP
- KYC phone verification sends OTP to user's email
- USDT TRC20 deposit with address display and copy
- Withdrawal with fee calculation (0.1%)
- Transaction history with filters
- Admin panel with user management, deposit/withdrawal approval, KYC review
- Bottom navigation for mobile, sidebar for desktop
- Sonner toast notifications
- Loading states and shimmer placeholders

#### 7. Images Generated
- Logo: `/public/logo.png` - Golden wallet icon
- Background: `/public/hero-bg.png` - Dark crypto geometric background

#### Current State
- Application is running successfully on port 3000
- All pages rendering correctly (200 responses)
- No runtime errors in dev server
- 5 lint warnings exist in `/upload/extracted/` directory (old code, not part of this project)

---
## Task ID: v1.2 - Withdrawal Methods Implementation
### Work Task
Implement withdrawal methods so users see them the same way as deposit methods. Add a `purpose` field to PaymentMethod, update all APIs, rebuild WithdrawForm with multi-method support, and filter deposits by purpose.

### Work Summary

#### 1. PaymentMethod Type (`/src/lib/db-firebase.ts`)
- Added `purpose: string` field to `PaymentMethod` interface with values: `'deposit' | 'withdrawal' | 'both'`
- Updated `findActive()` to accept optional `purpose` parameter that filters results in JS (includes methods where purpose matches or is 'both')

#### 2. Public API (`/src/app/api/payment-methods/route.ts`)
- Updated GET handler to accept `purpose` query parameter from URL and pass it to `findActive(purpose)`
- Changed import to include `NextRequest` for URL parsing

#### 3. Admin API (`/src/app/api/admin/payment-methods/route.ts`)
- Added `purpose: data.purpose || 'both'` to the create action body

#### 4. Admin Panel (`/src/components/admin/AdminPanel.tsx`)
- Added `purpose: 'deposit'` to form state, resetForm, and handleEdit
- Added `PURPOSE_LABELS` map with Arabic labels and emoji icons
- Added purpose selector dropdown in the add/edit dialog (before category selector)
- Added purpose badge display on each method card in the list

#### 5. WithdrawForm (`/src/components/wallet/WithdrawForm.tsx`) - Complete Rewrite
- Two-step flow: method selection → withdrawal details form
- Fetches methods with `?purpose=withdrawal` parameter
- Supports crypto withdrawals (wallet address input)
- Supports bank deposit withdrawals (beneficiary name + account number)
- Supports ATM/bank transfer withdrawals (recipient name, phone, network selection)
- Auto-detects single network options and pre-selects them via useEffect
- Parses comma-separated network strings for dropdown display
- Shows fee calculation (0.1%), balance check, and max amount button
- Includes warning info box with withdrawal guidelines
- Refreshes user balance after successful withdrawal submission

#### 6. DepositForm (`/src/components/wallet/DepositForm.tsx`)
- Updated fetchMethods to use `?purpose=deposit` parameter to only show deposit-purpose methods

#### Git Commit
- Committed and pushed as `v1.2: إضافة طرق سحب للمستخدمين بنفس نظام الإيداع`
- 6 files changed, 384 insertions(+), 87 deletions(-)

---
## Task ID: hotfix-1 - Client-Side Error Fix

### Work Task
Fix "Application error: a client-side exception has occurred" on forexyemeni-wallet.vercel.app after v1.5 deployment.

### Work Summary

#### Issues Found & Fixed:
1. **Missing `animate-scale-in` CSS animation** - The class was used in AdminPanel and WithdrawForm but never defined in globals.css. Added `@keyframes scaleIn` and `.animate-scale-in` class.

2. **Unsafe `JSON.parse` on permissions** - In login route, `JSON.parse(u.permissions)` would crash if `u.permissions` was an object instead of a string (could happen if Firestore auto-parses). Created safe `parsePermissions()` helper with try-catch that handles strings, objects, and null/undefined.

3. **`useEffect` dependency on derived variable** - AdminPanel used `effectiveActiveTab` (a computed value) in useEffect dependency array, which could cause unexpected re-renders. Changed to use `activeTab` state directly.

4. **Navigation missing for promoted users** - Sidebar and BottomNav only checked `user?.role === 'admin'` to show admin tab. Promoted users (with permissions but potentially different role) wouldn't see the admin navigation. Added `isAdmin` check that also considers permissions.

### Files Changed:
- `src/app/globals.css` - Added scaleIn animation
- `src/app/api/auth/login/route.ts` - Safe permissions parsing
- `src/components/admin/AdminPanel.tsx` - Fixed useEffect dependency
- `src/components/layout/Sidebar.tsx` - Show admin tab for promoted users
- `src/components/layout/BottomNav.tsx` - Show admin tab for promoted users

### Git Commit
- Committed and pushed as `hotfix: إصلاح خطأ العميل`

---
## Task ID: v1.6 - Major Feature Update

### Work Task
Comprehensive v1.6 update addressing multiple user-reported issues: deposit name duplication, KYC image upload errors, admin panel improvements, fee system, deposit/withdrawal flow overhauls, device auth simplification, and UI consistency.

### Work Summary

#### 1. Deposit Screen - Fixed Duplicate Name
- **DepositForm.tsx**: Changed subtitle display from `TYPE_LABELS[m.type]` to show contextual info:
  - bank_deposit: shows `m.accountName` (wallet name)
  - crypto: shows `m.network`
  - atm_transfer: shows `m.recipientName` or `m.network`

#### 2. KYC Image Upload - Fixed Firestore 1MB Limit
- **KYCVerification.tsx**: Reduced image compression parameters:
  - MAX_SIZE: 800 → 600 pixels
  - QUALITY: 0.7 → 0.5 (50% JPEG quality)
- This ensures base64 images stay well under the 1,048,487 byte Firestore document limit

#### 3. Admin Account - Excluded from User List
- **AdminPanel.tsx filteredUsers**: Already filters out ALL admin accounts (`u.role === 'admin'`)
- Action buttons (suspend/promote/delete) already hidden for admin accounts since they're excluded from the list

#### 4. Admin KYC - Rejection Reason + Image Error Handling
- **AdminPanel.tsx KYC tab**: 
  - Added KYC rejection dialog with textarea for reason
  - Added `onError` handler on images showing fallback "failed to load" message
  - Displays previous rejection notes on rejected records
- **Admin KYC API**: Already accepts `adminNote` parameter and sends notification to user

#### 5. Device Lock - Simplified Authorization
- **Login route**: When device not recognized, stores fingerprint in `pendingDeviceAuth` collection before locking account
- **Admin devices API**: `authorize` action checks `pendingDeviceAuth` first, auto-uses fingerprint without manual input
- **Admin device dialog**: Shows pending device info (name, fingerprint preview, time), single "Authorize" button (no manual fingerprint input)
- Admin just clicks "Authorize" - the system automatically uses the pending fingerprint from the user's last login attempt

#### 6. Admin Panel - Tabs Layout
- Changed from grid layout to horizontal scrollable flex layout
- Tabs now have consistent sizing with `whitespace-nowrap` and `flex-shrink-0`
- Active tab highlighted with gold border, inactive tabs have transparent border
- Better mobile experience with horizontal scrolling

#### 7. Admin Withdrawals - Wallet Name Display
- **WithdrawForm.tsx**: Passes `paymentMethodName` (wallet/method title) in withdrawal creation
- **Withdrawals API**: Stores `paymentMethodName` in withdrawal document
- **Admin withdrawals API**: Returns `paymentMethodName` field
- **AdminPanel withdrawals tab**: Shows wallet name in withdrawal details

#### 8. Fee System - Admin Configurable
- **System settings**: New `systemSettings/fees` Firestore document with `depositFee` and `withdrawalFee` percentage fields
- **GET /api/settings**: Returns current fee settings (creates defaults if not exists)
- **Admin settings API**: `update_fees` action to save new fee percentages
- **Admin settings panel**: Added "الرسوم" (Fees) section with deposit and withdrawal fee inputs
- **DepositForm**: Fetches fees from `/api/settings`, shows fee calculation in UI
- **WithdrawForm**: Fetches fees from `/api/settings`, uses dynamic fee instead of hardcoded 0.1%
- **Withdrawals create API**: Fetches fee from systemSettings instead of hardcoded 0.001

#### 9. Deposit 3-Stage Flow
- **DepositForm**: Mandatory screenshot upload with image compression, sent as base64
- **Deposits create API**: Requires `screenshot` field (returns error if missing)
- **Admin deposits API**: Added `reviewing` status between pending and confirmed
- **Admin deposits tab**: 
  - Status labels: pending→"تم استلام طلبك", reviewing→"طلبك قيد المراجعة", confirmed→"مؤكد"
  - Shows deposit screenshot with click-to-preview
  - "مراجعة" button → reviewing, "تأكيد" → confirmed, "رفض" → rejected
- **Notifications**: User notified at each status change

#### 10. Withdrawal 3-Stage Flow + User Confirmation
- **Admin withdrawals tab**: 
  - Status labels: pending→"معلق", approved→"تم قبول السحب", processing→"تم السحب", rejected→"مرفوض"
  - "رفع صورة الدفع" button for uploading payment proof (mandatory for completion)
  - Shows uploaded proof image in withdrawal details
- **Admin withdrawals API**: `processing` status with screenshot sets `pendingConfirmation` on user
- **User confirmation dialog**: Blocking overlay on app load when `pendingConfirmation` exists
  - Requires password entry to confirm receipt
  - API `/api/withdrawals/confirm-receipt` verifies password and clears flag
  - User cannot access any app feature until confirmed

#### 11. Store & Auth Updates
- **User interface**: Added `pendingConfirmation?: string | null` field
- **Store**: Added `pendingWithdrawalConfirmation` state with persistence
- **Login API**: Returns `pendingConfirmation` in user response

### New Files Created
- `/src/app/api/settings/route.ts` - Public fee settings API
- `/src/app/api/withdrawals/confirm-receipt/route.ts` - User receipt confirmation API

### Git Commit
- Committed and pushed as v1.6 tag
- 137 files changed, 1143 insertions(+), 347 deletions(-)

---
## Task ID: 3 - Admin Balance Adjustment & Merchant Management

### Work Task
Add balance adjustment (add/withdraw) and merchant status management to the admin panel, including UI controls, dialogs, and API support.

### Work Summary

#### 1. AdminPanel.tsx - AdminUser Interface
- Added `merchantId?: string | null` field to the `AdminUser` interface to track merchant status per user

#### 2. AdminPanel.tsx - Lucide Icons
- Added `Store` to the lucide-react imports for the merchant badge icon

#### 3. AdminPanel.tsx - State Variables
- Added 6 new state variables for balance adjustment and merchant removal dialogs:
  - `balanceDialogUser` / `balanceAmount` / `balanceAction` / `balanceLoading`
  - `removeMerchantDialogUser` / `removeMerchantLoading`

#### 4. AdminPanel.tsx - Handler Functions
- **`handleAdjustBalance`**: Sends `balanceAdjustment` (positive or negative) to `/api/admin/users` POST endpoint, validates amount, shows toast feedback, refreshes user list
- **`handleRemoveMerchant`**: Sends `merchantId: null` to `/api/admin/users` POST endpoint, with confirmation dialog, refreshes user list

#### 5. AdminPanel.tsx - User List Enhancements
- Added merchant badge (`Store` icon + "تاجر" label) next to user email when `u.merchantId` is set
- Added "إضافة رصيد" (Add Balance) button - green, main admin only
- Added "سحب رصيد" (Withdraw Balance) button - orange, main admin only
- Added "إزالة التاجر" (Remove Merchant) button - orange, main admin only, only for users with merchantId

#### 6. AdminPanel.tsx - Dialogs
- **Balance Adjustment Dialog**: Shows add/withdraw mode, current balance, amount input with USDT step, calculated post-operation balance, confirm/cancel buttons
- **Remove Merchant Confirmation Dialog**: Warning with AlertTriangle icon, explains P2P listing deletion, confirm/cancel buttons

#### 7. API Route - `/api/admin/users/route.ts`
- Updated POST handler to accept `balanceAdjustment` and `merchantId` parameters
- `balanceAdjustment`: When non-zero number provided, fetches current user balance, calculates new balance (max 0), updates in DB
- `merchantId`: When provided (including null), updates the merchantId field on user record

### Files Changed:
- `src/components/admin/AdminPanel.tsx` - ~190 lines added (state, handlers, badge, buttons, 2 dialogs)
- `src/app/api/admin/users/route.ts` - Updated POST handler with balanceAdjustment and merchantId support

---
## Task ID: 1 - PIN System Backend Implementation

### Work Task
Implement the PIN system backend for ForexYemeni Wallet. This includes PIN setup, verification, reset request flow, admin approval/rejection of reset requests, login integration (hasPin field), and withdrawal PIN verification.

### Work Summary

#### 1. New API: `/api/auth/set-pin` (POST)
- Accepts `userId` and `pin` (4-6 digits)
- Validates PIN format with regex `/^\d{4,6}$/`
- Hashes PIN with bcrypt (salt rounds: 10)
- Updates user's `pinHash` field in Firestore
- Sends success notification to user

#### 2. New API: `/api/auth/verify-pin` (POST)
- Accepts `userId` and `pin`
- Returns error with `hasPin: false` if user has no PIN set
- Verifies PIN against stored hash with `bcrypt.compare`
- Returns 401 if PIN is incorrect

#### 3. New API: `/api/auth/request-pin-reset` (POST + GET)
- **POST**: User requests PIN reset
  - Validates user exists and has a PIN
  - Checks rate limit: no re-request within 5 minutes (stored in `pendingPinReset` collection keyed by userId)
  - Creates pending reset request in `pendingPinReset` Firestore collection
  - Notifies user (info) and all admins (warning + push notification)
- **GET**: Admin checks pending requests
  - Without `userId` query param: returns all pending requests (sorted by requestedAt desc in JS to avoid composite index)
  - With `userId` query param: returns whether that user has a pending request

#### 4. Login Route Update (`/api/auth/login/route.ts`)
- Added `hasPin: !!u.pinHash` to `getUserResponse` function output
- Clients can check `!user.hasPin` and redirect to PIN setup screen

#### 5. Store Update (`/src/lib/store.ts`)
- Added `hasPin?: boolean` to `User` interface
- Updated `setAuth` screen routing logic: if user has no PIN (`!user.hasPin`), redirect to `'set-pin'` screen
- Priority: force-change-password > set-pin > admin > p2p > dashboard

#### 6. Admin Users Route Update (`/api/admin/users/route.ts`)
- Added `approvePinReset` and `rejectPinReset` to POST handler destructuring
- **Approve**: Deletes pendingPinReset document, clears user's `pinHash` (set to null), notifies user with success message
- **Reject**: Deletes pendingPinReset document, notifies user with rejection message
- Added imports for `notificationOperations` and `getDb`

#### 7. Withdrawal Create Route Update (`/api/withdrawals/create/route.ts`)
- Added `pin` to request body destructuring
- Added PIN verification flow before processing withdrawal:
  1. If user has no `pinHash` → returns 400 with `needsPin: true`
  2. If no `pin` provided → returns 400 with `needsPin: true`
  3. Verifies PIN with `bcrypt.compare` → returns 401 if incorrect

### Files Changed:
- `src/app/api/auth/set-pin/route.ts` - **NEW** - PIN setup endpoint
- `src/app/api/auth/verify-pin/route.ts` - **NEW** - PIN verification endpoint
- `src/app/api/auth/request-pin-reset/route.ts` - **NEW** - PIN reset request + admin list endpoint
- `src/app/api/auth/login/route.ts` - Added `hasPin` to user response
- `src/lib/store.ts` - Added `hasPin` to User interface, updated screen routing
- `src/app/api/admin/users/route.ts` - Added PIN reset approve/reject handling
- `src/app/api/withdrawals/create/route.ts` - Added PIN verification before withdrawal

---
## Task ID: 2 - PIN System Frontend & Notification Enhancements

### Work Task
Implement the PIN system frontend components and admin notification enhancements for ForexYemeni Wallet, including PIN setup screen, withdrawal PIN verification dialog, and admin PIN reset management panel.

### Work Summary

#### 1. New Component: `/src/components/auth/SetPinScreen.tsx`
- Full-screen PIN setup component matching ForceChangePassword design pattern
- Gold gradient header with Shield icon and glow effect
- Title: "إعداد رمز الحماية (PIN)" with descriptive subtitle
- Two password inputs: PIN entry (4-6 digits) and confirm PIN
- Eye toggle for show/hide PIN visibility
- Real-time requirements checklist (4-6 digits ✓, match ✓) with Check/X icons
- Validation: regex `/^\d{4,6}$/` for PIN, equality check for confirmation
- Submit button calls POST `/api/auth/set-pin` with `{ userId, pin }`
- On success: updates auth state with `hasPin: true` and clears `mustChangePassword`
- Logout button at bottom (PIN is mandatory, no skip)
- Uses `glass-card`, `glass-input`, `gold-gradient`, `gold-text`, `animate-slide-up` theme classes

#### 2. Updated: `/src/app/page.tsx`
- Added dynamic import for `SetPinScreen` component (SSR disabled)
- Added routing: `if (isAuthenticated && currentScreen === 'set-pin') return <SetPinScreen />`
- Placed immediately after the force-change-password screen check

#### 3. Updated: `/src/components/wallet/WithdrawForm.tsx`
- Added `Shield` to lucide-react imports
- Added `setScreen` from `useAuthStore` (for redirecting to set-pin when needed)
- Added 3 new state variables: `showPinDialog`, `pinCode`, `pinLoading`
- **Refactored `handleSubmit`**: Now validates withdrawal data and shows PIN dialog instead of directly calling API
- **New `executeWithdrawal`**: Extracted the actual withdrawal API call into separate function, called after PIN verification
- **New `handlePinSubmit`**: 
  - Verifies PIN via POST `/api/auth/verify-pin`
  - If user has no PIN (`!hasPin`): redirects to `'set-pin'` screen via `setScreen`
  - If PIN incorrect: shows error toast
  - If PIN valid: calls `executeWithdrawal()`
- **PIN Dialog JSX**: Full-screen overlay (z-50) with glass-card design:
  - Shield icon with gold accent background
  - "أدخل رمز PIN" title with subtitle
  - Password input with centered, wide tracking text
  - Confirm button (disabled until 4+ digits)
  - Cancel button to dismiss dialog
  - Auto-focus on PIN input

#### 4. Updated: `/src/components/admin/AdminPanel.tsx`
- Added `pinResetRequests` state: `useState<any[]>([])`
- Added `fetchPinResetRequests` function: fetches pending requests from GET `/api/auth/request-pin-reset`
- Called in initial load alongside `fetchStats()` and `fetchUsers()`
- Added `handlePinResetAction` handler: sends approve/reject via POST `/api/admin/users`
- **PIN Reset Banner** in Users tab: Shown when `pinResetRequests.length > 0`
  - Orange-themed glass card with AlertTriangle icon
  - Shows count of pending requests in title
  - Lists up to 5 requests with user name/email and timestamp
  - Each request has "تصريح" (approve) and "رفض" (reject) buttons
  - Buttons disabled during loading state

#### 5. Updated: `/src/app/api/admin/users/route.ts`
- Added `sendPushNotification` import from `@/lib/push-notification`
- Added push notifications for PIN reset approval and rejection:
  - On approve: sends push "تم الموافقة على إعادة تعيين PIN" with instruction to set new PIN
  - On reject: sends push "تم رفض طلب إعادة تعيين PIN" with guidance to contact admin

### Files Changed:
- `src/components/auth/SetPinScreen.tsx` - **NEW** - PIN setup screen component
- `src/app/page.tsx` - Added import and routing for SetPinScreen
- `src/components/wallet/WithdrawForm.tsx` - Added PIN verification dialog and flow
- `src/components/admin/AdminPanel.tsx` - Added PIN reset request management
- `src/app/api/admin/users/route.ts` - Added push notifications for PIN reset actions

---
## Task ID: 3 - Comprehensive Notification System Completion

### Work Task
Add missing notifications across the ForexYemeni Wallet admin and user API routes. Ensure all critical actions (deposits, withdrawals, merchant applications, user management, KYC) trigger both in-app notifications and push notifications.

### Work Summary

#### Files Already Complete (No Changes Needed):
1. **`/api/deposits/create/route.ts`** — Already notifies admin about new deposits (in-app + push)
2. **`/api/admin/deposits/route.ts`** — Already has notifications for reviewing, confirmed, rejected (in-app + push)
3. **`/api/withdrawals/create/route.ts`** — Already notifies admin about new withdrawal requests (in-app + push)
4. **`/api/admin/withdrawals/route.ts`** — Already has notifications for approved, processing, rejected (in-app + push)
5. **`/api/admin/kyc/route.ts`** — Already has notifications for approved, rejected (in-app + push)

#### Files Modified:

**1. `/api/p2p/merchant/route.ts`** — Added admin notifications for new merchant applications
- Added imports: `sendPushNotification`, `getDb`
- After creating a merchant application (`action === 'apply'`), now queries all admin users via Firestore (`where('role', '==', 'admin')`) and sends:
  - In-app notification: "طلب تاجر جديد" (New merchant request) with applicant name
  - Push notification: same info via FCM
- Wrapped in try-catch to prevent notification failures from blocking the application flow

**2. `/api/admin/p2p/merchants/route.ts`** — Added push notifications for merchant approval/rejection
- Added import: `sendPushNotification`
- **Approve action**: Added push notification "تم قبول طلب التوثيق" with success type (in-app notification already existed)
- **Reject action**: Added push notification "تم رفض طلب التوثيق" with error type (in-app notification already existed)
- Both push notifications use `.catch(() => {})` to avoid blocking

**3. `/api/admin/users/route.ts`** — Added 4 new notification triggers
- **Account suspension** (`status === 'suspended'`): In-app + push notification "تم تعليق حسابك" (error type)
- **Account reactivation** (`status === 'active'`): In-app + push notification "تم تفعيل حسابك" (success type)
- **Balance adjustment** (`balanceAdjustment !== 0`): In-app + push notification showing add/withdraw amount and new balance (success/warning type)
- **Merchant removal** (`merchantId === null`): In-app + push notification "تم إزالة حالة التاجر" (warning type)
- All wrapped in try-catch to prevent notification failures from affecting the update operation
- Note: `sendPushNotification` and `notificationOperations` were already imported from previous PIN system work

### Files Changed:
- `src/app/api/p2p/merchant/route.ts` — Added admin notifications for new merchant applications (+20 lines)
- `src/app/api/admin/p2p/merchants/route.ts` — Added push notifications for merchant approve/reject (+2 lines)
- `src/app/api/admin/users/route.ts` — Added 4 notification triggers for user management (+53 lines)

---
## Task ID: 2 - Admin Audit, Reports, and Export API Routes

### Work Task
Create 3 new admin API routes for the ForexYemeni wallet: audit logging, financial reports, and CSV data export.

### Work Summary

#### 1. New API: `/api/admin/audit/route.ts` (GET + POST)
- **GET**: Returns audit log entries with optional filters
  - Query params: `adminId` (required), `actionType`, `targetType`, `targetId`, `fromDate`, `toDate`, `limit` (default 50, max 200)
  - Admin verification: checks user exists and is admin or main admin email
  - Date filtering done in JS to avoid Firestore composite index issues
  - Results sorted by `createdAt` descending
  - Returns: `{ success: true, logs: [...], total: number }`
- **POST**: Creates new audit log entry in `auditLog` Firestore collection
  - Body: `{ adminId, actionType, targetType, targetId, targetName, details, ipAddress }`
  - Validates `actionType` against 22 allowed types (user_suspend, deposit_approve, settings_change, etc.)
  - Auto-fills `adminName` and `adminEmail` from the admin user document
  - Uses `generateId()` for Firestore document IDs, `nowTimestamp()` for createdAt

#### 2. New API: `/api/admin/reports/route.ts` (GET)
- **GET**: Returns financial report data
  - Query params: `adminId` (required), `period`, `fromDate`, `toDate`
  - Default date range: last 7 days
  - Admin verification same as audit route
  - Fetches all deposits, withdrawals, and users (up to 1000 each) in parallel
  - Returns structured report:
    - `summary`: totalDeposits, totalWithdrawals, totalFees, netFlow, depositCount, withdrawalCount
    - `deposits`: array grouped by date with { date, total, count, fees }
    - `withdrawals`: array grouped by date with { date, total, count, fees }
    - `topUsers`: top 10 users by combined deposit+withdrawal activity
    - `dailyStats`: per-day breakdown with deposits, withdrawals, fees, netFlow, new users
  - Uses confirmed deposits and processing withdrawals for totals (matching existing stats route pattern)
  - All monetary values rounded to 2 decimal places

#### 3. New API: `/api/admin/export/route.ts` (GET)
- **GET**: Exports data as CSV with proper Arabic support
  - Query params: `adminId` (required), `type` (users, deposits, withdrawals, audit)
  - Admin verification same pattern
  - Max 1000 records per export
  - UTF-8 BOM (`\uFEFF`) prepended for Arabic character support in Excel
  - Content-Type: `text/csv; charset=utf-8`
  - Content-Disposition: `attachment; filename="export_[type]_[date].csv"`
  - CSV field escaping handles commas, quotes, and newlines
  - Arabic headers for all export types:
    - Users: المعرف, الاسم الكامل, البريد الإلكتروني, الهاتف, الدور, الحالة, الرصيد, تاريخ التسجيل, حالة KYC
    - Deposits: المعرف, معرف المستخدم, اسم المستخدم, المبلغ, الرسوم, المبلغ الصافي, الحالة, الشبكة, تاريخ الإنشاء
    - Withdrawals: المعرف, معرف المستخدم, اسم المستخدم, المبلغ, الرسوم, المبلغ الصافي, الحالة, الشبكة, عنوان الاستقبال, تاريخ الإنشاء
    - Audit: المعرف, اسم المسؤول, نوع الإجراء, نوع الهدف, اسم الهدف, التفاصيل, تاريخ الإنشاء

### Files Created:
- `src/app/api/admin/audit/route.ts` — Audit log API (GET + POST), ~155 lines
- `src/app/api/admin/reports/route.ts` — Financial reports API (GET), ~210 lines
- `src/app/api/admin/export/route.ts` — CSV export API (GET), ~175 lines

### Git Commit:
- Committed and pushed as `feat: add admin audit, reports, and export API routes`
- 3 files changed, 580 insertions(+)
