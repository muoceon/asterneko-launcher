use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{AppHandle, Emitter};

const PORT_RANGE_START: u16 = 18900;
const PORT_RANGE_END: u16 = 18999;
const PRIMARY_PORT: u16 = 18923;

pub struct BridgeServer {
    pub port: u16,
}

impl BridgeServer {
    pub fn start(app: AppHandle) -> Option<Self> {
        let port = find_available_port();
        let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).ok()?;

        println!("[bridge] HTTP server started on 127.0.0.1:{}", port);

        std::thread::spawn(move || {
            for stream in listener.incoming() {
                if let Ok(mut stream) = stream {
                    let mut buf = [0u8; 8192];
                    if let Ok(n) = stream.read(&mut buf) {
                        let request = String::from_utf8_lossy(&buf[..n]);
                        let response = handle_request(&request, &app);
                        let _ = stream.write_all(response.as_bytes());
                    }
                }
            }
        });

        Some(Self { port })
    }
}

fn find_available_port() -> u16 {
    if TcpListener::bind(format!("127.0.0.1:{}", PRIMARY_PORT)).is_ok() {
        return PRIMARY_PORT;
    }
    for port in PORT_RANGE_START..=PORT_RANGE_END {
        if port == PRIMARY_PORT {
            continue;
        }
        if TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return port;
        }
    }
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
        .unwrap_or(PRIMARY_PORT)
}

fn handle_request(request: &str, app: &AppHandle) -> String {
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();

    if parts.len() < 2 {
        return http_response(400, "Bad Request", "text/plain");
    }

    let method = parts[0];
    let raw_path = parts[1];

    let (path, query) = match raw_path.find('?') {
        Some(idx) => (&raw_path[..idx], &raw_path[idx + 1..]),
        None => (raw_path, ""),
    };

    match (method, path) {
        ("GET", "/health") => {
            http_response(200, r#"{"status":"ok"}"#, "application/json")
        }
        ("GET", "/bridge") => {
            let params = parse_query_params(query);

            let code = params.get("code").cloned();
            let state = params.get("state").cloned();
            let error = params.get("error").cloned();
            let error_description = params.get("error_description").cloned();

            let payload = serde_json::json!({
                "code": code,
                "state": state,
                "error": error,
                "error_description": error_description,
            });
            let _ = app.emit("bridge-payload", payload);

            http_response(200, &bridge_html(), "text/html; charset=utf-8")
        }
        _ => {
            http_response(404, "Not Found", "text/plain")
        }
    }
}

fn parse_query_params(query: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();
    for pair in query.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            params.insert(url_decode(key), url_decode(value));
        }
    }
    params
}

fn url_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        match c {
            '%' => {
                let hex: String = chars.by_ref().take(2).collect();
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    result.push(byte as char);
                }
            }
            '+' => result.push(' '),
            _ => result.push(c),
        }
    }
    result
}

fn http_response(status: u16, body: &str, content_type: &str) -> String {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Unknown",
    };
    format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         Access-Control-Allow-Origin: *\r\n\
         \r\n\
         {}",
        status, status_text, content_type, body.len(), body
    )
}

