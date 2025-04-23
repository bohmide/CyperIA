chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkUrls') {
    console.log('Received URLs for check:', message.urls);

    // Dummy phishing detection logic
    const isPhishing = message.urls.some(url => url.includes('paypal') || url.includes('login'));
    sendResponse({ isSafe: !isPhishing });
  }

  return true; // Needed if response is async
});
