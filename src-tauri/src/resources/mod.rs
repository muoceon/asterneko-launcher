use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveEntry {
    pub name: String,
    pub dir_name: String,
    pub last_played: String,
    pub size_mb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackEntry {
    pub name: String,
    pub file_name: String,
    pub enabled: bool,
    pub size_mb: f64,
}

async fn calc_dir_size(path: &std::path::Path, max_depth: u32) -> u64 {
    if max_depth == 0 {
        return 0;
    }
    let mut total = 0u64;
    if let Ok(mut entries) = fs::read_dir(path).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let p = entry.path();
            if p.is_dir() {
                total += Box::pin(calc_dir_size(&p, max_depth - 1)).await;
            } else if let Ok(meta) = fs::metadata(&p).await {
                total += meta.len();
            }
        }
    }
    total
}

fn fmt_mb(bytes: u64) -> f64 {
    (bytes as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0
}

fn file_name_stem(path: &std::path::Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string()
}

/* ──── saves ──── */

pub async fn list_saves(game_dir: &str) -> Result<Vec<SaveEntry>, String> {
    let saves_dir = PathBuf::from(game_dir).join("saves");
    if !saves_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = fs::read_dir(&saves_dir)
        .await
        .map_err(|e| format!("read saves dir: {}", e))?;

    let mut saves = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if !path.join("level.dat").exists() {
            continue;
        }

        let dir_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Read level.dat for the actual world name (simple NBT hack: find "LevelName")
        let name = read_level_name(&path).await.unwrap_or_else(|| dir_name.clone());

        let metadata = fs::metadata(&path).await.ok();
        let modified = metadata
            .as_ref()
            .and_then(|m| m.modified().ok());
        let last_played = modified
            .map(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                dt.format("%Y-%m-%d %H:%M").to_string()
            })
            .unwrap_or_default();

        let size = calc_dir_size(&path, 4).await;
        let size_mb = fmt_mb(size);

        saves.push(SaveEntry {
            name,
            dir_name,
            last_played,
            size_mb,
        });
    }

    saves.sort_by(|a, b| b.last_played.cmp(&a.last_played));

    Ok(saves)
}

/// Best-effort read of "LevelName" from level.dat (gzip compressed NBT).
async fn read_level_name(world_dir: &std::path::Path) -> Option<String> {
    let level_dat = world_dir.join("level.dat");
    let bytes = fs::read(&level_dat).await.ok()?;
    if bytes.len() < 10 {
        return None;
    }
    // Skip gzip header: 10 bytes for standard gzip
    // Simple approach: search for "LevelName" string in decompressed data
    use std::io::Read;
    let mut decoder = flate2::read::GzDecoder::new(&bytes[..]);
    let mut raw = Vec::new();
    decoder.read_to_end(&mut raw).ok()?;

    // Find "LevelName" tag: type byte + 2 bytes name length + "LevelName" + string length + value
    let haystack = b"LevelName";
    if let Some(pos) = raw
        .windows(haystack.len())
        .position(|w| w == haystack)
    {
        // skip "LevelName" (9 bytes) to get to the string length (2 bytes big-endian for TAG_String)
        let name_end = pos + haystack.len();
        if name_end + 2 <= raw.len() {
            let len = u16::from_be_bytes([raw[name_end], raw[name_end + 1]]) as usize;
            let start = name_end + 2;
            let end = (start + len).min(raw.len());
            if end > start {
                let name = String::from_utf8_lossy(&raw[start..end]).to_string();
                if !name.is_empty() {
                    return Some(name);
                }
            }
        }
    }
    None
}

/* ──── mods ──── */

pub async fn list_mods(game_dir: &str) -> Result<Vec<PackEntry>, String> {
    let mods_dir = PathBuf::from(game_dir).join("mods");
    list_pack_dir(&mods_dir).await
}

/* ──── datapacks ──── */

pub async fn list_datapacks(game_dir: &str) -> Result<Vec<PackEntry>, String> {
    // Datapacks can be in 2 places:
    // 1. global: <game_dir>/datapacks/
    // 2. per-world: <game_dir>/saves/<world>/datapacks/
    // For now we scan the global one; per-world could be exposed under saves later.
    let dp_dir = PathBuf::from(game_dir).join("datapacks");
    list_pack_dir(&dp_dir).await
}

/* ──── resourcepacks ──── */

pub async fn list_resourcepacks(game_dir: &str) -> Result<Vec<PackEntry>, String> {
    let rp_dir = PathBuf::from(game_dir).join("resourcepacks");
    list_pack_dir(&rp_dir).await
}

/* ──── shaderpacks ──── */

pub async fn list_shaderpacks(game_dir: &str) -> Result<Vec<PackEntry>, String> {
    let sp_dir = PathBuf::from(game_dir).join("shaderpacks");
    list_pack_dir(&sp_dir).await
}

/* ──── shared helper ──── */

async fn list_pack_dir(dir: &std::path::Path) -> Result<Vec<PackEntry>, String> {
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut entries = fs::read_dir(dir)
        .await
        .map_err(|e| format!("read dir {}: {}", dir.display(), e))?;

    let mut packs = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        // Common pack extensions
        if !matches!(ext, "jar" | "zip" | "litemod" | "disabled") {
            // .disabled files are explicitly disabled mods
        }
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let enabled = ext != "disabled";
        let metadata = fs::metadata(&path).await.ok();
        let size_mb = metadata.map(|m| fmt_mb(m.len())).unwrap_or(0.0);
        let name = file_name_stem(&path);

        packs.push(PackEntry {
            name,
            file_name,
            enabled,
            size_mb,
        });
    }

    packs.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(packs)
}