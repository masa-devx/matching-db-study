<?php

declare(strict_types=1);

use App\Exceptions\Auth\AccountSuspendedException;
use App\Exceptions\Auth\EmailUnverifiedException;
use App\Exceptions\BusinessException;
use App\Exceptions\UserNotFoundException;
use App\Http\Middleware\AuthenticateUser;
use App\Http\Middleware\EnsureUserEmailIsVerified;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'user.authenticate' => AuthenticateUser::class,   // ログインを確かめる。だめなら 401
            'user.verified' => EnsureUserEmailIsVerified::class,   // メールアドレスを確認したかを確かめる。だめなら 403（user.authenticate のあとに置く）
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // 業務の例外を、状態コードと文に変えるのはここだけ（architecture-backend.md の7章）。例外を足したら、ここに1行足す。文は lang/ja/errors.php
        $exceptions->render(fn (UserNotFoundException $e) => response()->json(['message' => __('errors.user_not_found')], 404));
        // メールアドレスを確認していない会員（EnsureUserEmailIsVerified が投げる）。文は理由を言わず、画面は code で見分ける
        $exceptions->render(fn (EmailUnverifiedException $e) => response()->json(['message' => __('errors.email_unverified'), 'code' => 'email_unverified'], 403));
        // アカウント停止された会員（AuthenticateUser が投げる）。画面が理由を出せるように、code を付ける
        $exceptions->render(fn (AccountSuspendedException $e) => response()->json(['message' => __('errors.account_suspended'), 'code' => 'account_suspended'], 401));
        // ログインしていない・アカウント停止された会員など（AuthenticateUser が投げる）。Laravel はもとから、この例外をエラーのログに出さない
        $exceptions->render(fn (AuthenticationException $e) => response()->json(['message' => __('errors.unauthenticated')], 401));

        // メンテナンス中（php artisan down）。Laravel の PreventRequestsDuringMaintenance が投げる 503 の文を日本語にする。
        // リダイレクトはしない（画面は client.ts で 503 を見分ける）。Retry-After などのヘッダーは、そのまま返す
        //
        // 開発者がメンテナンスをするときの手順（docs/requirements/maintenance.md・docs/commands.md の「会員の側のメンテナンス」）
        //   1. 抜け道の文字を決める。ログ・チケット・PR・コミットには書かない（NFR-MAINT-001）
        //   2. 入れる：docker compose exec app php artisan down --secret="<抜け道の文字>"
        //      - 会員の API は、どれも 503「ただいまメンテナンス中です」になり、画面はメンテナンスの画面を出す
        //      - 表 sessions の行を全部消す（app/Listeners/DeleteAllSessions.php。消した数はログの maintenance.deleteAllSessions）
        //      - 管理画面（backend/admin）は止まらない
        //   3. 確かめる：http://localhost:8000/<抜け道の文字> を開くと、そのブラウザ（curl なら Cookie を -c で受け取り -b で送る）だけが使える
        //   4. 作業する（リリース・マイグレーション・認証の切り替えなど）。抜け道のブラウザで、会員の側が動くかを確かめる
        //   5. 解く：docker compose exec app php artisan up
        //   6. 確かめる：会員の画面を読み込み直し、いつもどおり使えるか
        // ログインが切れるのは、会員の認証がセッション（D-027）に移ってから。それまでは JWT のログインが残り、解いたあとも、ログインしたまま戻る
        $exceptions->render(function (HttpException $e) {
            if ($e->getStatusCode() !== 503 || ! app()->isDownForMaintenance()) {
                return null;
            }

            return response()->json(['message' => __('errors.maintenance')], 503, $e->getHeaders());
        });

        // 業務の例外は、決まりどおりに断っただけなので、エラーのログに出さない。親の1つだけを書く
        $exceptions->dontReport([BusinessException::class]);
    })->create();
