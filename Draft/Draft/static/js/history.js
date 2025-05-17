document.addEventListener('DOMContentLoaded', function() {
    // Load calculation history
    loadCalculationHistory();
    
    // Set up retry button
    document.getElementById('retry-history').addEventListener('click', loadCalculationHistory);
    
    // Set up modal close
    const modal = document.getElementById('calculation-modal');
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
    
    // Set up recalculate button
    document.getElementById('recalculate-btn').addEventListener('click', function() {
        const calculationId = this.dataset.calculationId;
        window.location.href = `/estimator?recalculate=${calculationId}`;
    });
});

/**
 * Load calculation history from the API
 */
function loadCalculationHistory() {
    const historyLoading = document.getElementById('history-loading');
    const historyEmpty = document.getElementById('history-empty');
    const historyError = document.getElementById('history-error');
    const historyList = document.getElementById('history-list');
    const historyGrid = document.querySelector('.history-grid');
    
    // Show loading
    historyLoading.classList.remove('hidden');
    historyEmpty.classList.add('hidden');
    historyError.classList.add('hidden');
    historyList.classList.add('hidden');
    
    // Fetch calculation history
    fetch('/api/calculations')
        .then(response => {
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Hide loading
            historyLoading.classList.add('hidden');
            
            if (!data.success) {
                throw new Error(data.error || 'An error occurred');
            }
            
            if (!data.calculations || data.calculations.length === 0) {
                // Show empty state
                historyEmpty.classList.remove('hidden');
                return;
            }
            
            // Clear grid and populate with calculations
            historyGrid.innerHTML = '';
            
            data.calculations.forEach(calculation => {
                const card = createCalculationCard(calculation);
                historyGrid.appendChild(card);
            });
            
            // Show history list
            historyList.classList.remove('hidden');
            
            // Set up view details buttons
            document.querySelectorAll('.view-calculation-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const calculationId = this.dataset.id;
                    showCalculationDetails(calculationId);
                });
            });
        })
        .catch(error => {
            console.error('Error loading calculations:', error);
            
            // Show error state
            historyLoading.classList.add('hidden');
            historyError.classList.remove('hidden');
            document.getElementById('history-error-message').textContent = `Error: ${error.message}`;
        });
}

/**
 * Create a calculation card element
 */
function createCalculationCard(calculation) {
    const card = document.createElement('div');
    card.className = 'history-card';
    
    // Get formatted date
    const date = new Date(calculation.created_at);
    const formattedDate = date.toLocaleDateString('en-GH', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Get direction name based on azimuth
    let direction = '';
    switch(calculation.azimuth) {
        case 0: direction = 'North'; break;
        case 90: direction = 'East'; break;
        case 180: direction = 'South'; break;
        case 270: direction = 'West'; break;
        default: direction = `${calculation.azimuth}°`;
    }
    
    card.innerHTML = `
        <div class="card-header">
            <h4>${calculation.location}</h4>
            <span class="card-date">${formattedDate}</span>
        </div>
        <div class="card-body">
            <div class="card-stat">
                <div class="card-stat-value">${Math.round(calculation.system_size_kw * 100) / 100} kWp</div>
                <div class="card-stat-label">System Size</div>
            </div>
            <div class="card-stat">
                <div class="card-stat-value">${Math.round(calculation.yearly_production).toLocaleString()} kWh</div>
                <div class="card-stat-label">Yearly Output</div>
            </div>
            <div class="card-stat">
                <div class="card-stat-value">${direction}</div>
                <div class="card-stat-label">Direction</div>
            </div>
            <div class="card-stat">
                <div class="card-stat-value">GHS ${Math.round(calculation.system_cost).toLocaleString()}</div>
                <div class="card-stat-label">System Cost</div>
            </div>
        </div>
        <div class="card-footer">
            <button class="btn btn-outline view-calculation-btn" data-id="${calculation.id}">
                <i data-lucide="eye"></i>
                View Details
            </button>
        </div>
    `;
    
    // Create icons
    lucide.createIcons(card);
    
    return card;
}

/**
 * Show calculation details in modal
 */
function showCalculationDetails(calculationId) {
    const modal = document.getElementById('calculation-modal');
    const modalLoading = document.getElementById('modal-loading');
    const modalContent = document.getElementById('modal-content');
    const recalculateBtn = document.getElementById('recalculate-btn');
    
    // Show modal and loading state
    modal.classList.add('active');
    modalLoading.classList.remove('hidden');
    modalContent.classList.add('hidden');
    
    // Fetch calculation details
    fetch(`/api/calculations/${calculationId}`)
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
            
            // Fill modal with calculation details
            document.getElementById('modal-location').textContent = calculation.location;
            document.getElementById('modal-coordinates').textContent = `${calculation.latitude}, ${calculation.longitude}`;
            
            // Direction based on azimuth
            let direction = '';
            switch(calculation.azimuth) {
                case 0: direction = 'North (0°)'; break;
                case 90: direction = 'East (90°)'; break;
                case 180: direction = 'South (180°)'; break;
                case 270: direction = 'West (270°)'; break;
                default: direction = `${calculation.azimuth}°`;
            }
            document.getElementById('modal-direction').textContent = direction;
            
            // Tilt label
            let tiltLabel = '';
            switch(calculation.tilt) {
                case 5: tiltLabel = 'Flat (5°)'; break;
                case 15: tiltLabel = 'Slightly Sloped (15°)'; break;
                case 30: tiltLabel = 'Steep (30°)'; break;
                default: tiltLabel = `${calculation.tilt}°`;
            }
            document.getElementById('modal-tilt').textContent = tiltLabel;
            
            // System details
            document.getElementById('modal-system-size').textContent = `${calculation.system_size_kw.toFixed(2)} kWp`;
            document.getElementById('modal-monthly-consumption').textContent = `${Math.round(calculation.monthly_kwh)} kWh/month`;
            document.getElementById('modal-monthly-bill').textContent = `GHS ${calculation.monthly_spend.toLocaleString()}`;
            
            // Results
            document.getElementById('modal-yearly-production').textContent = `${Math.round(calculation.yearly_production).toLocaleString()} kWh/year`;
            document.getElementById('modal-co2-savings').textContent = `${Math.round(calculation.co2_savings).toLocaleString()} kg/year`;
            document.getElementById('modal-panels-needed').textContent = `${calculation.panels_needed} panels (400W)`;
            document.getElementById('modal-system-cost').textContent = `GHS ${Math.round(calculation.system_cost).toLocaleString()}`;
            
            // Metadata
            const date = new Date(calculation.created_at);
            document.getElementById('modal-date').textContent = date.toLocaleString('en-GH');
            document.getElementById('modal-id').textContent = calculation.id;
            
            // Set recalculate button data
            recalculateBtn.dataset.calculationId = calculation.id;
            
            // Show content
            modalLoading.classList.add('hidden');
            modalContent.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error loading calculation details:', error);
            modalLoading.classList.add('hidden');
            modalContent.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i data-lucide="alert-triangle"></i>
                    </div>
                    <h3>Error Loading Details</h3>
                    <p>${error.message}</p>
                </div>
            `;
            modalContent.classList.remove('hidden');
            lucide.createIcons(modalContent);
        });
}