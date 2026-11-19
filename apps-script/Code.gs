const GALLERY_FOLDER_ID = '1EgMhM8Y99zobIiXqA_Qg3q2JAr1kPpXU';
const NOTIFICATION_EMAIL = 'beit.halevi.6@gmail.com';
const MESSAGES_SHEET_NAME = 'הודעות מאתר ישיבת בית הלוי';
const DEFAULT_ONESIGNAL_APP_ID = '797cabf1-0a4b-45dc-a0d6-769d0c388882';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function doGet() {
  return json_({ status: 'alive' });
}

function setupBackend() {
  const folderName = DriveApp.getFolderById(GALLERY_FOLDER_ID).getName();
  const sheet = getMessagesSheet_();
  const mailQuota = MailApp.getRemainingDailyQuota();
  const fetchStatus = UrlFetchApp.fetch('https://www.google.com/generate_204', {
    muteHttpExceptions: true
  }).getResponseCode();

  return {
    success: true,
    folderName: folderName,
    spreadsheetId: sheet.getParent().getId(),
    mailQuota: mailQuota,
    fetchStatus: fetchStatus
  };
}

function doPost(e) {
  try {
    const data = JSON.parse(e && e.postData && e.postData.contents || '{}');
    let result;

    switch (data.action) {
      case 'submitContact':
        result = submitContact_(data);
        break;
      case 'uploadImage':
        authorize_(data);
        result = uploadImage_(data);
        break;
      case 'getMessages':
        authorize_(data);
        result = getMessages_();
        break;
      case 'sendPush':
        authorize_(data);
        result = sendPush_(data);
        break;
      case 'getOneSignalStats':
        authorize_(data);
        result = getOneSignalStats_();
        break;
      case 'getBingStats':
        authorize_(data);
        result = getBingStats_(data);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }

    return json_(result);
  } catch (error) {
    console.error(error && error.stack || error);
    return json_({ success: false, error: error.message || 'Request failed' });
  }
}

function submitContact_(data) {
  const name = cleanText_(data.name, 200);
  const email = cleanText_(data.email, 320);
  const message = cleanText_(data.message, 10000);
  if (!message) throw new Error('Message is required');

  const timestamp = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm:ss');
  getMessagesSheet_().appendRow([
    timestamp,
    safeCell_(name),
    safeCell_(email),
    safeCell_(message)
  ]);

  let notificationSent = false;
  try {
    const options = {
      to: NOTIFICATION_EMAIL,
      subject: 'הודעה חדשה מאתר ישיבת בית הלוי',
      body: [
        'התקבלה הודעה חדשה מטופס צור קשר באתר:',
        '',
        'תאריך ושעה: ' + timestamp,
        'שם מלא: ' + (name || 'לא צוין'),
        'אימייל: ' + (email || 'לא צוין'),
        '',
        'תוכן ההודעה:',
        message
      ].join('\n')
    };
    if (isValidEmail_(email)) options.replyTo = email;
    MailApp.sendEmail(options);
    notificationSent = true;
  } catch (error) {
    console.error('Contact notification email failed: ' + (error.message || error));
  }

  return { success: true, notificationSent: notificationSent };
}

function uploadImage_(data) {
  if (typeof data.base64 !== 'string' || !data.base64) throw new Error('Image data is required');
  if (data.base64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8) {
    throw new Error('Image exceeds the 8 MB limit');
  }

  const mimeType = cleanText_(data.mimeType || 'image/jpeg', 100);
  if (!/^image\/(jpeg|png|gif|webp)$/i.test(mimeType)) throw new Error('Unsupported image type');
  const bytes = Utilities.base64Decode(data.base64);
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds the 8 MB limit');

  const filename = cleanText_(data.filename || 'image.jpg', 200).replace(/[\\/:*?"<>|]/g, '_');
  const blob = Utilities.newBlob(bytes, mimeType, filename || 'image.jpg');
  const file = DriveApp.getFolderById(GALLERY_FOLDER_ID).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    success: true,
    fileId: file.getId(),
    viewUrl: 'https://lh3.googleusercontent.com/d/' + file.getId()
  };
}

function getMessages_() {
  const values = getMessagesSheet_().getDataRange().getDisplayValues();
  return { success: true, rows: values };
}

function getMessagesSheet_() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty('MESSAGES_SPREADSHEET_ID');
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    spreadsheetId = properties.getProperty('MESSAGES_SPREADSHEET_ID');
    if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId).getSheets()[0];

    const spreadsheet = SpreadsheetApp.create(MESSAGES_SHEET_NAME);
    const sheet = spreadsheet.getSheets()[0];
    sheet.setName('הודעות');
    sheet.appendRow(['תאריך ושעה', 'שם מלא', 'אימייל', 'תוכן ההודעה']);
    properties.setProperty('MESSAGES_SPREADSHEET_ID', spreadsheet.getId());
    return sheet;
  } finally {
    lock.releaseLock();
  }
}

