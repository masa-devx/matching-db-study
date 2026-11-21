<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * 会員のアカウントの状態。列は日時のまま（deleted_at・suspended_at・banned_at）で、User::accountStatus() が1つに決める。
 * 状態が4つあるので、真偽ではなく enum で持つ（architecture-backend.md の3章）。列を1つにするかは、ロードマップの「会員の状態を1つにする」で決める
 */
enum AccountStatus: string
{
    case Usable = 'usable';
    case Withdrawn = 'withdrawn';     // 本人が退会した
    case Suspended = 'suspended';     // 運営がアカウント停止にした（解けば戻る）
    case Banned = 'banned';           // 運営が強制退会にした（戻せない）
}
