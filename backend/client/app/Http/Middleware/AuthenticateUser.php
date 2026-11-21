<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\AccountStatus;
use App\Exceptions\Auth\AccountSuspendedException;
use App\Services\Auth\AuthService;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * ログインを確かめる。セッション（Sanctum の SPA 認証。D-027）から会員の番号を読み、その会員のアカウントが今も使える状態か（退会・停止・強制退会）を AuthService に聞く。
 * だめなら例外を投げるだけで、応答は bootstrap/app.php が作る。アカウント停止は AccountSuspendedException（401「このアカウントは停止されています」）、
 * ほかは AuthenticationException（401「ログインしてください」）。
 * よければ、会員の番号（users.id）を $request->attributes の LOGIN_USER_ID に載せる。Controller は loginUserId() で読む。
 * 認証の方式を替えるときは、このクラスの中身と Auth/AuthController だけを替える（Service は会員の番号だけを受け取る）
 */
final class AuthenticateUser
{
    /** ログインしている会員の番号を載せるキー。載せる所（ここ）と読む所（Controller::loginUserId()）で同じ文字を使う */
    public const string LOGIN_USER_ID = 'login_user_id';

    public function __construct(private readonly AuthService $authService) {}

    public function handle(Request $request, Closure $next): Response
    {
        $userId = $this->userIdFromSession();
        $status = $userId === null ? null : $this->authService->userAccountStatus($userId);
        if ($status === AccountStatus::Suspended) {
            throw new AccountSuspendedException;   // 停止されていることだけは知らせる（NFR-AUTH-001）
        }
        if ($userId === null || $status !== AccountStatus::Usable) {
            throw new AuthenticationException;     // ログインしていない・セッションが切れた・いない・退会・強制退会
        }

        $request->attributes->set(self::LOGIN_USER_ID, $userId);

        return $next($request);
    }

    /**
     * セッションに載っている会員の番号。ログインしていない・セッションが切れた・ログアウトしたときは null。
     * Laravel の id() は、中で user() を呼び、会員の行を1回読む（SessionGuard::id()）。そのあと AuthService がもう一度読む。
     * ガードの会員を Service に渡せば1回で済むが、Middleware が Model を、Service が Http の型を知ることになるので、2回のままにした（03-how.md の DB）
     */
    private function userIdFromSession(): ?int
    {
        $id = Auth::guard('web')->id();

        return is_numeric($id) ? (int) $id : null;
    }
}
