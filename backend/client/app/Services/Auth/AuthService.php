<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Models\User;

/**
 * ログインと、ログインしている会員が API を使えるかの決まり（業務のまとまり Auth。docs/backend.md）。
 * HTTP を知らない。トークンもセッションも触らない（読むのは Middleware）
 */
final class AuthService
{
    /** その会員が、今も API を使えるか。いない会員は使えない */
    public function canUseApi(int $userId): bool
    {
        return User::query()->find($userId)?->isUsable() ?? false;
    }
}
