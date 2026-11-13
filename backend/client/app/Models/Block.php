<?php

declare(strict_types=1);

namespace App\Models;

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
}
