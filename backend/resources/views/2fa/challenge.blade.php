<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8"/>
	<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
	<title>Two-Factor Verification — {{ config('app.name') }}</title>
	<style>
		* { box-sizing: border-box; }
		body {
			margin: 0; padding: 0;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			background-color: #0f172a;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.card {
			background: #ffffff;
			border-radius: 16px;
			padding: 40px;
			width: 100%;
			max-width: 400px;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
		}
		.icon {
			width: 56px; height: 56px;
			background: #f96f06;
			border-radius: 50%;
			display: flex; align-items: center; justify-content: center;
			margin: 0 auto 20px;
			font-size: 24px;
		}
		h1 {
			margin: 0 0 6px;
			font-size: 22px;
			font-weight: 700;
			color: #1e293b;
			text-align: center;
		}
		.subtitle {
			text-align: center;
			color: #64748b;
			font-size: 14px;
			margin-bottom: 28px;
		}
		@if (session('info'))
		.info-box {
			background: #eff6ff;
			border: 1px solid #bfdbfe;
			border-radius: 8px;
			padding: 10px 14px;
			font-size: 13px;
			color: #1d4ed8;
			margin-bottom: 18px;
		}
		@endif
		.error-box {
			background: #fef2f2;
			border: 1px solid #fecaca;
			border-radius: 8px;
			padding: 10px 14px;
			font-size: 13px;
			color: #dc2626;
			margin-bottom: 18px;
		}
		label {
			display: block;
			font-size: 13px;
			font-weight: 600;
			color: #374151;
			margin-bottom: 6px;
		}
		input[type="text"] {
			width: 100%;
			padding: 12px 16px;
			border: 1.5px solid #d1d5db;
			border-radius: 8px;
			font-size: 22px;
			font-weight: 700;
			text-align: center;
			letter-spacing: 8px;
			color: #1e293b;
			outline: none;
			transition: border-color .2s;
		}
		input[type="text"]:focus { border-color: #f96f06; }
		button[type="submit"] {
			margin-top: 20px;
			width: 100%;
			padding: 13px;
			background: #f96f06;
			color: #fff;
			font-size: 15px;
			font-weight: 600;
			border: none;
			border-radius: 8px;
			cursor: pointer;
			transition: background .2s;
		}
		button[type="submit"]:hover { background: #e06005; }
		.resend {
			margin-top: 16px;
			text-align: center;
			font-size: 13px;
			color: #64748b;
		}
		.resend a {
			color: #f96f06;
			text-decoration: none;
			font-weight: 600;
		}
		.resend a:hover { text-decoration: underline; }
	</style>
</head>
<body>
	<div class="card">
		<div class="icon">🔐</div>
		<h1>Verify Your Identity</h1>
		<p class="subtitle">Enter the 6-digit code sent to your email.</p>

		@if (session('info'))
			<div class="info-box">{{ session('info') }}</div>
		@endif

		@if ($errors->any())
			<div class="error-box">{{ $errors->first() }}</div>
		@endif

		<form method="POST" action="{{ route('2fa.verify') }}">
			@csrf
			<label for="otp">Verification Code</label>
			<input
				type="text"
				id="otp"
				name="otp"
				maxlength="6"
				inputmode="numeric"
				pattern="\d{6}"
				placeholder="——————"
				autofocus
				required
			/>
			<button type="submit">Verify</button>
		</form>

		<div class="resend">
			Didn't receive the code?
			<a href="{{ route('2fa.resend') }}">Resend</a>
		</div>
	</div>
</body>
</html>
