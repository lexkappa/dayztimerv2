const express = require('express');
const { GameDig } = require('gamedig');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Erlaube Anfragen von überall (CORS für deine WebApp)
app.use(cors());

// DayZ Official 0736 Server Daten
// IP: 31.214.224.73 | Standard DayZ Query Port ist meist Game-Port + 1000 oder 27016/etc.
// GameDig findet den Query-Port für offizielle Server in der Regel automatisch über die IP.
const SERVER_IP = '31.214.224.73';

app.get('/api/dayz-time', async (req, res) => {
    try {
        console.log(`Frage DayZ Server ${SERVER_IP} per UDP ab...`);
        
        const state = await GameDig.query({
            type: 'dayz',
            host: SERVER_IP,
            maxAttempts: 3
        });

        // Suche in den Server-Rules / Details nach der In-Game-Zeit (falls vom Server bereitgestellt)
        // Hinweis: Nicht jeder DayZ-Community/Official-Server gibt die Uhrzeit über A2S_RULES preis, 
        // weshalb die WebApp zusätzlich mit unserem deterministischen Algorithmus hybrid arbeitet.
        const rawTime = state.raw && (state.raw.time || state.raw.gameTime || state.raw.rules?.time);

        res.json({
            success: true,
            name: state.name,
            map: state.map,
            players: state.players.length,
            maxPlayers: state.maxplayers,
            ping: state.ping,
            rawTime: rawTime || null,
            connect: state.connect,
            raw: state.raw
        });

    } class (error) {
        console.error("Fehler bei der UDP-Abfrage:", error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`DayZ Proxy-Schnittstelle läuft auf Port ${PORT}`);
});