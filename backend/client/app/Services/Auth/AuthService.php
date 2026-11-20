<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Models\User;

/**
 * ログインと、会員のアカウントが使える状態かの決まり（業務のまとまり Auth。docs/backend.md）。
 * HTTP を知らない。トークンもセッションも触らない（読むのは Middleware）
 */
final class AuthService
{
    /** その番号の会員のアカウントが、使える状態か。会員を探して User::isAccountUsable() に聞く。いない会員は使えない */
    public function isUserAccountUsable(int $userId): bool
    {
        return User::query()->find($userId)?->isAccountUsable() ?? false;
    }
}
