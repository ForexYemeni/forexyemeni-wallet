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
