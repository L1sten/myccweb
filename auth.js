(function () {

  var HASHES = {
    root: "6f743079bb6c445c48b42820cc8a251af7a6e64dca56712e99d54b9dfb7bbf0d",
    "ai-report-center":
      "396b4a65224bbf68a8fe005e35713490aefccfa868106b7edf07949516ba5054",
    "network-resource":
      "414fdf50387760864256aa52715b432e71e83e475e718b6bf3190f8f5fe24a9b",
    hzzl: "ab22830162aee1073065712a63d129af6088fe0189d792d3a986d50add2eafa9",
    "ai-pm-workflow":
      "1a0608917baef8188865f1315a96fc28417dfb8ddd1dabf171f5fabf220b88f2",
    "zhejiang-police":
      "4cf32614b2488b3e9615748ef1b1592215adc936acef8c661632928194242fdb",
    "yuqing-report":
      "dc0f435c887d2e8f1a082cbef3533beda5acf8d53d96a5b1d7fc3b25d0c794ef",
    "broadcast-player":
      "47e1a0e2e92fd65b2eab47d601152da5ec6b479279397b9cc114ca4a15867a1b",
    "chuanchuan-toushou":
      "49c6792fa9fa0168ee0fd4c7af6113984a5ab3234bc03eb48ff39c9d1f2ae5f6",
    "police-media":
      "738f8446b5099426f268e425f8f1fbd0a34531466acfd19d1d4d4317849463a1",
    "provincial-resource":
      "1052f1b0c3611bf45053e44e176f1c1a3802384e5e998694a49fd9d591452914",
    "intl-media-lib":
      "945e7d587a3bd600a646b3205e5775681fb4affc32c6fb8015e51e11eb8d4d09",
    "media-search":
      "4669e0f761940ffe21681002d85c96727f24e084a7328591cd2b50e0872d4873",
    "provincial-resource-v2":
      "a66f54154c1f41be7faa23b3eb2c41b61accd992c3a1fb0d52503ddda916409f",
    "police-mobile-h5":
      "03f8d06ec73b71a457b9b752c4a5ba4f07a5faa53a779b65e4e294da09e36b01",
    "hz-self-media-monitor":
      "d2a0c556a51b27e5a165ffc9b57638ca8ea1e256a4f2a47114a20ebf87c7cdb8",
    "media-asset-catalog":
      "8a25aa76f0f82ad107132629ce7a51f58d5f65916c5b82582b8075e6f312ba4c",
  };

  var projectKey = "root";
  var path = location.pathname;
  for (var key in HASHES) {
    if (key !== "root" && path.indexOf("/" + key + "/") !== -1) {
      projectKey = key;
      break;
    }
  }

  var authKey = "ccweb_auth_" + projectKey;
  if (sessionStorage.getItem(authKey) === "1") return;

  var HASH = HASHES[projectKey];

  var hideStyle = document.createElement("style");
  hideStyle.textContent = "body{visibility:hidden!important}";
  document.head.appendChild(hideStyle);

  document.addEventListener("DOMContentLoaded", function () {
    var authStyle = document.createElement("style");
    authStyle.textContent =
      "#cc-auth-gate{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(90deg,rgba(24,33,47,.045) 1px,transparent 1px),linear-gradient(rgba(24,33,47,.045) 1px,transparent 1px),radial-gradient(circle at 22% 18%,rgba(15,118,110,.14),transparent 24rem),radial-gradient(circle at 78% 22%,rgba(185,74,60,.13),transparent 24rem),#f7f3ea;background-size:42px 42px,42px 42px,auto,auto,auto;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#18212f;box-sizing:border-box}" +
      "#cc-auth-gate *{box-sizing:border-box}" +
      ".cc-auth-panel{width:min(360px,100%);padding:28px;background:rgba(255,250,240,.86);border:1px solid #ded5c4;border-radius:8px;box-shadow:0 18px 55px rgba(56,44,25,.12);text-align:left}" +
      ".cc-auth-mark{display:inline-grid;place-items:center;width:42px;height:42px;margin-bottom:22px;border:1px solid rgba(15,118,110,.32);border-radius:8px;background:linear-gradient(135deg,rgba(15,118,110,.13),rgba(185,74,60,.1));color:#0f766e;font-size:12px;font-weight:820;letter-spacing:.08em}" +
      ".cc-auth-title{margin:0 0 18px;color:#18212f;font-size:1.18rem;line-height:1.35;font-weight:760;letter-spacing:0}" +
      ".cc-auth-field{display:block;width:100%;padding:.78rem .95rem;border:1px solid #ded5c4;border-radius:8px;background:#fffef8;color:#18212f;font-size:1rem;line-height:1.4;outline:none;transition:border-color .18s ease,box-shadow .18s ease}" +
      ".cc-auth-field::placeholder{color:#8b785f}" +
      ".cc-auth-field:focus{border-color:#0f766e;box-shadow:0 0 0 3px rgba(15,118,110,.16)}" +
      ".cc-auth-btn{display:block;width:100%;min-height:46px;margin-top:16px;padding:.72rem 1rem;border:0;border-radius:8px;background:#18212f;color:#fffef8;font-size:1rem;font-weight:760;cursor:pointer;transition:transform .18s ease,background .18s ease,box-shadow .18s ease}" +
      ".cc-auth-btn:hover{background:#0f766e;box-shadow:0 12px 24px rgba(15,118,110,.18);transform:translateY(-1px)}" +
      ".cc-auth-btn:active{transform:translateY(0);box-shadow:none}" +
      ".cc-auth-btn:focus-visible{outline:3px solid rgba(15,118,110,.28);outline-offset:3px}" +
      ".cc-auth-error{display:none;margin:12px 0 0;color:#b94a3c;font-size:.88rem;line-height:1.45}" +
      "@media (max-width:480px){#cc-auth-gate{align-items:flex-start;padding-top:30vh}.cc-auth-panel{padding:24px}.cc-auth-title{font-size:1.08rem}}" +
      "@media (prefers-reduced-motion:reduce){#cc-auth-gate *{transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}";
    document.head.appendChild(authStyle);

    var gate = document.createElement("div");
    gate.id = "cc-auth-gate";
    gate.innerHTML =
      '<div class="cc-auth-panel">' +
      '<div class="cc-auth-mark" aria-hidden="true">CC</div>' +
      '<p class="cc-auth-title">请输入访问密码</p>' +
      '<input type="password" id="cc-auth-pwd" class="cc-auth-field" placeholder="密码" aria-label="访问密码" />' +
      '<button id="cc-auth-btn" class="cc-auth-btn" type="button">确认</button>' +
      '<p id="cc-auth-err" class="cc-auth-error" role="alert">密码错误，请重试</p>' +
      "</div>";
    document.body.prepend(gate);
    hideStyle.remove();

    var pwdInput = document.getElementById("cc-auth-pwd");
    var errEl = document.getElementById("cc-auth-err");
    pwdInput.focus();

    pwdInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") verify();
    });
    document.getElementById("cc-auth-btn").addEventListener("click", verify);

    async function verify() {
      var hash = await sha256(pwdInput.value);
      if (hash === HASH) {
        sessionStorage.setItem(authKey, "1");
        gate.remove();
        authStyle.remove();
      } else {
        errEl.style.display = "block";
        pwdInput.value = "";
        pwdInput.focus();
      }
    }
  });

  async function sha256(msg) {
    var buf = new TextEncoder().encode(msg);
    var h = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(h))
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }
})();
