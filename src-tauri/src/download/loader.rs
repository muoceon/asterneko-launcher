use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tokio::fs;
use crate::download::types::{DownloadProgress, OsRule, library_path};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoaderVersion {
    pub id: String,
    pub r#type: String,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
#[allow(dead_code)]
enum FabricVersionEntry {
    Version { version: String, stable: bool },
    Other,
}

#[derive(Debug, Deserialize)]
struct FabricLoaderEntry {
    loader: FabricVersionEntry,
}

#[derive(Debug, Deserialize)]
struct ForgeVersionEntry {
    version: String,
    #[serde(default)]
    r#type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QuiltLoaderEntry {
    loader: QuiltVersionEntry,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum QuiltVersionEntry {
    Version {
        version: String,
        #[serde(default)]
        stable: bool,
    },
    Other,
}

pub async fn fetch_loader_versions(
    loader: &str,
    mc_version: &str,
    channel: &str,
) -> Result<Vec<LoaderVersion>, String> {
    match loader {
        "fabric" => fetch_fabric_versions(mc_version, channel).await,
        "forge" => fetch_forge_versions(mc_version).await,
        "neoforge" => fetch_neoforge_versions(mc_version, channel).await,
        "quilt" => fetch_quilt_versions(mc_version, channel).await,
        _ => Err(format!("未知的加载器: {}", loader)),
    }
}

fn fabric_base(channel: &str) -> &str {
    if channel == "official" {
        "https://meta.fabricmc.net"
    } else {
        "https://bmclapi2.bangbang93.com/fabric-meta"
    }
}

fn quilt_base(channel: &str) -> &str {
    if channel == "official" {
        "https://meta.quiltmc.org"
    } else {
        "https://bmclapi2.bangbang93.com/quilt-meta"
    }
}

fn neoforge_base(channel: &str) -> &str {
    if channel == "official" {
        "https://maven.neoforged.net"
    } else {
        "https://bmclapi2.bangbang93.com/maven"
    }
}

async fn fetch_fabric_versions(
    mc_version: &str,
    channel: &str,
) -> Result<Vec<LoaderVersion>, String> {
    let primary = fabric_base(channel);
    let fallback = fabric_base(if channel == "official" { "bmclapi" } else { "official" });

    match fetch_fabric_impl(mc_version, primary).await {
        Ok(v) if !v.is_empty() => Ok(v),
        Ok(_) | Err(_) => {
            fetch_fabric_impl(mc_version, fallback).await
        }
    }
}

async fn fetch_fabric_impl(
    mc_version: &str,
    base: &str,
) -> Result<Vec<LoaderVersion>, String> {
    let client = Client::new();
    let url = format!("{}/v2/versions/loader/{}", base, mc_version);

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("{} HTTP 请求失败: {}", url, e))?;

    let status = resp.status();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("{} 读取响应失败: {}", url, e))?;

    if !status.is_success() {
        return Err(format!(
            "{} 返回 HTTP {}: {}",
            url,
            status.as_u16(),
            String::from_utf8_lossy(&bytes).chars().take(200).collect::<String>()
        ));
    }

    let entries: Vec<FabricLoaderEntry> =
        serde_json::from_slice(&bytes).map_err(|e| format!("{} 解析失败: {}", url, e))?;

    let mut versions: Vec<LoaderVersion> = Vec::new();
    for entry in entries {
        if let FabricVersionEntry::Version { version, stable } = entry.loader {
            versions.push(LoaderVersion {
                id: version,
                r#type: if stable {
                    "release".to_string()
                } else {
                    "snapshot".to_string()
                },
            });
        }
    }

    Ok(versions)
}

