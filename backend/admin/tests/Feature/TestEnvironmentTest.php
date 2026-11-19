<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

// テストを流す環境（DB と表の作り方）が、決めたとおりかを確かめる。
// 表の作り方は tests/TestCase.php が、会員の側のマイグレーションを読み込んで決めている

test('テストは、管理画面のテスト用の DB（matching_admin_test）につながっている', function (): void {
    expect(DB::connection()->getDatabaseName())->toBe('matching_admin_test');
});

test('表は、会員の側のマイグレーションで作られている（管理画面は、マイグレーションを持たない）', function (): void {
    foreach (['users', 'profiles', 'admins', 'admin_audit_logs', 'messages', 'purchases', 'reports', 'report_cases'] as $table) {
        expect(DB::getSchemaBuilder()->hasTable($table))->toBeTrue("表 {$table} がない");
    }
});
