-- ============================================================
-- Spotify Clone — MySQL Database Schema
-- ============================================================
-- Run this once to create the database and all tables.
-- Usage:  mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS spotify_clone
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE spotify_clone;

-- ------------------------------------------------------------
-- USERS — account data for authentication
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color  VARCHAR(20)  DEFAULT '#1ED760',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ARTISTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artists (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL UNIQUE,
  bio        TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ALBUMS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS albums (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  artist_id     INT,
  release_year  SMALLINT COMMENT 'plain year number, not MySQL YEAR type — some classical works predate 1901',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
  INDEX idx_album_artist (artist_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SONGS — the core catalog / song metadata
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS songs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  artist_id     INT,
  album_id      INT,
  genre         VARCHAR(50),
  language      VARCHAR(50),
  duration      INT NOT NULL COMMENT 'duration in seconds',
  release_year  SMALLINT,
  audio_file    VARCHAR(500) NOT NULL COMMENT 'local filename OR a full https:// preview URL',
  audio_source  VARCHAR(20) DEFAULT 'synth' COMMENT '"synth" = placeholder track, "itunes" = real preview via Apple iTunes Search API',
  play_count    INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
  FOREIGN KEY (album_id)  REFERENCES albums(id)  ON DELETE SET NULL,
  INDEX idx_song_title (title),
  INDEX idx_song_genre (genre),
  FULLTEXT INDEX idx_song_search (title)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- PLAYLISTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playlists (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  is_public   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_playlist_user (user_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- PLAYLIST_SONGS — junction table (many-to-many)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playlist_songs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  playlist_id INT NOT NULL,
  song_id     INT NOT NULL,
  position    INT DEFAULT 0,
  added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id)     REFERENCES songs(id)     ON DELETE CASCADE,
  UNIQUE KEY unique_playlist_song (playlist_id, song_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- LIKED_SONGS — user's favorites (many-to-many)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS liked_songs (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  user_id  INT NOT NULL,
  song_id  INT NOT NULL,
  liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_song (user_id, song_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- RECENTLY_PLAYED — play history per user
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recently_played (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NOT NULL,
  song_id   INT NOT NULL,
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  INDEX idx_recent_user (user_id, played_at)
) ENGINE=InnoDB;