async fn fetch_forge_versions(mc_version: &str) -> Result<Vec<LoaderVersion>, String> {
    let client = Client::new();
    let url = format!(
        "https://bmclapi2.bangbang93.com/forge/minecraft/{}",
        mc_version
    );

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("获取 Forge 版本列表失败: {}", e))?;

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取 Forge 响应失败: {}", e))?;

    let entries: Vec<ForgeVersionEntry> =
        serde_json::from_slice(&bytes).map_err(|e| format!("解析 Forge 数据失败: {}", e))?;

    let versions: Vec<LoaderVersion> = entries
        .into_iter()
        .map(|e| {
            let is_stable = matches!(
                e.r#type.as_deref(),
                Some("latest") | Some("recommended")
            );
            LoaderVersion {
                id: e.version,
                r#type: if is_stable {
                    "release".to_string()
                } else {
                    "snapshot".to_string()
                },
            }
        })
        .collect();

    Ok(versions)
}

async fn fetch_neoforge_versions(
    mc_version: &str,
    channel: &str,
) -> Result<Vec<LoaderVersion>, String> {
    let primary = neoforge_base(channel);
    let fallback = neoforge_base(if channel == "official" { "bmclapi" } else { "official" });

    match fetch_neoforge_impl(mc_version, primary).await {
        Ok(v) if !v.is_empty() => Ok(v),
        Ok(_) | Err(_) => {
            fetch_neoforge_impl(mc_version, fallback).await
        }
    }
}

async fn fetch_neoforge_impl(
    mc_version: &str,
    base: &str,
) -> Result<Vec<LoaderVersion>, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let parts: Vec<&str> = mc_version.split('.').collect();
    // NeoForge drops the leading "1.": MC 1.21.1 → NeoForge 21.1.x
    let mc_filter = if parts.len() >= 3 && parts[0] == "1" {
        format!("{}.{}", parts[1], parts[2])
    } else if parts.len() >= 2 {
        format!("{}.{}", parts[0], parts[1])
    } else {
        mc_version.to_string()
    };

    let url = format!(
        "{}/net/neoforged/neoforge/maven-metadata.xml",
        base
    );

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("{} HTTP 请求失败: {}", url, e))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("{} 读取响应失败: {}", url, e))?;

    if !status.is_success() {
        return Err(format!(
            "{} 返回 HTTP {}: {}",
            url,
            status.as_u16(),
            body.chars().take(200).collect::<String>()
        ));
    }

    let versions: Vec<LoaderVersion> = body
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("<version>") && trimmed.ends_with("</version>") {
                let v = trimmed
                    .strip_prefix("<version>")
                    .and_then(|s| s.strip_suffix("</version>"))
                    .unwrap_or("");
                let owned = v.to_string();
                if owned.starts_with(&mc_filter) {
                    let is_snapshot =
                        owned.contains("-beta") || owned.contains("-alpha");
                    Some(LoaderVersion {
                        id: owned,
                        r#type: if is_snapshot {
                            "snapshot".to_string()
                        } else {
                            "release".to_string()
                        },
                    })
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect();

    Ok(versions)
}

async fn fetch_quilt_versions(
    mc_version: &str,
    channel: &str,
) -> Result<Vec<LoaderVersion>, String> {
    let primary = quilt_base(channel);
    let fallback = quilt_base(if channel == "official" { "bmclapi" } else { "official" });

    match fetch_quilt_impl(mc_version, primary).await {
        Ok(v) if !v.is_empty() => Ok(v),
        Ok(_) | Err(_) => {
            fetch_quilt_impl(mc_version, fallback).await
        }
    }
}

async fn fetch_quilt_impl(
    mc_version: &str,
    base: &str,
) -> Result<Vec<LoaderVersion>, String> {
    let client = Client::new();
    let url = format!(
        "{}/v3/versions/loader/{}",
        base,
        mc_version
    );

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("{} HTTP 请求失败: {}", url, e))?;

    let status = resp.status();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("{} 读取响应失败: {}", url, e))?;

    if !status.is_success() {
        return Err(format!(
            "{} 返回 HTTP {}: {}",
            url,
            status.as_u16(),
            String::from_utf8_lossy(&bytes).chars().take(200).collect::<String>()
        ));
    }

    let entries: Vec<QuiltLoaderEntry> =
        serde_json::from_slice(&bytes).map_err(|e| format!("{} 解析失败: {}", url, e))?;

    let mut versions: Vec<LoaderVersion> = Vec::new();
    for entry in entries {
        if let QuiltVersionEntry::Version { version, stable } = entry.loader {
            versions.push(LoaderVersion {
                id: version,
                r#type: if stable {
                    "release".to_string()
                } else {
                    "snapshot".to_string()
                },
            });
        }
    }

    Ok(versions)
}

