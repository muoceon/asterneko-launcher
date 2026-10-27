mod auth;
mod bridge;
mod download;
mod instance;
mod jvm;
mod launch;
mod resources;
mod verify;

use download::aria2::Aria2Manager;
use download::types::{InstallOptions, ManifestVersion};
use instance::Instance;
use jvm::JvmInstallation;
use launch::LaunchOptions;
use std::path::PathBuf;
use std::process::Child;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;

struct AppState {
    bridge_port: Mutex<Option<u16>>,
    running_game: Mutex<Option<Child>>,
}

fn find_aria2c(app: &tauri::App) -> Option<PathBuf> {
    // 1. Bundled in resources (Tauri copies from bin/ to resource root)
    if let Ok(dir) = app.path().resource_dir() {
        let bundled = dir.join("aria2c.exe");
        if bundled.exists() {
            return Some(bundled);
        }
        let bundled_no_ext = dir.join("aria2c");
        if bundled_no_ext.exists() {
            return Some(bundled_no_ext);
        }
        // During dev, the binary is in bin/ subdirectory
        let dev_bundled = dir.join("bin").join("aria2c.exe");
        if dev_bundled.exists() {
            return Some(dev_bundled);
        }
    }

    // 2. Next to the executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let next = dir.join("aria2c.exe");
            if next.exists() {
                return Some(next);
            }
            let next_no_ext = dir.join("aria2c");
            if next_no_ext.exists() {
                return Some(next_no_ext);
            }
        }
    }

    // 3. In PATH
    let names = ["aria2c.exe", "aria2c"];
    for name in names {
        if let Ok(_) = std::process::Command::new(name).arg("--version").output() {
            return Some(PathBuf::from(name));
        }
    }

    None
}

#[tauri::command]
fn scan_jvm() -> Vec<JvmInstallation> {
    jvm::scan::scan_all()
}

#[tauri::command]
fn add_manual_jvm(path: String) -> Result<Option<JvmInstallation>, String> {
    let java_bin = std::path::Path::new(&path);
    Ok(jvm::scan::add_manual(java_bin))
}

