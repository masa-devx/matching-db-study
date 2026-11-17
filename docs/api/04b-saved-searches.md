# 04b 保存した検索条件

状態：**実装済み（レガシー版）**（PR は #141 の PR）

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/saved-searches.md](../requirements/saved-searches.md)（FR-SAVED-001〜015・NFR-SAVED-001〜004）。表は `search_conditions`（[data-model.md](../data-model.md)）。解説：`explanations/04b-saved-searches.html`（`legacy-repo`）。

保存した検索条件は「ログインした本人のもの」なので `/api/me/search-conditions` の下に置く。検索そのもの（`GET /api/users`。[04](04-search.md)）は変えない。画面が、選んだ条件を検索のクエリにして送る。検索の画面の URL（`/search?age_min=20…`）は画面だけの話で、API は増えない（[requirements/screens.md](../requirements/screens.md) の FR-UI-041〜043）。

| API | 中身 | レガシー版 | 改善版 |
| --- | --- | --- | --- |
| `GET /api/me/search-conditions` | 自分の保存した検索条件の一覧 | 作る（`SearchConditionController::index`） | 作る |
| `POST /api/me/search-conditions` | 名前と条件を保存する | 作る（`store`） | 作る |
| `PUT /api/me/search-conditions/{public_id}` | 名前と条件を直す | 作る（`update`） | 作る（改訂版の新しい URL では `PATCH`） |
| `DELETE /api/me/search-conditions/{public_id}` | 消す | 作る（`destroy`） | 作る |
| `GET /api/users`（04） | 保存した条件で検索する | 変えない（画面がクエリにして送る。身長の確かめは 07 のまま `is_paid` だけ） | 条件の決まり（`SearchConditions`）と有料の判断を、保存と同じものにする |

レガシー版は、設計を考えずに「とりあえず使える」形で作る。だれが使うかは、これまでと同じく JWT を読んで決める（`AuthController::me()` の処理をコピーする。4つ足して 17〜20か所目）。わざと残す問題は4つ：上限を数えてから入れるだけで止める・条件を確かめない・有料かどうかの確かめを検索からコピーする（`is_paid` だけ）・持ち主を確かめない。

> 2026-11-17（#150）：有料の条件は、身長から4つ（`last_login`・`new_member`・`keyword`・`sort=new`）に入れ替えた。保存するときの確かめ（`SearchConditionController::store`）も、この4つを見る。下の表と「レガシー版で起きること」の「身長」は、入れ替える前に測った記録として残す。同じ問題は、この4つでそのまま起きる（期限切れの会員が保存できる・直すときは確かめない）。

条件の中身（`conditions`）は、検索の API のクエリと同じ項目を持つ JSON のオブジェクト：`gender`・`age_min`・`age_max`・`prefecture`（都道府県の名前の配列）・`height_min`・`height_max`・`last_login`・`new_member`・`keyword`・`sort`。どれもなくてよい。

## `GET /api/me/search-conditions`（一覧）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人（自分の一覧だけ） | 正しい `access` の Cookie を持つ会員 |
| 応答（成功） | `200`。`search_conditions` の行の配列を、そのまま返す（`id`・`public_id`・`user_id`・`name`・`conditions`・日時）。保存した順（`id` の小さい順）。**「今の自分が使えるか」は返さない**（画面が、有料かどうかの判断をもう一度コピーして決める） | `200` `{"data": [{"id": "0193…", "name": "東京・20代", "conditions": {"age_min": 20, "age_max": 29, "prefecture": ["東京都"]}, "usable": true}]}`。中の `id`・`user_id` は返さない。今の決まりに合わない項目は捨てる（FR-SAVED-015）。`usable` は、今の自分がその条件で検索できるか（FR-SAVED-002・010） |
| 応答（失敗） | `401`：`Authorization` がない。`500`：JWT が壊れている | `401` |
| 流れる SQL の目安 | 1本（`select * from search_conditions where user_id = ? order by id asc`）。`user_id` にインデックスがないので、表を全部読む | 1本＋ガード1本（NFR-SAVED-004）。`(user_id, id)` のインデックスで読む |
| curl の例 | `curl http://127.0.0.1:8000/api/me/search-conditions -H 'Authorization: Bearer <JWT>'` | `-b cookies.txt` で同じ |

