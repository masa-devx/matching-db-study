<?php

declare(strict_types=1);

namespace App\Services\Matching;

use App\Models\Like;

/**
 * いいね（業務のまとまり Matching。docs/backend.md の移行の地図の LikeService）。
 * 今は、下のタブの数（GET /api/me/badge-counts）だけを置く。送る・送った一覧・届いた一覧は、移すときにここに足す
 */
final class LikeService
{
    /** 届いたいいね（まだ返事をしていないもの）の数（FR-UI-064）。数える条件は Like のスコープ */
    public function countReceived(int $userId): int
    {
        return Like::query()->receivedBy($userId)->count();
    }
}
