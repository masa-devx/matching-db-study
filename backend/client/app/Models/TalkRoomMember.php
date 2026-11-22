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
     * トークの一覧（GET /api/me/talk-rooms）と、下のタブの数（GET /api/me/badge-counts）の両方が使う、一覧に出るルームの条件。
     * 会員の参加者の行のうち、相手が使える会員（User の accountUsable()。退会・アカウント停止・強制退会でない）で、
     * ブロックした・された相手でないルームのもの（FR-WD-006・FR-WD-014・FR-BLOCK-009）。
     * 相手の参加者の行がないルームは、入れない（一覧の API は、そのルームで 500 になる。前からある不具合）。
     * 一覧の古い TalkRoomController にも同じ条件を書いている。変えるときは、両方を直す
     *
     * @param  Builder<self>  $query
     */
    public function scopeListedFor(Builder $query, int $userId): void
    {
        $query->where('talk_room_members.user_id', $userId)
            ->whereExists(function (QueryBuilder $partner) use ($userId): void {
                $partner->selectRaw('1')
                    ->from('talk_room_members as partner')
                    ->whereColumn('partner.talk_room_id', 'talk_room_members.talk_room_id')
                    ->where('partner.user_id', '<>', $userId)
                    ->whereExists(User::query()->accountUsable()->whereColumn('users.id', 'partner.user_id'))
                    ->whereNotExists(Block::query()->between($userId, 'partner.user_id'));
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
