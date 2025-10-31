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

        // First check if response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get response as text first to debug
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
        }
        
        if (data.success) {
            this.proxies = data.proxies;
            this.updateTable();
            this.updateStats();
            this.log(`✅ ${data.message || `Berhasil scrape ${data.proxies.length} proxy`}`, 'success');
        } else {
            throw new Error(data.error || data.message || 'Unknown error');
        }
    } catch (error) {
        console.error('Scrape error:', error);
        this.log(`❌ Gagal scrape proxy: ${error.message}`, 'error');
    } finally {
        this.showLoading(false);
    }
}
