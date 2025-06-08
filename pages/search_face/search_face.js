// Global variables
let video = document.getElementById('video');
let overlayCanvas = document.getElementById('overlayCanvas');
let uploadOverlayCanvas = document.getElementById('uploadOverlayCanvas');
let uploadedImage = document.getElementById('uploadedImage');
let context = overlayCanvas.getContext('2d');
let displaySize;
let stream; // To hold the webcam stream
let webcamDetectionInterval; // To store the interval ID for clearing
let currentFacingMode = 'user'; // 'user' for front camera, 'environment' for back camera

let areModelsLoaded = false;
let indexedDbDescriptors = []; // Array to store all descriptors from IndexedDB
let availableCameras = []; // To store available video input devices

// Reusable IndexedDB functions (copy-pasted for now, consider making a separate utility)
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
            reject("Error opening database.");
        };
    });
}

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

// Face-API.js Model Loading
async function loadFaceApiModels() {
    const statusMessage = document.getElementById('searchStatusMessage');
    statusMessage.textContent = 'Loading face detection models...';
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('../../models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('../../models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('../../models')
        ]);
        statusMessage.textContent = 'Face-API.js models loaded.';
        console.log('Face-API.js models loaded successfully.');
        areModelsLoaded = true;
    } catch (error) {
        statusMessage.textContent = 'Error loading face models. Make sure "models" folder is correct.';
        console.error('Error loading Face-API.js models:', error);
        throw error;
    }
}

// Load descriptors from IndexedDB
async function loadIndexedDbDescriptors() {
    document.getElementById('searchStatusMessage').textContent = 'Loading faces from database...';
    try {
        const db = await openDatabase();
        const data = await getAllDataFromStore(db, 'research_data');
        indexedDbDescriptors = data.filter(item => item.descriptor)
                                   .map(item => ({
                                       id: item.id,
                                       timestamp: item.timestamp,
                                       descriptor: new Float32Array(item.descriptor)
                                   }));
        document.getElementById('searchStatusMessage').textContent = `Loaded ${indexedDbDescriptors.length} faces from database.`;
        console.log(`Loaded ${indexedDbDescriptors.length} faces from database.`);
    } catch (error) {
        document.getElementById('searchStatusMessage').textContent = 'Error loading faces from database.';
        console.error('Error loading IndexedDB descriptors:', error);
    }
}

// Function to enumerate cameras and show/hide switch button
async function checkCameraDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn("enumerateDevices() not supported.");
        return;
    }
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableCameras = devices.filter(device => device.kind === 'videoinput');
        console.log("Available cameras:", availableCameras.length, availableCameras);

        if (availableCameras.length > 1) {
            document.getElementById('switchCameraButton').classList.remove('hidden');
        } else {
            document.getElementById('switchCameraButton').classList.add('hidden');
        }
    } catch (err) {
        console.error("Error enumerating devices:", err);
    }
}

// Webcam stream handling
async function startWebcam(facingMode = currentFacingMode) {
    console.log(`1. startWebcam() function entered with facingMode: ${facingMode}`);
    document.getElementById('webcamStatus').textContent = `Webcam status: Starting with ${facingMode} camera...`;
    document.getElementById('startWebcamButton').classList.add('hidden');
    document.getElementById('stopWebcamButton').classList.remove('hidden');

    // Stop any existing stream first
    if (stream) {
        stopWebcam();
    }

    try {
        console.log("2. Attempting navigator.mediaDevices.getUserMedia()...");
        const constraints = { video: { facingMode: facingMode } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("3. Stream successfully obtained:", stream);
        video.srcObject = stream;
        console.log("4. video.srcObject set.");
        document.getElementById('webcamStatus').textContent = `Webcam status: Active (${facingMode} camera).`;
        
        // Use a promise to ensure video metadata is loaded before proceeding
        await new Promise(resolve => {
            video.onloadedmetadata = () => {
                console.log("5. Video metadata loaded. Dimensions:", video.videoWidth, video.videoHeight);
                displaySize = { width: video.videoWidth, height: video.videoHeight };
                
                // Fallback for cases where videoWidth/Height are 0 on load or not immediately available
                if (displaySize.width === 0 || displaySize.height === 0) {
                    displaySize = { width: video.offsetWidth, height: video.offsetHeight };
                    if (displaySize.width === 0 || displaySize.height === 0) {
                        console.warn("Could not determine video dimensions from metadata or offset. Using default 640x480.");
                        displaySize = { width: 640, height: 480 }; 
                    }
                }
                faceapi.matchDimensions(overlayCanvas, displaySize);
                
                // Set canvas size to match video's *displayed* size
                overlayCanvas.style.width = video.offsetWidth + 'px';
                overlayCanvas.style.height = video.offsetHeight + 'px';
                resolve(); // Resolve the promise once dimensions are set
            };
            // If video already loaded metadata (e.g. if startWebcam was called multiple times)
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                video.onloadedmetadata(); // Call immediately
            }
        });

        // Clear any previous interval to prevent multiple running instances
        if (webcamDetectionInterval) {
            clearInterval(webcamDetectionInterval);
        }
        console.log("Starting face detection interval.");
        webcamDetectionInterval = setInterval(detectFacesFromWebcam, 100); // Run detection every 100ms

    } catch (err) {
        console.error("Error accessing webcam:", err); // Keep this line as is
        document.getElementById('webcamStatus').textContent = `Webcam status: Error - ${err.name}: ${err.message}. Please allow camera access.`;
        document.getElementById('startWebcamButton').classList.remove('hidden');
        document.getElementById('stopWebcamButton').classList.add('hidden');
        // Hide switch button if camera access fails
        document.getElementById('switchCameraButton').classList.add('hidden');
    }
}

