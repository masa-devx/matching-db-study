<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * 12 会員の利用を止める・解く（レガシー版）。users.suspended_at を書くだけで、断るのは会員の側の仕事。
 * 役割（owner だけ）と監査ログは、止めるほうにだけ写した（解くほうには写し忘れている）。
 */
class SuspensionController extends Controller
{
    public function store(Request $request, string $publicId): JsonResponse|Response
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        // 役割の確かめ（ここには写した）
        $admin = DB::table('admins')->where('id', $payload->sub)->first();
        if ($admin?->role !== 'owner') {
            return response()->json(['message' => '権限がありません'], 403);
        }

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        DB::table('users')->where('id', $user->id)->update([
            'suspended_at' => now(),
            'suspended_reason' => $request->input('reason'),
        ]);

        DB::table('admin_audit_logs')->insert([
            'admin_id' => $admin->id,
            'action' => 'member.suspend',
            'target_type' => 'user',
            'target_id' => $user->public_id,
            'detail' => json_encode(['reason' => $request->input('reason')], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
        ]);

        return response()->noContent();
    }

    public function destroy(Request $request, string $publicId): JsonResponse|Response
    {
        // store() から写したが、役割の確かめと監査ログは写し忘れている（viewer でも解け、記録も残らない）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        DB::table('users')->where('public_id', $publicId)->update(['suspended_at' => null, 'suspended_reason' => null]);

        return response()->noContent();
    }
}
