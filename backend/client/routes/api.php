<?php

declare(strict_types=1);

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\FirebaseTokenController;
use App\Http\Controllers\LikeController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NoticeController;
use App\Http\Controllers\PasswordController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\ReceivedLikeController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SearchConditionController;
use App\Http\Controllers\SkipController;
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

// 04b 保存した検索条件（docs/api/04b-saved-searches.md）。検索そのもの（GET /users）は変えない
Route::get('/me/search-conditions', [SearchConditionController::class, 'index']);
Route::post('/me/search-conditions', [SearchConditionController::class, 'store']);
Route::put('/me/search-conditions/{publicId}', [SearchConditionController::class, 'update']);
Route::delete('/me/search-conditions/{publicId}', [SearchConditionController::class, 'destroy']);

// M1 設定画面（#181）。パスワードを変える（docs/api/01b-auth.md）
Route::put('/me/password', [PasswordController::class, 'update']);

// M3 届いたいいねと、スキップ（#184。docs/api/02-likes.md）。送り返すのは、今ある POST /me/likes
Route::get('/me/received-likes', [ReceivedLikeController::class, 'index']);
Route::post('/me/skips', [SkipController::class, 'store']);
Route::get('/me/skips', [SkipController::class, 'index']);
Route::delete('/me/skips/{publicId}', [SkipController::class, 'destroy']);

// M2 パスワードを忘れたときの再設定（#196。docs/api/01b-auth.md）。ログインしていない人が使う
Route::post('/password-resets', [PasswordResetController::class, 'store']);
Route::put('/password-resets/{token}', [PasswordResetController::class, 'update']);

// M7 通報する（#202。docs/api/m7-reports.md）。見る・対応するのは、管理画面の側（backend/admin）
Route::post('/me/reports', [ReportController::class, 'store']);

// A7 運営からのお知らせ（#213。docs/api/m7-reports.md）。送るのは、管理画面の側
Route::get('/me/notices', [NoticeController::class, 'index']);
Route::post('/me/notices/{publicId}/read', [NoticeController::class, 'read']);
