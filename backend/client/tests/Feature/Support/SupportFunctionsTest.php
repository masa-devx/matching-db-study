<?php

declare(strict_types=1);

use Illuminate\Support\Carbon;

use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\getJson;
use function Pest\Laravel\travelTo;
use function Tests\Support\actingAsMember;
use function Tests\Support\createBlock;
use function Tests\Support\createLike;
use function Tests\Support\createMatch;
use function Tests\Support\createMember;
use function Tests\Support\memberToken;

// tests/Support/functions.php の関数が、PHPDoc に書いたとおりの行を作ることを確かめる。
// API が作る行と同じ形かどうかは、ここでは比べない（それぞれの API の API テストで見る）

it('createMember は、確認済みの無料の会員とプロフィールを1行ずつ作る', function () {
    $member = createMember(gender: 'male', nickname: 'たろう');

    assertDatabaseCount('users', 1);
    assertDatabaseCount('profiles', 1);
    assertDatabaseHas('users', [
        'id' => $member->id,
        'public_id' => $member->publicId,
        'email' => $member->email,
        'is_paid' => false,
        'paid_until' => null,
        'deleted_at' => null,
        'suspended_at' => null,
    ]);
    assertDatabaseMissing('users', ['id' => $member->id, 'email_verified_at' => null]);
    assertDatabaseHas('profiles', ['user_id' => $member->id, 'gender' => 'male', 'nickname' => 'たろう']);
    expect($member->gender)->toBe('male')
        ->and($member->nickname)->toBe('たろう');
});

it('createMember は、引数で有料・退会・停止の会員を作る', function () {
    travelTo(Carbon::parse('2026-11-10 12:00:00'));

    $paid = createMember(paid: true);
    $withdrawn = createMember(withdrawn: true);
    $suspended = createMember(suspended: true);

    assertDatabaseHas('users', ['id' => $paid->id, 'is_paid' => true, 'paid_until' => '2026-12-10 12:00:00']);
    assertDatabaseHas('users', ['id' => $withdrawn->id, 'email' => $withdrawn->email, 'deleted_at' => '2026-11-10 12:00:00']);
    assertDatabaseHas('users', ['id' => $suspended->id, 'suspended_at' => '2026-11-10 12:00:00']);
    // PHPDoc に書いたとおり、購入の行と監査ログは作らない
    assertDatabaseCount('purchases', 0);
    assertDatabaseCount('admin_audit_logs', 0);
    // 退会した会員のメールアドレスは、退会の API と同じ形に書き換わっている
    expect($withdrawn->email)->toContain('#deleted#');
});

it('createLike と createBlock は、向きのとおりに1行ずつ作り、止めた時刻が created_at に入る', function () {
    $a = createMember();
    $b = createMember();
    travelTo(Carbon::parse('2026-11-10 12:00:00'));

    $likeId = createLike($a, $b);
    $blockId = createBlock($b, $a);

    assertDatabaseCount('likes', 1);
    assertDatabaseHas('likes', ['id' => $likeId, 'from_user_id' => $a->id, 'to_user_id' => $b->id, 'created_at' => '2026-11-10 12:00:00']);
    assertDatabaseCount('blocks', 1);
    assertDatabaseHas('blocks', ['id' => $blockId, 'blocker_id' => $b->id, 'blocked_id' => $a->id, 'created_at' => '2026-11-10 12:00:00']);
    assertDatabaseCount('user_matches', 0);
});

it('createMatch は、お互いのいいね・マッチ・トークルーム・参加者2人を作る', function () {
    $first = createMember();
    $back = createMember();

    $match = createMatch(likedFirst: $first, likedBack: $back);

    assertDatabaseCount('likes', 2);
    assertDatabaseHas('likes', ['from_user_id' => $first->id, 'to_user_id' => $back->id]);
    assertDatabaseHas('likes', ['from_user_id' => $back->id, 'to_user_id' => $first->id]);
    // 向きは、いいねを送る API と同じ：user1_id が送り返した人
    assertDatabaseCount('user_matches', 1);
    assertDatabaseHas('user_matches', ['id' => $match->id, 'user1_id' => $back->id, 'user2_id' => $first->id]);
    assertDatabaseHas('talk_rooms', ['id' => $match->talkRoomId, 'public_id' => $match->talkRoomPublicId, 'match_id' => $match->id]);
    assertDatabaseCount('talk_room_members', 2);
    assertDatabaseHas('talk_room_members', ['talk_room_id' => $match->talkRoomId, 'user_id' => $first->id]);
    assertDatabaseHas('talk_room_members', ['talk_room_id' => $match->talkRoomId, 'user_id' => $back->id]);
});

it('createMatch は、withTalkRoom が false ならトークルームを作らない', function () {
    $match = createMatch(createMember(), createMember(), withTalkRoom: false);

    assertDatabaseCount('user_matches', 1);
    assertDatabaseCount('talk_rooms', 0);
    expect($match->talkRoomId)->toBeNull()
        ->and($match->talkRoomPublicId)->toBeNull();
});

it('actingAsMember のあとのリクエストは、その会員として通る', function () {
    $me = createMember();
    createMember();

    actingAsMember($me)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('id', $me->id)
        ->assertJsonPath('email', $me->email);
});

it('memberToken に過去の期限を渡すと、期限切れのトークンになる（FR-AUTH-013）', function () {
    $me = createMember();
    $expired = memberToken($me, expiresAt: time() - 60);

    // 分かっている不具合：期限切れのトークンは、401（FR-AUTH-013）ではなく 500 になる（JWT の例外をつかまえていない）
    getJson('/api/me', ['Authorization' => 'Bearer '.$expired])->assertStatus(500);
    // 期限の中のトークンなら通るので、500 の理由は期限
    getJson('/api/me', ['Authorization' => 'Bearer '.memberToken($me)])->assertOk();
});
