pub mod microsoft;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameAccount {
    pub username: String,
    pub uuid: String,
    #[serde(rename = "type")]
    pub account_type: AccountType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ms_refresh_token: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccountType {
    Offline,
    Microsoft,
}

fn offline_uuid(username: &str) -> String {
    let input = format!("OfflinePlayer:{}", username);
    let digest = md5::compute(input.as_bytes());
    let mut bytes = digest.0;

    bytes[6] = (bytes[6] & 0x0f) | 0x30;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:04x}{:08x}",
        u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        u16::from_be_bytes([bytes[4], bytes[5]]),
        u16::from_be_bytes([bytes[6], bytes[7]]),
        u16::from_be_bytes([bytes[8], bytes[9]]),
        u16::from_be_bytes([bytes[10], bytes[11]]),
        u32::from_be_bytes([bytes[12], bytes[13], bytes[14], bytes[15]]),
    )
}

#[tauri::command]
pub fn offline_login(username: String) -> Result<GameAccount, String> {
    let trimmed = username.trim();
    if trimmed.is_empty() {
        return Err("用户名不能为空".into());
    }
    if trimmed.len() > 16 {
        return Err("用户名不能超过 16 个字符".into());
    }

    Ok(GameAccount {
        uuid: offline_uuid(trimmed),
        username: trimmed.to_string(),
        account_type: AccountType::Offline,
        ms_refresh_token: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_offline_uuid_format() {
        let uuid = offline_uuid("TestPlayer");
        assert_eq!(uuid.len(), 36);
        assert_eq!(uuid.chars().filter(|&c| c == '-').count(), 4);
        let version_char = uuid.chars().nth(14).unwrap();
        assert_eq!(version_char, '3');
    }

    #[test]
    fn test_offline_uuid_deterministic() {
        let a = offline_uuid("Player1");
        let b = offline_uuid("Player1");
        assert_eq!(a, b);
    }

    #[test]
    fn test_offline_uuid_different() {
        let a = offline_uuid("Player1");
        let b = offline_uuid("Player2");
        assert_ne!(a, b);
    }
}