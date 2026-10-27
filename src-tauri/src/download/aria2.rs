use reqwest::Client;
use serde_json::Value;
use std::collections::HashSet;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::process::{Child, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const ARIA2_RPC_URL: &str = "http://127.0.0.1:6800/jsonrpc";
const ARIA2_RPC_PORT: u16 = 6800;
const POLL_INTERVAL_MS: u64 = 200;

pub struct Aria2Manager {
    child: Mutex<Option<Child>>,
    client: Client,
    #[allow(dead_code)]
    rpc_secret: String,
    cancelled: Mutex<HashSet<String>>,
}

impl Aria2Manager {
    pub fn new() -> Self {
        Aria2Manager {
            child: Mutex::new(None),
            client: Client::new(),
            rpc_secret: String::new(),
            cancelled: Mutex::new(HashSet::new()),
        }
    }

    /// Mark a task as cancelled (non-blocking, sets flag).
    /// The running install loop will see is_cancelled(task_id) and return gracefully.
    pub fn cancel(&self, task_id: &str) {
        self.cancelled.lock().unwrap().insert(task_id.to_string());
    }

    /// Check if a specific task has been cancelled
    pub fn is_cancelled(&self, task_id: &str) -> bool {
        self.cancelled.lock().unwrap().contains(task_id)
    }

    /// Begin a new task installation (removes stale cancellation state)
    pub fn begin_task(&self, task_id: &str) {
        self.cancelled.lock().unwrap().remove(task_id);
    }

    /// Start the aria2c daemon process (synchronous)
    pub fn start(&self, aria2_path: &Path) -> Result<(), String> {
        // Kill any lingering aria2c on our port (wait for completion)
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "aria2c.exe"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        let dir = std::env::temp_dir().join("asterneko-aria2");
        std::fs::create_dir_all(&dir).map_err(|e| format!("创建 aria2 临时目录失败: {}", e))?;

        let mut child = std::process::Command::new(aria2_path)
            .arg("--enable-rpc")
            .arg(format!("--rpc-listen-port={}", ARIA2_RPC_PORT))
            .arg("--rpc-allow-origin-all=false")
            .arg("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
            .arg("--max-concurrent-downloads=16")
            .arg("--max-connection-per-server=8")
            .arg("--min-split-size=1M")
            .arg("--split=8")
            .arg("--file-allocation=none")
            .arg("--disk-cache=32M")
            .arg("--max-tries=5")
            .arg("--retry-wait=3")
            .arg("--connect-timeout=10")
            .arg("--timeout=30")
            .arg("--allow-overwrite=true")
            .arg("--auto-file-renaming=false")
            .arg("--check-certificate=false")
            .arg("--console-log-level=warn")
            .arg("--quiet")
            .arg(format!("--dir={}", dir.display()))
            .arg(format!("--stop-with-process={}", std::process::id()))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("启动 aria2c 失败: {}", e))?;

        // Give aria2c a moment to initialize
        std::thread::sleep(Duration::from_millis(1500));

        // Synchronous health check via raw TCP + HTTP
        let request_body = r#"{"jsonrpc":"2.0","id":"ping","method":"aria2.getVersion","params":[]}"#;
        let http_request = format!(
            "POST /jsonrpc HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            ARIA2_RPC_PORT,
            request_body.len(),
            request_body,
        );

        let addr = format!("127.0.0.1:{}", ARIA2_RPC_PORT);
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(15) {
            // Check if child is still alive
            match child.try_wait() {
                Ok(Some(status)) => {
                    return Err(format!("aria2c 意外退出，exit code: {}", status));
                }
                Ok(None) => {} // Still running
                Err(e) => return Err(format!("无法检查 aria2c 状态: {}", e)),
            }

            match TcpStream::connect_timeout(
                &addr.parse().unwrap(),
                Duration::from_secs(2),
            ) {
                Ok(mut stream) => {
                    stream
                        .set_read_timeout(Some(Duration::from_secs(3)))
                        .ok();
                    if stream.write_all(http_request.as_bytes()).is_ok() {
                        let mut buf = vec![0u8; 4096];
                        if stream.read(&mut buf).is_ok() {
                            let response = String::from_utf8_lossy(&buf);
                            if response.contains("aria2") || response.contains("\"result\"") {
                                *self.child.lock().unwrap() = Some(child);
                                return Ok(());
                            }
                        }
                    }
                }
                Err(_) => {} // Port not open yet
            }
            std::thread::sleep(Duration::from_millis(500));
        }

        let _ = child.kill();
        Err("aria2c 启动超时".into())
    }

    /// Check if aria2 RPC is alive
    #[allow(dead_code)]
    pub async fn is_ready(&self) -> bool {
        self.rpc_call("aria2.getVersion", Value::Null).await.is_ok()
    }

    /// Internal JSON-RPC call
    async fn rpc_call(&self, method: &str, params: Value) -> Result<Value, String> {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "asterneko",
            "method": method,
            "params": if params.is_null() { Value::Array(vec![]) } else { params }
        });

        let resp = self
            .client
            .post(ARIA2_RPC_URL)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("aria2 RPC 请求失败: {}", e))?;

        let result: Value = resp
            .json()
            .await
            .map_err(|e| format!("aria2 RPC 解析失败: {}", e))?;

        if let Some(err) = result.get("error") {
            return Err(format!("aria2 错误: {}", err));
        }

        Ok(result["result"].clone())
    }

    /// Add a download and return the GID
    pub async fn add_download(&self, url: &str, dest: &Path) -> Result<String, String> {
        let dir = dest.parent().unwrap_or(Path::new("."));
        let filename = dest.file_name().unwrap().to_str().unwrap_or("unknown");

        let params = serde_json::json!([[
            url
        ], {
            "out": filename,
            "dir": dir.to_str().unwrap(),
            "header": [format!("User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")],
        }]);

        let result = self.rpc_call("aria2.addUri", params).await?;
        result
            .as_str()
            .map(|s| s.to_string())
            .ok_or("无法解析 aria2 GID".into())
    }

    /// Get download status
    pub async fn tell_status(&self, gid: &str) -> Result<Aria2Status, String> {
        let params = serde_json::json!([gid]);
        let result = self.rpc_call("aria2.tellStatus", params).await?;

        Ok(Aria2Status {
            gid: result["gid"].as_str().unwrap_or("").to_string(),
            status: result["status"].as_str().unwrap_or("unknown").to_string(),
            total_length: result["totalLength"].as_str().unwrap_or("0").parse().unwrap_or(0),
            completed_length: result["completedLength"]
                .as_str()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0),
            download_speed: result["downloadSpeed"]
                .as_str()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0),
            error_code: result["errorCode"].as_str().unwrap_or("0").to_string(),
            error_message: result["errorMessage"]
                .as_str()
                .unwrap_or("")
                .to_string(),
        })
    }

    /// Wait for a download to complete (or fail)
    pub async fn await_download(&self, gid: &str, task_id: &str) -> Result<u64, String> {
        loop {
            if self.is_cancelled(task_id) {
                return Err("下载已取消".into());
            }
            let status = self.tell_status(gid).await?;
            match status.status.as_str() {
                "complete" => return Ok(status.completed_length),
                "error" => {
                    return Err(format!(
                        "下载失败: {} (code: {})",
                        status.error_message, status.error_code
                    ));
                }
                "removed" => return Err("下载已被移除".into()),
                _ => {
                    tokio::time::sleep(Duration::from_millis(POLL_INTERVAL_MS)).await;
                }
            }
        }
    }

    /// Wait for download and report progress via callback
    pub async fn await_with_progress<F>(
        &self,
        gid: &str,
        task_id: &str,
        mut on_progress: F,
    ) -> Result<u64, String>
    where
        F: FnMut(u64, u64, u64),
    {
        loop {
            if self.is_cancelled(task_id) {
                return Err("下载已取消".into());
            }
            let status = self.tell_status(gid).await?;
            match status.status.as_str() {
                "complete" => {
                    on_progress(status.total_length, status.total_length, 0);
                    return Ok(status.completed_length);
                }
                "error" => {
                    return Err(format!(
                        "下载失败: {} (code: {})",
                        status.error_message, status.error_code
                    ));
                }
                "removed" => return Err("下载已被移除".into()),
                _ => {
                    on_progress(
                        status.completed_length,
                        status.total_length,
                        status.download_speed,
                    );
                    tokio::time::sleep(Duration::from_millis(POLL_INTERVAL_MS)).await;
                }
            }
        }
    }

    /// Remove a download
    #[allow(dead_code)]
    pub async fn remove(&self, gid: &str) -> Result<(), String> {
        let params = serde_json::json!([gid]);
        self.rpc_call("aria2.remove", params).await?;
        Ok(())
    }

    /// Globally stop aria2
    #[allow(dead_code)]
    pub async fn shutdown(&self) {
        let _ = self
            .client
            .post(ARIA2_RPC_URL)
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "id": "asterneko",
                "method": "aria2.shutdown",
                "params": []
            }))
            .send()
            .await;
    }

    /// Get global download statistics (numActive, numWaiting, numStopped, downloadSpeed)
    pub async fn get_global_stat(&self) -> Result<Aria2GlobalStat, String> {
        let result = self
            .rpc_call("aria2.getGlobalStat", Value::Null)
            .await?;

        Ok(Aria2GlobalStat {
            num_active: result["numActive"]
                .as_str()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0),
            num_waiting: result["numWaiting"]
                .as_str()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0),
            num_stopped: result["numStopped"]
                .as_str()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0),
            download_speed: result["downloadSpeed"]
                .as_str()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0),
        })
    }

    /// Wait until all active+waiting downloads are finished.
    /// `already_done` = files already on disk before this batch.
    /// `baseline_stopped` = numStopped value from getGlobalStat BEFORE submitting this batch.
    /// Reports (done, total, speed) periodically where done = already_done + (numStopped - baseline).
    pub async fn await_all_done<F>(
        &self,
        total: u64,
        already_done: u64,
        baseline_stopped: u64,
        task_id: &str,
        mut on_progress: F,
    ) -> Result<(), String>
    where
        F: FnMut(u64, u64, u64),
    {
        loop {
            if self.is_cancelled(task_id) {
                return Err("下载已取消".into());
            }
            let stat = self.get_global_stat().await?;
            let done = already_done + stat.num_stopped.saturating_sub(baseline_stopped);
            on_progress(done, total, stat.download_speed);

            if stat.num_active == 0 && stat.num_waiting == 0 {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Aria2Status {
    pub gid: String,
    pub status: String,
    pub total_length: u64,
    pub completed_length: u64,
    pub download_speed: u64,
    pub error_code: String,
    pub error_message: String,
}

#[derive(Debug, Clone)]
pub struct Aria2GlobalStat {
    pub num_active: u64,
    pub num_waiting: u64,
    pub num_stopped: u64,
    pub download_speed: u64,
}