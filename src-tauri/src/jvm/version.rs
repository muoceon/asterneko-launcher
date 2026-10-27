use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct JvmVersion {
    pub version: String,
    pub vendor: Option<String>,
    pub arch: Option<String>,
}

impl JvmVersion {
    /// 零成本读取版本 —— 优先读 release 文件（JDK 9+），
    /// 回退到目录名解析，都不行返回 None
    pub fn from_jdk_path(path: &Path) -> Option<Self> {
        if let Some(v) = Self::from_release_file(path) {
            return Some(v);
        }
        if let Some(v) = Self::from_dirname(path) {
            return Some(v);
        }
        None
    }

    /// 解析 <jdk_root>/release 文件
    fn from_release_file(path: &Path) -> Option<Self> {
        let content = std::fs::read_to_string(path.join("release")).ok()?;
        Some(Self {
            version: parse_property(&content, "JAVA_VERSION")?,
            vendor: parse_property(&content, "IMPLEMENTOR"),
            arch: parse_property(&content, "OS_ARCH"),
        })
    }

    /// 从目录名提取版本，如 java-17-openjdk、jdk-21.0.1
    fn from_dirname(path: &Path) -> Option<Self> {
        let name = path.file_name()?.to_str()?;
        // 匹配像 17.0.9、21、1.8.0 这样的版本号
        let re = regex_lite::Regex::new(r"(\d+(?:\.\d+){1,3}(?:_\d+)?)").ok()?;
        let version = re.find(name)?.as_str().to_string();
        Some(Self {
            version,
            vendor: None,
            arch: None,
        })
    }

    /// 解析 java -version 的 stderr 输出（仅在 release 文件不存在时作为兜底）
    pub fn from_java_version_output(stderr: &str) -> Option<Self> {
        let first_line = stderr.lines().next()?;

        // 格式: "openjdk version \"21.0.1\" 2023-10-17"
        // 或者:  "java version \"1.8.0_202\""
        let re = regex_lite::Regex::new(r#"(\w+)\s+version\s+"([^"]+)""#).ok()?;
        let caps = re.captures(first_line)?;

        let vendor_raw = caps.get(1)?.as_str();
        let vendor = match vendor_raw {
            "openjdk" => Some("OpenJDK".to_string()),
            "java" => Some("Oracle".to_string()),
            other => Some(other.to_string()),
        };

        let version = caps.get(2)?.as_str().to_string();

        Some(Self {
            version,
            vendor,
            arch: None,
        })
    }
}

/// 从 properties 格式文本中提取 key 对应的 value
fn parse_property(content: &str, key: &str) -> Option<String> {
    let prefix = format!("{}=\"", key);
    for line in content.lines() {
        if let Some(stripped) = line.strip_prefix(&prefix) {
            return Some(stripped.trim_end_matches('"').to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_release() {
        let content = r#"IMPLEMENTOR="Eclipse Adoptium"
JAVA_VERSION="21.0.1"
JAVA_VERSION_DATE="2023-10-17"
OS_ARCH="amd64"
"#;
        assert_eq!(parse_property(content, "JAVA_VERSION"), Some("21.0.1".into()));
        assert_eq!(parse_property(content, "IMPLEMENTOR"), Some("Eclipse Adoptium".into()));
        assert_eq!(parse_property(content, "OS_ARCH"), Some("amd64".into()));
        assert_eq!(parse_property(content, "NON_EXIST"), None);
    }

    #[test]
    fn test_parse_java_version_openjdk() {
        let output = "openjdk version \"21.0.1\" 2023-10-17\nOpenJDK Runtime Environment (build 21.0.1+12-29)\n";
        let v = JvmVersion::from_java_version_output(output).unwrap();
        assert_eq!(v.version, "21.0.1");
        assert_eq!(v.vendor, Some("OpenJDK".into()));
    }

    #[test]
    fn test_parse_java_version_oracle() {
        let output = "java version \"1.8.0_202\" 2018-12-25\nJava(TM) SE Runtime Environment (build 1.8.0_202-b08)\n";
        let v = JvmVersion::from_java_version_output(output).unwrap();
        assert_eq!(v.version, "1.8.0_202");
        assert_eq!(v.vendor, Some("Oracle".into()));
    }

    #[test]
    fn test_dirname_parse() {
        assert!(JvmVersion::from_dirname(Path::new("/usr/lib/jvm/java-17-openjdk")).is_some());
        assert!(JvmVersion::from_dirname(Path::new("C:\\Program Files\\Java\\jdk-21.0.1")).is_some());
        assert!(JvmVersion::from_dirname(Path::new("/Library/Java/JavaVirtualMachines/jdk-11.0.21.jdk")).is_some());
        assert!(JvmVersion::from_dirname(Path::new("/no/version/here")).is_none());
    }
}