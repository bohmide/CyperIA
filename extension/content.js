// Extract URLs from both <a> tags and plain text in the email body
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

// Add indicator next to each URL to show phishing status
function addIndicator(linkElement, isPhishing) {
    
    const indicator = document.createElement("span");
    indicator.textContent = isPhishing ? "⚠️" : "✅";
    indicator.style.marginLeft = "6px";
    indicator.style.fontSize = "14px";
    indicator.style.color = isPhishing ? "red" : "green";
    indicator.title = isPhishing ? "Phishing link detected!" : "Safe link";

    linkElement.parentNode.insertBefore(indicator, linkElement.nextSibling);
}

// Add an icon next to the sender's name indicating whether the sender is safe
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

// Check URL via Flask server
function checkURL(linkElement, url) {
    fetch("http://localhost:5000/predict", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: url })
    })
    .then(response => response.json())
    .then(data => {
        console.log("Checked URL:", url, "→", data);
        addIndicator(linkElement, data.is_phishing);  // Add phishing indicator based on response
    })
    .catch(error => {
        console.error("Failed to check URL:", url, error);
    });
}

// Process and scan links only inside the email body
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

    console.log("URLs found:", urls);
    return urls;
}

// Get sender information and check if the sender is safe
function checkSender() {
    const senderSpan = document.querySelector('.gD, [data-testid="sender-name"]');
    if (!senderSpan) return;

    const senderEmail = senderSpan.getAttribute('email') || senderSpan.getAttribute('name');
    console.log('Sender Email:', senderEmail);

    // Extract URLs related to the sender's email
    const senderUrls = extractURLsFromBody(document.body);
    let isSafe = true;

    // Check each URL related to the sender
    senderUrls.forEach(url => {
        fetch("http://localhost:5000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: url })
        })
        .then(response => response.json())
        .then(data => {
            if (data.is_phishing) {
                isSafe = false;
            }
            // Once we have checked all URLs, update the sender's icon
            addSenderIcon(isSafe);
        })
        .catch(error => {
            console.error("Failed to check sender URL:", url, error);
        });
    });
}

// Main function to start checking only the body content
async function main() {
    // Wait for Gmail to fully load and get the email body
    const emailBodyDiv = await waitForEmailBody();

    if (emailBodyDiv) {
        console.log('✅ Email body loaded. Monitoring content for phishing links...');
        processEmailLinks();
        checkSender();  // Check sender safety based on URLs
    }

    // Periodically check for new content in the email body
    setInterval(() => {
        processEmailLinks();
        checkSender();  // Periodically check sender safety as well
    }, 5000); // every 5 seconds, adjust as needed
}

// Wait until the email body is available (wait for Gmail to load the content)
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
