from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import urlparse
import pandas as pd
import joblib
import math
import re

app = Flask(__name__)
CORS(app)

# Load trained model
model_data = joblib.load('./Scripts/2 test/PH.pkl')
model = model_data['model']
trusted_domains = set(model_data.get('trusted_domains', []))

# ---------------------
# URL Feature Extractor
# ---------------------
def extract_url_features(url):
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.split(':')[0]

        features = {
            'url_length': len(url),
            'domain_has_ip': int(bool(re.match(r'^\d+\.\d+\.\d+\.\d+$', domain))),
            'num_special_chars': sum(1 for c in url if c in '/:?&%=.-_~@'),
            'num_digits': sum(c.isdigit() for c in url),
            'domain_length': len(domain),
            'subdomain_length': len(domain.split('.')[0]),
            'num_subdomains': len(domain.split('.')) - 1,
            'is_common_tld': int(domain.endswith(('.com', '.org', '.net', '.gov', '.edu', '.io'))),
            'typosquatting': int(any(t in domain.lower() for t in ['paypa1', 'g00gle', 'amaz0n', 'faceb00k', 'y0utube'])),
            'has_banking_kw': int(any(kw in url.lower() for kw in ['login', 'bank', 'account', 'secure', 'verify'])),
            'has_hex': int(bool(re.search(r'%[0-9a-fA-F]{2}', url))),
            'has_at_symbol': int('@' in url),
            'uses_https': int(parsed.scheme == 'https'),
            'path_depth': parsed.path.count('/'),
            'entropy': -sum((url.count(c)/len(url)) * math.log2(url.count(c)/len(url)) 
                        for c in set(url) if url.count(c) > 0),
            'vowel_ratio': sum(1 for c in domain if c.lower() in 'aeiou') / len(domain) if domain else 0,
            'consecutive_chars': int(bool(re.search(r'([a-zA-Z])\1{2}', domain))),
        }
        return features
    except:
        return None

# --------------------
# Prediction Endpoint
# --------------------
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    url = data.get("url")

    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    # Ensure URL has a scheme
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    domain = urlparse(url).netloc.lower()
    if domain.startswith('www.'):
        domain = domain[4:]
    base_domain = '.'.join(domain.split('.')[-2:]) if len(domain.split('.')) > 2 else domain

    if base_domain in trusted_domains:
        return jsonify({
            'url': url,
            'is_phishing': False,
            'confidence': 'high',
            'probability': 0.05,
            'trusted_domain': True
        })

    features = extract_url_features(url)
    if not features:
        return jsonify({'error': 'Failed to extract features'}), 400

    X = pd.DataFrame([features])
    prob = model.predict_proba(X)[0][1]
    is_phishing = prob > 0.75

    return jsonify({
        'url': url,
        'is_phishing': bool(is_phishing),
        'probability': round(prob, 4),
        'confidence': 'high' if prob > 0.9 or prob < 0.1 else 'medium',
        'trusted_domain': False
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
