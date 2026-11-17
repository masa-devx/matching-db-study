<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 12 監査ログの一覧（レガシー版）。要件では owner だけだが、役割の確かめを写し忘れている（viewer でも見られる）。
 * 新しい順に 50件ずつ・1件ごとに管理者の名前を読む（2＋N 本）。
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $page = (int) $request->input('page', 1);
        // A4（#221）：絞り込みを足した。どの列にもインデックスはない（主キーだけ）
        $query = DB::table('admin_audit_logs');
        if ($request->filled('admin')) {
            // 管理者の名前の部分一致
            $query->whereIn('admin_id', DB::table('admins')->where('name', 'like', '%'.$request->input('admin').'%')->select('id'));
        }
        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }
        if ($request->filled('target')) {
            // 対象の ID（会員や案件の public_id）の完全一致
            $query->where('target_id', $request->input('target'));
        }
        // 期間：日付の文字をそのまま渡す（UTC の 0時で切る。日本の日付とは 9時間ずれる。日付でない文字は 500）
        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<', $request->input('to'));   // 「まで」の日は入らない
        }
        $total = (clone $query)->count();
        $rows = $query->orderBy('id', 'desc')->offset(($page - 1) * 50)->limit(50)->get();

        $data = [];
        foreach ($rows as $log) {
            $log->admin = DB::table('admins')->where('id', $log->admin_id)->value('name');
            $data[] = $log;
        }

        return response()->json(['total' => $total, 'page' => $page, 'data' => $data]);
    }
}
