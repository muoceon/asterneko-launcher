use crate::download::types::{
    get_base_urls, AssetIndex, DownloadProgress, Library, OsCondition,
};
use sha1::{Digest, Sha1};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::fs;

use super::aria2::Aria2Manager;
use super::manifest;
use super::transfer::fmt_bytes;
use super::version;

fn replace_mirror(url: &str, channel: &str) -> String {
    if channel == "official" {
        return url.to_string();
    }
    url.replace(
        "https://piston-meta.mojang.com",
        "https://bmclapi2.bangbang93.com",
    )
    .replace(
        "https://launchermeta.mojang.com",
        "https://bmclapi2.bangbang93.com",
    )
    .replace(
        "https://resources.download.minecraft.net",
        "https://bmclapi2.bangbang93.com/assets",
    )
    .replace(
        "https://libraries.minecraft.net",
        "https://bmclapi2.bangbang93.com/libraries",
    )
}

/// Download a single file via aria2 with retry on transient failures.
async fn download_with_retry(
    aria2: &Aria2Manager,
    url: &str,
    dest: &Path,
    task_id: &str,
    label: &str,
) -> Result<(), String> {
    const MAX_RETRIES: u32 = 3;
    let mut last_err = String::new();
    for attempt in 0..MAX_RETRIES {
        if aria2.is_cancelled(task_id) {
            return Err("下载已取消".into());
        }
        if dest.exists() {
            let _ = tokio::fs::remove_file(dest).await;
        }
        let gid = aria2.add_download(url, dest).await?;
        match aria2.await_download(&gid, task_id).await {
            Ok(_) => return Ok(()),
            Err(e) => {
                if attempt < MAX_RETRIES - 1 {
                    eprintln!("[aria2] {label} 失败({e})，重试 {}/{MAX_RETRIES}", attempt + 1);
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
                last_err = e;
            }
        }
    }
    Err(format!("{label} 下载失败(已重试{MAX_RETRIES}次): {last_err}"))
}

pub async fn install_version(
    app: AppHandle,
    aria2: &Aria2Manager,
    task_id: &str,
    version_id: &str,
    game_dir: &str,
    channel: &str,
    instance_name: Option<&str>,
    loader: Option<&str>,
    loader_version: Option<&str>,
) -> Result<(), String> {
    // Normalize: empty string = no loader
    let loader = loader.filter(|s| !s.is_empty());
    let loader_version = loader_version.filter(|s| !s.is_empty());

    let game_dir = Path::new(game_dir);
    let (_meta_base, assets_base, _libraries_base) = get_base_urls(channel);

    let emit = |stage: &str, current: u64, total: u64, speed: f64, msg: &str| {
        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                task_id: task_id.to_string(),
                version_id: version_id.to_string(),
                stage: stage.to_string(),
                current,
                total,
                speed,
                message: msg.to_string(),
            },
        );
    };

    let versions = manifest::fetch_manifest(channel).await?;
    let info = version::fetch_version_info(&versions, version_id, channel).await?;

    let versions_dir = game_dir.join("versions").join(version_id);
    fs::create_dir_all(&versions_dir)
        .await
        .map_err(|e| format!("创建版本目录失败: {}", e))?;

    // Step 1: download client.jar
    let client_jar = versions_dir.join(format!("{}.jar", version_id));
    if !client_jar.exists() {
        if let Some(ref downloads) = info.downloads {
            let client_url = replace_mirror(&downloads.client.url, channel);
            let jar_desc = format!("正在下载 Minecraft {version_id}.jar");
            let tmp_jar = client_jar.with_extension("jar.aria2tmp");

            // Retry loop for transient 403 etc.
            let max_jar_retries = 3u32;
            let mut jar_ok = false;
            let mut jar_last_err = String::new();
            for attempt in 0..max_jar_retries {
                if aria2.is_cancelled(task_id) {
                    return Err("下载已取消".into());
                }
                emit("client", 0, 1, 0.0, &format!("{jar_desc} …({}/{max_jar_retries})", attempt + 1));
                let _ = fs::remove_file(&tmp_jar).await;
                let gid = aria2.add_download(&client_url, &tmp_jar).await?;
                match aria2
                    .await_with_progress(&gid, task_id, |done, total, speed| {
                        let _ = app.emit(
                            "download-progress",
                            DownloadProgress {
                                task_id: task_id.to_string(),
                                version_id: version_id.to_string(),
                                stage: "client".to_string(),
                                current: 0,
                                total: 1,
                                speed: speed as f64,
                                message: format!(
                                    "{} … {} / {}",
                                    jar_desc,
                                    fmt_bytes(done),
                                    fmt_bytes(total.max(done))
                                ),
                            },
                        );
                    })
                    .await
                {
                    Ok(_) => {
                        jar_ok = true;
                        break;
                    }
                    Err(e) => {
                        if attempt < max_jar_retries - 1 {
                            eprintln!("[aria2] {jar_desc} 失败({e})，重试 {}/{max_jar_retries}", attempt + 1);
                            tokio::time::sleep(Duration::from_secs(2)).await;
                        }
                        jar_last_err = e;
                    }
                }
            }
            if !jar_ok {
                return Err(format!("{jar_desc} 下载失败(已重试{max_jar_retries}次): {jar_last_err}"));
            }

            fs::rename(&tmp_jar, &client_jar)
                .await
                .map_err(|e| format!("移动文件失败: {}", e))?;

            let jar_bytes = fs::read(&client_jar)
                .await
                .map_err(|e| format!("读取 JAR 失败: {}", e))?;
            let mut hasher = Sha1::new();
            hasher.update(&jar_bytes);
            let hash = format!("{:x}", hasher.finalize());
            if hash != downloads.client.sha1 {
                fs::remove_file(&client_jar).await.ok();
                return Err(format!("客户端 JAR SHA1 校验失败: 期望 {} 实际 {}", downloads.client.sha1, hash));
            }
            emit("client", 1, 1, 0.0, "Minecraft 主文件下载完成");
        }
    }

    // Step 2: download asset index + assets
    if let Some(ref asset_idx) = info.asset_index {
        let indexes_dir = game_dir.join("assets").join("indexes");
        fs::create_dir_all(&indexes_dir)
            .await
            .map_err(|e| format!("创建资源索引目录失败: {}", e))?;

        let index_path = indexes_dir.join(format!("{}.json", &asset_idx.id));
        let asset_index_url = replace_mirror(&asset_idx.url, channel);
        emit("asset_index", 0, 1, 0.0, "正在下载资源索引 …");
        download_with_retry(aria2, &asset_index_url, &index_path, task_id, "资源索引").await?;
        emit("asset_index", 1, 1, 0.0, "资源索引下载完成");

        let index_data = fs::read_to_string(&index_path)
            .await
            .map_err(|e| format!("读取资源索引失败: {}", e))?;
        let asset_index: AssetIndex =
            serde_json::from_str(&index_data)
                .map_err(|e| format!("解析资源索引失败: {}", e))?;

        let objects_dir = game_dir.join("assets").join("objects");
        let asset_count = asset_index.objects.len() as u64;

        // Collect missing assets to download
        let mut missing: Vec<(String, std::path::PathBuf)> = Vec::new();
        let mut already_done: u64 = 0;
        for (_name, obj) in asset_index.objects.iter() {
            let hash = &obj.hash;
            let prefix = &hash[..2];
            let obj_dir = objects_dir.join(prefix);
            let obj_path = obj_dir.join(hash);
            if obj_path.exists() {
                already_done += 1;
            } else {
                fs::create_dir_all(&obj_dir)
                    .await
                    .map_err(|e| format!("创建资源目录失败: {}", e))?;
                let asset_url = format!("{}/{}/{}", assets_base, prefix, hash);
                missing.push((asset_url, obj_path));
            }
        }

        if !missing.is_empty() {
            emit("assets", already_done, asset_count, 0.0,
                &format!("资源 {}/{} 已存在，提交 {} 个到 aria2 …", already_done, asset_count, missing.len()));

            let baseline = aria2.get_global_stat().await?.num_stopped;

            // Submit all to aria2
            for (url, dest) in &missing {
                let _ = aria2.add_download(url, dest).await?;
            }

            // Wait for all to complete
            let started = already_done;
            let total = asset_count;
            aria2.await_all_done(total, started, baseline, task_id, |done, total, speed| {
                let _ = app.emit(
                    "download-progress",
                    DownloadProgress {
                        task_id: task_id.to_string(),
                        version_id: version_id.to_string(),
                        stage: "assets".to_string(),
                        current: done,
                        total,
                        speed: speed as f64,
                        message: format!("正在下载资源文件 {}/{}", done, total),
                    },
                );
            }).await?;

            // Verify and retry failed downloads up to 3 times
            let mut retry = 0;
            loop {
                let mut failed: Vec<(String, std::path::PathBuf)> = Vec::new();
                for (url, dest) in &missing {
                    if !dest.exists() {
                        failed.push((url.clone(), dest.clone()));
                    }
                }
                if failed.is_empty() {
                    break;
                }
                if retry >= 3 {
                    emit("assets", already_done as u64 + missing.len() as u64 - failed.len() as u64,
                        asset_count, 0.0,
                        &format!("资源下载完成，但 {} 个文件下载失败", failed.len()));
                    break;
                }
                retry += 1;
                let retry_baseline = aria2.get_global_stat().await?.num_stopped;
                for (url, dest) in &failed {
                    let _ = aria2.add_download(url, dest).await?;
                }
                let already_ok = asset_count - failed.len() as u64;
                aria2.await_all_done(asset_count, already_ok, retry_baseline, task_id, |done, total, speed| {
                        let _ = app.emit("download-progress", DownloadProgress {
                            task_id: task_id.to_string(),
                            version_id: version_id.to_string(),
                            stage: "assets".to_string(),
                            current: done,
                            total,
                            speed: speed as f64,
                            message: format!("正在重试资源 {}/{}（第 {} 次）", done, total, retry),
                        });
                    }).await?;
            }
        }

        emit("assets", asset_count, asset_count, 0.0, "资源文件下载完成");
    }

    // Step 3: download libraries
    let libs_dir = game_dir.join("libraries");
    let os_name = std::env::consts::OS;

    let downloadable: Vec<&Library> = info
        .libraries
        .iter()
        .filter(|lib| lib_allowed(lib, os_name))
        .collect();

    let lib_count = downloadable.len() as u64;

    // Collect missing libraries
    let mut lib_missing: Vec<(String, std::path::PathBuf)> = Vec::new();
    let mut lib_done: u64 = 0;
    for lib in &downloadable {
        let lib_path_str = super::types::library_path(&lib.name);
        let lib_path = libs_dir.join(&lib_path_str);
        if lib_path.exists() {
            lib_done += 1;
            continue;
        }
        if let Some(parent) = lib_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("创建库目录失败: {}", e))?;
        }
        let dl_url = if let Some(ref downloads) = lib.downloads {
            if let Some(ref artifact) = downloads.artifact {
                Some(replace_mirror(&artifact.url, channel))
            } else {
                let native_key = match os_name {
                    "windows" => "natives-windows",
                    "macos" => "natives-macos",
                    "linux" => "natives-linux",
                    _ => "natives-linux",
                };
                if let Some(native_id) = lib.natives.get(native_key) {
                    downloads
                        .classifiers
                        .get(native_id)
                        .map(|d| replace_mirror(&d.url, channel))
                } else {
                    None
                }
            }
        } else {
            None
        };
        if let Some(url) = dl_url {
            lib_missing.push((url, lib_path));
        } else {
            lib_done += 1;
        }
    }

    if !lib_missing.is_empty() {
        emit("libraries", lib_done, lib_count, 0.0,
            &format!("依赖库 {}/{} 已存在，提交 {} 个到 aria2 …", lib_done, lib_count, lib_missing.len()));

        let baseline = aria2.get_global_stat().await?.num_stopped;

        for (url, dest) in &lib_missing {
            let _ = aria2.add_download(url, dest).await?;
        }

        let started = lib_done;
        let total = lib_count;
        aria2.await_all_done(total, started, baseline, task_id, |done, total, speed| {
            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    task_id: task_id.to_string(),
                    version_id: version_id.to_string(),
                    stage: "libraries".to_string(),
                    current: done,
                    total,
                    speed: speed as f64,
                    message: format!("正在下载依赖库 {}/{}", done, total),
                },
            );
        }).await?;

        // Verify and retry failed library downloads up to 3 times
        let mut lib_retry = 0;
        loop {
            let mut lib_failed: Vec<(String, std::path::PathBuf)> = Vec::new();
            for (url, dest) in &lib_missing {
                if !dest.exists() {
                    lib_failed.push((url.clone(), dest.clone()));
                }
            }
            if lib_failed.is_empty() {
                break;
            }
            if lib_retry >= 3 {
                emit("libraries", lib_done as u64 + lib_missing.len() as u64 - lib_failed.len() as u64,
                    lib_count, 0.0,
                    &format!("依赖库下载完成，但 {} 个文件下载失败", lib_failed.len()));
                break;
            }
            lib_retry += 1;
            let lib_retry_baseline = aria2.get_global_stat().await?.num_stopped;
            for (url, dest) in &lib_failed {
                let _ = aria2.add_download(url, dest).await?;
            }
            let lib_already_ok = lib_count - lib_failed.len() as u64;
            aria2.await_all_done(lib_count, lib_already_ok, lib_retry_baseline, task_id, |done, total, speed| {
                    let _ = app.emit("download-progress", DownloadProgress {
                        task_id: task_id.to_string(),
                        version_id: version_id.to_string(),
                        stage: "libraries".to_string(),
                        current: done,
                        total,
                        speed: speed as f64,
                        message: format!("正在重试依赖库 {}/{}（第 {} 次）", done, total, lib_retry),
                    });
                }).await?;
        }
    }
    emit("libraries", lib_count, lib_count, 0.0, "依赖库下载完成");

    // Step 4: save version JSON
    let version_json = versions_dir.join(format!("{}.json", version_id));
    if !version_json.exists() {
        let json = serde_json::to_string_pretty(&info).unwrap_or_default();
        fs::write(&version_json, json)
            .await
            .map_err(|e| format!("保存版本 JSON 失败: {}", e))?;
    }

    // Step 4.5: install loader (Fabric / Forge / NeoForge / Quilt)
    let effective_version_id = if let (Some(ldr), Some(ldr_ver)) = (loader, loader_version) {
        let ldr_name = match ldr {
            "fabric" => "Fabric",
            "forge" => "Forge",
            "neoforge" => "NeoForge",
            "quilt" => "Quilt",
            _ => "加载器",
        };
        let ldr_label = format!("{ldr_name} {ldr_ver}");
        match crate::download::loader::install_loader(
            ldr, ldr_ver, version_id, game_dir, channel, task_id, &app,
        )
        .await
        {
            Ok(profile_id) => {
                emit("loader", 1, 1, 0.0,
                    &format!("{ldr_label} 加载器安装完成"));
                profile_id
            }
            Err(e) => {
                emit("loader", 0, 1, 0.0, &format!("加载器安装失败: {}", e));
                return Err(format!("加载器安装失败: {}", e));
            }
        }
    } else {
        version_id.to_string()
    };

    // Step 5: save instance metadata
    let name = instance_name.unwrap_or(version_id);
    crate::instance::save_instance(
        game_dir.to_str().unwrap_or(".minecraft"),
        &effective_version_id,
        name,
        version_id,
        loader.as_deref(),
        loader_version.as_deref(),
        None,
    )
    .await
    .unwrap_or_else(|e| eprintln!("save instance metadata: {}", e));

    // Step 6: create instance directories (isolated per version)
    let instances_dir = game_dir.join("instances").join(&effective_version_id);
    for sub in ["saves", "mods", "config", "resourcepacks", "shaderpacks", "screenshots"] {
        let p = instances_dir.join(sub);
        if !p.exists() {
            fs::create_dir_all(&p).await.ok();
        }
    }

    emit("done", 1, 1, 0.0, &format!("Minecraft {effective_version_id} 安装完成"));
    Ok(())
}

pub(crate) fn lib_allowed(lib: &Library, os_name: &str) -> bool {
    if !classifier_arch_ok(&lib.name) {
        return false;
    }
    if lib.rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in &lib.rules {
        let matches = match &rule.os {
            Some(OsCondition { name: Some(name) }) => name == os_name,
            _ => true,
        };
        if rule.action == "allow" && matches {
            allowed = true;
        }
        if rule.action == "disallow" && matches {
            allowed = false;
        }
    }
    allowed
}

pub(crate) fn classifier_arch_ok(name: &str) -> bool {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 4 {
        return true;
    }
    let classifier = parts[3];
    if classifier.contains("arm64") || classifier.contains("aarch64") {
        return cfg!(target_arch = "aarch64");
    }
    if classifier.contains("arm32") || classifier.contains("arm") {
        return cfg!(target_arch = "arm");
    }
    if classifier.contains("x86_64") || classifier.contains("amd64") {
        return cfg!(target_arch = "x86_64");
    }
    if classifier.contains("x86") && !classifier.contains("x86_64") {
        return cfg!(target_arch = "x86");
    }
    true
}