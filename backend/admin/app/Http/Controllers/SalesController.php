<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 12 購入の一覧と月ごとの売上（レガシー版）。値段は今のプランから読む（値段を変えると、過去の記録と売上も変わる）。
 * 一覧は 50件ずつ・1件ごとに3本（2＋3N 本）。
 */
class SalesController extends Controller
{
    public function purchases(Request $request): JsonResponse
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $page = (int) $request->input('page', 1);
        $total = DB::table('purchases')->count();
        $rows = DB::table('purchases')->orderBy('created_at', 'desc')->offset(($page - 1) * 50)->limit(50)->get();

        $data = [];
        foreach ($rows as $p) {
            $plan = DB::table('plans')->where('id', $p->plan_id)->first();
            $data[] = [
                'user_id' => DB::table('users')->where('id', $p->user_id)->value('public_id'),
                'nickname' => DB::table('profiles')->where('user_id', $p->user_id)->value('nickname'),
                'plan' => $plan?->name,
                'price' => $plan?->price,
                'bought_at' => $p->created_at,
            ];
        }

        return response()->json(['total' => $total, 'page' => $page, 'data' => $data]);
    }

    public function monthly(Request $request): JsonResponse
    {
        // purchases() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        return response()->json(DB::table('purchases')
            ->join('plans', 'plans.id', '=', 'purchases.plan_id')
            ->selectRaw("to_char(purchases.created_at, 'YYYY-MM') as month, sum(plans.price) as sales, count(*) as count")
            ->groupBy('month')
            ->orderBy('month')
            ->get());
    }
}
