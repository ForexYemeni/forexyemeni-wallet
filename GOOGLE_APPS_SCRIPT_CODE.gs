// ===================== Google Apps Script - ForexYemeni Email Service =====================
// This is a FREE email sending service using Google Apps Script
// It receives POST requests and sends emails via Gmail
//
// SETUP INSTRUCTIONS:
// 1. Go to https://script.google.com (make sure you're logged into Gmail)
// 2. Click "+ New Project"
// 3. Delete any code in the editor and paste ALL of this code
// 4. Click "Deploy" > "New deployment"
// 5. Click the gear icon next to "Select type" > choose "Web app"
// 6. Set:
//    - Description: ForexYemeni Email Service
//    - Execute as: Me (your email)
//    - Who has access: Anyone
// 7. Click "Deploy"
// 8. Copy the Web app URL
// 9. Add it to Vercel as GOOGLE_APPS_SCRIPT_URL
// 10. Set EMAIL_SECRET in Vercel to match the SECRET below
//
// IMPORTANT: First time you deploy, Google will ask for authorization.
// Click "Advanced" > "Go to project (unsafe)" > "Allow"

const SECRET = 'fxwallet2024' // Change this to match EMAIL_SECRET in Vercel

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents)

    // Verify secret to prevent unauthorized use
    if (data.secret !== SECRET) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Invalid secret' }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // Validate required fields
    if (!data.to || !data.subject || !data.html) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Missing required fields: to, subject, html' }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // Send the email
    GmailApp.sendEmail({
      to: data.to,
      subject: data.subject,
      htmlBody: data.html,
      name: 'فوركس يمني - ForexYemeni',
    })

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON)

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'ForexYemeni Email Service is running',
      version: '1.0'
    }))
    .setMimeType(ContentService.MimeType.JSON)
}
