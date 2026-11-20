<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\Auth\AuthService;
use Closure;
use DomainException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use UnexpectedValueException;

/**
 * ログインを確かめる。トークンを読み、その会員のアカウントが今も使える状態か（退会・停止・強制退会）を AuthService に聞く。
 * だめなら AuthenticationException を投げるだけで、応答は bootstrap/app.php が作る（401「ログインしてください」）。
 * よければ、会員の番号（users.id）を $request->attributes の login_user_id に載せる。Controller は loginUserId() で読む。
 * 認証は、今は JWT。セッションに替えるときは、このクラスの中身だけを替える（#259）
 */
final class AuthenticateUser
{
    public function __construct(private readonly AuthService $auth) {}

    public function handle(Request $request, Closure $next): Response
    {
        $userId = $this->userIdFromToken($request);
        if ($userId === null || ! $this->auth->isUserAccountUsable($userId)) {
            throw new AuthenticationException;
        }

        $request->attributes->set('login_user_id', $userId);

        return $next($request);
    }

    /** トークンがない・壊れている・署名が違う・期限が切れているときは null */
    private function userIdFromToken(Request $request): ?int
    {
        $token = $request->bearerToken();
        if ($token === null || $token === '') {
            return null;
        }

        try {
            $payload = JWT::decode($token, new Key(config()->string('app.key'), 'HS256'));
        } catch (UnexpectedValueException|DomainException) {
            // 壊れた・署名が違う・期限切れのトークンは、どれも「ログインしていない」と同じに扱う（FR-AUTH-013）。
            // 鍵がない（設定の誤り）ときの InvalidArgumentException は受け止めず、500 のままにする
            return null;
        }

        $sub = $payload->sub ?? null;

        return is_numeric($sub) ? (int) $sub : null;
    }
}
