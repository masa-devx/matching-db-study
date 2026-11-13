<?php

declare(strict_types=1);

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\FirebaseTokenController;
use App\Http\Controllers\LikeController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\TalkRoomController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\UserMatchController;
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

// 01 会員とプロフィール（docs/api/01-members.md）。#46 で、パスを UUID（public_id）にし、/profile を外した
Route::get('/users/{publicId}', [ProfileController::class, 'show']);
Route::put('/users/{publicId}', [ProfileController::class, 'update']);

// 01b 登録とメールアドレスの確認（docs/api/01b-auth.md）。レガシー版は、だれでも使える
Route::post('/users', [UserController::class, 'store']);
// 04 相手を探す（docs/api/04-search.md）。レガシー版は、コントローラの中で JWT を読む
Route::get('/users', [UserController::class, 'index']);
Route::get('/email-verifications/{token}', [EmailVerificationController::class, 'show']);
Route::post('/email-verifications', [EmailVerificationController::class, 'store']);

// 01b ログイン・自分の情報・ログアウト（docs/api/01b-auth.md）。レガシー版は、JWT を JSON で返す
Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/me', [AuthController::class, 'me']);
Route::post('/auth/logout', [AuthController::class, 'logout']);

// 02 いいね（docs/api/02-likes.md）。レガシー版は、コントローラの中で JWT を読む
Route::post('/me/likes', [LikeController::class, 'store']);
Route::get('/me/likes', [LikeController::class, 'index']);

// 03 マッチ（docs/api/03-matches.md）。送るときのマッチは LikeController::store が作る
Route::get('/me/matches', [UserMatchController::class, 'index']);

// 05 メッセージ（docs/api/05-messages.md）。ルームはマッチしたときに LikeController::store が作る。
// レガシー版は、コントローラの中で JWT を読み、ルームの参加者かを確かめない
Route::get('/me/talk-rooms', [TalkRoomController::class, 'index']);
Route::get('/me/talk-rooms/{publicId}/messages', [MessageController::class, 'index']);
Route::post('/me/talk-rooms/{publicId}/messages', [MessageController::class, 'store']);

// 05c Firestore と比べる（docs/api/05c-firestore.md）。画面が手元の Firebase Emulator にログインするトークン。
// ルームと受信箱は、マッチしたときに LikeController::store が Firestore にも作る
Route::post('/me/firebase-token', [FirebaseTokenController::class, 'store']);

Route::post('/me/blocks', [BlockController::class, 'store']);
Route::get('/me/blocks', [BlockController::class, 'index']);
Route::delete('/me/blocks/{publicId}', [BlockController::class, 'destroy']);
Route::delete('/me', [UserController::class, 'destroy']);

Route::get('/plans', [PlanController::class, 'index']);
Route::post('/me/purchases', [PurchaseController::class, 'store']);
Route::get('/me/purchases', [PurchaseController::class, 'index']);
