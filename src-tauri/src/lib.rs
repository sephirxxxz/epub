#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod security;

#[tauri::command]
fn offline_only() -> bool {
    true
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![offline_only])
        .run(tauri::generate_context!())
        .expect("error while running Glossary");
}
