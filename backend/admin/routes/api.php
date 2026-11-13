<?php

declare(strict_types=1);

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\SuspensionController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// 12 管理画面の API。会員の側（backend/client の :8000）とは別のアプリ（:8100）。docs/api/12-admin.md
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => 'admin',
        'database' => DB::connection()->getDatabaseName(),
        // 表は会員の側と共通（マイグレーションは backend/client にまとめている）。会員の側が流した数
        'migrations' => DB::table('migrations')->count(),
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/me', [AuthController::class, 'me']);
Route::get('/dashboard', [DashboardController::class, 'index']);
Route::get('/members', [MemberController::class, 'index']);
Route::get('/members/{publicId}', [MemberController::class, 'show']);
Route::post('/members/{publicId}/suspension', [SuspensionController::class, 'store']);
Route::delete('/members/{publicId}/suspension', [SuspensionController::class, 'destroy']);
Route::get('/messages', [MessageController::class, 'index']);
Route::get('/purchases', [SalesController::class, 'purchases']);
Route::get('/sales/monthly', [SalesController::class, 'monthly']);
Route::get('/plans', [PlanController::class, 'index']);
Route::put('/plans/{id}', [PlanController::class, 'update']);
Route::get('/audit-logs', [AuditLogController::class, 'index']);
