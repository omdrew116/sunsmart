document.addEventListener('DOMContentLoaded', function() {
    // Form navigation
    setupFormNavigation();
    
    // Location detection
    setupLocationDetection();
    
    // Sun direction selection
    setupDirectionSelection();
    
    // Roof type selection
    setupRoofTypeSelection();
    
    // Battery options
    setupBatteryOptions();
    
    // Form submission
    setupFormSubmission();
    
    // Results actions
    setupResultsActions();
    
    // Check for recalculate parameter
    checkForRecalculation();
});

/**
 * Set up multi-step form navigation
 */
function setupFormNavigation() {
    const nextButtons = document.querySelectorAll('.next-step');
    const prevButtons = document.querySelectorAll('.prev-step');
    
    nextButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentStep = this.closest('.form-step');
            const currentStepNum = parseInt(currentStep.dataset.step);
            const nextStepNum = currentStepNum + 1;
            const nextStep = document.querySelector(`.form-step[data-step="${nextStepNum}"]`);
            
            if (validateStep(currentStepNum)) {
                currentStep.classList.add('hidden');
                nextStep.classList.remove('hidden');
            }
        });
    });
    
    prevButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentStep = this.closest('.form-step');
            const currentStepNum = parseInt(currentStep.dataset.step);
            const prevStepNum = currentStepNum - 1;
            const prevStep = document.querySelector(`.form-step[data-step="${prevStepNum}"]`);
            
            currentStep.classList.add('hidden');
            prevStep.classList.remove('hidden');
        });
    });
}

/**
 * Validate each step of the form
 */
function validateStep(stepNumber) {
    switch(stepNumber) {
        case 1: // Location
            const location = document.getElementById('location');
            if (!location.value.trim()) {
                showError(location, 'Please enter your location or use GPS');
                return false;
            }
            return true;
            
        case 2: // House orientation
            const azimuth = document.getElementById('azimuth');
            if (!azimuth.value) {
                // Show error on the orientation container
                const selectedOrientationElement = document.querySelector('.selected-orientation');
                selectedOrientationElement.classList.add('error-state');
                selectedOrientationElement.innerHTML = '<span class="error-message">Please select which side of your house gets the most sun</span>';
                
                // Remove error when a selection is made
                const orientationButtons = document.querySelectorAll('.orientation-btn');
                orientationButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        selectedOrientationElement.classList.remove('error-state');
                        selectedOrientationElement.innerHTML = '<span>Selected: <strong id="selected-direction">' + this.textContent + '</strong></span>';
                    }, { once: true });
                });
                
                return false;
            }
            return true;
            
        case 3: // Roof type
            // Always valid as we have a default
            return true;
            
        case 4: // Electricity spend
            const monthlySpend = document.getElementById('monthly-spend');
            if (!monthlySpend.value || isNaN(monthlySpend.value) || monthlySpend.value <= 0) {
                showError(monthlySpend, 'Please enter a valid amount');
                return false;
            }
            return true;
            
        default:
            return true;
    }
}

/**
 * Display error for form field
 */
function showError(inputElement, message) {
    // Remove existing error messages
    const existingError = inputElement.parentElement.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create and append error message
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    
    // Add error class to input
    inputElement.classList.add('error');
    
    // Insert after input or input group
    if (inputElement.parentElement.classList.contains('location-input-group') || 
        inputElement.parentElement.classList.contains('currency-input')) {
        inputElement.parentElement.after(errorElement);
    } else {
        inputElement.after(errorElement);
    }
    
    // Remove error when user types
    inputElement.addEventListener('input', function() {
        inputElement.classList.remove('error');
        errorElement.remove();
    }, { once: true });
}

/**
 * Set up geolocation detection for GPS coordinates and enhanced location search
 */
