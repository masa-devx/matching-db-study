<?php

declare(strict_types=1);

namespace Tests\Support;

/**
 * テストで作ったマッチ。トークルームを作らなかったときは、ルームの2つが null。
 */
final readonly class TestMatch
{
    public function __construct(
        public int $id,                     // user_matches.id
        public ?int $talkRoomId,            // talk_rooms.id
        public ?string $talkRoomPublicId,   // talk_rooms.public_id（URL に出る ID）
    ) {}
}
