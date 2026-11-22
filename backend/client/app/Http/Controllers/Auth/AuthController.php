<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Session\LoginSession;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * ログイン・ログアウト（FR-AUTH-010・016）。会員の認証は Sanctum の SPA 認証（セッション。D-027）。
 * 照合とアカウントの状態の確かめは AuthService、セッションを作る・消すのは LoginSession（architecture-backend.md の2章）
 */
final class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly LoginSession $loginSession,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $user = $this->authService->login((string) $request->input('email'), (string) $request->input('password'));

        // ログインの前の番号を、ほかの人に使わせないため、番号を作り直す（FR-AUTH-010。LoginTest で確かめている）
        $this->loginSession->start($user);

        // 応答は GET /api/me と同じ形。JSON にトークンは入れない。
        // 分かっている不具合：FR-AUTH-017 の形でなく users の行を返す。Resource を作るときに、Profile/AccountController と一緒に直す
        return response()->json($user);
    }

    public function logout(Request $request): Response
    {
        $this->loginSession->end($request);

        return response()->noContent();
    }
}
