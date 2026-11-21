<?php

declare(strict_types=1);

namespace App\Exceptions\Auth;

use App\Exceptions\BusinessException;

/**
 * メールアドレスを確認していない会員が、確認が要る API を呼んだ（FR-AUTH-021・不変条件 2）。
 * API では 403「この機能は使えません」と code「email_unverified」になる（bootstrap/app.php）。文は理由を言わず、画面は code で見分ける
 */
final class EmailUnverifiedException extends BusinessException {}
