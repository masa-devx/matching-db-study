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

        return response()->json(['cards' => $cards, 'days' => $days, 'months' => $months]);
    }
}
