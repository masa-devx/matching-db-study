<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
