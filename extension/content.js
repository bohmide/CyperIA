let analyzedUrls = [];

function extractURLsFromBody(container) {
    const urls = new Set();

    // Extract URLs from <a> tags
    const links = container.querySelectorAll('a[href]');
    links.forEach(link => urls.add(link.href));

    // Extract URLs from plain text (regex search for URLs)
    const text = container.innerText;
    const regex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(regex);
    if (matches) matches.forEach(url => urls.add(url));

    return Array.from(urls);
}

function addIndicator(linkElement, isPhishing) {
    const indicator = document.createElement("span");
    indicator.textContent = isPhishing ? "⚠️" : "✅";
    indicator.style.marginLeft = "6px";
    indicator.style.fontSize = "14px";
    indicator.style.color = isPhishing ? "red" : "green";
    indicator.title = isPhishing ? "Phishing link detected!" : "Safe link";

    linkElement.parentNode.insertBefore(indicator, linkElement.nextSibling);
}

function addSenderIcon(isSafe) {
    const senderSpan = document.querySelector('.gD, [data-testid="sender-name"]');
    
    if (senderSpan && !senderSpan.classList.contains('sender-processed')) {
        senderSpan.classList.add('sender-processed');

        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL(isSafe ? 'icons/icon_green.png' : 'icons/icon_red.png');
        icon.className = 'sender-verification-icon';
        icon.style.width = '16px';
        icon.style.marginRight = '4px';
        icon.style.verticalAlign = 'middle';

        senderSpan.parentNode.insertBefore(icon, senderSpan);
    }
}

function checkURL(linkElement, url) {
    if (analyzedUrls.some(entry => entry.url === url)) return;

    analyzedUrls.push({
        url: url,
        isPhishing: null,
        element: linkElement,
        timestamp: Date.now()
    });

    fetch("http://localhost:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url })
    })
    .then(response => response.json())
    .then(data => {
        const entry = analyzedUrls.find(entry => entry.url === url);
        if (entry) {
            entry.isPhishing = data.is_phishing;
            addIndicator(entry.element, data.is_phishing);
            const allAnalyzed = analyzedUrls.filter(e => e.isPhishing !== null);
            chrome.runtime.sendMessage({
                action: "updateResults",
                results: allAnalyzed
            });
            const hasPhishing = allAnalyzed.some(e => e.isPhishing);
            addSenderIcon(!hasPhishing);
        }
    })
    .catch(error => {
        console.error("Failed to check URL:", url, error);
        analyzedUrls = analyzedUrls.filter(entry => entry.url !== url);
    });
}

function processEmailLinks() {
    const emailBodyDiv = document.querySelector('div.a3s, div.a3s.aiL');  // Email body container
    if (!emailBodyDiv) return;

    const urls = extractURLsFromBody(emailBodyDiv);
    const links = emailBodyDiv.querySelectorAll('a[href]');
    links.forEach(link => {
        const url = link.href;
        if (url && !link.dataset.checked) {
            link.dataset.checked = "true"; // prevent duplicate checks
            checkURL(link, url);
        }
    });

    return urls;
}

function checkSender() {
    const senderSpan = document.querySelector('.gD, [data-testid="sender-name"]');
    if (!senderSpan) return;

    const senderEmail = senderSpan.getAttribute('email') || senderSpan.getAttribute('name');
    const senderUrls = extractURLsFromBody(document.body);

    senderUrls.forEach(url => {
        if (analyzedUrls.some(entry => entry.url === url)) return;

        analyzedUrls.push({
            url: url,
            isPhishing: null,
            source: `Sender: ${senderEmail}`,
            timestamp: Date.now()
        });

        fetch("http://localhost:5000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url })
        })
        .then(response => response.json())
        .then(data => {
            const entry = analyzedUrls.find(entry => entry.url === url);
            if (entry) {
                entry.isPhishing = data.is_phishing;
                const allAnalyzed = analyzedUrls.filter(e => e.isPhishing !== null);
                chrome.runtime.sendMessage({
                    action: "updateResults",
                    results: allAnalyzed
                });
                const hasPhishing = allAnalyzed.some(e => e.isPhishing);
                addSenderIcon(!hasPhishing);
            }
        })
        .catch(error => {
            console.error("Failed to check sender URL:", url, error);
            analyzedUrls = analyzedUrls.filter(entry => entry.url !== url);
        });
    });
}

async function main() {
    const emailBodyDiv = await waitForEmailBody();
    if (emailBodyDiv) {
        processEmailLinks();
        checkSender();  // Check sender safety based on URLs
    }

    setInterval(() => {
        processEmailLinks();
        checkSender();  // Periodically check sender safety as well
    }, 5000); // every 5 seconds, adjust as needed
}

function waitForEmailBody() {
    return new Promise(resolve => {
        const observer = new MutationObserver(() => {
            const emailBodyDiv = document.querySelector('div.a3s, div.a3s.aiL');  // Only email body
            if (emailBodyDiv) {
                observer.disconnect();
                resolve(emailBodyDiv);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

main();
