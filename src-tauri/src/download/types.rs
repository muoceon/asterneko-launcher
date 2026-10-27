use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<ManifestVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestVersion {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub sha1: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub id: String,
    pub downloads: Option<VersionDownloads>,
    #[serde(rename = "assetIndex")]
    pub asset_index: Option<AssetIndexRef>,
    #[serde(default)]
    pub libraries: Vec<Library>,
    #[serde(rename = "javaVersion", default)]
    pub java_version: Option<JavaVersion>,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minecraftArguments", default)]
    pub minecraft_arguments: String,
    #[serde(default)]
    pub arguments: Option<Arguments>,
    #[serde(default)]
    pub logging: Option<LoggingConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionDownloads {
    pub client: DownloadInfo,
    #[serde(rename = "client_mappings", default)]
    pub client_mappings: Option<DownloadInfo>,
    #[serde(default)]
    pub server: Option<DownloadInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadInfo {
    pub url: String,
    pub sha1: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndexRef {
    pub id: String,
    pub url: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndex {
    pub objects: std::collections::HashMap<String, AssetObject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub rules: Vec<OsRule>,
    #[serde(default)]
    pub natives: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryDownloads {
    pub artifact: Option<DownloadInfo>,
    #[serde(default)]
    pub classifiers: std::collections::HashMap<String, DownloadInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OsRule {
    pub action: String,
    pub os: Option<OsCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OsCondition {
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersion {
    pub component: String,
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Arguments {
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggingConfig {
    pub client: LoggingClient,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggingClient {
    pub argument: String,
    pub file: DownloadInfo,
    #[serde(rename = "type")]
    pub log_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub task_id: String,
    pub version_id: String,
    pub stage: String,
    pub current: u64,
    pub total: u64,
    pub speed: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallOptions {
    pub task_id: String,
    pub version_id: String,
    pub game_dir: String,
    pub download_channel: String,
    #[serde(default)]
    pub instance_name: Option<String>,
    #[serde(default)]
    pub loader: Option<String>,
    #[serde(default)]
    pub loader_version: Option<String>,
}

pub fn get_base_urls(channel: &str) -> (&'static str, &'static str, &'static str) {
    if channel == "official" {
        (
            "https://piston-meta.mojang.com",
            "https://resources.download.minecraft.net",
            "https://libraries.minecraft.net",
        )
    } else {
        (
            "https://bmclapi2.bangbang93.com",
            "https://bmclapi2.bangbang93.com/assets",
            "https://bmclapi2.bangbang93.com/libraries",
        )
    }
}

pub fn library_path(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return name.replace('.', "/").replace(':', "/");
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    if parts.len() >= 4 {
        let classifier = parts[3];
        format!("{}/{}/{}/{}-{}-{}.jar", group, artifact, version, artifact, version, classifier)
    } else {
        format!("{}/{}/{}/{}-{}.jar", group, artifact, version, artifact, version)
    }
}