function sendPush_(data) {
  const restKey = cleanText_(data.restKey, 500);
  const appId = cleanText_(data.appId || DEFAULT_ONESIGNAL_APP_ID, 100);
  const title = cleanText_(data.title, 200);
  const message = cleanText_(data.message, 4000);
  if (!restKey || !title || !message) throw new Error('Push notification settings are incomplete');

  const payload = {
    app_id: appId,
    headings: { en: title, he: title },
    contents: { en: message, he: message },
    url: 'https://yt2178.github.io/'
  };
  if (data.isUpdate) {
    payload.filters = [{ field: 'tag', key: 'subscribe_updates', relation: '=', value: 'true' }];
  } else {
    payload.included_segments = ['Subscribed Users'];
  }

  const response = UrlFetchApp.fetch('https://onesignal.com/api/v1/notifications', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Basic ' + restKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || result.errors) {
    throw new Error('OneSignal request failed: ' + (result.errors || response.getResponseCode()));
  }
  return { success: true, data: result };
}

function getOneSignalStats_() {
  const properties = PropertiesService.getScriptProperties();
  const restKey = properties.getProperty('ONESIGNAL_REST_API_KEY');
  if (!restKey) throw new Error('Set ONESIGNAL_REST_API_KEY in Script Properties to enable OneSignal statistics');

  const appId = properties.getProperty('ONESIGNAL_APP_ID') || DEFAULT_ONESIGNAL_APP_ID;
  const headers = { Authorization: 'Basic ' + restKey };
  const appResponse = UrlFetchApp.fetch('https://onesignal.com/api/v1/apps/' + encodeURIComponent(appId), {
    headers: headers,
    muteHttpExceptions: true
  });
  const notificationsResponse = UrlFetchApp.fetch(
    'https://onesignal.com/api/v1/notifications?app_id=' + encodeURIComponent(appId) + '&limit=5',
    { headers: headers, muteHttpExceptions: true }
  );
  const app = JSON.parse(appResponse.getContentText() || '{}');
  const notifications = JSON.parse(notificationsResponse.getContentText() || '{}');
  if (appResponse.getResponseCode() < 200 || appResponse.getResponseCode() >= 300) {
    throw new Error('OneSignal app statistics request failed');
  }
  if (notificationsResponse.getResponseCode() < 200 || notificationsResponse.getResponseCode() >= 300) {
    throw new Error('OneSignal notification statistics request failed');
  }
  return { success: true, app: app, notifications: notifications.notifications || [] };
}

function getBingStats_(data) {
  const apiKey = cleanText_(data.bingApiKey, 500);
  const siteUrl = cleanText_(data.siteUrl, 500);
  if (!apiKey || !siteUrl) throw new Error('Bing API key and site URL are required');

  const url = 'https://ssl.bing.com/webmaster/api.svc/json/GetRankAndTrafficStats?siteUrl=' +
    encodeURIComponent(siteUrl) + '&apikey=' + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const result = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || result.ErrorCode) {
    throw new Error('Bing statistics request failed');
  }
  return { success: true, d: result.d || [] };
}

function authorize_(data) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET');
  if (!expectedSecret) throw new Error('Set ADMIN_SECRET in Script Properties before using admin actions');
  if (!data.secret || data.secret !== expectedSecret) throw new Error('Unauthorized');
}

function cleanText_(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function safeCell_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
