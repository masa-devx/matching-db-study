<?php

declare(strict_types=1);

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Services\Profile\AccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** 自分のアカウントを見る（GET /api/me。FR-AUTH-017。名前は docs/glossary.md の「アカウント」） */
final class AccountController extends Controller
{
    public function __construct(private readonly AccountService $accountService) {}

    public function show(Request $request): JsonResponse
    {
        // 分かっている不具合：FR-AUTH-017 の形（会員の ID・メールアドレス・確認したか）でなく、users の行を返す。
        // Resource を作るときに、ログインの応答（Auth/AuthController@login）と一緒に直す
        return response()->json($this->accountService->showAccount($this->loginUserId($request)));
    }
}
