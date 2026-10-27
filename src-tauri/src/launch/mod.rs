use crate::auth::GameAccount;
use crate::download::types::{self, VersionInfo};
use crate::jvm;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;

fn os_name() -> &'static str {
    std::env::consts::OS
}

fn classpath_sep() -> &'static str {
    if cfg!(windows) { ";" } else { ":" }
}

fn native_key() -> &'static str {
    match os_name() {
        "windows" => "natives-windows",
        "macos" => "natives-macos",
        _ => "natives-linux",
    }
}

fn native_ext() -> &'static str {
    if cfg!(windows) { ".dll" } else if cfg!(target_os = "macos") { ".dylib" } else { ".so" }
}

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchOptions {
    pub game_dir: String,
    pub version_id: String,
    pub java_path: String,
    pub jvm_args: Vec<String>,
    pub account: GameAccount,
    pub window_width: u32,
    pub window_height: u32,
    pub loader: Option<String>,
    pub loader_version: Option<String>,
    pub base_mc_version: Option<String>,
    pub access_token: Option<String>,
    pub quick_launch_world: Option<String>,
}

/// Launch Minecraft, returns the spawned child process handle.
pub fn launch_game(opts: &LaunchOptions) -> Result<Child, String> {
    let game_dir = Path::new(&opts.game_dir)
        .canonicalize()
        .map_err(|e| format!("游戏目录不存在或无法访问: {} ({})", opts.game_dir, e))?;
    let version_id = &opts.version_id;

    let version_info = resolve_version(&game_dir, version_id, opts)?;
    let classpath = build_classpath(&version_info, &game_dir, version_id)?;
    let natives_dir = extract_natives(&version_info, &game_dir, version_id)?;
    let logging_arg = setup_logging(&version_info, &game_dir, version_id)?;

    let mut jvm_args = build_jvm_args(&version_info, &natives_dir, &classpath, version_id, &game_dir, &opts.jvm_args);
    let main_class = jvm_args.pop().unwrap_or_default();
    if let Some(log_arg) = logging_arg {
        jvm_args.push(log_arg);
    }
    jvm_args.push(main_class);
    let game_args = build_game_args(&version_info, &opts.account, opts.access_token.as_deref(), opts.quick_launch_world.as_deref(), version_id, &game_dir, opts.window_width, opts.window_height);

    let mut cmd = Command::new(&opts.java_path);
    cmd.current_dir(&game_dir);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    for arg in &jvm_args {
        cmd.arg(arg);
    }
    for arg in &game_args {
        cmd.arg(arg);
    }

    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());

    let stderr_file = game_dir
        .join("versions")
        .join(version_id)
        .join("launcher_stderr.log");

    {
        use std::io::Write;
        let mut f = fs::File::create(&stderr_file)
            .map_err(|e| format!("无法创建错误日志: {}", e))?;
        writeln!(f, "=== {} ===", opts.java_path).ok();
        writeln!(f, "cwd: {}", game_dir.display()).ok();
        for a in &jvm_args {
            write!(f, "{} ", a).ok();
        }
        writeln!(f).ok();
        for a in &game_args {
            write!(f, "{} ", a).ok();
        }
        writeln!(f, "\n--- stdout/stderr ---").ok();
        cmd.stderr(f);
    }

    let mut child = cmd.spawn().map_err(|e| format!("启动游戏失败: {}", e))?;

    thread::sleep(Duration::from_millis(800));
    match child.try_wait() {
        Ok(Some(status)) => {
            let log_content = fs::read_to_string(&stderr_file)
                .unwrap_or_default();
            let output = if !log_content.trim().is_empty() {
                log_content.trim().lines().take(8).collect::<Vec<_>>().join("\n")
            } else {
                format!("进程退出, exit code: {}, 前10行 args: {}",
                    status.code().map_or(-1, |c| c),
                    jvm_args.iter().take(10).map(|a| a.as_str()).collect::<Vec<_>>().join(" "))
            };
            return Err(format!("游戏进程启动后立即退出:\n{}", output));
        }
        Ok(None) => {}
        Err(e) => return Err(format!("检查进程状态失败: {}", e)),
    }

    Ok(child)
}

