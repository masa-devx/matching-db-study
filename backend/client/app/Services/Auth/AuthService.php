<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Enums\AccountStatus;
use App\Models\User;

/**
 * ログインと、会員のアカウントが使える状態かの決まり（業務のまとまり Auth。docs/backend.md）。
 * HTTP を知らない。トークンもセッションも触らない（読むのは Middleware）
 */
final class AuthService
{
    /** その番号の会員のアカウントの状態。会員を探して User::accountStatus() に聞く。いない会員は null */
    public function userAccountStatus(int $userId): ?AccountStatus
    {
        return User::query()->find($userId)?->accountStatus();
    }

    /** その番号の会員が、メールアドレスを確認したか。会員を探して User::hasVerifiedEmail()（Laravel の MustVerifyEmail）に聞く。いない会員は false */
    public function hasUserVerifiedEmail(int $userId): bool
    {
        return User::query()->find($userId)?->hasVerifiedEmail() ?? false;
    }
}