function stopWebcam() {
    console.log("Stopping webcam...");
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        document.getElementById('webcamStatus').textContent = 'Webcam status: Stopped.';
        document.getElementById('startWebcamButton').classList.remove('hidden');
        document.getElementById('stopWebcamButton').classList.add('hidden');
    }
    if (webcamDetectionInterval) {
        clearInterval(webcamDetectionInterval);
        webcamDetectionInterval = null;
        console.log("Webcam detection interval cleared.");
    }
    context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height); // Clear canvas
    document.getElementById('searchResultsContainer').innerHTML = '<p id="noResultsMessage" class="text-center text-gray-500 col-span-full">No search results yet.</p>';
}

function switchCamera() {
    // Toggle facing mode
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    console.log(`Switching camera to: ${currentFacingMode}`);
    // Restart webcam with the new facing mode
    startWebcam(currentFacingMode);
}


async function detectFacesFromWebcam() {
    if (!areModelsLoaded || video.paused || video.ended || !displaySize || displaySize.width === 0 || !video.srcObject) {
        // Only run if models are loaded, video is playing, displaySize is valid, and stream is active
        return;
    }

    // NEW: Draw the video frame onto the canvas first
    // Only draw if video has enough data to prevent drawing a black frame
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        context.drawImage(video, 0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    const detectionsWithDescriptors = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    // Now draw detections on top of the video frame
    if (detectionsWithDescriptors) {
        const resizedDetections = faceapi.resizeResults(detectionsWithDescriptors, displaySize);
        faceapi.draw.drawDetections(overlayCanvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);

        performSearch(resizedDetections.descriptor);
    } else {
        document.getElementById('searchStatusMessage').textContent = 'No face detected in webcam feed.';
        // Don't clear search results if no face detected in a frame, only on stop/mode switch
        // document.getElementById('searchResultsContainer').innerHTML = '<p id="noResultsMessage" class="text-center text-gray-500 col-span-full">No search results yet.</p>';
    }
}

// Image upload handling (No changes needed here for camera specific issues)
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('uploadStatus').textContent = 'Upload status: Processing image...';
    document.getElementById('uploadedImage').classList.add('hidden'); // Hide img during processing
    uploadOverlayCanvas.classList.add('hidden'); // Hide canvas during processing
    document.getElementById('searchResultsContainer').innerHTML = '<p id="noResultsMessage" class="text-center text-gray-500 col-span-full">No search results yet.</p>';


    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
        if (!areModelsLoaded) {
            await loadFaceApiModels(); // Ensure models are loaded for image processing
        }

        uploadedImage.src = img.src;
        uploadedImage.classList.remove('hidden'); // Show the uploaded image
        uploadOverlayCanvas.classList.remove('hidden'); // Show the canvas

        displaySize = { width: img.width, height: img.height };
        faceapi.matchDimensions(uploadOverlayCanvas, displaySize);

        const detectionsWithDescriptors = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        const canvasContext = uploadOverlayCanvas.getContext('2d');
        canvasContext.clearRect(0, 0, uploadOverlayCanvas.width, uploadOverlayCanvas.height); // Clear previous drawings

        if (detectionsWithDescriptors) {
            // Draw image on canvas first
            canvasContext.drawImage(img, 0, 0, uploadOverlayCanvas.width, uploadOverlayCanvas.height);
            // Then draw detections
            const resizedDetections = faceapi.resizeResults(detectionsWithDescriptors, displaySize);
            faceapi.draw.drawDetections(uploadOverlayCanvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(uploadOverlayCanvas, resizedDetections);
            document.getElementById('uploadStatus').textContent = 'Upload status: Face detected. Searching...';
            performSearch(resizedDetections.descriptor);
        } else {
            document.getElementById('uploadStatus').textContent = 'Upload status: No face detected in image.';
            document.getElementById('searchStatusMessage').textContent = 'No face detected in the uploaded image.';
            document.getElementById('searchResultsContainer').innerHTML = '<p id="noResultsMessage" class="text-center text-gray-500 col-span-full">No search results yet.</p>';
        }
        URL.revokeObjectURL(img.src); // Clean up
    };
    img.onerror = () => {
        document.getElementById('uploadStatus').textContent = 'Upload status: Error loading image.';
        console.error('Error loading uploaded image.');
    };
}


