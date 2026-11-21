<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\withHeader;

// POST /api/auth/logout：ログアウトする（docs/api/01b-auth.md・FR-AUTH-016）

describe('ログインした会員が、画面からログアウトしてから、同じ Cookie で自分のアカウントを見る', function (): void {
    it('ログアウトは 204 で、そのあとは見られない（401「ログインしてください」。FR-AUTH-016）', function (): void {
        DummyAuth::useSessionTable();
        $user = DummyUser::create();
        $origin = config()->string('app.frontend_url');
        $name = config()->string('session.cookie');
        $cookie = (string) withHeader('Origin', $origin)
            ->postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->getCookie($name)?->getValue();

        DummyAuth::forgetLoginBetweenRequests();
        withHeader('Origin', $origin)->withCredentials()->withCookie($name, $cookie)->postJson(Endpoints::logout())->assertNoContent();
        // その端末のセッション（表 sessions の行）が消えている（ログインの印を外すだけでなく）。
        // 次のリクエストで同じ番号を送ると、Laravel は中身のない行を作り直すので、ここで確かめる
        assertDatabaseMissing('sessions', ['id' => $cookie]);
        DummyAuth::forgetLoginBetweenRequests();

        withHeader('Origin', $origin)->withCredentials()->withCookie($name, $cookie)->getJson(Endpoints::account())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});
