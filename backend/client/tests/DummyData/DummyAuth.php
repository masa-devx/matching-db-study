<?php

declare(strict_types=1);

namespace Tests\DummyData;

use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\TestCase;

use function Pest\Laravel\withHeader;

/**
 * テストの、ログインした状態（トークン）を作る。
 * ログインの API は呼ばない（呼ぶと last_login_at が変わり、テストの前提が動くため）。
 */
final class DummyAuth
{
    private const int THIRTY_DAYS = 60 * 60 * 24 * 30;

    /** その会員としてログインした状態にする。使い方：DummyAuth::actingAs($loginUser)->getJson('/api/me') */
    public static function actingAs(TestUser $user): TestCase
    {
        return self::withToken(self::token($user));
    }

    /** 渡したトークンを Authorization に付ける。壊れたトークンや期限切れのトークンを送るときに使う */
    public static function withToken(string $token): TestCase
    {
        return withHeader('Authorization', "Bearer {$token}");
    }

    /**
     * ログインの API が返すのと同じ作りのトークン（JWT）を作る。期限を渡さなければ、今から30日。
     * 期限は time() をもとに書く（JWT のライブラリは time() を見るので、travelTo() は効かない）。
     */
    public static function token(TestUser $user, ?int $expiresAt = null): string
    {
        return JWT::encode(self::claims($user, $expiresAt), config()->string('app.key'), 'HS256');
    }

    /** 中身は本物と同じで、ほかの鍵で署名したトークン（署名を確かめているかを見るときに使う） */
    public static function tokenSignedWithOtherKey(TestUser $user): string
    {
        return JWT::encode(self::claims($user, null), str_repeat('x', 64), 'HS256');
    }

    /**
     * ヘッダーだけを渡した形で作った、署名のないトークン（「ヘッダー.{}.x」）。
     * ヘッダーの形がおかしいトークン（alg が配列など）を送るときに使う。鍵を知らなくても、だれでも作れる形
     */
    public static function tokenWithHeader(string $headerJson): string
    {
        return rtrim(strtr(base64_encode($headerJson), '+/', '-_'), '=').'.e30.x';
    }

    /** @return array{sub: int, email: string, nickname: string|null, iat: int, exp: int} */
    private static function claims(TestUser $user, ?int $expiresAt): array
    {
        return [
            'sub' => $user->id,
            'email' => $user->email,
            'nickname' => $user->nickname,
            'iat' => time(),
            'exp' => $expiresAt ?? time() + self::THIRTY_DAYS,
        ];
    }
}
