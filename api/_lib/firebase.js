// Secure Firestore access WITHOUT firebase-admin SDK
// Uses Firestore REST API directly - works on Vercel free tier
const FIREBASE_PROJECT = 'forexyemeni-wallet';
const FIREBASE_DB_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// Simple in-memory cache to avoid rate limits (Vercel serverless functions are short-lived)
var _cache = {};
var _cacheTime = {};
var CACHE_TTL = 5000; // 5 seconds

/**
 * Read a document from Firestore REST API
 */
async function readDoc(collection, docId) {
    var cacheKey = collection + '/' + docId;
    var now = Date.now();
    if (_cache[cacheKey] && (now - _cacheTime[cacheKey]) < CACHE_TTL) {
        return _cache[cacheKey];
    }

    try {
        var url = `${FIREBASE_DB_URL}/${collection}/${docId}`;
        var resp = await fetch(url);
        if (!resp.ok) {
            if (resp.status === 404) return null;
            throw new Error('Firestore read error: ' + resp.status);
        }
        var data = await resp.json();
        var fields = data.fields || {};
        // Convert Firestore fields to JS objects
        var result = {};
        for (var key in fields) {
            if (key === 'data') {
                // The 'data' field contains arrays/objects
                result[key] = convertFieldValue(fields[key]);
            } else {
                result[key] = convertFieldValue(fields[key]);
            }
        }
        _cache[cacheKey] = result;
        _cacheTime[cacheKey] = now;
        return result;
    } catch (error) {
        console.error('[Firestore] Read error:', collection + '/' + docId, error.message);
        return null;
    }
}

/**
 * Write a document to Firestore REST API
 */
async function writeDoc(collection, docId, data) {
    try {
        var url = `${FIREBASE_DB_URL}/${collection}/${docId}?currentDocument.exists=true`;
        var body = { fields: {} };
        for (var key in data) {
            body.fields[key] = toFieldValue(data[key]);
        }
        var resp = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            var errText = await resp.text();
            throw new Error('Firestore write error: ' + resp.status + ' ' + errText);
        }
        // Clear cache for this document
        var cacheKey = collection + '/' + docId;
        delete _cache[cacheKey];
        delete _cacheTime[cacheKey];
        return true;
    } catch (error) {
        console.error('[Firestore] Write error:', collection + '/' + docId, error.message);
        return false;
    }
}

/**
 * Convert Firestore field value to JS value
 */
function convertFieldValue(field) {
    if (!field) return null;
    var valueType = Object.keys(field)[0];
    var value = field[valueType];
    switch (valueType) {
        case 'stringValue': return value;
        case 'integerValue': return parseInt(value) || 0;
        case 'doubleValue': return parseFloat(value) || 0;
        case 'booleanValue': return value === 'true';
        case 'nullValue': return null;
        case 'arrayValue': return (value.values || []).map(function(v) { return convertFieldValue(v); });
        case 'mapValue': var obj = {}; if (value.fields) { for (var k in value.fields) { obj[k] = convertFieldValue(value.fields[k]); } } return obj;
        case 'timestampValue': return value;
        default: return value;
    }
}

/**
 * Convert JS value to Firestore field value
 */
function toFieldValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') return { doubleValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(function(v) { return toFieldValue(v); }) } };
    if (typeof value === 'object') {
        var fields = {};
        for (var k in value) { fields[k] = toFieldValue(value[k]); }
        return { mapValue: { fields: fields } };
    }
    return { stringValue: String(value) };
}

module.exports = { readDoc, writeDoc };
