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

// routes/api.php の全部のルート：ログインが要る API は断り、要らない API（Endpoints::routesWithoutLogin()）は断らないか。
// メールアドレスの確認が要る API も、同じく全部のルートで見る（Endpoints::routesWithoutVerifiedEmail()）。期待の中身は各 API のテスト

/**
 * routes/api.php の全部のルート（「メソッド ルートの形」と、呼ぶ URL）。URL の {…} は、形の正しい、だれのものでもない UUID にする。
 *
 * @return list<array{string, string}>
 */
function apiRoutes(): array
{
    $routes = [];
    /** @var RouteDefinition $route */
    foreach (Route::getRoutes()->getRoutes() as $route) {
        if (! str_starts_with($route->uri(), 'api/')) {
            continue;
        }
        foreach ($route->methods() as $method) {
            if ($method === 'HEAD') {
                continue;
            }
            $url = '/'.preg_replace('/\{[^}]+\}/', DummyUser::MISSING_PUBLIC_ID, $route->uri());
            $routes[] = ["{$method} {$route->uri()}", $url];
        }
    }

    return $routes;
}

/**
 * ログインが要るルート（ログインが要らない一覧にないもの）。新しいルートは、何もしなければここに入る。
 *
 * @return list<array{string, string}>
 */
function loginRequiredRoutes(): array
{
    return array_values(array_filter(
        apiRoutes(),
        fn (array $route): bool => ! in_array($route[0], Endpoints::routesWithoutLogin(), true),
    ));
}

/**
 * メールアドレスの確認が要るルート（ログインが要るルートのうち、確認していなくても呼べる一覧にないもの）。
 *
 * @return list<array{string, string}>
 */
function verifiedEmailRequiredRoutes(): array
{
    return array_values(array_filter(
        loginRequiredRoutes(),
        fn (array $route): bool => ! in_array($route[0], Endpoints::routesWithoutVerifiedEmail(), true),
    ));
}

/**
 * 渡したルートを全部呼び、期待と違う応答だったルートを「メソッド URL → 状態」で返す。
 *
 * @param  list<array{string, string}>  $routes
 * @param  callable(string, string): TestResponse<Response>  $call
 * @param  callable(TestResponse<Response>): bool  $isExpected
 * @return list<string>
 */
function routesWithUnexpectedResponse(array $routes, callable $call, callable $isExpected): array
{
    $unexpected = [];
    foreach ($routes as [$route, $url]) {
        $method = strtok($route, ' ');
        // 1本ごとにセーブポイントまで戻す。戻さないと、次の2つで、あとのルートの結果が変わる：
        // SQL のエラーが1つ起きると、同じトランザクションのそのあとの SQL が全部失敗する（25P02）／退会など、成功した書き込みが残る
        DB::beginTransaction();
        try {
            $response = $call((string) $method, $url);
        } finally {
            DB::rollBack();
        }
        if (! $isExpected($response)) {
            $unexpected[] = "{$method} {$url} → {$response->status()}";
        }
    }

    return $unexpected;
}

/** @param  TestResponse<Response>  $response */
function isRejectedAsEmailUnverified(TestResponse $response): bool
{
    return $response->status() === 403
        && $response->json('code') === 'email_unverified'
        && $response->json('message') === 'この機能は使えません';
}

/** @param  TestResponse<Response>  $response */
function isRejectedAsSuspended(TestResponse $response): bool
{
    return $response->status() === 401 && $response->json('code') === 'account_suspended';
}

/** @param  TestResponse<Response>  $response */
function isRejectedAsNotLoggedIn(TestResponse $response): bool
{
    return $response->status() === 401 && $response->json('message') === 'ログインしてください';
}

it('ログインが要るルートを、routes/api.php から読めている（20本を超え、自分の情報の API を含む）', function (): void {
    $routes = array_column(loginRequiredRoutes(), 0);

    expect(count($routes))->toBeGreaterThan(20)
        ->and($routes)->toContain('GET api/me');
});

describe('ログインしていない人が、ログインが要る API を呼ぶ', function (): void {
    it('トークンがなければ、どれも使えない（401「ログインしてください」。FR-AUTH-024・FR-LIKE-007・FR-BLOCK-014・FR-MSG-012）', function (): void {
        $unexpected = routesWithUnexpectedResponse(
            loginRequiredRoutes(),
            fn (string $method, string $url): TestResponse => json($method, $url),
            isRejectedAsNotLoggedIn(...),
        );

        expect($unexpected)->toBe([]);
    });

    it('壊れたトークンでも、どれも使えない（401「ログインしてください」。FR-AUTH-024）', function (): void {
        $unexpected = routesWithUnexpectedResponse(
            loginRequiredRoutes(),
            fn (string $method, string $url): TestResponse => DummyAuth::withToken('abc.def.ghi')->json($method, $url),
            isRejectedAsNotLoggedIn(...),
        );

        expect($unexpected)->toBe([]);
    });

    it('期限の切れたトークンでも、どれも使えない（401「ログインしてください」。FR-AUTH-024）', function (): void {
        $token = DummyAuth::token(DummyUser::create(), expiresAt: time() - 60);

        $unexpected = routesWithUnexpectedResponse(
            loginRequiredRoutes(),
            fn (string $method, string $url): TestResponse => DummyAuth::withToken($token)->json($method, $url),
            isRejectedAsNotLoggedIn(...),
        );

        expect($unexpected)->toBe([]);
    });
});