/* ──────────────────────────────────────────────
   Loader Profile / Installation
   ────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoaderProfile {
    pub id: String,
    #[serde(default)]
    #[serde(rename = "inheritsFrom")]
    _inherits_from: Option<String>,
    #[serde(rename = "mainClass")]
    _main_class: String,
    #[serde(default)]
    pub libraries: Vec<LoaderLibEntry>,
    #[serde(default)]
    _arguments: Option<serde_json::Value>,
    #[serde(default)]
    #[serde(rename = "minecraftArguments")]
    _minecraft_arguments: String,
    #[serde(default)]
    #[serde(rename = "type")]
    _release_type: String,
    #[serde(default)]
    #[serde(rename = "releaseTime")]
    _release_time: String,
    #[serde(default)]
    _time: String,
    #[serde(flatten)]
    _extra: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct LoaderLibEntry {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub rules: Vec<OsRule>,
    #[serde(default)]
    _natives: std::collections::HashMap<String, String>,
    #[serde(flatten)]
    _extra: serde_json::Value,
}

/* ── public API ── */

/// Returns the profile version ID (e.g. "fabric-loader-0.16.10-1.21.4")
pub async fn install_loader(
    loader: &str,
    loader_version: &str,
    mc_version: &str,
    game_dir: &Path,
    channel: &str,
    task_id: &str,
    app: &AppHandle,
) -> Result<String, String> {
    match loader {
        "fabric" => install_fabric(loader_version, mc_version, game_dir, channel, task_id, app).await,
        "quilt" => install_quilt(loader_version, mc_version, game_dir, channel, task_id, app).await,
        "forge" => install_forge(loader_version, mc_version, game_dir, channel, task_id, app).await,
        "neoforge" => install_neoforge(loader_version, mc_version, game_dir, channel, task_id, app).await,
        _ => Err(format!("不支持的加载器: {}", loader)),
    }
}

/* ── Fabric ── */

async fn install_fabric(
    loader_version: &str,
    mc_version: &str,
    game_dir: &Path,
    channel: &str,
    task_id: &str,
    app: &AppHandle,
) -> Result<String, String> {
    let base = if channel == "official" {
        "https://meta.fabricmc.net"
    } else {
        "https://bmclapi2.bangbang93.com/fabric-meta"
    };

    let url = format!(
        "{}/v2/versions/loader/{}/{}/profile/json",
        base, mc_version, loader_version,
    );

    let profile = download_loader_profile(app, task_id, &url).await?;
    let profile_id = profile.id.clone();

    download_loader_libs(app, task_id, &profile.libraries, game_dir, channel, "fabric_libs").await?;
    save_loader_profile_json(app, game_dir, &profile_id, &url, task_id).await?;

    Ok(profile_id)
}

/* ── Quilt ── */

async fn install_quilt(
    loader_version: &str,
    mc_version: &str,
    game_dir: &Path,
    channel: &str,
    task_id: &str,
    app: &AppHandle,
) -> Result<String, String> {
    let base = if channel == "official" {
        "https://meta.quiltmc.org"
    } else {
        "https://bmclapi2.bangbang93.com/quilt-meta"
    };

    let url = format!(
        "{}/v3/versions/loader/{}/{}/profile/json",
        base, mc_version, loader_version,
    );

    let profile = download_loader_profile(app, task_id, &url).await?;
    let profile_id = profile.id.clone();

    download_loader_libs(app, task_id, &profile.libraries, game_dir, channel, "quilt_libs").await?;
    save_loader_profile_json(app, game_dir, &profile_id, &url, task_id).await?;

    Ok(profile_id)
}

