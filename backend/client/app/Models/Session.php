<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * 表 sessions の1行（会員の側のログインのセッション。1つの端末に1行）。行を作る・書き換えるのは Laravel（DatabaseSessionHandler）。
 * ここから行うのは、会員の行を消すことだけ（パスワードの変更・再設定・退会。docs/cycles/01-backend-foundation/03-how.md の「セッションを消す処理」）
 */
class Session extends Model
{
    /** 番号は Laravel が作る40文字（連番ではない） */
    protected $keyType = 'string';

    public $incrementing = false;

    /** 時刻は last_activity（UNIX の秒）だけで、created_at・updated_at はない */
    public $timestamps = false;

    /** @param  Builder<self>  $query */
    public function scopeOfUser(Builder $query, int $userId): void
    {
        $query->where('user_id', $userId);
    }

    /** @param  Builder<self>  $query */
    public function scopeExceptId(Builder $query, string $sessionId): void
    {
        $query->where('id', '<>', $sessionId);
    }
}
