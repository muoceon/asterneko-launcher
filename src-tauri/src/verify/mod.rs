use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

use crate::download::install::lib_allowed;
use crate::download::types::AssetIndex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    pub client_ok: bool,
    pub version_json_ok: bool,
    pub total_libraries: u64,
    pub ok_libraries: u64,
    pub total_assets: u64,
    pub ok_assets: u64,
    pub missing: Vec<String>,
    pub critical_missing: bool,
}

pub async fn verify_instance(game_dir: &str, version_id: &str) -> Result<VerifyResult, String> {
    let game_dir = PathBuf::from(game_dir);

    let client_jar = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{}.jar", version_id));
    let client_ok = client_jar.exists();

    let version_json = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    let version_json_ok = version_json.exists();

    if !version_json_ok {
        return Ok(VerifyResult {
            client_ok,
            version_json_ok: false,
            total_libraries: 0,
            ok_libraries: 0,
            total_assets: 0,
            ok_assets: 0,
            missing: vec![],
            critical_missing: true,
        });
    }

    let version_data = fs::read_to_string(&version_json)
        .await
        .map_err(|e| format!("读取版本 JSON 失败: {}", e))?;
    let info: crate::download::types::VersionInfo =
        serde_json::from_str(&version_data).map_err(|e| format!("解析版本 JSON 失败: {}", e))?;

    let libs_dir = game_dir.join("libraries");
    let os_name = std::env::consts::OS;
    let mut ok_libs = 0u64;
    let mut total_libs = 0u64;
    let mut missing = Vec::new();

    for lib in &info.libraries {
        if !lib_allowed(lib, os_name) {
            continue;
        }
        total_libs += 1;
        let lib_path_str = crate::download::types::library_path(&lib.name);
        let lib_path = libs_dir.join(&lib_path_str);
        if lib_path.exists() {
            ok_libs += 1;
        } else {
            missing.push(format!("libraries/{}", lib_path_str));
        }
    }

    let (total_assets, ok_assets) = match &info.asset_index {
        Some(asset_idx) => {
            let index_path = game_dir
                .join("assets")
                .join("indexes")
                .join(format!("{}.json", asset_idx.id));
            if index_path.exists() {
                let index_data =
                    fs::read_to_string(&index_path).await.unwrap_or_default();
                let idx: AssetIndex = match serde_json::from_str(&index_data) {
                    Ok(v) => v,
                    Err(_) => AssetIndex {
                        objects: std::collections::HashMap::new(),
                    },
                };
                let objects_dir = game_dir.join("assets").join("objects");
                let total = idx.objects.len() as u64;
                let mut ok = 0u64;
                for obj in idx.objects.values() {
                    let prefix = &obj.hash[..2.min(obj.hash.len())];
                    let obj_path = objects_dir.join(prefix).join(&obj.hash);
                    if obj_path.exists() {
                        ok += 1;
                    } else {
                        missing.push(format!("assets/objects/{}/{}", prefix, obj.hash));
                    }
                }
                (total, ok)
            } else {
                (0, 0)
            }
        }
        None => (0, 0),
    };

    let critical_missing = !client_ok || !version_json_ok;

    Ok(VerifyResult {
        client_ok,
        version_json_ok,
        total_libraries: total_libs,
        ok_libraries: ok_libs,
        total_assets,
        ok_assets,
        missing,
        critical_missing,
    })
}