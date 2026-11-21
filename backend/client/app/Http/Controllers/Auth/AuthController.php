<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/**
 * ログイン・ログアウト（FR-AUTH-010・016）。会員の認証は Sanctum の SPA 認証（セッション。D-027）。
 * 照合とアカウントの状態の確かめは AuthService、セッションを作る・消すのはここ（architecture-backend.md の2章）
 */
final class AuthController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    public function login(Request $request): JsonResponse
    {
        $user = $this->authService->login((string) $request->input('email'), (string) $request->input('password'));

        // ログインの状態を作る。Laravel の login() は、中でセッションの番号を作り直す（SessionGuard::updateSession() の regenerate(true)）。
        // ログインの前の番号を、ほかの人に使わせないため（FR-AUTH-010。LoginTest で確かめている）
        Auth::guard('web')->login($user);

        // 応答は GET /api/me と同じ形。JSON にトークンは入れない。
        // 分かっている不具合：FR-AUTH-017 の形でなく users の行を返す。Resource を作るときに、Profile/AccountController と一緒に直す
        return response()->json($user);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        // セッションの行を消し、新しい番号の Cookie に替え、CSRF のトークンも作り直す（同じ Cookie では、もう使えない。FR-AUTH-016）。
        // 画面のオリジンから来ていない（セッションのない）リクエストには、消すものがない
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->noContent();
    }
}
