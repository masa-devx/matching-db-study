<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 保存した検索条件（レガシー版。04b）。会員が、検索の条件に名前を付けて取っておく。
 * URL では public_id（UUID）で指す。どの列でも一括代入できる（user_id も書き換えられる。改善する段階で直す）。
 */
class SearchCondition extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * 持ち主の会員
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // jsonb の中身を、PHP の配列で読み書きする（中身の形は確かめない）
            'conditions' => 'array',
        ];
    }
}
