<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;
use Tests\Support\ValidateCsrfTokenInTests;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\travel;
use function Pest\Laravel\withHeader;

// 会員のセッション（D-027）：切れる時間・CSRF・例外の文（FR-AUTH-013・018・032）

/** 画面からログインし、セッションの Cookie の値を返す。そのあとは、Cookie だけでログインが続くかを見る */
function loginFromScreen(string $email): string
{
    $cookie = (string) withHeader('Origin', config()->string('app.frontend_url'))
        ->postJson(Endpoints::login(), ['email' => $email, 'password' => 'password'])
        ->getCookie(config()->string('session.cookie'))?->getValue();
    DummyAuth::forgetLoginBetweenRequests();

    return $cookie;
}

describe('ログインした会員が、しばらく何もしないで、API を呼ぶ', function (): void {
    it('24時間たつと、ログインが切れる（401。FR-AUTH-013）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();
        $cookie = loginFromScreen($user->email);

        travel(24 * 60 + 1)->minutes();

        withHeader('Origin', config()->string('app.frontend_url'))
            ->withCredentials()->withCookie(config()->string('session.cookie'), $cookie)
            ->getJson(Endpoints::account())
            ->assertUnauthorized();
    });

    it('そのあいだに使えば、期限は使ったときから24時間に延びる（FR-AUTH-013）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();
        $origin = config()->string('app.frontend_url');
        $name = config()->string('session.cookie');
        $cookie = loginFromScreen($user->email);

        travel(23)->hours();
        withHeader('Origin', $origin)->withCredentials()->withCookie($name, $cookie)->getJson(Endpoints::account())->assertOk();
        DummyAuth::forgetLoginBetweenRequests();
        travel(23)->hours();

        withHeader('Origin', $origin)->withCredentials()->withCookie($name, $cookie)->getJson(Endpoints::account())->assertOk();
    });
});

describe('よそのサイトのページが、ログインした会員の Cookie を使って、書き込みを送る', function (): void {
    it('CSRF のトークンがなければ、断り、何も変えない（419「画面を読み込み直してください」。FR-AUTH-018）', function (): void {
        config()->set('sanctum.middleware.validate_csrf_token', ValidateCsrfTokenInTests::class);
        DummyAuth::useSessionTable();
        $user = DummyUser::create();
        $cookie = loginFromScreen($user->email);

        withHeader('Origin', config()->string('app.frontend_url'))
            ->withCredentials()->withCookie(config()->string('session.cookie'), $cookie)
            ->deleteJson('/api/me')
            ->assertStatus(419)
            ->assertExactJson(['message' => '画面を読み込み直してください']);

        assertDatabaseHas('users', ['id' => $user->id, 'deleted_at' => null]);
    });
});

describe('SQL のエラーが起きる', function (): void {
    it('例外の文に、SQL に渡した値を入れない（FR-AUTH-032）', function (): void {
        $secret = 'secret-session-id-for-test';

        try {
            DB::select('select * from no_such_table where id = ?', [$secret]);
            $message = '';
        } catch (QueryException $e) {
            $message = $e->getMessage();
        }

        expect($message)->not->toBe('');
        expect($message)->not->toContain($secret);
    });
});
