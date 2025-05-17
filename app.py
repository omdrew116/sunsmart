import os
import requests
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from models import db, SolarCalculation

# create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "sunsmart-solar-app")

# Configure the SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///sunsmart.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize the database
db.init_app(app)

# Create all tables
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/estimator')
def estimator():
    return render_template('estimator.html')

@app.route('/history')
def history():
    return render_template('history.html')

@app.route('/api/pvgis', methods=['GET'])
def pvgis_proxy():
    # Get parameters from the request
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    peakpower = request.args.get('peakpower')
    loss = request.args.get('loss', '14')
    angle = request.args.get('angle')
    aspect = request.args.get('aspect')
    
    # Build PVGIS API URL
    api_url = f"https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat={lat}&lon={lon}&peakpower={peakpower}&loss={loss}&angle={angle}&aspect={aspect}&outputformat=json"
    
    try:
        # Make the request to PVGIS API
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()  # Raise an exception for error status codes
        return jsonify(response.json())
    
    except requests.exceptions.RequestException as e:
        # Handle any errors
        return jsonify({"error": str(e)}), 500

@app.route('/api/calculations', methods=['POST'])
def save_calculation():
    """Save a new solar calculation to the database"""
    try:
        data = request.get_json()
        
        # Create a new calculation record
        calculation = SolarCalculation(
            location=data.get('location', 'Unknown'),
            latitude=float(data.get('latitude')),
            longitude=float(data.get('longitude')),
            azimuth=int(data.get('azimuth')),
            tilt=int(data.get('tilt')),
            monthly_spend=float(data.get('monthlySpend')),
            system_size_kw=float(data.get('systemSizeKW')),
            monthly_kwh=float(data.get('monthlyKWh')),
            yearly_production=float(data.get('yearlyProduction')),
            co2_savings=float(data.get('co2Savings')),
            panels_needed=int(data.get('panelsNeeded')),
            system_cost=float(data.get('systemCost')),
            is_fallback=data.get('isFallback', False),
            client_ip=request.remote_addr
        )
        
        # Save to database
        db.session.add(calculation)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'id': calculation.id,
            'message': 'Calculation saved successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/calculations', methods=['GET'])
def get_calculations():
    """Get all calculations, with optional limit parameter"""
    try:
        limit = request.args.get('limit', 10, type=int)
        
        calculations = SolarCalculation.query.order_by(
            SolarCalculation.created_at.desc()
        ).limit(limit).all()
        
        return jsonify({
            'success': True,
            'calculations': [calc.to_dict() for calc in calculations]
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/calculations/<int:calc_id>', methods=['GET'])
def get_calculation(calc_id):
    """Get a specific calculation by ID"""
    calculation = SolarCalculation.query.get_or_404(calc_id)
    
    return jsonify({
        'success': True,
        'calculation': calculation.to_dict()
    })

@app.route('/api/geocode', methods=['GET'])
def geocode_location():
    """Geocode a location in Ghana using OpenStreetMap Nominatim API"""
    location = request.args.get('location', '')
    
    if not location:
        return jsonify({
            'success': False,
            'error': 'Location parameter is required'
        }), 400
    
    # Append 'Ghana' to ensure we get results in Ghana
    search_query = f"{location}, Ghana"
    
    # Use Nominatim (OpenStreetMap) API for geocoding
    nominatim_url = "https://nominatim.openstreetmap.org/search"
    params = {
        'q': search_query,
        'format': 'json',
        'limit': 5,
        'countrycodes': 'gh' # Ghana country code
    }
    
    headers = {
        'User-Agent': 'SunSmart Solar Estimator/1.0'
    }
    
    try:
        response = requests.get(nominatim_url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        results = response.json()
        
        if not results:
            return jsonify({
                'success': False,
                'message': 'No locations found',
                'fallback': {
                    'lat': 5.6037,
                    'lon': -0.1870,
                    'display_name': 'Accra, Ghana'
                }
            })
        
        # Format the results
        locations = []
        for result in results:
            locations.append({
                'lat': float(result['lat']),
                'lon': float(result['lon']),
                'display_name': result['display_name'],
                'place_type': result.get('type')
            })
        
        return jsonify({
            'success': True,
            'locations': locations
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'fallback': {
                'lat': 5.6037,
                'lon': -0.1870,
                'display_name': 'Accra, Ghana'
            }
        }), 500

if __name__ == "__main__":
    # Only run this in development
    app.run(debug=True)

# Add this line at the end of the file
app = app
