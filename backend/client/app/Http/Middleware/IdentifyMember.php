<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * トークンがあれば、ログインしている会員の番号（users.id）をリクエストに載せる。なくても通す。
 * ログインがなくても使える API（相手のプロフィールを見る）で使う。載せた番号は $request->attributes の member_id。
 */
final class IdentifyMember
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if ($token !== null && $token !== '') {
            // 分かっている不具合：壊れた・期限の切れたトークンは、JWT の例外のまま 500 になる（401 が望ましい）
            $payload = JWT::decode($token, new Key(config()->string('app.key'), 'HS256'));
            if (is_numeric($payload->sub ?? null)) {
                $request->attributes->set('member_id', (int) $payload->sub);
            }
        }

        return $next($request);
    }
}
