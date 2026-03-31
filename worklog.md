# ForexYemeni Wallet - Round 2 Fixes Worklog

**File:** `/home/z/my-project/download/forexyemeni-wallet.html`
**Date:** 2025
**Lines:** ~2733 (was ~2591, +142 lines from additions)

## Summary of Changes

All 7 Round 2 fixes have been implemented. JavaScript syntax verified successfully.

---

### Fix 1: 3-Step Withdrawal Process (Processing → Approval → Mandatory Screenshot)

**Changes:**
- **`statusBadge()` function (line ~323):** Added `PROCESSING` status with blue info styling (`'bg-info/20 text-info'`, label: `'قيد المعالجة'`)
- **`renderAdminWithdrawals()` (line ~1719):** Added new "قيد المعالجة" filter button showing count of PROCESSING withdrawals
- **`renderAdminWithdrawalsList()` (line ~1735):**
  - PENDING withdrawals now show "⚙️ معالجة" (Start Processing) button + "❌ رفض" button
  - PROCESSING withdrawals now show "✅ موافقة وخصم" (Approve with screenshot) button + "❌ رفض" button
  - APPROVED/REJECTED withdrawals show no action buttons (as before)
  - Confirmation screenshot display retained for approved withdrawals
- **New `adminStartProcessing()` function (line ~1790):** Handles PENDING → PROCESSING transition with confirmation dialog and user notification
- **Modified `adminApproveWithdrawal()` function (line ~1813):** Now works on PROCESSING → APPROVED flow; requires screenshot capture via camera before confirmation; deducts balance and saves proof
- **`renderUserHistory()` (line ~891):** Withdrawal history items now carry `confirmScreenshot` and display it as "📸 إثبات التنفيذ" with a clickable thumbnail when available

### Fix 2: Fix "deduct 0.0" message in withdrawal approval

**Changes:**
- **`adminApproveWithdrawal()` function (line ~1813):** Changed variable from `var netAmount = w.net || 0` to `var wdAmount = w.amount || 0` (uses the actual requested withdrawal amount, not the net amount which could be 0)
- Confirmation message now explicitly states: "سيتم خصم X USDT من رصيد المستخدم"

### Fix 3: Merchant account conversion - Marketplace display

**Changes:**
- The existing `approveMerchant()` function (line ~2218) already correctly sets `user.role = 'MERCHANT'` and `user.merchantStatus = 'APPROVED'` - no changes needed
- **New `renderMerchantMarketplace()` function (line ~1281):** Added a marketplace section showing all approved merchants with their name, USDT balance, and transaction count
- **`renderUserMerchant()` (line ~1239):** Added `renderMerchantMarketplace(C)` call at the end of the merchant request form, so users can see approved merchants below the form

### Fix 4: Camera-only for phone/email change requests

**Status:** Already implemented - no changes needed.
The settings page (lines ~954-965) already only has camera buttons for phone change and email change sections. No file upload buttons exist in these sections.

### Fix 5: Block deposits/withdrawals without KYC approval

**Status:** Already implemented - verified correct behavior.
- `renderUserDeposit()` (line ~662-664): Already blocks non-KYC users with a message directing to the KYC page
- `renderUserWithdraw()` (line ~751-753): Already blocks non-KYC users with a similar message directing to the KYC page

### Fix 6: Fix admin users page overflow

**Changes:**
- **`renderAdminUsersList()` (line ~1550):** Added `overflow-hidden` class to user card divs to prevent content from overflowing outside card bounds

### Fix 7: DB Config - Full editability with Firebase connection test

**Changes:**
- **Complete rewrite of `renderAdminDbConfig()` (line ~2434):**
  - Individual input fields for each Firebase config property (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)
  - Fields are read-only by default (with visual opacity indicator)
  - Edit/Lock toggle button to switch between editable and read-only modes
  - Current connection status display (Project ID, API Key preview)
- **New `parseFirebaseConfigSnippet()` function (line ~2404):** Parses raw Firebase config code snippets (e.g., `const firebaseConfig = { ... };`) using regex patterns and key-quoting heuristics. Falls back to JSON.parse and `new Function()` for complex cases
- **New `applyDbConfigSnippet()` function (line ~2479):** Applies parsed snippet values to individual fields
- **New `getDbConfigFromFields()` function (line ~2507):** Reads config from individual input fields for test/save
- **Modified `testDbConnection()` (line ~2517):** Now reads from either the snippet textarea or individual fields; validates config before testing
- **Modified `pasteFromClipboard()` (line ~2496):** Now pastes into the snippet textarea instead of removed textarea
- Test Connection, Save, and Restore Default buttons retained with full functionality

---

## Syntax Verification

```bash
python3 -c "import re; f=open('forexyemeni-wallet.html','r'); html=f.read(); f.close(); scripts=list(re.finditer(r'<script>(.*?)</script>', html, re.DOTALL)); js=scripts[1].group(1); open('/tmp/check.js','w').write(js); print('OK', len(js))" && node --check /tmp/check.js
# Result: OK 210244
```

