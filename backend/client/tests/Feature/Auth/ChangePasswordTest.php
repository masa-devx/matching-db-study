<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
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

describe('ログインした会員が、登録の決まりの境目の新しいパスワードを送る（P6）', function (): void {
    it('そのパスワードに変わる（200。FR-AUTH-033・FR-AUTH-004）', function (string $newPassword): void {
        $user = DummyUser::create();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['current_password' => 'password', 'password' => $newPassword])
            ->assertOk();

        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => $newPassword])->assertOk();
    })->with([
        '8文字' => [str_repeat('a', 8)],
        '64文字' => [str_repeat('a', 64)],
        '「あ」を24文字（72バイト）' => [str_repeat('あ', 24)],
    ]);
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
    it('前に届いた再設定のリンクの文字が消え、ほかの会員の文字は残る（FR-AUTH-033）', function () use ($validInput): void {
        $user = DummyUser::create();
        $someone = DummyUser::create();
        DB::table('password_reset_tokens')->insert([
            ['email' => $user->email, 'token' => 'reset-token-1', 'created_at' => now()],
            ['email' => $someone->email, 'token' => 'reset-token-2', 'created_at' => now()],
        ]);

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), $validInput)->assertOk();

        assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        assertDatabaseHas('password_reset_tokens', ['email' => $someone->email, 'token' => 'reset-token-2']);
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
    it('変わらず、どこが違うかを返す（422。FR-AUTH-033・FR-AUTH-004）', function (?string $newPassword, string $error): void {
        $user = DummyUser::create();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['current_password' => 'password', 'password' => $newPassword])
            ->assertUnprocessable()
            ->assertJsonPath('errors.password', [$error]);

        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])->assertOk();
    })->with([
        '7文字' => [str_repeat('a', 7), '新しいパスワードは8文字以上にしてください'],
        '65文字' => [str_repeat('a', 65), '新しいパスワードは64文字以内にしてください'],
        '「あ」を25文字（75バイト）' => [str_repeat('あ', 25), '新しいパスワードは72バイト以内にしてください'],
        '送らない' => [null, '新しいパスワードを入れてください'],
    ]);
});
