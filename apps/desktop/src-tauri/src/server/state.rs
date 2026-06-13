use std::collections::HashSet;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};

use crate::agent::AgentSupervisor;

#[derive(Clone)]
pub struct AppState {
    pub token: String,
    pub registry: Arc<RwLock<HashSet<String>>>,
    pub app: tauri::AppHandle,
    pub agent: AgentSupervisor,
    anchor: Arc<Mutex<(i32, i32)>>,
    rate: Arc<Mutex<TokenBucket>>,
}

struct TokenBucket {
    tokens: f64,
    last: Instant,
}

impl AppState {
    pub fn new(app: tauri::AppHandle) -> Self {
        use rand::RngCore;
        let mut b = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut b);
        let token = b.iter().map(|x| format!("{x:02x}")).collect();
        Self {
            token,
            registry: Arc::new(RwLock::new(
                crate::pet::STATES.iter().map(|s| s.to_string()).collect(),
            )),
            app,
            agent: AgentSupervisor::new(),
            anchor: Arc::new(Mutex::new((0, 0))),
            rate: Arc::new(Mutex::new(TokenBucket {
                tokens: 60.0,
                last: Instant::now(),
            })),
        }
    }

    pub fn set_registry(&self, set: HashSet<String>) {
        let mut g = self.registry.write().unwrap();
        *g = crate::pet::STATES
            .iter()
            .map(|s| s.to_string())
            .chain(set)
            .collect();
    }

    pub fn registry_contains(&self, a: &str) -> bool {
        self.registry.read().unwrap().contains(a)
    }

    pub fn registry_list(&self) -> Vec<String> {
        let mut list: Vec<_> = self.registry.read().unwrap().iter().cloned().collect();
        list.sort();
        list
    }

    pub fn set_anchor(&self, x: i32, y_bottom: i32) {
        *self.anchor.lock().unwrap() = (x, y_bottom);
    }

    pub fn anchor(&self) -> (i32, i32) {
        *self.anchor.lock().unwrap()
    }

    pub fn take_rate_token(&self) -> bool {
        const CAPACITY: f64 = 60.0;
        const REFILL_PER_SEC: f64 = 30.0;
        let mut bucket = self.rate.lock().unwrap();
        let elapsed = bucket.last.elapsed();
        bucket.last = Instant::now();
        bucket.tokens = (bucket.tokens + elapsed.as_secs_f64() * REFILL_PER_SEC).min(CAPACITY);
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            std::thread::sleep(Duration::from_millis(1));
            false
        }
    }
}
