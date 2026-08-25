use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

mod oauth_loopback;
use oauth_loopback::oauth_loopback_flow;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let new_entry = MenuItem::with_id(app, "new_entry", "New Entry", true, Some("CmdOrCtrl+N"))?;
            let export_json =
                MenuItem::with_id(app, "export_json", "Export JSON…", true, Some("CmdOrCtrl+E"))?;
            let import_json =
                MenuItem::with_id(app, "import_json", "Import JSON…", true, Some("CmdOrCtrl+I"))?;

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &new_entry,
                    &PredefinedMenuItem::separator(app)?,
                    &export_json,
                    &import_json,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;

            let app_menu = Submenu::with_items(
                app,
                "BulletSpace",
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;

            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                if id == "new_entry" || id == "export_json" || id == "import_json" {
                    let _ = app_handle.emit(id, ());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, oauth_loopback_flow])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
