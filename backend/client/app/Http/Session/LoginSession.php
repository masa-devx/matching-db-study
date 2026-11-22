<?php

declare(strict_types=1);

namespace App\Http\Session;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * 会員のログインのセッション（Sanctum の SPA 認証。D-027）を、作る・作り直す・消す所。セッションを触る処理は、ここにだけ書く。
 * Controller は、これを呼ぶだけにする（architecture-backend.md の2章）。表 sessions の、ほかの端末の行を消すのは Service（DB の操作）。
 * ログインしている会員を読むのは Middleware（AuthenticateUser）
 */
final class LoginSession
{
    /** ログインの状態を作る。Laravel の login() は、中でセッションの番号を作り直す（SessionGuard::updateSession() の regenerate(true)） */
    public function start(Authenticatable $user): void
    {
        Auth::guard('web')->login($user);
    }

    /**
     * ログアウトする。セッションの行を消し、新しい番号の Cookie に替え、CSRF のトークンも作り直す（同じ Cookie では、もう使えない。FR-AUTH-016）。
     * 画面のオリジンから来ていない（セッションのない）リクエストには、消すものがない
     */
    public function end(Request $request): void
    {
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
    }
}