function setupLocationDetection() {
    const detectButton = document.getElementById('detect-location');
    const searchButton = document.getElementById('search-location');
    const locationInput = document.getElementById('location');
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');
    const coordinatesText = document.getElementById('coordinates-text');
    const coordinatesDisplay = document.getElementById('location-coordinates');
    
    // Search for a location in Ghana using our geocoding API
    searchButton.addEventListener('click', function() {
        const searchValue = locationInput.value.trim();
        
        if (!searchValue) {
            showLocationError("Please enter a location to search");
            return;
        }
        
        // Show loading state
        searchButton.disabled = true;
        searchButton.innerHTML = '<i data-lucide="loader"></i>';
        lucide.createIcons();
        
        // Call our geocoding API endpoint
        fetch(`/api/geocode?location=${encodeURIComponent(searchValue)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.locations && data.locations.length > 0) {
                    // Use the first result
                    const location = data.locations[0];
                    
                    // Update form values
                    latitudeInput.value = location.lat;
                    longitudeInput.value = location.lon;
                    locationInput.value = location.display_name.split(',')[0]; // Use first part of name
                    
                    // Update displayed coordinates
                    coordinatesText.textContent = `Found: ${location.display_name} (${location.lat.toFixed(4)}, ${location.lon.toFixed(4)})`;
                    coordinatesDisplay.classList.remove('hidden');
                } else if (data.fallback) {
                    // Use fallback location (Accra)
                    latitudeInput.value = data.fallback.lat;
                    longitudeInput.value = data.fallback.lon;
                    
                    // Update displayed coordinates
                    coordinatesText.textContent = `Location not found. Using: ${data.fallback.display_name} (${data.fallback.lat.toFixed(4)}, ${data.fallback.lon.toFixed(4)})`;
                    coordinatesDisplay.classList.remove('hidden');
                } else {
                    showLocationError("No locations found for your search");
                }
                
                // Reset button state
                searchButton.disabled = false;
                searchButton.innerHTML = '<i data-lucide="search"></i>';
                lucide.createIcons();
            })
            .catch(error => {
                console.error("Geocoding error:", error);
                showLocationError("Failed to search location. Please try again.");
                
                // Reset button state
                searchButton.disabled = false;
                searchButton.innerHTML = '<i data-lucide="search"></i>';
                lucide.createIcons();
            });
    });
    
    // GPS location detection
    detectButton.addEventListener('click', function() {
        if (navigator.geolocation) {
            detectButton.disabled = true;
            detectButton.innerHTML = '<i data-lucide="loader"></i>';
            lucide.createIcons();
            
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude.toFixed(4);
                const lon = position.coords.longitude.toFixed(4);
                
                latitudeInput.value = lat;
                longitudeInput.value = lon;
                coordinatesText.textContent = `Using GPS: (${lat}, ${lon})`;
                coordinatesDisplay.classList.remove('hidden');
                
                // Try to reverse geocode to get city name
                reverseGeocode(lat, lon, function(locationName) {
                    locationInput.value = locationName || 'GPS Location';
                });
                
                detectButton.disabled = false;
                detectButton.innerHTML = '<i data-lucide="map-pin"></i>';
                lucide.createIcons();
                
            }, function(error) {
                console.error("Geolocation error:", error);
                showLocationError(error.message);
                
                detectButton.disabled = false;
                detectButton.innerHTML = '<i data-lucide="map-pin"></i>';
                lucide.createIcons();
            });
        } else {
            showLocationError("Geolocation is not supported by your browser");
        }
    });
    
    // When user manually enters a location, prepare for search
    locationInput.addEventListener('keyup', function(event) {
        // Trigger search on Enter key
        if (event.key === 'Enter') {
            event.preventDefault();
            searchButton.click();
        }
    });
}

/**
 * Ghana location database for more accurate geocoding
 */
const ghanaLocations = {
    // Accra and neighborhoods
    'accra': { lat: 5.6037, lon: -0.1870 },
    'east legon': { lat: 5.6361, lon: -0.1545 },
    'airport': { lat: 5.6026, lon: -0.1691 },
    'cantonments': { lat: 5.5778, lon: -0.1831 },
    'osu': { lat: 5.5560, lon: -0.1870 },
    'labone': { lat: 5.5641, lon: -0.1745 },
    'adenta': { lat: 5.7071, lon: -0.1665 },
    'tema': { lat: 5.6698, lon: -0.0168 },
    'teshie': { lat: 5.5918, lon: -0.1122 },
    'nungua': { lat: 5.6010, lon: -0.0741 },
    'dansoman': { lat: 5.5338, lon: -0.2570 },
    'kasoa': { lat: 5.5257, lon: -0.4195 },
    'madina': { lat: 5.6682, lon: -0.1665 },
    'shiashie': { lat: 5.6469, lon: -0.1599 },
    'spintex': { lat: 5.6326, lon: -0.1241 },
    'lapaz': { lat: 5.6073, lon: -0.2542 },
    'achimota': { lat: 5.6197, lon: -0.2284 },
    
    // Other major cities
    'kumasi': { lat: 6.6885, lon: -1.6244 },
    'takoradi': { lat: 4.8970, lon: -1.7550 },
    'tamale': { lat: 9.4047, lon: -0.8424 },
    'cape coast': { lat: 5.1053, lon: -1.2466 },
    'koforidua': { lat: 6.0945, lon: 0.0554 },
    'ho': { lat: 6.6011, lon: 0.4714 },
    'sunyani': { lat: 7.3349, lon: -2.3269 },
    'techiman': { lat: 7.5912, lon: -1.9382 },
    'wa': { lat: 10.0579, lon: -2.5137 },
    'bolgatanga': { lat: 10.7867, lon: -0.8500 }
};

/**
 * Lookup location coordinates by name from Ghana location database
 */
function lookupLocation(locationName) {
    const locationNameLower = locationName.toLowerCase();
    
    // Try direct lookup first
    if (ghanaLocations[locationNameLower]) {
        return ghanaLocations[locationNameLower];
    }
    
    // Try to find partial matches
    for (const [key, value] of Object.entries(ghanaLocations)) {
        if (locationNameLower.includes(key) || key.includes(locationNameLower)) {
            return value;
        }
    }
    
    // Default to Accra if no match found
    return ghanaLocations['accra'];
}

/**
 * Simple reverse geocoding - in a real app would use a geocoding service
 */
function reverseGeocode(lat, lon, callback) {
    // Check if we can find a close match in our Ghana location database
    let closestLocation = "Unknown Location";
    let closestDistance = Number.MAX_VALUE;
    
    for (const [locationName, coords] of Object.entries(ghanaLocations)) {
        const distance = Math.sqrt(
            Math.pow(lat - coords.lat, 2) + 
            Math.pow(lon - coords.lon, 2)
        );
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestLocation = locationName.charAt(0).toUpperCase() + locationName.slice(1); // Capitalize
        }
    }
    
    // If we're close enough to a known location (within ~5km)
    if (closestDistance < 0.05) {
        callback(closestLocation);
    } else if (lat >= 5.5 && lat <= 5.8 && lon >= -0.3 && lon <= -0.05) {
        // Greater Accra region
        callback("Greater Accra");
    } else if (lat >= 6.5 && lat <= 7.0 && lon >= -1.8 && lon <= -1.4) {
        // Kumasi region
        callback("Kumasi Area");
    } else {
        // If we can't determine the city name, just use coordinates
        callback(`Location at (${lat}, ${lon})`);
    }
}

/**
 * Display location detection error
 */
function showLocationError(message) {
    alert("Location detection error: " + message + "\nUsing default Accra location instead.");
    
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');
    const coordinatesText = document.getElementById('coordinates-text');
    const coordinatesDisplay = document.getElementById('location-coordinates');
    
    // Set to Accra defaults
    latitudeInput.value = "5.6037";
    longitudeInput.value = "-0.1870";
    coordinatesText.textContent = `Using default: Accra (5.6037, -0.1870)`;
    coordinatesDisplay.classList.remove('hidden');
    
    document.getElementById('location').value = "Accra";
}

/**
 * Set up house orientation selection
 */
function setupDirectionSelection() {
    const orientationButtons = document.querySelectorAll('.orientation-btn');
    const azimuthInput = document.getElementById('azimuth');
    const selectedDirectionText = document.getElementById('selected-direction');
    
    orientationButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            orientationButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update azimuth input value
            azimuthInput.value = this.dataset.azimuth;
            
            // Update the selected direction text
            selectedDirectionText.textContent = this.textContent;
        });
    });
    
    // No default selection - user must choose
    azimuthInput.value = "";
    selectedDirectionText.textContent = "None";
}

/**
 * Set up roof type/tilt selection
 */
function setupRoofTypeSelection() {
    const roofTypeOptions = document.querySelectorAll('input[name="roof-type"]');
    const tiltInput = document.getElementById('tilt');
    
    roofTypeOptions.forEach(option => {
        option.addEventListener('change', function() {
            if (this.checked) {
                tiltInput.value = this.dataset.tilt;
            }
        });
    });
}

/**
 * Set up battery options
 */
function setupBatteryOptions() {
    const batteryOptions = document.querySelectorAll('input[name="battery-option"]');
    const includesBatteryInput = document.getElementById('includes-battery');
    
    batteryOptions.forEach(option => {
        option.addEventListener('change', function() {
            if (this.checked) {
                includesBatteryInput.value = this.value === 'yes';
            }
        });
    });
}

/**
 * Set up form submission and API call
 */
function setupFormSubmission() {
    const form = document.getElementById('solar-estimator-form');
    const resultsSection = document.getElementById('results-section');
    const loadingElement = document.getElementById('estimator-loading');
    const errorElement = document.getElementById('estimator-error');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!validateStep(4)) { // Validate last step
            return;
        }
        
        // Get form data
        const latitude = document.getElementById('latitude').value;
        const longitude = document.getElementById('longitude').value;
        const azimuth = document.getElementById('azimuth').value;
        const tilt = document.getElementById('tilt').value;
        const monthlySpend = parseFloat(document.getElementById('monthly-spend').value);
        
        // Calculate system size based on monthly spend
        let tariff, monthlyKWh, systemSizeKW;
        
        if (monthlySpend <= 525) {
            tariff = 1.76; // for 0–300 kWh bracket
        } else {
            tariff = 2.32; // for 301+ kWh bracket
        }
        
        monthlyKWh = monthlySpend / tariff;
        systemSizeKW = monthlyKWh / 120; // average monthly solar output per kW in Ghana
        
        // Show loading
        form.classList.add('hidden');
        loadingElement.classList.remove('hidden');
        errorElement.classList.add('hidden');
        
        // Build proxy API URL to avoid CORS issues
        const apiUrl = `/api/pvgis?lat=${latitude}&lon=${longitude}&peakpower=${systemSizeKW.toFixed(2)}&loss=14&angle=${tilt}&aspect=${azimuth}`;
        
        // Make the API call through our proxy
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Process results and update UI
                processResults(data, systemSizeKW, monthlyKWh);
                
                // Hide loading, show results
                loadingElement.classList.add('hidden');
                resultsSection.classList.remove('hidden');
            })
            .catch(error => {
                console.error('API Error:', error);
                
                // Show error message
                loadingElement.classList.add('hidden');
                errorElement.classList.remove('hidden');
                document.getElementById('error-message').textContent = `We couldn't retrieve solar data: ${error.message}. Please try again.`;
                
                // Generate fallback results if API fails
                generateFallbackResults(systemSizeKW, monthlyKWh);
            });
    });
}

