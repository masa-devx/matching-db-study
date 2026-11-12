<?php

declare(strict_types=1);

use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\UserController;
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

// 01 会員とプロフィール（docs/api/01-members.md）
Route::get('/users/{id}/profile', [ProfileController::class, 'show']);
Route::put('/users/{id}/profile', [ProfileController::class, 'update']);

// 01b 登録とメールアドレスの確認（docs/api/01b-auth.md）。レガシー版は、だれでも使える
Route::post('/users', [UserController::class, 'store']);
Route::get('/email-verifications/{token}', [EmailVerificationController::class, 'show']);
Route::post('/email-verifications', [EmailVerificationController::class, 'store']);
