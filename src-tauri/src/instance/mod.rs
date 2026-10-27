use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub version_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loader: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loader_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_dir: Option<String>,
    pub game_dir: String,
    pub created_at: String,
    pub status: InstanceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstanceStatus {
    Ready,
    Installing,
    Error,
}

pub async fn save_instance(
    game_dir: &str,
    instance_id: &str,
    name: &str,
    version_id: &str,
    loader: Option<&str>,
    loader_version: Option<&str>,
    custom_dir: Option<&str>,
) -> Result<(), String> {
    let instances_root = PathBuf::from(game_dir).join("instances");
    fs::create_dir_all(&instances_root)
        .await
        .map_err(|e| format!("create instances dir: {}", e))?;

    let instance = Instance {
        id: instance_id.to_string(),
        name: name.to_string(),
        version_id: version_id.to_string(),
        loader: loader.map(|s| s.to_string()),
        loader_version: loader_version.map(|s| s.to_string()),
        custom_dir: custom_dir.map(|s| s.to_string()),
        game_dir: game_dir.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        status: InstanceStatus::Ready,
    };

    let json =
        serde_json::to_string_pretty(&instance).map_err(|e| format!("serialize instance: {}", e))?;

    let instance_dir = instances_root.join(instance_id);
    fs::create_dir_all(&instance_dir)
        .await
        .map_err(|e| format!("create instance dir: {}", e))?;

    let json_path = instance_dir.join("instance.json");
    fs::write(&json_path, json)
        .await
        .map_err(|e| format!("write instance.json: {}", e))?;

    Ok(())
}

pub async fn list_instances(game_dir: &str) -> Result<Vec<Instance>, String> {
    let instances_root = PathBuf::from(game_dir).join("instances");

    if !instances_root.exists() {
        return Ok(vec![]);
    }

    let mut entries = fs::read_dir(&instances_root)
        .await
        .map_err(|e| format!("read instances dir: {}", e))?;

    let mut instances = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let json_path = path.join("instance.json");
        if !json_path.exists() {
            continue;
        }

        match fs::read_to_string(&json_path).await {
            Ok(content) => match serde_json::from_str::<Instance>(&content) {
                Ok(mut inst) => {
                    if !inst.custom_dir.as_ref().map_or(false, |d| !d.is_empty()) {
                        if let Some(_dir_name) = path.file_name().and_then(|n| n.to_str()) {
                            inst.custom_dir = None;
                        }
                    }
                    instances.push(inst);
                }
                Err(e) => eprintln!("parse instance.json {}: {}", path.display(), e),
            },
            Err(e) => eprintln!("read instance.json {}: {}", path.display(), e),
        }
    }

    instances.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(instances)
}

pub async fn delete_instance(
    game_dir: &str,
    instance_id: &str,
    delete_files: bool,
) -> Result<(), String> {
    let instances_root = PathBuf::from(game_dir).join("instances");
    let instance_dir = instances_root.join(instance_id);

    if !instance_dir.exists() {
        return Err(format!("instance '{}' not found", instance_id));
    }

    if delete_files {
        fs::remove_dir_all(&instance_dir)
            .await
            .map_err(|e| format!("delete instance files: {}", e))?;

        let version_dir = PathBuf::from(game_dir)
            .join("versions")
            .join(instance_id);
        if version_dir.exists() {
            fs::remove_dir_all(&version_dir).await.ok();
        }
    } else {
        let json_path = instance_dir.join("instance.json");
        if json_path.exists() {
            fs::remove_file(&json_path)
                .await
                .map_err(|e| format!("remove instance.json: {}", e))?;
        }
    }

    Ok(())
}