/** Returns an HTML string for the OTP email. */
export function buildOtpEmailHtml(otp: string, expiryMinutes: number): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Portvilla OTP</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #fff;
                 border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .header { background: #1a1a2e; color: #fff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
    .body { padding: 32px; text-align: center; }
    .otp { display: inline-block; font-size: 36px; font-weight: 700;
           letter-spacing: 12px; color: #1a1a2e; background: #f0f0f0;
           padding: 16px 28px; border-radius: 8px; margin: 24px 0; }
    .note { font-size: 13px; color: #888; margin-top: 16px; }
    .footer { background: #f4f4f4; text-align: center; padding: 16px;
              font-size: 12px; color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Portvilla</h1></div>
    <div class="body">
      <p>Use the code below to complete your verification.</p>
      <div class="otp">${otp}</div>
      <p>This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
      <p class="note">If you did not request this code, you can safely ignore this email.</p>
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} Portvilla. All rights reserved.</div>
  </div>
</body>
</html>
  `.trim();
}
