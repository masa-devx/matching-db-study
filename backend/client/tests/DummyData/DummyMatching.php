<?php

declare(strict_types=1);

namespace Tests\DummyData;

use App\Models\Block;
use App\Models\Like;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\UserMatch;

/**
 * テストのいいね・ブロック・マッチ・トークルームを作る。
 * 会員は先に DummyMember::create() で作る。
 */
final class DummyMatching
{
    /** $from から $to へのいいねを1つ作り、likes.id を返す。マッチは作らない。 */
    public static function like(TestMember $from, TestMember $to): int
    {
        return Like::create(['from_user_id' => $from->id, 'to_user_id' => $to->id])->id;
    }

    /** $blocker が $blocked をブロックした行を作り、blocks.id を返す。 */
    public static function block(TestMember $blocker, TestMember $blocked): int
    {
        return Block::create(['blocker_id' => $blocker->id, 'blocked_id' => $blocked->id])->id;
    }

    /**
     * 2人がマッチした状態（お互いのいいね・マッチ・トークルーム）を作る。いいねもここで作るので、先に like() しない。
     * 行の向きは、いいねを送る API と同じ（user1_id が送り返した人）。Firestore には書かない。
     */
    public static function match(TestMember $likedFirst, TestMember $likedBack, bool $withTalkRoom = true): TestMatch
    {
        self::like($likedFirst, $likedBack);
        self::like($likedBack, $likedFirst);
        $match = UserMatch::create(['user1_id' => $likedBack->id, 'user2_id' => $likedFirst->id]);

        if (! $withTalkRoom) {
            return new TestMatch($match->id, talkRoomId: null, talkRoomPublicId: null);
        }

        $room = self::openTalkRoom($match->id, $likedFirst, $likedBack);

        return new TestMatch($match->id, $room->id, $room->public_id);
    }

    /** トークルームと、参加者2人の行を作る。public_id は DB が入れるので、読み直して返す。 */
    private static function openTalkRoom(int $matchId, TestMember ...$members): TalkRoom
    {
        $room = TalkRoom::create(['match_id' => $matchId]);
        foreach ($members as $member) {
            TalkRoomMember::create(['talk_room_id' => $room->id, 'user_id' => $member->id]);
        }

        return $room->refresh();
    }
}
