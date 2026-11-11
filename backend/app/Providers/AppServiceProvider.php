<?php

declare(strict_types=1);

namespace App\Providers;

use App\Support\Logging\QueryLogger;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 流れた SQL をログに出す（手元だけ）。00 の解説「5. 見本」
        QueryLogger::register();
    }
}
