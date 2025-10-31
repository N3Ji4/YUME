const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Proxy sources
const PROXY_SOURCES = {
    http: [
        "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all",
        "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt",
        "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt"
    ],
    https: [
        "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all",
        "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-https.txt"
    ],
    socks4: [
        "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=5000&country=all&ssl=all&anonymity=all",
        "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt"
    ],
    socks5: [
        "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=5000&country=all&ssl=all&anonymity=all",
        "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt"
    ]
};

// API Routes
app.post('/api/scrape-proxies', async (req, res) => {
    try {
        const { type, country, timeout } = req.body;
        const proxies = [];

        const sources = type === 'all' ? 
            [...PROXY_SOURCES.http, ...PROXY_SOURCES.https, ...PROXY_SOURCES.socks4, ...PROXY_SOURCES.socks5] :
            PROXY_SOURCES[type] || [];

        for (const source of sources) {
            try {
                const response = await axios.get(source, { timeout: 10000 });
                const lines = response.data.split('\n');
                
                for (const line of lines) {
                    const proxy = parseProxyLine(line.trim());
                    if (proxy && (country === 'all' || !proxy.country || proxy.country === country)) {
                        proxies.push(proxy);
                    }
                }
            } catch (error) {
                console.log(`Failed to fetch from ${source}:`, error.message);
            }
        }

        // Remove duplicates
        const uniqueProxies = Array.from(new Set(proxies.map(p => `${p.ip}:${p.port}:${p.type}`)))
            .map(str => {
                const [ip, port, type] = str.split(':');
                return { ip, port: parseInt(port), type };
            });

        res.json({
            success: true,
            proxies: uniqueProxies,
            count: uniqueProxies.length
        });

    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/check-proxy', async (req, res) => {
    try {
        const { proxy, type, timeout } = req.body;
        const [ip, port] = proxy.split(':');
        
        const testUrls = [
            'http://httpbin.org/ip',
            'http://api.ipify.org?format=json',
            'https://api.myip.com'
        ];

        const startTime = Date.now();
        let success = false;
        let speed = null;

        for (const testUrl of testUrls) {
            try {
                const config = {
                    timeout: timeout || 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                };

                if (type === 'socks4' || type === 'socks5') {
                    config.httpsAgent = new SocksProxyAgent(`${type}://${ip}:${port}`);
                    config.httpAgent = new SocksProxyAgent(`${type}://${ip}:${port}`);
                } else {
                    config.httpsAgent = new HttpsProxyAgent(`${type}://${ip}:${port}`);
                    config.httpAgent = new HttpsProxyAgent(`${type}://${ip}:${port}`);
                }

                const response = await axios.get(testUrl, config);
                
                if (response.status === 200) {
                    success = true;
                    speed = Date.now() - startTime;
                    break;
                }
            } catch (error) {
                continue;
            }
        }

        res.json({
            working: success,
            speed: speed,
            proxy: proxy,
            type: type
        });

    } catch (error) {
        res.json({
            working: false,
            error: error.message
        });
    }
});

function parseProxyLine(line) {
    if (!line || line.startsWith('#')) return null;
    
    // Handle different proxy formats
    const formats = [
        /^(\d+\.\d+\.\d+\.\d+):(\d+)$/, // ip:port
        /^(\d+\.\d+\.\d+\.\d+)\s+(\d+)$/, // ip port
        /^(\w+):\/\/(\d+\.\d+\.\d+\.\d+):(\d+)$/ // protocol://ip:port
    ];

    for (const format of formats) {
        const match = line.match(format);
        if (match) {
            let ip, port, type = 'http';
            
            if (match.length === 3) {
                [, ip, port] = match;
            } else if (match.length === 4) {
                [, type, ip, port] = match;
            }
            
            return {
                ip: ip.trim(),
                port: parseInt(port),
                type: type.toLowerCase()
            };
        }
    }
    
    return null;
}

app.listen(PORT, () => {
    console.log(`🚀 Proxy Hub Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/index.html`);
});