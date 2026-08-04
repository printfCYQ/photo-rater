use crate::image_proc;
use crate::models::Photo;
use crate::storage;
use chrono::Datelike;
use std::collections::HashMap;

/// A node in the time-browsing tree (year / month / day).
#[derive(Debug, Clone, serde::Serialize)]
pub struct TimeNode {
    pub key: String,
    pub label: String,
    pub count: i64,
    pub level: String, // "year" | "month" | "day"
    pub from: String,  // inclusive start date "YYYY-MM-DD"
    pub to: String,    // inclusive end date "YYYY-MM-DD"
    pub children: Vec<TimeNode>,
}

/// A location cluster (photos taken at roughly the same place).
#[derive(Debug, Clone, serde::Serialize)]
pub struct LocationGroup {
    pub id: i64,
    pub label: String,
    pub count: i64,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub photos: Vec<Photo>,
}

/// A group of near-duplicate / similar photos.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PhotoGroup {
    pub id: i64,
    pub count: i64,
    pub best_score: Option<f64>,
    pub representative: Photo,
    pub photos: Vec<Photo>,
}

/// Build a year → month → day tree for an album from `taken_at`.
pub fn build_time_tree(album_id: i64) -> Vec<TimeNode> {
    let photos = match storage::list_photos(&crate::models::PhotoFilter {
        album_id: Some(album_id),
        ..Default::default()
    }) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    // year -> month -> day -> count
    let mut years: HashMap<i32, HashMap<u32, HashMap<u32, i64>>> = HashMap::new();
    for p in &photos {
        if let Some(dt) = &p.taken_at {
            let date_part = dt.get(0..10).unwrap_or("").replace(':', "-");
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&date_part, "%Y-%m-%d") {
                let y = d.year();
                let m = d.month();
                let day = d.day();
                *years
                    .entry(y)
                    .or_default()
                    .entry(m)
                    .or_default()
                    .entry(day)
                    .or_default() += 1;
            }
        }
    }

    let mut year_nodes: Vec<TimeNode> = Vec::new();
    let mut ykeys: Vec<i32> = years.keys().copied().collect();
    ykeys.sort();

    for y in ykeys {
        let months = years.get(&y).unwrap();
        let mut month_nodes: Vec<TimeNode> = Vec::new();
        let mut mkeys: Vec<u32> = months.keys().copied().collect();
        mkeys.sort();

        let mut year_count = 0i64;
        for m in mkeys {
            let days = months.get(&m).unwrap();
            let mut day_nodes: Vec<TimeNode> = Vec::new();
            let mut dkeys: Vec<u32> = days.keys().copied().collect();
            dkeys.sort();

            let mut month_count = 0i64;
            for d in dkeys {
                let c = days[&d];
                let date_str = format!("{:04}-{:02}-{:02}", y, m, d);
                month_count += c;
                day_nodes.push(TimeNode {
                    key: format!("{}-{:02}-{:02}", y, m, d),
                    label: format!("{:02} 日", d),
                    count: c,
                    level: "day".to_string(),
                    from: date_str.clone(),
                    to: date_str,
                    children: Vec::new(),
                });
            }

            // month range end = last day of the month
            let first_of_month = chrono::NaiveDate::from_ymd_opt(y, m, 1).unwrap();
            let next_month = first_of_month + chrono::Months::new(1);
            let last_day = next_month - chrono::Duration::days(1);

            year_count += month_count;
            month_nodes.push(TimeNode {
                key: format!("{}-{:02}", y, m),
                label: format!("{:02} 月", m),
                count: month_count,
                level: "month".to_string(),
                from: format!("{:04}-{:02}-01", y, m),
                to: last_day.format("%Y-%m-%d").to_string(),
                children: day_nodes,
            });
        }

        year_nodes.push(TimeNode {
            key: format!("{}", y),
            label: format!("{} 年", y),
            count: year_count,
            level: "year".to_string(),
            from: format!("{:04}-01-01", y),
            to: format!("{:04}-12-31", y),
            children: month_nodes,
        });
    }

    year_nodes
}

