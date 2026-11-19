<?php

declare(strict_types=1);

namespace App\Services\Profile;

use App\Models\Profile;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\User;
use RuntimeException;

/**
 * 相手のプロフィールを見る・プロフィールを書き換える。
 * レガシー版の ProfileController から、動きを変えずに移した。直す所は「分かっている不具合」と書いた。
 */
final class ProfileService
{
    /**
     * 会員1人とプロフィールを読む。見ている人（$viewerId）がいれば、2人のトークルームの番号も探す。
     *
     * @return array{member: User, roomId: string|null}
     */
    public function showFor(string $publicId, ?int $viewerId): array
    {
        // 分かっている不具合：見つからないときを Laravel に任せていて、応答に Model の名前が出る（architecture.md の7章）
        $member = User::query()->where('public_id', $publicId)->firstOrFail();
        $member->load('profile');

        return [
            'member' => $member,
            'roomId' => $viewerId === null ? null : $this->findSharedRoomId($viewerId, $member->id),
        ];
    }

    /**
     * プロフィールを書き換える。
     * 分かっている不具合：だれが送ったかを確かめず、送られた項目（$input）を全部入れる（FR-AUTH-022・FR-010）
     *
     * @param  array<string, mixed>  $input
     */
    public function update(string $publicId, array $input): Profile
    {
        $memberId = User::query()->where('public_id', $publicId)->value('id');
        // 分かっている不具合：見つからないときは 404 が望ましい。今の動き（500）のままにしている
        $profile = Profile::query()->where('user_id', $memberId)->first()
            ?? throw new RuntimeException('プロフィールが見つからない');
        $profile->fill($input)->save();

        return $profile;
    }

    /** 2人が参加しているトークルームの番号。なければ null。SQL はレガシー版と同じ3本。 */
    private function findSharedRoomId(int $viewerId, int $memberId): ?string
    {
        $viewerRoomIds = TalkRoomMember::query()->where('user_id', $viewerId)->pluck('talk_room_id');
        $sharedRoomId = TalkRoomMember::query()
            ->whereIn('talk_room_id', $viewerRoomIds)
            ->where('user_id', $memberId)
            ->value('talk_room_id');

        $roomPublicId = TalkRoom::query()->where('id', $sharedRoomId)->value('public_id');

        return is_string($roomPublicId) ? $roomPublicId : null;
    }
}
