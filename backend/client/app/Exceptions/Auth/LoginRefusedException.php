<?php

declare(strict_types=1);

namespace App\Exceptions\Auth;

use App\Exceptions\BusinessException;

/**
 * パスワードは合っているが、アカウント停止・強制退会の会員なので、ログインさせない。API では 403 になる（bootstrap/app.php）。
 * ログインの状態を作る前に投げる（03-how.md の M2）
 */
final class LoginRefusedException extends BusinessException
{
    /** @param  'login_suspended'|'login_banned'  $messageKey  lang/ja/errors.php のキー */
    public function __construct(public readonly string $messageKey = 'login_suspended')
    {
        parent::__construct($messageKey);
    }
}