/// Kill a running game process.
/// Returns true if killed, false if already exited.
pub fn kill_game(child: &mut Child) -> Result<bool, String> {
    match child.try_wait() {
        Ok(Some(_)) => return Ok(false),
        Ok(None) => {}
        Err(e) => return Err(format!("检查进程状态失败: {}", e)),
    }
    child.kill().map_err(|e| format!("终止进程失败: {}", e))?;
    Ok(true)
}

/* ──────────────────────────────────────────────
   Version Resolution (inheritsFrom merging)
   ────────────────────────────────────────────── */

fn resolve_version(
    game_dir: &Path,
    version_id: &str,
    opts: &LaunchOptions,
) -> Result<VersionInfo, String> {
    let version_dir = game_dir.join("versions").join(version_id);
    let json_path = version_dir.join(format!("{}.json", version_id));

    if !json_path.exists() {
        return resolve_neoforge_version(game_dir, version_id, opts);
    }

    let content = std::fs::read_to_string(&json_path)
        .map_err(|e| format!("读取版本 JSON 失败 ({}): {}", json_path.display(), e))?;

    let child: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析版本 JSON 失败: {}", e))?;

    let inherits_from = child.get("inheritsFrom")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    match inherits_from {
        Some(parent_id) => {
            let parent = read_version_from_disk(game_dir, &parent_id)?;
            merge_versions(&child, &parent)
        }
        None => {
            serde_json::from_str(&content)
                .map_err(|e| format!("解析版本 JSON 失败: {}", e))
        }
    }
}

fn read_version_from_disk(game_dir: &Path, version_id: &str) -> Result<VersionInfo, String> {
    let json_path = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    let content = std::fs::read_to_string(&json_path)
        .map_err(|e| format!("读取父版本 JSON 失败 ({}): {}", json_path.display(), e))?;

    let parent: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析父版本 JSON 失败: {}", e))?;

    let inherits_from = parent.get("inheritsFrom")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    match inherits_from {
        Some(grandparent_id) => {
            let grandparent = read_version_from_disk(game_dir, &grandparent_id)?;
            merge_versions(&parent, &grandparent)
        }
        None => {
            serde_json::from_str(&content)
                .map_err(|e| format!("解析父版本 JSON 失败: {}", e))
        }
    }
}

fn merge_versions(child: &serde_json::Value, parent: &VersionInfo) -> Result<VersionInfo, String> {
    let parent_json = serde_json::to_value(parent)
        .map_err(|e| format!("序列化父版本失败: {}", e))?;

    let mut merged = parent_json.clone();

    if let Some(main_class) = child.get("mainClass").and_then(|v| v.as_str()) {
        merged["mainClass"] = serde_json::Value::String(main_class.to_string());
    }

    if let Some(child_args) = child.get("arguments") {
        let mut final_args = parent_json.get("arguments").cloned().unwrap_or(serde_json::json!({}));
        if let Some(child_game) = child_args.get("game") {
            let parent_game = final_args.get("game").cloned().unwrap_or(serde_json::json!([]));
            let merged_game = merge_arg_arrays(child_game, &parent_game);
            final_args["game"] = merged_game;
        }
        if let Some(child_jvm) = child_args.get("jvm") {
            let parent_jvm = final_args.get("jvm").cloned().unwrap_or(serde_json::json!([]));
            let merged_jvm = merge_arg_arrays(child_jvm, &parent_jvm);
            final_args["jvm"] = merged_jvm;
        }
        merged["arguments"] = final_args;
    }

    if let Some(child_mc_args) = child.get("minecraftArguments").and_then(|v| v.as_str()) {
        merged["minecraftArguments"] = serde_json::Value::String(child_mc_args.to_string());
    }

    if let Some(child_libs) = child.get("libraries") {
        let mut all_libs: Vec<serde_json::Value> = child_libs.as_array().cloned().unwrap_or_default();
        if let Some(parent_libs) = parent_json.get("libraries").and_then(|v| v.as_array()) {
            for lib in parent_libs {
                let lib_name = lib.get("name").and_then(|n| n.as_str()).unwrap_or("");
                if !all_libs.iter().any(|l| {
                    l.get("name").and_then(|n| n.as_str()).unwrap_or("") == lib_name
                }) {
                    all_libs.push(lib.clone());
                }
            }
        }
        merged["libraries"] = serde_json::Value::Array(all_libs);
    }

    if let Some(logging) = child.get("logging") {
        merged["logging"] = logging.clone();
    }

    if let Some(java_version) = child.get("javaVersion") {
        merged["javaVersion"] = java_version.clone();
    }

    serde_json::from_value(merged)
        .map_err(|e| format!("合并版本 JSON 失败: {}", e))
}

