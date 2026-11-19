<?php

declare(strict_types=1);

use Illuminate\Support\Carbon;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyMember;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\travelTo;

// GET /api/me/likes：送った相手の一覧。今の動きを確かめるテスト（docs/api/02-likes.md）。
// 要件と違う所は「分かっている不具合」

describe('一覧に出る相手と並び', function (): void {
    it('新しい順に返る（FR-LIKE-005）', function (): void {
        $me = DummyMember::create(gender: 'male');
        $older = DummyMember::create(nickname: 'さき');
        $newer = DummyMember::create(nickname: 'ゆい');

        travelTo(Carbon::parse('2026-11-10 12:00:00'));
        DummyMatching::like($me, $older);
        travelTo(Carbon::parse('2026-11-11 12:00:00'));
        DummyMatching::like($me, $newer);

        $response = DummyAuth::actingAs($me)->getJson('/api/me/likes');

        $response->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.user_id', $newer->publicId)
            ->assertJsonPath('0.nickname', 'ゆい')
            ->assertJsonPath('0.liked_at', '2026-11-11T12:00:00.000000Z')
            ->assertJsonPath('1.user_id', $older->publicId)
            ->assertJsonPath('1.nickname', 'さき')
            ->assertJsonPath('1.liked_at', '2026-11-10T12:00:00.000000Z');
        // 分かっている不具合：要件（FR-LIKE-005）は年齢と画像の URL（age・avatar_url）。生年月日と image をそのまま返す
        $response->assertJsonStructure(['*' => ['user_id', 'nickname', 'birthday', 'image', 'liked_at', 'matched']])
            ->assertJsonMissingPath('0.age')
            ->assertJsonMissingPath('0.avatar_url');
    });

    it('いいねを送っていなければ、空の配列になる（FR-LIKE-005）', function (): void {
        $me = DummyMember::create();
        DummyMatching::like(DummyMember::create(), $me);   // もらったいいねは、送った一覧に出ない

        DummyAuth::actingAs($me)->getJson('/api/me/likes')
            ->assertOk()
            ->assertExactJson([]);
    });

    // 要件 ID はない。根拠は docs/api/06-blocks-withdrawal.md の「GET /api/me/likes」と、docs/requirements/blocks.md の「向きを問わない」
    it('自分がブロックした相手も、自分をブロックした相手も出ない', function (): void {
        $me = DummyMember::create();
        $shown = DummyMember::create();
        $blockedByMe = DummyMember::create();
        $blockedMe = DummyMember::create();
        foreach ([$shown, $blockedByMe, $blockedMe] as $to) {
            DummyMatching::like($me, $to);
        }
        DummyMatching::block($me, $blockedByMe);
        DummyMatching::block($blockedMe, $me);

        DummyAuth::actingAs($me)->getJson('/api/me/likes')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.user_id', $shown->publicId);
        // 一覧から除くだけで、いいねの行は消さない（ブロックを解除したら、また出る）
        assertDatabaseHas('likes', ['from_user_id' => $me->id, 'to_user_id' => $blockedByMe->id]);
        assertDatabaseHas('likes', ['from_user_id' => $me->id, 'to_user_id' => $blockedMe->id]);
    });

    it('マッチした相手は matched が true、していない相手は false（FR-MATCH-006）', function (): void {
        $me = DummyMember::create();
        $matched = DummyMember::create();
        $notMatched = DummyMember::create();

        travelTo(Carbon::parse('2026-11-10 12:00:00'));
        DummyMatching::like($me, $notMatched);
        travelTo(Carbon::parse('2026-11-11 12:00:00'));
        DummyMatching::match(likedFirst: $matched, likedBack: $me);

        DummyAuth::actingAs($me)->getJson('/api/me/likes')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.user_id', $matched->publicId)
            ->assertJsonPath('0.matched', true)
            ->assertJsonPath('1.user_id', $notMatched->publicId)
            ->assertJsonPath('1.matched', false);
    });
});

describe('トークン', function (): void {
    it('なければ 401（FR-LIKE-007）', function (): void {
        getJson('/api/me/likes')
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    // 分かっている不具合：401 が望ましい。JWT の例外をつかまえていない（docs/api/02-likes.md）
    it('壊れていると 500', function (): void {
        getJson('/api/me/likes', ['Authorization' => 'Bearer abc'])->assertInternalServerError();
    });

    // 分かっている不具合：要件（FR-AUTH-013）は 401。JWT の例外をつかまえていない
    it('期限が切れていると 500（期限の中なら通るので、理由は期限）', function (): void {
        $me = DummyMember::create();
        $expired = DummyAuth::token($me, expiresAt: time() - 60);

        getJson('/api/me/likes', ['Authorization' => 'Bearer '.$expired])->assertInternalServerError();
        getJson('/api/me/likes', ['Authorization' => 'Bearer '.DummyAuth::token($me)])->assertOk();
    });
});
