<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * トークルームの参加者（レガシー版。05）。ルームの中の一人ひとりの状態（最後に読んだ時刻）を持つ（D-023）。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class TalkRoomMember extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<TalkRoom, $this>
     */
    public function talkRoom(): BelongsTo
    {
        return $this->belongsTo(TalkRoom::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * 会員の参加者の行のうち、トークの一覧（GET /api/me/talk-rooms）に出るルームのもの。下のタブの数も、これで数える。
     * 今の一覧と同じく、ブロックした・された相手のルームを除く（FR-BLOCK-009）。
     * 分かっている不具合：退会した相手のルームは除かない（要件は FR-WD-006。今の一覧と同じ）。除くときは、ここと一覧の両方を直す
     *
     * @param  Builder<self>  $query
     */
    public function scopeListedFor(Builder $query, int $userId): void
    {
        $query->where('talk_room_members.user_id', $userId)
            ->whereNotExists(function (QueryBuilder $partner) use ($userId): void {
                $partner->selectRaw('1')
                    ->from('talk_room_members as partner')
                    ->whereColumn('partner.talk_room_id', 'talk_room_members.talk_room_id')
                    ->where('partner.user_id', '<>', $userId)
                    ->whereExists(Block::query()->between($userId, 'partner.user_id'));
            });
    }

    /**
     * 一覧に出るルームの、まだ読んでいない相手のメッセージ（1通で1行）。count() で、未読の合計になる（FR-MSG-009・FR-UI-032）。
     * 未読は、今の一覧の unread_count と同じく、最後に開いた時刻より新しいもの。まだ開いていなければ、相手のものを全部数える
     *
     * @param  Builder<self>  $query
     */
    public function scopeUnreadMessagesFor(Builder $query, int $userId): void
    {
        $query->listedFor($userId)
            ->join('messages', 'messages.talk_room_id', '=', 'talk_room_members.talk_room_id')
            ->where('messages.sender_id', '<>', $userId)
            ->where(function (Builder $unread): void {
                $unread->whereNull('talk_room_members.last_read_at')
                    ->orWhereColumn('messages.created_at', '>', 'talk_room_members.last_read_at');
            });
    }

    /**
     * 一覧に出るルームのうち、新しいマッチ（まだ一度も開いていなくて、まだ1通もない。docs/glossary.md・FR-UI-073）
     *
     * @param  Builder<self>  $query
     */
    public function scopeNewMatchesFor(Builder $query, int $userId): void
    {
        $query->listedFor($userId)
            ->whereNull('talk_room_members.last_read_at')
            ->whereNotExists(function (QueryBuilder $message): void {
                $message->selectRaw('1')
                    ->from('messages')
                    ->whereColumn('messages.talk_room_id', 'talk_room_members.talk_room_id');
            });
    }
}
