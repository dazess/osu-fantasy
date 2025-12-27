# Update Scores Script

This script updates fantasy scores for users based on their team's player performance.

## Usage

### Prerequisites

1. First, run `calculate_pscores.py` to calculate player performance scores:
   ```bash
   cd backend/app
   python calculate_pscores.py --match-file match_ids.txt
   ```

2. Then run this script to update user scores:
   ```bash
   python update_scores.py
   ```

### Options

- `--dry-run`: Calculate but don't apply score changes (for testing)

Example:
```bash
python update_scores.py --dry-run
```

## How It Works

1. Reads all teams from `users.db` (teams table)
2. Gets p_score for each player in the team from `players.db`
3. Calculates score change based on average team p_score:
   - p_score of 0.0 → -50 points
   - p_score of 1.0 → 0 points (baseline)
   - p_score of 2.0 → +50 points
   - Linear interpolation between these values
4. Updates user's total score in `users.db`
5. Scores cannot go below 0

## Formula

```
avg_pscore = sum(player_pscores) / num_players
score_change = (avg_pscore - 1.0) * 50
score_change = clamp(score_change, -50, 50)
new_score = max(0, current_score + score_change)
```

## Typical Workflow

```bash
# 1. Calculate player performance scores from match data
python calculate_pscores.py --matches 119719487 119959585

# 2. Update user fantasy scores based on performance
python update_scores.py

# Or test first:
python update_scores.py --dry-run
```

## Database Requirements

- `backend/users.db`: Contains `users` and `teams` tables
- `backend/app/players.db`: Contains `2025owc` table with p_score column

The p_score column is automatically added by `calculate_pscores.py`.
