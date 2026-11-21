<?php

declare(strict_types=1);

use Illuminate\Routing\Route as RouteDefinition;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpFoundation\Response;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\json;

// ログインが要る API の全部に、ログインを確かめる Middleware（user.authenticate）が付いているか。
// 調べるルートは routes/api.php から読む。ログインが要らないルートは Endpoints::routesWithoutLogin() の1か所にだけ書く。
// 1本ずつの中身（何を返すか）は、それぞれの API のテストで確かめる。ここでは、断るかどうかだけを見る

/**
 * ログインが要るルート（メソッドと、呼ぶ URL）。URL の {…} は、形の正しい、だれのものでもない UUID にする。
 *
 * @return list<array{string, string}>
 */
function loginRequiredRoutes(): array
{
    $withoutLogin = Endpoints::routesWithoutLogin();
    $routes = [];
    /** @var RouteDefinition $route */
    foreach (Route::getRoutes()->getRoutes() as $route) {
        if (! str_starts_with($route->uri(), 'api/')) {
            continue;
        }
        foreach ($route->methods() as $method) {
            if ($method === 'HEAD' || in_array("{$method} {$route->uri()}", $withoutLogin, true)) {
                continue;
            }
            $url = '/'.preg_replace('/\{[^}]+\}/', DummyUser::MISSING_PUBLIC_ID, $route->uri());
            $routes[] = [$method, $url];
        }
    }

    return $routes;
}

/**
 * ログインが要るルートを全部呼び、期待と違う応答だったルートを「メソッド URL → 状態」で返す。
 *
 * @param  callable(string, string): TestResponse<Response>  $call
 * @param  callable(TestResponse<Response>): bool  $isExpected
 * @return list<string>
 */
function routesWithUnexpectedResponse(callable $call, callable $isExpected): array
{
    $unexpected = [];
    foreach (loginRequiredRoutes() as [$method, $url]) {
        // 1本ごとにセーブポイントまで戻す。PostgreSQL は、SQL のエラーが1つ起きると、同じトランザクションの
        // そのあとの SQL を全部失敗にする（25P02）ため、戻さないと、あとのルートが全部 500 に見える
        DB::beginTransaction();
        $response = $call($method, $url);
        DB::rollBack();
        if (! $isExpected($response)) {
            $unexpected[] = "{$method} {$url} → {$response->status()}";
        }
    }

    return $unexpected;
}

/** @param  TestResponse<Response>  $response */
function isRejectedAsNotLoggedIn(TestResponse $response): bool
{
    return $response->status() === 401 && $response->json('message') === 'ログインしてください';
}

it('ログインが要るルートが、1本以上ある（ルートを読めているかの確かめ）', function (): void {
    expect(count(loginRequiredRoutes()))->toBeGreaterThan(20);
});

describe('ログインしていない人が、ログインが要る API を呼ぶ', function (): void {
    it('トークンがなければ、どれも 401「ログインしてください」（FR-AUTH-024）', function (): void {
        $unexpected = routesWithUnexpectedResponse(
            fn (string $method, string $url): TestResponse => json($method, $url),
            isRejectedAsNotLoggedIn(...),
        );

        expect($unexpected)->toBe([]);
    });

    it('壊れたトークンでも、どれも 401「ログインしてください」（FR-AUTH-024）', function (): void {
        $unexpected = routesWithUnexpectedResponse(
            fn (string $method, string $url): TestResponse => DummyAuth::withToken('abc.def.ghi')->json($method, $url),
            isRejectedAsNotLoggedIn(...),
        );

        expect($unexpected)->toBe([]);
    });
});

describe('停止させられた会員が、前にもらったトークンで、ログインが要る API を呼ぶ', function (): void {
    it('どれも 401「ログインしてください」（NFR-AUTH-001）', function (): void {
        $loginUser = DummyUser::create(suspended: true);

        $unexpected = routesWithUnexpectedResponse(
            fn (string $method, string $url): TestResponse => DummyAuth::actingAs($loginUser)->json($method, $url),
            isRejectedAsNotLoggedIn(...),
        );

        expect($unexpected)->toBe([]);
    });
});

describe('ログインした会員が、ログインが要る API を呼ぶ', function (): void {
    it('どれも 401 にならない（中身の成功・失敗は、それぞれの API のテストで確かめる）', function (): void {
        $loginUser = DummyUser::create();

        $unexpected = routesWithUnexpectedResponse(
            fn (string $method, string $url): TestResponse => DummyAuth::actingAs($loginUser)->json($method, $url),
            fn (TestResponse $response): bool => $response->status() !== 401,
        );

        expect($unexpected)->toBe([]);
    });
});
