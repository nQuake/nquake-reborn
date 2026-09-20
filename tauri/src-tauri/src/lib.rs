//! The whole desktop shell. It opens a window on the compiled web installer
//! and registers the three official plugins the page needs to pick a folder,
//! write into it and reveal it afterwards. The one custom command exists
//! because a webview cannot chmod: a downloaded AppImage or `mvdsv` is
//! useless without the executable bit. Every decision about *what* to write
//! lives in the web app (`src/platform/tauri.ts` is the other side of this).

#[tauri::command]
fn set_executable(paths: Vec<String>) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;
        for path in &paths {
            let meta = fs::metadata(path).map_err(|e| format!("{path}: {e}"))?;
            let mut perms = meta.permissions();
            perms.set_mode(perms.mode() | 0o111);
            fs::set_permissions(path, perms).map_err(|e| format!("{path}: {e}"))?;
        }
    }
    #[cfg(not(unix))]
    {
        let _ = paths;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![set_executable])
        .run(tauri::generate_context!())
        .expect("error while running nQuake");
}
