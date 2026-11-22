<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Exceptions\Auth\WrongCurrentPasswordException;
use App\Exceptions\UserNotFoundException;
use App\Models\Session;
use App\Models\User;
use App\Support\Logging\StructuredLog;
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
     * 新しいパスワードの形（8〜64文字・72バイトまで）は、Http の層（ChangePasswordRequest）で確かめてある。
     * 弱いところ：bcrypt の照合と保存（それぞれ数十ミリ秒）のあいだ、会員の行をロックしたまま。同じ会員の行を書くほかの処理（ログインの日時など）は待つ
     *
     * @throws WrongCurrentPasswordException 今のパスワードが違う（422）
     */
    public function changePassword(
        int $userId,
        #[\SensitiveParameter] string $currentPassword,
        #[\SensitiveParameter] string $newPassword,
        string $currentSessionId,
    ): void {
        // 会員の行をロックして読み、ロックしたまま今のパスワードを確かめる。2つの端末から同時に来ても、あとの方は前の方のコミットを待ち、
        // 新しいハッシュで確かめるので、前のパスワードを知るだけの人の変更は通らない。パスワードだけ変わって、ほかの端末が残る（またはその逆）こともない
        $deletedSessions = DB::transaction(function () use ($userId, $currentPassword, $newPassword, $currentSessionId): int {
            $user = User::query()->lockForUpdate()->find($userId) ?? throw new UserNotFoundException;
            if (! Hash::check($currentPassword, $user->password)) {
                throw new WrongCurrentPasswordException;
            }

            $user->update(['password' => $newPassword]);
            // 変えた端末の行を除くのは、念のため。すぐあとの LoginSession::renew() が前の番号の行を消すので、外からは違いが見えず、
            // テストでは確かめられない（renew() を外したときだけ効く）
            $deleted = Session::query()->ofUser($user->id)->exceptId($currentSessionId)->delete();
            // 表 password_reset_tokens は、メールアドレスが主キー（1人に1行）。条件が1つなので、Model を作らずにここで消す
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();

            return $deleted;
        });

        // 「急に全部の端末でログアウトされた」という問い合わせで、本人が変えたかを追えるようにする。パスワード・番号は書かない
        StructuredLog::info('auth.passwordChanged', ['userId' => $userId, 'deletedSessions' => $deletedSessions]);
    }
}
