use crate::download::types::{get_base_urls, ManifestVersion, VersionManifest};
use reqwest::Client;

pub async fn fetch_manifest(channel: &str) -> Result<Vec<ManifestVersion>, String> {
    let (meta_base, _, _) = get_base_urls(channel);
    let url = format!("{}/mc/game/version_manifest_v2.json", meta_base);

    let client = Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("获取版本列表失败: {}", e))?;

    let bytes = resp.bytes().await.map_err(|e| format!("读取响应失败: {}", e))?;
    let manifest: VersionManifest =
        serde_json::from_slice(&bytes).map_err(|e| format!("解析版本列表失败: {}", e))?;

    Ok(manifest.versions)
}