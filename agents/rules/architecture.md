---
paths:
  - "backend/*/app/**"
  - "backend/*/routes/**"
  - "backend/*/bootstrap/app.php"
  - "backend/*/tests/**"
  - "frontend/*/src/**"
---

# architecture（改訂版）

改訂版（`refactored-repo`）で、置き場・責務・依存の向きを決めるときの決まりと、書き方。会員の側（`backend/client`）と管理画面（`backend/admin`）の両方に当てはめる。

- 形は **Controller → Service → Model**（2026-11-18 に人が決めた。#236。前の形は DIP を使った4層（Http・Application・Domain・Infrastructure）。変えた理由は `docs/decisions.md` の D-025）
- 狙い：まず、Controller に詰まったロジックと DB の処理を出して、**どこにどんな処理があるかを追える**ようにする。完成した形に一気に移すのではなく、リファクタしながらコードを読み、次の改善を見つける。Service や Model が太ったら、そのときに見直す（`docs/backend.md` の「やり直しのきっかけ」）
- 全体の地図（業務のまとまり（Auth・Members のような、業務ごとの分け方）の一覧・どのアプリがどの表を書くか・今のファイルの移行の地図）は [docs/backend.md](../../docs/backend.md)
- レガシー版（Fat Controller・テストなし）の書き方は、`legacy-repo` の同じ名前のファイル。改訂版の新しいコードでは使わない
- 画面（`frontend/`）には、9章の共通の原則だけを当てはめる。画面の置き場は [docs/frontend.md](../../docs/frontend.md)

## 1. 迷ったときの判断の順

新しいコードを書く前に、上から順に問う。

1. **HTTP の形か？**（入力の形・状態コード・JSON の項目・トークン）→ Http（Controller・Request・Resource・Middleware）
2. **業務のロジックか？**（「無料の男性は1日10回まで」「お互いにいいねしたらマッチ」・確かめる → 保存する → 外へ知らせる の手順・トランザクション・役割の確かめと監査ログ）→ Service
3. **DB とのやり取りか？**（検索・一覧・集計のクエリの組み立て・リレーション・型の変換・その1行だけで答えが決まる判定）→ Model
4. どの業務のまとまりにも属さない基盤（SQL のログ・リクエスト ID）→ `app/Support/`

## 2. 依存の向き

```text
Controller ──→ Service ──→ Model
   │              └──→ ほかの Service・例外
   ├──→ Request（入力の形）
   └──→ Resource（出力の形。Service が返した Model から、返してよい項目を選ぶ）
Middleware：トークンを読み、ログインした会員の ID を Request に載せる
```

| 置き場 | 受け持ち | 使ってよい | 使ってはいけない |
| --- | --- | --- | --- |
| Controller | 受け取る → Service を呼ぶ → 返す | Request・Resource・Service・例外・`App\Support` | Model・DB（`DB::`・`Illuminate\Database`）・JWT・`app()`・`resolve()` |
| Request | 入力の形だけを確かめる | Laravel の検証 | Model・DB・JWT |
| Resource | 返してよい項目だけを並べる | 受け取った Model の値 | DB・JWT・新しいクエリ（リレーションを新しく読まない。N+1） |
| Middleware | トークンを読む（ここだけ） | JWT・`App\Support` | Model・DB |
| Service | 業務のロジック・手順・トランザクション | Model・ほかの Service・例外・Laravel の機能（`DB::transaction()`・`now()`・`config()`）・`App\Support` | Http（Request・Resource・`Illuminate\Http`）・`request()`・`auth()`・`session()`・`response()`・`abort()` |
| Model | DB とのやり取り（クエリの組み立て・リレーション・型・1行の判定） | ほかの Model・Eloquent | Service・Http・`request()`・`auth()`。Observer・モデルのイベント（保存したときの裏の動きが、Service から追えなくなる） |
| `App\Support` | 基盤 | Laravel の機能 | Http・Service・Model |

- この表は `tests/Arch/LayersTest.php` で機械で確かめる（8章）。破るときは、先にこのファイルを直す
- Service は HTTP を知らない。だから、同じ Service をコマンド・キュー・テストからも呼べる

