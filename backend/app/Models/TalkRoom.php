<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * トークルーム（レガシー版。05）。やり取りの場所で、マッチしたときに1つ作る（D-023）。
 * URL では public_id（UUID）で指す。どの列でも一括代入できる（改善する段階で直す）。
 */
class TalkRoom extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * このルームを作ったマッチ
     *
     * @return BelongsTo<UserMatch, $this>
     */
    public function userMatch(): BelongsTo
    {
        return $this->belongsTo(UserMatch::class, 'match_id');
    }

    /**
     * 参加者（マッチした2人）
     *
     * @return HasMany<TalkRoomMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(TalkRoomMember::class);
    }

    /**
     * やり取りしたメッセージ
     *
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }
}
