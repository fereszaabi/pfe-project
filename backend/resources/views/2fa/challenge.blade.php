{{-- resources/views/2fa/challenge.blade.php --}}

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Required — {{ config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">

<div class="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

    {{-- Icon --}}
    <div class="flex justify-center mb-6">
        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
        </div>
    </div>

    <h1 class="text-2xl font-bold text-gray-800 mb-2 text-center">Verify Your Identity</h1>
    <p class="text-gray-500 text-sm text-center mb-6">
        A 6-digit code was sent to <strong>{{ auth()->user()->email }}</strong>.<br>
        Enter it below to continue.
    </p>

    {{-- Info / Success messages --}}
    @if (session('info'))
        <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            {{ session('info') }}
        </div>
    @endif

    {{-- Errors --}}
    @if ($errors->any())
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            @foreach ($errors->all() as $error)
                <p class="text-sm text-red-600">{{ $error }}</p>
            @endforeach
        </div>
    @endif

    {{-- OTP Form --}}
    <form method="POST" action="{{ route('2fa.verify') }}">
        @csrf

        <div class="mb-6">
            <label for="otp" class="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
            </label>
            <input
                id="otp"
                type="text"
                name="otp"
                inputmode="numeric"
                pattern="[0-9]{6}"
                maxlength="6"
                required
                autofocus
                autocomplete="one-time-code"
                class="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition font-mono"
                placeholder="000000"
            />
            <p class="text-xs text-gray-400 mt-1 text-center">Code expires in 10 minutes</p>
        </div>

        <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 mb-3"
        >
            Verify & Continue
        </button>

    </form>

    {{-- Resend --}}
    <form method="POST" action="{{ route('2fa.resend') }}">
        @csrf
        <button
            type="submit"
            class="w-full text-sm text-gray-500 hover:text-blue-600 transition py-2"
        >
            Didn't receive the code? <span class="underline font-medium">Resend</span>
        </button>
    </form>

</div>

</body>
</html>