<?php

declare(strict_types=1);

// アーキテクチャのテスト（agents/rules/architecture.md の8章）。層の依存の向き・名前・final・strict_types を確かめる。
// 新しい層（App\Domain・App\Application・App\Infrastructure）にファイルがまだないあいだは、当てはまるものがなく、どれも通る。
// 移したファイルが、決まりを破ったときに落ちる

// まだ移していない古いファイル。この2つの一覧が、そのまま移行の残り。移したら消す。
// ignoring に渡すのは古いコントローラーだけ。ignoring は、渡した名前で始まる「使われる側」の依存も消すので、
// App\Models を渡すと、新しいコードが App\Models を使っても落ちなくなる
const LEGACY_CONTROLLERS = [
    'App\\Http\\Controllers\\AuthController',
    'App\\Http\\Controllers\\BlockController',
    'App\\Http\\Controllers\\EmailVerificationController',
    'App\\Http\\Controllers\\FirebaseTokenController',
    'App\\Http\\Controllers\\LikeController',
    'App\\Http\\Controllers\\MessageController',
    'App\\Http\\Controllers\\NoticeController',
    'App\\Http\\Controllers\\PasswordController',
    'App\\Http\\Controllers\\PasswordResetController',
    'App\\Http\\Controllers\\PlanController',
    'App\\Http\\Controllers\\ProfileController',
    'App\\Http\\Controllers\\PurchaseController',
    'App\\Http\\Controllers\\ReceivedLikeController',
    'App\\Http\\Controllers\\ReportController',
    'App\\Http\\Controllers\\SearchConditionController',
    'App\\Http\\Controllers\\SkipController',
    'App\\Http\\Controllers\\TalkRoomController',
    'App\\Http\\Controllers\\UserController',
    'App\\Http\\Controllers\\UserMatchController',
];
const LEGACY_MODELS = 'App\Models';   // 移行の残り（app/Models）。ignoring には渡さない

const LARAVEL_HELPERS = ['now', 'today', 'config', 'env', 'app', 'collect', 'abort', 'response', 'request', 'logger', 'info'];

arch('Domain はほかの層・Laravel・Carbon・基盤を使わない', function (): void {
    expect('App\Domain')
        ->not->toUse(['App\Http', 'App\Application', 'App\Infrastructure', 'App\Models', 'App\Support', 'Illuminate', 'Carbon']);
});

arch('Application は Http・Infrastructure・Laravel・Carbon・基盤を使わない', function (): void {
    expect('App\Application')
        ->not->toUse(['App\Http', 'App\Infrastructure', 'App\Models', 'App\Support', 'Illuminate', 'Carbon']);
});

// 層の側から「使わない」と書く。expect() に関数の一覧・toBeUsedIn() に層の一覧、と両方に配列を渡す書き方は、
// 違反があっても通ってしまう（#106 で、Domain に now()・Application に config() を置いて確かめた）
arch('Domain は Laravel のヘルパー関数を使わない', function (): void {
    expect('App\Domain')
        ->not->toUse(LARAVEL_HELPERS);
});

arch('Application は Laravel のヘルパー関数を使わない', function (): void {
    expect('App\Application')
        ->not->toUse(LARAVEL_HELPERS);
});

arch('Http が使ってよい Infrastructure は QueryService だけ', function (): void {
    expect('App\Http')
        ->not->toUse(['App\Infrastructure\Models', 'App\Infrastructure\Repositories', 'App\Infrastructure\External', 'App\Infrastructure\Transaction', 'App\Infrastructure\Clock', LEGACY_MODELS])
        ->ignoring(LEGACY_CONTROLLERS);
});

arch('Infrastructure は UseCase と Http を使わない', function (): void {
    expect('App\Infrastructure')
        ->not->toUse(['App\Application\UseCases', 'App\Http']);
});

arch('QueryService は Application・Repository・Domain を使わない', function (): void {
    expect('App\Infrastructure\QueryServices')
        ->not->toUse(['App\Application', 'App\Infrastructure\Repositories', 'App\Domain']);   // ID は int で受け取る
});

arch('Domain の interface は Interface で終わる', function (): void {
    expect('App\Domain')
        ->interfaces()
        ->toHaveSuffix('Interface');

    // 1つの arch() に1つの期待。鎖の2つ目以降には classes() の絞り込みが効かないため
});
arch('UseCase は final', function (): void {
    expect('App\Application\UseCases')
        ->classes()
        ->toBeFinal();
});

arch('UseCase は UseCase で終わる', function (): void {
    expect('App\Application\UseCases')
        ->classes()
        ->toHaveSuffix('UseCase');
});

arch('QueryService のフォルダのクラス（QueryService と読み取りの DTO）は final', function (): void {
    expect('App\Infrastructure\QueryServices')
        ->classes()
        ->toBeFinal();
});

arch('新しい層のファイルは strict_types', function (): void {
    expect(['App\Http', 'App\Application', 'App\Domain', 'App\Infrastructure', 'App\Support'])
        ->toUseStrictTypes()
        ->ignoring(LEGACY_CONTROLLERS);
});
