<?php

declare(strict_types=1);

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// 動いているかと、DB につながるかを確かめる（00）。流した SQL が sql のログに出る
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'database' => DB::connection()->getDatabaseName(),
        'migrations' => DB::table('migrations')->count(),
    ]);
});

// 01 会員とプロフィール（docs/api.md）
Route::get('/users/{id}/profile', [ProfileController::class, 'show']);
Route::put('/users/{id}/profile', [ProfileController::class, 'update']);
