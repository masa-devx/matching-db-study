<?php

declare(strict_types=1);

namespace Tests\Support;

/** テストで作った管理者（createAdmin() の返り値）。 */
final readonly class TestAdmin
{
    /**
     * @param  int  $id  admins.id
     * @param  string  $role  owner か viewer
     */
    public function __construct(
        public int $id,
        public string $email,
        public string $role,
    ) {}
}
