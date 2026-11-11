<?php

use Illuminate\Support\Facades\DB;

use function Pest\Laravel\getJson;

// テストが開発用の DB（matching_dev）を作り直すのを止めるのは、tests/TestCase.php の安全装置（設定の値を見る）。
// このテストは、設定の値ではなく、実際につながっている DB を PostgreSQL に聞いて確かめる
it('テストは実際にテスト用の PostgreSQL（matching_test）につながっている', function () {
    $actual = DB::selectOne('select current_database() as name')->name;

    expect($actual)->toBe('matching_test');
});

it('テストのメールは送らずに、メモリにためる', function () {
    expect(config('mail.default'))->toBe('array');
});

it('/api/health は DB につながり、マイグレーションの数を返す', function () {
    $migrations = DB::table('migrations')->count();

    getJson('/api/health')
        ->assertOk()
        ->assertExactJson([
            'status' => 'ok',
            'database' => 'matching_test',
            'migrations' => $migrations,
        ]);

    expect($migrations)->toBeGreaterThan(0);
});
