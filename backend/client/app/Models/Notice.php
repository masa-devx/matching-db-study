<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 運営から会員へのお知らせ（レガシー版。A7。#213）。kind は warning（注意）か info（お知らせ）。read_at が空なら、まだ読んでいない。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class Notice extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];
}