## 3. ディレクトリと名前

各置き場の中は**業務のまとまり**のフォルダで分け、名前をそろえる（`Members` の Controller・Service・例外は、どれも `Members/` の下）。まとまりの一覧は [docs/backend.md](../../docs/backend.md) の2章だけに書く。

```text
app/
├── Http/
│   ├── Controllers/<まとまり>/〜Controller.php   古いコントローラーは直下（10章）
│   ├── Requests/<まとまり>/〜Request.php
│   ├── Resources/<まとまり>/〜Resource.php
│   └── Middleware/
├── Services/<まとまり>/〜Service.php
├── Exceptions/<まとまり>/〜Exception.php         業務の決まりに反したときの例外
├── Models/〜.php                                 Laravel の標準の置き場のまま（移さない）
└── Support/                                      基盤（Logging など）
```

### Controller の分け方

Laravel と Rails の公式の考え方に合わせる。**Controller は、URL の名詞（リソース）1つに1つ**。

- メソッドは `index`（一覧）・`show`（1件）・`store`（作る）・`update`（直す）・`destroy`（消す）の5つまで
- この5つ以外のメソッドが欲しくなったら、**隠れている名詞を探して、Controller を分ける**（Laravel：「Controller は焦点を絞っておく。標準の操作以外のメソッドがいつも要るなら、2つの小さい Controller に分ける」。Rails：「独自のアクションをたくさん足しているなら、別のリソースが隠れていないかを考える」）
- 1人に1つしかないもの（「自分」）は、`index` のない名詞にする（`GET /me` → `MeController@show`。Laravel のシングルトンのリソース）
- URL の形（状態を名詞にする `POST /members/{id}/suspension`・一度きりの動作は動詞のパス `POST /auth/login`）は、`docs/cycles/01-backend-foundation/03-how.md` の「CRUD ではない操作の書き方」に従う。Controller の名前は、その名詞にそろえる（`SuspensionController`）
- 例外：ログインと新規登録は `AuthController` にまとめる（人が決めた）。足してよいのはログイン・ログアウト・新規登録まで。パスワードの再設定・メールの確認は、別の名詞（`PasswordResetController` など）にする

| 現場でよくある、詰め込んだ `UserController` | 隠れていた名詞 | 分けた先 |
| --- | --- | --- |
| ログイン・新規登録 | ログインの状態・会員 | `Auth/AuthController` |
| いいね | いいね | `Matching/LikeController@store` |
| ブロック・通報 | ブロック・通報 | `Matching/BlockController`・`Members/ReportController` |
| 会員の検索 | 会員（の一覧） | `Members/MemberController@index` |
| プロフィールを見る・直す | プロフィール | `Members/ProfileController@show`・`update` |

### Service の分け方

- 名詞（業務のまとまり）ごとに1クラス（`ProfileService`・`LikeService`）。`final` にし、名前は `Service` で終わる
- **public のメソッドは、Controller から呼ぶ操作**（`show`・`update` など。Controller のメソッドとそろえる）。**private のメソッドは、その中の手順**（`findMember`・`assertOwner` など）
- メソッドの数の上限は決めない。太ったら見直す（`docs/backend.md` の「やり直しのきっかけ」）

## 4. 書き方

### Controller・Request・Resource

Controller は**受け取る → 呼ぶ → 返す**だけ。`if` で業務の判断をしない。Model を直接使わない。

```php
// app/Http/Controllers/Members/ProfileController.php
final class ProfileController extends Controller
{
    public function __construct(private readonly ProfileService $profiles) {}

    public function update(UpdateProfileRequest $request, string $publicId): ProfileResource
    {
        $profile = $this->profiles->update(
            memberId: (int) $request->attributes->get('member_id'),   // Middleware が載せた、ログインした会員
            publicId: $publicId,
            input: $request->validated(),
        );

        return new ProfileResource($profile);
    }
}
```

Request は**形だけ**を確かめる。「自分のプロフィールか」「回数を超えていないか」は業務の決まりなので Service で確かめる。

