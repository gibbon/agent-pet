pub mod auth;
pub mod handlers;
pub mod state;

use axum::middleware;
use axum::routing::{get, post};
use axum::Router;
use std::net::SocketAddr;
use tower_http::limit::RequestBodyLimitLayer;

pub use state::AppState;

pub async fn serve(state: AppState) {
    let router = Router::new()
        .route("/health", get(handlers::health))
        .route("/state", post(handlers::state))
        .route("/play", post(handlers::play))
        .route("/say", post(handlers::say))
        .route("/actions", get(handlers::actions))
        .route("/agent/tools", get(handlers::agent_tools))
        .route("/agent/status", get(handlers::agent_status))
        .route("/agent/start", post(handlers::agent_start))
        .route("/agent/stop", post(handlers::agent_stop))
        .with_state(state.clone())
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::auth_middleware,
        ))
        .layer(RequestBodyLimitLayer::new(8 * 1024));

    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .await
        .expect("bind desktop control server");
    let port = listener.local_addr().expect("local addr").port();
    crate::portfile::write_port_file(&crate::portfile::port_file_path(), port, &state.token)
        .expect("write port file");
    axum::serve(listener, router)
        .await
        .expect("serve desktop control server");
}
