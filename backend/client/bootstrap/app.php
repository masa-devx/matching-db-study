<?php

declare(strict_types=1);

use App\Exceptions\BusinessException;
use App\Exceptions\UserNotFoundException;
use App\Http\Middleware\AuthenticateUser;
use Illuminate\Auth\AuthenticationException;
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
            'user.authenticate' => AuthenticateUser::class,   // ログインを確かめる。だめなら 401
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // 業務の例外を、状態コードと文に変えるのはここだけ（architecture-backend.md の7章）。例外を足したら、ここに1行足す。文は lang/ja/errors.php
        $exceptions->render(fn (UserNotFoundException $e) => response()->json(['message' => __('errors.user_not_found')], 404));
        // ログインしていない・止めた会員など（AuthenticateUser が投げる）。Laravel はもとから、この例外をエラーのログに出さない
        $exceptions->render(fn (AuthenticationException $e) => response()->json(['message' => __('errors.unauthenticated')], 401));

        // 業務の例外は、決まりどおりに断っただけなので、エラーのログに出さない。親の1つだけを書く
        $exceptions->dontReport([BusinessException::class]);
    })->create();
