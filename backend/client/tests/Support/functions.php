<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Models\Block;
use App\Models\Like;
use App\Models\Profile;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\User;
use App\Models\UserMatch;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\TestCase;

use function Pest\Laravel\withHeader;

/*
 * API テストのデータと、ログインした状態を作る関数（agents/rules/architecture.md の10章）。
 * Model と Factory を呼ぶのはこのファイルだけ。Model を移すときは、ここの use だけを書き換える。
 * 日時の列には now() が入るので、決まった日時にしたいときは、呼ぶ前に travelTo()（Pest\Laravel の関数。$this->travelTo() と同じ）で時刻を止める。
 */

/** 作った会員のパスワード（UserFactory と同じ） */
const MEMBER_PASSWORD = 'password';

/**
 * 会員（users とプロフィール）を1人作る。メールアドレスは確認済み。
 *
 * @param  'male'|'female'  $gender
 * @param  bool  $paid  有料会員（is_paid が true。期限は今から30日）
 * @param  bool  $withdrawn  退会した（UserController::destroy と同じく、deleted_at を入れ、メールアドレスを書き換える）
 * @param  bool  $suspended  管理画面で利用を止めた（suspended_at を入れる）
 */
function createMember(
    string $gender = 'female',
    bool $paid = false,
    bool $withdrawn = false,
    bool $suspended = false,
    ?string $nickname = null,
): TestMember {
    $user = User::factory()->create([
        'is_paid' => $paid,
        'paid_until' => $paid ? now()->addDays(30) : null,
        'suspended_at' => $suspended ? now() : null,
        'suspended_reason' => $suspended ? 'テストで止めた' : null,
    ]);

    if ($withdrawn) {
        $user->update([
            'email' => $user->email.'#deleted#'.now()->getTimestamp(),
            'deleted_at' => now(),
        ]);
    }

    $profile = Profile::factory()->create(array_filter([
        'user_id' => $user->id,
        'gender' => $gender,
        'nickname' => $nickname,
    ], fn (mixed $value): bool => $value !== null));

    // public_id は DB の既定の値（uuidv7()）で入るので、読み直す
    $user->refresh();

    return new TestMember(
        id: $user->id,
        publicId: $user->public_id,
        email: $user->email,
        nickname: $profile->nickname,
        gender: $profile->gender,
    );
}

/**
 * $from から $to へのいいねを1つ作る。マッチは作らない（マッチも要るときは createMatch()）。
 *
 * @return int likes.id
 */
function createLike(TestMember $from, TestMember $to): int
{
    return Like::create(['from_user_id' => $from->id, 'to_user_id' => $to->id])->id;
}

/**
 * $blocker が $blocked をブロックした行を作る。
 *
 * @return int blocks.id
 */
function createBlock(TestMember $blocker, TestMember $blocked): int
{
    return Block::create(['blocker_id' => $blocker->id, 'blocked_id' => $blocked->id])->id;
}

/**
 * 2人がマッチした状態を作る：お互いのいいね・マッチ・（既定で）トークルームと参加者2人。
 * 行の向きは LikeController::store と同じ（user1_id が送り返した人・user2_id が先に送った人）。
 * Firestore には書かない（Firestore まで確かめるテストは、API を呼んでマッチさせる）。
 *
 * @param  TestMember  $likedFirst  先にいいねを送った会員
 * @param  TestMember  $likedBack  送り返した会員
 */
function createMatch(TestMember $likedFirst, TestMember $likedBack, bool $withTalkRoom = true): TestMatch
{
    createLike($likedFirst, $likedBack);
    createLike($likedBack, $likedFirst);

    $match = UserMatch::create(['user1_id' => $likedBack->id, 'user2_id' => $likedFirst->id]);

    if (! $withTalkRoom) {
        return new TestMatch($match->id, null, null);
    }

    $room = TalkRoom::create(['match_id' => $match->id]);
    TalkRoomMember::create(['talk_room_id' => $room->id, 'user_id' => $likedFirst->id]);
    TalkRoomMember::create(['talk_room_id' => $room->id, 'user_id' => $likedBack->id]);
    $room->refresh();

    return new TestMatch($match->id, $room->id, $room->public_id);
}

/**
 * ログインしたときと同じ作りのトークン（JWT）を作る（AuthController::login と同じ中身・同じ鍵）。
 * ログインの API は呼ばない（呼ぶと last_login_at が変わり、テストの前提が動くため）。
 *
 * @param  int|null  $expiresAt  期限（UNIX 時間）。期限切れを確かめるときに、過去の値を渡す。渡さなければ今から30日
 */
function memberToken(TestMember $member, ?int $expiresAt = null): string
{
    // 期限は本物の時計で決める。JWT のライブラリは time() を見るので、travelTo() で止めた時刻は効かない
    return JWT::encode([
        'sub' => $member->id,
        'email' => $member->email,
        'nickname' => $member->nickname,
        'iat' => time(),
        'exp' => $expiresAt ?? time() + 60 * 60 * 24 * 30,
    ], (string) config('app.key'), 'HS256');
}

/**
 * その会員としてログインした状態にする。このあとのリクエストに Authorization が付く。
 * 使い方：actingAsMember($member)->getJson('/api/me')
 */
function actingAsMember(TestMember $member): TestCase
{
    return withHeader('Authorization', 'Bearer '.memberToken($member));
}
