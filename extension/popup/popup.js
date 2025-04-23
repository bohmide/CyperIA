// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const urlList = document.getElementById('urlList');
    const statusElement = document.getElementById('status');

    function updateUI(results) {
        urlList.innerHTML = '';
        
        if (results.length === 0) {
            urlList.innerHTML = '<div class="loading">No URLs analyzed yet</div>';
            statusElement.textContent = "Ready";
            return;
        }

        results.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'url-item';
            
            const icon = document.createElement('span');
            icon.className = `url-icon ${entry.isPhishing ? 'phishing' : 'safe'}`;
            icon.textContent = entry.isPhishing ? '⚠️' : '✅';
            
            const url = document.createElement('span');
            url.className = 'url-text';
            url.textContent = entry.url;
            
            if (entry.source) {
                const source = document.createElement('div');
                source.style.fontSize = '10px';
                source.style.color = '#666';
                source.textContent = entry.source;
                div.appendChild(source);
            }

            div.appendChild(icon);
            div.appendChild(url);
            urlList.appendChild(div);
        });

        statusElement.textContent = `Found ${results.length} URLs - ${new Date().toLocaleTimeString()}`;
    }

    // Get initial results
    chrome.runtime.sendMessage({ action: "getResults" }, response => {
        updateUI(response.results || []);
    });

    // Listen for real-time updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updateResults") {
            updateUI(message.results);
        }
    });
});