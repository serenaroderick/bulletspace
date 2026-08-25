use std::collections::HashMap;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// Result of a completed (or failed/timed-out) loopback OAuth round trip.
#[derive(serde::Serialize)]
pub struct LoopbackAuthResult {
    pub redirect_uri: String,
    pub query: HashMap<String, String>,
}

/// Generic secretless OAuth loopback flow, usable by any `oauth_loopback`
/// adapter (Google Calendar today, others later) -- not Google-specific.
/// This only exists because a browser tab can't bind a TCP listener; a
/// native process can. Provider-specific concerns (scopes, PKCE, token
/// exchange, field mapping) all stay in TypeScript, same as every other
/// adapter -- this command just does the one thing only Rust can do here.
///
/// Steps: bind an ephemeral localhost port, build the full authorize URL
/// from `auth_url_base` + `params` + a `redirect_uri` pointing at that
/// port, open it in the system browser, wait (up to 5 minutes) for the
/// single incoming redirect, parse its query string, respond with a small
/// HTML page, and return the query params for the caller to inspect
/// (code, state, error, etc.).
#[tauri::command]
pub async fn oauth_loopback_flow(
    auth_url_base: String,
    params: HashMap<String, String>,
) -> Result<LoopbackAuthResult, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind loopback listener: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    let mut url = url::Url::parse(&auth_url_base).map_err(|e| e.to_string())?;
    {
        let mut query_pairs = url.query_pairs_mut();
        for (key, value) in &params {
            query_pairs.append_pair(key, value);
        }
        query_pairs.append_pair("redirect_uri", &redirect_uri);
    }

    open::that(url.as_str()).map_err(|e| format!("Failed to open browser: {e}"))?;

    let accept_result = tokio::time::timeout(Duration::from_secs(300), listener.accept()).await;
    let (mut socket, _) = match accept_result {
        Ok(Ok(pair)) => pair,
        Ok(Err(e)) => return Err(e.to_string()),
        Err(_) => return Err("Timed out waiting for authorization.".to_string()),
    };

    let mut buf = vec![0u8; 8192];
    let n = socket
        .read(&mut buf)
        .await
        .map_err(|e| format!("Failed to read callback request: {e}"))?;
    let request = String::from_utf8_lossy(&buf[..n]).to_string();
    let first_line = request.lines().next().unwrap_or("").to_string();
    let path_and_query = first_line
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .to_string();

    let parsed = url::Url::parse(&format!("http://127.0.0.1{path_and_query}"))
        .map_err(|e| e.to_string())?;
    let query: HashMap<String, String> = parsed
        .query_pairs()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();

    let body = if query.contains_key("error") {
        "<html><body><h3>Authorization failed.</h3>You can close this window and return to BulletSpace.</body></html>"
    } else {
        "<html><body><h3>Success!</h3>You can close this window and return to BulletSpace.</body></html>"
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = socket.write_all(response.as_bytes()).await;

    Ok(LoopbackAuthResult { redirect_uri, query })
}
