<?php

declare(strict_types=1);

namespace App\Listeners;

use Illuminate\Foundation\Events\MaintenanceModeEnabled;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * メンテナンスを入れたとき（php artisan down）に、会員のセッションを全部消し、全員をログアウトさせる（FR-MAINT-002）。
 * 消すのは表 sessions の行だけ。会員の認証がセッションに移るまで（D-027）は、JWT のログインは切れない。
 * Laravel が app/Listeners の handle() の型から、受ける出来事を見つける（登録は要らない）
 */
final class DeleteAllSessions
{
    public function handle(MaintenanceModeEnabled $event): void
    {
        $deleted = DB::table(config()->string('session.table'))->delete();

        // 全員をログアウトさせたことは、あとで問い合わせを調べるときに要るので info で残す（logging.md の7）
        Log::info('maintenance.deleteAllSessions', ['deleted' => $deleted]);
    }
}
