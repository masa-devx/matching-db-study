<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;

// PUT /api/me/password：ログインした会員が、パスワードを変える（docs/api/01b-auth.md・FR-AUTH-033）。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」。場面の名前（P1 など）は explanations/auth-edge-cases.html の3章

// テストで使う値（DB の行は、それぞれのテストの中で作る）。ダミーの会員のパスワードは 'password'
$validInput = ['current_password' => 'password', 'password' => 'new-password-1'];

/**
 * 正常系：要件が通す操作
 */
describe('ログインした会員が、正しい今のパスワードと新しいパスワードを送る', function () use ($validInput): void {
    it('パスワードが変わり、次からは新しいパスワードでだけログインできる（200「パスワードを変えました」。FR-AUTH-033）', function () use ($validInput): void {
        $user = DummyUser::create();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), $validInput)
            ->assertOk()
            ->assertExactJson(['message' => 'パスワードを変えました']);

        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'new-password-1'])->assertOk();
        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])->assertUnauthorized();
    });
});

describe('同じ会員が端末 A と B でログインしていて、A でパスワードを変える（P1・P2）', function () use ($validInput): void {
    it('B は、次のリクエストで見られなくなる。B のセッションの行も消える（401「ログインしてください」。FR-AUTH-033）', function () use ($validInput): void {
        $user = DummyUser::create();
        $cookieA = DummyAuth::loginFromScreen($user);
        $cookieB = DummyAuth::loginFromScreen($user);

        DummyAuth::withSessionCookie($cookieA)->putJson(Endpoints::password(), $validInput)->assertOk();

        // 次のリクエストで同じ番号を送ると、Laravel は中身のない行を作り直すので、ここで確かめる
        assertDatabaseMissing('sessions', ['id' => $cookieB]);
        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::withSessionCookie($cookieB)->getJson(Endpoints::account())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('A は、ログインしたまま、セッションの番号が新しくなる。前の番号の行は消える（200。FR-AUTH-033）', function () use ($validInput): void {
        $user = DummyUser::create();
        $cookieA = DummyAuth::loginFromScreen($user);

        $cookieAfter = (string) DummyAuth::withSessionCookie($cookieA)->putJson(Endpoints::password(), $validInput)
            ->assertOk()
            ->getCookie(config()->string('session.cookie'))?->getValue();

        expect($cookieAfter)->not->toBe($cookieA);
        assertDatabaseMissing('sessions', ['id' => $cookieA]);
        assertDatabaseHas('sessions', ['id' => $cookieAfter, 'user_id' => $user->id]);
        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::withSessionCookie($cookieAfter)->getJson(Endpoints::account())->assertOk();
    });

    it('ほかの会員のセッションの行は、消えない（FR-AUTH-033）', function () use ($validInput): void {
        $user = DummyUser::create();
        $someone = DummyUser::create();
        $cookieA = DummyAuth::loginFromScreen($user);
        $cookieSomeone = DummyAuth::loginFromScreen($someone);

        DummyAuth::withSessionCookie($cookieA)->putJson(Endpoints::password(), $validInput)->assertOk();

        assertDatabaseHas('sessions', ['id' => $cookieSomeone, 'user_id' => $someone->id]);
    });
});

describe('再設定のメールを頼んだ会員が、そのあとで設定の画面からパスワードを変える（P7）', function () use ($validInput): void {
    // 分かっている不具合：要件（FR-AUTH-033）は、その会員の再設定用の文字を消す。表 password_reset_tokens を触っていない
    it('前に届いた再設定のリンクの文字は、残ったまま', function () use ($validInput): void {
        $user = DummyUser::create();
        DB::table('password_reset_tokens')->insert(['email' => $user->email, 'token' => 'reset-token-1', 'created_at' => now()]);

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), $validInput)->assertOk();

        assertDatabaseHas('password_reset_tokens', ['email' => $user->email, 'token' => 'reset-token-1']);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('ログインした会員が、違う今のパスワードを送る', function (): void {
    it('パスワードは変わらない（422「今のパスワードがちがいます」。FR-AUTH-033）', function (): void {
        $user = DummyUser::create();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['current_password' => 'wrong-password', 'password' => 'new-password-1'])
            ->assertUnprocessable()
            ->assertExactJson(['message' => '今のパスワードがちがいます']);

        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])->assertOk();
    });
});

describe('ログインした会員が、登録の決まりに合わない新しいパスワードを送る（P6）', function (): void {
    // 分かっている不具合：要件（FR-AUTH-033・FR-AUTH-004）は 422 で、変わらない。新しいパスワードを確かめていない
    it('1文字でも、そのパスワードに変わる（200）', function (): void {
        $user = DummyUser::create();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['current_password' => 'password', 'password' => 'a'])
            ->assertOk();

        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'a'])->assertOk();
    });

    // 分かっている不具合：要件（FR-AUTH-033・FR-AUTH-004）は 422 で、変わらない。bcrypt は 72バイトより後ろを読まない
    it('73バイトでも変わり、前の72バイトだけでログインできてしまう（200）', function (): void {
        $user = DummyUser::create();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['current_password' => 'password', 'password' => str_repeat('a', 73)])
            ->assertOk();

        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => str_repeat('a', 72)])->assertOk();
    });

    // 分かっている不具合：要件（FR-AUTH-033）は 422 で、変わらない。null をそのまま保存しようとして、NOT NULL の違反になる
    it('送らなければ、変わらずにサーバーのエラーになる（500）', function (): void {
        $user = DummyUser::create();
        Exceptions::fake();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['current_password' => 'password'])
            ->assertInternalServerError();

        // 前のパスワードのままかは確かめない。テストは1つのトランザクションの中なので、SQL の失敗のあとは、PostgreSQL がどの SQL も断る
        Exceptions::assertReported(QueryException::class);
    });
});
