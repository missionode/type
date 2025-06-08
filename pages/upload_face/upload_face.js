// Function to redirect to the Face Scan page
function redirectToFaceScan() {
    window.location.href = '../face_scan/face_scan.html';
}

// Function to redirect to the Scan Result page (common function for both upload and scan)
function redirectToScanResult(dataId = null) {
    let url = '../scan_result/scan_result.html';
    if (dataId) {
        url += `?id=${dataId}`; // Pass ID if a specific result needs to be shown
    }
    window.location.href = url;
}

// IndexedDB Helper: Open Database
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
            reject("Error opening database for research data.");
        };
    });
}

// IndexedDB Helper: Save Research Data
async function saveResearchData(data) {
    const statusMessage = document.getElementById('uploadStatusMessage');
    statusMessage.textContent = 'Saving research data...';
    try {
        const db = await openDatabase();
        const transaction = db.transaction(['research_data'], 'readwrite');
        const store = transaction.objectStore('research_data');

        // Generate a timestamp for the data
        data.timestamp = new Date().toISOString();

        const request = store.add(data); // Add the data

        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                statusMessage.textContent = 'Research data saved successfully!';
                console.log('Research data saved:', event.target.result);
                resolve(event.target.result); // Resolve with the ID of the new record
            };
            request.onerror = (event) => {
                statusMessage.textContent = `Error saving data: ${event.target.errorCode}`;
                console.error("Error saving research data:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        statusMessage.textContent = `Database error: ${error}`;
        console.error("Database operation failed:", error);
        throw error;
    }
}

// Function to load Face-API.js models
async function loadFaceApiModels() {
    const statusMessage = document.getElementById('uploadStatusMessage');
    statusMessage.textContent = 'Loading face detection models...';
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('../../models'); // Adjust path as needed
        await faceapi.nets.faceLandmark68Net.loadFromUri('../../models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('../../models');
        statusMessage.textContent = 'Face detection models loaded.';
        console.log('Face-API.js models loaded successfully.');
    } catch (error) {
        statusMessage.textContent = 'Error loading face models. Check console.';
        console.error('Error loading Face-API.js models:', error);
    }
}

// Function to handle image upload and processing
async function handleImageUpload(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('uploadedImagePreview');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const processBtn = document.getElementById('processImageBtn');
    const statusMessage = document.getElementById('uploadStatusMessage');

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            previewContainer.classList.remove('hidden');
            processBtn.disabled = false; // Enable process button once image is loaded
            statusMessage.textContent = '';
        };
        reader.readAsDataURL(file);
    } else {
        preview.src = '#';
        previewContainer.classList.add('hidden');
        processBtn.disabled = true; // Disable if no file
        statusMessage.textContent = 'No image selected.';
    }
}

// Function to process the uploaded image using Face-API.js
async function processUploadedFace() {
    const image = document.getElementById('uploadedImagePreview');
    const statusMessage = document.getElementById('uploadStatusMessage');
    if (!image.src || image.src === '#') {
        statusMessage.textContent = 'Please upload an image first.';
        return;
    }

    statusMessage.textContent = 'Processing face... This may take a moment.';
    try {
        await loadFaceApiModels(); // Ensure models are loaded before detection

        const detections = await faceapi.detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
                                        .withFaceLandmarks()
                                        .withFaceDescriptor();

        if (detections) {
            console.log('Face detected and characteristics extracted:', detections);
            const faceData = {
                descriptor: Array.from(detections.descriptor), // Convert Float32Array to regular Array
                landmarks: detections.landmarks.positions.map(p => ({ x: p.x, y: p.y })),
                detection: detections.detection.box, // Store bounding box
                // You can add more derived characteristics here as needed
            };
            const newRecordId = await saveResearchData(faceData);
            redirectToScanResult(newRecordId); // Redirect to Scan Result with the new data's ID
        } else {
            statusMessage.textContent = 'No face detected in the uploaded image. Please try another image.';
            console.warn('No face detected.');
        }
    } catch (error) {
        statusMessage.textContent = `Error processing face: ${error.message}`;
        console.error('Error during face processing:', error);
        if (error.message.includes('Failed to load model from')) {
            statusMessage.textContent += ' (Make sure "models" folder is accessible at the specified path)';
        }
    }
}

// Attach all event listeners
function attachEventListeners() {
    document.getElementById('faceImageUpload').addEventListener('change', handleImageUpload);
    document.getElementById('processImageBtn').addEventListener('click', processUploadedFace);
    document.getElementById('faceScanCtaBtn').addEventListener('click', redirectToFaceScan);
}

// //# allFunctionsCalledOnLoad
document.addEventListener('DOMContentLoaded', () => {
    attachEventListeners();
    // Pre-load models on page load for a smoother user experience
    loadFaceApiModels();
});