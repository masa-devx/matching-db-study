<?php

declare(strict_types=1);

use App\Enums\AccountStatus;
use App\Exceptions\Auth\AccountSuspendedException;
use App\Exceptions\Auth\EmailUnverifiedException;
use App\Exceptions\Auth\LoginFailedException;
use App\Exceptions\Auth\LoginRefusedException;
use App\Exceptions\Auth\WrongCurrentPasswordException;
use App\Exceptions\BusinessException;
use App\Exceptions\UserNotFoundException;
use App\Http\Middleware\AuthenticateUser;
use App\Http\Middleware\EnsureUserEmailIsVerified;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // 画面（config の sanctum.stateful のオリジン）からのリクエストは、セッションの Cookie と CSRF のトークンで確かめる（Sanctum の SPA 認証。D-027）
        $middleware->statefulApi();
        $middleware->alias([
            'user.authenticate' => AuthenticateUser::class,   // ログインを確かめる。だめなら 401
            'user.verified' => EnsureUserEmailIsVerified::class,   // メールアドレスを確認したかを確かめる。だめなら 403（user.authenticate のあとに置く）
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // ログインの確かめと、今のパスワードの確かめで断ったこと（401・419・422）を、info で1行残す。理由・状態コード・ルートの形だけを書く。
        // 実際の URL・Cookie の値・セッションの番号は書かない（再設定の文字などが入るため。logging.md・FR-AUTH-032）
        $logRejected = function (Request $request, string $reason, int $status): void {
            Log::info('auth.rejected', ['reason' => $reason, 'status' => $status, 'path' => $request->route()?->uri() ?? 'unknown']);
        };

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // 業務の例外を、状態コードと文に変えるのはここだけ（architecture-backend.md の7章）。例外を足したら、ここに1行足す。文は lang/ja/errors.php
        $exceptions->render(fn (UserNotFoundException $e) => response()->json(['message' => __('errors.user_not_found')], 404));
        // メールアドレスを確認していない会員（EnsureUserEmailIsVerified が投げる）。文は理由を言わず、画面は code で見分ける
        $exceptions->render(fn (EmailUnverifiedException $e) => response()->json(['message' => __('errors.email_unverified'), 'code' => 'email_unverified'], 403));
        // アカウント停止された会員（AuthenticateUser が投げる）。画面が理由を出せるように、code を付ける
        $exceptions->render(function (AccountSuspendedException $e, Request $request) use ($logRejected) {
            $logRejected($request, 'account_suspended', 401);

            return response()->json(['message' => __('errors.account_suspended'), 'code' => 'account_suspended'], 401);
        });
        // ログインしていない・セッションが切れた・退会・強制退会（AuthenticateUser が投げる）。Laravel はもとから、この例外をエラーのログに出さない
        $exceptions->render(function (AuthenticationException $e, Request $request) use ($logRejected) {
            $logRejected($request, 'unauthenticated', 401);

            return response()->json(['message' => __('errors.unauthenticated')], 401);
        });
        // ログインの失敗（AuthService::login() が投げる）。分かっている不具合：要件は、どちらが違うかを教えない同じ文（FR-AUTH-011）
        $exceptions->render(fn (LoginFailedException $e) => response()->json(['message' => __('errors.'.$e->messageKey)], 401));
        // ログインを断った（アカウント停止・強制退会）。画面は code で見分ける
        $exceptions->render(fn (LoginRefusedException $e) => response()->json(match ($e->status) {
            AccountStatus::Banned => ['message' => __('errors.login_banned'), 'code' => 'account_banned'],
            default => ['message' => __('errors.login_suspended'), 'code' => 'account_suspended'],
        }, 403));

        // パスワードを変えるときに、今のパスワードが違う（PasswordService が投げる）。続けて試す人に気づけるよう、断ったことを残す。
        // 形は、同じ API の入力の誤り（ChangePasswordRequest の 422）とそろえ、errors に項目の名前を付ける。画面は errors で見分ける
        $exceptions->render(function (WrongCurrentPasswordException $e, Request $request) use ($logRejected) {
            $logRejected($request, 'wrong_current_password', 422);
            $message = __('errors.wrong_current_password');

            return response()->json(['message' => $message, 'errors' => ['current_password' => [$message]]], 422);
        });

        // メンテナンス中（php artisan down）。Laravel の PreventRequestsDuringMaintenance が投げる 503 の文を日本語にする。
        // リダイレクトはしない（画面は client.ts で 503 を見分ける）。Retry-After などのヘッダーは、そのまま返す
        //
        // 開発者がメンテナンスをするときの手順の要点。正は docs/commands.md の「会員の側のメンテナンス」（直すときは、そちらを先に直す）
        //   1. 入れる：docker compose exec app php artisan down --with-secret
        //      - 抜け道の文字は Laravel に作らせる。自分で決めた文字（--secret）は、シェルの履歴に残るので使わない（NFR-MAINT-001）
        //      - 会員の API は、どれも 503「ただいまメンテナンス中です」。表 sessions の行を全部消す（app/Listeners/DeleteAllSessions.php）
        //      - 「Failed to enter maintenance mode」と出ても、入っていることがある。DB が戻ってから、もう一度流す
        //   2. 確かめる：コマンドが出した URL を、どこにも貼らずにブラウザで開く（そのブラウザだけが、会員の画面を使える）
        //   3. 作業する（リリース・マイグレーション・認証の切り替えなど）
        //   4. 解く：docker compose exec app php artisan up。会員の画面を読み込み直して確かめる
        $exceptions->render(function (HttpException $e, Request $request) use ($logRejected) {
            // CSRF のトークンがない・合わない書き込み（FR-AUTH-018）。Laravel は TokenMismatchException を、先に 419 の HttpException に変えてから渡す。
            // 24時間でセッションが切れたあとの書き込みも、ここに来る（Sanctum は、ログインより先に CSRF を確かめる）
            if ($e->getStatusCode() === 419 && $e->getPrevious() instanceof TokenMismatchException) {
                $logRejected($request, 'csrf', 419);

                return response()->json(['message' => __('errors.csrf')], 419);
            }
            if ($e->getStatusCode() !== 503 || ! app()->isDownForMaintenance()) {
                return null;
            }

            return response()->json(['message' => __('errors.maintenance')], 503, $e->getHeaders());
        });

        // 業務の例外は、決まりどおりに断っただけなので、エラーのログに出さない。親の1つだけを書く
        $exceptions->dontReport([BusinessException::class]);
    })->create();