JavaScript syntax check passed successfully.

---

## Round 3 Fixes Worklog

**Date:** 2026-03-31
**Lines:** ~2837 (was ~2733, +104 lines from additions)

### Fix 1: Show complete withdrawal details in admin page ✅

**Changes:**
- **`renderAdminWithdrawalsList()` (~line 1776):** Complete rewrite of the copyableFields section
  - Bank transfers now show: Bank name, Account number (with copy button), Recipient name (with copy button), Account type
  - Crypto wallets now show: Network, Full address (with copy button + dedicated address box), Currency name
  - All fields displayed in a styled card with clear labels and copy buttons

### Fix 2: Add deposit approval proof (admin & merchant) ✅

**Changes:**
- **`approveDeposit()` (~line 1697):** Now requires camera screenshot capture before approving; saves as `d.approveProof`
- **`merchantApproveDeposit()` (~line 1356):** Same - requires camera screenshot before approving
- **`renderAdminDepositsList()` (~line 1674):** Shows both user receipt image AND admin approval proof image
- **`renderUserHistory()` (~line 891):** Deposit history items now carry `approveProof` and display it as "✅ إثبات تنفيذ الإيداع"
- Added `processorName` variable for showing who processed the deposit

### Fix 3: Delete user account when merchant approved ✅

**Changes:**
- **`approveMerchant()` (~line 2278):** Complete rewrite
  - Creates `merchantData` object with user's key info + merchant-specific fields
  - Deletes user from `users` array using `splice()`
  - Adds merchant to new `merchants` collection in Firestore
- **`appData` (~line 233):** Added `merchants: null` to data structure
- **`getUser()` (~line 274):** Now also searches `merchants` collection when user not found in `users`
- **`handleLogin()` (~line 416):** Now also checks `merchants` collection for login
- **`renderMerchantMarketplace()` (~line 1297):** Updated to use `merchants` collection instead of filtering `users`

### Fix 4: Merchant selection system for deposits/withdrawals ✅

**Changes:**
- **`renderUserDeposit()` (~line 683):** Added `<div id="dep-merchant-section"></div>` placeholder
- **`renderUserWithdraw()` (~line 796):** Added `<div id="wd-merchant-section"></div>` placeholder
- **New `renderDepMerchantSection()` (~line 707):** Renders merchant dropdown when merchants exist
- **New `renderWdMerchantSection()` (~line 841):** Renders merchant dropdown for withdraw page
- **`submitDeposit()` (~line 750):** Now saves `assignedMerchantId` from dropdown
- **`submitWithdraw()` (~line 852):** Now saves `assignedMerchantId` from dropdown
- **Admin deposits/withdrawals lists:** Show assigned merchant name with 🏪 icon

### Syntax Verification
```bash
node --check /tmp/check.js  # Result: PASSED (219164 chars)
```

---

## Security Improvements Worklog (Round 4)

**Date:** 2025
**Lines:** ~5000 (was ~4866, +134 lines from additions)

### Fix 1: SHA-256 Password Encryption (Pure JS, All Browsers) ✅

**Changes:**
- **`Security.sha256()` (~line 935):** Complete replacement of the browser-dependent `crypto.subtle.digestSync` implementation with a pure JavaScript SHA-256 algorithm
  - Uses `TextEncoder` for UTF-8 encoding with salt `'fy_salt_2024_secure'`
  - Full SHA-256 implementation with proper padding, message schedule, and compression
  - No browser API dependency - works synchronously in ALL browsers including Firefox, Safari, and older Chrome

### Fix 2: Brute Force Protection (Cross-device via Firestore) ✅

**Changes:**
- **`Security.checkBruteForce()` (~line 997):** Enhanced with Firestore cross-device tracking
  - First checks localStorage for fast client-side validation
  - Falls back to Firestore `loginAttempts/{phoneDocId}` collection when no local record exists
  - Syncs Firestore locks back to localStorage for offline protection
- **`Security.recordFailedAttempt()` (~line 1041):** Now saves attempts to both localStorage AND Firestore
- **`Security.clearAttempts()` (~line 1061):** Now clears from both localStorage AND Firestore

### Fix 3: Force Admin Password Change on First Login ✅

**Changes:**
- **`resetAdminPassword()` (~line 1208):** Fixed plaintext password storage
  - Line 1217: Changed `password: defaultAdminPass` → `password: Security.hashPassword(defaultAdminPass)` + added `passwordMustChange: true`
  - Line 1220: Changed `adminUser.password = defaultAdminPass` → `adminUser.password = Security.hashPassword(defaultAdminPass)`
- **`saveAdminSettings()` (~line 4730):** Changed `adminUser.password = adminPass` → `adminUser.password = Security.hashPassword(adminPass)`

### Fix 4: Hide Passwords from Admin View ✅

