"""Calculate performance scores (p_score) for OWC 2025 players

This script reads match data from the osu! API and calculates performance scores
for each player based on the formula:

    pscore = (Σ(i=1 to n) Si/Mi) / n · √(n / Σ(j=1 to m) Nj)

where:
    n = amount of maps played by the player
    S = player score on a map
    M = median score on a map
    m = amount of matches played by the player
    N = mean amount of maps played (per player) in a match

The p_score is calculated as a weighted mean across all matches a player participates in.

Usage:
    python calculate_pscores.py --matches 119719487 119959585 120123456
    python calculate_pscores.py --match-file matches.txt
"""

import argparse
import json
import logging
import math
import os
import sqlite3
import statistics
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

try:
    import httpx
except ImportError:
    raise SystemExit("Missing dependency: please install httpx (pip install httpx)")

# Load environment variables
_here = Path(__file__).resolve().parent
load_dotenv(dotenv_path=_here.parent / ".env")

CLIENT_ID = os.getenv("OSU_CLIENT_ID1")
CLIENT_SECRET = os.getenv("OSU_CLIENT_SECRET1")
if not CLIENT_ID or not CLIENT_SECRET:
    raise SystemExit("Error: OSU_CLIENT_ID1 and OSU_CLIENT_SECRET1 required in backend/.env")

CLIENT_ID = os.getenv("OSU_CLIENT_ID1")
CLIENT_SECRET = os.getenv("OSU_CLIENT_SECRET1")
if not CLIENT_ID or not CLIENT_SECRET:
    raise SystemExit("Error: OSU_CLIENT_ID1 and OSU_CLIENT_SECRET1 required in backend/.env")

TOKEN_URL = "https://osu.ppy.sh/oauth/token"
API_BASE = "https://osu.ppy.sh/api/v2"

DEFAULT_DB = "players.db"
TABLE_NAME = "2025owc"
USERS_DB = "users.db"

log = logging.getLogger("calculate_pscores")


def get_app_token(client_id: str, client_secret: str) -> str:
    """Get OAuth token for osu! API"""
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
        "scope": "public",
    }
    with httpx.Client(timeout=20.0) as client:
        r = client.post(TOKEN_URL, data=data, headers={"Accept": "application/json"})
    if r.status_code != 200:
        raise RuntimeError(f"Failed to obtain token: {r.status_code} {r.text}")
    payload = r.json()
    return payload.get("access_token")


def fetch_match(match_id: int, token: str) -> dict:
    """Fetch match data from osu! API with proper pagination using 'before' parameter"""
    url = f"{API_BASE}/matches/{match_id}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    
    # Fetch first page with high limit
    params = {"limit": 100}
    
    with httpx.Client(timeout=30.0) as client:
        r = client.get(url, headers=headers, params=params)
    if r.status_code != 200:
        raise RuntimeError(f"Failed to fetch match {match_id}: {r.status_code} {r.text}")
    
    match_data = r.json()
    all_events = match_data.get("events", [])
    
    log.info(f"  Page 1: {len(all_events)} events")
    
    # Continue fetching if we got 100 events (indicates more pages)
    page = 1
    while len(all_events) > 0 and len(all_events) % 100 == 0 and page < 20:
        # Use the earliest event ID as the 'before' parameter for next page
        earliest_event_id = min(e.get("id", float('inf')) for e in all_events)
        
        page += 1
        log.info(f"  Fetching page {page} (before event {earliest_event_id})...")
        
        params = {"limit": 100, "before": earliest_event_id}
        
        with httpx.Client(timeout=30.0) as client:
            r = client.get(url, headers=headers, params=params)
        
        if r.status_code != 200:
            log.warning(f"Failed to fetch page {page}: {r.status_code}")
            break
        
        page_data = r.json()
        page_events = page_data.get("events", [])
        
        log.info(f"  Page {page}: {len(page_events)} events")
        
        if not page_events:
            log.info("  No more events")
            break
        
        # Check for duplicates (event IDs we already have)
        new_events = [e for e in page_events if e.get("id") not in {ev.get("id") for ev in all_events}]
        
        if not new_events:
            log.info("  No new events (all duplicates), stopping")
            break
        
        all_events.extend(new_events)
        
        # If we got fewer than 100, we're at the end
        if len(page_events) < 100:
            break
    
    # Update match_data with all events
    match_data["events"] = all_events
    
    # Count total events and games
    total_games = sum(1 for e in all_events if e.get("game"))
    log.info(f"  Total: {len(all_events)} events ({total_games} games) across {page} page(s)")
    
    return match_data


