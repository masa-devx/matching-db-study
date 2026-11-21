<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseMissing;

// POST /api/auth/logout：ログアウトする（docs/api/01b-auth.md・FR-AUTH-016）

describe('ログインした会員が、画面からログアウトしてから、同じ Cookie で自分のアカウントを見る', function (): void {
    it('ログアウトは 204 で、そのあとは見られない（401「ログインしてください」。FR-AUTH-016）', function (): void {
        $cookie = DummyAuth::loginFromScreen(DummyUser::create());

        DummyAuth::withSessionCookie($cookie)->postJson(Endpoints::logout())->assertNoContent();
        // その端末のセッション（表 sessions の行）が消えている（ログインの印を外すだけでなく）。
        // 次のリクエストで同じ番号を送ると、Laravel は中身のない行を作り直すので、ここで確かめる
        assertDatabaseMissing('sessions', ['id' => $cookie]);
        DummyAuth::forgetLoginBetweenRequests();

        DummyAuth::withSessionCookie($cookie)->getJson(Endpoints::account())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});

describe('アカウント停止された会員が、画面からログアウトする', function (): void {
    it('ログアウトでき（204）、セッションの行も消える（停止が解けても、同じブラウザがパスワードなしで戻らない）', function (): void {
        $user = DummyUser::create();
        $cookie = DummyAuth::loginFromScreen($user);
        DB::table('users')->where('id', $user->id)->update(['suspended_at' => now()]);

        DummyAuth::withSessionCookie($cookie)->postJson(Endpoints::logout())->assertNoContent();

        assertDatabaseMissing('sessions', ['id' => $cookie]);
    });
});
