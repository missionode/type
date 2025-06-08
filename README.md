
# Face Regegnisation Application ( Lakshana sastram )

## Overview

This is a web-based Face Recognition Application designed to demonstrate the capabilities of client-side face detection, landmark detection, and face recognition using Face-API.js. The application allows users to:

* **Upload faces** for registration or "research" into an IndexedDB database.
* **Scan faces via webcam** to detect faces in real-time.
* **Search for detected faces** against the stored database, providing match probabilities.
* Manage different modes (webcam vs. upload) for searching.
* Switch between front and back cameras on mobile devices for webcam scanning.

## Features

* **Real-time Face Detection:** Utilizes webcam feed to detect faces dynamically.
* **Face Landmark Detection:** Identifies key facial features.
* **Face Recognition/Matching:** Compares detected faces against a local IndexedDB database.
* **Image Upload Support:** Process faces from uploaded image files.
* **Responsive UI:** Built with Tailwind CSS for a clean and adaptive user interface.
* **Mobile Camera Switching:** Seamlessly switch between front and back cameras on compatible devices.
* **Local Data Storage:** Uses IndexedDB for storing face descriptors client-side.

## Technologies Used

* **HTML5:** For structuring the web pages.
* **CSS3 (Tailwind CSS):** For styling and responsive design.
* **JavaScript (Vanilla JS):** For core application logic and interactions.
* **Face-API.js:** A JavaScript library for face detection and face recognition in the browser, built on top of TensorFlow.js.
* **IndexedDB:** For client-side database storage of face descriptors.

## Project Structure

```
.
├── api/
│   └── projects.php             # (Mentioned in previous context, assumed for backend integration)
├── css/
│   └── style.css                # (General styles, if any, otherwise Tailwind handles most)
├── lib/
│   └── face-api/
│       ├── face-api.min.js      # Face-API.js library
│       └── models/              # Face-API.js model files (tinyFaceDetector, faceLandmark68Net, faceRecognitionNet)
├── pages/
│   ├── home/
│   │   └── home.html
│   ├── upload_face/
│   │   ├── upload_face.html
│   │   └── upload_face.js
│   ├── scan_result/
│   │   ├── scan_result.html
│   │   └── scan_result.js
│   ├── search_face/
│   │   ├── search_face.html
│   │   └── search_face.js
│   └── settings/
│       └── settings.html
└── README.md
```

## Setup and Installation

To get this project up and running on your local machine, follow these steps:

1.  **Clone the repository (or download the files):**
    ```bash
    git clone [YOUR_REPOSITORY_URL]
    # OR download the .zip file from your repository host
    ```

2.  **Ensure Face-API.js Models are Present:**
    * Navigate to the `lib/face-api/` directory.
    * Make sure you have a `models` subfolder within `lib/face-api/`.
    * Download the necessary Face-API.js model files (`tiny_face_detector_model.weights`, `tiny_face_detector_model.json`, `face_landmark_68_model.weights`, `face_landmark_68_model.json`, `face_recognition_model.weights`, `face_recognition_model.json`) and place them inside the `lib/face-api/models/` folder.
        * You can usually find these in the `weights` directory of the Face-API.js GitHub repository.

3.  **Local Server Requirement (for Camera Access):**
    * Modern browsers restrict webcam access (`getUserMedia`) to secure contexts (HTTPS) or `localhost`. Since this is a client-side application, you'll need a local web server.
    * **Recommended:** Use **MAMP** (as per our discussion) or similar tools like XAMPP, Laragon, or Python's built-in HTTP server.
    * **Using MAMP:**
        1.  Place the entire project folder (e.g., `project_management_app`) into your MAMP's `htdocs` directory.
        2.  Start your MAMP Apache server.
        3.  Open your browser and navigate to `http://localhost:[MAMP_PORT]/project_management_app/pages/home/home.html` (e.g., `http://localhost:8888/project_management_app/pages/home/home.html`).

## Usage

1.  **Navigate to the Application:** Open `http://localhost:[MAMP_PORT]/project_management_app/pages/home/home.html` in your browser.
2.  **Research (Upload Faces):** Go to the "Research" section (likely `upload_face.html`) to upload images and store their face descriptors in your local database. These will be used for searching.
3.  **Search:** Go to the "Search" section (`search_face.html`):
    * **Webcam Scan:** Click "Start Webcam" to begin real-time face detection. The detected face will be compared against your stored database.
    * **Upload Image:** Select an image from your device to detect a face and perform a search.
    * **Switch Camera:** On mobile devices with multiple cameras, use the "Switch Camera" button to toggle between front and back cameras.
4.  **Scan Result:** The "Scan Result" page (likely `scan_result.html`) will display the results of a face scan or recognition process.

---

## Important Considerations

* **Browser Permissions:** When using the webcam, your browser will prompt you to allow camera access. You **must grant permission** for the application to function correctly.
* **Model Files:** Ensure the Face-API.js model files are correctly placed in the `lib/face-api/models/` directory. If they are missing or incorrectly placed, the face detection and recognition features will not work.
* **IndexedDB Data:** The face descriptors are stored locally in your browser's IndexedDB. If you clear your browser's site data, this information will be lost.
* **Performance:** Real-time face detection can be CPU-intensive, especially on older devices. Performance may vary.

---

## Future Enhancements (Ideas)

* Backend integration for persistent storage of face data and scalability.
* User authentication and management.
* More robust error handling and user feedback.
* Improved UI/UX for managing stored faces.
* Optimizations for mobile performance.

---

