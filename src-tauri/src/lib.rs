use std::sync::Mutex;

mod sim;

use discord_rich_presence::{
  activity::{Activity, Assets, Timestamps},
  DiscordIpc, DiscordIpcClient,
};
use tauri::State;

// Хранит подключённый Discord IPC-клиент между вызовами команд.
#[derive(Default)]
struct DiscordState {
  client: Mutex<Option<DiscordIpcClient>>,
  app_id: Mutex<Option<String>>,
}

fn ensure_client(state: &DiscordState, app_id: &str) -> Result<(), String> {
  let mut guard = state.client.lock().map_err(|e| e.to_string())?;
  let mut id_guard = state.app_id.lock().map_err(|e| e.to_string())?;

  // Переподключаемся, если клиента ещё нет или сменился app_id.
  let needs_new = guard.is_none() || id_guard.as_deref() != Some(app_id);
  if needs_new {
    let mut client = DiscordIpcClient::new(app_id).map_err(|e| e.to_string())?;
    client.connect().map_err(|e| e.to_string())?;
    *guard = Some(client);
    *id_guard = Some(app_id.to_string());
  }
  Ok(())
}

#[tauri::command]
fn discord_set_activity(
  state: State<DiscordState>,
  app_id: String,
  details: String,
  status: String,
  large_image: Option<String>,
  large_text: Option<String>,
  small_image: Option<String>,
  small_text: Option<String>,
  start_unix: Option<i64>,
) -> Result<(), String> {
  if app_id.trim().is_empty() {
    return Err("empty app_id".into());
  }
  ensure_client(&state, &app_id)?;

  let mut guard = state.client.lock().map_err(|e| e.to_string())?;
  let client = guard.as_mut().ok_or("no client")?;

  let mut assets = Assets::new();
  if let Some(li) = large_image.as_deref() {
    if !li.is_empty() {
      assets = assets.large_image(li);
    }
  }
  if let Some(lt) = large_text.as_deref() {
    if !lt.is_empty() {
      assets = assets.large_text(lt);
    }
  }
  if let Some(si) = small_image.as_deref() {
    if !si.is_empty() {
      assets = assets.small_image(si);
    }
  }
  if let Some(st) = small_text.as_deref() {
    if !st.is_empty() {
      assets = assets.small_text(st);
    }
  }

  let mut activity = Activity::new().details(&details).state(&status).assets(assets);
  if let Some(start) = start_unix {
    activity = activity.timestamps(Timestamps::new().start(start));
  }

  client.set_activity(activity).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn discord_clear(state: State<DiscordState>) -> Result<(), String> {
  let mut guard = state.client.lock().map_err(|e| e.to_string())?;
  if let Some(client) = guard.as_mut() {
    let _ = client.clear_activity();
  }
  Ok(())
}

// ── Livery installer ──────────────────────────────────────────────────────────

#[tauri::command]
async fn install_livery(
  download_url: String,
  community_path: String,
  package_name: String,
) -> Result<u32, String> {
  // Sanitise package_name — must not escape the community folder
  if package_name.is_empty()
    || package_name.contains('/')
    || package_name.contains('\\')
    || package_name.contains("..")
  {
    return Err("Invalid package name".to_string());
  }

  let target_dir = std::path::Path::new(&community_path).join(&package_name);

  // Download ZIP
  let client = reqwest::Client::builder()
    .user_agent("NordwindHub/1.0")
    .build()
    .map_err(|e| e.to_string())?;

  let resp = client
    .get(&download_url)
    .send()
    .await
    .map_err(|e| format!("Download: {e}"))?;

  if !resp.status().is_success() {
    return Err(format!("HTTP {}", resp.status().as_u16()));
  }

  let bytes = resp.bytes().await.map_err(|e| format!("Read: {e}"))?;

  // Extract ZIP into target_dir
  let cursor = std::io::Cursor::new(bytes.as_ref());
  let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("ZIP: {e}"))?;

  std::fs::create_dir_all(&target_dir).map_err(|e| format!("mkdir: {e}"))?;

  let mut extracted = 0u32;
  for i in 0..archive.len() {
    let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
    let out_path = match entry.enclosed_name() {
      Some(name) => target_dir.join(name),
      None => continue, // skip path-traversal entries
    };
    // Double-check the output is still within target_dir
    if !out_path.starts_with(&target_dir) {
      continue;
    }
    if entry.is_dir() {
      std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
    } else {
      if let Some(p) = out_path.parent() {
        std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
      }
      let mut f = std::fs::File::create(&out_path)
        .map_err(|e| format!("{}: {e}", out_path.display()))?;
      std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;
      extracted += 1;
    }
  }

  Ok(extracted)
}

#[tauri::command]
async fn remove_livery(community_path: String, package_name: String) -> Result<(), String> {
  if package_name.is_empty()
    || package_name.contains('/')
    || package_name.contains('\\')
    || package_name.contains("..")
  {
    return Err("Invalid package name".to_string());
  }
  let target = std::path::Path::new(&community_path).join(&package_name);
  if target.exists() {
    std::fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // single-instance (Windows/Linux): второй запуск приложения (handoff из браузера по deep-link)
  // форвардит URL в уже запущенный экземпляр (feature "deep-link"), плюс фокусируем окно.
  #[cfg(any(target_os = "windows", target_os = "linux"))]
  {
    use tauri::Manager;
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
        let _ = window.unminimize();
      }
    }));
  }

  builder
    .manage(DiscordState::default())
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      discord_set_activity,
      discord_clear,
      sim::sim_read,
      sim::sim_status,
      install_livery,
      remove_livery,
    ])
    .setup(|app| {
      // Регистрация кастом-схемы nordwind:// в рантайме (для dev и Linux).
      #[cfg(any(target_os = "windows", target_os = "linux"))]
      {
        use tauri_plugin_deep_link::DeepLinkExt;
        let _ = app.deep_link().register_all();
      }
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
