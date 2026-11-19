<?php

declare(strict_types=1);

namespace Tests\DummyData;

/** テストで作った会員（DummyMember::create() の返り値）。 */
final readonly class TestMember
{
    /**
     * @param  int  $id  users.id（DB の中の連番）
     * @param  string  $publicId  users.public_id（API と URL で会員を指す ID）
     * @param  string  $email  作ったときのメールアドレス（退会した会員は、DB の中では書き換わっている）
     * @param  'male'|'female'  $gender  会員の側の同じ名前の型（backend/client/tests/DummyData/TestMember.php）と、持つものをそろえる
     */
    public function __construct(
        public int $id,
        public string $publicId,
        public string $email,
        public string $nickname,
        public string $gender,
    ) {}
}