```php
// app/Http/Requests/Members/UpdateProfileRequest.php
final class UpdateProfileRequest extends FormRequest
{
    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['nickname' => ['sometimes', 'string', 'min:1', 'max:20']];
    }
}
```

Resource は**返してよい項目だけ**を並べる。Model を丸ごと返さない（パスワードのハッシュや確認用の文字が出る）。

```php
// app/Http/Resources/Members/ProfileResource.php
final class ProfileResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return ['nickname' => $this->resource->nickname, 'prefecture' => $this->resource->prefecture];
    }
}
```

トークンを読むのは Middleware だけ。Controller ごとに JWT を読まない。

```php
// app/Http/Middleware/AuthenticateMember.php
public function handle(Request $request, Closure $next): Response
{
    $memberId = $this->memberIdFrom($request->bearerToken());   // JWT を読む。読めなければ null
    if ($memberId === null) {
        return response()->json(['message' => 'ログインしてください'], 401);
    }
    $request->attributes->set('member_id', $memberId);

    return $next($request);
}
```

### Service

業務のロジックと手順を書く。Model のクエリを呼び、判断し、保存する。

```php
// app/Services/Members/ProfileService.php
final class ProfileService
{
    /** @param  array<string, mixed>  $input */
    public function update(int $memberId, string $publicId, array $input): Profile
    {
        $member = $this->findMember($publicId);
        $this->assertOwner($member, $memberId);

        $member->profile->update($input);

        return $member->profile;
    }

    private function findMember(string $publicId): User
    {
        return User::query()->with('profile')->where('public_id', $publicId)->firstOrFail();   // いなければ 404
    }

    private function assertOwner(User $member, int $memberId): void
    {
        if ($member->id !== $memberId) {
            throw new ProfileNotOwnedException();   // bootstrap/app.php で 403 に変える（7章）
        }
    }
}
```

### Model

DB とのやり取りを書く。**検索・一覧のクエリの組み立ても Model に置く**（人が決めた）。Service は、組み立てたクエリを呼んで、結果を使う。

```php
// app/Models/User.php
class User extends Model
{
    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['paid_until' => 'immutable_datetime', 'suspended_at' => 'immutable_datetime'];
    }

    // その1行だけで答えが決まる判定は Model に1つだけ置き、全員がこれを呼ぶ（判定が Controller ごとにずれない）
    public function isPaidAt(CarbonImmutable $now): bool
    {
        return $this->paid_until !== null && $this->paid_until->greaterThan($now);
    }

    // よく使う絞り込み（ローカルスコープ）
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('deleted_at')->whereNull('suspended_at');
    }

    /**
     * 会員の検索のクエリ。条件の組み立てはここだけに書く
     *
     * @param  array{age_min?: int, age_max?: int, prefecture?: string}  $conditions
     */
    public function scopeSearch(Builder $query, array $conditions, CarbonImmutable $today): void
    {
        $query->active();
        if (isset($conditions['prefecture'])) {
            $query->whereRelation('profile', 'prefecture', $conditions['prefecture']);
        }
        // 年齢は、誕生日の範囲に直して比べる（列に関数をかけるとインデックスが使えない）
    }
}
```

| Model に書く | Model に書かない（Service に書く） |
| --- | --- |
| リレーション・型の変換（`casts()`） | メールを送る・Firestore に書く（外への書き込み） |
| その1行だけで答えが決まる判定（`isPaidAt()`・`isSuspended()`） | いくつもの表への書き込みと、その順番（いいね → マッチ → トークルーム） |
| 検索・一覧・集計のクエリの組み立て（スコープ） | トランザクション |
| | ログインしている人を見る（`auth()`）・Request を読む |

## 5. トランザクション・日時・外への書き込み

- トランザクションは Service が `DB::transaction()` で張る。Controller・Model では張らない
- 読んでから書く処理で、同時に2回来ると壊れるもの（停止・購入・回数の上限）は、`lockForUpdate()`（行のロック）をかけて読む
- 日時は `now()`（`CarbonImmutable`・UTC）。API テストでは `travelTo()` で止める
- 外への書き込み（Firestore・メール・将来の決済と AI）は、**トランザクションの外、コミットのあと**で行う（DB が巻き戻っても、外には残るため）

