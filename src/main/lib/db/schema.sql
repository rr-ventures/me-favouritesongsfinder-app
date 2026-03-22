-- ============================================================
-- CORE ENTITIES
-- ============================================================

CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,
    mbid TEXT,
    discogs_id INTEGER,
    spotify_id TEXT,
    lastfm_url TEXT,
    bandcamp_url TEXT,
    is_seed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_normalized TEXT NOT NULL,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    mbid TEXT,
    duration_seconds INTEGER,
    album_name TEXT,
    album_art_url TEXT,
    release_year INTEGER,
    spotify_id TEXT,
    youtube_video_id TEXT,
    soundcloud_url TEXT,
    bandcamp_url TEXT,
    is_seed INTEGER DEFAULT 0,
    playback_source TEXT CHECK(playback_source IN ('youtube','spotify','soundcloud','unavailable') OR playback_source IS NULL),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- METADATA AND RELATIONSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('artist','track')),
    entity_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    tag_normalized TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('lastfm','musicbrainz','discogs','listenbrainz','manual','reddit','editorial')),
    weight REAL DEFAULT 1.0 CHECK(weight >= 0 AND weight <= 1),
    UNIQUE(entity_type, entity_id, tag_normalized, source)
);

CREATE TABLE IF NOT EXISTS artist_labels (
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    label_name TEXT NOT NULL,
    label_name_normalized TEXT NOT NULL,
    discogs_label_id INTEGER,
    PRIMARY KEY (artist_id, label_name_normalized)
);

CREATE TABLE IF NOT EXISTS artist_credits (
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('primary','producer','remixer','vocalist','featured')),
    PRIMARY KEY (track_id, artist_id, role)
);

CREATE TABLE IF NOT EXISTS artist_similarity (
    artist_id_a INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    artist_id_b INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK(source IN ('lastfm','listenbrainz','musicbrainz','discogs','spotify')),
    score REAL NOT NULL CHECK(score >= 0 AND score <= 1),
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (artist_id_a, artist_id_b, source)
);

-- ============================================================
-- MIX / TRACKLIST CO-OCCURRENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS mix_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL CHECK(source_type IN ('youtube_mix','mixcloud','1001tracklists','nts','worldwide_fm','rinse_fm','other_radio')),
    source_url TEXT UNIQUE,
    title TEXT,
    creator_name TEXT,
    raw_description TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mix_tracks (
    mix_id INTEGER REFERENCES mix_sources(id) ON DELETE CASCADE,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER,
    PRIMARY KEY (mix_id, track_id)
);

-- ============================================================
-- SCORING
-- ============================================================

CREATE TABLE IF NOT EXISTS signal_scores (
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL CHECK(signal_type IN ('artist_similarity','tag_match','mix_cooccurrence','label_credit','collector_overlap','community_mention','source_agreement','audio_similarity')),
    raw_score REAL NOT NULL,
    normalized_score REAL NOT NULL CHECK(normalized_score >= 0 AND normalized_score <= 1),
    evidence_json TEXT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id, signal_type)
);

CREATE TABLE IF NOT EXISTS composite_scores (
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE PRIMARY KEY,
    final_score REAL NOT NULL CHECK(final_score >= 0 AND final_score <= 1),
    source_count INTEGER DEFAULT 0,
    recommendation_reason TEXT,
    last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signal_weights (
    signal_type TEXT PRIMARY KEY,
    weight REAL NOT NULL DEFAULT 0.15 CHECK(weight >= 0 AND weight <= 1),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO signal_weights (signal_type, weight) VALUES
    ('artist_similarity', 0.25),
    ('tag_match', 0.20),
    ('mix_cooccurrence', 0.20),
    ('label_credit', 0.15),
    ('collector_overlap', 0.10),
    ('community_mention', 0.05),
    ('source_agreement', 0.05),
    ('audio_similarity', 0.00);

-- ============================================================
-- USER INTERACTION
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK(action IN ('like','skip','dislike','save')),
    skip_reason TEXT CHECK(skip_reason IN ('too_sleepy','too_electronic','too_vocal','wrong_energy','not_vibing') OR skip_reason IS NULL),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    is_auto INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO playlists (id, name, description, is_auto) VALUES
    (1, 'Liked Songs', 'Automatically added when you like a track', 1);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS listening_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_listened_seconds INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0
);

-- ============================================================
-- PIPELINE STATE
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','partial','cancelled')),
    started_at DATETIME,
    completed_at DATETIME,
    items_processed INTEGER DEFAULT 0,
    items_total INTEGER,
    items_failed INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    error_message TEXT,
    log_json TEXT,
    resume_state_json TEXT,
    config_json TEXT,
    estimated_cost_usd REAL DEFAULT 0
);

-- ============================================================
-- CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS seed_inputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input_type TEXT NOT NULL CHECK(input_type IN ('artist','track','spotify_url','youtube_url','freetext')),
    input_value TEXT NOT NULL,
    resolved_artist_id INTEGER REFERENCES artists(id),
    resolved_track_id INTEGER REFERENCES tracks(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taste_descriptors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descriptor TEXT NOT NULL UNIQUE,
    weight REAL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS source_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL CHECK(source_type IN ('youtube_channel','mixcloud_creator','radio_show','blog')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    notes TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_artists_norm ON artists(name_normalized);
CREATE INDEX IF NOT EXISTS idx_tracks_norm ON tracks(title_normalized, artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tags_entity ON tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag_normalized);
CREATE INDEX IF NOT EXISTS idx_scores_track ON signal_scores(track_id);
CREATE INDEX IF NOT EXISTS idx_composite_score ON composite_scores(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_track ON feedback(track_id);
CREATE INDEX IF NOT EXISTS idx_feedback_action ON feedback(action);
CREATE INDEX IF NOT EXISTS idx_mix_tracks_track ON mix_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_mix_tracks_mix ON mix_tracks(mix_id);
CREATE INDEX IF NOT EXISTS idx_similarity_a ON artist_similarity(artist_id_a);
CREATE INDEX IF NOT EXISTS idx_similarity_b ON artist_similarity(artist_id_b);
CREATE INDEX IF NOT EXISTS idx_history_track ON listening_history(track_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_step ON pipeline_runs(step_name);
CREATE INDEX IF NOT EXISTS idx_source_channels_type ON source_channels(source_type);
