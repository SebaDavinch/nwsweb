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
      sim::sim_status
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
