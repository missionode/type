let video;
let canvas;
let displaySize;
let faceDetectionInterval;
let stream; // To hold the MediaStream object for stopping it
let currentFacingMode = 'user'; // 'user' for front camera, 'environment' for back camera
let availableCameras = []; // To store available video input devices

// Function to redirect to the Scan Result page (common function)
function redirectToScanResult(dataId = null) {
    let url = '../scan_result/scan_result.html';
    if (dataId) {
        url += `?id=${dataId}`; // Pass ID if a specific result needs to be shown
    }
    window.location.href = url;
}

// IndexedDB Helper: Open Database (reused from settings.js and upload_face.js)
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

// IndexedDB Helper: Save Research Data (reused from upload_face.js)
async function saveResearchData(data) {
    const statusMessage = document.getElementById('scanStatusMessage');
    statusMessage.textContent = 'Saving research data...';
    try {
        const db = await openDatabase();
        const transaction = db.transaction(['research_data'], 'readwrite');
        const store = transaction.objectStore('research_data');

        data.timestamp = new Date().toISOString(); // Add timestamp
        data.type = 'scan'; // Add type for dashboard analytics

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
    const statusMessage = document.getElementById('scanStatusMessage');
    statusMessage.textContent = 'Loading face detection models...';
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('../../models'), // Adjust path as needed
            faceapi.nets.faceLandmark68Net.loadFromUri('../../models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('../../models')
        ]);
        statusMessage.textContent = 'Models loaded. Starting camera...';
        console.log('Face-API.js models loaded successfully.');
    } catch (error) {
        statusMessage.textContent = 'Error loading face models. Check console.';
        console.error('Error loading Face-API.js models:', error);
        throw error; // Propagate error to prevent camera start if models fail
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

// Function to start the camera stream
async function startCamera(facingMode = currentFacingMode) {
    video = document.getElementById('videoElement');
    canvas = document.getElementById('overlayCanvas');
    const statusMessage = document.getElementById('scanStatusMessage');

    // Stop any existing stream first
    if (stream) {
        stopCamera();
    }

    statusMessage.textContent = `Camera status: Starting with ${facingMode} camera...`;

    try {
        const constraints = { video: { facingMode: facingMode } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        // Wait for the video to load metadata to get its dimensions
        await new Promise(resolve => {
            video.onloadedmetadata = () => {
                displaySize = { width: video.videoWidth, height: video.videoHeight };
                // Fallback for cases where videoWidth/Height are 0 on load or not immediately available
                if (displaySize.width === 0 || displaySize.height === 0) {
                    displaySize = { width: video.offsetWidth, height: video.offsetHeight };
                    if (displaySize.width === 0 || displaySize.height === 0) {
                        console.warn("Could not determine video dimensions from metadata or offset. Using default 640x480 for canvas.");
                        displaySize = { width: 640, height: 480 };
                    }
                }
                faceapi.matchDimensions(canvas, displaySize);

                // Set canvas size to match video's *displayed* size
                canvas.style.width = video.offsetWidth + 'px';
                canvas.style.height = video.offsetHeight + 'px';
                resolve();
            };
            // If video already loaded metadata (e.g. if startCamera was called multiple times before re-attaching metadata event)
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                video.onloadedmetadata(); // Call immediately
            }
        });


        // Start detecting faces once video is playing
        video.addEventListener('play', () => {
            statusMessage.textContent = 'Camera active. Looking for faces...';
            document.getElementById('captureScanBtn').disabled = false; // Enable capture button
            // Clear any previous interval to prevent multiple running instances
            if (faceDetectionInterval) {
                clearInterval(faceDetectionInterval);
            }
            faceDetectionInterval = setInterval(detectFace, 100); // Detect every 100ms
        }, { once: true }); // Use once: true to prevent multiple listeners on play


    } catch (err) {
        statusMessage.textContent = `Error accessing camera: ${err.name} - ${err.message}. Please allow camera access.`;
        console.error("Error accessing camera:", err);
        alert("Could not access camera. Please ensure you have a webcam and granted permissions.");
        document.getElementById('captureScanBtn').disabled = true;
        document.getElementById('switchCameraButton').classList.add('hidden'); // Hide switch button if camera fails
    }
}

// Function to stop the camera stream
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null; // Clear interval ID
        document.getElementById('captureScanBtn').disabled = true;
        document.getElementById('scanStatusMessage').textContent = 'Camera stopped.';
        // Clear canvas when camera stops
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        console.log('Camera stream stopped and canvas cleared.');
    }
}

