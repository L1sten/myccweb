(function () {
  if (sessionStorage.getItem("ccweb_auth") === "1") return;

  var HASH =
    "6f743079bb6c445c48b42820cc8a251af7a6e64dca56712e99d54b9dfb7bbf0d";

  // Hide body immediately
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
        sessionStorage.setItem("ccweb_auth", "1");
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