def check_booster_activation(booster_id: int, player_data: dict, match_data: dict, all_player_pscores: Dict[int, float]) -> Tuple[bool, int]:
    """
    Check if a booster condition is met for a player in a match.
    
    Args:
        booster_id: ID of the booster (1-12)
        player_data: Dict with player's performance data in this match
        match_data: Full match data from API
        all_player_pscores: Dict mapping user_id to pscore for all players in match
    
    Returns:
        Tuple of (is_activated, points_awarded)
    """
    user_id = player_data.get("user_id")
    maps_played = player_data.get("maps_played", 0)
    scores = player_data.get("scores", [])  # List of score dicts for each map
    
    # Booster 2: Captain - Player is on winning team
    if booster_id == 2:
        match_info = match_data.get("match", {})
        team = player_data.get("team")
        # Determine winner by counting map wins (not total score)
        events = match_data.get("events", [])
        team_map_wins = defaultdict(int)
        
        for event in events:
            game = event.get("game", {})
            if not game:
                continue
            
            game_scores = game.get("scores", [])
            if not game_scores:
                continue
            
            # Find which team won this map (highest total score on the map)
            team_scores_per_map = defaultdict(int)
            for score_data in game_scores:
                player_team = score_data.get("match", {}).get("team")
                if player_team:
                    team_scores_per_map[player_team] += score_data.get("score", 0)
            
            # Determine map winner
            if team_scores_per_map:
                map_winner = max(team_scores_per_map, key=team_scores_per_map.get)
                team_map_wins[map_winner] += 1
        
        if team and team_map_wins:
            winning_team = max(team_map_wins, key=team_map_wins.get)
            if team == winning_team:
                return (True, 5)
        return (False, -5)
    
    # Booster 3: Noob - Lowest p-score in lobby
    elif booster_id == 3:
        if not all_player_pscores:
            return (False, -2)
        # Players who didn't play have p-score of 1
        min_pscore = min(all_player_pscores.values())
        player_pscore = all_player_pscores.get(user_id, 1.0)
        if player_pscore == min_pscore and player_pscore <= 1.0:
            return (True, 5)
        return (False, -2)
    
    # Booster 4: 727WYSI - Score or combo contains "727"
    elif booster_id == 4:
        for score_data in scores:
            score_val = score_data.get("score", 0)
            combo = score_data.get("max_combo", 0)
            if "727" in str(score_val) or combo == 727:
                return (True, 7)
        return (False, 0)
    
    # Booster 5: Boshyman741 - Only plays one map and top scores it
    elif booster_id == 5:
        if maps_played == 1 and scores:
            score_data = scores[0]
            # Check if this was the top score on that map
            game_data = score_data.get("game_data", {})
            all_scores_on_map = game_data.get("scores", [])
            if all_scores_on_map:
                max_score = max(s.get("score", 0) for s in all_scores_on_map)
                if score_data.get("score", 0) == max_score:
                    return (True, 5)
        return (False, -5)
    
    # Booster 6: They Picked DT2 - B rank on any DT map
    elif booster_id == 6:
        for score_data in scores:
            mods = score_data.get("mods", [])
            rank = score_data.get("rank", "")
            # Check if DT mod is present
            has_dt = any(mod in ["DT", "NC"] for mod in mods) if isinstance(mods, list) else "DT" in str(mods)
            if has_dt and (rank == "B" or rank == "C" or rank == "D"):
                return (True, 6)
        return (False, -2)
    
    # Booster 7: Faker - Highest p-score >= 1.8 in lobby
    elif booster_id == 7:
        if not all_player_pscores:
            return (False, -5)
        player_pscore = all_player_pscores.get(user_id, 0)
        max_pscore = max(all_player_pscores.values())
        if player_pscore == max_pscore and player_pscore >= 1.8:
            return (True, 5)
        return (False, -5)
    
    # Booster 8: LETS GO GAMBLING - S ranks 3 maps in a row
    elif booster_id == 8:
        if len(scores) >= 3:
            for i in range(len(scores) - 2):
                if ((scores[i].get("rank") == "S" or scores[i].get("rank") == "SS" or scores[i].get("rank") == "SH") and 
                    (scores[i+1].get("rank") == "S" or scores[i+1].get("rank") == "SS" or scores[i+1].get("rank") == "SH") and 
                    (scores[i+2].get("rank") == "S" or scores[i+2].get("rank") == "SS" or scores[i+2].get("rank") == "SH")):
                    return (True, 10)
        return (False, -10)
    
    # Booster 9: ITS OVER 9000(k) - Score over 900k on any map
    elif booster_id == 9:
        for score_data in scores:
            if score_data.get("score", 0) > 900000:
                return (True, 5)
        return (False, -5)
    
    # Booster 10: TB HYPE - Plays tiebreaker map
    elif booster_id == 10:
        # Check if any map is a tiebreaker (typically marked in beatmap name or mod)
        for score_data in scores:
            # Check beatmap from score_data
            beatmap = score_data.get("beatmap", {})
            difficulty = beatmap.get("version", "").lower()
            
            # Also check from game_data if beatmap not in score_data
            if not difficulty:
                game_data = score_data.get("game_data", {})
                beatmap = game_data.get("beatmap", {})
                difficulty = beatmap.get("version", "").lower()
            
            if "destin victorica" in difficulty or "nostalgia" in difficulty or "tiebreaker" in difficulty or "tb" in difficulty:
                return (True, 3)
        return (False, 0)
    
    # Booster 11: OVERWORKING - Played every map in lobby
    elif booster_id == 11:
        events = match_data.get("events", [])
        total_maps = sum(1 for e in events if e.get("game"))
        if maps_played == total_maps and total_maps > 0:
            return (True, 5)
        return (False, -5)
    
    # Booster 12: Inconsistent - Lower than 1000 combo on every map
    elif booster_id == 12:
        if maps_played == 0:
            return (False, -5)
        for score_data in scores:
            combo = score_data.get("max_combo", 0)
            if combo >= 1000:
                return (False, -5)
        return (True, 5)
    
    return (False, 0)


