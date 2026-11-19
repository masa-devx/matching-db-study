<?php

declare(strict_types=1);

namespace Tests\DummyData;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * テストの会員（users とプロフィール）を、表に直接入れて作る。会員の側の DummyMember とは別のもの。
 * 管理画面は、会員の側のコードを読み込まない決まりなので、行の形（退会のときのメールアドレスなど）をここにも書く。
 */
final class DummyMember
{
    /**
     * 会員を1人作る。既定は、メールアドレスを確認した・無料の・利用中の女性。
     * 購入・停止の履歴・いいね・マッチ・メッセージは作らない。返す email は、退会で書き換える前のもの。
     *
     * @param  'male'|'female'  $gender
     */
    public static function create(
        string $gender = 'female',
        bool $paid = false,
        bool $withdrawn = false,
        bool $suspended = false,
        ?string $nickname = null,
    ): TestMember {
        self::assertValid($gender, $nickname);

        $email = 'member-'.Str::lower(Str::random(10)).'@example.test';
        $id = DB::table('users')->insertGetId([
            'email' => $withdrawn ? $email.'#deleted#'.now()->getTimestamp() : $email,
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
            'is_paid' => $paid,
            'paid_until' => $paid ? now()->addDays(30) : null,
            'suspended_at' => $suspended ? now() : null,
            'suspended_reason' => $suspended ? 'テストで止めた' : null,
            'deleted_at' => $withdrawn ? now() : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $nickname ??= 'テスト会員'.$id;
        self::createProfile($id, $nickname, $gender);

        // public_id は DB が入れるので、読み直す
        $publicId = (string) DB::table('users')->where('id', $id)->value('public_id');

        return new TestMember($id, $publicId, $email, $nickname, $gender);
    }

    /** 表（profiles）に制約がないので、決まっていない性別と空のニックネームを、入れる前に止める。 */
    private static function assertValid(string $gender, ?string $nickname): void
    {
        if (! in_array($gender, ['male', 'female'], true)) {
            throw new InvalidArgumentException("DummyMember::create() の性別は male か female。渡された値：{$gender}");
        }
        if ($nickname !== null && trim($nickname) === '') {
            throw new InvalidArgumentException('DummyMember::create() のニックネームに、空の文字は渡せない（既定の名前にするなら null）');
        }
    }

    private static function createProfile(int $userId, string $nickname, string $gender): void
    {
        DB::table('profiles')->insert([
            'user_id' => $userId,
            'nickname' => $nickname,
            'gender' => $gender,
            'birthday' => '1995-04-01',
            'prefecture' => '東京都',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