describe('アカウント停止された会員が、前にもらったトークンで、ログインが要る API を呼ぶ', function (): void {
    it('どれも使えず、停止されていると知らされる（401「このアカウントは停止されています」。NFR-AUTH-001）', function (): void {
        $loginUser = DummyUser::create(suspended: true);

        $unexpected = routesWithUnexpectedResponse(
            loginRequiredRoutes(),
            fn (string $method, string $url): TestResponse => DummyAuth::actingAs($loginUser)->json($method, $url),
            isRejectedAsSuspended(...),
        );

        expect($unexpected)->toBe([]);
    });
});

describe('ログインした会員が、ログインが要る API を呼ぶ', function (): void {
    // 使える会員まで断る壊れ方を見つける。Middleware の付け忘れは、上の断る側のテストが見つける（付け忘れも 401 以外になるため）
    it('どれもログインしていない扱いにならない（401 にならない。中身の成功・失敗は、それぞれの API のテストで確かめる）', function (): void {
        $loginUser = DummyUser::create();

        $unexpected = routesWithUnexpectedResponse(
            loginRequiredRoutes(),
            fn (string $method, string $url): TestResponse => DummyAuth::actingAs($loginUser)->json($method, $url),
            fn (TestResponse $response): bool => $response->status() !== 401,
        );

        expect($unexpected)->toBe([]);
    });
});

describe('ログインしていない人が、ログインが要らない API を呼ぶ', function (): void {
    it('一覧の API は、どれも routes/api.php にある（消したあとの行や、打ち間違いが残らない）', function (): void {
        $missing = array_values(array_diff(Endpoints::routesWithoutLogin(), array_column(apiRoutes(), 0)));

        expect($missing)->toBe([]);
    });

    // 状態コードでは見ない。ログインの失敗も 401（「メールアドレスかパスワードが違います」など）を返すため
    it('トークンがなくても、どれも「ログインしてください」で断られない（FR-AUTH-024）', function (): void {
        $withoutLogin = array_values(array_filter(
            apiRoutes(),
            fn (array $route): bool => in_array($route[0], Endpoints::routesWithoutLogin(), true),
        ));

        $unexpected = routesWithUnexpectedResponse(
            $withoutLogin,
            fn (string $method, string $url): TestResponse => json($method, $url),
            fn (TestResponse $response): bool => ! isRejectedAsNotLoggedIn($response),
        );

        expect($withoutLogin)->toHaveCount(count(Endpoints::routesWithoutLogin()))
            ->and($unexpected)->toBe([]);
    });
});

describe('メールアドレスを確認していない会員が、確認が要る API を呼ぶ', function (): void {
    it('どれも使えない（403「この機能は使えません」。理由は言わず、code で見分ける。FR-AUTH-021・不変条件 2）', function (): void {
        $loginUser = DummyUser::create(unverified: true);

        $unexpected = routesWithUnexpectedResponse(
            verifiedEmailRequiredRoutes(),
            fn (string $method, string $url): TestResponse => DummyAuth::actingAs($loginUser)->json($method, $url),
            isRejectedAsEmailUnverified(...),
        );

        expect($unexpected)->toBe([]);
    });
});

describe('メールアドレスを確認していない会員が、確認しなくても使える API を呼ぶ', function (): void {
    it('確認しなくても使える API は、自分の情報とログアウトだけ（FR-AUTH-021）', function (): void {
        expect(Endpoints::routesWithoutVerifiedEmail())->toBe(['GET api/me', 'POST api/auth/logout']);
    });

    it('一覧の API は、どれも routes/api.php のログインが要るルートにある', function (): void {
        $missing = array_values(array_diff(Endpoints::routesWithoutVerifiedEmail(), array_column(loginRequiredRoutes(), 0)));

        expect($missing)->toBe([]);
    });

    it('自分の情報・ログアウトは、使える（200。FR-AUTH-021）', function (): void {
        $loginUser = DummyUser::create(unverified: true);
        $withoutVerifiedEmail = array_values(array_filter(
            loginRequiredRoutes(),
            fn (array $route): bool => in_array($route[0], Endpoints::routesWithoutVerifiedEmail(), true),
        ));

        $unexpected = routesWithUnexpectedResponse(
            $withoutVerifiedEmail,
            fn (string $method, string $url): TestResponse => DummyAuth::actingAs($loginUser)->json($method, $url),
            fn (TestResponse $response): bool => $response->status() === 200,
        );

        expect($withoutVerifiedEmail)->toHaveCount(count(Endpoints::routesWithoutVerifiedEmail()))
            ->and($unexpected)->toBe([]);
    });
});

describe('メールアドレスを確認した会員が、確認が要る API を呼ぶ', function (): void {
    it('どれも、確認していないとして断られない（FR-AUTH-021）', function (): void {
        $loginUser = DummyUser::create();

        $unexpected = routesWithUnexpectedResponse(
            verifiedEmailRequiredRoutes(),
            fn (string $method, string $url): TestResponse => DummyAuth::actingAs($loginUser)->json($method, $url),
            fn (TestResponse $response): bool => ! isRejectedAsEmailUnverified($response),
        );

        expect($unexpected)->toBe([]);
    });
});

describe('メールアドレスを確認しておらず、アカウント停止もされた会員が、確認が要る API を呼ぶ', function (): void {
    // ログインの確かめ（user.authenticate）が先に動くので、アカウント停止が先に知らされる（NFR-AUTH-001）
    it('アカウント停止が先に知らされる（401「このアカウントは停止されています」）', function (): void {
        $loginUser = DummyUser::create(suspended: true, unverified: true);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($loginUser->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'このアカウントは停止されています', 'code' => 'account_suspended']);
    });
});
