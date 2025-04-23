// background.js
let analysisResults = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch(message.action) {
        case "updateResults":
            analysisResults = message.results;
            break;
        case "getResults":
            sendResponse({ results: analysisResults });
            break;
    }
    return true;
});