## `POST /api/me/search-conditions`（保存する）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人。確認していない会員・退会した会員の JWT でも保存できる | 正しい `access` の Cookie を持ち、メールアドレスを確認した会員 |
| 入力（JSON） | `{"name": "東京・20代", "conditions": {"age_min": 20, "age_max": 29, "prefecture": ["東京都"]}}`。**確かめない**（年齢 17・身長 300・知らない項目・配列や文字だけの `conditions` も入る。名前の長さも見ない） | `name`：必須・1〜30文字。`conditions`：オブジェクト。中身は検索の API と同じ決まり（年齢 18〜99・下が上より大きければ誤り・身長 120〜220・都道府県は 1〜47 の番号・知らない項目は誤り）。FR-SAVED-007・008 |
| 何をするか | ① `conditions` に `height_min` か `height_max` があれば、07 の検索と同じ確かめ（男性で `is_paid` でなければ `403`。**期限は見ない**）② 今の件数を数え、5件以上なら `422` ③ 1行入れる。②と③のあいだにロックもトランザクションもない（同時に送ると6件目が入る） | ① 入力を確かめる ② 有料の項目が入っていれば、07 の1つの関数（期限を見る）で判断する ③ トランザクションの中で、会員の行を `for update` で押さえてから数え、5件以上なら `422`、そうでなければ入れる（FR-SAVED-005・009。NFR-SAVED-001・002） |
| 応答（成功） | `201`。入れた行をそのまま返す（`id`・`public_id`・`user_id`・`name`・`conditions`・日時） | `201` `{"data": {"id": "0193…", "name": "東京・20代", "conditions": {…}, "usable": true}}` |
| 応答（失敗） | `401`：`Authorization` がない。`403`：男性の無料の会員（`is_paid` が false）が身長を入れた `{"message": "有料会員になると使えます"}`。`422`：5件ある `{"message": "保存できるのは5件までです"}`。`500`：JWT が壊れている・**`name` か `conditions` がない**（NOT NULL の違反） | `401`・`403`（`paid_required`）・`422`（入力の誤り・上限 `saved_search_limit`） |
| 流れる SQL の目安 | 2本（数える・insert）＋ `public_id` を読み直す1本。身長が入っていれば、プロフィールと会員の2本が増える | 3本＋begin・commit（行ロック・数える・insert）＋ガード1本 |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/me/search-conditions -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"name":"東京・20代","conditions":{"age_min":20,"age_max":29,"prefecture":["東京都"]}}'` | `-b cookies.txt` で同じ |

## `PUT /api/me/search-conditions/{public_id}`（直す）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人。**持ち主を確かめない**（ID を知っていれば、他人の条件を直せる） | 持ち主だけ。他人のもの・ないものは `404`（FR-SAVED-006） |
| 入力（JSON） | `{"name": "東京・30代", "conditions": {"age_min": 30, "age_max": 39}}`。送られた項目を、そのまま全部 Model に入れる（`$request->all()`）。**`user_id` を送ると、持ち主を書き換えられる** | `name`・`conditions`（どちらも、送ったものだけを直す）。決まりは保存と同じ |
| 何をするか | `public_id` で1行読み、送られた項目で書き換える。**有料かどうかの確かめは、ここにはコピーしなかった**（男性の無料の会員が、直すときに身長を足せる） | 入力を確かめ、有料の項目が入っていれば判断し、`where user_id = ? and public_id = ?` で書き換える。変わった行が 0 なら `404` |
| 応答（成功） | `200`。直した行をそのまま返す | `200` `{"data": {…}}` |
| 応答（失敗） | `401`：`Authorization` がない。`500`：JWT が壊れている・**ない ID**（`null` に `update()`）・**UUID の形でない ID**（PostgreSQL の型の誤り） | `401`・`403`（`paid_required`）・`404`・`422` |
| 流れる SQL の目安 | 2本（`public_id` で読む・update） | 1本＋ガード1本 |
| curl の例 | `curl -X PUT http://127.0.0.1:8000/api/me/search-conditions/<public_id> -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"name":"東京・30代"}'` | `-b cookies.txt` で同じ |

