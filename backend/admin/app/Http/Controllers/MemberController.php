<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 12 会員の一覧と詳細（レガシー版）。一覧は 50人ずつ・offset・毎回の件数・1人ごとに2本（2＋2N 本）。
 * users の行をそのまま返す（パスワードのハッシュや確認用の文字まで出る）。詳細を見ると監査ログに書く。
 */
class MemberController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $q = (string) $request->input('q', '');
        $status = (string) $request->input('status', 'all');
        $page = (int) $request->input('page', 1);

        $query = DB::table('users');
        if ($q !== '') {
            // メールアドレスかニックネームの部分一致（前にも % が付くので、索引は使えない）
            $query->where(function (Builder $w) use ($q) {
                $w->where('email', 'like', "%{$q}%")
                    ->orWhereIn('id', DB::table('profiles')->where('nickname', 'like', "%{$q}%")->select('user_id'));
            });
        }
        if ($status === 'paid') {
            $query->where('is_paid', true);
        } elseif ($status === 'suspended') {
            $query->whereNotNull('suspended_at');
        } elseif ($status === 'withdrawn') {
            $query->whereNotNull('deleted_at');
        }

        $total = (clone $query)->count();
        $rows = $query->orderBy('created_at', 'desc')->offset(($page - 1) * 50)->limit(50)->get();

        $data = [];
        foreach ($rows as $user) {
            // 1人ごとに2本（N+1）
            $user->nickname = DB::table('profiles')->where('user_id', $user->id)->value('nickname');
            $user->purchases = DB::table('purchases')->where('user_id', $user->id)->count();
            $data[] = $user;   // users の行をそのまま（password も入る）
        }

        return response()->json(['total' => $total, 'page' => $page, 'data' => $data]);
    }

    public function show(Request $request, string $publicId): JsonResponse
    {
        // index() と同じ処理を写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        $purchases = [];
        foreach (DB::table('purchases')->where('user_id', $user->id)->orderBy('created_at', 'desc')->get() as $p) {
            $plan = DB::table('plans')->where('id', $p->plan_id)->first();   // 1件ごとに1本。値段は今のプラン
            $purchases[] = ['plan' => $plan?->name, 'price' => $plan?->price, 'bought_at' => $p->created_at];
        }

        $detail = [
            'user_id' => $user->public_id,
            'email' => $user->email,
            'created_at' => $user->created_at,
            'last_login_at' => $user->last_login_at,
            'email_verified_at' => $user->email_verified_at,
            'is_paid' => $user->is_paid,
            'paid_until' => $user->paid_until,
            'suspended_at' => $user->suspended_at,
            'suspended_reason' => $user->suspended_reason,
            'deleted_at' => $user->deleted_at,
            'profile' => DB::table('profiles')->where('user_id', $user->id)->first(),
            'likes_sent' => DB::table('likes')->where('from_user_id', $user->id)->count(),
            'likes_received' => DB::table('likes')->where('to_user_id', $user->id)->count(),
            'matches' => DB::table('user_matches')->where('user1_id', $user->id)->orWhere('user2_id', $user->id)->count(),
            'blocks_made' => DB::table('blocks')->where('blocker_id', $user->id)->count(),
            'blocks_received' => DB::table('blocks')->where('blocked_id', $user->id)->count(),
            'purchases' => $purchases,
        ];

        // 監査ログ（ここでは書く）
        DB::table('admin_audit_logs')->insert([
            'admin_id' => $payload->sub,
            'action' => 'member.view',
            'target_type' => 'user',
            'target_id' => $user->public_id,
            'created_at' => now(),
        ]);

        return response()->json($detail);
    }
}
