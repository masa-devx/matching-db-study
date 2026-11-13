<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 有料のプラン（レガシー版。07）。期間（months）と今の値段（price。円）。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class Plan extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];
}
