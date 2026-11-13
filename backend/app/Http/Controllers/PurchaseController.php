<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Profile;
use App\Models\Purchase;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 07 購入する・購入の記録（レガシー版。docs/api/07-paid-members.md）。男性の会員だけが使える。
 * だれが使うかは、AuthController::me() の JWT の処理を、メソッドごとに写して決める（これで15・16か所目）。
 * 決済はしない（押したらすぐ有料。08 で決済の通知に置き換える）。トランザクションはない。
 * 記録はプランを指すだけなので、値段と期間はプランから読む（値段を変えると、前の記録の値段も変わる）。
 */
class PurchaseController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // AuthController::me() から写した（トークンがなければ 401、壊れていれば 500）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 有料会員は男性だけ（PlanController から写した）
        $profile = Profile::where('user_id', $payload->sub)->first();
        if ($profile?->gender !== 'male') {
            return response()->json(['message' => '有料会員は男性の会員だけです'], 403);
        }

        // ないプランなら null で、次の行が 500
        $plan = Plan::find($request->input('plan_id'));
        $user = User::find($payload->sub);

        Purchase::create(['user_id' => $user->id, 'plan_id' => $plan->id]);

        // 今の期限（なければ今）に月を足す。期限が過ぎていても、古い期限から足す。
        // addMonths() は月末があふれる（1月31日＋1か月は3月3日）
        $user->update([
            'is_paid' => true,
            'paid_until' => ($user->paid_until ?? now())->addMonths($plan->months),
        ]);

        return response()->json(['is_paid' => $user->is_paid, 'paid_until' => $user->paid_until], 201);
    }

    public function index(Request $request): JsonResponse
    {
        // store() と同じ処理を、もう一度写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $profile = Profile::where('user_id', $payload->sub)->first();
        if ($profile?->gender !== 'male') {
            return response()->json(['message' => '有料会員は男性の会員だけです'], 403);
        }

        $purchases = Purchase::where('user_id', $payload->sub)->orderBy('created_at', 'desc')->get();

        $result = [];
        foreach ($purchases as $purchase) {
            // 1件ごとに1本（N+1）。値段と期間は「今の」プランのもの
            $plan = Plan::where('id', $purchase->plan_id)->first();
            $result[] = [
                'name' => $plan?->name,
                'months' => $plan?->months,
                'price' => $plan?->price,
                'bought_at' => $purchase->created_at,
            ];
        }

        return response()->json($result);
    }
}
