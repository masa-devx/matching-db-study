<?php

use Illuminate\Support\Facades\DB;

use function Pest\Laravel\getJson;

// テストが開発用の DB（matching_dev）を作り直さないことを守る。
// phpunit.xml の force="true" を外すと、compose の環境変数の matching_dev につながり、このテストが落ちる
it('テストはテスト用の PostgreSQL（matching_test）につながる', function () {
    expect(DB::connection()->getDriverName())->toBe('pgsql')
        ->and(DB::connection()->getDatabaseName())->toBe('matching_test');
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
