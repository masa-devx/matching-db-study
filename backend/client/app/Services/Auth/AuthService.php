<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Enums\AccountStatus;
use App\Exceptions\Auth\LoginFailedException;
use App\Exceptions\Auth\LoginRefusedException;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * ログインと、会員のアカウントが使える状態かの決まり（業務のまとまり Auth。docs/backend.md）。
 * HTTP を知らない。トークンもセッションも触らない（読むのは Middleware）
 */
final class AuthService
{
    /**
     * ないメールアドレスのときに照合する、決まったハッシュ（乱数の文字のハッシュで、だれのパスワードでもない）。
     * 照合を飛ばさずに同じ時間をかける（NFR-AUTH-002）。Hash::make() にしないのは、NUL の文字の入ったパスワードで例外になり、
     * 「ないメールアドレスは 500・あるメールアドレスは 401」と分かれて、登録されているかが分かるため
     */
    private const string HASH_FOR_UNKNOWN_EMAIL = '$2y$12$mTXdybZg30DNCF00q0drbuZp92vxvVusJJdp4zDCij2MfIaHordtu';

    /**
     * メールアドレスとパスワードを照合し、ログインしてよい会員を返す。最終ログインの日時（検索の並び）も残す。
     * ログインの状態（セッション）は作らない。作るのは Controller（Auth/AuthController）。
     * 使える状態かは、Middleware と同じ User::accountStatus() の1か所で決める
     *
     * @throws LoginFailedException メールアドレスかパスワードが合わない・退会した会員（401）
     * @throws LoginRefusedException アカウント停止・強制退会（403）
     */
    public function login(string $email, #[\SensitiveParameter] string $password): User
    {
        $user = User::query()->where('email', $email)->first();
        if ($user === null) {
            Hash::check($password, self::HASH_FOR_UNKNOWN_EMAIL);
            throw new LoginFailedException('login_unknown_email');
        }
        if (! Hash::check($password, $user->password)) {
            throw new LoginFailedException('login_wrong_password');
        }
        $status = $user->accountStatus();
        if ($status === AccountStatus::Withdrawn) {
            // 退会した会員は、いない会員と同じに扱う（退会の API はメールアドレスを書き換えるので、ふつうはここに来ない）
            throw new LoginFailedException('login_unknown_email');
        }
        if ($status !== AccountStatus::Usable) {
            throw new LoginRefusedException($status);
        }

        $user->last_login_at = now();
        $user->save();

        return $user;
    }

    /** その番号の会員のアカウントの状態。会員を探して User::accountStatus() に聞く。いない会員は null */
    public function userAccountStatus(int $userId): ?AccountStatus
    {
        return User::query()->find($userId)?->accountStatus();
    }

    /** その番号の会員が、メールアドレスを確認したか。会員を探して User::hasVerifiedEmail()（Laravel の MustVerifyEmail）に聞く。いない会員は false */
    public function hasUserVerifiedEmail(int $userId): bool
    {
        return User::query()->find($userId)?->hasVerifiedEmail() ?? false;
    }
}