fn merge_arg_arrays(child: &serde_json::Value, parent: &serde_json::Value) -> serde_json::Value {
    let child_arr = child.as_array().cloned().unwrap_or_default();
    let parent_arr = parent.as_array().cloned().unwrap_or_default();

    let mut merged: Vec<serde_json::Value> = Vec::new();
    for item in child_arr.into_iter().chain(parent_arr.into_iter()) {
        let key = match &item {
            serde_json::Value::String(s) => s.clone(),
            other => serde_json::to_string(other).unwrap_or_default(),
        };
        if !merged.iter().any(|m| {
            let mk = match m {
                serde_json::Value::String(s) => s.clone(),
                o => serde_json::to_string(o).unwrap_or_default(),
            };
            mk == key
        }) {
            merged.push(item);
        }
    }
    serde_json::Value::Array(merged)
}

fn resolve_neoforge_version(
    game_dir: &Path,
    version_id: &str,
    opts: &LaunchOptions,
) -> Result<VersionInfo, String> {
    let base_mc = opts.base_mc_version.as_ref()
        .ok_or_else(|| "NeoForge 实例缺少基础 MC 版本".to_string())?;

    let mut info = read_version_from_disk(game_dir, base_mc)?;

    let neoforge_ver = match opts.loader_version.as_ref() {
        Some(v) => v.as_str(),
        None => version_id.strip_prefix("neoforge-")
            .ok_or_else(|| "无法确定 NeoForge 版本".to_string())?,
    };

    let lib_name = format!("net.neoforged:neoforge:{}", neoforge_ver);
    let lib_path_str = types::library_path(&lib_name);
    let neoforge_jar = game_dir.join("libraries").join(&lib_path_str);

    if !neoforge_jar.exists() {
        return Err(format!("NeoForge JAR 不存在: {}", neoforge_jar.display()));
    }

    let neoforge_lib = serde_json::json!({
        "name": lib_name,
        "downloads": {
            "artifact": {
                "url": "",
                "sha1": "",
                "size": 0
            }
        }
    });

    info.main_class = "cpw.mods.bootstraplauncher.BootstrapLauncher".to_string();

    let mut libs: Vec<serde_json::Value> = info.libraries.iter().map(|l| {
        serde_json::to_value(l).unwrap_or_default()
    }).collect();
    libs.push(neoforge_lib);

    let merged = {
        let mut map = serde_json::to_value(&info).unwrap_or_default();
        map["libraries"] = serde_json::Value::Array(libs);
        serde_json::from_value(map).unwrap_or(info)
    };

    Ok(merged)
}

/* ──────────────────────────────────────────────
   Classpath
   ────────────────────────────────────────────── */

fn build_classpath(
    version_info: &VersionInfo,
    game_dir: &Path,
    version_id: &str,
) -> Result<String, String> {
    use std::collections::HashSet;
    let os = os_name();
    let libs_dir = game_dir.join("libraries");
    let mut seen: HashSet<String> = HashSet::new();
    let mut cp: Vec<String> = Vec::new();
    let mut missing: Vec<String> = Vec::new();

    for lib in &version_info.libraries {
        if !lib_allowed(lib, os) {
            continue;
        }
        let path = libs_dir.join(types::library_path(&lib.name));
        let path_str = path.to_string_lossy().to_string();
        if seen.contains(&path_str) {
            continue;
        }
        seen.insert(path_str.clone());
        if path.exists() {
            cp.push(path_str);
        } else {
            missing.push(path_str);
        }
    }

    let client_jar = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{}.jar", version_id));
    if client_jar.exists() {
        cp.push(client_jar.to_string_lossy().to_string());
    } else {
        missing.push(client_jar.to_string_lossy().to_string());
    }

    if !missing.is_empty() {
        return Err(format!("缺少 {} 个库文件，请重新安装该版本:\n  {}",
            missing.len(),
            missing.iter().take(5).map(|s| s.as_str()).collect::<Vec<_>>().join("\n  ")));
    }

    if cp.is_empty() {
        return Err("classpath 为空，无可用的 JAR 文件".into());
    }

    Ok(cp.join(classpath_sep()))
}

