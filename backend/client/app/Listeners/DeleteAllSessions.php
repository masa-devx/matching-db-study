<?php

declare(strict_types=1);

namespace App\Listeners;

use Illuminate\Foundation\Events\MaintenanceModeEnabled;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * メンテナンスを入れたとき（php artisan down）に、会員のセッションを全部消し、全員をログアウトさせる（FR-MAINT-002）。
 * 消すのは表 sessions の行だけ。会員の認証がセッションに移るまで（D-027）は、JWT のログインは切れない。
 * 表 sessions には、会員のセッションだけを入れる。管理画面をセッションでのログインに移すときは、別の表にする（FR-MAINT-005。管理者まで追い出さないため）。
 * Laravel が app/Listeners の handle() の型から、受ける出来事を見つける（登録は要らない）
 */
final class DeleteAllSessions
{
    public function handle(MaintenanceModeEnabled $event): void
    {
        // Laravel のセッションと同じ接続で消す（session.connection が空なら、いつもの接続）
        $connection = config('session.connection');
        $deleted = DB::connection(is_string($connection) ? $connection : null)
            ->table(config()->string('session.table'))
            ->delete();

        // 全員をログアウトさせたことは、あとで問い合わせを調べるときに要るので info で残す（logging.md の7）
        Log::info('maintenance.deleteAllSessions', ['deleted' => $deleted]);
    }
}