```php
$room = DB::transaction(fn (): TalkRoom => $this->openRoom($match));   // DB だけ
$this->firestore->openRoom($room);                                     // コミットのあとで、外へ
```

## 6. ログ

- ログ（`App\Support\Logging`）は、Http と Service から出す。Model からは出さない
- 出し方は `agents/rules/logging.md`

## 7. エラー

- 業務の決まりに反したら、Service が `app/Exceptions/<まとまり>/〜Exception` を投げる。Service は状態コードを知らない（`abort()` を使わない）
- 例外を状態コードとメッセージに変えるのは、各アプリの `bootstrap/app.php` の1か所だけ
- 業務の例外を足したら、`render` と `dontReport` の両方に足す。API テストで、下の表の行ごとに状態コードとメッセージを確かめる

```php
// bootstrap/app.php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(fn (ProfileNotOwnedException $e) => response()->json(['message' => '自分のプロフィールだけを直せます'], 403));

    // 業務の例外は、決まりどおりに断っただけなので、エラーのログに出さない（logging.md の「ノイズを増やさない」）
    $exceptions->dontReport([ProfileNotOwnedException::class]);
})
```

| 起きること | 止める場所 | 応答 |
| --- | --- | --- |
| トークンがない・壊れている | Middleware | 401 |
| 入力の形が違う | Request | 422（Laravel の形のまま） |
| 役割が足りない（管理画面） | Service（`PermissionDeniedException`） | 403 |
| 業務の決まりに反する | Service の例外 | 403・404・409 |
| 見つからない | Service（`firstOrFail()`。Laravel が 404 に変える） | 404 |
| DB・外のサービスが落ちた | どこでも握りつぶさない（`logging.md`） | 500 |

## 8. アーキテクチャのテスト

2章（依存の向き）と、3章の名前の一部（`final`・`Service` で終わる）と、`strict_types` を、Pest の `arch()` で確かめる。

- 置き場：`tests/Arch/LayersTest.php`（中身はファイルを読む。ここにはコピーしない）。`phpunit.xml` のテストの組 `Arch` で、CI でほかのテストと一緒に流れる
- 正本は会員の側（`backend/client/tests/Arch/`）。管理画面（`backend/admin/tests/Arch/`）には、同じファイルをコピーする。違うのは、ファイルの上の「このアプリだけのもの」（古いコントローラーの一覧 `LEGACY_CONTROLLERS`）だけ。印（`// ==== ここから下は、会員の側…`）より下は、2つのファイルで同じにする。管理画面の `tests/Arch/SameRulesAsClientTest.php` が、印より下を比べ、違えば落ちる。印より上に決まり（`arch(`・`test(` など）が書かれていないことも確かめる。管理画面の CI は `backend/client/tests/Arch/**` が変わったときにも動く
- 足すとき・直すときは、わざと違反を作って落ちるのを見る（新しい Controller に `use App\Models\User;`、Service に `use Illuminate\Http\Request;`）。当てはまるファイルがないあいだは、どのテストも通るので、通っただけでは、効いているかが分からない
- テストで確かめられないことは、レビューで見る（`pr-review`）
  - Controller に、業務の判断（`if`）が残っていないか（使っているクラスは正しくても、中身は機械で見られない）
  - Service の中で、役割の確かめ（管理画面）と監査ログを書き忘れていないか（API テストで、見るだけの管理者は 403・監査ログの行がある、を確かめる）
  - `$request->bearerToken()` でトークンを読む形・文字列でクラス名や関数名を書く形（`call_user_func('now')` など）・ほかのクラスを通した間接の依存
