<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Exceptions\Auth\WrongCurrentPasswordException;
use App\Exceptions\UserNotFoundException;
use App\Models\Session;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * 会員のパスワードを変える決まり（業務のまとまり Auth。docs/backend.md）。HTTP を知らない。
 * セッションの番号の作り直しは LoginSession（Http の層）。ここでは、表 sessions の行を消すだけ
 */
final class PasswordService
{
    /**
     * 今のパスワードを確かめてから、新しいパスワードにし、ほかの端末のセッションの行と、再設定用の文字を消す（FR-AUTH-033）。
     * 保存するときに、Model の 'hashed' のキャストが bcrypt にする。変えた端末（$currentSessionId）の行は残す。
     * 再設定用の文字を消すのは、前に届いた再設定のリンクから、パスワードを変え直されないようにするため。
     * 新しいパスワードの形（8〜64文字・72バイトまで）は、Http の層（ChangePasswordRequest）で確かめてある
     *
     * @throws WrongCurrentPasswordException 今のパスワードが違う（422）
     */
    public function changePassword(
        int $userId,
        #[\SensitiveParameter] string $currentPassword,
        #[\SensitiveParameter] string $newPassword,
        string $currentSessionId,
    ): void {
        $user = User::query()->find($userId) ?? throw new UserNotFoundException;
        if (! Hash::check($currentPassword, $user->password)) {
            throw new WrongCurrentPasswordException;
        }

        // パスワードだけ変わって、ほかの端末が残る（またはその逆）ことがないように、1つのトランザクションにする
        DB::transaction(function () use ($user, $newPassword, $currentSessionId): void {
            $user->update(['password' => $newPassword]);
            Session::query()->ofUser($user->id)->exceptId($currentSessionId)->delete();
            // 表 password_reset_tokens は、メールアドレスが主キー（1人に1行）。条件が1つなので、Model を作らずにここで消す
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();
        });
    }
}