/**
 * Process results from PVGIS API
 */
function processResults(data, systemSizeKW, monthlyKWh) {
    try {
        // Extract values from API response
        const kWhPerYear = data.outputs.totals.fixed.E_y;
        const CO2Saved = data.outputs.totals.fixed.CO2_savings;
        
        // Calculate number of panels and cost (using 400W panels standard)
        const numPanels = Math.ceil(systemSizeKW * 1000 / 400);
        
        // Updated pricing based on real market data (May 2025)
        // Solar panel cost: ~GHS 1,500 for a 400W panel
        const panelsCost = numPanels * 1500;
        
        // Inverter costs (scaled by system size)
        // For systems < 3kW: ~GHS 4,000, for larger systems: ~GHS 6,000-8,000
        const inverterCost = systemSizeKW < 3 ? 4000 : (systemSizeKW < 5 ? 6000 : 8000);
        
        // Installation components (mounting, cables, etc)
        // Base cost of GHS 2,000 plus GHS 500 per kW
        const installationCost = 2000 + (systemSizeKW * 500);
        
        // Calculate total system cost without batteries
        const systemCost = panelsCost + inverterCost + installationCost;
        
        // Calculate battery costs if selected
        const includesBattery = document.getElementById('includes-battery').value === 'true';
        let batteryKWh = 0;
        let batteryCost = 0;
        let totalCost = systemCost;
        
        if (includesBattery) {
            // Size battery for 1/3 daily consumption or minimum 5kWh
            batteryKWh = Math.max(5, Math.ceil(monthlyKWh / 30 / 3));
            
            // Updated battery pricing: ~GHS 2,500 per kWh for lead-acid, ~GHS 7,000 per kWh for lithium
            // Using an average price that considers most installations use lead-acid
            batteryCost = batteryKWh * 3500;
            
            // Add battery installation cost
            batteryCost += 1500;
            
            totalCost += batteryCost;
        }
        
        // Calculate yearly and lifetime savings
        const monthlySpend = parseFloat(document.getElementById('monthly-spend').value);
        const yearlySavings = monthlySpend * 12;  // Simplification: assume all monthly spend is saved
        const lifetimeSavings = yearlySavings * 25;  // 25 year system lifespan
        const paybackYears = totalCost / yearlySavings;
        
        // Update results UI
        document.getElementById('yearly-production').textContent = kWhPerYear.toLocaleString();
        document.getElementById('yearly-savings').textContent = `GHS ${yearlySavings.toLocaleString()}`;
        document.getElementById('co2-savings').textContent = Math.round(CO2Saved).toLocaleString();
        document.getElementById('panels-needed').textContent = numPanels;
        document.getElementById('total-cost').textContent = `GHS ${totalCost.toLocaleString()}`;
        document.getElementById('lifetime-savings').textContent = `GHS ${lifetimeSavings.toLocaleString()}`;
        
        // Update battery information
        if (includesBattery) {
            document.getElementById('battery-status').textContent = `${batteryKWh} kWh`;
            document.getElementById('battery-details').textContent = `GHS ${batteryCost.toLocaleString()}`;
        } else {
            document.getElementById('battery-status').textContent = 'None';
            document.getElementById('battery-details').textContent = 'Grid-tied only';
        }
        
        // Update system details
        document.getElementById('system-size').textContent = `${systemSizeKW.toFixed(2)} kWp`;
        document.getElementById('monthly-production').textContent = `${Math.round(kWhPerYear / 12)} kWh/month`;
        document.getElementById('payback-period').textContent = `${paybackYears.toFixed(1)} years`;
        
        // Update roof orientation based on azimuth
        const azimuth = parseInt(document.getElementById('azimuth').value);
        let orientation;
        
        // 8-direction compass mapping
        if (azimuth === 0) orientation = "Back (North)";
        else if (azimuth === 45) orientation = "Back Left (NW)";
        else if (azimuth === 90) orientation = "Left (West)";
        else if (azimuth === 135) orientation = "Front Left (SW)";
        else if (azimuth === 180) orientation = "Front (South)";
        else if (azimuth === 225) orientation = "Front Right (SE)";
        else if (azimuth === 270) orientation = "Right (East)";
        else if (azimuth === 315) orientation = "Back Right (NE)";
        else orientation = `Custom (${azimuth}°)`;
        
        document.getElementById('roof-orientation').textContent = orientation;
        
        // Save calculation to database
        saveCalculationToDatabase({
            location: document.getElementById('location').value,
            latitude: parseFloat(document.getElementById('latitude').value),
            longitude: parseFloat(document.getElementById('longitude').value),
            azimuth: azimuth,
            tilt: parseInt(document.getElementById('tilt').value),
            monthlySpend: monthlySpend,
            includesBattery: includesBattery,
            systemSizeKW: systemSizeKW,
            monthlyKWh: monthlyKWh,
            yearlyProduction: kWhPerYear,
            co2Savings: CO2Saved,
            panelsNeeded: numPanels,
            systemCost: systemCost,
            batteryCost: batteryCost,
            totalCost: totalCost,
            yearlySavings: yearlySavings,
            lifetimeSavings: lifetimeSavings,
            paybackYears: paybackYears,
            isFallback: false
        });
        
    } catch (error) {
        console.error('Error processing results:', error);
        generateFallbackResults(systemSizeKW, monthlyKWh);
    }
}

