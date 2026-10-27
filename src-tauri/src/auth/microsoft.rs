use serde::{Deserialize, Serialize};

use super::{AccountType, GameAccount};

const MS_CLIENT_ID: &str = "0301aef4-2b8e-4817-9cb9-7925b881a3b8";

const MS_TOKEN_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL: &str =
    "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

const XBL_RELYING_PARTY: &str = "http://auth.xboxlive.com";
const XSTS_RELYING_PARTY: &str = "rp://api.minecraftservices.com/";

#[derive(Debug, Deserialize)]
struct MsTokenResponse {
    access_token: String,
    #[allow(dead_code)]
    refresh_token: Option<String>,
    #[allow(dead_code)]
    expires_in: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct XblAuthRequest {
    properties: XblAuthProperties,
    relying_party: String,
    token_type: String,
}

#[derive(Debug, Serialize)]
struct XblAuthProperties {
    #[serde(rename = "AuthMethod")]
    auth_method: String,
    #[serde(rename = "SiteName")]
    site_name: String,
    #[serde(rename = "RpsTicket")]
    rps_ticket: String,
}

#[derive(Debug, Deserialize)]
struct XblAuthResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XblDisplayClaims,
}

#[derive(Debug, Deserialize)]
struct XblDisplayClaims {
    xui: Vec<XblXui>,
}

