#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod screen_capture;

use contalspeak_core::{AuthStore, AuthResponse, User};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

/// Estado global de autenticação gerenciado pelo Tauri
pub struct AuthState {
    store: Mutex<AuthStore>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    identifier: String, // username ou email
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    username: String,
    email: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum AuthResult {
    Success(AuthResponse),
    Error(String),
}

/// Obtém o caminho do banco de dados de autenticação no diretório de dados do app
fn get_auth_db_path(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    std::fs::create_dir_all(&data_dir).ok();
    data_dir.join("auth.db")
}

// ─── Comandos Tauri ────────────────────────────────────────────────

const LIVEKIT_API_KEY: &str = "APIoDkLmBTDG5T5";
const LIVEKIT_API_SECRET: &str = "ahn9v2PgmEIJCxM1QQARYd1j39r76pq4bWrVx7KFcnD";

#[derive(Debug, Serialize, Deserialize)]
pub struct LiveKitVideoGrant {
    #[serde(rename = "roomJoin")]
    pub room_join: bool,
    pub room: String,
    #[serde(rename = "canPublish")]
    pub can_publish: bool,
    #[serde(rename = "canSubscribe")]
    pub can_subscribe: bool,
    #[serde(rename = "canPublishData")]
    pub can_publish_data: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiveKitClaims {
    pub iss: String,
    pub sub: String,
    pub name: String,
    pub nbf: i64,
    pub exp: i64,
    pub video: LiveKitVideoGrant,
}

#[tauri::command]
fn get_livekit_token(room: String, identity: String, name: String) -> Result<String, String> {
    let now = chrono::Utc::now().timestamp();
    let claims = LiveKitClaims {
        iss: LIVEKIT_API_KEY.to_string(),
        sub: identity,
        name,
        nbf: now - 5,
        exp: now + 24 * 3600,
        video: LiveKitVideoGrant {
            room_join: true,
            room,
            can_publish: true,
            can_subscribe: true,
            can_publish_data: true,
        },
    };
    jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(LIVEKIT_API_SECRET.as_bytes()),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn register(
    state: State<'_, AuthState>,
    payload: RegisterRequest,
) -> Result<AuthResponse, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    store
        .register(&payload.username, &payload.email, &payload.password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn login(state: State<'_, AuthState>, payload: LoginRequest) -> Result<AuthResponse, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    store
        .login(&payload.identifier, &payload.password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_session(
    state: State<'_, AuthState>,
    token: String,
) -> Result<User, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    store.validate_token(&token).map_err(|e| e.to_string())
}

#[tauri::command]
async fn logout() -> Result<(), String> {
    // Logout é feito no frontend (limpar token do localStorage/store)
    // Este comando existe apenas para consistência da API
    Ok(())
}

fn main() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let db_path = get_auth_db_path(&app.handle());
            let auth_store = AuthStore::new(&db_path)
                .expect("failed to initialize auth database");

            app.manage(AuthState {
                store: Mutex::new(auth_store),
            });

            tracing::info!("ContalK initialized with auth DB at {:?}", db_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            register,
            login,
            check_session,
            logout,
            screen_capture::get_capture_sources,
            get_livekit_token,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar ContalK");
}