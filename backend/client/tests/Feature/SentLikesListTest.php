<?php

declare(strict_types=1);

use Illuminate\Support\Carbon;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\travelTo;
use function Tests\Support\actingAsMember;
use function Tests\Support\createBlock;
use function Tests\Support\createLike;
use function Tests\Support\createMatch;
use function Tests\Support\createMember;
use function Tests\Support\memberToken;

// GET /api/me/likes（送った相手の一覧。docs/api/02-likes.md）の、今の動きを確かめるテスト。
// tests/Support/ の関数だけで API テストを書けることを確かめる見本（#104）

it('送った相手の一覧は、新しい順に返る（FR-LIKE-005）', function () {
    $me = createMember(gender: 'male');
    $older = createMember(nickname: 'さき');
    $newer = createMember(nickname: 'ゆい');

    travelTo(Carbon::parse('2026-11-10 12:00:00'));
    createLike($me, $older);
    travelTo(Carbon::parse('2026-11-11 12:00:00'));
    createLike($me, $newer);

    $response = actingAsMember($me)->getJson('/api/me/likes');

    $response->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.user_id', $newer->publicId)
        ->assertJsonPath('0.nickname', 'ゆい')
        ->assertJsonPath('0.liked_at', '2026-11-11T12:00:00.000000Z')
        ->assertJsonPath('1.user_id', $older->publicId)
        ->assertJsonPath('1.nickname', 'さき')
        ->assertJsonPath('1.liked_at', '2026-11-10T12:00:00.000000Z');
    // 分かっている不具合：要件（FR-LIKE-005）は年齢（age）とプロフィール画像（avatar_url）だが、生年月日（birthday）と image をそのまま返す
    $response->assertJsonStructure(['*' => ['user_id', 'nickname', 'birthday', 'image', 'liked_at', 'matched']])
        ->assertJsonMissingPath('0.age')
        ->assertJsonMissingPath('0.avatar_url');
});

it('いいねを送っていなければ、送った相手の一覧は空の配列になる（FR-LIKE-005）', function () {
    $me = createMember();
    $other = createMember();
    createLike($other, $me);   // 自分がもらったいいねは、送った一覧に出ない

    actingAsMember($me)->getJson('/api/me/likes')
        ->assertOk()
        ->assertExactJson([]);
});

// 要件 ID はない（FR-BLOCK-007 は、もらった一覧と、いいねを送るときの要件）。
// 根拠は docs/api/06-blocks-withdrawal.md の「GET /api/me/likes」の行と、docs/requirements/blocks.md の「向きを問わない」
it('送った相手の一覧に、自分がブロックした相手も、自分をブロックした相手も出ない', function () {
    $me = createMember();
    $shown = createMember();
    $blockedByMe = createMember();
    $blockedMe = createMember();
    createLike($me, $shown);
    createLike($me, $blockedByMe);
    createLike($me, $blockedMe);
    createBlock($me, $blockedByMe);
    createBlock($blockedMe, $me);

    actingAsMember($me)->getJson('/api/me/likes')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.user_id', $shown->publicId);
    // 一覧から除くだけで、いいねの行は消さない（ブロックを解除したら、また出る）
    assertDatabaseHas('likes', ['from_user_id' => $me->id, 'to_user_id' => $blockedByMe->id]);
    assertDatabaseHas('likes', ['from_user_id' => $me->id, 'to_user_id' => $blockedMe->id]);
});

it('送った相手の一覧で、マッチした相手は matched が true、していない相手は false になる（FR-MATCH-006）', function () {
    $me = createMember();
    $matched = createMember();
    $notMatched = createMember();

    travelTo(Carbon::parse('2026-11-10 12:00:00'));
    createLike($me, $notMatched);
    travelTo(Carbon::parse('2026-11-11 12:00:00'));
    createMatch(likedFirst: $matched, likedBack: $me);

    actingAsMember($me)->getJson('/api/me/likes')
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.user_id', $matched->publicId)
        ->assertJsonPath('0.matched', true)
        ->assertJsonPath('1.user_id', $notMatched->publicId)
        ->assertJsonPath('1.matched', false);
});

it('トークンがなければ、送った相手の一覧は 401 になる（FR-LIKE-007）', function () {
    getJson('/api/me/likes')
        ->assertUnauthorized()
        ->assertExactJson(['message' => 'ログインしてください']);
});

// 要件 ID はない（FR-AUTH-013 は期限の要件。docs/api/01b-auth.md の表では、壊れたトークンも FR-AUTH-013 にまとめている）
it('壊れたトークンでは、送った相手の一覧は 500 になる', function () {
    // 分かっている不具合：401 になるべきだが、JWT の例外をつかまえていないので 500 になる（docs/api/02-likes.md）
    getJson('/api/me/likes', ['Authorization' => 'Bearer abc'])->assertStatus(500);
});

it('期限切れのトークンでは、送った相手の一覧は 500 になる（FR-AUTH-013）', function () {
    $me = createMember();
    $expired = memberToken($me, expiresAt: time() - 60);

    // 分かっている不具合：要件は 401 だが、JWT の例外をつかまえていないので 500 になる
    getJson('/api/me/likes', ['Authorization' => 'Bearer '.$expired])->assertStatus(500);
    // 期限の中のトークンなら通るので、500 の理由は期限
    getJson('/api/me/likes', ['Authorization' => 'Bearer '.memberToken($me)])->assertOk();
});
