<?php

declare(strict_types=1);

namespace App\Exceptions;

/**
 * URL などで指した会員がいない。API では 404「会員が見つかりません」になる（bootstrap/app.php）。
 * プロフィール・いいね・トークなど、いくつもの業務のまとまりで使うので、まとまりのフォルダに入れず直下に置く。
 */
final class UserNotFoundException extends BusinessException {}
