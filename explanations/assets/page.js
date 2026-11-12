// 解説のページの動き（すべてのページで共通）。
// コードに色を付ける・コピーのボタン・ページの中の目次・状態の色・上へ戻るボタン。
// 手元では <script src> で読み、claude.ai に載せるときは tools/to-artifact.py が埋め込む。
(() => {
  const main = document.querySelector("main");
  if (!main) return;

  // highlight.js は、配列 [ ] や呼び出し ( ) の中の // コメントに色を付けない。
  // そこで、行の後ろの // コメントを先に切り離して色を付け、あとで戻す（文字列の中の // は切らない）
  const escapeHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const splitComment = (line) => {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"' || c === "`") {
        quote = c;
      } else if (c === "/" && line[i + 1] === "/") {
        return [line.slice(0, i), line.slice(i)];
      }
    }
    return [line, ""];
  };
  const highlight = (code, lang) => {
    if (!["php", "javascript", "typescript"].includes(lang)) {
      window.hljs.highlightElement(code);
      return;
    }
    const parts = code.textContent.split("\n").map(splitComment);
    const html = window.hljs.highlight(parts.map((p) => p[0]).join("\n"), { language: lang, ignoreIllegals: true }).value;
    code.innerHTML = html.split("\n").map((line, i) =>
      parts[i] && parts[i][1] ? line + '<span class="hljs-comment">' + escapeHtml(parts[i][1]) + "</span>" : line
    ).join("\n");
    code.classList.add("hljs");
  };
  // SQL の "likes" のような二重引用符は、文字列ではなく表や列の名前。値の '…' と色を分ける
  // highlight.js が色を付けない "likes" のような名前と、PostgreSQL の言葉（returning・on conflict do nothing）にも色を付ける
  const SQL_EXTRA = /("[^"\n]*")|\b(returning|conflict|nothing|ilike|limit|offset)\b/gi;
  const markSqlNames = (code) => {
    code.querySelectorAll(".hljs-string").forEach((s) => {
      if (s.textContent.startsWith('"')) s.className = "hljs-name-sql";
    });
    [...code.childNodes].filter((n) => n.nodeType === 3).forEach((node) => {
      const text = node.textContent;
      SQL_EXTRA.lastIndex = 0;
      if (!SQL_EXTRA.test(text)) return;
      SQL_EXTRA.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(SQL_EXTRA, (m, name, word, at) => {
        frag.append(text.slice(last, at));
        const span = document.createElement("span");
        span.className = name ? "hljs-name-sql" : "hljs-keyword";
        span.textContent = m;
        frag.append(span);
        last = at + m.length;
        return m;
      });
      frag.append(text.slice(last));
      node.replaceWith(frag);
    });
  };

  // 1. コードのかたまりを、エディタ風の枠で包み、色を付ける
  const LABELS = { php: "PHP", sql: "SQL", bash: "Shell", yaml: "YAML", xml: "XML", json: "JSON",
    typescript: "TypeScript", javascript: "JavaScript", plaintext: "Text" };
  main.querySelectorAll("pre:not(.mermaid) > code").forEach((code) => {
    const pre = code.parentElement;
    const lang = ([...code.classList].find((c) => c.startsWith("language-")) || "").replace("language-", "");
    if (window.hljs) {
      try { highlight(code, lang); if (lang === "sql") markSqlNames(code); } catch (e) { /* 色が付かなくても読める */ }
    }
    const box = document.createElement("div");
    box.className = "code-block";
    const bar = document.createElement("div");
    bar.className = "code-bar";
    bar.innerHTML = '<span class="code-dots"><span></span><span></span><span></span></span>';
    const label = document.createElement("span");
    label.className = "code-lang";
    label.textContent = code.dataset.label || LABELS[lang] || lang || "Code";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-copy";
    btn.textContent = "コピー";
    btn.addEventListener("click", () => {
      const done = () => { btn.textContent = "コピーした"; setTimeout(() => { btn.textContent = "コピー"; }, 1500); };
      const select = () => {
        const r = document.createRange(); r.selectNodeContents(code);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        btn.textContent = "選んだ（⌘C で写す）";
      };
      try {
        navigator.clipboard.writeText(code.innerText).then(done, select);
      } catch (e) { select(); }
    });
    bar.append(label, btn);
    pre.replaceWith(box);
    box.append(bar, pre);
  });

  // 2. 状態のラベルに色を付ける
  document.querySelectorAll(".status").forEach((el) => {
    const t = el.textContent;
    el.dataset.state = t.includes("実装済み") ? "done" : t.includes("レガシー") ? "legacy" : t.includes("解説") ? "doc" : "";
  });

  // 3. 見出し（h2）が3つ以上なら、ページの中の目次を作る
  const heads = [...main.querySelectorAll("h2")];
  if (heads.length >= 3) {
    heads.forEach((h, i) => { if (!h.id) h.id = "s" + (i + 1); });
    const makeList = () => {
      const ol = document.createElement("ol");
      heads.forEach((h) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.textContent;
        a.addEventListener("click", (e) => { e.preventDefault(); h.scrollIntoView({ behavior: "smooth", block: "start" }); });
        li.append(a); ol.append(li);
      });
      return ol;
    };
    const layout = document.createElement("div");
    layout.className = "layout has-toc";
    main.before(layout);
    const side = document.createElement("nav");
    side.className = "toc toc-side";
    side.setAttribute("aria-label", "このページの目次");
    side.innerHTML = '<div class="toc-inner"><p class="toc-title">このページ</p></div>';
    side.firstChild.append(makeList());
    layout.append(side, main);

    const mobile = document.createElement("details");
    mobile.className = "toc toc-mobile";
    mobile.innerHTML = "<summary>このページの目次</summary>";
    mobile.append(makeList());
    const firstH2 = heads[0];
    firstH2.before(mobile);

    // 読んでいるところを目次で光らせる
    const links = [...document.querySelectorAll(".toc a")];
    const mark = (id) => links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) mark(en.target.id); });
      }, { rootMargin: "0px 0px -70% 0px" });
      heads.forEach((h) => io.observe(h));
    }
  } else {
    const layout = document.createElement("div");
    layout.className = "layout";
    main.before(layout);
    layout.append(main);
  }

  // 4. 見出しの部分をまとめる（h1 と、その下の .meta）
  const h1 = main.querySelector("h1");
  const meta = h1 && h1.nextElementSibling;
  if (meta && meta.classList.contains("meta")) {
    const head = document.createElement("header");
    head.className = "page-head";
    h1.before(head);
    head.append(h1, meta);
  }

  // 5. 表示の切り替え（自動・明るい・暗い）と、暗いときの色の種類。選んだものは、見ている人のブラウザにだけ残す
  const root = document.documentElement;
  const DARKS = [["dark-vscode", "VS Code（Dark+）"], ["dark-dimmed", "GitHub Dimmed（やわらかい）"],
    ["dark-github", "GitHub Dark"], ["dark-onedark", "One Dark"], ["dark-dracula", "Dracula"]];
  const load = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 残せなくても動く */ } };
  let look = load("explain-look", "auto");
  let dark = load("explain-dark", "dark-vscode");
  const media = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const host = root.dataset.theme;
    const isDark = look === "dark" || (look === "auto" && (host === "dark" || (host !== "light" && media.matches)));
    root.dataset.scheme = isDark ? dark : "light";
  };
  apply();
  media.addEventListener("change", apply);
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  const bar = document.createElement("div");
  bar.className = "look-bar";
  const lookSel = document.createElement("select");
  [["auto", "自動（画面の設定に合わせる）"], ["light", "明るい"], ["dark", "暗い"]].forEach(([v, t]) => lookSel.add(new Option(t, v)));
  lookSel.value = look;
  const darkSel = document.createElement("select");
  DARKS.forEach(([v, t]) => darkSel.add(new Option(t, v)));
  darkSel.value = DARKS.some(([v]) => v === dark) ? dark : "dark-vscode";
  darkSel.disabled = look === "light";
  lookSel.addEventListener("change", () => { look = lookSel.value; save("explain-look", look); darkSel.disabled = look === "light"; apply(); });
  darkSel.addEventListener("change", () => { dark = darkSel.value; save("explain-dark", dark); apply(); });
  const l1 = document.createElement("label"); l1.append("表示", lookSel);
  const l2 = document.createElement("label"); l2.append("暗いときの色", darkSel);
  bar.append(l1, l2);
  const headEl = main.querySelector(".page-head") || main.querySelector("h1");
  if (headEl) headEl.after(bar);

  // 6. 上へ戻る
  const top = document.createElement("button");
  top.type = "button";
  top.className = "to-top";
  top.setAttribute("aria-label", "ページの上へ");
  top.textContent = "↑";
  top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.append(top);
  addEventListener("scroll", () => top.classList.toggle("show", scrollY > 600), { passive: true });
})();