/**
 * Generate fallback results if API call fails
 */
function generateFallbackResults(systemSizeKW, monthlyKWh) {
    // Based on Ghana's average solar irradiation
    const averageSolarOutput = 1600; // kWh per kWp per year
    const kWhPerYear = systemSizeKW * averageSolarOutput;
    const CO2Saved = kWhPerYear * 0.5; // Approximate CO2 factor
    
    // Calculate number of panels and cost
    const numPanels = Math.ceil(systemSizeKW * 1000 / 400);
    const systemCost = numPanels * 3450 + 6000;  // Solar panel system cost
    
    // Calculate battery costs if selected
    const includesBattery = document.getElementById('includes-battery').value === 'true';
    let batteryKWh = 0;
    let batteryCost = 0;
    let totalCost = systemCost;
    
    if (includesBattery) {
        // Size battery for 1/3 daily consumption or minimum 5kWh
        batteryKWh = Math.max(5, Math.ceil(monthlyKWh / 30 / 3));
        batteryCost = batteryKWh * 3000;  // Approx GHS 3,000 per kWh of battery storage
        totalCost += batteryCost;
    }
    
    // Calculate yearly and lifetime savings
    const monthlySpend = parseFloat(document.getElementById('monthly-spend').value);
    const yearlySavings = monthlySpend * 12;  // Simplification: assume all monthly spend is saved
    const lifetimeSavings = yearlySavings * 25;  // 25 year system lifespan
    const paybackYears = totalCost / yearlySavings;
    
    // Update results UI
    document.getElementById('yearly-production').textContent = Math.round(kWhPerYear).toLocaleString();
    document.getElementById('yearly-savings').textContent = `GHS ${yearlySavings.toLocaleString()}`;
    document.getElementById('co2-savings').textContent = Math.round(CO2Saved).toLocaleString();
    document.getElementById('panels-needed').textContent = numPanels;
    document.getElementById('total-cost').textContent = `GHS ${totalCost.toLocaleString()}`;
    document.getElementById('lifetime-savings').textContent = `GHS ${lifetimeSavings.toLocaleString()}`;
    
    // Update battery information
    if (includesBattery) {
        document.getElementById('battery-status').textContent = `${batteryKWh} kWh`;
        document.getElementById('battery-details').textContent = `GHS ${batteryCost.toLocaleString()}`;
    } else {
        document.getElementById('battery-status').textContent = 'None';
        document.getElementById('battery-details').textContent = 'Grid-tied only';
    }
    
    // Update system details
    document.getElementById('system-size').textContent = `${systemSizeKW.toFixed(2)} kWp`;
    document.getElementById('monthly-production').textContent = `${Math.round(kWhPerYear / 12)} kWh/month`;
    document.getElementById('payback-period').textContent = `${paybackYears.toFixed(1)} years`;
    
    // Update roof orientation based on azimuth
    const azimuth = parseInt(document.getElementById('azimuth').value);
    let orientation;
    
    if (azimuth === 0) orientation = "North";
    else if (azimuth === 90) orientation = "East";
    else if (azimuth === 180) orientation = "South";
    else if (azimuth === 270) orientation = "West";
    
    document.getElementById('roof-orientation').textContent = orientation;
    
    // Save calculation to database with fallback flag
    saveCalculationToDatabase({
        location: document.getElementById('location').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        azimuth: azimuth,
        tilt: parseInt(document.getElementById('tilt').value),
        monthlySpend: monthlySpend,
        includesBattery: includesBattery,
        systemSizeKW: systemSizeKW,
        monthlyKWh: monthlyKWh,
        yearlyProduction: kWhPerYear,
        co2Savings: CO2Saved,
        panelsNeeded: numPanels,
        systemCost: systemCost,
        batteryCost: batteryCost,
        totalCost: totalCost,
        yearlySavings: yearlySavings,
        lifetimeSavings: lifetimeSavings,
        paybackYears: paybackYears,
        isFallback: true
    });
    
    // Show results
    document.getElementById('estimator-loading').classList.add('hidden');
    document.getElementById('estimator-error').classList.add('hidden');
    document.getElementById('results-section').classList.remove('hidden');
}