#[derive(Debug, Deserialize)]
struct XblXui {
    uhs: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct XstsAuthRequest {
    properties: XstsAuthProperties,
    relying_party: String,
    token_type: String,
}

#[derive(Debug, Serialize)]
struct XstsAuthProperties {
    #[serde(rename = "SandboxId")]
    sandbox_id: String,
    #[serde(rename = "UserTokens")]
    user_tokens: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct XstsAuthResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XblDisplayClaims,
}

#[derive(Debug, Serialize)]
struct McLoginRequest {
    #[serde(rename = "identityToken")]
    identity_token: String,
}

#[derive(Debug, Deserialize)]
struct McLoginResponse {
    access_token: String,
    #[allow(dead_code)]
    expires_in: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McProfileResponse {
    id: String,
    name: String,
}

#[tauri::command]
pub async fn microsoft_login(
    code: String,
    redirect_uri: String,
    code_verifier: String,
) -> Result<GameAccount, String> {
    let client = reqwest::Client::new();

    eprintln!("[ms-auth] Step 1/5: exchanging MS code for token...");
    let ms_token = exchange_ms_token(&client, &code, &redirect_uri, &code_verifier).await?;
    eprintln!("[ms-auth] Step 1/5: MS token obtained");

    eprintln!("[ms-auth] Step 2/5: authenticating with Xbox Live...");
    let (xbl_token, _) = authenticate_xbl(&client, &ms_token.access_token).await?;
    eprintln!("[ms-auth] Step 2/5: XBL token obtained");

    eprintln!("[ms-auth] Step 3/5: exchanging XBL token for XSTS...");
    let (xsts_token, xsts_uhs) = authenticate_xsts(&client, &xbl_token).await?;
    eprintln!("[ms-auth] Step 3/5: XSTS token obtained");

    eprintln!("[ms-auth] Step 4/5: logging into Minecraft...");
    let mc_token = authenticate_minecraft(&client, &xsts_token, &xsts_uhs).await?;
    eprintln!("[ms-auth] Step 4/5: Minecraft token obtained");

    eprintln!("[ms-auth] Step 5/5: fetching Minecraft profile...");
    let profile = fetch_mc_profile(&client, &mc_token.access_token).await?;
    eprintln!("[ms-auth] Step 5/5: profile fetched: {} ({})", profile.name, profile.id);

    Ok(GameAccount {
        username: profile.name,
        uuid: profile.id,
        account_type: AccountType::Microsoft,
        ms_refresh_token: ms_token.refresh_token,
    })
}

#[tauri::command]
pub async fn acquire_mc_token(refresh_token: String) -> Result<McTokenResult, String> {
    let client = reqwest::Client::new();

    eprintln!("[ms-auth] refreshing Microsoft token...");
    let ms_token = refresh_ms_token(&client, &refresh_token).await?;
    eprintln!("[ms-auth] Microsoft token refreshed");

    eprintln!("[ms-auth] XBL auth...");
    let (xbl_token, _) = authenticate_xbl(&client, &ms_token.access_token).await?;

    eprintln!("[ms-auth] XSTS auth...");
    let (xsts_token, xsts_uhs) = authenticate_xsts(&client, &xbl_token).await?;

    eprintln!("[ms-auth] Minecraft login...");
    let mc_token = authenticate_minecraft(&client, &xsts_token, &xsts_uhs).await?;

    eprintln!("[ms-auth] Minecraft token acquired (expires in {:?}s)", mc_token.expires_in);

    Ok(McTokenResult {
        access_token: mc_token.access_token,
        username: String::new(),
        uuid: String::new(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McTokenResult {
    pub access_token: String,
    pub username: String,
    pub uuid: String,
}

async fn refresh_ms_token(
    client: &reqwest::Client,
    refresh_token: &str,
) -> Result<MsTokenResponse, String> {
    let params = [
        ("client_id", MS_CLIENT_ID.to_string()),
        ("refresh_token", refresh_token.to_string()),
        ("grant_type", "refresh_token".to_string()),
        ("scope", "XboxLive.signin offline_access".to_string()),
    ];

    let resp = client
        .post(MS_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to refresh Microsoft token: {}", e))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        eprintln!("[ms-auth] MS token refresh failed: HTTP {} body={}", status, body);
        return Err(format!("Microsoft token 刷新失败 (HTTP {}): {}", status.as_u16(), body));
    }

    eprintln!("[ms-auth] MS refresh response: {}", body.chars().take(200).collect::<String>());

    serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse Microsoft refresh response: {} — body: {}", e, &body[..body.len().min(500)]))
}

async fn exchange_ms_token(
    client: &reqwest::Client,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> Result<MsTokenResponse, String> {
    let params = [
        ("client_id", MS_CLIENT_ID.to_string()),
        ("scope", "XboxLive.signin offline_access".to_string()),
        ("code", code.to_string()),
        ("redirect_uri", redirect_uri.to_string()),
        ("grant_type", "authorization_code".to_string()),
        ("code_verifier", code_verifier.to_string()),
    ];

    eprintln!("[ms-auth] token exchange: redirect_uri={}", redirect_uri);

    let resp = client
        .post(MS_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to exchange Microsoft token: {}", e))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        eprintln!("[ms-auth] MS token exchange failed: HTTP {} body={}", status, body);
        return Err(format!("Microsoft token 交换失败 (HTTP {}): {}", status.as_u16(), body));
    }

    eprintln!("[ms-auth] MS token exchange response: {}", body);

    serde_json::from_str::<MsTokenResponse>(&body)
        .map_err(|e| format!("Failed to parse Microsoft token response: {} — body: {}", e, body))
}

async fn authenticate_xbl(
    client: &reqwest::Client,
    ms_token: &str,
) -> Result<(String, String), String> {
    let body = XblAuthRequest {
        properties: XblAuthProperties {
            auth_method: "RPS".to_string(),
            site_name: "user.auth.xboxlive.com".to_string(),
            rps_ticket: format!("d={}", ms_token),
        },
        relying_party: XBL_RELYING_PARTY.to_string(),
        token_type: "JWT".to_string(),
    };

    let resp = client
        .post(XBL_AUTH_URL)
        .json(&body)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to authenticate with Xbox Live: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Xbox Live authentication failed: {}", body));
    }

    let xbl_resp = resp
        .json::<XblAuthResponse>()
        .await
        .map_err(|e| format!("Failed to parse XBL response: {}", e))?;

    let uhs = xbl_resp
        .display_claims
        .xui
        .first()
        .map(|x| x.uhs.clone())
        .ok_or_else(|| "Missing XBL user hash".to_string())?;

    Ok((xbl_resp.token, uhs))
}

async fn authenticate_xsts(
    client: &reqwest::Client,
    xbl_token: &str,
) -> Result<(String, String), String> {
    let body = XstsAuthRequest {
        properties: XstsAuthProperties {
            sandbox_id: "RETAIL".to_string(),
            user_tokens: vec![xbl_token.to_string()],
        },
        relying_party: XSTS_RELYING_PARTY.to_string(),
        token_type: "JWT".to_string(),
    };

    let resp = client
        .post(XSTS_AUTH_URL)
        .json(&body)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to authenticate with XSTS: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if status.as_u16() == 401 {
            return Err(
                "XSTS authentication failed: This Microsoft account does not own Minecraft. \
                 Please make sure you have purchased Minecraft on this account."
                    .to_string(),
            );
        }
        return Err(format!("XSTS authentication failed ({}): {}", status, body));
    }

    let xsts_resp = resp
        .json::<XstsAuthResponse>()
        .await
        .map_err(|e| format!("Failed to parse XSTS response: {}", e))?;

    let uhs = xsts_resp
        .display_claims
        .xui
        .first()
        .map(|x| x.uhs.clone())
        .ok_or_else(|| "Missing XSTS user hash".to_string())?;

    Ok((xsts_resp.token, uhs))
}

async fn authenticate_minecraft(
    client: &reqwest::Client,
    xsts_token: &str,
    uhs: &str,
) -> Result<McLoginResponse, String> {
    let body = McLoginRequest {
        identity_token: format!("XBL3.0 x={};{}", uhs, xsts_token),
    };

    let resp = client
        .post(MC_LOGIN_URL)
        .json(&body)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to login to Minecraft: {}", e))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        eprintln!("[ms-auth] Minecraft login failed: HTTP {} body={}", status, body);
        return Err(format!("Minecraft login failed ({}): {}", status.as_u16(), body));
    }

    eprintln!("[ms-auth] Minecraft login response: {}", body);

    serde_json::from_str::<McLoginResponse>(&body)
        .map_err(|e| format!("Failed to parse Minecraft login response: {} — body: {}", e, body))
}

async fn fetch_mc_profile(
    client: &reqwest::Client,
    mc_token: &str,
) -> Result<McProfileResponse, String> {
    let resp = client
        .get(MC_PROFILE_URL)
        .bearer_auth(mc_token)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Minecraft profile: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Failed to fetch Minecraft profile: {}", body));
    }

    resp.json::<McProfileResponse>()
        .await
        .map_err(|e| format!("Failed to parse Minecraft profile: {}", e))
}