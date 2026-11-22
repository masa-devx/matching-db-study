<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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

    // 内訳：会員の状態と、メールアドレスを確認したか（Middleware が2本）・会員をロックして読む・パスワードの書き換え・ほかの端末の行の削除・再設定用の文字の削除。
    // 本番は、ほかにセッションの select と、番号を作り直した分（前の行の delete・新しい行の insert）が流れる（テストのセッションの置き場は array なので流れない）
    it('パスワードを変えるときの SQL は、決まった本数で済む（6本）', function () use ($validInput): void {
        $user = DummyUser::create();
        $request = DummyAuth::actingAs($user);   // ダミーが会員の Model を読むので、数え始める前に作る
        DB::enableQueryLog();

        $request->putJson(Endpoints::password(), $validInput)->assertOk();

        expect(DB::getQueryLog())->toHaveCount(6);
        // 2つの端末から同時に変えても、あとの方が前のパスワードで確かめを通らないように、会員の行をロックして読む
        expect(array_column(DB::getQueryLog(), 'query'))->toContain('select * from "users" where "users"."id" = ? limit 1 for update');
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

    // 「急に全部の端末でログアウトされた」と問い合わせが来たときに、本人が変えたかを追えるようにする。パスワード・番号は書かない（FR-AUTH-032）
    it('変えたことと、消したほかの端末の数を、ログに残す', function () use ($validInput): void {
        $user = DummyUser::create();
        $cookieA = DummyAuth::loginFromScreen($user);
        DummyAuth::loginFromScreen($user);
        $log = Log::spy();

        DummyAuth::withSessionCookie($cookieA)->putJson(Endpoints::password(), $validInput)->assertOk();

        $log->shouldHaveReceived('info')->once()->with('auth.passwordChanged', ['userId' => $user->id, 'deletedSessions' => 1]);
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

// 正常系とした：操作は要件が通す。途中で DB の書き込みが失敗したときに、前の書き込みも戻ることを確かめる
describe('同じ会員が端末 A と B でログインしていて、A でパスワードを変える途中で、DB の書き込みが失敗する', function () use ($validInput): void {
    it('パスワードも、B のセッションの行も、変わらない（500）', function () use ($validInput): void {
        $user = DummyUser::create();
        $cookieA = DummyAuth::loginFromScreen($user);
        $cookieB = DummyAuth::loginFromScreen($user);
        // 最後の書き込み（再設定用の文字の削除）の前で止める。パスワードの書き換えと B の行の削除は、もう流れている。
        // あとで確かめるログインは、この表を消さないので、止めたままでよい
        DB::beforeExecuting(function (string $query): void {
            if (str_starts_with($query, 'delete from "password_reset_tokens"')) {
                throw new RuntimeException('テストで止めた');
            }
        });

        DummyAuth::withSessionCookie($cookieA)->putJson(Endpoints::password(), $validInput)->assertInternalServerError();

        assertDatabaseHas('sessions', ['id' => $cookieB, 'user_id' => $user->id]);
        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])->assertOk();
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
            ->assertExactJson(['message' => '今のパスワードがちがいます', 'errors' => ['current_password' => ['今のパスワードがちがいます']]]);

        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])->assertOk();
    });

    // 削除を確かめの前に動かすと、盗んだ Cookie だけを持つ人が、違うパスワードを送るだけで、ほかの端末をログアウトさせられる
    it('ほかの端末の行・再設定用の文字・この端末の番号は、どれも変わらない（P5）', function (): void {
        $user = DummyUser::create();
        $cookieA = DummyAuth::loginFromScreen($user);
        $cookieB = DummyAuth::loginFromScreen($user);
        DB::table('password_reset_tokens')->insert(['email' => $user->email, 'token' => 'reset-token-1', 'created_at' => now()]);

        $cookieAfter = DummyAuth::withSessionCookie($cookieA)
            ->putJson(Endpoints::password(), ['current_password' => 'wrong-password', 'password' => 'new-password-1'])
            ->assertUnprocessable()
            ->getCookie(config()->string('session.cookie'))?->getValue();

        expect($cookieAfter)->toBe($cookieA);
        assertDatabaseHas('sessions', ['id' => $cookieB, 'user_id' => $user->id]);
        assertDatabaseHas('password_reset_tokens', ['email' => $user->email, 'token' => 'reset-token-1']);
    });

    // 続けて間違える人（ログインしたままの端末を拾った人など）に、ログで気づけるようにする。パスワードは書かない（FR-AUTH-032）
    it('断ったことを、理由とルートの形だけでログに残す', function (): void {
        $user = DummyUser::create();
        $log = Log::spy();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['current_password' => 'wrong-password', 'password' => 'new-password-1'])
            ->assertUnprocessable();

        $log->shouldHaveReceived('info')->once()->with('auth.rejected', ['reason' => 'wrong_current_password', 'status' => 422, 'path' => 'api/me/password']);
    });

    // 分かっている不具合：要件は、何回も続けて間違えたら、しばらく止める（FR-AUTH-033）。間違えた回数を数えていない
    it('続けて6回送っても、毎回 422 で、止めない（P5）', function (): void {
        $user = DummyUser::create();
        $request = DummyAuth::actingAs($user);

        foreach (range(1, 6) as $_) {
            $request->putJson(Endpoints::password(), ['current_password' => 'wrong-password', 'password' => 'new-password-1'])
                ->assertUnprocessable()
                ->assertExactJson(['message' => '今のパスワードがちがいます', 'errors' => ['current_password' => ['今のパスワードがちがいます']]]);
        }
    });
});

describe('ログインした会員が、今のパスワードを送らない・文字でない形で送る', function (): void {
    it('送らないときは、違うときと同じ文を返し、変わらない（422「今のパスワードがちがいます」。docs/api/01b-auth.md）', function (): void {
        $user = DummyUser::create();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['password' => 'new-password-1'])
            ->assertUnprocessable()
            ->assertExactJson(['message' => '今のパスワードがちがいます', 'errors' => ['current_password' => ['今のパスワードがちがいます']]]);

        DummyAuth::forgetLoginBetweenRequests();
        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])->assertOk();
    });

    it('配列で送ると、どこが違うかを返し、変わらない（422）', function (): void {
        $user = DummyUser::create();

        DummyAuth::actingAs($user)->putJson(Endpoints::password(), ['current_password' => ['password'], 'password' => 'new-password-1'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.current_password', ['今のパスワードは文字で入れてください']);

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
        '「あ」を25文字（75バイト）' => [str_repeat('あ', 25), '新しいパスワードが長すぎます。全角の文字は1文字を3文字分、絵文字は4文字分に数えて、72文字分までにしてください'],
        // NUL の文字は、bcrypt にできず 500 になる。そのときのエラーのログに、パスワードが出るおそれがある（FR-AUTH-032）
        'NUL の文字を入れる' => ["abcdefg\0h", '新しいパスワードに使えない文字が入っています'],
        '送らない' => [null, '新しいパスワードを入れてください'],
    ]);
});
