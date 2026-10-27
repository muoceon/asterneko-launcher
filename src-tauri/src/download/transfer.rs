use reqwest::Client;
use sha1::{Digest, Sha1};
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::fs;
use tokio::io::AsyncWriteExt;

use super::types::DownloadProgress;

#[allow(dead_code)]
const MIN_EMIT_INTERVAL_MS: u128 = 100; // throttle: at most once per 100ms

pub fn fmt_bytes(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    }
}

#[allow(dead_code)]
pub async fn download_with_progress(
    client: &Client,
    app: &AppHandle,
    desc: &str,
    url: &str,
    dest: &Path,
    expected_sha1: Option<&str>,
    task_id: &str,
    version_id: &str,
    stage: &str,
    current: u64,
    total: u64,
) -> Result<(), String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("服务器返回 {status}: {}", body.chars().take(200).collect::<String>()));
    }

    let total_bytes = resp.content_length().unwrap_or(0);

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    let mut file = fs::File::create(dest)
        .await
        .map_err(|e| format!("创建文件失败 {:?}: {}", dest, e))?;

    let mut downloaded: u64 = 0;
    let mut hasher = Sha1::new();
    let start = Instant::now();
    let mut last_emit = Instant::now();

    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("下载流错误: {}", e))?;

        hasher.update(&chunk);
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写入失败: {}", e))?;
        downloaded += chunk.len() as u64;

        let elapsed = start.elapsed().as_millis().max(1);
        let speed = if elapsed >= 500 {
            downloaded as f64 / (elapsed as f64 / 1000.0)
        } else {
            0.0
        };

        let since_last = last_emit.elapsed().as_millis();
        let is_last = total_bytes > 0 && downloaded >= total_bytes;

        if since_last >= MIN_EMIT_INTERVAL_MS || is_last {
            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    task_id: task_id.to_string(),
                    version_id: version_id.to_string(),
                    stage: stage.to_string(),
                    current,
                    total,
                    speed,
                    message: format!("{} … {} / {}", desc, fmt_bytes(downloaded), fmt_bytes(total_bytes)),
                },
            );
            last_emit = Instant::now();
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("刷新文件失败: {}", e))?;

    // SHA1 validation
    if let Some(expected) = expected_sha1 {
        if !expected.is_empty() {
            let hash = format!("{:x}", hasher.finalize());
            if hash != expected {
                return Err(format!(
                    "SHA1 校验失败: 期望 {} 实际 {}",
                    expected, hash
                ));
            }
        }
    }

    Ok(())
}