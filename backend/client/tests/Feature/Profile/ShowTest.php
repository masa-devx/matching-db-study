<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyMember;

use function Pest\Laravel\getJson;

// GET /api/users/{user_id}：相手のプロフィールを見る。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」。手で試すシナリオは bruno/client/profile/

describe('ログインしていない人が見る', function (): void {
    // 分かっている不具合：要件（FR-AUTH-020）は 401。ルートに、ログインを求める Middleware がない
    it('200 で見られる', function (): void {
        $other = DummyMember::create();

        getJson("/api/users/{$other->publicId}")->assertOk();
    });
});

describe('ログインしている人が見る', function (): void {
    // 分かっている不具合：要件（FR-002）は、メールアドレス・生年月日を返さない。表の列を全部返している
    it('ニックネームと一緒に、メールアドレス・確認用の文字・生年月日も返る', function (): void {
        $me = DummyMember::create(gender: 'male');
        $other = DummyMember::create(nickname: 'さき');

        DummyAuth::actingAs($me)->getJson("/api/users/{$other->publicId}")
            ->assertOk()
            ->assertJsonPath('profile.nickname', 'さき')
            ->assertJsonPath('email', $other->email)
            ->assertJsonStructure(['verification_token', 'profile' => ['birthday']]);
    });

    it('プロフィールのない会員なら、profile は null', function (): void {
        $me = DummyMember::create(gender: 'male');
        $other = DummyMember::create(withProfile: false);

        DummyAuth::actingAs($me)->getJson("/api/users/{$other->publicId}")
            ->assertOk()
            ->assertJsonPath('profile', null);
    });

    it('マッチしていない相手なら、room_id は null', function (): void {
        $me = DummyMember::create(gender: 'male');
        $other = DummyMember::create();

        DummyAuth::actingAs($me)->getJson("/api/users/{$other->publicId}")
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });

    it('マッチしている相手なら、room_id に2人のトークルームの番号が入る', function (): void {
        $me = DummyMember::create(gender: 'male');
        $other = DummyMember::create();
        $roomId = DummyMatching::match($me, $other);

        DummyAuth::actingAs($me)->getJson("/api/users/{$other->publicId}")
            ->assertOk()
            ->assertJsonPath('room_id', $roomId);
    });
});

describe('URL の番号がおかしい', function (): void {
    it('いない会員なら 404（FR-004）', function (): void {
        getJson('/api/users/00000000-0000-0000-0000-000000000000')->assertNotFound();
    });

    // 分かっている不具合：404 が望ましい。形を確かめずに UUID の列を探し、PostgreSQL のエラーになる
    it('UUID の形でないなら 500', function (): void {
        getJson('/api/users/abc')->assertInternalServerError();
    });
});