## `DELETE /api/me/search-conditions/{public_id}`（消す）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人。**持ち主を確かめない**（他人の条件を消せる） | 持ち主だけ |
| 何をするか | `public_id` が同じ行を消す | `where user_id = ? and public_id = ?` で消す。消えた行が 0 なら `404`（FR-SAVED-004・006） |
| 応答（成功） | `204`（消えた行がなくても `204`） | `204` |
| 応答（失敗） | `401`：`Authorization` がない。`500`：JWT が壊れている・UUID の形でない ID | `401`・`404` |
| 流れる SQL の目安 | 1本（delete） | 1本＋ガード1本 |
| curl の例 | `curl -X DELETE http://127.0.0.1:8000/api/me/search-conditions/<public_id> -H 'Authorization: Bearer <JWT>'` | `-b cookies.txt` で同じ |

## レガシー版で起きること（#141 で測った。改善する段階で要件 ID のテストにする）

2026-11-17 に、開発用の DB（保存した検索条件 59,805件）で curl で測った。測ったあと、シーダーを流し直してデータを戻した。

| 入力・場面 | 結果 | 要件 ID |
| --- | --- | --- |
| 4件ある会員（`search00001`）で、保存を10本同時に送る（同時に処理できるサーバーを、コンテナの中だけで一時的に立てて試した） | **`201` が 7本・`422` が 3本。11件になった** | FR-SAVED-005・NFR-SAVED-001 |
| 同じことを、いつもの API のサーバー（1本ずつ処理する）で試す | `201` が 1本・`422` が 9本。5件（ふだんの画面の操作では表に出ない） | ― |
| `{"age_min": 17, "height_min": 300, "x": "y"}` を保存する（女性） | `201`。そのまま入る | FR-SAVED-007 |
| `conditions` に配列（`[1, 2]`）・文字（`"abc"`）を送る | どちらも `201`。そのまま入る | FR-SAVED-007 |
| 名前が 200文字 | `201` | FR-SAVED-008 |
| 名前が空の文字・名前なし・`conditions` なし | `500`（NOT NULL の違反。空の文字は Laravel が `null` に変える）。応答に SQL のエラーが出る | FR-SAVED-007・008 |
| 男性の無料の会員が、身長を入れて保存する | `403`（要件どおり） | FR-SAVED-009 |
| 期限が過ぎた男性（`search00306`。`is_paid` は true のまま）が、身長を入れて保存する | **`201`** | FR-SAVED-009・FR-PAID-005 |
| 男性の無料の会員が、`PUT` で自分の条件に身長を足す | **`200`**（直すときは確かめない） | FR-SAVED-009 |
| 会員 A のトークンで、会員 B の条件の名前を `PUT` で直す | **`200`。B の条件の名前が変わる** | FR-SAVED-006 |
| 会員 A のトークンで、B の条件に `PUT` で `{"user_id": <A の id>}` を送る | **`200`。B の条件が A のものになる**（A は6件になり、上限も超える） | FR-SAVED-005・006 |
| 会員 A のトークンで、B の条件を `DELETE` する | **`204`。B の条件が消える** | FR-SAVED-006 |
| ない ID を `PUT`・`DELETE` する | `PUT` は `500`（`null` に `update()`）・`DELETE` は `204` | FR-SAVED-004 |
| UUID の形でない ID（`abc`）を `PUT`・`DELETE` する | どちらも `500`（PostgreSQL の型の誤り） | FR-SAVED-004 |
| 会員を DB から消す（確かめたあと `rollback` で戻した） | 保存した検索条件が 5件残る | FR-SAVED-014 |
| 自分の一覧の `EXPLAIN (ANALYZE, BUFFERS)` | Seq Scan。4件を返すのに 59,801行を捨て、1,549 ページを読む（2.1 ms） | NFR-SAVED-004 |
