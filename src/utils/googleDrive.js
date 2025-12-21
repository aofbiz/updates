/**
 * Google Drive Backup Service
 * Handles authentication and file uploads to Google Drive
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Load the Google Identity Services script
export const loadGoogleScript = () => {
    return new Promise((resolve, reject) => {
        if (window.google) {
            resolve(window.google)
            return
        }

        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = () => resolve(window.google)
        script.onerror = reject
        document.head.appendChild(script)
    })
}

// Initialize the Token Client
// Returns the client instance
export const initTokenClient = (clientId, callback) => {
    if (!window.google) {
        throw new Error('Google script not loaded')
    }

    return window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: callback,
    })
}

/**
* Uploads a file to Google Drive
* @param {string} accessToken - Valid OAuth access token
* @param {string} fileName - Name of the file to create
* @param {string} fileContent - JSON string content
* @param {string} mimeType - MIME type (default application/json)
* @returns {Promise<string>} - ID of the created file
*/
export const uploadFileToDrive = async (accessToken, fileName, fileContent, mimeType = 'application/json') => {
    try {
        // 1. Search for existing "AOF_Backups" folder
        const folderId = await getOrCreateBackupFolder(accessToken);

        // 2. Prepare metadata
        const metadata = {
            name: fileName,
            mimeType: mimeType,
            parents: [folderId]
        };

        // 3. Prepare multipart body
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: ' + mimeType + '\r\n\r\n' +
            fileContent +
            close_delim;

        // 4. Upload
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartRequestBody
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Upload failed: ${response.status} ${text}`);
        }

        const result = await response.json();
        return result.id;

    } catch (error) {
        console.error('Drive Upload Error:', error);
        throw error;
    }
}

// Helper to find or create the backup folder
const getOrCreateBackupFolder = async (accessToken) => {
    const folderName = 'AOF_Backups';

    // Search for folder
    const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, // Fixed Q parameter
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );

    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
    }

    // Create folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        })
    });

    const createData = await createRes.json();
    return createData.id;
}
