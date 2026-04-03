# Worklog - Email-Only Auth System Conversion

## Date: 2025-01-XX

## Changes Made to `forexyemeni-wallet-main/forexyemeni-wallet.html`

### 1. Registration Form - Email as Default Method
- **Line 1908**: Changed `_regMethod` default from `'phone'` to `'email'`
- **Line 1978**: Changed `reg-email-block` from `display:none` to `display:block`
- **Line 1988**: Changed `reg-phone-block` from no display style to `display:none`
- **Lines 1976-1977**: Swapped toggle button styles - email button now uses `emailActive` (blue, bold), phone button uses `phoneNormal` (transparent, muted)
- **Line 1999**: Changed `reg-pass-block` from `display:none` to `display:block`

### 2. toggleRegMethod() - Password Block Visibility
- **Lines 1923-1924**: Added `passBlock` show when email method is selected
- **Lines 1930-1931**: Added `passBlock` hide when phone method is selected

### 3. Login Form - Forgot Password Link
- **Line 1835**: Added "هل نسيت كلمة المرور؟" button below login submit form, calling `showForgotPassword()`

### 4. Forgot Password Functions (NEW)
- **Lines 3176-3339**: Added complete forgot password system with 4 functions:
  - `showForgotPassword()` - Renders modal with 3-step recovery flow
  - `sendForgotOtp()` - Sends OTP via `/api/send-otp` to user's email
  - `verifyForgotOtp()` - Verifies the 6-digit OTP code
  - `resetForgotPassword()` - Resets password after verification, sends notification email
- Uses Vercel serverless function `/api/send-otp` with Gmail SMTP
- Includes 60-second resend cooldown timer
- Validates email exists in users DB before sending OTP
- Audit log entry for password reset

### 5. Admin Email Login Support
- **Lines 2237-2252**: Updated `_isAdminPhone()` to also check admin email from settings and users array
- **Lines 2378-2390**: Updated admin login check to support email input - detects `@` in input, matches against admin users' email field

### Summary
All 10 edits applied successfully. The auth system now defaults to email-based registration with OTP verification, includes a complete forgot password recovery flow, and supports admin login via email address.
