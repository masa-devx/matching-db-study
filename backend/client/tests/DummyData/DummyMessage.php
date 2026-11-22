<?php

declare(strict_types=1);

namespace Tests\DummyData;

use App\Models\Message;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;

/**
 * テストのメッセージと、ルームを開いた（読んだ）状態を作る。ルームは先に DummyMatching::match() で作り、返った番号を渡す。
 * 日時の列は now() なので、時刻は travelTo() で止めてから呼ぶ。
 */
final class DummyMessage
{
    /** そのルームに、メッセージを1通送った状態（messages の1行） */
    public static function send(string $roomPublicId, TestUser $sender, string $body = 'こんにちは'): void
    {
        Message::create(['talk_room_id' => self::roomId($roomPublicId), 'sender_id' => $sender->id, 'body' => $body]);
    }

    /** その会員が、今の時刻にルームを開いた状態（自分の参加者の行の last_read_at を今にする）。それより前のメッセージは読んだことになる */
    public static function read(string $roomPublicId, TestUser $reader): void
    {
        TalkRoomMember::query()
            ->where('talk_room_id', self::roomId($roomPublicId))
            ->where('user_id', $reader->id)
            ->update(['last_read_at' => now()]);
    }

    private static function roomId(string $roomPublicId): int
    {
        return TalkRoom::query()->where('public_id', $roomPublicId)->valueOrFail('id');
    }
}
