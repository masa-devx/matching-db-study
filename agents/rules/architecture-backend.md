---
paths:
  - "backend/*/app/**"
  - "backend/*/routes/**"
  - "backend/*/bootstrap/app.php"
  - "backend/*/tests/**"
---

# architecture-backend（改訂版のバックエンド）

改訂版（`refactored-repo`）で、置き場・責務・依存の向きを決めるときの決まりと、書き方。会員の側（`backend/client`）と管理画面（`backend/admin`）の両方に当てはめる。

- 形は **Controller → Service → Model**（2026-11-18 に人が決めた。#236。前の形は DIP を使った4層（Http・Application・Domain・Infrastructure）。変えた理由は `docs/decisions.md` の D-025）
- 狙い：まず、Controller に詰まったロジックと DB の処理を出して、**どこにどんな処理があるかを追える**ようにする。完成した形に一気に移すのではなく、リファクタしながらコードを読み、次の改善を見つける。Service や Model が太ったら、そのときに見直す（`docs/backend.md` の「やり直しのきっかけ」）
- 全体の地図（業務のまとまり（Auth・Members のような、業務ごとの分け方）の一覧・どのアプリがどの表を書くか・今のファイルの移行の地図）は [docs/backend.md](../../docs/backend.md)
- レガシー版（Fat Controller・テストなし）の書き方は、`legacy-repo` の同じ名前のファイル。改訂版の新しいコードでは使わない
- 画面（`frontend/`）の決まりは [architecture-frontend.md](architecture-frontend.md)。このファイルは画面には当てはめない

## 1. 迷ったときの判断の順

新しいコードを書く前に、上から順に問う。

1. **HTTP の形か？**（入力の形・状態コード・JSON の項目・トークンを読む・どのルートに役割の確かめが要るか）→ Http（Controller・Request・Resource・Middleware）
2. **業務のロジックか？**（「無料の男性は1日10回まで」「お互いにいいねしたらマッチ」・相手がいるか・確かめる → 保存する → 外へ知らせる の手順・トランザクション・監査ログ）→ Service
3. **DB とのやり取りか？**（検索・一覧・集計のクエリの組み立て・リレーション・型の変換・その行（1件）の値だけで答えが決まる判定）→ Model
4. **外のサービスの呼び出しか？**（Firestore・メール・将来の決済）→ Client
5. どの業務のまとまりにも属さない基盤（SQL のログ・リクエスト ID）→ `app/Support/`

## 2. 依存の向き

```text
Middleware ──→ Service（トークンの会員が使えるか・役割）
Controller ──→ Service ──→ Model
   │              ├──→ Client（外のサービス）
   │              └──→ 業務の例外
   ├──→ Request（入力の形）
   └──→ Resource（出力の形。Service が返した Model から、返してよい項目を選ぶ）
```

テストが確かめるのは「使ってはいけない」の列（8章）。「主に使うもの」は目安で、テストでは確かめない。