fn bridge_html() -> String {
    r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AsterNeko Launcher - Authorization Complete</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;
background:#0d1117;color:#c9d1d9;font-family:system-ui,-apple-system,sans-serif;
transition:background .4s}
body.success{background:#0a1a14}
.card{text-align:center;padding:48px 56px;border-radius:16px;
background:#161b22;border:1px solid #30363d;max-width:400px;width:90%;
transition:border-color .4s,box-shadow .4s}
.card.success{border-color:#238636;box-shadow:0 0 32px rgba(35,134,54,.15)}
.icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;
justify-content:center;margin:0 auto 24px;font-size:32px;
border:3px solid #30363d;color:#30363d;transition:all .4s}
.icon.success{border-color:#238636;color:#3fb950;background:rgba(35,134,54,.1)}
.icon.retry{border-color:#d29922;color:#d29922}
h1{font-size:22px;font-weight:600;margin-bottom:8px;color:#f0f6fc}
.status{font-size:14px;color:#8b949e;margin-bottom:4px}
.fallback{margin-top:24px;padding-top:24px;border-top:1px solid #30363d;
opacity:0;transform:translateY(8px);transition:all .35s}
.fallback.visible{opacity:1;transform:translateY(0)}
.fallback .hint{font-size:13px;color:#8b949e;margin-bottom:16px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 24px;
border-radius:8px;border:1px solid #30363d;background:#21262d;
color:#c9d1d9;font-size:14px;cursor:pointer;transition:all .2s}
.btn:hover{background:#30363d;border-color:#8b949e}
.btn:active{transform:scale(.97)}
.btn.primary{border-color:#1f6feb;background:#1f6feb1a;color:#58a6ff}
.btn.primary:hover{background:#1f6feb33}
.sub{font-size:12px;color:#484f58;margin-top:20px}
.toast{position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-120px);
background:#238636;color:#fff;padding:10px 24px;border-radius:8px;
font-size:13px;transition:transform .3s;z-index:10}
.toast.visible{transform:translateX(-50%) translateY(0)}
</style>
</head>
<body>
<div class="card" id="card">
<div class="icon" id="icon">&#10003;</div>
<h1>Authorization Complete</h1>
<p class="status" id="status">Returning to launcher...</p>
<div class="fallback" id="fallback">
<p class="hint">Launcher not opening?</p>
<button class="btn primary" id="retryBtn" onclick="retryLaunch()">
&#128260; Try Launching Again
</button>
<p class="sub">If the problem persists, make sure AsterNeko Launcher is installed.<br>
In development mode, switch to the launcher window manually.</p>
</div>
</div>
<div class="toast" id="toast">Launching, switching...</div>
<script>
(function(){
var PROTOCOL = 'asterneko://';
var SHOW_FALLBACK_MS = 2500;
var ATTEMPT_COUNT = 0;
var fallbackEl = document.getElementById('fallback');
var statusEl = document.getElementById('status');
var iconEl = document.getElementById('icon');
var cardEl = document.getElementById('card');
var bodyEl = document.body;
var retryBtn = document.getElementById('retryBtn');
var toastEl = document.getElementById('toast');
var successShown = false;

function showSuccess(){
if(successShown)return;
successShown=true;
iconEl.classList.add('success');
cardEl.classList.add('success');
bodyEl.classList.add('success');
statusEl.textContent = 'Receiving authorization\u2026';
}

function showToast(msg){
toastEl.textContent=msg;
toastEl.classList.add('visible');
setTimeout(function(){toastEl.classList.remove('visible');},2000);
}

function tryProtocol(){
ATTEMPT_COUNT++;
location.href=PROTOCOL;
setTimeout(function(){
var f=document.createElement('iframe');
f.style.display='none';
f.src=PROTOCOL;
document.body.appendChild(f);
setTimeout(function(){document.body.removeChild(f);},500);
},100);
}

function retryLaunch(){
iconEl.classList.remove('success');
iconEl.classList.add('retry');
iconEl.textContent='\u267b';
statusEl.textContent='Retrying\u2026';
retryBtn.disabled=true;
retryBtn.style.opacity='0.6';
tryProtocol();
showToast('Launching, switching\u2026');
setTimeout(function(){
retryBtn.disabled=false;
retryBtn.style.opacity='1';
iconEl.classList.remove('retry');
iconEl.classList.add('success');
iconEl.textContent='\u2713';
statusEl.textContent='Receiving authorization\u2026';
},2000);
}

tryProtocol();

setTimeout(function(){
if(!successShown&&document.visibilityState!=='hidden'){
fallbackEl.classList.add('visible');
statusEl.textContent='Waiting for launcher\u2026';
}
},SHOW_FALLBACK_MS);

document.addEventListener('visibilitychange',function(){
if(document.visibilityState==='hidden')showSuccess();
});

window.addEventListener('pagehide',function(){showSuccess();});
window.addEventListener('beforeunload',function(){showSuccess();});
})();
</script>
</body>
</html>"#.to_string()
}