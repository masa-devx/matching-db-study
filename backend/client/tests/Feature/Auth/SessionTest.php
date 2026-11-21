<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;
use Tests\Support\ValidateCsrfTokenInTests;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\travel;

// 会員のセッション（D-027）：切れる時間・CSRF・SQL の本数・ログ・例外の文（FR-AUTH-013・018・032）

describe('ログインした会員が、しばらく何もしないで、API を呼ぶ', function (): void {
    it('24時間たつと、ログインが切れる（401「ログインしてください」。FR-AUTH-013）', function (): void {
        $cookie = DummyAuth::loginFromScreen(DummyUser::create());

        travel(24 * 60 + 1)->minutes();

        DummyAuth::withSessionCookie($cookie)->getJson(Endpoints::account())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('そのあいだに使えば、期限は使ったときから24時間に延びる（FR-AUTH-013）', function (): void {
        $cookie = DummyAuth::loginFromScreen(DummyUser::create());

        travel(23)->hours();
        DummyAuth::withSessionCookie($cookie)->getJson(Endpoints::account())->assertOk();
        DummyAuth::forgetLoginBetweenRequests();
        travel(23)->hours();

        DummyAuth::withSessionCookie($cookie)->getJson(Endpoints::account())->assertOk();
    });
});

describe('ログインした会員の Cookie で、画面のオリジンから、CSRF のトークンを付けずに書き込む', function (): void {
    it('どの書き込みも断り、何も変えない（419「画面を読み込み直してください」。FR-AUTH-018）', function (string $method, string $url): void {
        $user = DummyUser::create();
        $cookie = DummyAuth::loginFromScreen($user);
        // ログインのあとで、CSRF の確かめを飛ばさない形にする（先に替えると、ログインそのものが 419 になる）
        config()->set('sanctum.middleware.validate_csrf_token', ValidateCsrfTokenInTests::class);

        DummyAuth::withSessionCookie($cookie)->json($method, $url, ['nickname' => 'かきかえ'])
            ->assertStatus(419)
            ->assertExactJson(['message' => '画面を読み込み直してください']);

        assertDatabaseHas('users', ['id' => $user->id, 'deleted_at' => null]);
    })->with([
        '退会（DELETE /api/me）' => ['DELETE', Endpoints::account()],
        '検索の条件の保存（POST）' => ['POST', Endpoints::searchConditions()],
        'パスワードの変更（PUT）' => ['PUT', Endpoints::password()],
    ]);

    it('違うトークンを付けても、断る（419）', function (): void {
        $cookie = DummyAuth::loginFromScreen(DummyUser::create());
        config()->set('sanctum.middleware.validate_csrf_token', ValidateCsrfTokenInTests::class);

        DummyAuth::withSessionCookie($cookie)->withHeader('X-XSRF-TOKEN', 'wrong-token')
            ->deleteJson(Endpoints::account())
            ->assertStatus(419);
    });

    it('比べる相手：ログインの応答の CSRF のトークンを付ければ、CSRF の確かめを通る（419 にならない）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();
        $login = DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])->assertOk();
        $cookie = (string) $login->getCookie(config()->string('session.cookie'))?->getValue();
        $xsrf = DummyAuth::xsrfTokenOf($login);
        DummyAuth::forgetLoginBetweenRequests();
        config()->set('sanctum.middleware.validate_csrf_token', ValidateCsrfTokenInTests::class);

        // 退会の API は、入力が足りないので 422 を返す。CSRF の確かめを通って、入力の確かめまで進んだことを見る
        DummyAuth::withSessionCookie($cookie)->withHeader('X-XSRF-TOKEN', $xsrf)
            ->deleteJson(Endpoints::account())
            ->assertUnprocessable();
    });
});

describe('ログインした会員が、Cookie で自分のアカウントを見る', function (): void {
    // 内訳：ガード（Laravel の id() が user() を呼ぶ）・アカウントの状態（AuthService）・自分の情報（AccountService）。
    // ガードの会員を Service に渡せば1回で済むが、層の決まりを崩すので3回のままにした（03-how.md の DB）
    it('会員の行は、決まった回数だけ読む（3回）', function (): void {
        $cookie = DummyAuth::loginFromScreen(DummyUser::create());
        DB::enableQueryLog();

        DummyAuth::withSessionCookie($cookie)->getJson(Endpoints::account())->assertOk();

        $usersQueries = array_filter(DB::getQueryLog(), fn (array $query): bool => str_contains($query['query'], 'from "users"'));
        expect($usersQueries)->toHaveCount(3);
    });
});

describe('ログインの確かめで断る', function (): void {
    it('ログインしていない人を断ったことを、ルートの形と理由だけでログに残す（URL の番号・Cookie の値は書かない）', function (): void {
        $target = DummyUser::create();
        $log = Log::spy();

        DummyAuth::fromScreen()->getJson(Endpoints::profile($target->publicId))->assertUnauthorized();

        $log->shouldHaveReceived('info')->once()->with('auth.rejected', ['reason' => 'unauthenticated', 'status' => 401, 'path' => 'api/users/{user_id}']);
    });

    it('パスワードの再設定の 419 でも、再設定の文字をログに書かない（ルートの形にする）', function (): void {
        config()->set('sanctum.middleware.validate_csrf_token', ValidateCsrfTokenInTests::class);
        $log = Log::spy();

        DummyAuth::fromScreen()->putJson(Endpoints::passwordReset('secret-reset-token'), ['password' => 'new-password'])->assertStatus(419);

        $log->shouldHaveReceived('info')->once()->with('auth.rejected', ['reason' => 'csrf', 'status' => 419, 'path' => 'api/password-resets/{token}']);
    });

    it('アカウント停止の会員を断ったことも、ログに残す', function (): void {
        $user = DummyUser::create();
        $cookie = DummyAuth::loginFromScreen($user);
        DB::table('users')->where('id', $user->id)->update(['suspended_at' => now()]);
        $log = Log::spy();

        DummyAuth::withSessionCookie($cookie)->getJson(Endpoints::account())->assertUnauthorized();

        $log->shouldHaveReceived('info')->once()->with('auth.rejected', ['reason' => 'account_suspended', 'status' => 401, 'path' => 'api/me']);
    });
});

describe('開発者が、存在しない表に値を渡す SQL を流して、エラーにする', function (): void {
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
