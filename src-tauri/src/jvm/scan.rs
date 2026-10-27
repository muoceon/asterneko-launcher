use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};

use crate::jvm::{
    JvmInstallation, JvmSource,
    version::JvmVersion,
};

/// 扫描当前系统上所有可用的 JVM 安装
pub fn scan_all() -> Vec<JvmInstallation> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    // 1. JAVA_HOME 环境变量（最高优先级）
    if let Some(java_home) = std::env::var_os("JAVA_HOME") {
        let path = PathBuf::from(&java_home);
        if let Some(inst) = build_installation(&path, JvmSource::Automatic) {
            if seen.insert(normalize(&inst.java_executable)) {
                result.push(inst);
            }
        }
    }

    // 2. 平台特定的扫描
    let platform_paths = scan_platform_specific();
    for path in platform_paths {
        if let Some(inst) = build_installation(&path, JvmSource::Automatic) {
            if seen.insert(normalize(&inst.java_executable)) {
                result.push(inst);
            }
        }
    }

    // 3. 从 PATH 中查找 java 并反向定位
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let java_bin = dir.join(java_executable_name());
            if java_bin.is_file() {
                // 反向定位: .../bin/java → 上级目录
                if let Some(jdk_root) = dir.parent() {
                    if let Some(inst) = build_installation(jdk_root, JvmSource::Automatic) {
                        if seen.insert(normalize(&inst.java_executable)) {
                            result.push(inst);
                        }
                    }
                }
            }
        }
    }

    result
}

/// 平台特定的扫描路径
fn scan_platform_specific() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // 注册表
        let jdks = read_registry_jdks();
        paths.extend(jdks);

        // 常见安装目录
        for base in &[
            r"C:\Program Files\Java",
            r"C:\Program Files (x86)\Java",
            r"C:\Program Files\Eclipse Adoptium",
            r"C:\Program Files\Microsoft",
            r"C:\Program Files\Amazon Corretto",
            r"C:\Program Files\Zulu",
        ] {
            if let Ok(entries) = std::fs::read_dir(base) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        // 检查是否包含 bin/java.exe
                        let java_exe = p.join("bin").join("java.exe");
                        if java_exe.is_file() {
                            paths.push(p);
                        } else {
                            // 可能 jdk 根目录下还有一层子目录
                            if let Ok(sub) = std::fs::read_dir(&p) {
                                for s in sub.flatten() {
                                    let sp = s.path();
                                    if sp.is_dir() && sp.join("bin").join("java.exe").is_file() {
                                        paths.push(sp);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // /usr/libexec/java_home -V (一条命令查出所有)
        if let Ok(output) = std::process::Command::new("/usr/libexec/java_home")
            .arg("-V")
            .output()
        {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // 输出格式: "Matching Java Virtual Machines (3):"
            // 后续行: "    21.0.1 (arm64) \"Eclipse Adoptium\" - ... /Library/Java/..."
            for line in stderr.lines() {
                if let Some(pos) = line.rfind('/') {
                    let path = PathBuf::from(&line[pos..].trim());
                    if path.is_dir() {
                        paths.push(path);
                    }
                }
            }
        }

        // 兜底遍历 /Library/Java/JavaVirtualMachines/
        let jvm_dir = Path::new("/Library/Java/JavaVirtualMachines");
        if let Ok(entries) = std::fs::read_dir(jvm_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() || p.extension().map_or(false, |e| e == "jdk") {
                    // macOS 的 .jdk bundle 内部结构:
                    // jdk-21.jdk/Contents/Home/bin/java
                    let home = p.join("Contents").join("Home");
                    if home.join("bin").join("java").is_file() {
                        paths.push(home);
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // 常见 JVM 目录
        for base in &[
            "/usr/lib/jvm",
            "/usr/java",
            "/usr/local/java",
        ] {
            if let Ok(entries) = std::fs::read_dir(base) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() && p.join("bin").join("java").is_file() {
                        paths.push(p);
                    }
                }
            }
        }

        // update-alternatives (Debian/Ubuntu)
        if let Ok(output) = std::process::Command::new("update-alternatives")
            .args(["--list", "java"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let java_bin = PathBuf::from(line.trim());
                if let Some(bin_dir) = java_bin.parent() {
                    if let Some(jdk_root) = bin_dir.parent() {
                        if jdk_root.join("release").is_file() {
                            paths.push(jdk_root.to_path_buf());
                        }
                    }
                }
            }
        }

        // SDKMAN
        if let Ok(home) = std::env::var("HOME") {
            let sdkman_javas = Path::new(&home).join(".sdkman").join("candidates").join("java");
            if sdkman_javas.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&sdkman_javas) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.is_dir() && p.join("bin").join("java").is_file() {
                            paths.push(p);
                        }
                    }
                }
            }
        }
    }

    paths
}

