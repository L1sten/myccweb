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
    var gate = document.createElement("div");
    gate.id = "cc-auth-gate";
    gate.innerHTML =
      '<div style="position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">' +
      '<div style="text-align:center;padding:2rem">' +
      '<div style="font-size:2.5rem;margin-bottom:1rem">&#128274;</div>' +
      '<p style="color:#e2e8f0;font-size:1.25rem;margin-bottom:1.5rem;font-weight:500">请输入访问密码</p>' +
      '<input type="password" id="cc-auth-pwd" placeholder="密码" style="padding:0.75rem 1rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#e2e8f0;font-size:1rem;width:260px;outline:none;display:block;margin:0 auto" />' +
      '<br>' +
      '<button id="cc-auth-btn" style="padding:0.7rem 2.5rem;border-radius:8px;border:none;background:linear-gradient(135deg,#60a5fa,#a78bfa);color:#fff;font-size:1rem;cursor:pointer;font-weight:500">确认</button>' +
      '<p id="cc-auth-err" style="color:#ef4444;margin-top:1rem;font-size:0.875rem;display:none">密码错误，请重试</p>' +
      "</div></div>";
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