def calculate_match_pscore_with_details(match_data: dict) -> Tuple[Dict[int, Tuple[float, int, int]], Dict[int, dict]]:
    """
    Calculate p_score for each player in a match and return detailed player data.
    
    Returns:
        Tuple of:
        - Dict[user_id, (pscore, maps_played, total_maps_in_match)]
        - Dict[user_id, player_details] with scores, team, etc.
    """
    events = match_data.get("events", [])
    
    # Collect all game events (maps played)
    games = [event for event in events if event.get("game")]
    
    if not games:
        log.warning("No games found in match")
        return {}, {}
    
    # Calculate N: mean amount of maps played per player in this match
    player_map_counts = defaultdict(int)
    player_details = defaultdict(lambda: {
        "user_id": None,
        "maps_played": 0,
        "scores": [],
        "team": None
    })
    
    for event in games:
        game = event.get("game", {})
        scores = game.get("scores", [])
        
        for score_data in scores:
            user_id = score_data.get("user_id")
            if user_id:
                player_map_counts[user_id] += 1
                # Store detailed score data
                player_details[user_id]["user_id"] = user_id
                player_details[user_id]["maps_played"] += 1
                score_copy = dict(score_data)
                score_copy["game_data"] = game  # Include game context
                player_details[user_id]["scores"].append(score_copy)
                if not player_details[user_id]["team"] and score_data.get("match", {}).get("team"):
                    player_details[user_id]["team"] = score_data["match"]["team"]
    
    if not player_map_counts:
        log.warning("No player scores found in match")
        return {}, {}
    
    # N = mean maps played per player in this match
    N_mean = statistics.mean(player_map_counts.values()) if player_map_counts else 1
    
    # Calculate p_score for each player
    player_scores = defaultdict(lambda: {"score_ratios": [], "maps_played": 0})
    
    map_num = 0
    for event in games:
        game = event.get("game", {})
        scores = game.get("scores", [])
        
        # Debug: Show map name
        map_num += 1
        beatmap = game.get("beatmap", {})
        map_id = beatmap.get("id", "Unknown")
        
        # Get full map name: Artist - Title [Difficulty]
        beatmapset = beatmap.get("beatmapset", {})
        artist = beatmapset.get("artist", "")
        title = beatmapset.get("title", "")
        difficulty = beatmap.get("version", "Unknown")
        
        if artist and title:
            full_map_name = f"{artist} - {title} [{difficulty}]"
        else:
            full_map_name = f"[{difficulty}]"
        
        log.info(f"    Map {map_num}/{len(games)}: {full_map_name} (ID: {map_id})")
        
        # Get all scores for this map to calculate median
        map_scores = [s.get("score", 0) for s in scores if s.get("score")]
        
        if not map_scores:
            continue
        
        median_score = statistics.median(map_scores)
        
        # Avoid division by zero
        if median_score == 0:
            continue
        
        # Calculate S/M for each player on this map
        for score_data in scores:
            user_id = score_data.get("user_id")
            player_score = score_data.get("score", 0)
            
            if user_id and player_score:
                ratio = player_score / median_score
                player_scores[user_id]["score_ratios"].append(ratio)
                player_scores[user_id]["maps_played"] += 1
    
    # Calculate final p_score for each player
    results = {}
    total_maps = len(games)
    
    for user_id, data in player_scores.items():
        score_ratios = data["score_ratios"]
        n = data["maps_played"]  # maps played by this player
        
        if n == 0:
            continue
        
        # pscore = (Σ(Si/Mi) / n) · √(n / N)
        avg_ratio = sum(score_ratios) / n
        normalization = math.sqrt(n / N_mean) if N_mean > 0 else 1
        pscore = avg_ratio * normalization
        
        results[user_id] = (pscore, n, total_maps)
    
    return results, dict(player_details)


