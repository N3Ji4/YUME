class ProxyHub {
    constructor() {
        this.proxies = [];
        this.workingProxies = [];
        this.isChecking = false;
        this.currentCheckId = null;
        this.initializeEventListeners();
        this.updateStats();
    }

    initializeEventListeners() {
        document.getElementById('scrapeBtn').addEventListener('click', () => this.scrapeProxies());
        document.getElementById('checkBtn').addEventListener('click', () => this.checkAllProxies());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadWorkingProxies());
        document.getElementById('clearLog').addEventListener('click', () => this.clearLog());
        document.getElementById('selectAll').addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
    }

    async scrapeProxies() {
        this.showLoading(true);
        this.log('🚀 Memulai scraping proxy dari berbagai sumber...', 'info');
        
        try {
            const response = await fetch('/api/scrape-proxies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: document.getElementById('proxyType').value,
                    country: document.getElementById('country').value,
                    timeout: parseInt(document.getElementById('timeout').value)
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.proxies = data.proxies;
                this.updateTable();
                this.updateStats();
                this.log(`✅ Berhasil scrape ${data.proxies.length} proxy`, 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.log(`❌ Gagal scrape proxy: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async checkAllProxies() {
        if (this.isChecking) {
            this.stopChecking();
            return;
        }

        if (this.proxies.length === 0) {
            this.log('⚠️ Tidak ada proxy untuk di-check. Scrape proxy terlebih dahulu.', 'warning');
            return;
        }

        this.isChecking = true;
        this.workingProxies = [];
        this.currentCheckId = Date.now();
        const checkId = this.currentCheckId;

        document.getElementById('checkBtn').innerHTML = '<i class="fas fa-stop"></i> Stop Check';
        document.getElementById('checkBtn').classList.add('btn-danger');

        this.log('🔍 Memulai pengecekan semua proxy...', 'info');

        const totalProxies = this.proxies.length;
        let checkedCount = 0;

        // Check proxies in batches for better performance
        const batchSize = 10;
        for (let i = 0; i < totalProxies; i += batchSize) {
            if (this.currentCheckId !== checkId) break;

            const batch = this.proxies.slice(i, i + batchSize);
            const checkPromises = batch.map(proxy => this.checkSingleProxy(proxy));

            await Promise.allSettled(checkPromises);
            checkedCount += batch.length;

            // Update progress
            const progress = (checkedCount / totalProxies) * 100;
            this.updateProgress(progress, `Checking... ${checkedCount}/${totalProxies}`);

            // Small delay to avoid overwhelming
            await this.delay(100);
        }

        if (this.currentCheckId === checkId) {
            this.isChecking = false;
            document.getElementById('checkBtn').innerHTML = '<i class="fas fa-check"></i> Check All';
            document.getElementById('checkBtn').classList.remove('btn-danger');
            
            this.log(`✅ Pengecekan selesai! ${this.workingProxies.length} proxy bekerja ditemukan`, 'success');
            this.updateProgress(100, 'Checking completed!');
            this.updateStats();
        }
    }

    stopChecking() {
        this.currentCheckId = null;
        this.isChecking = false;
        document.getElementById('checkBtn').innerHTML = '<i class="fas fa-check"></i> Check All';
        document.getElementById('checkBtn').classList.remove('btn-danger');
        this.log('⏹️ Pengecekan dihentikan oleh user', 'warning');
    }

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
                    timeout: parseInt(document.getElementById('timeout').value)
                })
            });

            const result = await response.json();
            
            if (result.working) {
                proxy.working = true;
                proxy.speed = result.speed;
                proxy.lastCheck = new Date().toLocaleTimeString();
                this.workingProxies.push(proxy);
                
                this.log(`✅ ${proxy.ip}:${proxy.port} (${proxy.type}) - ${proxy.speed}ms`, 'success');
            } else {
                proxy.working = false;
                proxy.lastCheck = new Date().toLocaleTimeString();
            }

            this.updateTableRow(proxy);
        } catch (error) {
            proxy.working = false;
            proxy.lastCheck = new Date().toLocaleTimeString();
            this.updateTableRow(proxy);
        }
    }

    updateTable() {
        const tbody = document.getElementById('proxyTableBody');
        tbody.innerHTML = '';

        this.proxies.forEach(proxy => {
            const row = this.createTableRow(proxy);
            tbody.appendChild(row);
        });
    }

    updateTableRow(proxy) {
        const row = document.querySelector(`[data-proxy="${proxy.ip}:${proxy.port}"]`);
        if (row) {
            row.innerHTML = this.createTableRow(proxy).innerHTML;
        }
    }

    createTableRow(proxy) {
        const row = document.createElement('tr');
        row.setAttribute('data-proxy', `${proxy.ip}:${proxy.port}`);

        const speedClass = proxy.speed < 500 ? 'speed-fast' : 
                          proxy.speed < 2000 ? 'speed-medium' : 'speed-slow';

        row.innerHTML = `
            <td><input type="checkbox" class="proxy-checkbox" data-proxy="${proxy.ip}:${proxy.port}"></td>
            <td>${proxy.ip}</td>
            <td>${proxy.port}</td>
            <td>${proxy.type.toUpperCase()}</td>
            <td>${proxy.country || 'Unknown'}</td>
            <td class="${speedClass}">${proxy.speed ? proxy.speed + 'ms' : '-'}</td>
            <td class="${proxy.working ? 'status-working' : 'status-failed'}">
                ${proxy.working ? '🟢 Working' : '🔴 Failed'}
            </td>
            <td>${proxy.lastCheck || '-'}</td>
        `;

        return row;
    }

    updateStats() {
        const total = this.proxies.length;
        const working = this.workingProxies.length;
        const successRate = total > 0 ? ((working / total) * 100).toFixed(1) : 0;
        
        const avgSpeed = working > 0 ? 
            Math.round(this.workingProxies.reduce((sum, p) => sum + p.speed, 0) / working) : 0;

        document.getElementById('totalProxies').textContent = total;
        document.getElementById('workingProxies').textContent = working;
        document.getElementById('successRate').textContent = successRate + '%';
        document.getElementById('avgSpeed').textContent = avgSpeed + 'ms';
    }

    updateProgress(percent, text) {
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressText').textContent = text;
    }

    downloadWorkingProxies() {
        if (this.workingProxies.length === 0) {
            this.log('⚠️ Tidak ada working proxy untuk didownload', 'warning');
            return;
        }

        const content = this.workingProxies.map(proxy => 
            `${proxy.type}://${proxy.ip}:${proxy.port}`
        ).join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `working-proxies-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.log(`💾 Downloaded ${this.workingProxies.length} working proxies`, 'success');
    }

    toggleSelectAll(checked) {
        const checkboxes = document.querySelectorAll('.proxy-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    log(message, type = 'info') {
        const console = document.getElementById('console');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        console.appendChild(logEntry);
        console.scrollTop = console.scrollHeight;
    }

    clearLog() {
        document.getElementById('console').innerHTML = '';
        this.log('🗑️ Log cleared', 'info');
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ProxyHub();
});

// Add btn-danger class to CSS
const style = document.createElement('style');
style.textContent = `
    .btn-danger {
        background: #ef4444 !important;
        color: white !important;
    }
`;
document.head.appendChild(style);