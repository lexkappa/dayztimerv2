const express = require('express');
const { GameDig } = require('gamedig');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors());

const SERVER_IP = '31.214.224.73';
// Offizielle DayZ Server nutzen Port 27016 (oder 10400) für Steam A2S Queries
const QUERY_PORTS = [27016, 10400, 2303, 27015];

app.get('/api/dayz-time', async (req, res) => {
    // 1. Server-seitige BattleMetrics-Abfrage (Auf Render gibt es KEINE Browser-CORS-Sperre!)
    try {
        const bmUrl = 'https://api.battlemetrics.com/servers?filter%5Bgame%5D=dayz&filter%5Bsearch%5D=31.214.224.73';
        const bmRes = await fetch(bmUrl, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'DayZ0736Tracker/2.0' }
        });
        if (bmRes.ok) {
            const bmJson = await bmRes.json();
            const srv = bmJson.data && bmJson.data[0];
            if (srv && srv.attributes) {
                const a = srv.attributes;
                const d = a.details || {};
                return res.json({
                    success: true,
                    source: 'BattleMetrics-Server-Side',
                    name: a.name,
                    map: d.map || 'chernarusplus',
                    players: a.players,
                    maxPlayers: a.maxPlayers,
                    ping: 24,
                    rawTime: d.time || null,
                    updatedAt: a.updatedAt,
                    connect: `${a.ip}:${a.port}`,
                    raw: d
                });
            }
        }
    } catch (bmErr) {
        console.warn('BattleMetrics Fallback Hinweis:', bmErr.message);
    }

    // 2. Fallback: Direkte UDP A2S Query über alle typischen DayZ Query-Ports
    let lastErr = null;
    for (const port of QUERY_PORTS) {
        try {
            const state = await GameDig.query({
                type: 'dayz',
                host: SERVER_IP,
                port: port,
                givenPortOnly: true,
                maxAttempts: 2,
                socketTimeout: 3000
            });
            const rawTime = state.raw && (state.raw.time || state.raw.gameTime || (state.raw.rules && state.raw.rules.time));
            return res.json({
                success: true,
                source: `UDP-A2S-Port-${port}`,
                name: state.name,
                map: state.map,
                players: state.players ? state.players.length : 0,
                maxPlayers: state.maxplayers,
                ping: state.ping,
                rawTime: rawTime || null,
                connect: state.connect,
                raw: state.raw
            });
        } catch (udpErr) {
            lastErr = udpErr;
        }
    }

    res.status(500).json({
        success: false,
        error: lastErr ? lastErr.message : 'Keine Antwort auf UDP/BM'
    });
});

app.listen(PORT, () => console.log(`DayZ Hybrid-Proxy läuft auf Port ${PORT}`));
