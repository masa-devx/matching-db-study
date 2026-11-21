<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\Auth\EmailUnverifiedException;
use App\Services\Auth\AuthService;
use Closure;
use Illuminate\Http\Request;
use LogicException;
use Symfony\Component\HttpFoundation\Response;

/**
 * ログインしている会員が、メールアドレスを確認したかを確かめる（FR-AUTH-021・不変条件 2）。
 * user.authenticate のあとに置く（会員の番号は、user.authenticate が載せたものを読む）。
 * 確認していなければ EmailUnverifiedException を投げるだけで、応答は bootstrap/app.php が作る（403）。
 * 自分の情報・ログアウトは、このグループの外に置く（確認していなくても使える）
 */
final class EnsureUserEmailIsVerified
{
    public function __construct(private readonly AuthService $auth) {}

    public function handle(Request $request, Closure $next): Response
    {
        $userId = $request->attributes->get(AuthenticateUser::LOGIN_USER_ID);
        if (! is_int($userId)) {
            throw new LogicException('ログインしている会員の番号が載っていない。user.verified の前に user.authenticate を付ける');
        }
        if (! $this->auth->hasUserVerifiedEmail($userId)) {
            throw new EmailUnverifiedException;
        }

        return $next($request);
    }
}
