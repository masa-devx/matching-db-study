<?php

declare(strict_types=1);

namespace Tests\DummyData;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * テストの会員（users とプロフィール）を作る。Model と Factory を使うのは tests/DummyData/ の中だけ。
 * 既定は、メールアドレスを確認した・無料の・女性。購入の行と監査ログは作らない。
 * $unverified が true なら、登録した直後と同じく、確認していない・確認用の文字を持つ会員にする。
 * 確認済みの会員の確認用の文字は空にする。本物は、確認したあとも文字を持ったまま（確認の API が消さない）なので、
 * 「文字が出ない」は値ではなく、キーがないこと（assertJsonMissingPath）で確かめる。
 */
final class DummyUser
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
        bool $banned = false,
        bool $unverified = false,
        ?string $nickname = null,
        ?string $birthday = null,
        ?string $prefecture = null,
        ?int $height = null,
        bool $withProfile = true,
    ): TestUser {
        $user = self::createUser($paid, $suspended, $banned, $unverified);
        if ($withdrawn) {
            self::withdraw($user);
        }
        $user->refresh();   // public_id は DB が入れるので、読み直す

        if (! $withProfile) {
            return new TestUser($user->id, $user->public_id, $user->email, nickname: null, gender: null);
        }

        $profile = Profile::factory()->create(self::onlyGiven([
            'user_id' => $user->id,
            'gender' => $gender,
            'nickname' => $nickname,
            'birthday' => $birthday,
            'prefecture' => $prefecture,
            'height' => $height === null ? null : (string) $height,   // レガシー版の列は文字
        ]));

        return new TestUser($user->id, $user->public_id, $user->email, $profile->nickname, $gender);   // 性別は、渡した値をそのまま入れている
    }

    /** 有料なら期限を今から30日にする。停止・強制退会なら、その日時と理由を入れる。確認していないなら、確認の日時を空にし、確認用の文字を入れる。 */
    private static function createUser(bool $paid, bool $suspended, bool $banned, bool $unverified): User
    {
        return User::factory()->create([
            'email_verified_at' => $unverified ? null : now(),
            'verification_token' => $unverified ? Str::random(40) : null,
            'is_paid' => $paid,
            'paid_until' => $paid ? now()->addDays(30) : null,
            'suspended_at' => $suspended ? now() : null,
            'suspended_reason' => $suspended ? 'テストで止めた' : null,
            'banned_at' => $banned ? now() : null,
            'banned_reason' => $banned ? 'テストで強制退会にした' : null,
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
