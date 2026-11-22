<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Exceptions\Auth\WrongCurrentPasswordException;
use App\Exceptions\UserNotFoundException;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * 会員のパスワードを変える決まり（業務のまとまり Auth。docs/backend.md）。HTTP を知らない。セッションも触らない
 */
final class PasswordService
{
    /**
     * 今のパスワードを確かめてから、新しいパスワードにする。保存するときに、Model の 'hashed' のキャストが bcrypt にする。
     * 分かっている不具合：新しいパスワードを確かめない（1文字でも通り、null なら NOT NULL の違反で 500。FR-AUTH-033・FR-AUTH-004）。
     * ほかの端末のセッションも、再設定用の文字も消さない（FR-AUTH-033）
     *
     * @throws WrongCurrentPasswordException 今のパスワードが違う（422）
     */
    public function changePassword(int $userId, #[\SensitiveParameter] string $currentPassword, #[\SensitiveParameter] ?string $newPassword): void
    {
        $user = User::query()->find($userId) ?? throw new UserNotFoundException;
        if (! Hash::check($currentPassword, $user->password)) {
            throw new WrongCurrentPasswordException;
        }

        $user->update(['password' => $newPassword]);
    }
}
