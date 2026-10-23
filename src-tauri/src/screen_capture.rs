use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use xcap::{Monitor, Window};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSource {
    pub id: String,
    pub source_type: String, // "monitor" | "window"
    pub name: String,
    pub title: String,
    pub app_name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
    pub thumbnail: Option<String>,
}

#[tauri::command]
pub async fn get_capture_sources() -> Result<Vec<CaptureSource>, String> {
    tokio::task::spawn_blocking(|| {
        let mut sources = Vec::new();

        // 1. Monitores
        if let Ok(monitors) = Monitor::all() {
            for (i, m) in monitors.into_iter().enumerate() {
                let width = m.width().unwrap_or(1920);
                let height = m.height().unwrap_or(1080);
                let is_primary = m.is_primary().unwrap_or(i == 0);
                let name = format!("Tela {}", i + 1);

                let thumbnail = m.capture_image().ok().and_then(|img| {
                    let dynamic_img = image::DynamicImage::ImageRgba8(img);
                    let resized = dynamic_img.resize(280, 160, FilterType::Triangle);
                    let mut buffer = Cursor::new(Vec::new());
                    if resized.write_to(&mut buffer, image::ImageFormat::Jpeg).is_ok() {
                        Some(format!(
                            "data:image/jpeg;base64,{}",
                            STANDARD.encode(buffer.into_inner())
                        ))
                    } else {
                        None
                    }
                });

                sources.push(CaptureSource {
                    id: format!("monitor:{}", m.id().map(|v| v.to_string()).unwrap_or_else(|_| i.to_string())),
                    source_type: "monitor".to_string(),
                    name: name.clone(),
                    title: format!("{} ({}x{})", name, width, height),
                    app_name: "Monitor".to_string(),
                    width,
                    height,
                    is_primary,
                    thumbnail,
                });
            }
        }

        // 2. Janelas Abertas
        if let Ok(windows) = Window::all() {
            for w in windows {
                if w.is_minimized().unwrap_or(false) {
                    continue;
                }
                let width = w.width().unwrap_or(0);
                let height = w.height().unwrap_or(0);
                if width < 150 || height < 150 {
                    continue;
                }

                let title = w.title().unwrap_or_default().trim().to_string();
                if title.is_empty()
                    || title == "Program Manager"
                    || title == "Windows Input Experience"
                    || title == "ContalK"
                {
                    continue;
                }

                let app_name = w.app_name().unwrap_or_else(|_| "Aplicativo".to_string());

                let thumbnail = w.capture_image().ok().and_then(|img| {
                    let dynamic_img = image::DynamicImage::ImageRgba8(img);
                    let resized = dynamic_img.resize(280, 160, FilterType::Triangle);
                    let mut buffer = Cursor::new(Vec::new());
                    if resized.write_to(&mut buffer, image::ImageFormat::Jpeg).is_ok() {
                        Some(format!(
                            "data:image/jpeg;base64,{}",
                            STANDARD.encode(buffer.into_inner())
                        ))
                    } else {
                        None
                    }
                });

                let id_str = w.id().map(|v| v.to_string()).unwrap_or_else(|_| title.clone());

                sources.push(CaptureSource {
                    id: format!("window:{}", id_str),
                    source_type: "window".to_string(),
                    name: app_name.clone(),
                    title: if title.len() > 60 {
                        format!("{}...", &title[..57])
                    } else {
                        title
                    },
                    app_name,
                    width,
                    height,
                    is_primary: false,
                    thumbnail,
                });
            }
        }

        Ok(sources)
    })
    .await
    .map_err(|e| e.to_string())?
}
