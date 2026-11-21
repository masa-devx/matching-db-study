<?php

declare(strict_types=1);

namespace App\Exceptions\Auth;

use App\Enums\AccountStatus;
use App\Exceptions\BusinessException;

/**
 * パスワードは合っているが、アカウント停止・強制退会の会員なので、ログインさせない。API では 403 になる（bootstrap/app.php が、状態から文と code を決める）。
 * ログインの状態を作る前に投げる（03-how.md の M2）
 */
final class LoginRefusedException extends BusinessException
{
    public function __construct(public readonly AccountStatus $status = AccountStatus::Suspended)
    {
        parent::__construct($status->value);
    }
}
