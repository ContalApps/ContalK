//! Módulo de autenticação do ContalSpeak
//! Gerencia registro, login, hash de senhas e tokens JWT com persistência SQLite.

use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

const JWT_SECRET: &[u8] = b"contalspeak-dev-secret-change-in-prod";
const JWT_EXPIRY_DAYS: i64 = 30;

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Username já está em uso")]
    UsernameTaken,
    #[error("Email já está em uso")]
    EmailTaken,
    #[error("Credenciais inválidas")]
    InvalidCredentials,
    #[error("Token inválido ou expirado")]
    InvalidToken,
    #[error("Erro interno: {0}")]
    Internal(String),
}

impl From<rusqlite::Error> for AuthError {
    fn from(e: rusqlite::Error) -> Self {
        AuthError::Internal(format!("Database error: {}", e))
    }
}

impl From<bcrypt::BcryptError> for AuthError {
    fn from(e: bcrypt::BcryptError) -> Self {
        AuthError::Internal(format!("Bcrypt error: {}", e))
    }
}

impl From<jsonwebtoken::errors::Error> for AuthError {
    fn from(_: jsonwebtoken::errors::Error) -> Self {
        AuthError::InvalidToken
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub display_name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,      // user_id
    username: String,
    exp: usize,
    iat: usize,
}

pub struct AuthStore {
    conn: Mutex<Connection>,
}

impl AuthStore {
    /// Cria ou abre o banco de dados de autenticação no caminho especificado.
    pub fn new(db_path: &Path) -> Result<Self, AuthError> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);"
        )?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    /// Registra um novo usuário com username, email e senha.
    pub fn register(
        &self,
        username: &str,
        email: &str,
        password: &str,
    ) -> Result<AuthResponse, AuthError> {
        let username = username.trim();
        let email = email.trim().to_lowercase();

        if username.len() < 3 || username.len() > 32 {
            return Err(AuthError::Internal("Username deve ter entre 3 e 32 caracteres".into()));
        }
        if password.len() < 6 {
            return Err(AuthError::Internal("Senha deve ter pelo menos 6 caracteres".into()));
        }
        if !email.contains('@') {
            return Err(AuthError::Internal("Email inválido".into()));
        }

        let password_hash = hash(password, DEFAULT_COST)?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let display_name = username.to_string();

        let conn = self.conn.lock().map_err(|e| AuthError::Internal(e.to_string()))?;

        // Verifica se username já existe
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM users WHERE username = ?1",
            params![username],
            |row| row.get(0),
        )?;
        if exists {
            return Err(AuthError::UsernameTaken);
        }

        // Verifica se email já existe
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM users WHERE email = ?1",
            params![email],
            |row| row.get(0),
        )?;
        if exists {
            return Err(AuthError::EmailTaken);
        }

        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, display_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, username, email, password_hash, display_name, now],
        )?;

        let user = User {
            id: id.clone(),
            username: username.to_string(),
            email,
            display_name,
            created_at: now,
        };

        let token = generate_token(&user)?;

        Ok(AuthResponse { token, user })
    }

    /// Autentica um usuário por username/email + senha.
    pub fn login(&self, identifier: &str, password: &str) -> Result<AuthResponse, AuthError> {
        let identifier = identifier.trim().to_lowercase();

        let conn = self.conn.lock().map_err(|e| AuthError::Internal(e.to_string()))?;

        let result: Result<(String, String, String, String, String, String), _> = conn.query_row(
            "SELECT id, username, email, password_hash, display_name, created_at FROM users WHERE LOWER(username) = ?1 OR LOWER(email) = ?1",
            params![identifier],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
        );

        let (id, username, email, password_hash, display_name, created_at) = result
            .map_err(|_| AuthError::InvalidCredentials)?;

        if !verify(password, &password_hash)? {
            return Err(AuthError::InvalidCredentials);
        }

        let user = User {
            id: id.clone(),
            username,
            email,
            display_name,
            created_at,
        };

        let token = generate_token(&user)?;

        Ok(AuthResponse { token, user })
    }

    /// Valida um token JWT e retorna os dados do usuário.
    pub fn validate_token(&self, token: &str) -> Result<User, AuthError> {
        let claims = decode::<Claims>(
            token,
            &DecodingKey::from_secret(JWT_SECRET),
            &Validation::default(),
        )?
        .claims;

        let conn = self.conn.lock().map_err(|e| AuthError::Internal(e.to_string()))?;

        let result: Result<(String, String, String, String, String), _> = conn.query_row(
            "SELECT id, username, email, display_name, created_at FROM users WHERE id = ?1",
            params![claims.sub],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        );

        let (id, username, email, display_name, created_at) = result
            .map_err(|_| AuthError::InvalidToken)?;

        Ok(User {
            id,
            username,
            email,
            display_name,
            created_at,
        })
    }
}

fn generate_token(user: &User) -> Result<String, AuthError> {
    let now = Utc::now();
    let exp = now + chrono::Duration::days(JWT_EXPIRY_DAYS);

    let claims = Claims {
        sub: user.id.clone(),
        username: user.username.clone(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    )
    .map_err(|e| AuthError::Internal(format!("JWT encode error: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_auth_store_registration_and_login() {
        let temp_dir = std::env::temp_dir().join(format!("contalspeak_test_{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let db_path = temp_dir.join("test_auth.db");

        let store = AuthStore::new(&db_path).expect("Failed to create store");

        assert!(store.login("testuser", "senha123").is_err());
        store.register("testuser", "test@example.com", "senha123").expect("Registration failed");
        let res = store.login("testuser", "senha123").expect("Login failed");
        assert!(store.login("testuser", "wrongpassword").is_err());
        let validated = store.validate_token(&res.token).expect("Token validation failed");
        assert_eq!(validated.username, "testuser");

        // Test registro de novo usuário
        let reg_res = store.register("novousuario", "novo@teste.com", "senha123").expect("Register failed");
        assert_eq!(reg_res.user.username, "novousuario");

        // Limpeza
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