def calculate_match_pscore(match_data: dict) -> Dict[int, Tuple[float, int, int]]:
    """
    Calculate p_score for each player in a match.
    
    Returns:
        Dict[user_id, (pscore, maps_played, total_maps_in_match)]
    """
    results, _ = calculate_match_pscore_with_details(match_data)
    return results
    
    # Calculate N: mean amount of maps played per player in this match
    player_map_counts = defaultdict(int)
    
    for event in games:
        game = event.get("game", {})
        scores = game.get("scores", [])
        
        for score_data in scores:
            user_id = score_data.get("user_id")
            if user_id:
                player_map_counts[user_id] += 1
    
    if not player_map_counts:
        log.warning("No player scores found in match")
        return {}
    
    # N = mean maps played per player in this match
    N_mean = statistics.mean(player_map_counts.values()) if player_map_counts else 1
    
    # Calculate p_score for each player
    player_scores = defaultdict(lambda: {"score_ratios": [], "maps_played": 0})
    
    for event in games:
        game = event.get("game", {})
        scores = game.get("scores", [])
        
        # Get all scores for this map to calculate median
        map_scores = [s.get("score", 0) for s in scores if s.get("score")]
        
        if not map_scores:
            continue
        
        median_score = statistics.median(map_scores)
        
        # Avoid division by zero
        if median_score == 0:
            continue
        
        # Calculate S/M for each player on this map
        for score_data in scores:
            user_id = score_data.get("user_id")
            player_score = score_data.get("score", 0)
            
            if user_id and player_score:
                ratio = player_score / median_score
                player_scores[user_id]["score_ratios"].append(ratio)
                player_scores[user_id]["maps_played"] += 1
    
    # Calculate final p_score for each player
    results = {}
    total_maps = len(games)
    
    for user_id, data in player_scores.items():
        score_ratios = data["score_ratios"]
        n = data["maps_played"]  # maps played by this player
        
        if n == 0:
            continue
        
        # pscore = (Σ(Si/Mi) / n) · √(n / N)
        avg_ratio = sum(score_ratios) / n
        normalization = math.sqrt(n / N_mean) if N_mean > 0 else 1
        pscore = avg_ratio * normalization
        
        results[user_id] = (pscore, n, total_maps)
    
    return results