- `arch()` の比べ方は「名前の始まり」。そのために、書き方を変えた所がある（#106・#234 で、違反を置いて確かめた）
  - 名前空間の配列：`expect([名前空間の一覧])->not->toUse(…)` は、違反があっても通る。名前空間は1つずつ `expect()` に渡す（`foreach` で回す）。`toUseStrictTypes()` は、配列でも落ちる
  - ヘルパー関数：`expect(関数の一覧)->not->toBeUsedIn(層の一覧)` では落ちない。置き場ごとに `not->toUse(関数の一覧)` と書く
  - ファサードの別名（`\DB::`・`use DB;`）は、名前が `Illuminate` で始まらないので落ちない。ファイルの文字を読んで、完全に一致するものを探すテストにした
  - 古いコントローラー：`ignoring` に渡した名前で始まる新しいクラス（`UserControllerV2`）は、検査から外れる。直下にあるファイルを、一覧と完全に一致で比べるテストを置いた
  - ないクラス：`use` したクラスが実在しないと、依存として数えない（#236 で、Model のない管理画面に `use App\Models\User;` を置いて確かめた。実在する Model なら落ちる）。動かないコードなので、実際の穴にはならない
- 期待は、`arch('名前', function (): void { expect(…)->…; })` と、無名関数の中に書く（鎖でつなぐ書き方は、Larastan が「ないメソッド」と指摘する）

## 9. 共通の原則（画面にも当てはめる）

### SSoT（1つの事実は1か所に）

- 定義（ステータス・定数・金額の計算・判定・入力の決まり）を書く前に、既存の定義を検索して使う。見つからないときだけ新しく書く
- 共通化するのは「同じ事実」だけ。見た目が似ているだけの処理は、各まとまりに置いたままにする
- API の形・型は、生成元を1つに決める。手でコピーした定義を2か所に置かない

### 過剰設計の禁止

- 要件にない汎用化・設定項目・抽象化を足さない。interface は、外のサービス（Firestore・メール・将来の決済）を差し替えてテストしたいときだけ作る
- 起こりえない入力への防御を足さない。形の確かめは Request、業務の確かめは Service
- 凝った書き方より、読んですぐ分かる書き方を選ぶ

### 1ファイル1責務

- ファイルの担当を一文で言えること。「プロフィールを見る・直す」は合格、「会員まわりの処理いろいろ」は失格
- Controller のメソッドが10行を超えたら、判断か DB の処理が混ざっている。Service へ出す

### 副作用の分離

- 外への書き込み（メール・Firestore）は Service の中で、トランザクションのあとに、目に見える1行として書く。Model のイベントや Observer に隠さない
- 環境変数は `config()` で読む（`env()` は `config/` の中だけ）

## 10. まだ移していない古いコード

- 既存の API を触るチケットでは、**先にその API の今の動きを確かめるテスト（API テスト）を足し、それから**この形へ移す。移す単位はコントローラーのファイルなので、そのファイルの全メソッドに API テストがあること
- 「API テストがある」とは、その API に、**少なくとも**成功が1本と、`docs/api/` に書いた失敗（401・404・422・403 など）ごとに1本があること。どの観点（他人の行が変わらない・境界の両側・出してはいけない人など）を書くかは、`testing.md` の API テストの観点に従う
- 移すコミットと、振る舞いを変えるコミット（不具合の直し・性能）を分ける
  - 同じ URL のまま中を移すとき：移すコミットでは、API テストが1本も変わらずに通る
  - 新しい URL に移すとき（今の URL は変えずに残す）：新しい URL のテストは、今の URL に対する、今の動きを確かめるテストをコピーして作る。違ってよい点は、移すチケットの表に並べたものだけ（手順は `testing.md` の「新しい URL に移したときのテスト」）
  - 安全の穴を直すとき：別のコミットにし、先にテストの期待値を要件どおりに変えて、落ちることを見せる（`testing.md` の「安全の穴を直すときのテスト」）
- そのために、API テストは中の作りに頼らない
  - DB は表の名前で確かめる（`assertDatabaseHas('likes', [...])`・`assertDatabaseCount('likes', 0)`）
  - データは `tests/Support/` の作る関数（例：`createMember()`・`createLike()`）で作る。Model の Factory を呼ぶのは、この関数の中だけ
  - 時刻は `travelTo()` で止める。ログインは、本物のトークンを作って送る（`actingAsMember()`）。部品の一覧は `testing.md` の「テストの部品」
  - 外への書き込み（Firestore）は、移す前と後で同じ方法で確かめる（Emulator の中身を読む）
