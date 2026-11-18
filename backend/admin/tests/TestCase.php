<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Database\Migrations\Migrator;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * 表の作り（マイグレーション）の置き場。管理画面は、マイグレーションを持たない（表は、会員の側と共通）。
     * 正本は backend/client/database/migrations の1か所。テストの前に、ここを指して表を作る
     * （docs/cycles/01-backend-foundation/03-how.md の「管理画面のテストの DB と表の作り方」の案 A）。
     */
    private const MIGRATIONS = __DIR__.'/../../client/database/migrations';

    /**
     * テスト用の DB 以外につながっていたら、RefreshDatabase が表を消す前に止める（会員の側と同じ仕組み）。
     * 会員の側のテスト用（matching_test）につながっていても止める。同時に流すと、表の作り直しがぶつかるため。
     */
    public function createApplication(): Application
    {
        $app = parent::createApplication();

        $connection = $app['config']->get('database.default');
        $database = $app['config']->get("database.connections.{$connection}.database");

        if ($connection !== 'pgsql' || $database !== 'matching_admin_test') {
            throw new RuntimeException(
                "管理画面のテストは、テスト用の DB（pgsql・matching_admin_test）だけで動かす。今の接続先は {$connection}・{$database}。phpunit.xml の <server> と <env> を確かめる",
            );
        }

        $path = realpath(self::MIGRATIONS);
        if ($path === false) {
            throw new RuntimeException('会員の側のマイグレーション（backend/client/database/migrations）が見つからない。表を作れない');
        }
        // migrate:fresh が読む置き場に、会員の側のマイグレーションを足す。
        // Laravel の中の作り（'migrator' という名前で解決されること・RefreshDatabase が migrator を通ること）に頼っている。
        // 効かなくなったら、tests/Feature/Support/SupportFunctionsTest.php の「表は、会員の側のマイグレーションで
        // 作られている」が落ちる（このテストが、この仕組みを見張っている）。
        // テストを並列で流すとき・テストの中で migrate を呼ぶときに足りるかは、確かめていない
        $app->afterResolving('migrator', static function (Migrator $migrator) use ($path): void {
            $migrator->path($path);
        });

        return $app;
    }
}
