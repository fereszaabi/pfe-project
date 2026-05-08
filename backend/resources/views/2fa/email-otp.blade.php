{{-- resources/views/2fa/email-otp.blade.php --}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 40px 20px; }
        .card { background: #fff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 40px; }
        .logo { text-align: center; margin-bottom: 24px; font-size: 20px; font-weight: 700; color: #1d4ed8; }
        h1 { font-size: 22px; color: #111827; margin: 0 0 8px; }
        p { color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
        .otp-box { background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 10px; text-align: center; padding: 24px; margin: 24px 0; }
        .otp-code { font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #1d4ed8; font-family: monospace; }
        .otp-hint { font-size: 13px; color: #9ca3af; margin-top: 8px; }
        .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center; }
    </style>
</head>
<body>
<div class="card">

    <div class="logo">🔒 {{ config('app.name') }}</div>

    <h1>Verification Code</h1>
    <p>Hi <strong>{{ $userName }}</strong>,</p>
    <p>
        You or someone on your account is performing a sensitive action (creating or claiming a ticket).
        Use the code below to verify your identity.
    </p>

    <div class="otp-box">
        <div class="otp-code">{{ $otp }}</div>
        <div class="otp-hint">This code expires in <strong>10 minutes</strong></div>
    </div>

    <p>
        If you did not request this code, please ignore this email and consider
        changing your password immediately.
    </p>

    <div class="footer">
        This is an automated message from {{ config('app.name') }}.<br>
        Please do not reply to this email.
    </div>

</div>
</body>
</html>