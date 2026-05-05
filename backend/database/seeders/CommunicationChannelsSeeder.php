<?php

namespace Database\Seeders;

use App\Models\CommunicationChannel;
use Illuminate\Database\Seeder;

class CommunicationChannelsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create default communication channels
        $channels = [
            [
                'name' => 'web',
                'display_name' => 'Web Chat',
                'enabled' => true,
                'description' => 'Live chat directly in the web application',
                'config' => [],
            ],
            [
                'name' => 'email',
                'display_name' => 'Email',
                'enabled' => false,
                'description' => 'Communicate via email',
                'config' => [
                    'smtp_host' => env('MAIL_HOST', 'smtp.mailtrap.io'),
                    'smtp_port' => env('MAIL_PORT', 465),
                    'smtp_from' => env('MAIL_FROM_ADDRESS', 'support@company.com'),
                ],
            ],
            [
                'name' => 'whatsapp',
                'display_name' => 'WhatsApp',
                'enabled' => false,
                'description' => 'Communicate via WhatsApp Business API',
                'config' => [
                    'provider' => 'twilio', // or whatsapp-official
                    'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
                    'api_key' => env('WHATSAPP_API_KEY'),
                    'api_url' => 'https://graph.instagram.com/v18.0',
                ],
            ],
            [
                'name' => 'sms',
                'display_name' => 'SMS',
                'enabled' => false,
                'description' => 'Communicate via SMS/Text',
                'config' => [
                    'provider' => 'twilio', // or aws-sns
                    'api_key' => env('SMS_API_KEY'),
                    'api_secret' => env('SMS_API_SECRET'),
                    'from_number' => env('SMS_FROM_NUMBER'),
                ],
            ],
            [
                'name' => 'facebook',
                'display_name' => 'Facebook Messenger',
                'enabled' => false,
                'description' => 'Communicate via Facebook Messenger',
                'config' => [
                    'app_id' => env('FACEBOOK_APP_ID'),
                    'app_secret' => env('FACEBOOK_APP_SECRET'),
                    'page_access_token' => env('FACEBOOK_PAGE_ACCESS_TOKEN'),
                    'verify_token' => env('FACEBOOK_VERIFY_TOKEN'),
                ],
            ],
            [
                'name' => 'instagram',
                'display_name' => 'Instagram Direct Message',
                'enabled' => false,
                'description' => 'Communicate via Instagram DM',
                'config' => [
                    'app_id' => env('INSTAGRAM_APP_ID'),
                    'page_access_token' => env('INSTAGRAM_PAGE_ACCESS_TOKEN'),
                ],
            ],
            [
                'name' => 'telegram',
                'display_name' => 'Telegram',
                'enabled' => false,
                'description' => 'Communicate via Telegram bot',
                'config' => [
                    'bot_token' => env('TELEGRAM_BOT_TOKEN'),
                    'webhook_url' => env('APP_URL') . '/api/webhooks/telegram',
                ],
            ],
        ];

        foreach ($channels as $channel) {
            CommunicationChannel::firstOrCreate(
                ['name' => $channel['name']],
                $channel
            );
        }

        $this->command->info('Communication channels seeded successfully!');
    }
}
