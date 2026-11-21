<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\withHeader;

// POST /api/auth/login：ログインする（docs/api/01b-auth.md・FR-AUTH-010）。
// 画面のオリジン（Origin）を付けたリクエストだけが、セッションの Cookie を使う（Sanctum の SPA 認証）

describe('会員が、画面から、正しいメールアドレスとパスワードでログインする', function (): void {
    it('ログインでき、自分のアカウントを返す。JSON にトークンは入れない（200・`token` がない。FR-AUTH-010）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();

        withHeader('Origin', config()->string('app.frontend_url'))
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('email', $user->email)
            ->assertJsonMissingPath('token');
    });

    it('セッションの Cookie を、JavaScript から読めない形で付ける（HttpOnly。FR-AUTH-010）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();

        $cookie = withHeader('Origin', config()->string('app.frontend_url'))
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->getCookie(config()->string('session.cookie'), false);

        expect($cookie)->not->toBeNull();
        expect($cookie?->isHttpOnly())->toBeTrue();
    });

    it('ログインのたびに、セッションの番号を作り直す（前の番号は使えない。FR-AUTH-010）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();
        $origin = config()->string('app.frontend_url');
        $before = withHeader('Origin', $origin)->getJson('/sanctum/csrf-cookie')->getCookie(config()->string('session.cookie'));

        $after = withHeader('Origin', $origin)
            ->withCredentials()->withCookie(config()->string('session.cookie'), (string) $before?->getValue())
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->getCookie(config()->string('session.cookie'));

        expect($after?->getValue())->not->toBe($before?->getValue());
    });

    it('受け取った Cookie で、ログインしたあとの API を使える（FR-AUTH-010・FR-AUTH-017）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();
        $origin = config()->string('app.frontend_url');
        $cookie = withHeader('Origin', $origin)
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->getCookie(config()->string('session.cookie'));
        DummyAuth::forgetLoginBetweenRequests();

        withHeader('Origin', $origin)
            ->withCredentials()->withCookie(config()->string('session.cookie'), (string) $cookie?->getValue())
            ->getJson(Endpoints::account())
            ->assertOk()
            ->assertJsonPath('email', $user->email);
    });
});

describe('ログインしていない人が、Cookie を持たずに、ログインしたあとの API を呼ぶ', function (): void {
    it('使えない（401「ログインしてください」）', function (): void {
        withHeader('Origin', config()->string('app.frontend_url'))
            ->getJson(Endpoints::account())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});
