<?php

declare(strict_types=1);

use Illuminate\Support\Carbon;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\travelTo;
use function Tests\Support\actingAsMember;
use function Tests\Support\createBlock;
use function Tests\Support\createLike;
use function Tests\Support\createMember;

// GET /api/me/likes（送った相手の一覧。docs/api/02-likes.md）の、今の動きを確かめるテスト。
// tests/Support/ の関数だけで API テストを書けることを確かめる見本（#104）

it('送った相手の一覧は、新しい順に返り、ブロックした相手は出ない（FR-LIKE-005・FR-BLOCK-007）', function () {
    $me = createMember(gender: 'male');
    $older = createMember(nickname: 'さき');
    $newer = createMember(nickname: 'ゆい');
    $blocked = createMember(nickname: 'れな');

    travelTo(Carbon::parse('2026-11-10 12:00:00'));
    createLike($me, $older);
    createLike($me, $blocked);
    travelTo(Carbon::parse('2026-11-11 12:00:00'));
    createLike($me, $newer);
    createLike($newer, $me);   // 相手からもいいねがあるので、matched が true になる
    createBlock($me, $blocked);

    $response = actingAsMember($me)->getJson('/api/me/likes');

    $response->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.user_id', $newer->publicId)
        ->assertJsonPath('0.nickname', 'ゆい')
        ->assertJsonPath('0.liked_at', '2026-11-11T12:00:00.000000Z')
        ->assertJsonPath('0.matched', true)
        ->assertJsonPath('1.user_id', $older->publicId)
        ->assertJsonPath('1.nickname', 'さき')
        ->assertJsonPath('1.liked_at', '2026-11-10T12:00:00.000000Z')
        ->assertJsonPath('1.matched', false);
    // 分かっている不具合：要件（FR-LIKE-005）は年齢（age）とプロフィール画像（avatar_url）だが、生年月日（birthday）と image をそのまま返す
    $response->assertJsonStructure(['*' => ['user_id', 'nickname', 'birthday', 'image', 'liked_at', 'matched']])
        ->assertJsonMissingPath('0.age');
    // ブロックした相手へのいいねは、消さずに残す（一覧から除くだけ）
    assertDatabaseHas('likes', ['from_user_id' => $me->id, 'to_user_id' => $blocked->id]);
});

it('トークンがなければ、送った相手の一覧は 401 になる（FR-LIKE-007）', function () {
    getJson('/api/me/likes')
        ->assertUnauthorized()
        ->assertExactJson(['message' => 'ログインしてください']);
});
