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

    /** その会員としてログインした状態にする。使い方：DummyAuth::actingAs($me)->getJson('/api/me') */
    public static function actingAs(TestMember $member): TestCase
    {
        return withHeader('Authorization', 'Bearer '.self::token($member));
    }

    /**
     * ログインの API が返すのと同じ作りのトークン（JWT）を作る。期限を渡さなければ、今から30日。
     * 期限は time() をもとに書く（JWT のライブラリは time() を見るので、travelTo() は効かない）。
     */
    public static function token(TestMember $member, ?int $expiresAt = null): string
    {
        return JWT::encode([
            'sub' => $member->id,
            'email' => $member->email,
            'nickname' => $member->nickname,
            'iat' => time(),
            'exp' => $expiresAt ?? time() + self::THIRTY_DAYS,
        ], (string) config('app.key'), 'HS256');
    }
}
