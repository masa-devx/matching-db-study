<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Feature のテストは、管理画面のテスト用の DB（matching_admin_test）に、会員の側のマイグレーションで表を作ってから、
// テストごとに巻き戻す（tests/TestCase.php）
pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');
