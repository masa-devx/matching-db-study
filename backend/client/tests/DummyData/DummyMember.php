<?php

declare(strict_types=1);

namespace Tests\DummyData;

use App\Models\Profile;
use App\Models\User;

/**
 * テストの会員（users とプロフィール）を作る。Model と Factory を使うのは tests/DummyData/ の中だけ。
 * 既定は、メールアドレスを確認した・無料の・女性。購入の行と監査ログは作らない。
 */
final class DummyMember
{
    /** だれも持っていない public_id（UUID の形は正しい）。いない会員の URL を作るときに使う */
    public const string MISSING_PUBLIC_ID = '00000000-0000-0000-0000-000000000000';

    /**
     * 会員を1人作る。プロフィールの項目は、渡さなければ Factory がそれらしい値を入れる。
     * $withProfile が false なら、users の行だけを作る。
     *
     * @param  'male'|'female'  $gender
     */
    public static function create(
        string $gender = 'female',
        bool $paid = false,
        bool $withdrawn = false,
        bool $suspended = false,
        ?string $nickname = null,
        ?string $birthday = null,
        ?string $prefecture = null,
        ?int $height = null,
        bool $withProfile = true,
    ): TestMember {
        $user = self::createUser($paid, $suspended);
        if ($withdrawn) {
            self::withdraw($user);
        }
        $user->refresh();   // public_id は DB が入れるので、読み直す

        if (! $withProfile) {
            return new TestMember($user->id, $user->public_id, $user->email, nickname: null, gender: null);
        }

        $profile = Profile::factory()->create(self::onlyGiven([
            'user_id' => $user->id,
            'gender' => $gender,
            'nickname' => $nickname,
            'birthday' => $birthday,
            'prefecture' => $prefecture,
            'height' => $height === null ? null : (string) $height,   // レガシー版の列は文字
        ]));

        return new TestMember($user->id, $user->public_id, $user->email, $profile->nickname, $gender);   // 性別は、渡した値をそのまま入れている
    }

    /** 有料なら期限を今から30日にする。停止なら停止の日時と理由を入れる。 */
    private static function createUser(bool $paid, bool $suspended): User
    {
        return User::factory()->create([
            'is_paid' => $paid,
            'paid_until' => $paid ? now()->addDays(30) : null,
            'suspended_at' => $suspended ? now() : null,
            'suspended_reason' => $suspended ? 'テストで止めた' : null,
        ]);
    }

    /** 退会の API（DELETE /api/me）と同じ形にする：deleted_at を入れ、メールアドレスを書き換える。 */
    private static function withdraw(User $user): void
    {
        $user->update([
            'email' => $user->email.'#deleted#'.now()->getTimestamp(),
            'deleted_at' => now(),
        ]);
    }

    /**
     * 渡されなかった項目（null）を外す。外した項目は Factory の値になる。
     *
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private static function onlyGiven(array $values): array
    {
        return array_filter($values, fn (mixed $value): bool => $value !== null);
    }
}
