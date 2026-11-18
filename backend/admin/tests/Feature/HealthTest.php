<?php

declare(strict_types=1);

use function Pest\Laravel\getJson;

// 管理画面の API が動いていること（テストの土台が、アプリを立ち上げられること）を確かめる
test('GET /api/health は 200 を返す', function (): void {
    getJson('/api/health')->assertOk();
});
