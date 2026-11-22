<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Endpoints;

use function Pest\Laravel\getJson;

// テストの環境の確かめと、動いているかの確かめ（GET /up。Laravel にもとからある。docs/api/00-health.md）。
// 会員の側で自分で作った GET /api/health は消した。消したことも確かめる

// テストで使う値。消した URL なので、Endpoints には置かない（呼ぶ API ではないため）
$removedHealthUrl = '/api/health';

// テストが開発用の DB（matching_dev）を作り直すのを止めるのは、tests/TestCase.php の安全装置（設定の値を見る）。
// このテストは、設定の値ではなく、実際につながっている DB を PostgreSQL に聞いて確かめる
describe('開発者が、テストを流す', function (): void {
    it('テストは実際にテスト用の PostgreSQL（matching_test）につながっている', function (): void {
        $actual = DB::selectOne('select current_database() as name')->name;

        expect($actual)->toBe('matching_test');
    });

    it('テストのメールは送らずに、メモリにためる', function (): void {
        expect(config('mail.default'))->toBe('array');
    });
});

/**
 * 正常系：要件が通す操作
 */
describe('監視や開発者が、会員の側の API が動いているかを確かめる', function (): void {
    it('動いていると分かる（200。中身は `status` だけで、DB の名前やマイグレーションの数は返さない）', function (): void {
        getJson(Endpoints::health())
            ->assertOk()
            ->assertExactJson(['status' => 'up']);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('監視や開発者が、前にあった GET /api/health を呼ぶ', function () use ($removedHealthUrl): void {
    it('もうないので、見つからない（404）', function () use ($removedHealthUrl): void {
        getJson($removedHealthUrl)->assertNotFound();
    });
});
