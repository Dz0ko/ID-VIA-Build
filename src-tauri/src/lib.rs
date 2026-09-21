use std::process::Command;

#[derive(serde::Serialize)]
pub struct ShellResult {
  code: i32,
  stdout: String,
  stderr: String,
}

/// Real terminal for the desktop app: runs a shell command in `cwd` and returns its output.
/// Only reachable from the app's own webview (Tauri IPC), never from the public web app.
#[tauri::command]
fn run_shell(command: String, cwd: Option<String>) -> Result<ShellResult, String> {
  if command.trim().is_empty() {
    return Err("empty command".into());
  }
  let mut cmd = if cfg!(target_os = "windows") {
    let mut c = Command::new("cmd");
    c.args(["/C", &command]);
    c
  } else {
    let mut c = Command::new("sh");
    c.args(["-c", &command]);
    c
  };
  if let Some(dir) = cwd.filter(|d| !d.trim().is_empty()) {
    cmd.current_dir(dir);
  }
  let out = cmd.output().map_err(|e| e.to_string())?;
  Ok(ShellResult {
    code: out.status.code().unwrap_or(-1),
    stdout: String::from_utf8_lossy(&out.stdout).to_string(),
    stderr: String::from_utf8_lossy(&out.stderr).to_string(),
  })
}

/// Returns the user's home directory (default cwd for the terminal).
#[tauri::command]
fn home_dir() -> String {
  std::env::var("USERPROFILE")
    .or_else(|_| std::env::var("HOME"))
    .unwrap_or_else(|_| ".".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![run_shell, home_dir])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
