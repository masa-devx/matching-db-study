<?php

declare(strict_types=1);

namespace App\Services\Profile;

use App\Exceptions\UserNotFoundException;
use App\Models\Profile;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\User;
use RuntimeException;

/**
 * 相手のプロフィールを見る・プロフィールを書き換える。
 * レガシー版の ProfileController から、動きを変えずに移した。直す所は「分かっている不具合」と書いた。
 * 名前：target は URL で指した会員、viewer はログインして見ている人。PublicId は UUID、Id は users.id。
 */
final class ProfileService
{
    /**
     * 会員1人とプロフィールを読む。見ている人（$viewerId）がいれば、2人のトークルームの番号も探す。
     * 退会・アカウント停止・強制退会の会員は、いない会員と同じに扱う（FR-WD-005・013）
     *
     * @return array{target: User, roomId: string|null}
     */
    public function showProfile(string $targetPublicId, ?int $viewerId): array
    {
        $target = User::query()->accountUsable()->where('public_id', $targetPublicId)->first()
            ?? throw new UserNotFoundException;
        $target->load('profile');

        return [
            'target' => $target,
            'roomId' => $viewerId === null ? null : $this->findSharedRoomId($viewerId, $target->id),
        ];
    }

    /**
     * プロフィールを書き換える。
     * 分かっている不具合：だれが送ったかを確かめず、送られた項目（$input）を全部入れる（FR-AUTH-022・FR-010）
     *
     * @param  array<string, mixed>  $input
     */
    public function updateProfile(string $targetPublicId, array $input): Profile
    {
        $targetId = User::query()->where('public_id', $targetPublicId)->value('id')
            ?? throw new UserNotFoundException;
        // 分かっている不具合：会員はいるがプロフィールがないときは、404 が望ましい。今の動き（500）のままにしている
        $profile = Profile::query()->where('user_id', $targetId)->first()
            ?? throw new RuntimeException('プロフィールが見つからない');
        $profile->update($input);

        return $profile;
    }

    /** 2人が参加しているトークルームの番号。なければ null。SQL はレガシー版と同じ3本。 */
    private function findSharedRoomId(int $viewerId, int $targetId): ?string
    {
        $viewerRoomIds = TalkRoomMember::query()->where('user_id', $viewerId)->pluck('talk_room_id');
        $sharedRoomId = TalkRoomMember::query()
            ->whereIn('talk_room_id', $viewerRoomIds)
            ->where('user_id', $targetId)
            ->value('talk_room_id');

        $roomPublicId = TalkRoom::query()->where('id', $sharedRoomId)->value('public_id');

        return is_string($roomPublicId) ? $roomPublicId : null;
    }
}
