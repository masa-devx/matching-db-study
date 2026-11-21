<?php

declare(strict_types=1);

use Illuminate\Support\Carbon;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\call;
use function Pest\Laravel\travelTo;
use function Pest\Laravel\withHeader;

// POST /api/auth/login：ログインする（docs/api/01b-auth.md・FR-AUTH-010）。
// 画面のオリジン（Origin）を付けたリクエストだけが、セッションの Cookie を使う（Sanctum の SPA 認証）

describe('会員が、画面から、正しいメールアドレスとパスワードでログインする', function (): void {
    it('ログインでき、自分のアカウントを返す。JSON にトークンもパスワードも入れない（200。FR-AUTH-010）', function (): void {
        $user = DummyUser::create();

        DummyAuth::fromScreen()
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('email', $user->email)
            ->assertJsonMissingPath('token')
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('remember_token');
    });

    it('セッションの Cookie を、JavaScript から読めず、同じサイトからだけ送られる形で付ける（HttpOnly・SameSite=Lax・Path=/。FR-AUTH-010）', function (): void {
        $user = DummyUser::create();

        $cookie = DummyAuth::fromScreen()
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->getCookie(config()->string('session.cookie'), false);

        expect($cookie)->not->toBeNull();
        expect($cookie?->isHttpOnly())->toBeTrue();
        expect($cookie?->getSameSite())->toBe('lax');
        expect($cookie?->getPath())->toBe('/');
    });

    it('最終ログインの日時を、ログインした時刻にする（検索の並び）', function (): void {
        $user = DummyUser::create();
        travelTo(Carbon::parse('2026-11-21 12:34:56'));

        DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])->assertOk();

        assertDatabaseHas('users', ['id' => $user->id, 'last_login_at' => '2026-11-21 12:34:56']);
    });

    it('受け取った Cookie で、ログインしたあとの API を使える（FR-AUTH-010・FR-AUTH-017）', function (): void {
        $user = DummyUser::create();
        $cookie = DummyAuth::loginFromScreen($user);

        DummyAuth::withSessionCookie($cookie)->getJson(Endpoints::account())
            ->assertOk()
            ->assertJsonPath('email', $user->email);
    });
});

describe('ログインの前にセッションの番号を持っていた人が、ログインする', function (): void {
    it('ログインのたびに番号を作り直し、前の番号ではログインしたことにならない（401。FR-AUTH-010）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();
        $before = (string) DummyAuth::fromScreen()->getJson('/sanctum/csrf-cookie')->getCookie(config()->string('session.cookie'))?->getValue();
        expect($before)->not->toBe('');

        $after = (string) DummyAuth::withSessionCookie($before)
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->getCookie(config()->string('session.cookie'))?->getValue();
        DummyAuth::forgetLoginBetweenRequests();

        expect($after)->not->toBe($before);
        DummyAuth::withSessionCookie($before)->getJson(Endpoints::account())->assertUnauthorized();
    });
});

describe('会員が、画面から、ログインできないメールアドレスやパスワードでログインする', function (): void {
    // 分かっている不具合：要件は、どちらが違うかを教えない同じ文（FR-AUTH-011）。今は、レガシー版と同じく違う文を返す
    it('ないメールアドレスなら、ログインできない（401「メールアドレスが違います」）', function (): void {
        DummyAuth::fromScreen()
            ->postJson(Endpoints::login(), ['email' => 'nobody@example.test', 'password' => 'password'])
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'メールアドレスが違います']);
    });

    // 分かっている不具合：要件は、どちらが違うかを教えない同じ文（FR-AUTH-011）
    it('パスワードが違えば、ログインできない（401「パスワードが違います」）', function (): void {
        $user = DummyUser::create();

        DummyAuth::fromScreen()
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'wrong-password'])
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'パスワードが違います']);
    });

    it('NUL の文字の入ったパスワードでも、サーバーのエラーにならない（ないメールアドレスも 401。登録されているかを分からせない。NFR-AUTH-002）', function (): void {
        DummyAuth::fromScreen()
            ->postJson(Endpoints::login(), ['email' => 'nobody@example.test', 'password' => "ab\0cd"])
            ->assertUnauthorized();
    });
});

describe('アカウント停止・強制退会された会員が、画面から、正しいパスワードでログインする', function (): void {
    it('アカウント停止なら、ログインできず、ログインの状態も作らない（403「利用を停止しています」・code。03-how.md の M2）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create(suspended: true);

        $response = DummyAuth::fromScreen()->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password']);
        DummyAuth::forgetLoginBetweenRequests();

        $response->assertForbidden()->assertExactJson(['message' => '利用を停止しています', 'code' => 'account_suspended']);
        DummyAuth::withSessionCookie((string) $response->getCookie(config()->string('session.cookie'))?->getValue())
            ->getJson(Endpoints::account())
            ->assertUnauthorized();
    });

    it('強制退会なら、ログインできない（403「強制退会になっています」・code）', function (): void {
        $user = DummyUser::create(banned: true);

        DummyAuth::fromScreen()
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->assertForbidden()
            ->assertExactJson(['message' => '強制退会になっています', 'code' => 'account_banned']);
    });

    it('アカウント停止と強制退会の両方なら、強制退会として扱う（Middleware と同じ判定）', function (): void {
        $user = DummyUser::create(suspended: true, banned: true);

        DummyAuth::fromScreen()
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('code', 'account_banned');
    });
});

describe('ログインした会員の Cookie を、よそのサイトのページが送る', function (): void {
    it('画面のオリジンでなければ、セッションを使わない（401）', function (): void {
        $cookie = DummyAuth::loginFromScreen(DummyUser::create());

        withHeader('Origin', 'http://evil.example.test')
            ->withCredentials()
            ->withCookie(config()->string('session.cookie'), $cookie)
            ->getJson(Endpoints::account())
            ->assertUnauthorized();
    });

    it('CORS は、画面のオリジンだけを許す（よそのオリジンにも、画面のオリジンを返す）', function (): void {
        $headers = ['HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET', 'HTTP_ACCEPT' => 'application/json'];

        $evil = call('OPTIONS', Endpoints::account(), [], [], [], ['HTTP_ORIGIN' => 'http://evil.example.test', ...$headers]);
        $screen = call('OPTIONS', Endpoints::account(), [], [], [], ['HTTP_ORIGIN' => config()->string('app.frontend_url'), ...$headers]);

        expect($evil->headers->get('Access-Control-Allow-Origin'))->not->toBe('http://evil.example.test');
        expect($screen->headers->get('Access-Control-Allow-Origin'))->toBe(config()->string('app.frontend_url'));
        expect($screen->headers->get('Access-Control-Allow-Credentials'))->toBe('true');
    });
});

describe('ログインしていない人が、Cookie を持たずに、ログインしたあとの API を呼ぶ', function (): void {
    it('使えない（401「ログインしてください」）', function (): void {
        DummyAuth::fromScreen()
            ->getJson(Endpoints::account())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});
