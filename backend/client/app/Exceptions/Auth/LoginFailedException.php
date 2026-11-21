<?php

declare(strict_types=1);

namespace App\Exceptions\Auth;

use App\Exceptions\BusinessException;

/**
 * ログインで、メールアドレスかパスワードが合わない。API では 401 になる（bootstrap/app.php）。
 * 分かっている不具合：要件は、どちらが違うかを教えない同じ文（FR-AUTH-011）。今は、レガシー版と同じく、違う文を返す
 */
final class LoginFailedException extends BusinessException
{
    /** @param  'login_unknown_email'|'login_wrong_password'  $messageKey  lang/ja/errors.php のキー */
    public function __construct(public readonly string $messageKey = 'login_unknown_email')
    {
        parent::__construct($messageKey);
    }
}
