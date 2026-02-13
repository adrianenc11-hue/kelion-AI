const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_PATH = path.join(__dirname, 'integrity-manifest.json');
const CRITICAL_FILES = [
    'validate-code.js',
    'validate-fake-data.js',
    'audit-live.js',
    'audit_complete.js',
    'netlify/functions/truth-detector.js',
    'netlify/functions/smart-brain.js'
];

function computeHash(filePath) {
    try {
        const content = fs.readFileSync(path.join(__dirname, filePath));
        return crypto.createHash('sha256').update(content).digest('hex');
    } catch (e) {
        console.error(`Error reading ${filePath}: ${e.message}`);
        return null;
    }
}

try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    console.log('Updating hashes in manifest...');

    for (const file of CRITICAL_FILES) {
        const hash = computeHash(file);
        if (hash) {
            if (manifest.protected_files[file]) {
                manifest.protected_files[file].sha256 = hash;
                console.log(`Updated hash for ${file}`);
            } else {
                // Ensure entry exists if it was missing
                manifest.protected_files[file] = { sha256: hash, algorithm: 'sha256' };
                console.log(`Added entry for ${file}`);
            }
        }
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log('Manifest updated successfully.');
} catch (e) {
    console.error('Failed to update manifest:', e);
    process.exit(1);
}
