// Global variable to track Face-API.js model loading status
let areModelsLoaded = false;

// Function to open and get the IndexedDB database (reused)
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TypeDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('research_data')) {
                db.createObjectStore('research_data', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject("Error opening database for scan result.");
        };
    });
}

// Function to get all data from a specific object store
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

// Function to get a single record by ID
async function getRecordById(db, storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = (event) => {
            console.error(`Error getting record with ID ${id} from ${storeName}:`, event.target.errorCode);
            reject(`Error retrieving record.`);
        };
    });
}

// Helper to determine match status based on distance
function getMatchStatus(distance) {
    if (distance < 0.3) {
        return { text: 'Excellent Match', class: 'green' };
    } else if (distance < 0.6) {
        return { text: 'Good Match', class: 'orange' };
    } else {
        return { text: 'No Strong Match', class: 'red' };
    }
}

// Function to display the current scan's details
function displayCurrentScanDetails(scanData) {
    document.getElementById('currentScanId').textContent = scanData.id;
    document.getElementById('currentScanTimestamp').textContent = new Date(scanData.timestamp).toLocaleString();
    document.getElementById('currentScanDescriptorLength').textContent = scanData.descriptor ? scanData.descriptor.length : 'N/A';
    document.getElementById('currentScanStatus').textContent = 'Details of the latest scan.';
}

// Function to display match results
function displayMatches(matches) {
    const matchesContainer = document.getElementById('matchesContainer');
    const noMatchesMessage = document.getElementById('noMatchesMessage');
    matchesContainer.innerHTML = ''; // Clear previous matches

    if (matches.length === 0) {
        noMatchesMessage.classList.remove('hidden');
        document.getElementById('matchStatusMessage').textContent = 'No similar faces found yet. Upload or scan more faces!';
        return;
    }

    noMatchesMessage.classList.add('hidden');
    matches.forEach(match => {
        const matchStatus = getMatchStatus(match.distance);
        const matchElement = `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                <p class="text-gray-800 font-semibold mb-2">
                    <span class="match-dot ${matchStatus.class}"></span>
                    Match Status: ${matchStatus.text} (Distance: ${match.distance.toFixed(2)})
                </p>
                <p class="text-sm text-gray-600"><strong>Matched ID:</strong> ${match.id}</p>
                <p class="text-sm text-gray-600"><strong>Original Scan Date:</strong> ${new Date(match.timestamp).toLocaleString()}</p>
                <details class="text-sm text-gray-500 mt-2">
                    <summary>Show Raw Descriptor (partial)</summary>
                    <code class="block bg-gray-100 p-2 rounded break-all text-xs">
                        ${match.descriptor ? match.descriptor.slice(0, 10).join(', ') + '...' : 'N/A'}
                    </code>
                </details>
            </div>
        `;
        matchesContainer.insertAdjacentHTML('beforeend', matchElement);
    });
    document.getElementById('matchStatusMessage').textContent = `Found ${matches.length} closest matches.`;
}

// Function to load Face-API.js models using Promise.all
async function loadFaceApiModels() {
    const statusMessage = document.getElementById('matchStatusMessage');
    statusMessage.textContent = 'Loading face detection models...';
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('../../models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('../../models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('../../models')
        ]);
        
        statusMessage.textContent = 'Face-API.js models loaded.';
        console.log('Face-API.js models loaded successfully.');
        areModelsLoaded = true; // Set flag to true
    } catch (error) {
        statusMessage.textContent = 'Error loading face models. Check console.';
        console.error('Error in loadFaceApiModels:', error);
        throw error;
    }
}

// Main function to load data and find matches
async function loadScanResult() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentScanId = parseInt(urlParams.get('id'));

    const matchStatusMessage = document.getElementById('matchStatusMessage');
    matchStatusMessage.textContent = 'Loading results...';

    if (isNaN(currentScanId)) {
        matchStatusMessage.textContent = 'Error: No scan ID provided. Please scan or upload a face first.';
        document.getElementById('currentScanDetails').innerHTML = '<p class="text-red-500">No current scan data to display.</p>';
        return;
    }

    try {
        if (!areModelsLoaded) {
            await loadFaceApiModels();
        }

        // Keep the small delay as a safety net, although its impact on this specific error is limited
        await new Promise(resolve => setTimeout(resolve, 200)); 

        // Removed the check for faceapi.LabeledFaceDescriptor and its corresponding error
        // Removed the instantiation of LabeledFaceDescriptor and FaceMatcher

        const db = await openDatabase();
        const allResearchData = await getAllDataFromStore(db, 'research_data');
        const currentScanData = await getRecordById(db, 'research_data', currentScanId);

        if (!currentScanData || !currentScanData.descriptor) {
            matchStatusMessage.textContent = 'Error: Current scan data not found or descriptor missing. This might happen if the previous scan failed to save.';
            document.getElementById('currentScanDetails').innerHTML = '<p class="text-red-500">Current scan data incomplete.</p>';
            return;
        }

        displayCurrentScanDetails(currentScanData);

        const otherFaces = allResearchData.filter(data => data.id !== currentScanId && data.descriptor);

        if (otherFaces.length === 0) {
            document.getElementById('noMatchesMessage').classList.remove('hidden');
            matchStatusMessage.textContent = 'No other faces in the database to compare with.';
            return;
        }

        const currentDescriptor = new Float32Array(currentScanData.descriptor);

        const matchedResults = [];
        otherFaces.forEach(face => {
            const descriptorFloat32 = new Float32Array(face.descriptor);
            const distance = faceapi.euclideanDistance(currentDescriptor, descriptorFloat32);

            if (distance < 0.7) { // This is the threshold for what you consider a "similar" face to display
                matchedResults.push({
                    id: face.id,
                    timestamp: face.timestamp,
                    descriptor: face.descriptor,
                    distance: distance
                });
            }
        });

        matchedResults.sort((a, b) => a.distance - b.distance);

        displayMatches(matchedResults);
        matchStatusMessage.textContent = `Analysis complete. Found ${matchedResults.length} similar faces.`;

    } catch (error) {
        matchStatusMessage.textContent = `Error loading scan results: ${error.message}`;
        console.error('Error in loadScanResult:', error);
    }
}


// //# allFunctionsCalledOnLoad
document.addEventListener('DOMContentLoaded', loadScanResult);