<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });

        $this->renderable(function (Throwable $e, $request) {
            if (!$request->expectsJson()) {
                return null;
            }

            if ($e instanceof ValidationException) {
                return response()->json([
                    'ok' => false,
                    'message' => $e->getMessage(),
                    'errors' => $e->errors(),
                    'error' => [
                        'message' => $e->getMessage(),
                        'code' => 'validation_error',
                        'details' => $e->errors(),
                    ],
                ], $e->status);
            }

            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();

                return response()->json([
                    'ok' => false,
                    'message' => $e->getMessage() ?: 'Request failed',
                    'error' => [
                        'message' => $e->getMessage() ?: 'Request failed',
                        'code' => (string) $status,
                        'details' => [],
                    ],
                ], $status);
            }

            return response()->json([
                'ok' => false,
                'message' => 'Server error',
                'error' => [
                    'message' => $e->getMessage(),
                    'code' => 'server_error',
                    'details' => [],
                ],
            ], 500);
        });
    }
}
