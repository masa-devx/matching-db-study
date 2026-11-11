<?php

declare(strict_types=1);

namespace App\Support\Logging;

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * 流れた SQL を、1本ずつと、リクエストの終わりにまとめて、sql チャンネルに書く。
 * N+1 を見つけるため、1回のリクエストで何本流れたかを数える。
 * 値（bindings）にはメールアドレスやパスワードのハッシュが入るので、書かない。
 */
class QueryLogger
{
    private static int $count = 0;

    private static float $totalMs = 0.0;

    private static string $requestId = '';

    public static function register(): void
    {
        // 値を書かないとしても、SQL の形から中身が推し量れるので、手元だけで動かす
        if (! app()->environment('local')) {
            return;
        }

        self::$count = 0;
        self::$totalMs = 0.0;
        self::$requestId = (string) Str::uuid();

        DB::listen(function (QueryExecuted $query): void {
            self::$count++;
            self::$totalMs += $query->time;

            Log::channel('sql')->debug('db.query', [
                'requestId' => self::$requestId,
                'n' => self::$count,
                'ms' => $query->time,
                'sql' => $query->sql,
                'connection' => $query->connectionName,
            ]);
        });

        app()->terminating(function (): void {
            if (self::$count === 0) {
                return;
            }

            Log::channel('sql')->info('db.summary', [
                'requestId' => self::$requestId,
                'path' => app()->runningInConsole() ? 'console' : request()->method().' '.request()->path(),
                'queries' => self::$count,
                'ms' => round(self::$totalMs, 2),
            ]);
        });
    }
}
