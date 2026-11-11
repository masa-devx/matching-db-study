<?php

namespace Tests;

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * テスト用の DB 以外につながっていたら、RefreshDatabase が表を消す前に止める。
     * 00 で、テストが開発用の DB（matching_dev）を作り直したことがあるため。
     */
    public function createApplication(): Application
    {
        $app = parent::createApplication();

        $connection = $app['config']->get('database.default');
        $database = $app['config']->get("database.connections.{$connection}.database");

        if ($connection !== 'pgsql' || $database !== 'matching_test') {
            throw new RuntimeException(
                "テストはテスト用の DB（pgsql・matching_test）だけで動かす。今の接続先は {$connection}・{$database}。phpunit.xml の <server> と <env> を確かめる",
            );
        }

        return $app;
    }
}
