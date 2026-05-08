{{-- resources/views/auth/login.blade.php --}}
{{-- Replace your existing login view with this, or merge the CAPTCHA parts --}}

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login — {{ config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])

    {{-- Cloudflare Turnstile Script --}}
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">

<div class="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

    <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">
        Sign in to {{ config('app.name') }}
    </h1>

    {{-- Validation Errors --}}
    @if ($errors->any())
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            @foreach ($errors->all() as $error)
                <p class="text-sm text-red-600">{{ $error }}</p>
            @endforeach
        </div>
    @endif

    <form method="POST" action="{{ route('login.post') }}">
        @csrf

        {{-- Email --}}
        <div class="mb-4">
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                Email Address
            </label>
            <input
                id="email"
                type="email"
                name="email"
                value="{{ old('email') }}"
                required
                autofocus
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="you@example.com"
            />
        </div>

        {{-- Password --}}
        <div class="mb-6">
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                Password
            </label>
            <input
                id="password"
                type="password"
                name="password"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
            />
        </div>

        {{-- ✅ Cloudflare Turnstile CAPTCHA Widget --}}
        <div class="mb-6 flex justify-center">
            <div class="cf-turnstile"
                 data-sitekey="{{ config('services.turnstile.site') }}"
                 data-theme="light">
            </div>
        </div>

        @error('captcha')
            <p class="text-sm text-red-600 mb-4 text-center">{{ $message }}</p>
        @enderror

        {{-- Submit --}}
        <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200"
        >
            Sign In
        </button>

    </form>

</div>

</body>
</html>