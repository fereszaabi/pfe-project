<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
	<title>Verification Code</title>
	<style>
		body {
			margin: 0; padding: 0;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			background-color: #f1f5f9;
			color: #1e293b;
		}
		.wrapper {
			max-width: 520px;
			margin: 40px auto;
			background: #ffffff;
			border-radius: 12px;
			overflow: hidden;
			box-shadow: 0 4px 24px rgba(0,0,0,0.08);
		}
		.header {
			background-color: #f96f06;
			padding: 32px 40px;
			text-align: center;
		}
		.header h1 {
			margin: 0;
			color: #ffffff;
			font-size: 22px;
			font-weight: 700;
			letter-spacing: 0.5px;
		}
		.body {
			padding: 36px 40px;
		}
		.body p {
			margin: 0 0 16px;
			font-size: 15px;
			line-height: 1.6;
			color: #475569;
		}
		.code-box {
			margin: 28px 0;
			background: #f8fafc;
			border: 2px dashed #e2e8f0;
			border-radius: 10px;
			padding: 24px;
			text-align: center;
		}
		.code-box .label {
			font-size: 12px;
			font-weight: 600;
			letter-spacing: 1.5px;
			text-transform: uppercase;
			color: #94a3b8;
			margin-bottom: 10px;
		}
		.code-box .code {
			font-size: 42px;
			font-weight: 800;
			letter-spacing: 10px;
			color: #f96f06;
			font-family: 'Courier New', Courier, monospace;
		}
		.code-box .expiry {
			margin-top: 10px;
			font-size: 12px;
			color: #94a3b8;
		}
		.footer {
			padding: 20px 40px 32px;
			border-top: 1px solid #f1f5f9;
		}
		.footer p {
			margin: 0;
			font-size: 12px;
			color: #94a3b8;
			line-height: 1.6;
		}
	</style>
</head>
<body>
	<div class="wrapper">
		<div class="header">
			<h1>{{ config('app.name') }}</h1>
		</div>
		<div class="body">
			<p>Hello <strong>{{ $userName }}</strong>,</p>
			<p>Use the verification code below to complete your sign-in. It expires in <strong>10 minutes</strong>.</p>

			<div class="code-box">
				<div class="label">Your verification code</div>
				<div class="code">{{ $otp }}</div>
				<div class="expiry">Valid for 10 minutes</div>
			</div>

			<p>If you did not attempt to sign in, you can safely ignore this email. Your account remains secure.</p>
		</div>
		<div class="footer">
			<p>This is an automated message from {{ config('app.name') }}. Please do not reply to this email.</p>
		</div>
	</div>
</body>
</html>
