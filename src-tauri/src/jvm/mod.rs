pub mod scan;
pub mod version;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JvmInstallation {
    pub path: String,
    pub java_executable: String,
    pub version: Option<String>,
    pub vendor: Option<String>,
    pub arch: Option<String>,
    pub source: JvmSource,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JvmSource {
    Automatic,
    Manual,
}