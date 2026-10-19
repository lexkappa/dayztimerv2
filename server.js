const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Hilfsfunktion: Server-seitiger Abruf der BattleMetrics API (Ohne Browser-CORS!)
async function fetchFromBattleMetrics() {
    const urls = [
        // 1. Suche nach Server 0736 + IP 31.214.224.73
        'https://api.battlemetrics.com/servers?filter%5Bgame%5D=dayz&filter%5Bsearch%5D=0736&page%5Bsize%5D=25',
        // 2. Direkte Suche über die IP des Servers
        'https://api.battlemetrics.com/servers?filter%5Bgame%5D=dayz&filter%5Bsearch%5D=31.214.224.73&page%5Bsize%5D=10'
    ];

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'DayZ-0736-Tracker/2.0 (Render-Backend)'
                }
            });

            if (!response.ok) continue;

            const json = await response.json();
            if (!json || !Array.isArray(json.data) || json.data.length === 0) continue;

            // Finde exakt den 0736 Server (oder IP 31.214.224.73)
            const match = json.data.find(s => {
                const attr = s.attributes || {};
                const name = String(attr.name || '').toLowerCase();
                return attr.ip === '31.214.224.73' || name.includes('0736');
            }) || json.data[0];

            const attr = match.attributes || {};
            const details = attr.details || {};

            return {
                success: true,
                source: 'BattleMetrics-Server-To-Server',
                id: match.id,
                name: attr.name || 'DayZ Official 0736 | EUROPE - DE | 1st Person Only',
                ip: attr.ip || '31.214.224.73',
                port: attr.port || 10400,
                players: typeof attr.players === 'number' ? attr.players : 0,
                maxPlayers: typeof attr.maxPlayers === 'number' ? attr.maxPlayers : 60,
                status: attr.status || 'online',
                map: details.map || 'chernarusplus',
                rawTime: details.time || null,
                updatedAt: attr.updatedAt || new Date().toISOString(),
                raw: details
            };
        } catch (err) {
            console.error('BM Versuch fehlgeschlagen:', err.message);
        }
    }

    throw new Error('BattleMetrics hat keine Daten für 0736 geliefert.');
}

// Haupt-Endpunkt für deine WebApp
app.get('/api/dayz-time', async (req, res) => {
    try {
        console.log('Frage Live-Daten für DayZ 0736 über Server-Backend ab...');
        const data = await fetchFromBattleMetrics();
        res.json(data);
    } catch (error) {
        console.error('Fehler beim Abruf:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Status-Check auf der Startseite
app.get('/', (req, res) => {
    res.send('DayZ 0736 Live-Proxy ist online! Endpunkt: /api/dayz-time');
});

app.listen(PORT, () => {
    console.log(`DayZ Proxy-Schnittstelle läuft auf Port ${PORT}`);
});
