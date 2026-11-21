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
     * メールアドレスとパスワードを照合し、ログインしてよい会員を返す。最終ログインの日時（検索の並び）も残す。
     * ログインの状態（セッション）は作らない。作るのは Controller（Auth/AuthController）
     *
     * @throws LoginFailedException メールアドレスかパスワードが合わない（401）
     * @throws LoginRefusedException アカウント停止・強制退会（403）
     */
    public function login(string $email, string $password): User
    {
        $user = User::query()->where('email', $email)->first();
        if ($user === null) {
            // ないメールアドレスでも、照合と同じくらいの時間をかける（返るまでの時間で、登録されているかを見分けられないように。NFR-AUTH-002）
            Hash::make($password);
            throw new LoginFailedException('login_unknown_email');
        }
        if (! Hash::check($password, $user->password)) {
            throw new LoginFailedException('login_wrong_password');
        }
        if ($user->suspended_at !== null) {
            throw new LoginRefusedException('login_suspended');
        }
        if ($user->banned_at !== null) {
            throw new LoginRefusedException('login_banned');
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
