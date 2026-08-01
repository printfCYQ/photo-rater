use crate::models::{Album, Photo, PhotoFilter};
use rusqlite::{params, Connection};
use std::sync::Mutex;

/// Global database connection
static DB: std::sync::LazyLock<Mutex<Option<Connection>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

/// Initialize the database, creating tables if they don't exist.
pub fn init_db() -> Result<(), String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            source_dir TEXT NOT NULL,
            photo_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            dir TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            width INTEGER,
            height INTEGER,
            taken_at TEXT,
            ai_score REAL,
            blur_score REAL,
            exposure REAL,
            fft_clarity REAL,
            noise_level REAL,
            color_harmony REAL,
            composition REAL,
            face_count INTEGER,
            composite_score REAL,
            user_rating INTEGER,
            status TEXT DEFAULT 'pending',
            scored_at INTEGER,
            rated_at INTEGER,
            created_at INTEGER NOT NULL,
            album_id INTEGER,
            FOREIGN KEY (album_id) REFERENCES albums(id)
        );

        CREATE INDEX IF NOT EXISTS idx_dir ON photos(dir);
        CREATE INDEX IF NOT EXISTS idx_composite ON photos(composite_score DESC);
        CREATE INDEX IF NOT EXISTS idx_status ON photos(status);
        CREATE INDEX IF NOT EXISTS idx_album ON photos(album_id);
        ",
    )
    .map_err(|e| format!("Failed to create tables: {}", e))?;

    // Migration: add new columns for enhanced heuristic signals if they don't exist
    let migrate_cols = [
        "fft_clarity REAL",
        "noise_level REAL",
        "color_harmony REAL",
        "composition REAL",
    ];
    for col_def in &migrate_cols {
        let col_name = col_def.split_whitespace().next().unwrap_or("");
        let has_col: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('photos') WHERE name = ?1",
                params![col_name],
                |row| row.get::<_, i64>(0),
            )
            .map(|n| n > 0)
            .unwrap_or(false);

        if !has_col {
            conn.execute(
                &format!("ALTER TABLE photos ADD COLUMN {}", col_def),
                [],
            )
            .map_err(|e| format!("Failed to add column {}: {}", col_name, e))?;
            log::info!("Migrated: added column {} to photos", col_name);
        }
    }

    *DB.lock().unwrap() = Some(conn);
    log::info!("Database initialized at {:?}", db_path);
    Ok(())
}

/// Get the database file path in the app data directory.
fn get_db_path() -> Result<std::path::PathBuf, String> {
    let data_dir = dirs::data_dir()
        .ok_or("Could not find data directory")?
        .join("photo-rater");
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    Ok(data_dir.join("photo_rater.db"))
}

/// Execute a closure with the database connection.
fn with_db<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let guard = DB.lock().unwrap();
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    f(conn)
}

/// Create a new album.
pub fn create_album(name: &str, source_dir: &str) -> Result<Album, String> {
    let now = chrono::Utc::now().timestamp();
    with_db(|conn| {
        conn.execute(
            "INSERT INTO albums (name, source_dir, photo_count, created_at, updated_at) VALUES (?1, ?2, 0, ?3, ?3)",
            params![name, source_dir, now],
        )
        .map_err(|e| format!("Failed to create album: {}", e))?;

        let id = conn.last_insert_rowid();
        Ok(Album {
            id: Some(id),
            name: name.to_string(),
            source_dir: source_dir.to_string(),
            photo_count: 0,
            created_at: now,
            updated_at: now,
        })
    })
}