/* ── Forge ── */

async fn install_forge(
    loader_version: &str,
    mc_version: &str,
    game_dir: &Path,
    channel: &str,
    task_id: &str,
    app: &AppHandle,
) -> Result<String, String> {
    let base = "https://bmclapi2.bangbang93.com";

    let url = format!(
        "{}/forge/download/{}-{}/json",
        base, mc_version, loader_version,
    );

    emit(app, task_id, "forge_profile", 0, 1, 0.0, "获取 Forge 配置...");

    let client = Client::new();
    let resp = client.get(&url).send().await
        .map_err(|e| format!("Forge 配置请求失败: {}", e))?;
    let bytes = resp.bytes().await
        .map_err(|e| format!("读取 Forge 配置失败: {}", e))?;

    let profile_id = format!("forge-{}-{}", loader_version, mc_version);
    let profile: LoaderProfile = serde_json::from_slice(&bytes)
        .map_err(|e| format!("解析 Forge 配置失败: {}", e))?;

    emit(app, task_id, "forge_profile", 1, 1, 0.0, "Forge 配置获取成功");

    download_loader_libs(app, task_id, &profile.libraries, game_dir, channel, "forge_libs").await?;
    save_loader_profile_raw(app, game_dir, &profile_id, &bytes, task_id).await?;

    Ok(profile_id)
}

/* ── NeoForge ── */

async fn install_neoforge(
    loader_version: &str,
    _mc_version: &str,
    game_dir: &Path,
    channel: &str,
    task_id: &str,
    app: &AppHandle,
) -> Result<String, String> {
    let maven_base = if channel == "official" {
        "https://maven.neoforged.net"
    } else {
        "https://bmclapi2.bangbang93.com/maven"
    };

    let maven_ver = loader_version;
    let lib_path_str = library_path(&format!("net.neoforged:neoforge:{}", maven_ver));
    let url = format!("{}/{}", maven_base, lib_path_str);
    let dest = game_dir.join("libraries").join(&lib_path_str);

    if !dest.exists() {
        emit(app, task_id, "neoforge_libs", 0, 1, 0.0,
            &format!("下载 NeoForge {}...", maven_ver));

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).await
                .map_err(|e| format!("创建 NeoForge 目录失败: {}", e))?;
        }

        download_single_file_quiet(&url, &dest).await
            .map_err(|e| format!("下载 NeoForge 失败: {}", e))?;

        emit(app, task_id, "neoforge_libs", 1, 1, 0.0, "NeoForge 下载完成");
    }

    let profile_id = format!("neoforge-{}", maven_ver);
    Ok(profile_id)
}

/* ── helpers ── */

fn emit(app: &AppHandle, task_id: &str, stage: &str, current: u64, total: u64, speed: f64, msg: &str) {
    let _ = app.emit("download-progress", DownloadProgress {
        task_id: task_id.to_string(),
        version_id: task_id.to_string(),
        stage: stage.to_string(),
        current,
        total,
        speed,
        message: msg.to_string(),
    });
}

async fn download_loader_profile(
    app: &AppHandle,
    task_id: &str,
    url: &str,
) -> Result<LoaderProfile, String> {
    emit(app, task_id, "loader_profile", 0, 1, 0.0, "获取加载器配置...");

    let client = Client::new();
    let resp = client.get(url).send().await
        .map_err(|e| format!("加载器配置请求失败 {}: {}", url, e))?;
    let bytes = resp.bytes().await
        .map_err(|e| format!("读取加载器配置失败: {}", e))?;

    let profile: LoaderProfile = serde_json::from_slice(&bytes)
        .map_err(|e| format!("解析加载器配置失败: {}", e))?;

    emit(app, task_id, "loader_profile", 1, 1, 0.0, "加载器配置获取成功");
    Ok(profile)
}