**Changes:**
- **Edit User Modal (~line 3241):** Replaced password text input (showing hashed password) with a "🔑 إعادة تعيين كلمة المرور" button
- **`saveEditUser()` (~line 3246):** Removed password saving logic (2 lines removed)
- **New `resetUserPassword()` (~line 3258):** Generates random password `Fy` + random chars, hashes it, sets `passwordMustChange: true`, notifies user, adds audit log

### Fix 5: Single Session Per Account ✅

**Changes:**
- **New session functions added to Security object (~line 1089-1119):**
  - `createSession(userId)`: Creates unique session ID, saves to localStorage + user record in DB
  - `validateSession(userId)`: Compares local session ID with stored session ID
  - `invalidateSession(userId)`: Removes session from localStorage + user record
- **`handleLogin()` (~line 1204):** Calls `Security.createSession(user.id)` after successful login
- **`handleForceChangePassword()` (~line 1324):** Calls `Security.createSession(user.id)` after password change
- **`logout()` (~line 1268-1270):** Saves `prevUserId` before clearing state, calls `Security.invalidateSession(prevUserId)`
- **`render()` (~line 864-873):** Added session validity check - logs out user if session doesn't match (logged in from another device)
- **`finishInit()` (~line 4845-4853):** Added 30-second interval that checks session validity and force-logs-out if invalidated

### Additional Fixes ✅

- **Auto-migration of plain text passwords** (~line 1170-1174): In `handleLogin()`, after matching user, checks if password is plain text (not a hash) and auto-migrates to SHA-256 hash
- **`addMerchantDirect()` (~line 4306):** Changed `password:pass` → `password:Security.hashPassword(pass)` + added `passwordMustChange:true`
- **`saveChangeMerchantPass()` (~line 4331-4334):** Changed to `Security.hashPassword(newPass)`, added `passwordMustChange:true`, removed actual password from notification text
- **`changePassword()` (~line 2166-2187):** Complete rewrite - now uses `Security.checkPassword()` and `Security.hashPassword()`, minimum length raised from 6 to 8 chars, adds audit log, sets `passwordMustChange:false`

### Syntax Verification
```bash
node --check /tmp/check.js  # Result: PASSED (439110 chars)
```

---

## SMS OTP Phone Verification (Round 5)

**Date:** 2025
**Lines:** ~5100 (was ~4930, +~170 lines from additions)

### Summary of Changes

Added Firebase Phone Auth OTP verification during registration to prevent fake/bot signups.

### Changes:

1. **Firebase Auth SDK (line 61):** Added `<script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js">` after Firestore SDK

2. **Firebase Auth Initialization (lines 119-126):** Added `auth` variable, OTP state variables (`_otpConfirmationResult`, `_otpPhoneVerified`, `_otpPhone`, `_otpTimer`, `_otpSeconds`)

3. **OTP Functions (lines 128-279):** Added 4 functions:
   - `getRecaptchaVerifier()`: Creates invisible reCAPTCHA verifier, dynamically injects container into DOM if missing
   - `sendOTP()`: Validates phone, checks duplicates, sends SMS via `auth.signInWithPhoneNumber()`, manages 60s countdown timer
   - `updateOtpTimer()`: Updates send button text with countdown
   - `verifyOTP()`: Confirms OTP code via `confirmationResult.confirm()`, shows success state, signs out temporary auth user

4. **Register Form UI (lines 1099-1109):** Replaced simple phone input with:
   - Phone input + "Send OTP" button side by side
   - Hidden OTP section that appears after sending: OTP input (6 digits, centered, tracking-widest) + Verify button
   - Status message area for success/error feedback

5. **handleRegister OTP Check (lines 1605-1617):** Added mandatory OTP verification check before registration:
   - Blocks registration if phone not verified
   - Detects if phone was changed after OTP was sent (invalidates verification)

6. **OTP State Cleanup (lines 1626-1630):** Resets all OTP state variables after successful registration

7. **Login reCAPTCHA Container (line 1079):** Added hidden `<div id="recaptcha-container-login">` for future phone verification during login

### Syntax Verification
```bash
node --check /tmp/check.js  # Result: PASSED (451763 chars)
```

---
Task ID: 1
Agent: Super Z
Task: تشخيص وإصلاح مشكلة إرسال البريد الإلكتروني (EmailJS OTP)

Work Log:
- فحص كود EmailJS في forexyemeni-wallet.html
- اكتشاف مشكلة: emailjs.init() كان يُستدعى بصيغة قديمة (init(publicKey) بدلاً من init({publicKey: ...}))
- تحسين معالجة الأخطاء مع رسائل مفصلة باللغة العربية حسب كود الخطأ
- إضافة فحص تحميل SDK قبل الاستخدام
- تحسين logging في console للمساعدة في التشخيص

Stage Summary:
- تم إصلاح emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY }) ليتوافق مع EmailJS v4
- تمت إضافة رسائل خطأ تفصيلية: 401/403 (مفتاح API), 400 (بيانات القالب), 402/429 (حد الرسائل), 422 (بريد غير مقبول)
- تم التحقق من بناء JavaScript بنجاح (450843 chars)
