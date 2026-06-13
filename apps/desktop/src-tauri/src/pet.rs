pub const STATES: [&str; 9] = [
    "idle",
    "thinking",
    "building",
    "delegating",
    "success",
    "error",
    "greeting",
    "waiting",
    "leaving",
];

pub fn is_state(s: &str) -> bool {
    STATES.contains(&s)
}

pub fn action_name_ok(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 48
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn image_url_ok(s: &str) -> bool {
    if s.starts_with("./vendor/") || s.starts_with("vendor/") {
        return true;
    }
    url::Url::parse(s)
        .map(|u| u.scheme() == "https")
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_image_url_scheme() {
        assert!(image_url_ok(
            "https://codex-pets.net/assets/pets/x/spritesheet.webp"
        ));
        assert!(image_url_ok("./vendor/pet.webp"));
        assert!(!image_url_ok("http://example.com/pet.webp"));
        assert!(!image_url_ok("file:///tmp/pet.webp"));
        assert!(!image_url_ok("data:image/png;base64,abc"));
    }
}
