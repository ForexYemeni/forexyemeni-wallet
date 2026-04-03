const SECRET = 'fxwallet2024'

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.secret !== SECRET) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid secret'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!data.to || !data.subject || !data.html) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing fields'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var options = {
      to: data.to,
      subject: data.subject,
      htmlBody: data.html,
      name: 'ForexYemeni Wallet'
    };

    MailApp.sendEmail(options);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Email sent to ' + data.to
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'active',
    service: 'ForexYemeni Email',
    version: '2.0'
  })).setMimeType(ContentService.MimeType.JSON);
}

// === اختبار السكربت ===
// اضغط زر Run > runTest من القائمة المنسدلة ثم اضغط Run
// يجب تظهر لك رسالة نجاح في السجل
function runTest() {
  var options = {
    to: Session.getActiveUser().getEmail(),
    subject: 'اختبار - ForexYemeni Email Service',
    htmlBody: '<h1>السكربت يعمل بنجاح ✅</h1><p>هذه رسالة اختبار من خدمة فوركس يمني</p>',
    name: 'ForexYemeni Wallet'
  };
  MailApp.sendEmail(options);
  Logger.log('Test email sent successfully to ' + Session.getActiveUser().getEmail());
}