- 新しく書くコードは、必ずこの形で書く。古いコントローラー（`app/Http/Controllers/` の直下）に機能を足さない。移したら、古いファイルを消し、アーキテクチャのテストの `LEGACY_CONTROLLERS` からも消す
- 移すたびに、**次の改善の候補**（移して気づいたこと。例：「検索の条件が増えるたびに `scopeSearch` が長くなる」）を、そのサイクルの `06-walkthrough.md` に1行残す。振り返りと、太ったときの見直しの材料にする
- 古いコードの中で見つけた問題は、移すときに直さず、改善か不具合のチケットにする（測った問題の一覧は各一歩の解説の 9-2）
- そのあとは、機能を足すとき・不具合を直すときに、触る所をこの形に移す

## 11. やってはいけない書き方

```php
// ❌ Controller に業務の判断と SQL（レガシー版の形）
if ($profile->gender === 'male' && ! $user->is_paid) {
    $today = Like::where('from_user_id', $id)->whereDate('created_at', now()->toDateString())->count();
}
// ✅ Controller は Service を呼ぶだけ。判断は Service、数えるクエリは Model
$result = $this->likes->store($memberId, $request->validated());

// ❌ Service が HTTP を知っている（コマンドやテストから呼べない）
public function update(Request $request): JsonResponse { abort(403); }
// ✅ 値を受け取り、Model を返す。断るときは業務の例外
public function update(int $memberId, string $publicId, array $input): Profile { throw new ProfileNotOwnedException(); }

// ❌ 有料かどうかを、あちこちで書く（期限を見ない所ができる）
if ($user->is_paid) { ... }
// ✅ Model の判定を1つだけ置き、全員が呼ぶ
if ($user->isPaidAt(now())) { ... }

// ❌ Model を丸ごと返す（パスワードのハッシュ・確認用の文字まで出る）
return $user;
// ✅ Resource で、返してよい項目だけを選ぶ
return new ProfileResource($user->profile);

// ❌ 保存したときに、裏でメールを送る（Service を読んでも見えない）
protected static function booted(): void { static::created(fn (User $u) => Mail::to($u)->send(...)); }
// ✅ Service の中で、コミットのあとに書く
$user = DB::transaction(fn (): User => User::create($input));
Mail::to($user)->send(new VerifyMail($user));

// ❌ トランザクションの中で外へ書く
DB::transaction(function () use ($room) { $room->save(); $this->firestore->openRoom($room); });
// ✅ コミットのあと
DB::transaction(fn () => $room->save());
$this->firestore->openRoom($room);
```

## 管理画面での当てはめ

形と依存の向きは同じ。違いは使い方だけ。

- 管理画面には、まだ Model がない（古いコントローラーは全部 `DB::` で書いている）。移すときに、使う表の Model を `backend/admin/app/Models/` に作る（会員の側の Model は読み込まない。表の作りは `backend/client` のマイグレーションが正本）
- 書き込み（停止・解除・値段の変更・お知らせ・メモ）は、必ず Service で役割を確かめ、**同じトランザクションで監査ログを保存する**
- 例外：ログイン（役割はまだ分からない）と、見たことの記録（`member.view`。それ自体が監査ログ）は、役割を確かめない
- 管理画面が書いてよい表と列は [docs/backend.md](../../docs/backend.md) の4章に従う

```php
// backend/admin/app/Models/Admin.php
public function canWrite(): bool
{
    return $this->role === 'owner';   // 見るだけの人（viewer）は false
}

// backend/admin/app/Services/Members/SuspensionService.php
public function store(int $adminId, string $memberPublicId, string $reason): void
{
    $admin = Admin::query()->findOrFail($adminId);
    if (! $admin->canWrite()) {
        throw new PermissionDeniedException();   // 403
    }

    DB::transaction(function () use ($admin, $memberPublicId, $reason): void {
        $member = User::query()->where('public_id', $memberPublicId)->lockForUpdate()->firstOrFail();
        $member->update(['suspended_at' => now(), 'suspended_reason' => $reason]);
        AuditLog::record($admin, 'member.suspend', $member, ['reason' => $reason]);   // 同じトランザクションで
    });
}
```