/// List all albums.
pub fn list_albums() -> Result<Vec<Album>, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare("SELECT id, name, source_dir, photo_count, created_at, updated_at FROM albums ORDER BY updated_at DESC")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let albums = stmt
            .query_map([], |row| {
                Ok(Album {
                    id: Some(row.get(0)?),
                    name: row.get(1)?,
                    source_dir: row.get(2)?,
                    photo_count: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|e| format!("Failed to query albums: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(albums)
    })
}

/// Insert or update a photo record. Returns the photo with id.
#[allow(dead_code)]
pub fn upsert_photo(photo: &Photo) -> Result<Photo, String> {
    let mut photo = photo.clone();
    with_db(|conn| {
        // Try to find existing photo by path
        let existing: Option<i64> = conn
            .query_row(
                "SELECT id FROM photos WHERE path = ?1",
                params![photo.path],
                |row| row.get(0),
            )
            .ok();

        if let Some(id) = existing {
            // Update existing record, preserving scores if not provided
            conn.execute(
                "UPDATE photos SET
                    file_name = ?2, dir = ?3, file_size = ?4,
                    width = COALESCE(?5, width), height = COALESCE(?6, height),
                    taken_at = COALESCE(?7, taken_at),
                    ai_score = COALESCE(?8, ai_score),
                    blur_score = COALESCE(?9, blur_score),
                    exposure = COALESCE(?10, exposure),
                    fft_clarity = COALESCE(?11, fft_clarity),
                    noise_level = COALESCE(?12, noise_level),
                    color_harmony = COALESCE(?13, color_harmony),
                    composition = COALESCE(?14, composition),
                    face_count = COALESCE(?15, face_count),
                    composite_score = COALESCE(?16, composite_score),
                    user_rating = COALESCE(?17, user_rating),
                    status = ?18,
                    scored_at = COALESCE(?19, scored_at),
                    rated_at = COALESCE(?20, rated_at),
                    album_id = COALESCE(?21, album_id)
                 WHERE id = ?1",
                params![
                    id,
                    photo.file_name,
                    photo.dir,
                    photo.file_size,
                    photo.width,
                    photo.height,
                    photo.taken_at,
                    photo.ai_score,
                    photo.blur_score,
                    photo.exposure,
                    photo.fft_clarity,
                    photo.noise_level,
                    photo.color_harmony,
                    photo.composition,
                    photo.face_count,
                    photo.composite_score,
                    photo.user_rating,
                    photo.status,
                    photo.scored_at,
                    photo.rated_at,
                    photo.album_id,
                ],
            )
            .map_err(|e| format!("Failed to update photo: {}", e))?;
            photo.id = Some(id);
        } else {
            // Insert new record
            conn.execute(
                "INSERT INTO photos (
                    path, file_name, dir, file_size, width, height, taken_at,
                    ai_score, blur_score, exposure, fft_clarity, noise_level, color_harmony, composition,
                    face_count, composite_score,
                    user_rating, status, scored_at, rated_at, created_at, album_id
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
                params![
                    photo.path,
                    photo.file_name,
                    photo.dir,
                    photo.file_size,
                    photo.width,
                    photo.height,
                    photo.taken_at,
                    photo.ai_score,
                    photo.blur_score,
                    photo.exposure,
                    photo.fft_clarity,
                    photo.noise_level,
                    photo.color_harmony,
                    photo.composition,
                    photo.face_count,
                    photo.composite_score,
                    photo.user_rating,
                    photo.status,
                    photo.scored_at,
                    photo.rated_at,
                    photo.created_at,
                    photo.album_id,
                ],
            )
            .map_err(|e| format!("Failed to insert photo: {}", e))?;
            photo.id = Some(conn.last_insert_rowid());
        }

        Ok(photo)
    })
}

/// Batch insert photos for an album. Updates album photo_count.
pub fn batch_insert_photos(photos: &[Photo], album_id: i64) -> Result<i64, String> {
    let mut count = 0i64;
    with_db(|conn| {
        for photo in photos {
            let mut photo = photo.clone();
            photo.album_id = Some(album_id);

            // Insert or ignore (skip duplicates)
            let result = conn.execute(
                "INSERT OR IGNORE INTO photos (
                    path, file_name, dir, file_size, width, height, taken_at,
                    ai_score, blur_score, exposure, fft_clarity, noise_level, color_harmony, composition,
                    face_count, composite_score,
                    user_rating, status, scored_at, rated_at, created_at, album_id
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
                params![
                    photo.path,
                    photo.file_name,
                    photo.dir,
                    photo.file_size,
                    photo.width,
                    photo.height,
                    photo.taken_at,
                    photo.ai_score,
                    photo.blur_score,
                    photo.exposure,
                    photo.fft_clarity,
                    photo.noise_level,
                    photo.color_harmony,
                    photo.composition,
                    photo.face_count,
                    photo.composite_score,
                    photo.user_rating,
                    photo.status,
                    photo.scored_at,
                    photo.rated_at,
                    photo.created_at,
                    photo.album_id,
                ],
            );

            if let Ok(rows) = result {
                if rows > 0 {
                    count += 1;
                }
            }
        }

        // Update album count
        conn.execute(
            "UPDATE albums SET photo_count = (SELECT COUNT(*) FROM photos WHERE album_id = ?1), updated_at = ?2 WHERE id = ?1",
            params![album_id, chrono::Utc::now().timestamp()],
        )
        .map_err(|e| format!("Failed to update album: {}", e))?;

        Ok(count)
    })
}

/// List photos with optional filtering and sorting.
pub fn list_photos(filter: &PhotoFilter) -> Result<Vec<Photo>, String> {
    with_db(|conn| {
        let mut sql = String::from(
            "SELECT id, path, file_name, dir, file_size, width, height, taken_at,
             ai_score, blur_score, exposure, fft_clarity, noise_level, color_harmony, composition,
             face_count, composite_score,
             user_rating, status, scored_at, rated_at, created_at, album_id
             FROM photos WHERE 1=1",
        );
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(album_id) = filter.album_id {
            sql.push_str(" AND album_id = ?");
            params_vec.push(Box::new(album_id));
        }
        if let Some(ref status) = filter.status {
            sql.push_str(" AND status = ?");
            params_vec.push(Box::new(status.clone()));
        }
        if let Some(min) = filter.min_score {
            sql.push_str(" AND composite_score >= ?");
            params_vec.push(Box::new(min));
        }
        if let Some(max) = filter.max_score {
            sql.push_str(" AND composite_score <= ?");
            params_vec.push(Box::new(max));
        }

        // Sort
        let sort_col = match filter.sort_by.as_str() {
            "ai_score" => "ai_score",
            "blur_score" => "blur_score",
            "user_rating" => "user_rating",
            "file_name" => "file_name",
            "created_at" => "created_at",
            _ => "composite_score",
        };
        let order = if filter.sort_desc { "DESC" } else { "ASC" };
        // Handle NULLs: put them last
        sql.push_str(&format!(
            " ORDER BY {} IS NULL, {} {}",
            sort_col, sort_col, order
        ));

        if let Some(limit) = filter.limit {
            sql.push_str(" LIMIT ?");
            params_vec.push(Box::new(limit));
        }
        if let Some(offset) = filter.offset {
            sql.push_str(" OFFSET ?");
            params_vec.push(Box::new(offset));
        }

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let param_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();

        let photos = stmt
            .query_map(param_refs.as_slice(), |row| {
                Ok(Photo {
                    id: Some(row.get(0)?),
                    path: row.get(1)?,
                    file_name: row.get(2)?,
                    dir: row.get(3)?,
                    file_size: row.get(4)?,
                    width: row.get(5)?,
                    height: row.get(6)?,
                    taken_at: row.get(7)?,
                    ai_score: row.get(8)?,
                    blur_score: row.get(9)?,
                    exposure: row.get(10)?,
                    fft_clarity: row.get(11)?,
                    noise_level: row.get(12)?,
                    color_harmony: row.get(13)?,
                    composition: row.get(14)?,
                    face_count: row.get(15)?,
                    composite_score: row.get(16)?,
                    user_rating: row.get(17)?,
                    status: row.get(18)?,
                    scored_at: row.get(19)?,
                    rated_at: row.get(20)?,
                    created_at: row.get(21)?,
                    album_id: row.get(22)?,
                })
            })
            .map_err(|e| format!("Failed to query photos: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(photos)
    })
}

/// Update a photo's user rating and status.
pub fn update_rating(
    path: &str,
    rating: Option<i32>,
    status: &str,
) -> Result<bool, String> {
    let now = chrono::Utc::now().timestamp();
    with_db(|conn| {
        let rows = conn
            .execute(
                "UPDATE photos SET user_rating = ?1, status = ?2, rated_at = ?3 WHERE path = ?4",
                params![rating, status, now, path],
            )
            .map_err(|e| format!("Failed to update rating: {}", e))?;
        Ok(rows > 0)
    })
}

/// Update a photo's scores (all heuristic signals + composite).
pub fn update_scores(
    path: &str,
    ai_score: Option<f64>,
    blur_score: Option<f64>,
    exposure: Option<f64>,
    fft_clarity: Option<f64>,
    noise_level: Option<f64>,
    color_harmony: Option<f64>,
    composition: Option<f64>,
    composite_score: Option<f64>,
) -> Result<bool, String> {
    let now = chrono::Utc::now().timestamp();
    with_db(|conn| {
        let rows = conn
            .execute(
                "UPDATE photos SET ai_score = ?1, blur_score = ?2, exposure = ?3,
                 fft_clarity = ?4, noise_level = ?5, color_harmony = ?6, composition = ?7,
                 composite_score = ?8, scored_at = ?9 WHERE path = ?10",
                params![
                    ai_score,
                    blur_score,
                    exposure,
                    fft_clarity,
                    noise_level,
                    color_harmony,
                    composition,
                    composite_score,
                    now,
                    path
                ],
            )
            .map_err(|e| format!("Failed to update scores: {}", e))?;
        Ok(rows > 0)
    })
}

/// Get photo statistics for an album.
pub fn get_stats(album_id: Option<i64>) -> Result<PhotoStats, String> {
    with_db(|conn| {
        let (album_condition, param): (String, Option<i64>) = match album_id {
            Some(id) => ("AND album_id = ?".to_string(), Some(id)),
            None => ("".to_string(), None),
        };

        let total: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM photos WHERE 1=1 {}", album_condition),
                params![param],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let scored: i64 = conn
            .query_row(
                &format!(
                    "SELECT COUNT(*) FROM photos WHERE ai_score IS NOT NULL {}",
                    album_condition
                ),
                params![param],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let rated: i64 = conn
            .query_row(
                &format!(
                    "SELECT COUNT(*) FROM photos WHERE user_rating IS NOT NULL {}",
                    album_condition
                ),
                params![param],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let kept: i64 = conn
            .query_row(
                &format!(
                    "SELECT COUNT(*) FROM photos WHERE status = 'keep' {}",
                    album_condition
                ),
                params![param],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let rejected: i64 = conn
            .query_row(
                &format!(
                    "SELECT COUNT(*) FROM photos WHERE status = 'reject' {}",
                    album_condition
                ),
                params![param],
                |row| row.get(0),
            )
            .unwrap_or(0);

        Ok(PhotoStats {
            total,
            scored,
            rated,
            kept,
            rejected,
        })
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PhotoStats {
    pub total: i64,
    pub scored: i64,
    pub rated: i64,
    pub kept: i64,
    pub rejected: i64,
}

/// Get all photo paths for an album (used for cache cleanup before deletion).
pub fn get_album_photo_paths(album_id: i64) -> Result<Vec<String>, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare("SELECT path FROM photos WHERE album_id = ?1")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;
        let paths = stmt
            .query_map(params![album_id], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to query paths: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(paths)
    })
}

/// Delete an album and its photos.
pub fn delete_album(album_id: i64) -> Result<bool, String> {
    with_db(|conn| {
        conn.execute("DELETE FROM photos WHERE album_id = ?1", params![album_id])
            .map_err(|e| format!("Failed to delete photos: {}", e))?;
        let rows = conn
            .execute("DELETE FROM albums WHERE id = ?1", params![album_id])
            .map_err(|e| format!("Failed to delete album: {}", e))?;
        Ok(rows > 0)
    })
}