#[tauri::command]
fn get_jvm_version(path: String) -> Result<Option<String>, String> {
    let java_bin = std::path::Path::new(&path);
    if let Some(v) = jvm::scan::get_version_via_process(java_bin) {
        Ok(Some(v.version))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn fetch_version_manifest(
    _app: AppHandle,
    channel: String,
) -> Result<Vec<ManifestVersion>, String> {
    download::manifest::fetch_manifest(&channel).await
}

#[tauri::command]
async fn install_version(
    app: AppHandle,
    options: InstallOptions,
    aria2: tauri::State<'_, Aria2Manager>,
) -> Result<(), String> {
    aria2.begin_task(&options.task_id);
    download::install::install_version(
        app,
        &aria2,
        &options.task_id,
        &options.version_id,
        &options.game_dir,
        &options.download_channel,
        options.instance_name.as_deref(),
        options.loader.as_deref(),
        options.loader_version.as_deref(),
    )
    .await
}

#[tauri::command]
async fn cancel_install(
    task_id: String,
    aria2: tauri::State<'_, Aria2Manager>,
) -> Result<(), String> {
    aria2.cancel(&task_id);
    Ok(())
}

#[tauri::command]
async fn fetch_loader_versions(
    loader: String,
    mc_version: String,
    channel: String,
) -> Result<Vec<download::loader::LoaderVersion>, String> {
    download::loader::fetch_loader_versions(&loader, &mc_version, &channel).await
}

#[tauri::command]
async fn list_instances(game_dir: String) -> Result<Vec<Instance>, String> {
    instance::list_instances(&game_dir).await
}

#[tauri::command]
async fn save_instance(
    game_dir: String,
    instance_id: String,
    name: String,
    version_id: String,
    loader: Option<String>,
    loader_version: Option<String>,
    custom_dir: Option<String>,
) -> Result<(), String> {
    instance::save_instance(
        &game_dir,
        &instance_id,
        &name,
        &version_id,
        loader.as_deref(),
        loader_version.as_deref(),
        custom_dir.as_deref(),
    )
    .await
}

#[tauri::command]
async fn delete_instance(
    game_dir: String,
    instance_id: String,
    delete_files: bool,
) -> Result<(), String> {
    instance::delete_instance(&game_dir, &instance_id, delete_files).await
}

#[tauri::command]
async fn list_instance_saves(game_dir: String) -> Result<Vec<resources::SaveEntry>, String> {
    resources::list_saves(&game_dir).await
}

#[tauri::command]
async fn list_instance_mods(game_dir: String) -> Result<Vec<resources::PackEntry>, String> {
    resources::list_mods(&game_dir).await
}

#[tauri::command]
async fn list_instance_datapacks(game_dir: String) -> Result<Vec<resources::PackEntry>, String> {
    resources::list_datapacks(&game_dir).await
}

#[tauri::command]
async fn list_instance_resourcepacks(game_dir: String) -> Result<Vec<resources::PackEntry>, String> {
    resources::list_resourcepacks(&game_dir).await
}

#[tauri::command]
async fn list_instance_shaderpacks(game_dir: String) -> Result<Vec<resources::PackEntry>, String> {
    resources::list_shaderpacks(&game_dir).await
}

#[tauri::command]
async fn verify_instance(game_dir: String, version_id: String) -> Result<verify::VerifyResult, String> {
    verify::verify_instance(&game_dir, &version_id).await
}

#[tauri::command]
async fn repair_instance(
    app: AppHandle,
    aria2: tauri::State<'_, Aria2Manager>,
    game_dir: String,
    version_id: String,
    channel: String,
    instance_name: Option<String>,
    loader: Option<String>,
    loader_version: Option<String>,
) -> Result<(), String> {
    let task_id = format!("repair-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());
    aria2.begin_task(&task_id);
    download::install::install_version(
        app,
        &aria2,
        &task_id,
        &version_id,
        &game_dir,
        &channel,
        instance_name.as_deref(),
        loader.as_deref(),
        loader_version.as_deref(),
    )
    .await
}

#[tauri::command]
fn get_bridge_port(state: tauri::State<AppState>) -> Result<u16, String> {
    state
        .bridge_port
        .lock()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "bridge server not started".into())
}

#[tauri::command]
fn select_java(required_major: u32, user_java: Option<String>) -> Result<String, String> {
    launch::select_java(required_major, user_java.as_deref())
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn launch_game(
    state: tauri::State<AppState>,
    options: LaunchOptions,
) -> Result<(), String> {
    let child = launch::launch_game(&options)?;

    let mut guard = state.running_game.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut old) = *guard {
        let _ = launch::kill_game(old);
    }
    *guard = Some(child);

    Ok(())
}

#[tauri::command]
fn kill_game(state: tauri::State<AppState>) -> Result<bool, String> {
    let mut guard = state.running_game.lock().map_err(|e| e.to_string())?;
    match guard.as_mut() {
        Some(child) => {
            let killed = launch::kill_game(child)?;
            if !killed {
                *guard = None;
            }
            Ok(killed)
        }
        None => Ok(false),
    }
}

#[tauri::command]
fn is_game_running(state: tauri::State<AppState>) -> Result<bool, String> {
    let mut guard = state.running_game.lock().map_err(|e| e.to_string())?;
    match guard.as_mut() {
        Some(child) => match child.try_wait() {
            Ok(Some(_)) => {
                *guard = None;
                Ok(false)
            }
            Ok(None) => Ok(true),
            Err(e) => {
                *guard = None;
                Err(format!("检查进程状态失败: {}", e))
            }
        },
        None => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_deep_link::init())
        .manage(AppState {
            bridge_port: Mutex::new(None),
            running_game: Mutex::new(None),
        })
        .manage(Aria2Manager::new())
        .setup(|app| {
            // Try to start aria2c
            if let Some(aria2_path) = find_aria2c(app) {
                let state = app.state::<Aria2Manager>();
                match state.start(&aria2_path) {
                    Ok(()) => eprintln!("[aria2] 启动成功"),
                    Err(e) => eprintln!("[aria2] 启动失败: {}", e),
                }
            } else {
                eprintln!("[aria2] 未找到 aria2c.exe");
            }

            let server = bridge::BridgeServer::start(app.handle().clone());
            if let Some(ref s) = server {
                let state = app.state::<AppState>();
                *state.bridge_port.lock().unwrap() = Some(s.port);
            }

            let handle = app.handle().clone();
            let deep_link = app.deep_link();
            deep_link.on_open_url(move |_event| {
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.show();
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_jvm,
            add_manual_jvm,
            get_jvm_version,
            select_java,
            fetch_version_manifest,
            fetch_loader_versions,
            install_version,
            cancel_install,
            list_instances,
            save_instance,
            delete_instance,
            list_instance_saves,
            list_instance_mods,
            list_instance_datapacks,
            list_instance_resourcepacks,
            list_instance_shaderpacks,
            verify_instance,
            repair_instance,
            auth::offline_login,
            auth::microsoft::microsoft_login,
            auth::microsoft::acquire_mc_token,
            get_bridge_port,
            launch_game,
            kill_game,
            is_game_running,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}