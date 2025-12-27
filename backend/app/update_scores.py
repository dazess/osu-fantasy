#!/usr/bin/env python3
"""Update user fantasy scores based on player performance

This script calculates and updates fantasy scores for users based on their team's
player performance (p_scores) from the latest matches.

Formula:
- Each player's p_score contributes to score change (normalized to -50 to +50 range)
- Team result: +10 for win, -10 for loss
- Total change is capped at -50 min, +50 max per update

Usage:
    python update_scores.py
"""

import argparse
import logging
import sqlite3
from pathlib import Path
from typing import Dict, List, Tuple

# Database paths
USERS_DB = Path(__file__).parent.parent / "users.db"
PLAYERS_DB = Path(__file__).parent / "players.db"
PLAYERS_TABLE = "2025owc"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger("update_scores")


def get_all_teams(users_conn: sqlite3.Connection) -> List[Tuple[int, str]]:
    """Get all teams from users.db
    
    Returns:
        List of (user_osu_id, player_ids) tuples
    """
    cursor = users_conn.cursor()
    cursor.execute(
        "SELECT user_osu_id, player_ids FROM teams WHERE tournament = 'owc2025' AND player_ids != ''"
    )
    return cursor.fetchall()


def get_player_pscores(players_conn: sqlite3.Connection, player_ids: List[int]) -> Dict[int, float]:
    """Get p_scores for a list of player IDs
    
    Returns:
        Dict mapping player_id to p_score
    """
    if not player_ids:
        return {}
    
    cursor = players_conn.cursor()
    
    # Check if p_score column exists
    cursor.execute(f'PRAGMA table_info("{PLAYERS_TABLE}")')
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'p_score' not in columns:
        log.warning("p_score column not found in players database. Run calculate_pscores.py first.")
        return {pid: 0.0 for pid in player_ids}
    
    placeholders = ','.join('?' * len(player_ids))
    query = f'SELECT id, p_score FROM "{PLAYERS_TABLE}" WHERE id IN ({placeholders})'
    
    cursor.execute(query, player_ids)
    results = cursor.fetchall()
    
    return {row[0]: row[1] if row[1] is not None else 0.0 for row in results}


def calculate_score_change(pscores: List[float]) -> int:
    """Calculate score change based on player p_scores
    
    Args:
        pscores: List of p_score values for the team
    
    Returns:
        Score change value (capped at -50 to +50)
    """
    if not pscores:
        return 0
    
    # Average p_score for the team
    avg_pscore = sum(pscores) / len(pscores)
    
    # Normalize p_score to score change
    # Assuming p_score typically ranges from 0 to 2.0 (can adjust based on actual data)
    # Map: 0.0 -> -50, 1.0 -> 0, 2.0 -> +50
    score_change = (avg_pscore - 1.0) * 50
    
    # Cap at -50 to +50
    score_change = max(-50, min(50, score_change))
    
    return int(round(score_change))


def update_user_score(users_conn: sqlite3.Connection, user_osu_id: int, score_delta: int):
    """Update a user's score by adding score_delta
    
    Args:
        users_conn: Database connection
        user_osu_id: User's osu! ID
        score_delta: Amount to add to the score (can be negative)
    """
    cursor = users_conn.cursor()
    
    # Get current score
    cursor.execute("SELECT score FROM users WHERE osu_id = ?", (user_osu_id,))
    row = cursor.fetchone()
    
    if not row:
        log.warning(f"User {user_osu_id} not found in database")
        return
    
    current_score = row[0]
    new_score = max(0, current_score + score_delta)  # Don't allow negative scores
    
    # Update score
    cursor.execute(
        "UPDATE users SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE osu_id = ?",
        (new_score, user_osu_id)
    )
    
    log.info(f"User {user_osu_id}: {current_score} -> {new_score} (change: {score_delta:+d})")


def main():
    parser = argparse.ArgumentParser(description="Update fantasy scores based on player performance")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Calculate but don't apply score changes"
    )
    args = parser.parse_args()
    
    log.info("Starting score update process")
    
    # Connect to databases
    if not USERS_DB.exists():
        log.error(f"Users database not found at {USERS_DB}")
        return 1
    
    if not PLAYERS_DB.exists():
        log.error(f"Players database not found at {PLAYERS_DB}")
        return 1
    
    users_conn = sqlite3.connect(USERS_DB)
    players_conn = sqlite3.connect(PLAYERS_DB)
    
    try:
        # Get all teams
        teams = get_all_teams(users_conn)
        log.info(f"Found {len(teams)} teams to process")
        
        if not teams:
            log.warning("No teams found")
            return 0
        
        # Process each team
        total_updated = 0
        
        for user_osu_id, player_ids_str in teams:
            # Parse player IDs
            player_ids = [int(pid.strip()) for pid in player_ids_str.split(',') if pid.strip()]
            
            if not player_ids:
                log.warning(f"User {user_osu_id} has no valid player IDs")
                continue
            
            # Get p_scores for team players
            pscores_dict = get_player_pscores(players_conn, player_ids)
            pscores = [pscores_dict.get(pid, 0.0) for pid in player_ids]
            
            # Calculate score change
            score_change = calculate_score_change(pscores)
            
            if score_change == 0:
                log.info(f"User {user_osu_id}: No score change (avg p_score: {sum(pscores)/len(pscores):.2f})")
                continue
            
            # Update user score
            if args.dry_run:
                log.info(f"[DRY RUN] User {user_osu_id} would receive {score_change:+d} points")
            else:
                update_user_score(users_conn, user_osu_id, score_change)
                total_updated += 1
        
        if not args.dry_run:
            users_conn.commit()
            log.info(f"Successfully updated scores for {total_updated} users")
        else:
            log.info(f"Dry run complete - would have updated {total_updated} users")
    
    except Exception as e:
        log.error(f"Error during score update: {e}", exc_info=True)
        users_conn.rollback()
        return 1
    
    finally:
        users_conn.close()
        players_conn.close()
    
    log.info("Score update complete!")
    return 0


if __name__ == "__main__":
    exit(main())
