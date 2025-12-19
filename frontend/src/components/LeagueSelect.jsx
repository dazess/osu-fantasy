import react from 'react';
import item from './ui/item';
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const LeagueSelect = () => {
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
    useEffect(() => {
    const fetchLeagues = async () => {
        try {
        const response = await axios.get(`${API_BASE_URL}/leagues`);
        setLeagues(response.data);
        } catch (error) {
        console.error('Error fetching leagues:', error);
        }
    };

    fetchLeagues();
    }, []);     
    const handleLeagueChange = (e) => {
    const leagueId = e.target.value;
    const league = leagues.find(l => l.id === parseInt(leagueId));
    setSelectedLeague(league);
    console.log('Selected league:', league);
  };

  return (      
    <div style={{ marginTop: '20px' }}>
      <label htmlFor="league-select" style={{ marginRight: '10px' }}>Select League:</label>
      <select id="league-select" onChange={handleLeagueChange} style={{ padding: '5px', borderRadius: '4px' }}>     
        <option value="">--Choose a league--</option>
        {leagues.map(league => (
          <option key={league.id} value={league.id}>{league.name}</option>
        ))}
        </select>  
        {selectedLeague && (
        <div style={{ marginTop: '10px' }}>
          <h3>League Details:</h3>
          <p><strong>Name:</strong> {selectedLeague.name}</p>
            <p><strong>Description:</strong> {selectedLeague.description}</p>
        </div>
        )}
    </div>
    );
};
export default LeagueSelect;