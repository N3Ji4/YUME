const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware SIMPLE
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Sumber proxy YANG PASTI BERHASIL
const PROXY_SOURCES = [
    "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
    "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt",
    "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt",
    "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt",
    "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt",
    "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt"
];

// API Scrape Proxy
app.post('/api/scrape-proxies', async (req, res) => {
    console.log('🔍 Scraping proxies...');
    
    try {
        const allProxies = [];

        for (const source of PROXY_SOURCES) {
            try {
                console.log(`📡 Fetching: ${source}`);
                const response = await axios.get(source, { 
                    timeout: 8000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                const lines = response.data.split('\n');
                let count = 0;
                
                for (const line of lines) {
                    const proxy = parseProxyLine(line);
                    if (proxy) {
                        allProxies.push(proxy);
                        count++;
                    }
                }
                
                console.log(`✅ ${source}: ${count} proxies`);
                
            } catch (error) {
                console.log(`❌ Skip ${source}: ${error.message}`);
                continue;
            }
        }

        // Remove duplicates - SIMPLE
        const uniqueProxies = [];
        const seen = new Set();
        
        for (const proxy of allProxies) {
            const key = `${proxy.ip}:${proxy.port}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueProxies.push(proxy);
            }
        }

        console.log(`🎯 Total unique: ${uniqueProxies.length}`);

        res.json({
            success: true,
            proxies: uniqueProxies,
            count: uniqueProxies.length
        });

    } catch (error) {
        console.error('💥 Error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// API Check Proxy - SIMPLE VERSION
app.post('/api/check-proxy', async (req, res) => {
    const { proxy, type = 'http', timeout = 5000 } = req.body;
    
    console.log(`🔧 Checking: ${proxy} (${type})`);
    
    try {
        const [ip, port] = proxy.split(':');
        const testUrl = 'https://httpbin.org/ip';
        
        const startTime = Date.now();
        
        // Simple check tanpa agent kompleks
        const response = await axios.get(testUrl, {
            timeout: parseInt(timeout),
            proxy: {
                protocol: type,
                host: ip,
                port: parseInt(port)
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const speed = Date.now() - startTime;
        
        if (response.status === 200) {
            console.log(`✅ ${proxy} WORKING - ${speed}ms`);
            res.json({
                working: true,
                speed: speed,
                proxy: proxy,
                type: type
            });
        } else {
            res.json({
                working: false,
                error: `Status: ${response.status}`
            });
        }
        
    } catch (error) {
        console.log(`❌ ${proxy} FAILED: ${error.message}`);
        res.json({
            working: false,
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Local Proxy Hub is running!',
        timestamp: new Date().toISOString()
    });
});

// Helper function
function parseProxyLine(line) {
    if (!line || line.startsWith('#') || line === '') return null;
    
    line = line.trim().replace(/\r/g, '');
    
    // Format: ip:port
    const match = line.match(/^(\d+\.\d+\.\d+\.\d+):(\d+)$/);
    if (match) {
        const [, ip, port] = match;
        const portNum = parseInt(port);
        
        if (portNum >= 1 && portNum <= 65535) {
            return {
                ip: ip,
                port: portNum,
                type: 'http', // Default type
                country: 'Unknown',
                working: false,
                speed: null,
                lastCheck: null
            };
        }
    }
    
    return null;
}

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 LOCAL PROXY HUB BERJALAN!');
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`📍 Network: http://${getIPAddress()}:${PORT}`);
    console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
});

function getIPAddress() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}