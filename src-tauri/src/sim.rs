// Мост к симулятору (FSUIPC/XPUIPC + позже SimConnect).
//
// Назначение: опциональный источник телеметрии. Когда сим запущен и подключён — отдаём
// позицию/высоту/скорость/курс; иначе connected=false и фронт откатывается на vAMSYS-телеметрию.
//
// СТАТУС РЕАЛИЗАЦИИ: каркас. Команды и единый формат `SimTelemetry` готовы и скомпилированы,
// фронтенд-абстракция источника построена поверх них. Реальное чтение пока не подключено:
//   - крейт `fsuipc` 0.3 — только 32-бит, для нашего 64-бит .exe не годится;
//   - 64-бит FSUIPC IPC (shared memory "FsuipcN<pid>" + RegisterWindowMessage("FsuipcMsg")
//     + FindWindow "UIPCMAIN") и/или SimConnect SDK — реализуются и проверяются на машине
//     с запущенным симулятором (рантайм нельзя проверить без сима).
// До подключения нативного чтения `read_sim()` возвращает «не подключено».

use serde::Serialize;

#[derive(Serialize, Default, Clone)]
pub struct SimTelemetry {
  pub connected: bool,
  pub source: String, // "fsuipc" | "xpuipc" | "simconnect" | "none"
  pub latitude: f64,
  pub longitude: f64,
  pub altitude_ft: f64,
  pub heading_deg: f64,
  pub ground_speed_kt: f64,
  pub ias_kt: f64,
  pub vertical_speed_fpm: f64,
  pub on_ground: bool,
}

impl SimTelemetry {
  fn disconnected() -> Self {
    SimTelemetry {
      source: "none".into(),
      ..Default::default()
    }
  }
}

// Единая точка чтения телеметрии из сима. Пока возвращает «не подключено»
// (нативный FSUIPC/SimConnect-ридер подключается на этапе проверки с симулятором).
fn read_sim() -> SimTelemetry {
  SimTelemetry::disconnected()
}

/// Прочитать текущую телеметрию из сима. connected=false, если сим не запущен/не подключён.
#[tauri::command]
pub fn sim_read() -> SimTelemetry {
  read_sim()
}

/// Статус подключения к симу (для индикатора в настройках).
#[tauri::command]
pub fn sim_status() -> SimTelemetry {
  read_sim()
}
