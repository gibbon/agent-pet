use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use constant_time_eq::constant_time_eq;
use http::HeaderMap;

use super::state::AppState;

#[cfg(windows)]
pub const OWN_ORIGIN: &str = "https://tauri.localhost";
#[cfg(not(windows))]
pub const OWN_ORIGIN: &str = "tauri://localhost";

pub fn authorize(h: &HeaderMap, token: &str) -> Result<(), ()> {
    if h.get("x-agent-pet").and_then(|v| v.to_str().ok()) != Some("1") {
        return Err(());
    }
    if let Some(o) = h.get("origin").and_then(|v| v.to_str().ok()) {
        if o != OWN_ORIGIN {
            return Err(());
        }
    }
    if let Some(s) = h.get("sec-fetch-site").and_then(|v| v.to_str().ok()) {
        if s != "none" && s != "same-origin" {
            return Err(());
        }
    }
    let bearer = h
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "));
    match bearer {
        Some(t) if constant_time_eq(t.as_bytes(), token.as_bytes()) => Ok(()),
        _ => Err(()),
    }
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    if req.uri().path() == "/health" {
        return Ok(next.run(req).await);
    }
    if authorize(req.headers(), &state.token).is_err() {
        return Err(StatusCode::FORBIDDEN);
    }
    if !state.take_rate_token() {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn h(pairs: &[(&'static str, &str)]) -> http::HeaderMap {
        let mut m = http::HeaderMap::new();
        for (k, v) in pairs {
            m.insert(*k, v.parse().unwrap());
        }
        m
    }

    const TOK: &str = "secrettoken";

    #[test]
    fn accepts_valid_curl_like_request() {
        assert!(authorize(
            &h(&[
                ("x-agent-pet", "1"),
                ("authorization", "Bearer secrettoken")
            ]),
            TOK
        )
        .is_ok());
    }

    #[test]
    fn rejects_missing_custom_header() {
        assert!(authorize(&h(&[("authorization", "Bearer secrettoken")]), TOK).is_err());
    }

    #[test]
    fn rejects_bad_token() {
        assert!(authorize(
            &h(&[("x-agent-pet", "1"), ("authorization", "Bearer nope")]),
            TOK
        )
        .is_err());
    }

    #[test]
    fn rejects_cross_site_fetch() {
        assert!(authorize(
            &h(&[
                ("x-agent-pet", "1"),
                ("authorization", "Bearer secrettoken"),
                ("sec-fetch-site", "cross-site")
            ]),
            TOK
        )
        .is_err());
    }

    #[test]
    fn rejects_foreign_origin() {
        assert!(authorize(
            &h(&[
                ("x-agent-pet", "1"),
                ("authorization", "Bearer secrettoken"),
                ("origin", "https://evil.test")
            ]),
            TOK
        )
        .is_err());
    }
}