// Function to switch camera
function switchCamera() {
    // Toggle facing mode
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    console.log(`Switching camera to: ${currentFacingMode}`);
    // Restart webcam with the new facing mode
    startCamera(currentFacingMode);
}

// Function to detect faces continuously
async function detectFace() {
    if (!video || video.paused || video.ended || !displaySize || displaySize.width === 0 || !video.srcObject) {
        return; // Do not proceed if video is not ready or dimensions are invalid
    }

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawings

    // Draw the video frame onto the canvas first (for combined visual)
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }


    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                                    .withFaceLandmarks()
                                    .withFaceDescriptor();

    if (detections) {
        document.getElementById('scanStatusMessage').textContent = 'Face detected! Ready to capture.';
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        // Draw bounding box and landmarks on top of the video frame
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    } else {
        document.getElementById('scanStatusMessage').textContent = 'No face detected. Please center your face.';
    }
}

// Function to handle the capture action
async function handleCaptureScan() {
    const statusMessage = document.getElementById('scanStatusMessage');
    statusMessage.textContent = 'Capturing and processing scan...';
    clearInterval(faceDetectionInterval); // Stop continuous detection
    faceDetectionInterval = null; // Clear interval ID

    // Take a snapshot from the video stream
    const tempCanvas = faceapi.createCanvasFromMedia(video);
    const detections = await faceapi.detectSingleFace(tempCanvas, new faceapi.TinyFaceDetectorOptions())
                                    .withFaceLandmarks()
                                    .withFaceDescriptor();

    if (detections) {
        console.log('Face captured and characteristics extracted:', detections);
        const faceData = {
            descriptor: Array.from(detections.descriptor),
            landmarks: detections.landmarks.positions.map(p => ({ x: p.x, y: p.y })),
            detection: detections.detection.box,
        };
        try {
            const newRecordId = await saveResearchData(faceData);
            stopCamera(); // Stop camera after successful capture and save
            redirectToScanResult(newRecordId); // Redirect with the new data's ID
        } catch (error) {
            statusMessage.textContent = `Failed to save scan: ${error.message}`;
            console.error("Failed to save scan:", error);
            // If save fails, re-enable capture button and resume detection
            document.getElementById('captureScanBtn').disabled = false;
            faceDetectionInterval = setInterval(detectFace, 100);
        }
    } else {
        statusMessage.textContent = 'No face detected at the moment of capture. Try again.';
        console.warn('No face detected at capture.');
        // If no face, re-enable capture button and resume detection
        document.getElementById('captureScanBtn').disabled = false;
        faceDetectionInterval = setInterval(detectFace, 100);
    }
}


// Attach all event listeners
function attachEventListeners() {
    document.getElementById('captureScanBtn').addEventListener('click', handleCaptureScan);
    document.getElementById('stopScanBtn').addEventListener('click', stopCamera);
    document.getElementById('switchCameraButton').addEventListener('click', switchCamera); // NEW: Switch Camera listener
}

// Call functions on load
document.addEventListener('DOMContentLoaded', async () => {
    attachEventListeners();
    try {
        await loadFaceApiModels();
        await startCamera();
        await checkCameraDevices(); // Check available cameras after starting the first camera
    } catch (error) {
        // Errors are typically handled and displayed by individual functions
    }
});