/**
 * Save calculation to database
 */
function saveCalculationToDatabase(calculationData) {
    fetch('/api/calculations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(calculationData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Calculation saved with ID:', data.id);
            
            // Add a view history button to results actions
            const resultsActions = document.querySelector('.results-actions');
            if (resultsActions && !document.getElementById('view-history-btn')) {
                const historyBtn = document.createElement('a');
                historyBtn.id = 'view-history-btn';
                historyBtn.href = '/history';
                historyBtn.className = 'btn btn-outline';
                historyBtn.innerHTML = '<i data-lucide="history"></i> View Calculation History';
                
                resultsActions.appendChild(historyBtn);
                lucide.createIcons(historyBtn);
            }
        } else {
            console.error('Error saving calculation:', data.error);
        }
    })
    .catch(error => {
        console.error('Network error saving calculation:', error);
    });
}

/**
 * Check for recalculation parameter
 */
function checkForRecalculation() {
    const urlParams = new URLSearchParams(window.location.search);
    const recalculateId = urlParams.get('recalculate');
    
    if (recalculateId) {
        // Show loading
        const form = document.getElementById('solar-estimator-form');
        const loadingElement = document.getElementById('estimator-loading');
        
        form.classList.add('hidden');
        loadingElement.classList.remove('hidden');
        
        // Fetch the calculation details
        fetch(`/api/calculations/${recalculateId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'An error occurred');
                }
                
                const calculation = data.calculation;
                
                // Fill in the form fields
                document.getElementById('location').value = calculation.location;
                document.getElementById('latitude').value = calculation.latitude;
                document.getElementById('longitude').value = calculation.longitude;
                document.getElementById('azimuth').value = calculation.azimuth;
                document.getElementById('tilt').value = calculation.tilt;
                document.getElementById('monthly-spend').value = calculation.monthly_spend;
                
                // Show the coordinates display
                const coordinatesDisplay = document.getElementById('location-coordinates');
                const coordinatesText = document.getElementById('coordinates-text');
                coordinatesText.textContent = `Using: (${calculation.latitude}, ${calculation.longitude})`;
                coordinatesDisplay.classList.remove('hidden');
                
                // Hide loading and show form
                loadingElement.classList.add('hidden');
                form.classList.remove('hidden');
                
                // Navigate to the last step
                const steps = document.querySelectorAll('.form-step');
                steps.forEach(step => step.classList.add('hidden'));
                document.querySelector('.form-step[data-step="4"]').classList.remove('hidden');
                
                // Select the correct direction button
                const directionBtn = document.querySelector(`.direction-btn[data-azimuth="${calculation.azimuth}"]`);
                if (directionBtn) {
                    directionBtn.click();
                }
                
                // Select the correct roof type
                let roofTypeValue;
                if (calculation.tilt === 5) roofTypeValue = "flat";
                else if (calculation.tilt === 15) roofTypeValue = "slight";
                else if (calculation.tilt === 30) roofTypeValue = "steep";
                
                const roofTypeOption = document.querySelector(`input[name="roof-type"][value="${roofTypeValue}"]`);
                if (roofTypeOption) {
                    roofTypeOption.checked = true;
                }
            })
            .catch(error => {
                console.error('Error loading calculation for recalculation:', error);
                loadingElement.classList.add('hidden');
                form.classList.remove('hidden');
            });
    }
}

/**
 * Set up results page actions (start over, print)
 */
function setupResultsActions() {
    const startOverBtn = document.getElementById('start-over-btn');
    const printResultsBtn = document.getElementById('print-results-btn');
    const form = document.getElementById('solar-estimator-form');
    const resultsSection = document.getElementById('results-section');
    
    if (startOverBtn) {
        startOverBtn.addEventListener('click', function() {
            // Reset form
            form.reset();
            
            // Show first step
            document.querySelectorAll('.form-step').forEach(step => {
                step.classList.add('hidden');
            });
            document.querySelector('.form-step[data-step="1"]').classList.remove('hidden');
            
            // Hide results
            resultsSection.classList.add('hidden');
            
            // Show form
            form.classList.remove('hidden');
            
            // Reset any visualizations
            const houseIndicator = document.querySelector('.house-indicator');
            if (houseIndicator) {
                houseIndicator.style.transform = `rotate(180deg)`;
            }
            
            // Reset direction buttons
            document.querySelectorAll('.direction-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            const defaultDirection = document.querySelector('[data-direction="front"]');
            if (defaultDirection) {
                defaultDirection.classList.add('active');
            }
            
            // Reset coordinates display
            document.getElementById('location-coordinates').classList.add('hidden');
        });
    }
    
    if (printResultsBtn) {
        printResultsBtn.addEventListener('click', function() {
            window.print();
        });
    }
    
    // Handle "Try Again" button on error
    const tryAgainBtn = document.getElementById('try-again-btn');
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', function() {
            document.getElementById('estimator-error').classList.add('hidden');
            form.classList.remove('hidden');
        });
    }
}
