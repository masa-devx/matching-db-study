<?php

declare(strict_types=1);

use App\Exceptions\BusinessException;
use App\Exceptions\Users\UserNotFoundException;
use App\Http\Middleware\IdentifyUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'user.identify' => IdentifyUser::class,   // トークンがあれば会員の番号を載せる。なくても通す
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // 業務の例外を、状態コードと文に変えるのはここだけ（architecture.md の7章）。例外を足したら、ここに1行足す
        $exceptions->render(fn (UserNotFoundException $e) => response()->json(['message' => '会員が見つかりません'], 404));

        // 業務の例外は、決まりどおりに断っただけなので、エラーのログに出さない。親の1つだけを書く
        $exceptions->dontReport([BusinessException::class]);
    })->create();