| 置き場 | 受け持ち | 主に使うもの（目安） | 使ってはいけない |
| --- | --- | --- | --- |
| Controller | 受け取る → Service を呼ぶ → 返す | Request・Resource・Service | Model・DB（`DB::`・`Schema::`・`Illuminate\Database`）・JWT・`app()`・`resolve()`・`App::`・コンテナ |
| Request | 入力の形だけを確かめる | Laravel の検証 | Model・DB・JWT・`app()`。DB を読む検証（`exists:`・`unique:`）も使わない（「いるか」は業務の確かめなので Service。8章のレビューで見る） |
| Resource | 返してよい項目だけを並べる | 受け取った Model の値 | DB・JWT・`app()`・新しいクエリ（`Model::query()`・リレーションの `->count()`。N+1。8章のレビューで見る） |
| Middleware | トークンを読む（ここだけ）・使えるか（退会・停止）と役割の確かめを Service に頼む | JWT・Service | Model・DB・`app()` |
| Service | 業務のロジック・手順・トランザクション・監査ログ・ログインのときにトークンを作る | Model・Client・ほかの Service・業務の例外・Laravel の機能（`DB::transaction()`・`now()`・`config()`）・JWT（作るときだけ）・`App\Support` | Http（Request・Resource・`Illuminate\Http`。外の API の `Illuminate\Http\Client` の例外は使ってよい）・`request()`・`auth()`・`session()`・`response()`・`redirect()`・`abort()`・`abort_if()`・`abort_unless()`・`Auth::`・`Request::`・`Session::`・Symfony の HTTP の例外 |
| Model | DB とのやり取り（クエリの組み立て・リレーション・型・その行の判定） | ほかの Model・Eloquent | Service・Client・Http・ログ（`App\Support\Logging`）・Service と同じ HTTP の関数とファサード・Observer とモデルのイベント（保存したときの裏の動きが、Service から追えなくなる） |
| Client | 外のサービスを呼ぶ（Firestore・メール） | Laravel の `Http::`・`Mail::` | Http・Service・Model |
| 業務の例外 | 業務の決まりに反したことを表す | `BusinessException` | Http・`abort()`・Symfony の HTTP の例外（状態コードは `bootstrap/app.php` で決める） |
| `App\Support` | 基盤 | Laravel の機能 | Http・Service・Model・Client |

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
├── Services/<まとまり>/〜Service.php             Service のクラスだけを置く
├── Clients/<相手>/〜Client.php                   外のサービスの呼び出し（Firestore/FirestoreClient.php など）
├── Exceptions/BusinessException.php              業務の例外の親（7章）
├── Exceptions/<まとまり>/〜Exception.php
├── Exceptions/〜Exception.php                     いくつものまとまりで使う例外（UserNotFoundException など）
├── Models/〜.php                                 Laravel の標準の置き場のまま（移さない）
└── Support/                                      基盤（Logging など）
```

### クラスの名前

Laravel の公式の名前の付け方（`php artisan make:〇〇` の例）に合わせる。種類の名前を終わりに付けるかは、種類ごとに決める。Laravel の文書・コマンドと同じ形にして、初めて読む人にも分かるようにするため（2026-11-20 に人が決めた。#243）。

| 種類 | 置き場 | 名前 | 例 |
| --- | --- | --- | --- |
| Controller・Request・Resource・Service・Client・例外 | 上の図のとおり | 種類の名前で終える（`〜Controller`・`〜Request`・`〜Resource`・`〜Service`・`〜Client`・`〜Exception`） | `AccountController`・`AuthService`・`UserNotFoundException` |
| Middleware | `Http/Middleware/` | 何をするかを、動詞から書く。`Middleware` は付けない | `AuthenticateUser`・`EnsureEmailIsVerified` |
| Listener（出来事を受けて動く） | `Listeners/` | 何をするかを、動詞から書く。`Listener` は付けない | `DeleteAllSessions` |
| Mail | `Mail/` | `Mail` で終える（今あるものに合わせる） | `VerifyMail`・`ResetPasswordMail` |
| Model | `Models/` | 表の名前の単数 | `User`・`UserMatch` |

- UseCase と Repository は作らない（D-025：Controller → Service → Model）。`〜UseCase`・`〜Repository` という名前のクラスも作らない
- ほかの種類（Event・Job・Command・Policy・Rule・Enum など）は、初めて作るチケットで決め、この表に足す
- 層のテスト（`tests/Arch/LayersTest.php`）で、Service・Mail の終わりの名前と、Middleware・Listener に種類の名前を付けないこと、UseCase・Repository がないことを確かめる

### Controller の分け方

Laravel と Rails の公式の考え方に合わせる。**Controller は、URL の名詞（リソース）1つに1つ**。

- メソッドは `index`（一覧）・`show`（1件）・`store`（作る）・`update`（直す）・`destroy`（消す）の5つまで。1つの操作だけの Controller は `__invoke` でもよい。テストで確かめる（8章）
- この5つ以外のメソッドが欲しくなったら、**隠れている名詞を探して、Controller を分ける**（Laravel：「Controller は焦点を絞っておく。標準の操作以外のメソッドがいつも要るなら、2つの小さい Controller に分ける」。Rails：「独自のアクションをたくさん足しているなら、別のリソースが隠れていないかを考える」）
- 1人に1つしかないもの（「自分」）は、`index` のない名詞にする（`GET /me` → `AccountController@show`。Laravel のシングルトンのリソース）。URL は `/me` のまま、コードでは `Account` と呼び、`Me` を名前に使わない。管理画面も同じ。データ（Model・例外）は `User` のまま（`docs/glossary.md` の「アカウント」。2026-11-20 に人が決めた。`MeController`・`MeTest` では、何を指すかが分かりにくいため）
- URL の形（状態を名詞にする `POST /members/{id}/suspension`・一度きりの動作は動詞のパス `POST /auth/login`）は、`docs/cycles/01-backend-foundation/03-how.md` の「CRUD ではない操作の書き方」に従う。Controller の名前は、その名詞にそろえる（`SuspensionController`）。新しい URL の名詞は、#127（ルートの骨組み）で決める
- 例外：ログインと新規登録は `Auth/AuthController` にまとめる（人が決めた）。メソッドは `login`・`logout`・`store`（新規登録）まで。パスワードの再設定・メールの確認は、別の名詞（`PasswordResetController` など）にする

| 現場でよくある、詰め込んだ `UserController` | 隠れていた名詞 | 分けた先 |
| --- | --- | --- |
| ログイン・新規登録 | ログインの状態・会員 | `Auth/AuthController` |
| いいね | いいね | `Matching/LikeController@store` |
| ブロック・通報 | ブロック・通報 | `Matching/BlockController`・`Members/ReportController` |
| 会員の検索 | 会員（の一覧） | `Members/MemberController@index` |
| 自分のプロフィールを見る・直す | 自分のアカウント | `Profile/AccountController@show`・`update` |

### Service の分け方

- **業務のまとまりの中で、近い名詞（同じ表や同じ画面を扱うもの）をまとめて1クラス**にする（人が決めた。`LikeService` が、送ったいいねと届いたいいねを受け持つ）。1つの Service を、いくつかの Controller から呼んでよい
- `final` にし、名前は `Service` で終わる。`app/Services/` には Service のクラスだけを置く（戻り値は Model か配列。配列は PHPDoc で形を書く）
- **public のメソッドは操作の名前**（動詞から始める：`search`・`showProfile`・`updateProfile`・`send`・`listReceived`・`suspend`）。Controller のメソッドの名前（`index`・`store`）にそろえない（いくつかの Controller から呼ぶと、ぶつかるため）。**private のメソッドは、その中の手順**（`findMember`・`assertNotBlocked` など）
- 名前には「何ができるか」を書き、「だれが呼べるか」（ログインしているか・本人か・役割）は入れない（`updateMine` ではなく `updateProfile`）。だれが呼べるかは、Middleware とメソッドの中の条件で決める。認証の作りが変わっても、名前を変えずに済むため（2026-11-19 に人が決めた。PR #240）
- 層や技術の言葉（API・HTTP・DB・JSON・トークン・セッション）を、名前に入れない（`canUseApi` ではなく `isAccountUsable`）。同じメソッドを、コマンドやキューから呼んでも名前が合うようにするため（2026-11-20 に人が決めた。#243）
- 真偽を返すメソッドは、呼ぶ所が「〇〇は△△か」と読める、肯定の形にする。頭の言葉は `is`（状態・性質。`isAccountUsable`）・`has`（持っている・済んでいる。`hasVerifiedEmail`）・`can`（できる・許されている。`canSendLike`）・`should`（そうするのがよいという判断。`shouldQueue`）。迷ったら `is` にする。`check`・`validate` のように、何を確かめるかが分からない動詞にしない（Swift の API Design Guidelines・.NET の Framework Design Guidelines。2026-11-20 に人が決めた。#243）
- 否定の名前（`isNot〇〇`・`disabled`）を作らない。読むたびに否定を解くことになるため（.NET）
- 真偽の引数で、メソッドの動きを変えない（`book($user, true)` は、呼ぶ所で true の意味が分からない）。動きごとにメソッドを分ける（Martin Fowler「FlagArgument」）
- 状態が3つ以上あるなら、真偽ではなく enum で持ち、真偽のメソッドはそこから作る（真偽の値は「何を調べた結果か」を持たないため）
- 一度だけ起きて「いつか」に意味がある出来事は、日時の列（`〇〇_at`。null なら起きていない）で持ち、Model の真偽のメソッドで読む（Laravel の `email_verified_at` と `hasVerifiedEmail()`・`deleted_at` と `trashed()` と同じ形）
- Model と Service で同じ事実を確かめるときは、同じ言葉を使う。番号から探して答える Service のメソッドは、主語（だれの何か）を名前に入れる（Model の `$user->isAccountUsable()` と、Service の `$auth->isUserAccountUsable($userId)`。`$auth->hasUsableAccount($userId)` は「AuthService が持つか」と読めてしまう）。引数の形（`ById`）は名前に出さない
- メソッドの数の上限は決めない。太ったら見直す（`docs/backend.md` の「やり直しのきっかけ」）

## 4. 書き方

### Controller・Request・Resource

Controller は**受け取る → 呼ぶ → 返す**だけ。`if` で業務の判断をしない。Model を直接使わない。

```php
// app/Http/Controllers/Profile/AccountController.php（PATCH /me。自分のプロフィールを直す）
final class AccountController extends Controller
{
    public function __construct(private readonly ProfileService $profiles) {}

