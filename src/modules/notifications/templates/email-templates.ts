export interface NotificationEmailData {
  title: string;
  body: string;
  actionUrl?: string;
  appName: string;
}

export interface WelcomeEmailData {
  displayName: string;
  appName: string;
}

export const getNotificationEmailHtml = (data: NotificationEmailData): string => {
  const { title, body, actionUrl, appName } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #6366f1;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin-top: 20px;
    }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName}</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <p>${body}</p>
      ${actionUrl ? `<a href="${actionUrl}" class="button">View Details</a>` : ''}
    </div>
    <div class="footer">
      <p>You're receiving this email because you're a ${appName} user.</p>
      <p>&copy; 2025 ${appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

export const getWelcomeEmailHtml = (data: WelcomeEmailData): string => {
  const { displayName, appName } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${appName}!</h1>
    </div>
    <div class="content">
      <h2>Hi ${displayName},</h2>
      <p>Welcome to ${appName}! We're excited to have you on board.</p>
      <p>Start creating your wishlist and sharing it with friends and family!</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 ${appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};
