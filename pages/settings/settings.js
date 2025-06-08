// Function to open and get the IndexedDB database
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TypeDB', 1); // Database name and version

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Define object stores (tables) here
            // For now, let's assume we will have a 'research_data' store for face characteristics
            if (!db.objectStoreNames.contains('research_data')) {
                db.createObjectStore('research_data', { keyPath: 'id', autoIncrement: true });
            }
            // Add other object stores as your application grows, e.g., 'search_history'
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject("Error opening database.");
        };
    });
}

// Function to read all data from an object store
async function getAllDataFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = (event) => {
            console.error(`Error getting data from ${storeName}:`, event.target.errorCode);
            reject(`Error reading from ${storeName}.`);
        };
    });
}

// Function to put data into an object store
async function putDataIntoStore(db, storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);

        data.forEach(item => {
            // If the item has an 'id' and it's not autoIncremented, you might need to handle
            // if the id already exists or if you're doing an 'add' vs 'put'.
            // For now, assuming 'put' will update if key exists, or add if not.
            objectStore.put(item);
        });

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = (event) => {
            console.error(`Error putting data into ${storeName}:`, event.target.errorCode);
            reject(`Error writing to ${storeName}.`);
        };
    });
}

// Function to handle data backup
async function handleBackupData() {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = 'Backing up data...';
    try {
        const db = await openDatabase();
        const dataToBackup = {};

        // Iterate through all object stores you want to back up
        // For 'TypeDB' version 1, we defined 'research_data'
        const storeNames = ['research_data']; // Add more store names here as they are created

        for (const storeName of storeNames) {
            if (db.objectStoreNames.contains(storeName)) {
                dataToBackup[storeName] = await getAllDataFromStore(db, storeName);
            }
        }

        const jsonData = JSON.stringify(dataToBackup, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `type_app_backup_${new Date().toISOString().slice(0, 10)}.json`; // e.g., type_app_backup_2023-10-27.json
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        statusMessage.textContent = 'Data backup successful!';
    } catch (error) {
        statusMessage.textContent = `Backup failed: ${error}`;
        console.error("Backup error:", error);
    }
}

// Function to handle data restore
async function handleRestoreData(event) {
    const statusMessage = document.getElementById('statusMessage');
    const file = event.target.files[0];
    if (!file) {
        statusMessage.textContent = 'No file selected for restore.';
        return;
    }

    statusMessage.textContent = 'Restoring data...';
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const dataToRestore = JSON.parse(e.target.result);
            const db = await openDatabase();

            // Clear existing data in stores before restoring
            const storeNames = Object.keys(dataToRestore);
            for (const storeName of storeNames) {
                if (db.objectStoreNames.contains(storeName)) {
                    const transaction = db.transaction([storeName], 'readwrite');
                    const objectStore = transaction.objectStore(storeName);
                    await objectStore.clear(); // Clear existing data
                }
            }

            // Restore data
            for (const storeName of storeNames) {
                if (db.objectStoreNames.contains(storeName) && dataToRestore[storeName]) {
                    await putDataIntoStore(db, storeName, dataToRestore[storeName]);
                }
            }
            statusMessage.textContent = 'Data restore successful!';
        } catch (error) {
            statusMessage.textContent = `Restore failed: ${error}`;
            console.error("Restore error:", error);
        }
    };

    reader.onerror = () => {
        statusMessage.textContent = 'Error reading file.';
    };

    reader.readAsText(file);
}

// Event Listeners (using functions for better usage and maintenance)
function attachEventListeners() {
    document.getElementById('backupDataBtn').addEventListener('click', handleBackupData);
    document.getElementById('restoreDataBtn').addEventListener('click', () => {
        // Trigger the hidden file input click
        document.getElementById('restoreFileInput').click();
    });
    document.getElementById('restoreFileInput').addEventListener('change', handleRestoreData);
}

// //# allFunctionsCalledOnLoad
document.addEventListener('DOMContentLoaded', attachEventListeners);