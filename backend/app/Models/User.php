<?php

declare(strict_types=1);

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * 素朴な版（01）：Laravel 5 系のころによくあった形で、どの列でも一括代入できるようにする。
     * 送られてきた値が、性別やメールアドレスの列にも入ってしまう（直す段階で直す。FR-010）。
     *
     * @var list<string>
     */
    protected $guarded = [];

    /**
     * その会員についての情報（D-015）。素朴な版の DB には 1対1 の守りがないので、2つ以上あっても1つだけを返す
     *
     * @return HasOne<Profile, $this>
     */
    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class);
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
            // 保存するときに bcrypt でハッシュ化する（元に戻せない形。FR-014）
            'password' => 'hashed',
        ];
    }
}
