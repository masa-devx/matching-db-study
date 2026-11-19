<?php

declare(strict_types=1);

namespace App\Exceptions\Users;

use App\Exceptions\BusinessException;

/** URL などで指した会員がいない。API では 404「会員が見つかりません」になる（bootstrap/app.php） */
final class UserNotFoundException extends BusinessException {}
