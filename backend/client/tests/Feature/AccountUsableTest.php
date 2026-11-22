<?php

declare(strict_types=1);

use App\Enums\AccountStatus;
use App\Models\User;
use Tests\DummyData\DummyUser;

// User の「アカウントが使える会員」が、SQL の絞り込み（accountUsable()）と、1人ずつの判定（isAccountUsable()）でそろうか。
// ログインを断る所と、検索・一覧から除く所が、同じ会員を指すことを確かめる。DB を読むので Feature に置き、どの業務のまとまりにも入れない

describe('退会・アカウント停止・強制退会・使える会員が1人ずついる', function (): void {
    it('SQL で絞った会員と、1人ずつ判定した会員は、どの状態でも同じ（FR-WD-005・006・013・014）', function (): void {
        // 状態を足すと match が例外を投げて落ちるので、ここでその状態の会員の作り方を足す
        $users = array_map(fn (AccountStatus $status) => match ($status) {
            AccountStatus::Usable => DummyUser::create(),
            AccountStatus::Withdrawn => DummyUser::create(withdrawn: true),
            AccountStatus::Suspended => DummyUser::create(suspended: true),
            AccountStatus::Banned => DummyUser::create(banned: true),
        }, AccountStatus::cases());
        $models = User::query()->whereKey(array_column($users, 'id'))->orderBy('id')->get();

        $usableBySql = User::query()->accountUsable()->orderBy('id')->pluck('id')->all();
        $usableByModel = $models->filter(fn (User $user): bool => $user->isAccountUsable())->pluck('id')->values()->all();

        expect($models->map(fn (User $user): AccountStatus => $user->accountStatus())->all())->toBe(AccountStatus::cases());
        expect($usableBySql)->toBe($usableByModel)->toBe([$users[0]->id]);
    });
});
