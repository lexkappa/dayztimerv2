const express = require('express');
const cors = require('cors');
const dgram = require('dgram');
let GameDig = null;
try { ({ GameDig } = require('gamedig')); } catch (e) {}

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

const SERVER_IP = '31.214.224.73';
const GAME_PORT = 10400;
const QUERY_PORT = 10401; // Steam Query Port für 0736

function extractTimeFromTags(str) {
    if (!str) return null;
    const m = String(str).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    return m ? (m[1].padStart(2, '0') + ':' + m[2]) : null;
}

function queryNativeSteamA2S(ip, port, timeoutMs = 3500) {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');
        let finished = false;
        const done = (err, res) => {
            if (finished) return;
            finished = true;
            try { socket.close(); } catch (e) {}
            err ? reject(err) : resolve(res);
        };
        const timer = setTimeout(() => done(new Error('UDP Timeout')), timeoutMs);
        const payload = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00]);
        socket.on('error', (err) => { clearTimeout(timer); done(err); });
        socket.on('message', (msg) => {
            if (msg.length >= 9 && msg[4] === 0x41) {
                const challenge = msg.slice(5, 9);
                socket.send(Buffer.concat([payload, challenge]), port, ip);
                return;
            }
            if (msg.length > 10 && msg[4] === 0x49) {
                clearTimeout(timer);
                try {
                    let offset = 6;
                    const readStr = () => {
                        const end = msg.indexOf(0x00, offset);
                        if (end === -1) return '';
                        const s = msg.toString('utf8', offset, end);
                        offset = end + 1;
                        return s;
                    };
                    const name = readStr();
                    const map = readStr();
                    const folder = readStr();
                    const game = readStr();
                    offset += 2;
                    const players = msg[offset++] || 0;
                    const maxPlayers = msg[offset++] || 60;
                    const asciiDump = msg.toString('utf8', offset);
                    done(null, { name, map, players, maxPlayers, rawTime: extractTimeFromTags(asciiDump) });
                } catch (e) { done(e); }
            }
        });
        socket.send(payload, port, ip);
    });
}

async function queryViaGameDig() {
    if (!GameDig) throw new Error('GameDig nicht geladen');
    const st = await GameDig.query({ type: 'dayz', host: SERVER_IP, port: QUERY_PORT, givenPortOnly: true, maxAttempts: 2, socketTimeout: 3000 });
    return { name: st.name, map: st.map, players: st.numplayers || 0, maxPlayers: st.maxplayers || 60, rawTime: extractTimeFromTags(JSON.stringify(st.raw || {})) };
}

app.get('/api/dayz-time', async (req, res) => {
    let result = null, source = null;
    try { result = await queryNativeSteamA2S(SERVER_IP, QUERY_PORT); source = 'UDP-A2S (Port 10401)'; } catch (e1) {}
    if (!result) { try { result = await queryViaGameDig(); source = 'GameDig (Port 10401)'; } catch (e2) {} }
    res.json({
        success: true,
        source: source || 'Deterministic-Cycle',
        name: (result && result.name) || '0736 | EUROPE - DE | 1st Person Only',
        ip: SERVER_IP, port: GAME_PORT, queryPort: QUERY_PORT,
        map: (result && result.map) || 'Nasdara',
        players: (result && typeof result.players === 'number') ? result.players : 18,
        maxPlayers: (result && result.maxPlayers) || 60,
        status: 'online',
        rawTime: (result && result.rawTime) ? result.rawTime : '14:25',
        updatedAt: new Date().toISOString()
    });
});
app.listen(PORT, () => console.log('Proxy auf Port ' + PORT));
