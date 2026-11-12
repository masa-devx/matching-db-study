<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * マッチ（レガシー版。03）。お互いにいいねした2人の組を1行で持つ。
 * `match` は PHP の予約語なので UserMatch にした。表は Laravel の決まりどおり user_matches。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class UserMatch extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * 組の1人目（レガシー版は、いいねを送り返した会員）
     *
     * @return BelongsTo<User, $this>
     */
    public function user1(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user1_id');
    }

    /**
     * 組の2人目（レガシー版は、先にいいねを送っていた会員）
     *
     * @return BelongsTo<User, $this>
     */
    public function user2(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user2_id');
    }
}
