let video;
let canvas;
let displaySize;
let faceDetectionInterval;
let stream; // To hold the MediaStream object for stopping it

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
        // Load the same models as in upload_face for consistency
        await faceapi.nets.tinyFaceDetector.loadFromUri('../../models'); // Adjust path as needed
        await faceapi.nets.faceLandmark68Net.loadFromUri('../../models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('../../models');
        statusMessage.textContent = 'Models loaded. Starting camera...';
        console.log('Face-API.js models loaded successfully.');
    } catch (error) {
        statusMessage.textContent = 'Error loading face models. Check console.';
        console.error('Error loading Face-API.js models:', error);
        throw error; // Propagate error to prevent camera start if models fail
    }
}

// Function to start the camera stream
async function startCamera() {
    video = document.getElementById('videoElement');
    const statusMessage = document.getElementById('scanStatusMessage');
    try {
        // Request access to the user's camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        // Wait for the video to load metadata to get its dimensions
        await new Promise(resolve => video.onloadedmetadata = resolve);

        canvas = document.getElementById('overlayCanvas');
        displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        // Start detecting faces once video is playing
        video.addEventListener('play', () => {
            statusMessage.textContent = 'Camera active. Looking for faces...';
            document.getElementById('captureScanBtn').disabled = false; // Enable capture button
            faceDetectionInterval = setInterval(detectFace, 100); // Detect every 100ms
        });

    } catch (err) {
        statusMessage.textContent = `Error accessing camera: ${err.name} - ${err.message}`;
        console.error("Error accessing camera:", err);
        alert("Could not access camera. Please ensure you have a webcam and granted permissions.");
    }
}

// Function to stop the camera stream
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        clearInterval(faceDetectionInterval);
        document.getElementById('captureScanBtn').disabled = true;
        document.getElementById('scanStatusMessage').textContent = 'Camera stopped.';
        console.log('Camera stream stopped.');
    }
}

// Function to detect faces continuously
async function detectFace() {
    if (!video || video.paused || video.ended) {
        return clearInterval(faceDetectionInterval);
    }

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                                    .withFaceLandmarks()
                                    .withFaceDescriptor();

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawings

    if (detections) {
        document.getElementById('scanStatusMessage').textContent = 'Face detected! Ready to capture.';
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        // Draw bounding box and landmarks
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
            // You can also save the image itself if needed, but descriptor is key
            // imageUrl: tempCanvas.toDataURL('image/jpeg') // Example: save as base64 image
        };
        try {
            const newRecordId = await saveResearchData(faceData);
            stopCamera(); // Stop camera after successful capture and save
            redirectToScanResult(newRecordId); // Redirect with the new data's ID
        } catch (error) {
            statusMessage.textContent = `Failed to save scan: ${error.message}`;
            console.error("Failed to save scan:", error);
            // Optionally restart detection or allow re-capture
            faceDetectionInterval = setInterval(detectFace, 100);
        }
    } else {
        statusMessage.textContent = 'No face detected at the moment of capture. Try again.';
        console.warn('No face detected at capture.');
        // If no face, resume detection
        faceDetectionInterval = setInterval(detectFace, 100);
    }
}


// Attach all event listeners
function attachEventListeners() {
    document.getElementById('captureScanBtn').addEventListener('click', handleCaptureScan);
    document.getElementById('stopScanBtn').addEventListener('click', stopCamera);
}

// //# allFunctionsCalledOnLoad
document.addEventListener('DOMContentLoaded', async () => {
    attachEventListeners();
    try {
        await loadFaceApiModels();
        await startCamera();
    } catch (error) {
        // Errors handled in respective functions
    }
});