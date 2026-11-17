<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 通報（レガシー版。M7）。reporter（通報した人）が reported（された人）を、理由を付けて運営に伝えた。message_id は、指したメッセージ（なくてよい）。
 * どの列でも一括代入できる（改善する段階で直す）。
 */
class Report extends Model
{
    /**
     * @var list<string>
     */
    protected $guarded = [];
}
