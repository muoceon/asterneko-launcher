use crate::download::types::{get_base_urls, ManifestVersion, VersionInfo};
use reqwest::Client;

pub async fn fetch_version_info(
    versions: &[ManifestVersion],
    version_id: &str,
    channel: &str,
) -> Result<VersionInfo, String> {
    let version_url = if channel == "official" {
        versions
            .iter()
            .find(|v| v.id == version_id)
            .map(|v| v.url.clone())
    } else {
        let (meta_base, _, _) = get_base_urls(channel);
        versions.iter().find(|v| v.id == version_id).map(|v| {
            v.url.replace("https://piston-meta.mojang.com", meta_base)
        })
    }
    .ok_or_else(|| format!("未找到版本 {}", version_id))?;

    let client = Client::new();
    let resp = client
        .get(&version_url)
        .send()
        .await
        .map_err(|e| format!("获取版本信息失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("服务器返回 {status}: {}", body.chars().take(200).collect::<String>()));
    }

    let bytes = resp.bytes().await.map_err(|e| format!("读取响应失败: {}", e))?;
    let info: VersionInfo =
        serde_json::from_slice(&bytes).map_err(|e| format!("解析版本信息失败: {}", e))?;

    Ok(info)
}