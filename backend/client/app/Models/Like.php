<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * いいね（レガシー版。02）。from_user_id から to_user_id へ。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class Like extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * いいねを送った会員
     *
     * @return BelongsTo<User, $this>
     */
    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    /**
     * いいねをもらった会員
     *
     * @return BelongsTo<User, $this>
     */
    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    /**
     * 会員の届いたいいね（まだ返事をしていないもの。docs/glossary.md）。届いたいいねの一覧（GET /api/me/received-likes）に出るもの。
     * 下のタブの数も、これで数える。今の一覧と同じく、送り返した相手（マッチした相手）・ブロックした／された相手・スキップした相手を除く
     * （FR-LIKE-010・FR-BLOCK-007・FR-LIKE-012）。
     * 分かっている不具合：退会した相手のいいねは除かない（要件は FR-WD-006。今の一覧と同じ）。除くときは、ここと一覧の両方を直す
     *
     * @param  Builder<self>  $query
     */
    public function scopeReceivedBy(Builder $query, int $userId): void
    {
        $query->where('likes.to_user_id', $userId)
            ->whereNotExists(function (QueryBuilder $likedBack) use ($userId): void {
                $likedBack->selectRaw('1')
                    ->from('likes as liked_back')
                    ->where('liked_back.from_user_id', $userId)
                    ->whereColumn('liked_back.to_user_id', 'likes.from_user_id');
            })
            ->whereNotExists(Block::query()->between($userId, 'likes.from_user_id'))
            ->whereNotExists(function (QueryBuilder $skip) use ($userId): void {
                $skip->selectRaw('1')
                    ->from('skips')
                    ->where('skips.skipper_id', $userId)
                    ->whereColumn('skips.skipped_id', 'likes.from_user_id');
            });
    }
}