/* ──────────────────────────────────────────────
   Natives
   ────────────────────────────────────────────── */

fn extract_natives(
    version_info: &VersionInfo,
    game_dir: &Path,
    version_id: &str,
) -> Result<PathBuf, String> {
    let os = os_name();
    let nkey = native_key();
    let natives_dir = game_dir
        .join("versions")
        .join(version_id)
        .join("natives");

    std::fs::create_dir_all(&natives_dir)
        .map_err(|e| format!("创建 natives 目录失败: {}", e))?;

    let mut base_natives: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    for lib in &version_info.libraries {
        if !lib_allowed(lib, os) {
            continue;
        }
        let has_classifier = lib.name.split(':').count() >= 4;
        let lib_path = game_dir.join("libraries").join(types::library_path(&lib.name));

        if !lib_path.exists() {
            continue;
        }

        if has_classifier {
            extract_jar_natives(&lib_path, &natives_dir)?;
        } else if let Some(native_id) = lib.natives.get(nkey) {
            base_natives.insert(native_id.clone(), lib_path.to_string_lossy().to_string());
        }
    }

    for (_native_id, path_str) in &base_natives {
        let p = std::path::PathBuf::from(path_str);
        if p.exists() {
            extract_jar_natives(&p, &natives_dir).ok();
        }
    }

    Ok(natives_dir)
}

fn extract_jar_natives(jar_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let ext = native_ext();
    let jar_file = std::fs::File::open(jar_path)
        .map_err(|e| format!("打开 JAR 失败 ({}): {}", jar_path.display(), e))?;

    let mut archive = zip::ZipArchive::new(jar_file)
        .map_err(|e| format!("读取 JAR 失败 ({}): {}", jar_path.display(), e))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| format!("读取 JAR 条目失败: {}", e))?;
        let name = entry.name().to_string();

        if name.ends_with(ext) && !name.contains('/') {
            let dest = dest_dir.join(&name);
            if dest.exists() {
                continue;
            }
            let mut out = std::fs::File::create(&dest)
                .map_err(|e| format!("创建文件失败 ({}): {}", dest.display(), e))?;
            std::io::copy(&mut entry, &mut out)
                .map_err(|e| format!("解压文件失败 ({}): {}", dest.display(), e))?;
        }
    }

    Ok(())
}

/* ──────────────────────────────────────────────
   JVM Arguments
   ────────────────────────────────────────────── */

