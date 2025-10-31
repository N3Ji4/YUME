async checkSingleProxy(proxy) {
    try {
        const response = await fetch('/api/check-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                proxy: proxy.ip + ':' + proxy.port,
                type: proxy.type,
                timeout: 3000 // Timeout lebih pendek untuk speed
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.working) {
            proxy.working = true;
            proxy.speed = result.speed;
            proxy.lastCheck = new Date().toLocaleTimeString();
            this.workingProxies.push(proxy);
            
            this.log(`✅ ${proxy.ip}:${proxy.port} - ${proxy.speed}ms`, 'success');
        } else {
            proxy.working = false;
            proxy.lastCheck = new Date().toLocaleTimeString();
        }

        this.updateTableRow(proxy);
        this.updateStats();
        
    } catch (error) {
        proxy.working = false;
        proxy.lastCheck = new Date().toLocaleTimeString();
        this.updateTableRow(proxy);
        this.updateStats();
    }
}
