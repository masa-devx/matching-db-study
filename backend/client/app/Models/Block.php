<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ブロック（レガシー版。06）。blocker（ブロックした人）が blocked（された人）をブロックした。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class Block extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * @return BelongsTo<User, $this>
     */
    public function blocker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocker_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function blocked(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_id');
    }

    /**
     * 会員と相手のあいだのブロック（どちらの向きでも）。相手は、外のクエリの列（'likes.from_user_id' など）で渡す。
     * 一覧と数から、ブロックした・された相手を除くときに、whereNotExists() に渡す（FR-BLOCK-007・FR-BLOCK-009）
     *
     * @param  Builder<self>  $query
     */
    public function scopeBetween(Builder $query, int $userId, string $partnerIdColumn): void
    {
        $query->where(function (Builder $either) use ($userId, $partnerIdColumn): void {
            $either
                ->where(function (Builder $iBlocked) use ($userId, $partnerIdColumn): void {
                    $iBlocked->where('blocks.blocker_id', $userId)->whereColumn('blocks.blocked_id', $partnerIdColumn);
                })
                ->orWhere(function (Builder $blockedMe) use ($userId, $partnerIdColumn): void {
                    $blockedMe->whereColumn('blocks.blocker_id', $partnerIdColumn)->where('blocks.blocked_id', $userId);
                });
        });
    }
}
