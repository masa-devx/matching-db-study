<?php

declare(strict_types=1);

namespace App\Exceptions\Auth;

use App\Exceptions\BusinessException;

/**
 * パスワードを変えるときに送った今のパスワードが違う。API では 422「今のパスワードがちがいます」になる（bootstrap/app.php。FR-AUTH-033）
 */
final class WrongCurrentPasswordException extends BusinessException {}
