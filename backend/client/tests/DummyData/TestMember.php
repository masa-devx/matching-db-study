<?php

declare(strict_types=1);

namespace Tests\DummyData;

/**
 * テストで作った会員（DummyMember::create() の返り値）。
 * API テストが Model を知らずに済むよう、テストで使う値だけを持つ。
 */
final readonly class TestMember
{
    /**
     * @param  int  $id  users.id（中の連番。DB を確かめるときに使う）
     * @param  string  $publicId  users.public_id（URL と応答に出る番号）
     * @param  'male'|'female'|null  $gender  プロフィールを作らなかった会員は、nickname と一緒に null
     */
    public function __construct(
        public int $id,
        public string $publicId,
        public string $email,
        public ?string $nickname,
        public ?string $gender,
    ) {}
}