    public function update(UpdateProfileRequest $request): ProfileResource
    {
        $profile = $this->profiles->updateProfile(
            memberId: $this->loginUserId($request),   // ログインした会員の番号を読むのは、基底の Controller の loginUserId() だけ（載っていなければ 401）
            input: $request->validated(),
        );

        return new ProfileResource($profile);
    }
}
```

自分のものを直す API は、URL に相手の ID を入れない（`PATCH /me`）。`PUT /users/{publicId}` の形だと、他人の ID を送ったとき、いれば 403・いなければ 404 になり、会員がいるかどうかが分かってしまう（#239 のレビュー）。

Request は**形だけ**を確かめる。「相手がいるか」「回数を超えていないか」は業務の決まりなので Service で確かめる。

- Service に渡すのは `$request->validated()` だけ。`$request->all()` を渡さない（送られた項目が全部 Model に入り、`paid_until` などを自分で書き換えられる）
- Model の `$fillable` に、役割・停止・有料の期限・確認用の文字の列を入れない

```php
// app/Http/Requests/Profile/UpdateProfileRequest.php
final class UpdateProfileRequest extends FormRequest
{
    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['nickname' => ['sometimes', 'string', 'min:1', 'max:20']];
    }
}
```

Resource は**返してよい項目だけ**を並べる。Model を丸ごと返さない（パスワードのハッシュや確認用の文字が出る）。中で新しくクエリを書かない。Resource は、返す項目を選ぶときに作る。古いコードを移すあいだ、全部の列をそのまま返すなら作らず、Controller で `response()->json()` を返し、「分かっている不具合」と書く（中身のないファイルを増やさないため。2026-11-19 に人が決めた）。

```php
// app/Http/Resources/Profile/ProfileResource.php
final class ProfileResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return ['nickname' => $this->resource->nickname, 'prefecture' => $this->resource->prefecture];
    }
}
```

トークンを読むのは Middleware だけ。Controller ごとに JWT を読まない。トークンが正しくても、退会・停止・強制退会した会員は通さない（使えるかは Service に聞き、Service は `User::isAccountUsable()` の1か所で決める）。Middleware は応答を作らず、例外を投げる。401 の応答は `bootstrap/app.php` が作る（7章）。

```php
// app/Http/Middleware/AuthenticateUser.php（#243）
public function handle(Request $request, Closure $next): Response
{
    $userId = $this->userIdFromToken($request);   // JWT を読む。ない・壊れている・期限切れなら null
    if ($userId === null || ! $this->auth->isUserAccountUsable($userId)) {   // AuthService：退会・停止・強制退会していないか
        throw new AuthenticationException;   // bootstrap/app.php が 401「ログインしてください」にする
    }
    $request->attributes->set('login_user_id', $userId);

    return $next($request);
}
```

### Service

業務のロジックと手順を書く。Model のクエリを呼び、判断し、保存する。

```php
// app/Services/Profile/ProfileService.php
final class ProfileService
{
    /** @param  array<string, mixed>  $input  Request の validated() */
    public function updateProfile(int $memberId, array $input): Profile
    {
        $profile = $this->findProfile($memberId);
        $profile->update($input);

        return $profile;
    }

