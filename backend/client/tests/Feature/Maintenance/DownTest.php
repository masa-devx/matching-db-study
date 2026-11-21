<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\artisan;
use function Pest\Laravel\get;
use function Pest\Laravel\getJson;
use function Pest\Laravel\json;
use function Pest\Laravel\withCredentials;

// php artisan down・up：会員の側のメンテナンス（docs/requirements/maintenance.md）。
// メンテナンスの状態はメモリに置く（phpunit.xml の APP_MAINTENANCE_DRIVER）。ファイルに置くと、同じフォルダで動いている開発用の API まで止まるため

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

    it('ログインしていない人も、どの API も使えない（503「ただいまメンテナンス中です」。FR-MAINT-001）', function (string $method, string $url): void {
        artisan('down');

        json($method, $url, ['email' => 'someone@example.test', 'password' => 'password'])
            ->assertServiceUnavailable()
            ->assertExactJson(['message' => 'ただいまメンテナンス中です']);
    })->with([
        'ログイン' => ['POST', Endpoints::login()],
        '登録' => ['POST', Endpoints::register()],
        '会員の検索' => ['GET', Endpoints::searchUsers()],
    ]);

    it('動いているかの確かめ（GET /api/health）も、ほかの API と同じに止まる（503「ただいまメンテナンス中です」。FR-MAINT-004）', function (): void {
        artisan('down');

        getJson(Endpoints::health())
            ->assertServiceUnavailable()
            ->assertExactJson(['message' => 'ただいまメンテナンス中です']);
    });
});

describe('メンテナンスでないときに、API が 503 を返す', function (): void {
    it('メンテナンスの文にはしない（ほかの理由で使えないのを、メンテナンスと取り違えないため）', function (): void {
        // メンテナンスでない 503 を返す API は、まだない。このテストの中だけで作る
        Route::get('/api/test-only-unavailable', fn () => abort(503));

        getJson('/api/test-only-unavailable')
            ->assertServiceUnavailable()
            ->assertJsonMissing(['message' => 'ただいまメンテナンス中です']);
    });
});

describe('開発者が、ログインしている会員がいるときに、メンテナンスを入れる', function (): void {
    it('ログインした会員の行も、ログインの前の行も、セッションを全部消す（表 sessions が0行。FR-MAINT-002）', function (): void {
        $loginUser = DummyUser::create();
        DB::table('sessions')->insert([
            ['id' => 'session-signed-in', 'user_id' => $loginUser->id, 'payload' => '', 'last_activity' => time()],
            ['id' => 'session-guest', 'user_id' => null, 'payload' => '', 'last_activity' => time()],
        ]);

        artisan('down');

        expect(DB::table('sessions')->count())->toBe(0);
    });
});

describe('メンテナンス中に、開発者が抜け道の URL を開いてから、API を呼ぶ', function (): void {
    it('抜け道の Cookie を持つクライアントだけが、API を使える（FR-MAINT-003）', function (): void {
        // 試しの文字なので、--secret で渡す（手順では --with-secret で Laravel に作らせる）
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
        getJson(Endpoints::health())->assertServiceUnavailable();

        artisan('up');

        getJson(Endpoints::health())->assertOk();
    });

    it('解いたことを、ログに残す（何時まで使えなかったかを答えるため）', function (): void {
        artisan('down');
        $log = Log::spy();

        artisan('up');

        $log->shouldHaveReceived('info')->once()->with('maintenance.disabled');
    });
});

describe('ログインしていた会員が、メンテナンスを解いたあとに、前の Cookie で API を呼ぶ', function (): void {
    it('ログインが切れていて、使えない（401。FR-MAINT-002・007）', function (): void {
        $cookie = DummyAuth::loginFromScreen(DummyUser::create());
        artisan('down');
        artisan('up');

        DummyAuth::withSessionCookie($cookie)->getJson(Endpoints::account())
            ->assertUnauthorized();
    });
});
