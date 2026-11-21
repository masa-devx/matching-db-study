<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\artisan;
use function Pest\Laravel\get;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\withCredentials;

// php artisan down・up：会員の側のメンテナンス（docs/requirements/maintenance.md）。
// メンテナンスの状態はメモリに置く。ファイルに置くと、同じフォルダで動いている開発用の API まで止まるため

beforeEach(function (): void {
    config()->set('app.maintenance.driver', 'array');
});

afterEach(function (): void {
    artisan('up');
});

describe('開発者がメンテナンスを入れたあと、会員が API を呼ぶ', function (): void {
    it('ログインした会員は、API を使えない（503「ただいまメンテナンス中です」。FR-MAINT-001）', function (): void {
        $loginUser = DummyUser::create();
        artisan('down');

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::account())
            ->assertServiceUnavailable()
            ->assertExactJson(['message' => 'ただいまメンテナンス中です']);
    });

    it('ログインしていない人は、ログインもできない（503「ただいまメンテナンス中です」。FR-MAINT-001）', function (): void {
        artisan('down');

        postJson('/api/auth/login', ['email' => 'someone@example.test', 'password' => 'password'])
            ->assertServiceUnavailable()
            ->assertExactJson(['message' => 'ただいまメンテナンス中です']);
    });

    it('動いているかの確かめ（GET /api/health）も、ほかの API と同じに止まる（503「ただいまメンテナンス中です」。FR-MAINT-004）', function (): void {
        artisan('down');

        getJson(Endpoints::health())
            ->assertServiceUnavailable()
            ->assertExactJson(['message' => 'ただいまメンテナンス中です']);
    });
});

describe('開発者が、ログインしている会員がいるときに、メンテナンスを入れる', function (): void {
    it('会員のセッションを全部消し、全員をログアウトさせる（表 sessions が0行。FR-MAINT-002）', function (): void {
        foreach (['session-a', 'session-b'] as $id) {
            DB::table('sessions')->insert(['id' => $id, 'payload' => '', 'last_activity' => time()]);
        }

        artisan('down');

        expect(DB::table('sessions')->count())->toBe(0);
    });
});

describe('メンテナンス中に、開発者が抜け道の URL を開いてから、API を呼ぶ', function (): void {
    it('抜け道の Cookie を持つクライアントだけが、API を使える（FR-MAINT-003）', function (): void {
        $secret = 'dummy-bypass-secret';
        artisan('down', ['--secret' => $secret]);

        $cookie = get(Endpoints::maintenanceBypass($secret))->getCookie('laravel_maintenance', false);

        expect($cookie)->not->toBeNull();
        getJson(Endpoints::health())->assertServiceUnavailable();
        // getJson() は、withCredentials() を付けないと Cookie を送らない（Laravel のテストの作り）
        withCredentials()->withUnencryptedCookie('laravel_maintenance', (string) $cookie?->getValue())
            ->getJson(Endpoints::health())
            ->assertOk();
    });
});

describe('開発者がメンテナンスを解く', function (): void {
    it('会員は、いつもどおり API を使える（FR-MAINT-007）', function (): void {
        artisan('down');

        artisan('up');

        getJson(Endpoints::health())->assertOk();
    });
});