/// 构建 JvmInstallation，自动提取版本信息
fn build_installation(jdk_root: &Path, source: JvmSource) -> Option<JvmInstallation> {
    let java_exe = jdk_root.join("bin").join(java_executable_name());
    if !java_exe.is_file() {
        return None;
    }

    let version_info = JvmVersion::from_jdk_path(jdk_root);

    Some(JvmInstallation {
        path: jdk_root.display().to_string(),
        java_executable: java_exe.display().to_string(),
        version: version_info.as_ref().map(|v| v.version.clone()),
        vendor: version_info.as_ref().and_then(|v| v.vendor.clone()),
        arch: version_info.as_ref().and_then(|v| v.arch.clone()),
        source,
    })
}

/// 手动添加一个 JVM 路径（用户通过文件选择器指定）
pub fn add_manual(java_bin: &Path) -> Option<JvmInstallation> {
    // 用户可能选的是 java.exe / java 文件，也可能是 JDK 根目录
    let jdk_root = if java_bin.extension().is_some() || java_bin.file_name().map_or(false, |n| n == "java") {
        // 选了 java 可执行文件 → 上级目录
        let bin_dir = java_bin.parent()?;
        bin_dir.parent()?.to_path_buf()
    } else {
        // 选了目录
        java_bin.to_path_buf()
    };

    build_installation(&jdk_root, JvmSource::Manual)
}

/// 异步执行 java -version 获取版本（仅用于没有 release 文件的老 JDK）
pub fn get_version_via_process(java_bin: &Path) -> Option<JvmVersion> {
    let output = std::process::Command::new(java_bin)
        .arg("-version")
        .output()
        .ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    JvmVersion::from_java_version_output(&stderr)
}

fn java_executable_name() -> &'static str {
    #[cfg(target_os = "windows")]
    { "java.exe" }
    #[cfg(not(target_os = "windows"))]
    { "java" }
}

fn normalize(path: &str) -> String {
    dunce::canonicalize(Path::new(path))
        .unwrap_or_else(|_| PathBuf::from(path))
        .display()
        .to_string()
        .to_lowercase()
}

// ---- Windows 注册表 ----

#[cfg(target_os = "windows")]
fn read_registry_jdks() -> Vec<PathBuf> {
    use windows_registry::LOCAL_MACHINE;

    let mut paths = Vec::new();

    for key_name in &["SOFTWARE\\JavaSoft\\JDK", "SOFTWARE\\JavaSoft\\JRE"] {
        let key = match LOCAL_MACHINE.open(*key_name) {
            Ok(k) => k,
            Err(_) => continue,
        };

        if let Ok(subkeys) = key.keys() {
            for subkey in subkeys {
                if let Ok(entry) = key.open(&subkey) {
                    if let Ok(java_home) = entry.get_string("JavaHome") {
                        let path = PathBuf::from(java_home);
                        if path.join("bin").join("java.exe").is_file() {
                            paths.push(path);
                        }
                    }
                }
            }
        }
    }

    paths
}