fn build_jvm_args(
    version_info: &VersionInfo,
    natives_dir: &Path,
    classpath: &str,
    version_id: &str,
    game_dir: &Path,
    user_jvm_args: &[String],
) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    let version_name = version_id.to_string();
    let game_dir_str = game_dir.to_string_lossy().to_string();
    let natives_str = natives_dir.to_string_lossy().to_string();
    let lib_dir = game_dir.join("libraries").to_string_lossy().to_string();
    let sep = classpath_sep().to_string();
    let cp = classpath.to_string();

    for arg in user_jvm_args {
        if !arg.is_empty() {
            args.push(arg.clone());
        }
    }

    if let Some(ref arguments) = version_info.arguments {
        for arg in &arguments.jvm {
            match arg {
                serde_json::Value::String(s) => {
                    let resolved = resolve_jvm_vars(s, &natives_str, &sep, &cp, &lib_dir, &version_name, &game_dir_str);
                    args.push(resolved);
                }
                serde_json::Value::Object(obj) => {
                    if !check_rules(obj) {
                        continue;
                    }
                    if let Some(val) = obj.get("value") {
                        match val {
                            serde_json::Value::String(s) => {
                                args.push(resolve_jvm_vars(s, &natives_str, &sep, &cp, &lib_dir, &version_name, &game_dir_str));
                            }
                            serde_json::Value::Array(arr) => {
                                for v in arr {
                                    if let Some(s) = v.as_str() {
                                        args.push(resolve_jvm_vars(s, &natives_str, &sep, &cp, &lib_dir, &version_name, &game_dir_str));
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                _ => {}
            }
        }
    } else {
        args.extend(default_jvm_args(&natives_str, &sep, &cp, &version_name, &game_dir_str));
    }

    args.push(version_info.main_class.clone());

    args
}

fn default_jvm_args(
    natives: &str,
    _sep: &str,
    classpath: &str,
    version_name: &str,
    game_dir: &str,
) -> Vec<String> {
    vec![
        format!("-Djava.library.path={}", natives),
        "-Dminecraft.launcher.brand=asterneko".to_string(),
        "-Dminecraft.launcher.version=0.1.0".to_string(),
        "-cp".to_string(),
        classpath.to_string(),
        "-Dlog4j2.formatMsgNoLookups=true".to_string(),
        format!("-Dminecraft.client.jar={}/versions/{}/{}.jar", game_dir, version_name, version_name),
    ]
}

fn resolve_jvm_vars(
    arg: &str,
    natives: &str,
    sep: &str,
    classpath: &str,
    lib_dir: &str,
    version_name: &str,
    game_dir: &str,
) -> String {
    arg.replace("${natives_directory}", natives)
        .replace("${launcher_name}", "asterneko")
        .replace("${launcher_version}", "0.1.0")
        .replace("${classpath}", classpath)
        .replace("${classpath_separator}", sep)
        .replace("${library_directory}", lib_dir)
        .replace("${version_name}", version_name)
        .replace("${game_directory}", game_dir)
}

/* ──────────────────────────────────────────────
   Game Arguments
   ────────────────────────────────────────────── */

fn build_game_args(
    version_info: &VersionInfo,
    account: &GameAccount,
    access_token: Option<&str>,
    quick_launch_world: Option<&str>,
    version_id: &str,
    game_dir: &Path,
    width: u32,
    height: u32,
) -> Vec<String> {
    let version_name = version_id.to_string();
    let game_dir_str = game_dir.to_string_lossy().to_string();
    let assets_root = game_dir.join("assets").to_string_lossy().to_string();
    let assets_index = version_info
        .asset_index
        .as_ref()
        .map(|a| a.id.clone())
        .unwrap_or_else(|| version_id.to_string());

    if let Some(ref arguments) = version_info.arguments {
        let mut args: Vec<String> = Vec::new();
        for arg in &arguments.game {
            match arg {
                serde_json::Value::String(s) => {
                    args.push(resolve_game_vars(s, account, access_token, quick_launch_world, &version_name, &game_dir_str, &assets_root, &assets_index, width, height));
                }
                serde_json::Value::Object(obj) => {
                    if !check_rules(obj) {
                        continue;
                    }
                    if let Some(val) = obj.get("value") {
                        match val {
                            serde_json::Value::String(s) => {
                                args.push(resolve_game_vars(s, account, access_token, quick_launch_world, &version_name, &game_dir_str, &assets_root, &assets_index, width, height));
                            }
                            serde_json::Value::Array(arr) => {
                                for v in arr {
                                    if let Some(s) = v.as_str() {
                                        args.push(resolve_game_vars(s, account, access_token, quick_launch_world, &version_name, &game_dir_str, &assets_root, &assets_index, width, height));
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                _ => {}
            }
        }
        args
    } else {
        version_info.minecraft_arguments
            .split_whitespace()
            .map(|s| resolve_game_vars(s, account, access_token, quick_launch_world, &version_name, &game_dir_str, &assets_root, &assets_index, width, height))
            .collect()
    }
}

fn resolve_game_vars(
    arg: &str,
    account: &GameAccount,
    access_token: Option<&str>,
    quick_launch_world: Option<&str>,
    version_name: &str,
    game_dir: &str,
    assets_root: &str,
    assets_index: &str,
    width: u32,
    height: u32,
) -> String {
    let auth_token = access_token.unwrap_or("0");
    arg.replace("${auth_player_name}", &account.username)
        .replace("${auth_uuid}", &account.uuid)
        .replace("${auth_access_token}", auth_token)
        .replace("${auth_session}", &format!("token:{}:{}", auth_token, account.uuid))
        .replace("${version_name}", version_name)
        .replace("${game_directory}", game_dir)
        .replace("${assets_root}", assets_root)
        .replace("${assets_index_name}", assets_index)
        .replace("${user_type}", "mojang")
        .replace("${version_type}", "release")
        .replace("${resolution_width}", &width.to_string())
        .replace("${resolution_height}", &height.to_string())
        .replace("${clientid}", "0")
        .replace("${auth_xuid}", "0")
        .replace("${quickPlayPath}", "")
        .replace("${quickPlaySingleplayer}", quick_launch_world.unwrap_or(""))
        .replace("${quickPlayMultiplayer}", "")
        .replace("${quickPlayRealms}", "")
}

/* ──────────────────────────────────────────────
   Logging
   ────────────────────────────────────────────── */

fn setup_logging(
    version_info: &VersionInfo,
    game_dir: &Path,
    version_id: &str,
) -> Result<Option<String>, String> {
    if let Some(ref logging) = version_info.logging {
        let log_dir = game_dir
            .join("versions")
            .join(version_id)
            .join("log_configs");

        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("创建日志配置目录失败: {}", e))?;

        let log_file = log_dir.join("log4j2.xml");

        if !log_file.exists() {
            let client = reqwest::blocking::Client::new();
            let resp = client
                .get(&logging.client.file.url)
                .send()
                .map_err(|e| format!("下载日志配置失败: {}", e))?;
            let bytes = resp
                .bytes()
                .map_err(|e| format!("读取日志配置失败: {}", e))?;
            std::fs::write(&log_file, &bytes)
                .map_err(|e| format!("写入日志配置失败: {}", e))?;
        }

        Ok(Some(logging.client.argument.replace("${path}", &log_file.to_string_lossy())))
    } else {
        Ok(None)
    }
}

/* ──────────────────────────────────────────────
   JVM Selection
   ────────────────────────────────────────────── */

pub fn select_java(
    required_major: u32,
    user_java: Option<&str>,
) -> Result<PathBuf, String> {
    if let Some(path) = user_java {
        let p = Path::new(path);
        if p.is_file() {
            return Ok(p.to_path_buf());
        }
        return Err(format!("指定的 Java 路径无效: {}", path));
    }

    let all_jvms = jvm::scan::scan_all();

    for jvm in &all_jvms {
        if let Some(ref ver) = jvm.version {
            let major = ver
                .split('.')
                .next()
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(0);
            if major >= required_major {
                return Ok(PathBuf::from(&jvm.java_executable));
            }
        }
    }

    for jvm in &all_jvms {
        return Ok(PathBuf::from(&jvm.java_executable));
    }

    Err(format!(
        "未找到 Java {} 或更高版本，请安装 Java 或手动指定 JVM 路径",
        required_major
    ))
}

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

fn lib_allowed(lib: &types::Library, os: &str) -> bool {
    if !classifier_arch_ok(&lib.name) {
        return false;
    }
    if lib.rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in &lib.rules {
        let matches = match &rule.os {
            Some(cond) => cond.name.as_deref() == Some(os),
            None => true,
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

fn classifier_arch_ok(name: &str) -> bool {
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

fn check_rules(obj: &serde_json::Map<String, serde_json::Value>) -> bool {
    let Some(rules) = obj.get("rules") else {
        return true;
    };
    let Some(rules_arr) = rules.as_array() else {
        return true;
    };
    if rules_arr.is_empty() {
        return true;
    }

    let os = os_name();
    let mut allowed = false;
    for rule in rules_arr {
        let rule_action = rule
            .get("action")
            .and_then(|v| v.as_str())
            .unwrap_or("allow");
        let os_name_rule = rule
            .get("os")
            .and_then(|v| v.get("name"))
            .and_then(|v| v.as_str());

        let matches_os = match os_name_rule {
            Some(name) => name == os,
            None => {
                if rule.get("features").is_some() {
                    false
                } else {
                    true
                }
            }
        };

        if rule_action == "allow" && matches_os {
            allowed = true;
        }
        if rule_action == "disallow" && matches_os {
            allowed = false;
        }
    }
    allowed
}