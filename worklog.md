---
Task ID: 1
Agent: Main
Task: Fix admin panel pending operations box to show breakdown of all pending types (deposits + withdrawals + KYC)

Work Log:
- Analyzed AdminPanel.tsx to find the pending actions banner (lines 1249-1262)
- Found that the banner previously showed only a single total count and navigated only to 'deposits' tab
- Enhanced the banner to show a breakdown with three separate clickable buttons:
  - Green button for pending deposits (depositsPending + depositsReviewing)
  - Red button for pending withdrawals (withdrawalsPending + withdrawalsApproved)
  - Blue button for pending KYC (kycRecordsPending)
- Each button navigates to its respective tab
- Verified that deposit confirm dialog (Issue B) was already implemented with amount, fees, and PIN
- Verified that withdrawal receiving data (Issue C) was already formatted with structured display
- Built project successfully

Stage Summary:
- Admin pending actions banner now shows breakdown of all pending types
- The three issues from user's request: Issue A fixed (pending breakdown), Issue B already implemented, Issue C already implemented
- Build successful

---
Task ID: 1
Agent: general-purpose
Task: Implement maintenance mode blocking and registration toggle

Work Log:
- Read login API to understand current flow
- Added maintenance mode check before allowing login (admins and users with permissions bypass)
- Read registration API to understand current flow
- Added registration open/close check and maintenance mode check at start of registration

Stage Summary:
- Modified: src/app/api/auth/login/route.ts - Added maintenance mode blocking (lines 36-58)
- Modified: src/app/api/auth/register/route.ts - Added registration toggle and maintenance blocking (lines 11-34)

---
Task ID: 4-5
Agent: general-purpose
Task: Display announcements and support info to users

Work Log:
- Created public API for announcements (/api/announcements) - fetches maintenance doc, filters active+non-expired
- Created public API for support info (/api/support-info) - fetches email, phone, telegram, whatsapp from maintenance doc
- Created AnnouncementBanner component with auto-scroll every 5s, dismiss per announcement, type-based coloring
- Added support info section to user Settings (About tab) with clickable contact links (mailto:, tel:, external links)
- Integrated AnnouncementBanner into AppLayout above main page content

Stage Summary:
- Created: src/app/api/announcements/route.ts
- Created: src/app/api/support-info/route.ts
- Created: src/components/layout/AnnouncementBanner.tsx
- Modified: src/components/settings/Settings.tsx - Added support info section in About tab
- Modified: src/components/layout/AppLayout.tsx - Added AnnouncementBanner import and render
