<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 12 プランの一覧と値段の変更（レガシー版）。値段は確かめない（0 や負の数も入る）。
 * 変えるのは owner だけ（ここには写した）。監査ログに前と後の値段を書く。
 */
class PlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        return response()->json(DB::table('plans')->orderBy('id')->get());
    }

    public function update(Request $request, int $id): JsonResponse
    {
        // index() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $admin = DB::table('admins')->where('id', $payload->sub)->first();
        if ($admin?->role !== 'owner') {
            return response()->json(['message' => '権限がありません'], 403);
        }

        $plan = DB::table('plans')->where('id', $id)->first();
        DB::table('plans')->where('id', $id)->update(['price' => $request->input('price'), 'updated_at' => now()]);

        DB::table('admin_audit_logs')->insert([
            'admin_id' => $admin->id,
            'action' => 'plan.price',
            'target_type' => 'plan',
            'target_id' => (string) $id,
            'detail' => json_encode(['before' => $plan?->price, 'after' => $request->input('price')]),
            'created_at' => now(),
        ]);

        return response()->json(DB::table('plans')->where('id', $id)->first());
    }
}
