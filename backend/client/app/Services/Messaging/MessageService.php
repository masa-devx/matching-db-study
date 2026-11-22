<?php

declare(strict_types=1);

namespace App\Services\Messaging;

use App\Models\Message;
use App\Models\TalkRoomMember;

/**
 * トークルームとメッセージ（業務のまとまり Messaging。docs/backend.md の移行の地図の MessageService）。
 * 今は、下のタブの数（GET /api/me/badge-counts）だけを置く。トークの一覧・履歴・送るは、移すときにここに足す
 */
final class MessageService
{
    /** 相手から届いて、まだ読んでいないメッセージの合計（FR-UI-032）。数える条件は Message の unreadBy() */
    public function countUnreadMessages(int $userId): int
    {
        return Message::query()->unreadBy($userId)->count();
    }

    /** 新しいマッチ（まだ一度も開いていなくて、まだ1通もないルーム）の数（FR-UI-073） */
    public function countNewMatches(int $userId): int
    {
        return TalkRoomMember::query()->newMatchesFor($userId)->count();
    }
}
