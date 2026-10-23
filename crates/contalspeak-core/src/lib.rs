//! ContalSpeak Core - lógica de negócios, protocolos e integração com LiveKit.

pub mod auth;

pub use auth::{AuthStore, AuthError, User, AuthResponse};

pub fn hello() -> &'static str {
    "ContalSpeak core loaded"
}