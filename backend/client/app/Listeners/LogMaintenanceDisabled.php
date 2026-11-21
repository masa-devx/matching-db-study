<?php

declare(strict_types=1);

namespace App\Listeners;

use Illuminate\Foundation\Events\MaintenanceModeDisabled;
use Illuminate\Support\Facades\Log;

/**
 * メンテナンスを解いたとき（php artisan up）に、ログに1行残す。
 * 入れたときの maintenance.deleteAllSessions と合わせて、「何時から何時まで使えなかったか」を答えられるようにする
 */
final class LogMaintenanceDisabled
{
    public function handle(MaintenanceModeDisabled $event): void
    {
        Log::info('maintenance.disabled');
    }
}