// Perform search against IndexedDB descriptors
function performSearch(currentDescriptor) {
    if (!currentDescriptor || indexedDbDescriptors.length === 0) {
        document.getElementById('searchResultsContainer').innerHTML = '<p id="noResultsMessage" class="text-center text-gray-500 col-span-full">No stored faces to compare or no face detected.</p>';
        return;
    }

    const matches = [];
    indexedDbDescriptors.forEach(dbFace => {
        const distance = faceapi.euclideanDistance(currentDescriptor, dbFace.descriptor);
        if (distance < 0.7) { // Define your match threshold here
            matches.push({
                id: dbFace.id,
                timestamp: dbFace.timestamp,
                distance: distance
            });
        }
    });

    matches.sort((a, b) => a.distance - b.distance); // Sort by closest match first

    displaySearchResults(matches);
    document.getElementById('searchStatusMessage').textContent = `Search complete. Found ${matches.length} potential matches.`;
}

// Display search results
function displaySearchResults(matches) {
    const resultsContainer = document.getElementById('searchResultsContainer');
    resultsContainer.innerHTML = ''; // Clear previous results

    if (matches.length === 0) {
        resultsContainer.innerHTML = '<p id="noResultsMessage" class="text-center text-gray-500 col-span-full">No strong matches found in the database.</p>';
        return;
    }

    matches.forEach(match => {
        const matchStatus = getMatchStatus(match.distance); // Reuse existing helper
        const resultElement = `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                <p class="text-gray-800 font-semibold mb-2">
                    <span class="match-dot ${matchStatus.class}"></span>
                    Match Status: ${matchStatus.text} (Distance: ${match.distance.toFixed(2)})
                </p>
                <p class="text-sm text-gray-600"><strong>Matched ID:</strong> ${match.id}</p>
                <p class="text-sm text-gray-600"><strong>Original Scan Date:</strong> ${new Date(match.timestamp).toLocaleString()}</p>
            </div>
        `;
        resultsContainer.insertAdjacentHTML('beforeend', resultElement);
    });
}

// Helper to determine match status based on distance (reused from scan_result.js)
function getMatchStatus(distance) {
    if (distance < 0.3) {
        return { text: 'Excellent Match', class: 'green' };
    } else if (distance < 0.6) {
        return { text: 'Good Match', class: 'orange' };
    } else {
        return { text: 'No Strong Match', class: 'red' };
    }
}


// Event Listeners for UI
document.addEventListener('DOMContentLoaded', async () => {
    console.log("search_face.js: DOMContentLoaded - Script has loaded.");

    // Initial model and database load
    await loadFaceApiModels();
    await loadIndexedDbDescriptors();
    await checkCameraDevices(); // Check available cameras on load

    // Setup mode switching
    const searchModeSelect = document.getElementById('searchMode');
    const webcamSection = document.getElementById('webcamSection');
    const uploadSection = document.getElementById('uploadSection');
    const switchCameraButton = document.getElementById('switchCameraButton');

    searchModeSelect.addEventListener('change', (event) => {
        if (event.target.value === 'webcam') {
            webcamSection.classList.remove('hidden');
            uploadSection.classList.add('hidden');
            stopWebcam(); // Ensure webcam is stopped if switching from upload mode
            // Show/hide switch button based on initial check
            if (availableCameras.length > 1) {
                switchCameraButton.classList.remove('hidden');
            }
        } else {
            uploadSection.classList.remove('hidden');
            webcamSection.classList.add('hidden');
            stopWebcam(); // Ensure webcam is stopped when switching to upload mode
            switchCameraButton.classList.add('hidden'); // Hide switch button in upload mode
        }
        document.getElementById('searchStatusMessage').textContent = 'Ready to search.';
        document.getElementById('searchResultsContainer').innerHTML = '<p id="noResultsMessage" class="text-center text-gray-500 col-span-full">No search results yet.</p>';
    });

    // Webcam buttons
    document.getElementById('startWebcamButton').addEventListener('click', startWebcam);
    document.getElementById('stopWebcamButton').addEventListener('click', stopWebcam);
    document.getElementById('switchCameraButton').addEventListener('click', switchCamera); // NEW: Switch Camera listener

    // Image upload input
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
});