<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

/**
 * Laravel の CSRF の確かめ（ValidateCsrfToken）は、テストの中では飛ばす作り（runningUnitTests()）。
 * CSRF のテスト（FR-AUTH-018）だけは、飛ばさずに確かめたいので、この形に差し替える（config の sanctum.middleware.validate_csrf_token）
 */
final class ValidateCsrfTokenInTests extends ValidateCsrfToken
{
    protected function runningUnitTests(): bool
    {
        return false;
    }
}
