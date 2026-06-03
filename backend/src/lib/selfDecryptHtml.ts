// Gera um HTML autossuficiente que carrega o backup cifrado embutido (base64)
// e, com a senha correta, descriptografa no proprio navegador (Web Crypto) e
// baixa o arquivo em claro. O usuario so precisa dar duplo-clique no .html —
// sem projeto, sem Node, sem instalar nada. Funciona offline.
//
// Mantem o mesmo esquema da cifra do backend: [salt 16][iv 16][ciphertext],
// PBKDF2-SHA256 100k, AES-256-CBC.

const TEMPLATE = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Descriptografar backup — CBT</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#0f1115; color:#e7e7e7; font-family: system-ui, Segoe UI, Roboto, sans-serif; padding:20px; }
  .card { width:100%; max-width:440px; background:#171a21; border:1px solid #2a2f3a; border-radius:12px; padding:28px; }
  h1 { font-size:18px; margin:0 0 4px; color:#FF8C00; }
  .file { font-size:13px; color:#cbd0d8; margin:0 0 16px; word-break:break-all; }
  .muted { font-size:13px; color:#9aa3b2; margin:0 0 16px; line-height:1.5; }
  input { width:100%; padding:11px 12px; font-size:15px; border-radius:8px; border:1px solid #2a2f3a;
    background:#0f1115; color:#fff; margin-bottom:12px; }
  input:focus { outline:none; border-color:#FF8C00; }
  button { width:100%; padding:11px 12px; font-size:15px; font-weight:600; border:0; border-radius:8px;
    background:#FF8C00; color:#1a1a1a; cursor:pointer; }
  button:disabled { opacity:.6; cursor:default; }
  .msg { margin:14px 0 0; font-size:13px; min-height:18px; }
  .ok { color:#22c55e; }
  .err { color:#ef4444; }
</style>
</head>
<body>
  <div class="card">
    <h1>Backup CBT — Descriptografar</h1>
    <p class="file">Arquivo: <b id="fn"></b></p>
    <p class="muted">Digite a senha definida na exportacao. O arquivo sera descriptografado aqui no navegador e baixado em claro.</p>
    <input id="pw" type="password" placeholder="Senha" autocomplete="off" autofocus>
    <button id="btn">Descriptografar e baixar</button>
    <p id="msg" class="msg"></p>
  </div>
<script>
var PAYLOAD="__PAYLOAD__";
var OUTNAME="__OUTNAME__";
document.getElementById("fn").textContent = OUTNAME;
var msg = document.getElementById("msg");
var btn = document.getElementById("btn");
var pw = document.getElementById("pw");

function setMsg(t, cls){ msg.textContent = t; msg.className = "msg " + (cls||""); }

function b64ToBytes(b64){
  var bin = atob(b64);
  var len = bin.length;
  var bytes = new Uint8Array(len);
  for (var i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function run(){
  if (!window.crypto || !window.crypto.subtle){
    setMsg("Seu navegador nao permite descriptografar a partir de um arquivo local. Abra este arquivo no Microsoft Edge ou Google Chrome.", "err");
    return;
  }
  var pass = pw.value;
  if (!pass){ setMsg("Digite a senha.", "err"); return; }
  btn.disabled = true; setMsg("Descriptografando...", "");
  try {
    var raw = b64ToBytes(PAYLOAD);
    var salt = raw.slice(0,16), iv = raw.slice(16,32), ct = raw.slice(32);
    var km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey(
      { name:"PBKDF2", salt:salt, iterations:100000, hash:"SHA-256" },
      km, { name:"AES-CBC", length:256 }, false, ["decrypt"]);
    var plain = await crypto.subtle.decrypt({ name:"AES-CBC", iv:iv }, key, ct);
    var blob = new Blob([plain], { type:"application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = OUTNAME; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setMsg("Pronto! O download de " + OUTNAME + " comecou.", "ok");
  } catch (e){
    setMsg("Senha incorreta ou arquivo corrompido.", "err");
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener("click", run);
pw.addEventListener("keydown", function(e){ if (e.key === "Enter") run(); });
</script>
</body>
</html>`;

export function buildSelfDecryptingHtml(encrypted: Buffer, outName: string): string {
  const b64 = encrypted.toString('base64');
  return TEMPLATE.split('__PAYLOAD__').join(b64).split('__OUTNAME__').join(outName);
}
