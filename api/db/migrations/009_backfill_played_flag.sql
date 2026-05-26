-- Backfill played=true for all existing session loggers
INSERT INTO user_games (user_id, game_id, status, played)
SELECT DISTINCT s.logged_by, s.game_id, 'played'::game_status, TRUE
FROM sessions s
ON CONFLICT (user_id, game_id) DO UPDATE SET played = TRUE;

-- Backfill played=true for all existing session players
INSERT INTO user_games (user_id, game_id, status, played)
SELECT DISTINCT sp.user_id, s.game_id, 'played'::game_status, TRUE
FROM session_players sp
JOIN sessions s ON s.id = sp.session_id
ON CONFLICT (user_id, game_id) DO UPDATE SET played = TRUE;