def add_pscore_columns(conn: sqlite3.Connection):
    """Add p_score and matches_played columns if they don't exist"""
    cursor = conn.cursor()
    
    # Add p_score column
    try:
        cursor.execute(f'ALTER TABLE "{TABLE_NAME}" ADD COLUMN p_score REAL DEFAULT 0.0')
        conn.commit()
        log.info("Added 'p_score' column")
    except sqlite3.OperationalError as e:
        if "duplicate column" not in str(e).lower():
            raise
    
    # Add matches_played column
    try:
        cursor.execute(f'ALTER TABLE "{TABLE_NAME}" ADD COLUMN matches_played INTEGER DEFAULT 0')
        conn.commit()
        log.info("Added 'matches_played' column")
    except sqlite3.OperationalError as e:
        if "duplicate column" not in str(e).lower():
            raise
    
    # Add total_maps_played column to track total maps across all matches
    try:
        cursor.execute(f'ALTER TABLE "{TABLE_NAME}" ADD COLUMN total_maps_played INTEGER DEFAULT 0')
        conn.commit()
        log.info("Added 'total_maps_played' column")
    except sqlite3.OperationalError as e:
        if "duplicate column" not in str(e).lower():
            raise


def get_user_id_by_profile_url(conn: sqlite3.Connection, user_id: int) -> Optional[int]:
    """Get database player ID from osu user ID"""
    cursor = conn.cursor()
    cursor.execute(
        f'SELECT id FROM "{TABLE_NAME}" WHERE profile_url LIKE ?',
        (f"%/users/{user_id}%",)
    )
    row = cursor.fetchone()
    return row[0] if row else None


def update_player_pscores(conn: sqlite3.Connection, match_pscores: List[Dict[int, Tuple[float, int, int]]]):
    """
    Update player p_scores in database using weighted mean across matches.
    
    Args:
        match_pscores: List of dicts mapping user_id to (pscore, maps_played, total_maps)
    """
    cursor = conn.cursor()
    
    # Aggregate data across all matches for each player
    player_data = defaultdict(lambda: {
        "db_id": None,
        "pscores": [],  # List of (pscore, weight) tuples
        "matches": 0,
        "total_maps": 0
    })
    
    for match_results in match_pscores:
        for user_id, (pscore, maps_played, total_maps) in match_results.items():
            # Get database ID
            db_id = get_user_id_by_profile_url(conn, user_id)
            if not db_id:
                log.warning(f"User {user_id} not found in database, skipping")
                continue
            
            data = player_data[db_id]
            data["db_id"] = db_id
            data["pscores"].append((pscore, maps_played))  # Weight by maps played
            data["matches"] += 1
            data["total_maps"] += maps_played
    
    # Update each player
    updated = 0
    for db_id, data in player_data.items():
        pscores = data["pscores"]
        
        if not pscores:
            continue
        
        # Calculate weighted mean (weighted by maps played in each match)
        total_weight = sum(weight for _, weight in pscores)
        if total_weight == 0:
            continue
        
        weighted_pscore = sum(score * weight for score, weight in pscores) / total_weight
        
        # Get player username for logging
        cursor.execute(f'SELECT username FROM "{TABLE_NAME}" WHERE id = ?', (db_id,))
        username_row = cursor.fetchone()
        username = username_row["username"] if username_row else f"ID {db_id}"
        
        # Update database
        cursor.execute(
            f'UPDATE "{TABLE_NAME}" SET p_score = ?, matches_played = ?, total_maps_played = ? WHERE id = ?',
            (weighted_pscore, data["matches"], data["total_maps"], db_id)
        )
        updated += 1
        
        log.info(f"Updated player {username}: p_score={weighted_pscore:.4f}, matches={data['matches']}, maps={data['total_maps']}")
    
    conn.commit()
    log.info(f"Updated {updated} players with p_scores")


