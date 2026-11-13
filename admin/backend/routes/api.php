<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// 12 管理画面の API。会員の側（backend/ の :8000）とは別のアプリ（:8100）
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => 'admin',
        'database' => DB::connection()->getDatabaseName(),
        // 表は会員の側と共通（マイグレーションは backend/ にまとめている）。会員の側が流した数
        'migrations' => DB::table('migrations')->count(),
    ]);
});
