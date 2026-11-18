<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 12 ダッシュボード（レガシー版）。開くたびに全部を数える。
 * 日ごとの数は、30日 × 3種類を1日1本ずつ数える（whereDate は created_at::date になり、索引が使えない。日付は UTC）。
 * 有料会員は is_paid だけで数える（期限が過ぎた人も入る）。売上は今のプランの値段で足す。監査ログは書かない。
 */
class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $cards = [
            'members' => DB::table('users')->whereNull('deleted_at')->count(),
            'registered_today' => DB::table('users')->whereDate('created_at', now()->toDateString())->count(),
            'matches' => DB::table('user_matches')->count(),
            'messages' => DB::table('messages')->count(),
            'paid_members' => DB::table('users')->where('is_paid', true)->count(),
            'sales_this_month' => (int) DB::table('purchases')
                ->join('plans', 'plans.id', '=', 'purchases.plan_id')
                ->where('purchases.created_at', '>=', now()->startOfMonth())
                ->sum('plans.price'),
        ];

        // A5（#224）：今日やること。数えるだけで、8本増える。有料の区分の決め方は、会員の一覧からコピーした
        $todo = [
            'open_cases' => DB::table('report_cases')->where('status', 'open')->count(),
            'in_progress_cases' => DB::table('report_cases')->where('status', 'in_progress')->count(),
            'expiring_paid' => DB::table('users')->where('is_paid', true)
                ->where('paid_until', '>=', now())->where('paid_until', '<', now()->addDays(7))->count(),
            'expired_paid' => DB::table('users')->where('is_paid', true)->where('paid_until', '<', now())->count(),
            'unverified' => DB::table('users')->whereNull('email_verified_at')->whereNull('deleted_at')->count(),
        ];
        // 期限の中の有料会員（上のカードの paid_members は、is_paid だけで数えたまま）
        $cards['paid_active'] = DB::table('users')->where('is_paid', true)->where('paid_until', '>=', now())->count();

        // A5（#224）：前の期間との比べ。昨日の登録・先月の売上（1か月ぶん）・前の30日（60〜31日前）の合計
        $compare = [
            'registered_yesterday' => DB::table('users')->whereDate('created_at', now()->subDay()->toDateString())->count(),
            'sales_last_month' => (int) DB::table('purchases')
                ->join('plans', 'plans.id', '=', 'purchases.plan_id')
                ->where('purchases.created_at', '>=', now()->subMonthNoOverflow()->startOfMonth())
                ->where('purchases.created_at', '<', now()->startOfMonth())
                ->sum('plans.price'),
            'registrations_prev30' => DB::table('users')
                ->where('created_at', '>=', now()->subDays(60))->where('created_at', '<', now()->subDays(30))->count(),
            'matches_prev30' => DB::table('user_matches')
                ->where('created_at', '>=', now()->subDays(60))->where('created_at', '<', now()->subDays(30))->count(),
            'messages_prev30' => DB::table('messages')
                ->where('created_at', '>=', now()->subDays(60))->where('created_at', '<', now()->subDays(30))->count(),
        ];

        $days = [];
        foreach (range(29, 0) as $i) {
            $d = now()->subDays($i)->toDateString();
            $days[] = [
                'day' => $d,
                'registrations' => DB::table('users')->whereDate('created_at', $d)->count(),
                'matches' => DB::table('user_matches')->whereDate('created_at', $d)->count(),
                'messages' => DB::table('messages')->whereDate('created_at', $d)->count(),
            ];
        }

        // 月ごとの売上：今のプランの値段で足す（値段を変えると、過去の月も変わる）
        $months = DB::table('purchases')
            ->join('plans', 'plans.id', '=', 'purchases.plan_id')
            ->selectRaw("to_char(purchases.created_at, 'YYYY-MM') as month, sum(plans.price) as sales")
            ->where('purchases.created_at', '>=', now()->subMonths(11)->startOfMonth())
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return response()->json(['cards' => $cards, 'todo' => $todo, 'compare' => $compare, 'days' => $days, 'months' => $months]);
    }
}
