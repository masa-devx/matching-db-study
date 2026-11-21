<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\AccountStatus;
use App\Exceptions\Auth\AccountSuspendedException;
use App\Services\Auth\AuthService;
use Closure;
use DomainException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use TypeError;
use UnexpectedValueException;

/**
 * ログインを確かめる。トークンを読み、その会員のアカウントが今も使える状態か（退会・停止・強制退会）を AuthService に聞く。
 * だめなら例外を投げるだけで、応答は bootstrap/app.php が作る。アカウント停止は AccountSuspendedException（401「このアカウントは停止されています」）、
 * ほかは AuthenticationException（401「ログインしてください」）。
 * よければ、会員の番号（users.id）を $request->attributes の LOGIN_USER_ID に載せる。Controller は loginUserId() で読む。
 * 認証は、今は JWT。セッションに替えるときは、このクラスの中身だけを替える（#259）
 */
final class AuthenticateUser
{
    /** ログインしている会員の番号を載せるキー。載せる所（ここ）と読む所（Controller::loginUserId()）で同じ文字を使う */
    public const string LOGIN_USER_ID = 'login_user_id';

    public function __construct(private readonly AuthService $auth) {}

    public function handle(Request $request, Closure $next): Response
    {
        $userId = $this->userIdFromToken($request);
        $status = $userId === null ? null : $this->auth->userAccountStatus($userId);
        if ($status === AccountStatus::Suspended) {
            throw new AccountSuspendedException;   // 停止されていることだけは知らせる（NFR-AUTH-001）
        }
        if ($userId === null || $status !== AccountStatus::Usable) {
            throw new AuthenticationException;     // トークンがない・壊れている・期限切れ・いない・退会・強制退会
        }

        $request->attributes->set(self::LOGIN_USER_ID, $userId);

        return $next($request);
    }

    /** トークンがない・壊れている・署名が違う・期限が切れている・形がおかしいときは null */
    private function userIdFromToken(Request $request): ?int
    {
        $token = $request->bearerToken();
        if ($token === null || $token === '') {
            return null;
        }

        try {
            $payload = JWT::decode($token, new Key(config()->string('app.key'), 'HS256'));
        } catch (UnexpectedValueException|DomainException|TypeError) {
            // 壊れた・署名が違う・期限切れのトークンは、どれも「ログインしていない」と同じに扱う（FR-AUTH-020）。
            // TypeError は、ヘッダーの alg や kid が配列のような、形のおかしいトークン（送った人の入力）で、署名を確かめる前に出る。
            // 鍵がない（設定の誤り）ときの InvalidArgumentException は受け止めず、500 のままにする
            return null;
        }

        $sub = $payload->sub ?? null;

        return is_numeric($sub) ? (int) $sub : null;
    }
}
