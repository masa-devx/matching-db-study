<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * メッセージ（レガシー版。05）。やり取りの中身。受け取った人は持たない（ルームの参加者のうち、送った人でない人。D-023）。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class Message extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * @return BelongsTo<TalkRoom, $this>
     */
    public function talkRoom(): BelongsTo
    {
        return $this->belongsTo(TalkRoom::class);
    }

    /**
     * 送った会員
     *
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * 会員がまだ読んでいない、相手から届いたメッセージ。count() で、下のタブの未読の合計になる（FR-MSG-009・FR-UI-032）。
     * トークの一覧に出るルーム（TalkRoomMember::listedFor()）のもので、今の一覧の unread_count と同じく、
     * 会員が最後に開いた時刻より新しいもの。まだ開いていなければ、相手のものを全部数える。
     * 分かっている不具合：時刻は秒までなので、開いたのと同じ秒に届いたものは、読んだことになる（一覧も同じ）
     *
     * @param  Builder<self>  $query
     */
    public function scopeUnreadBy(Builder $query, int $userId): void
    {
        $query->where('messages.sender_id', '<>', $userId)
            ->whereExists(
                TalkRoomMember::query()
                    ->listedFor($userId)
                    ->whereColumn('talk_room_members.talk_room_id', 'messages.talk_room_id')
                    ->where(function (Builder $reader): void {
                        $reader->whereNull('talk_room_members.last_read_at')
                            ->orWhereColumn('messages.created_at', '>', 'talk_room_members.last_read_at');
                    }),
            );
    }
}
