use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::Emitter;

use super::state::AppState;

const TEXT_CAP: usize = 4096;
const MAX_TTL: u64 = 60000;

#[derive(Deserialize)]
pub struct StatePayload {
    state: String,
}

#[derive(Deserialize)]
pub struct PlayPayload {
    action: String,
    #[serde(rename = "loops")]
    loops: Option<u32>,
    #[serde(rename = "durationMs")]
    duration_ms: Option<u64>,
}

#[derive(Deserialize)]
pub struct SayPayload {
    text: String,
    ttl: Option<u64>,
    link: Option<String>,
}

#[derive(Serialize)]
pub struct ActionsResponse {
    actions: Vec<String>,
}

pub fn validate_state(s: &str) -> Result<&str, StatusCode> {
    if crate::pet::is_state(s) {
        Ok(s)
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

pub fn validate_action(state: &AppState, action: &str) -> Result<(), StatusCode> {
    if state.registry_contains(action) {
        Ok(())
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

pub fn clamp_play_opts(loops: Option<u32>, duration_ms: Option<u64>) -> (Option<u32>, Option<u64>) {
    (
        loops.map(|v| v.clamp(1, 100)),
        duration_ms.map(|v| v.min(60000)),
    )
}

pub fn cap_text(s: &str) -> String {
    s.chars().take(TEXT_CAP).collect()
}

pub fn safe_link(s: &str) -> Option<String> {
    let url = url::Url::parse(s).ok()?;
    match url.scheme() {
        "http" | "https" | "mailto" => Some(url.to_string()),
        _ => None,
    }
}

pub async fn health() -> Json<serde_json::Value> {
    Json(json!({ "ok": true }))
}

pub async fn state(
    State(app_state): State<AppState>,
    Json(payload): Json<StatePayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let state = validate_state(&payload.state)?;
    app_state
        .app
        .emit("pet:state", json!({ "state": state }))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn play(
    State(app_state): State<AppState>,
    Json(payload): Json<PlayPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    validate_action(&app_state, &payload.action)?;
    let (loops, duration_ms) = clamp_play_opts(payload.loops, payload.duration_ms);
    app_state
        .app
        .emit(
            "pet:play",
            json!({ "action": payload.action, "loops": loops, "durationMs": duration_ms }),
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn say(
    State(app_state): State<AppState>,
    Json(payload): Json<SayPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let text = cap_text(&payload.text);
    let ttl = payload.ttl.map(|v| v.min(MAX_TTL));
    let link = payload.link.as_deref().and_then(safe_link);
    app_state
        .app
        .emit("pet:say", json!({ "text": text, "ttl": ttl, "link": link }))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn actions(State(app_state): State<AppState>) -> Json<ActionsResponse> {
    Json(ActionsResponse {
        actions: app_state.registry_list(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_known_state() {
        assert!(validate_state("thinking").is_ok());
    }

    #[test]
    fn rejects_unknown_state() {
        assert!(validate_state("dancing").is_err());
    }

    #[test]
    fn clamps_play_options() {
        assert_eq!(
            clamp_play_opts(Some(500), Some(90000)),
            (Some(100), Some(60000))
        );
    }

    #[test]
    fn allows_https() {
        assert!(safe_link("https://x.test/a").is_some());
    }

    #[test]
    fn rejects_relative() {
        assert!(safe_link("/results").is_none());
    }

    #[test]
    fn rejects_javascript() {
        assert!(safe_link("javascript:alert(1)").is_none());
    }
}
