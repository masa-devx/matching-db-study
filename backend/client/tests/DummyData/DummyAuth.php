<?php

declare(strict_types=1);

namespace Tests\DummyData;

use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\TestCase;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\withHeader;

/**
 * テストの、ログインした状態（トークン）を作る。
 * ログインの API は呼ばない（呼ぶと last_login_at が変わり、テストの前提が動くため）。
 */
final class DummyAuth
{
    private const int THIRTY_DAYS = 60 * 60 * 24 * 30;

    /**
     * その会員としてログインした状態にする（セッション。D-027）。使い方：DummyAuth::actingAs($loginUser)->getJson('/api/me')。
     * 画面のオリジン（Origin）も付ける（Sanctum は、画面からのリクエストだけでセッションを使う）
     */
    public static function actingAs(TestUser $user): TestCase
    {
        return actingAs(User::query()->findOrFail($user->id), 'web')
            ->withHeader('Origin', config()->string('app.frontend_url'));
    }

    /**
     * 次のリクエストの前に、ログインした会員を忘れさせる。
     * Laravel のテストは、1つのテストの中で、ログインした会員を覚えたままにする（本番は、リクエストごとに Cookie から読み直す）。
     * Cookie だけでログインが続くか・切れるかを確かめるときに呼ぶ
     */
    public static function forgetLoginBetweenRequests(): void
    {
        auth()->forgetGuards();
        // セッションも、Cookie の番号から読み直させる（前のリクエストで読んだ中身を使い続けないように）
        app('session')->forgetDrivers();
        app()->forgetInstance('session.store');
    }

    /**
     * セッションの置き場を DB（表 sessions）にする。Cookie だけでログインが続くか・切れるかを見るテストの最初に呼ぶ。
     * テストの置き場（phpunit.xml の SESSION_DRIVER=array）は、forgetLoginBetweenRequests() で中身ごと消えるため
     */
    public static function useSessionTable(): void
    {
        config()->set('session.driver', 'database');
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