def update_user_scores_with_boosters(match_data_list: List[Tuple[int, dict]], match_pscores_list: List[dict], match_details_list: List[dict]):
    """
    Calculate and update user fantasy scores with booster bonuses applied.
    This only updates booster points - base p-score points are handled by update_scores.py
    
    Args:
        match_data_list: List of (match_id, match_data) tuples
        match_pscores_list: List of match p-score results
        match_details_list: List of match player details
    """
    users_db_path = Path(__file__).parent.parent / USERS_DB
    if not users_db_path.exists():
        log.warning(f"Users database not found at {users_db_path}, skipping user score updates")
        return
    
    conn = sqlite3.connect(users_db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get all teams with their boosters
        cursor.execute("SELECT user_osu_id, player_ids, boosters FROM teams WHERE tournament = 'owc2025'")
        teams = cursor.fetchall()
        
        for team in teams:
            user_osu_id = team["user_osu_id"]
            player_ids_str = team["player_ids"]
            boosters_json = team["boosters"]
            
            if not player_ids_str:
                continue
            
            player_ids = [int(pid) for pid in player_ids_str.split(",") if pid]
            
            # Parse boosters
            import json
            try:
                boosters = json.loads(boosters_json) if boosters_json else {}
            except json.JSONDecodeError:
                boosters = {}
            
            # Only calculate booster points
            total_booster_points = 0
            
            # Process each match
            for (match_id, match_data), match_pscores, match_player_details in zip(match_data_list, match_pscores_list, match_details_list):
                
                # For each player in the team
                for player_db_id in player_ids:
                    # Check if player has a booster assigned
                    booster_id = boosters.get(str(player_db_id))
                    if not booster_id:
                        continue
                    
                    # Find the osu user_id and username for this player
                    player_user_id = None
                    player_username = f"ID {player_db_id}"
                    player_conn = sqlite3.connect(DEFAULT_DB)
                    player_cursor = player_conn.cursor()
                    player_cursor.execute(f'SELECT profile_url, username FROM "{TABLE_NAME}" WHERE id = ?', (player_db_id,))
                    row = player_cursor.fetchone()
                    if row:
                        profile_url = row[0]
                        player_username = row[1] if len(row) > 1 else f"ID {player_db_id}"
                        # Extract user_id from profile URL
                        if "/users/" in profile_url:
                            player_user_id = int(profile_url.split("/users/")[1].split("/")[0])
                    player_conn.close()
                    
                    if not player_user_id:
                        continue
                    
                    # Get player details for booster checks
                    player_data = match_player_details.get(player_user_id, {})
                    if not player_data:
                        # Player didn't play in this match
                        player_data = {
                            "user_id": player_user_id,
                            "maps_played": 0,
                            "scores": [],
                            "team": None
                        }
                    
                    # Skip booster check if player didn't play in this match
                    if player_data.get("maps_played", 0) == 0:
                        log.info(f"  Player {player_username} did not play in match {match_id}, skipping booster check")
                        continue
                    
                    # Check booster activation
                    activated, points = check_booster_activation(
                        booster_id,
                        player_data,
                        match_data,
                        {uid: pscore for uid, (pscore, _, _) in match_pscores.items()}
                    )
                    
                    if activated:
                        log.info(f"  Booster {booster_id} activated for player {player_username} in match {match_id}: +{points} points")
                    else:
                        log.info(f"  Booster {booster_id} NOT activated for player {player_username} in match {match_id}: {points} points")
                    
                    total_booster_points += points
            
            # Get current user score and add booster points
            cursor.execute("SELECT score FROM users WHERE osu_id = ?", (user_osu_id,))
            result = cursor.fetchone()
            current_score = result["score"] if result else 0
            new_score = current_score + total_booster_points
            
            # Update user's score (only adding booster points to existing score)
            cursor.execute(
                "UPDATE users SET score = ?, updated_at = ? WHERE osu_id = ?",
                (int(new_score), datetime.utcnow(), user_osu_id)
            )
            log.info(f"Updated user {user_osu_id} with booster points: +{total_booster_points} (new total: {int(new_score)})")
        
        conn.commit()
        log.info(f"Updated scores for {len(teams)} users with booster bonuses")
        
    except Exception as e:
        log.error(f"Error updating user scores: {e}")
        conn.rollback()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Calculate p_scores for OWC 2025 players")
    parser.add_argument("--matches", nargs="+", type=int, help="Match IDs to process")
    parser.add_argument("--match-file", type=str, help="File containing match IDs (one per line)")
    parser.add_argument("--db", default=DEFAULT_DB, help="Path to SQLite DB file")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(levelname)s: %(message)s"
    )
    
    # Get match IDs
    match_ids = []
    if args.matches:
        match_ids.extend(args.matches)
    if args.match_file:
        with open(args.match_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    try:
                        match_ids.append(int(line))
                    except ValueError:
                        log.warning(f"Invalid match ID: {line}")
    
    if not match_ids:
        log.error("No match IDs provided. Use --matches or --match-file")
        return 1
    
    log.info(f"Processing {len(match_ids)} matches")
    
    # Connect to database
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    add_pscore_columns(conn)
    
    # Get API token
    token = get_app_token(CLIENT_ID, CLIENT_SECRET)
    
    # Fetch and process each match
    all_match_pscores = []
    all_match_data = []
    all_match_details = []
    
    for match_id in match_ids:
        log.info(f"Fetching match {match_id}")
        try:
            match_data = fetch_match(match_id, token)
            match_pscores, match_player_details = calculate_match_pscore_with_details(match_data)
            
            # Debug: Show total maps in lobby
            events = match_data.get("events", [])
            total_maps_in_lobby = sum(1 for e in events if e.get("game"))
            log.info(f"[DEBUG] Match {match_id}: Total maps played in lobby = {total_maps_in_lobby}")
            
            if match_pscores:
                all_match_pscores.append(match_pscores)
                all_match_data.append((match_id, match_data))
                all_match_details.append(match_player_details)
                log.info(f"Calculated p_scores for {len(match_pscores)} players in match {match_id}")
            else:
                log.warning(f"No p_scores calculated for match {match_id}")
        
        except Exception as e:
            log.error(f"Error processing match {match_id}: {e}")
            continue
    
    # Update database with aggregated p_scores
    if all_match_pscores:
        update_player_pscores(conn, all_match_pscores)
        
        # Update user fantasy scores with booster bonuses
        log.info("Calculating user scores with booster bonuses...")
        update_user_scores_with_boosters(all_match_data, all_match_pscores, all_match_details)
    else:
        log.warning("No p_scores calculated from any matches")
    
    conn.close()
    log.info("Done!")
    return 0


if __name__ == "__main__":
    exit(main())
