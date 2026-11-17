<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * スキップ（レガシー版。M3）。skipper（スキップした人）が skipped（された人）を見送った。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class Skip extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];
}
