<?php

declare(strict_types=1);

namespace App\Models;

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
}