async fn download_loader_libs(
    app: &AppHandle,
    task_id: &str,
    libs: &[LoaderLibEntry],
    game_dir: &Path,
    channel: &str,
    stage: &str,
) -> Result<(), String> {
    let os_name = std::env::consts::OS;
    let total = libs.len() as u64;

    emit(app, task_id, stage, 0, total, 0.0,
        &format!("下载加载器依赖 0/{}", total));

    let (_, _, libraries_base) =
        crate::download::types::get_base_urls(if channel == "official" { "bmclapi" } else { channel });

    for (i, lib) in libs.iter().enumerate() {
        if !lib.rules.is_empty() {
            let mut allowed = false;
            for rule in &lib.rules {
                let matches = match &rule.os {
                    Some(ref os_cond) => os_cond.name.as_deref() == Some(os_name),
                    None => true,
                };
                if rule.action == "allow" && matches { allowed = true; }
                if rule.action == "disallow" && matches { allowed = false; }
            }
            if !allowed { continue; }
        }

        let lib_path_str = library_path(&lib.name);
        let dest = game_dir.join("libraries").join(&lib_path_str);

        if dest.exists() { continue; }

        if let Some(parent) = dest.parent() {
            let _ = fs::create_dir_all(parent).await;
        }

        let dl_url = if let Some(ref custom_url) = lib.url {
            let base = custom_url.trim_end_matches('/');
            format!("{}/{}", base, lib_path_str)
        } else {
            format!("{}/{}", libraries_base, lib_path_str)
        };

        if download_single_file_quiet(&dl_url, &dest).await.is_err() {
            let maven_fallback = if channel == "official" {
                format!("https://libraries.minecraft.net/{}", lib_path_str)
            } else {
                format!("{}/{}", libraries_base, lib_path_str)
            };
            let _ = download_single_file_quiet(&maven_fallback, &dest).await;
        }

        if (i + 1) % 5 == 0 || i == libs.len() - 1 {
            emit(app, task_id, stage, (i + 1) as u64, total, 0.0,
                &format!("加载器依赖 {}/{}", i + 1, total));
        }
    }

    emit(app, task_id, stage, total, total, 0.0, "加载器依赖下载完成");
    Ok(())
}

async fn save_loader_profile_json(
    app: &AppHandle,
    game_dir: &Path,
    profile_id: &str,
    profile_url: &str,
    task_id: &str,
) -> Result<(), String> {
    emit(app, task_id, "loader_save", 0, 1, 0.0, "保存加载器配置...");

    let client = Client::new();
    let resp = client.get(profile_url).send().await
        .map_err(|e| format!("下载配置失败: {}", e))?;
    let bytes = resp.bytes().await
        .map_err(|e| format!("读取配置失败: {}", e))?;

    save_loader_profile_raw(app, game_dir, profile_id, &bytes, task_id).await
}

async fn save_loader_profile_raw(
    _app: &AppHandle,
    game_dir: &Path,
    profile_id: &str,
    data: &[u8],
    task_id: &str,
) -> Result<(), String> {
    let version_dir = game_dir.join("versions").join(profile_id);
    fs::create_dir_all(&version_dir).await
        .map_err(|e| format!("创建版本目录失败: {}", e))?;

    let json_path = version_dir.join(format!("{}.json", profile_id));
    fs::write(&json_path, data).await
        .map_err(|e| format!("保存版本 JSON 失败: {}", e))?;

    emit(_app, task_id, "loader_save", 1, 1, 0.0, "加载器配置已保存");
    Ok(())
}

async fn download_single_file_quiet(url: &str, dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent).await;
    }

    let client = Client::new();
    let resp = client.get(url).send().await
        .map_err(|e| format!("下载失败: {}", e))?;
    let bytes = resp.bytes().await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    fs::write(dest, &bytes).await
        .map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(())
}