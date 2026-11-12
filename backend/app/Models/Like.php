<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
