<?php

declare(strict_types=1);

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\DB;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyMember;

use function Pest\Laravel\getJson;
use function Pest\Laravel\withHeader;

// GET /api/users/{user_id}：相手のプロフィールを見る。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」。手で試すシナリオは bruno/client/profile/

describe('ログインしていない人が見る', function (): void {
    // 分かっている不具合：要件（FR-AUTH-020）は 401。ルートに、ログインを求める Middleware がない
    it('200 で見られる', function (): void {
        $other = DummyMember::create();

        getJson("/api/users/{$other->publicId}")->assertOk();
    });

    it('マッチしている2人の片方を見ても、room_id は null', function (): void {
        $someone = DummyMember::create(gender: 'male');
        $other = DummyMember::create();
        DummyMatching::match($someone, $other);

        getJson("/api/users/{$other->publicId}")
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });

    it('SQL は2本（会員とプロフィール）', function (): void {
        $other = DummyMember::create();
        DB::enableQueryLog();

        getJson("/api/users/{$other->publicId}")->assertOk();

        expect(DB::getQueryLog())->toHaveCount(2);
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
            ->assertJsonStructure(['verification_token', 'profile' => ['birthday']])
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('remember_token');
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

    it('2人とも、ほかの人とだけマッチしているなら、room_id は null', function (): void {
        $me = DummyMember::create(gender: 'male');
        $other = DummyMember::create();
        DummyMatching::match($me, DummyMember::create());
        DummyMatching::match(DummyMember::create(gender: 'male'), $other);

        DummyAuth::actingAs($me)->getJson("/api/users/{$other->publicId}")
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });

    it('マッチしている相手なら、SQL は5本（会員・プロフィール・トークルームを探す3本）', function (): void {
        $me = DummyMember::create(gender: 'male');
        $other = DummyMember::create();
        DummyMatching::match($me, $other);
        DB::enableQueryLog();

        DummyAuth::actingAs($me)->getJson("/api/users/{$other->publicId}")->assertOk();

        expect(DB::getQueryLog())->toHaveCount(5);
    });

    // 分かっている不具合：自分とのトークルームはないので、null が望ましい。見る人と相手が同じときを分けていない
    it('自分を見ると、room_id に自分のトークルームのどれかが入る', function (): void {
        $me = DummyMember::create(gender: 'male');
        $roomIds = [DummyMatching::match($me, DummyMember::create()), DummyMatching::match($me, DummyMember::create())];

        $response = DummyAuth::actingAs($me)->getJson("/api/users/{$me->publicId}")->assertOk();

        expect($response->json('room_id'))->toBeIn($roomIds);
    });
});

describe('トークンがおかしい', function (): void {
    // 分かっている不具合：要件は 401（期限切れは FR-AUTH-013）。IdentifyMember が JWT の例外を受けず、そのまま 500 になる
    it('壊れたトークンなら 500', function (): void {
        $other = DummyMember::create();

        withHeader('Authorization', 'Bearer abc')->getJson("/api/users/{$other->publicId}")
            ->assertInternalServerError();
    });

    it('ほかの鍵で署名したトークンなら 500', function (): void {
        $me = DummyMember::create(gender: 'male');
        $other = DummyMember::create();
        $forged = JWT::encode(['sub' => $me->id, 'exp' => time() + 60], str_repeat('x', 64), 'HS256');

        withHeader('Authorization', "Bearer {$forged}")->getJson("/api/users/{$other->publicId}")
            ->assertInternalServerError();
    });

    it('期限の切れたトークンなら 500', function (): void {
        $me = DummyMember::create(gender: 'male');
        $other = DummyMember::create();
        $expired = DummyAuth::token($me, expiresAt: time() - 60);

        withHeader('Authorization', "Bearer {$expired}")->getJson("/api/users/{$other->publicId}")
            ->assertInternalServerError();
    });

    // 移す前と違う：移す前は、先に会員を探していたので 404。今は IdentifyMember が先にトークンを読む
    it('いない会員でも、壊れたトークンなら 500', function (): void {
        withHeader('Authorization', 'Bearer abc')->getJson('/api/users/00000000-0000-0000-0000-000000000000')
            ->assertInternalServerError();
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
