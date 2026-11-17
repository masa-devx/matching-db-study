<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 通報の案件（レガシー版。M7・A7）。通報された会員ごとに、通報をまとめる。対応の状態（status）と、何をしたか（action）を持つ。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class ReportCase extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];
}
