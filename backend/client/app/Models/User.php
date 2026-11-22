<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AccountStatus;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

// 確認用の文字は、確認のメールにだけ入れる。応答に出すと、メールを見ずに確認を通せる（不変条件 2）
#[Hidden(['password', 'remember_token', 'verification_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * レガシー版（01）：Laravel 5 系のころによくあった形で、どの列でも一括代入できるようにする。
     * 送られてきた値が、性別やメールアドレスの列にも入ってしまう（改善する段階で直す。FR-010）。
     *
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * その会員についての情報（D-015）。レガシー版の DB には 1対1 の守りがないので、2つ以上あっても1つだけを返す
     *
     * @return HasOne<Profile, $this>
     */
    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class);
    }

    /**
     * この会員が送ったいいね（02）
     *
     * @return HasMany<Like, $this>
     */
    public function likes(): HasMany
    {
        return $this->hasMany(Like::class, 'from_user_id');
    }

    /**
     * この会員がしたブロック（06。この会員が blocker）
     *
     * @return HasMany<Block, $this>
     */
    public function blocks(): HasMany
    {
        return $this->hasMany(Block::class, 'blocker_id');
    }

    /**
     * この会員の購入の記録（07）
     *
     * @return HasMany<Purchase, $this>
     */
    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }

    /**
     * この会員のアカウントの状態。行の値だけで決まるので、ここに1つだけ置く。
     * いくつも入っているときは、戻せないものを先にする（強制退会 → 退会 → アカウント停止）。
     * ログインを確かめる Middleware（AuthenticateUser）から、AuthService を通して使う。
     * 古いログインの API（AuthController::login）にも停止・強制退会の判定があり、#259 でここに移す
     */
    public function accountStatus(): AccountStatus
    {
        return match (true) {
            $this->banned_at !== null => AccountStatus::Banned,
            $this->deleted_at !== null => AccountStatus::Withdrawn,
            $this->suspended_at !== null => AccountStatus::Suspended,
            default => AccountStatus::Usable,
        };
    }

    /** この会員のアカウントが、使える状態か（退会・アカウント停止・強制退会のどれでもない） */
    public function isAccountUsable(): bool
    {
        return $this->accountStatus() === AccountStatus::Usable;
    }

    /**
     * アカウントが使える状態の会員だけに絞る（退会・アカウント停止・強制退会のどれでもない）。
     * ほかの会員に見せてよいのは、この会員だけ（FR-WD-005・006・013・014）。検索・プロフィール・いいね・マッチ・トークの一覧が呼ぶ。
     * accountStatus() が Usable になる行を、SQL の条件で書いたもの。状態や列を足すときは、2つを一緒に直す
     *
     * @param  Builder<self>  $query
     */
    public function scopeAccountUsable(Builder $query): void
    {
        $query->whereNull($query->qualifyColumn('deleted_at'))
            ->whereNull($query->qualifyColumn('suspended_at'))
            ->whereNull($query->qualifyColumn('banned_at'));
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            // 04：最終ログイン（検索の並び）
            'last_login_at' => 'datetime',
            // 06：退会した日時（論理削除）。NULL なら会員のまま
            'deleted_at' => 'datetime',
            // 07：有料会員か（真偽値）と、いつまで有料か（機能を使えるかは is_paid だけで決める）
            'is_paid' => 'boolean',
            'paid_until' => 'datetime',
            // 12：管理画面で利用を止めた日時
            'suspended_at' => 'datetime',
            // 保存するときに bcrypt でハッシュ化する（元に戻せない形。FR-014）
            'password' => 'hashed',
        ];
    }
}
