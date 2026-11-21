<?php

declare(strict_types=1);

namespace App\Services\Profile;

use App\Exceptions\UserNotFoundException;
use App\Models\User;

/**
 * 自分のアカウント（業務のまとまり Profile。docs/backend.md の移行の地図の「me」）。退会（DELETE /api/me）を移すときも、ここに置く
 */
final class AccountService
{
    /** 自分のアカウント（GET /api/me）。users の行をそのまま返す（返さない列は User の #[Hidden]） */
    public function showAccount(int $userId): User
    {
        return User::query()->find($userId) ?? throw new UserNotFoundException;
    }
}
