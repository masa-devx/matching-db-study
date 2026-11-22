<?php

declare(strict_types=1);

namespace Tests\DummyData;

use App\Models\Block;
use App\Models\Like;
use App\Models\Skip;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\UserMatch;

/**
 * テストのいいね・スキップ・ブロック・マッチとトークルームを作る（業務のまとまり Matching の行）。
 * 会員は先に DummyUser::create() で作る。
 */
final class DummyMatching
{
    /**
     * 2人がマッチした状態（お互いのいいね・マッチ・トークルームと参加者2人）を作り、トークルームの番号（public_id）を返す。
     * 行の向きは、いいねを送る API と同じ（user1_id が送り返した人）。Firestore には書かない。
     */
    public static function match(TestUser $likedFirst, TestUser $likedBack): string
    {
        self::like($likedFirst, $likedBack);
        self::like($likedBack, $likedFirst);
        $match = UserMatch::create(['user1_id' => $likedBack->id, 'user2_id' => $likedFirst->id]);

        $room = TalkRoom::create(['match_id' => $match->id]);
        foreach ([$likedFirst, $likedBack] as $user) {
            TalkRoomMember::create(['talk_room_id' => $room->id, 'user_id' => $user->id]);
        }

        return $room->refresh()->public_id;   // public_id は DB が入れるので、読み直す
    }

    /** いいねを1つ送った状態（likes の1行だけ）。送り返していなければ、相手の届いたいいねに出る */
    public static function like(TestUser $from, TestUser $to): void
    {
        Like::create(['from_user_id' => $from->id, 'to_user_id' => $to->id]);
    }

    /** スキップした状態（skips の1行）。いいねの API と同じく、相手には伝えない */
    public static function skip(TestUser $skipper, TestUser $skipped): void
    {
        Skip::create(['skipper_id' => $skipper->id, 'skipped_id' => $skipped->id]);
    }

    /** ブロックした状態（blocks の1行）。マッチ・トークルーム・いいねは消さない（ブロックの API と同じ） */
    public static function block(TestUser $blocker, TestUser $blocked): void
    {
        Block::create(['blocker_id' => $blocker->id, 'blocked_id' => $blocked->id]);
    }
}
