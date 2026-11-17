<?php

declare(strict_types=1);

namespace Tests\Support;

/**
 * テストで作った会員。API テストが Model（App\Models\…）を知らずに済むよう、テストで使う値だけを持つ。
 */
final readonly class TestMember
{
    public function __construct(
        public int $id,            // users.id（中の連番。DB を確かめるときに使う）
        public string $publicId,   // users.public_id（URL と応答に出る ID）
        public string $email,
        public string $nickname,
        public string $gender,
    ) {}
}