    private function findProfile(int $memberId): Profile
    {
        // 1つの条件で1件を読むだけなので、Service に書いてよい（下の「クエリの置き場の線」）
        return Profile::query()->where('user_id', $memberId)->first()
            ?? throw new ProfileNotFoundException();   // bootstrap/app.php で 404 と「プロフィールが見つかりません」に変える（7章）
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

    // その行の値だけで答えが決まる判定は Model に1つだけ置き、全員がこれを呼ぶ（判定が Controller ごとにずれない）
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
| リレーション・型の変換（`casts()`） | メールを送る・Firestore に書く（Client を Service から呼ぶ） |
| その行の値だけで答えが決まる判定（`isPaidAt()`・`isSuspended()`） | いくつもの表への書き込みと、その順番（いいね → マッチ → トークルーム） |
| 検索・一覧・集計のクエリの組み立て（スコープ） | トランザクション・ログ |
| | ログインしている人を見る（`auth()`）・Request を読む |

**クエリの置き場の線**：1つの条件で1件を読む・保存するだけなら、Service に書いてよい（`Profile::query()->where('user_id', $id)->first()`）。条件が2つ以上のもの・一覧・集計・同じ条件を2か所以上で使うものは、Model のスコープにする（`User::query()->active()`）。

## 5. トランザクション・日時・外への書き込み

- トランザクションは Service が `DB::transaction()` で張る。Controller・Model では張らない
- 読んでから書く処理で、同時に2回来ると壊れるもの（停止・購入・回数の上限）は、`lockForUpdate()`（行のロック）をかけて読む
- 日時は `now()`（`CarbonImmutable`・UTC）。API テストでは `travelTo()` で止める
- 外への書き込み（Firestore・メール・将来の決済と AI）は、Client を通し、**トランザクションの外、コミットのあと**で行う（DB が巻き戻っても、外には残るため）

```php
$room = DB::transaction(fn (): TalkRoom => $this->openRoom($match));   // DB だけ
$this->firestore->openRoom($room);                                     // コミットのあとで、外へ（FirestoreClient）
```

## 6. ログ

- ログ（`App\Support\Logging`）は、Http と Service から出す。Model からは出さない（テストで確かめる）
- 出し方と、出してはいけない値（秘密の値・個人情報）は `agents/rules/logging.md`

## 7. エラー

- 業務の決まりに反したら、Service が `app/Exceptions/<まとまり>/〜Exception` を投げる。業務の例外は、みな `App\Exceptions\BusinessException`（親）を継ぐ。Service は状態コードを知らない（`abort()` を使わない）
- 例外の置き場は、そのまとまりだけで使うなら `app/Exceptions/<まとまり>/`、いくつものまとまりで使うなら `app/Exceptions/` の直下（`UserNotFoundException` は、プロフィール・いいね・トークで使う）。同じ意味の例外を、まとまりごとに作らない（片方の `render` を書き忘れると、その API だけ 500 になる。PR #242 のレビュー）
- **見つからないときも、業務の例外にする**（`UserNotFoundException`）。`firstOrFail()` を Laravel に任せると、応答が `No query results for model [App\Models\User] 999` になり、Model のクラス名が見えてしまう（`docs/api/01-members.md` の改善版は「会員が見つかりません」）
- 例外を状態コードとメッセージに変えるのは、各アプリの `bootstrap/app.php` の1か所だけ。業務の例外を足したら、`render` に1行足す。ログに出さない決まり（`dontReport`）は、親の `BusinessException` に1回だけ書く
- 画面に出るエラーの文は、`lang/ja/errors.php` にだけ書き、`bootstrap/app.php` から `__('errors.<キー>')` で読む（文を何十か所にも手で書くと、変えるときに直し漏れが起きるため。2026-11-19 に人が決めた）
  - キーは、何が起きたかを英語の小文字と `_` で書く（`user_not_found`）。状態コードでは付けない（同じ 404 でも文は違う）
  - 言語は `config/app.php` で `ja` に決めている（日本語だけのアプリなので、環境変数で変えない）。管理画面に業務の例外を足すときは、`backend/admin` も言語を `ja` にし、`lang/ja/errors.php` を作る（直し忘れると、キーの文字がそのまま画面に出る）
- 業務の例外を足したら、`render` の1行と文を書く。書き忘れると、500 になるのにエラーのログにも残らない（`dontReport` が親に付いているため）。文のキーを打ち間違えると、キーの文字が返る。どちらも `tests/Feature/BusinessExceptionsTest.php` が落ちて見つける（`app/Exceptions` の中の業務の例外を全部集め、500 にならず、キーの文字を返さないことを確かめる）
- API テストで、下の表の行ごとに状態コードとメッセージを確かめる

```php
// bootstrap/app.php
->withExceptions(function (Exceptions $exceptions): void {
    // 文は lang/ja/errors.php（'profile_not_found' => 'プロフィールが見つかりません' など）
    $exceptions->render(fn (ProfileNotFoundException $e) => response()->json(['message' => __('errors.profile_not_found')], 404));
    $exceptions->render(fn (PaidPlanRequiredException $e) => response()->json(['message' => __('errors.paid_plan_required')], 403));

    // 業務の例外は、決まりどおりに断っただけなので、エラーのログに出さない（logging.md の「ノイズを増やさない」）。親の1つだけを書く
    $exceptions->dontReport([BusinessException::class]);
})
```

| 起きること | 止める場所 | 応答 |
| --- | --- | --- |
| トークンがない・壊れている・退会した・停止された会員 | Middleware（使えるかは Service に聞く） | 401 |
| 入力の形が違う | Request | 422（Laravel の形のまま） |
| 役割が足りない（管理画面） | 書き込みのルートの Middleware（役割は Service に聞く） | 403 |
| 業務の決まりに反する | Service の業務の例外 | 403・409 |
| 見つからない | Service の業務の例外（`〜NotFoundException`） | 404 |
| DB・外のサービスが落ちた | どこでも握りつぶさない（`logging.md`） | 500 |

### try-catch を書く場面・書かない場面

基本は書かない。思っていなかった失敗（DB が落ちた・コードの誤り）は受け止めずに上へ流し、Laravel に任せる。Laravel が、スタックトレース付きでエラーのログに記録し、500 を返す（本番は `APP_DEBUG=false` で中身を隠す）。2026-11-19 に人が決めた（#241。根拠は Laravel 13.x の公式ドキュメントの Error Handling と Database Transactions）。

- `DB::transaction()` は、中で例外が投げられると自動で戻し（ロールバック）、例外を投げ直す。`DB::rollBack()` を自分で書かない
- デッドロックでやり直すときは、`DB::transaction(fn () => ..., attempts: 3)` と書く（try-catch は要らない）
  - `attempts` は、一番外の `DB::transaction` に付ける。入れ子の中（ほかの Service の `transaction` の中から呼ばれたとき）では、やり直さずに `DeadlockException` を投げる（Laravel の `ManagesTransactions`）
  - やり直すと、中身が最初から流れ直す。そのため、外への書き込み（Firestore・メール）を中に置かない（5章。置くと2回送られる）

書いてよいのは、その失敗に、意味のある別の動きができるときだけ。受け止めるのは、決まった種類の例外だけにする（`\Exception`・`\Throwable` をまとめて受け止めない）。

- 受け止めて、ログに書いて、投げ直すだけの `catch` は書かない。`Log::error()` は `dontReport` を通らないので、業務の例外までエラーのログに出る（記録したいなら `report($e)`。こちらは `dontReport` が効く）

| 場面 | 書き方 |
| --- | --- |
| 予想できる DB のエラーを、業務の例外に変える（同時に2回いいねして、UNIQUE で止まった） | `catch (UniqueConstraintViolationException)` で受け、`AlreadyLikedException`（409）を投げる |
| 外のサービスの失敗を記録して、続ける（DB に保存したあと、Firestore への書き込みが失敗した） | `catch (決まった例外 $e)` で受け、`report($e)` で記録して続ける。やり直しの仕組みは、外のサービスを移すチケットで決める |

```php
// ❌ どの失敗も同じ 500 にする（業務の例外の 404 も 500 になる・スタックトレースが消える・Service が HTTP を知る）
try {
    $profile->update($input);
} catch (\Exception $e) {
    Log::error($e->getMessage());
    return response()->json(['message' => 'エラーが発生しました'], 500);
}

// ✅ 意味の分かる失敗だけを受け、業務の例外に変える
try {
    Like::create(['from_user_id' => $loginUserId, 'to_user_id' => $targetId]);
} catch (UniqueConstraintViolationException) {
    throw new AlreadyLikedException;
}
```

- PostgreSQL は、トランザクションの中で UNIQUE の違反が起きると、そのトランザクションを中断の状態にし、そのあとの SQL を全部失敗にする（エラーコード 25P02）。上のように受けてすぐ業務の例外を投げるなら、外のトランザクションごと戻るので問題ない。受けたあとに同じトランザクションで SQL を続けるなら、その1文を `DB::transaction()` で包む（セーブポイントになり、失敗した所までだけを戻す。Laravel の `createOrFirst()` と同じ）
- `UniqueConstraintViolationException` は、その表のどの UNIQUE の違反でも投げられる。上の見本は、その表の UNIQUE が1つのとき（`likes` の `from_user_id`・`to_user_id`）の書き方。UNIQUE が2つ以上ある表では、どの制約の違反かを確かめてから業務の例外に変える

## 8. アーキテクチャのテスト

2章（「使ってはいけない」の列）と、3章の名前の一部（Controller のメソッドの名前・Service の `final` と名前）と、`strict_types` を、Pest の `arch()` で確かめる。

- 置き場：`tests/Arch/LayersTest.php`（中身はファイルを読む。ここにはコピーしない）。`phpunit.xml` のテストの組 `Arch` で、CI でほかのテストと一緒に流れる
- 正本は会員の側（`backend/client/tests/Arch/`）。管理画面（`backend/admin/tests/Arch/`）には、同じファイルをコピーする。違うのは、ファイルの上の「このアプリだけのもの」（古いコントローラーの一覧 `LEGACY_CONTROLLERS`）だけ。印（`// ==== ここから下は、会員の側…`）より下は、2つのファイルで同じにする。管理画面の `tests/Arch/SameRulesAsClientTest.php` が、印より下を比べ、違えば落ちる。印より上に決まり（`arch(`・`test(` など）が書かれていないことも確かめる。管理画面の CI は `backend/client/tests/Arch/**` が変わったときにも動く
- 足すとき・直すときは、わざと違反を作って落ちるのを見る（新しい Controller に `use App\Models\User;`、Service に `abort_if()`）。当てはまるファイルがないあいだは、どのテストも通るので、通っただけでは、効いているかが分からない
- テストで確かめられないことは、レビューで見る（`pr-review`・`design-reviewer`）
  - Controller に、業務の判断（`if`）が残っていないか（使っているクラスは正しくても、中身は機械で見られない）
  - 管理画面の書き込みのルートが、役割を確かめる Middleware のグループの中にあるか。書き込みの Service が、同じトランザクションで監査ログを書いているか（API テストで、見るだけの管理者は 403・監査ログの行がある、を確かめる）
  - Resource の中のクエリ（`Model::query()`・`$this->resource->likes()->count()`。Model の型は使ってよいので、テストでは止められない）
  - Request の DB を読む検証（`exists:`・`unique:`。`Illuminate\Validation` の中なので、テストでは止められない）
  - Model のイベント（`booted()` の中の `static::created()`・`$dispatchesEvents`・Provider での `observe()`。テストが止めるのは `ObservedBy` の属性だけ）
  - `$request->bearerToken()` でトークンを読む形・文字列でクラス名や関数名を書く形（`call_user_func('now')` など）・ほかのクラスを通した間接の依存
- `arch()` の比べ方。そのために、書き方を変えた所がある（#106・#234・#239 で、違反を置いて確かめた）
  - クラス・名前空間は「名前の始まり」で比べる。`Illuminate\Http` は `Illuminate\Http\Client` も止めるので、Service では `ignoring('Illuminate\Http\Client')` で外している
  - **関数は「完全一致」**で比べる。`abort` は `abort_if` を止めないので、1つずつ並べる
  - 名前空間の配列：`expect([名前空間の一覧])->not->toUse(…)` は、違反があっても通る。名前空間は1つずつ `expect()` に渡す（`foreach` で回す）。`toUseStrictTypes()` は、配列でも落ちる
  - ヘルパー関数：`expect(関数の一覧)->not->toBeUsedIn(層の一覧)` では落ちない。置き場ごとに `not->toUse(関数の一覧)` と書く
  - ファサードの別名（`\DB::`・`use Auth;`）は、名前が `Illuminate` で始まらないので落ちない。ファイルの文字を読んで、完全に一致するものを探すテストにした（Http・Service・Model）
  - 古いコントローラー：`ignoring` に渡した名前で始まる新しいクラス（`UserControllerV2`）は、検査から外れる。直下にあるファイルを、一覧と完全に一致で比べるテストを置いた
  - ないクラス：`use` したクラスが実在しないと、依存として数えない（#236 で、Model のない管理画面に `use App\Models\User;` を置いて確かめた。実在する Model なら落ちる）。動かないコードなので、実際の穴にはならない
- 期待は、`arch('名前', function (): void { expect(…)->…; })` と、無名関数の中に書く（鎖でつなぐ書き方は、Larastan が「ないメソッド」と指摘する）

## 9. 共通の原則

画面にも同じ考え方の原則があり、画面の言葉で [architecture-frontend.md](architecture-frontend.md) に書いている。

### SSoT（1つの事実は1か所に）

- 定義（ステータス・定数・金額の計算・判定・入力の決まり）を書く前に、既存の定義を検索して使う。見つからないときだけ新しく書く
- 共通化するのは「同じ事実」だけ。見た目が似ているだけの処理は、各まとまりに置いたままにする
- API の形・型は、生成元を1つに決める。手でコピーした定義を2か所に置かない

### 過剰設計の禁止

- 要件にない汎用化・設定項目・抽象化を足さない。interface は、外のサービス（Client）を差し替えてテストしたいときだけ作る
- 起こりえない入力への防御を足さない。形の確かめは Request、業務の確かめは Service
- 凝った書き方より、読んですぐ分かる書き方を選ぶ

### 1ファイル1責務

- ファイルの担当を一文で言えること。「自分のプロフィールを見る・直す」は合格、「会員まわりの処理いろいろ」は失格
- Controller のメソッドが10行を超えたら、判断か DB の処理が混ざっている。Service へ出す

### 副作用の分離

- 外への書き込み（メール・Firestore）は Service の中で、トランザクションのあとに、Client を呼ぶ目に見える1行として書く。Model のイベントや Observer に隠さない
- 環境変数は `config()` で読む（`env()` は `config/` の中だけ）

## 10. まだ移していない古いコード

- 既存の API を触るチケットでは、**先にその API の今の動きを確かめるテスト（API テスト）を足し、それから**この形へ移す
- **移す単位は、API（Controller のメソッド）1つ以上**。画面・機能に要る API だけを移してよい。移した API に「API テストがある」こと。古いファイルは、全部のメソッドを移したら消し、アーキテクチャのテストの `LEGACY_CONTROLLERS` からも消す（途中までのあいだは、一覧に残す）
- 「API テストがある」とは、その API に、**少なくとも**成功が1本と、`docs/api/` に書いた失敗（401・404・422・403 など）ごとに1本があること。どの観点（他人の行が変わらない・境界の両側・出してはいけない人など）を書くかは、`testing.md` の API テストの観点に従う
- 移すコミットと、振る舞いを変えるコミット（不具合の直し・性能）を分ける
  - 同じ URL のまま中を移すとき：移すコミットでは、API テストが1本も変わらずに通る
  - 新しい URL に移すとき（今の URL は変えずに残す）：新しい URL のテストは、今の URL に対する、今の動きを確かめるテストをコピーして作る。違ってよい点は、移すチケットの表に並べたものだけ（手順は `testing.md` の「新しい URL に移したときのテスト」）
  - 安全の穴を直すとき：別のコミットにし、先にテストの期待値を要件どおりに変えて、落ちることを見せる（`testing.md` の「安全の穴を直すときのテスト」）
- そのために、API テストは中の作りに頼らない
  - DB は表の名前で確かめる（`assertDatabaseHas('likes', [...])`・`assertDatabaseCount('likes', 0)`）
  - データは `tests/DummyData/` のクラス（例：`DummyUser::create()`・`DummyMatching::match()`）で作る。Model の Factory を呼ぶのは、このクラスの中だけ
  - 時刻は `travelTo()` で止める。ログインは、本物のトークンを作って送る（`DummyAuth::actingAs()`）。ダミーデータの関数の一覧は `testing.md` の「テストのダミーデータ（会員の側）」
  - 外への書き込み（Firestore）は、移す前と後で同じ方法で確かめる（Emulator の中身を読む）
- 新しく書くコードは、必ずこの形で書く。古いコントローラー（`app/Http/Controllers/` の直下）に機能を足さない
- 移すたびに、**次の改善の候補**（移して気づいたこと。例：「検索の条件が増えるたびに `scopeSearch` が長くなる」）を、そのサイクルの `06-walkthrough.md` に1行残す。振り返りと、太ったときの見直しの材料にする
- 古いコードの中で見つけた問題は、移すときに直さず、改善か不具合のチケットにする（測った問題の一覧は各一歩の解説の 9-2）
- そのあとは、機能を足すとき・不具合を直すときに、触る所をこの形に移す

## 11. やってはいけない書き方

```php
// ❌ Controller に業務の判断と SQL（レガシー版の形）
if ($profile->gender === 'male' && ! $user->is_paid) {
    $today = Like::where('from_user_id', $id)->whereDate('created_at', now()->toDateString())->count();
}
// ✅ Controller は Service を呼ぶだけ。判断は Service、数えるクエリ（条件が2つ）は Model のスコープ
$result = $this->likes->send($memberId, $request->validated());

// ❌ Service が HTTP を知っている（コマンドやテストから呼べない）
public function updateProfile(Request $request): JsonResponse { abort_if($x, 403); }
// ✅ 値を受け取り、Model を返す。断るときは業務の例外
public function updateProfile(int $memberId, array $input): Profile { throw new ProfileNotFoundException(); }

// ❌ 有料かどうかを、あちこちで書く（期限を見ない所ができる）
if ($user->is_paid) { ... }
// ✅ Model の判定を1つだけ置き、全員が呼ぶ
if ($user->isPaidAt(now())) { ... }

// ❌ Model を丸ごと返す（パスワードのハッシュ・確認用の文字まで出る）・送られた項目を全部入れる
return $user;
$profile->update($request->all());
// ✅ Resource で、返してよい項目だけを選ぶ。入れるのは validated() だけ
return new ProfileResource($user->profile);
$profile->update($request->validated());

// ❌ 見つからないときを Laravel に任せる（Model のクラス名が応答に出る）
return User::query()->where('public_id', $publicId)->firstOrFail();
// ✅ 業務の例外にする
return User::query()->where('public_id', $publicId)->first() ?? throw new UserNotFoundException();

// ❌ 保存したときに、裏でメールを送る（Service を読んでも見えない）
protected static function booted(): void { static::created(fn (User $u) => Mail::to($u)->send(...)); }
// ✅ Service の中で、コミットのあとに書く
$user = DB::transaction(fn (): User => User::create($input));
$this->mailer->sendVerification($user);

// ❌ トランザクションの中で外へ書く
DB::transaction(function () use ($room) { $room->save(); $this->firestore->openRoom($room); });
// ✅ コミットのあと
DB::transaction(fn () => $room->save());
$this->firestore->openRoom($room);
```

## 管理画面での当てはめ

形と依存の向きは同じ。違いは使い方だけ。

- 管理画面には、まだ Model がない（古いコントローラーは全部 `DB::` で書いている）。移すときに、使う表の Model を `backend/admin/app/Models/` に作る（会員の側の Model は読み込まない。表の作りは `backend/client` のマイグレーションが正本）
- **役割の確かめは、書き込みのルートのグループに付けた Middleware（`admin.can-write`）でまとめて行う**（人が決めた。#239 の A1）。レガシー版の問題（#130）は、確かめを Controller ごとに貼り忘れたこと。グループに入れれば、書き忘れが起きない。Middleware は、役割を Service（`Admins/AuthService::canWrite()`）に聞く
- 書き込みの Service は、**同じトランザクションで監査ログを保存する**
- 例外：ログイン（役割はまだ分からない）と、見たことの記録（`member.view`。それ自体が監査ログ）は、役割を確かめない
- 監査ログに残す値（停止の理由など）にも、`agents/rules/logging.md` の「秘密値をログに流さない」を当てはめる。自由に書ける文には、個人情報（メールアドレス・電話番号）を書かないよう、画面に注意を出す
- 管理画面が書いてよい表と列は [docs/backend.md](../../docs/backend.md) の4章に従う

```php
// backend/admin/routes/api.php
Route::middleware(['auth.admin', 'admin.can-write'])->group(function (): void {
    Route::post('/members/{publicId}/suspension', [SuspensionController::class, 'store']);
    Route::delete('/members/{publicId}/suspension', [SuspensionController::class, 'destroy']);
});

// backend/admin/app/Services/Members/SuspensionService.php
public function suspend(int $adminId, string $memberPublicId, string $reason): void
{
    DB::transaction(function () use ($adminId, $memberPublicId, $reason): void {
        $member = User::query()->where('public_id', $memberPublicId)->lockForUpdate()->first()
            ?? throw new MemberNotFoundException();
        $member->update(['suspended_at' => now(), 'suspended_reason' => $reason]);
        AuditLog::record($adminId, 'member.suspend', $member, ['reason' => $reason]);   // 同じトランザクションで
    });
}
```
