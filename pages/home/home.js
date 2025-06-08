// Reusable IndexedDB functions (copied for convenience, consider a shared utility file)
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

// --- Dashboard Logic ---

async function loadDashboardData() {
    try {
        const db = await openDatabase();
        const researchData = await getAllDataFromStore(db, 'research_data');

        // Update Total Faces Card
        const totalFacesCount = researchData.length;
        document.getElementById('totalFaces').textContent = totalFacesCount;

        // Populate Recent Entries Table
        populateRecentEntriesTable(researchData);

        // --- Chart Data (Using dummy data for now, as direct IndexedDB data for these is not available) ---
        // You would typically log scan events and match results to IndexedDB for real data.

        // Dummy Data for Daily Scans Chart
        const dailyScansLabels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
        const dailyScansData = [Math.floor(Math.random() * 50) + 10, Math.floor(Math.random() * 50) + 10, Math.floor(Math.random() * 50) + 10, Math.floor(Math.random() * 50) + 10, Math.floor(Math.random() * 50) + 10, Math.floor(Math.random() * 50) + 10, Math.floor(Math.random() * 50) + 10];
        document.getElementById('recentScansToday').textContent = dailyScansData[dailyScansData.length - 1]; // Last day's scan

        // Dummy Data for Match Confidence Chart
        const matchConfidenceData = [
            Math.floor(Math.random() * 30) + 10, // Excellent Matches (0-0.3 distance)
            Math.floor(Math.random() * 40) + 15, // Good Matches (0.3-0.6 distance)
            Math.floor(Math.random() * 20) + 5   // No Strong Match (>0.6 distance)
        ];
        const totalMatches = matchConfidenceData[0] + matchConfidenceData[1] + matchConfidenceData[2];
        const excellentMatchRate = totalMatches > 0 ? ((matchConfidenceData[0] / totalMatches) * 100).toFixed(1) : 'N/A';
        document.getElementById('matchSuccessRate').textContent = `${excellentMatchRate}%`;


        // Render Charts
        renderDailyScansChart(dailyScansLabels, dailyScansData);
        renderMatchConfidenceChart(matchConfidenceData);

    } catch (error) {
        console.error("Error loading dashboard data:", error);
        document.getElementById('totalFaces').textContent = 'Error';
        document.getElementById('recentScansToday').textContent = 'Error';
        document.getElementById('matchSuccessRate').textContent = 'Error';
        document.getElementById('recentEntriesTableBody').innerHTML = `<tr><td colspan="4" class="px-6 py-4 whitespace-nowrap text-sm text-red-500 text-center">Failed to load data.</td></tr>`;
    }
}

function populateRecentEntriesTable(data) {
    const tableBody = document.getElementById('recentEntriesTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No research entries found.</td></tr>`;
        return;
    }

    // Sort by timestamp in descending order (most recent first)
    const sortedData = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Display top 5 recent entries (adjust as needed)
    const recentEntries = sortedData.slice(0, 5);

    recentEntries.forEach(entry => {
        const row = tableBody.insertRow();
        const date = new Date(entry.timestamp);
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${entry.id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${entry.type || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date.toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${entry.descriptor ? entry.descriptor.length : 'N/A'}</td>
        `;
    });
}


function renderDailyScansChart(labels, data) {
    const ctx = document.getElementById('dailyScansChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faces Scanned',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.6)', // Tailwind blue-500
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allows the chart to fill its container
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Scans'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Last 7 Days'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Hide legend for single dataset
                },
                title: {
                    display: true,
                    text: 'Daily Face Scans'
                }
            }
        }
    });
}

function renderMatchConfidenceChart(data) {
    const ctx = document.getElementById('matchConfidenceChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut', // Changed to doughnut for a distribution view
        data: {
            labels: ['Excellent Match', 'Good Match', 'No Strong Match'],
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(40, 167, 69, 0.8)',  // Green (Excellent)
                    'rgba(255, 193, 7, 0.8)',  // Orange (Good)
                    'rgba(220, 53, 69, 0.8)'   // Red (No Strong Match)
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allows the chart to fill its container
            plugins: {
                legend: {
                    position: 'right', // Place legend on the right
                },
                title: {
                    display: true,
                    text: 'Match Confidence Distribution'
                }
            }
        }
    });
}

// Initial data load when the DOM is ready
document.addEventListener('DOMContentLoaded', loadDashboardData);