/// Cluster photos by GPS proximity (greedy, single-pass). Fully offline.
/// Photos without GPS are collected into an "未知位置" group.
pub fn build_location_groups(album_id: i64) -> Vec<LocationGroup> {
    let photos = match storage::list_photos(&crate::models::PhotoFilter {
        album_id: Some(album_id),
        ..Default::default()
    }) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    // (center_lat, center_lon, Vec<Photo>)
    let mut clusters: Vec<(f64, f64, Vec<Photo>)> = Vec::new();
    let mut unknown: Vec<Photo> = Vec::new();

    const THRESHOLD_KM: f64 = 0.5;

    for p in photos {
        match (p.lat, p.lon) {
            (Some(lat), Some(lon)) => {
                // Join the closest existing cluster within threshold, else start a new one.
                let mut best_idx: Option<usize> = None;
                let mut best_dist = f64::MAX;
                for (i, (clat, clon, _)) in clusters.iter().enumerate() {
                    let dist = haversine((lat, lon), (*clat, *clon));
                    if dist <= THRESHOLD_KM && dist < best_dist {
                        best_dist = dist;
                        best_idx = Some(i);
                    }
                }
                match best_idx {
                    Some(i) => clusters[i].2.push(p),
                    None => clusters.push((lat, lon, vec![p])),
                }
            }
            _ => unknown.push(p),
        }
    }

    // Sort clusters by size (largest first)
    clusters.sort_by(|a, b| b.2.len().cmp(&a.2.len()));

    let mut groups: Vec<LocationGroup> = Vec::new();
    for (i, (lat, lon, members)) in clusters.into_iter().enumerate() {
        groups.push(LocationGroup {
            id: (i + 1) as i64,
            label: format!("地点 {}", i + 1),
            count: members.len() as i64,
            lat: Some(lat),
            lon: Some(lon),
            photos: members,
        });
    }

    if !unknown.is_empty() {
        groups.push(LocationGroup {
            id: (groups.len() + 1) as i64,
            label: "未知位置".to_string(),
            count: unknown.len() as i64,
            lat: None,
            lon: None,
            photos: unknown,
        });
    }

    groups
}

/// Find near-duplicate / similar photo groups via perceptual hash (aHash).
/// Photos missing a hash are decoded and hashed on the fly (persisted to DB).
/// Returns only groups with 2+ members, best photo first.
pub fn build_similar_groups(album_id: i64, threshold: u32) -> Vec<PhotoGroup> {
    let photos = match storage::list_photos(&crate::models::PhotoFilter {
        album_id: Some(album_id),
        ..Default::default()
    }) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    // Resolve (photo, hash) pairs; compute + persist missing hashes.
    let mut items: Vec<(Photo, u64)> = Vec::new();
    for mut p in photos {
        let hash: u64 = match &p.phash {
            Some(hex) => u64::from_str_radix(hex, 16).unwrap_or(0),
            None => match image_proc::compute_phash(&p.path) {
                Ok(h) => {
                    let hex: String = format!("{:016x}", h);
                    let _ = storage::update_phash(&p.path, &hex);
                    p.phash = Some(hex);
                    h
                }
                Err(e) => {
                    log::warn!("pHash 计算失败 {}: {}", p.path, e);
                    continue;
                }
            },
        };
        items.push((p, hash));
    }

    // Greedy single-linkage clustering by Hamming distance.
    let mut clusters: Vec<Vec<(Photo, u64)>> = Vec::new();
    for (photo, hash) in items {
        let mut best_idx: Option<usize> = None;
        let mut best_dist = u32::MAX;
        for (i, members) in clusters.iter().enumerate() {
            let rep_hash = members[0].1;
            let dist = image_proc::phash_distance(hash, rep_hash);
            if dist <= threshold && dist < best_dist {
                best_dist = dist;
                best_idx = Some(i);
            }
        }
        match best_idx {
            Some(i) => clusters[i].push((photo, hash)),
            None => clusters.push(vec![(photo, hash)]),
        }
    }

    // Keep groups with 2+ members; pick best representative by composite score.
    let mut groups: Vec<PhotoGroup> = Vec::new();
    let mut gid = 0i64;
    for cluster in clusters {
        if cluster.len() < 2 {
            continue;
        }
        // Sort members by composite score descending (best first)
        let mut members: Vec<Photo> = cluster.into_iter().map(|(p, _)| p).collect();
        members.sort_by(|a, b| {
            let sa = a.composite_score.unwrap_or(-1.0);
            let sb = b.composite_score.unwrap_or(-1.0);
            sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
        });
        let representative = members[0].clone();
        gid += 1;
        groups.push(PhotoGroup {
            id: gid,
            count: members.len() as i64,
            best_score: representative.composite_score,
            representative,
            photos: members,
        });
    }

    // Sort groups by size then best score
    groups.sort_by(|a, b| {
        let by_size = b.count.cmp(&a.count);
        if by_size != std::cmp::Ordering::Equal {
            by_size
        } else {
            let sa = a.best_score.unwrap_or(0.0);
            let sb = b.best_score.unwrap_or(0.0);
            sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
        }
    });

    groups
}

/// Great-circle distance between two lat/lon points in kilometers.
fn haversine(a: (f64, f64), b: (f64, f64)) -> f64 {
    let r = 6371.0;
    let dlat = (b.0 - a.0).to_radians();
    let dlon = (b.1 - a.1).to_radians();
    let la1 = a.0.to_radians();
    let la2 = b.0.to_radians();
    let h = (dlat / 2.0).sin().powi(2) + la1.cos() * la2.cos() * (dlon / 2.0).sin().powi(2);
    r * 2.0 * h.sqrt()
}
