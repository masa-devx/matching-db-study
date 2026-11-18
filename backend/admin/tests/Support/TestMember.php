<?php

declare(strict_types=1);

namespace Tests\Support;

/** テストで作った会員（createMember() の返り値）。 */
final readonly class TestMember
{
    /**
     * @param  int  $id  users.id（DB の中の連番）
     * @param  string  $publicId  users.public_id（API と URL で会員を指す ID）
     * @param  string  $email  作ったときのメールアドレス（退会した会員は、DB の中では書き換わっている）
     */
    public function __construct(
        public int $id,
        public string $publicId,
        public string $email,
        public string $nickname,
    ) {}
}
