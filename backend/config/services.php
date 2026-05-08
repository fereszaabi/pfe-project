<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'chatbot' => [
        'url' => env('CHATBOT_URL'),
        'api_key' => env('CHATBOT_API_KEY'),
        'timeout' => env('CHATBOT_TIMEOUT', 20),
    ],

    /*
    |--------------------------------------------------------------------------
    | Cloudflare Turnstile (CAPTCHA)
    |--------------------------------------------------------------------------
    | Get your keys at: https://dash.cloudflare.com/ → Turnstile
    | Add to your .env file:
    |   TURNSTILE_SITE_KEY=your_site_key
    |   TURNSTILE_SECRET_KEY=your_secret_key
    */
    'turnstile' => [
        'site'   => env('TURNSTILE_SITE_KEY'),
        'secret' => env('TURNSTILE_SECRET_KEY'),
    ],

];
