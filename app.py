import os
import requests
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from models import db, SolarCalculation


def _require_number(value, name, cast_type=float, minimum=None):
    """Validate that a numeric field exists and meets optional constraints."""
    if value is None:
        raise ValueError(f"{name} is required")

    try:
        number = cast_type(value)
    except (TypeError, ValueError):
        friendly_type = "integer" if cast_type is int else "number"
        raise ValueError(f"{name} must be a valid {friendly_type}")

    if minimum is not None and number < minimum:
        raise ValueError(f"{name} must be at least {minimum}")

    return number

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
        data = request.get_json() or {}

        # Validate and coerce numeric inputs
        latitude = _require_number(data.get('latitude'), 'Latitude')
        longitude = _require_number(data.get('longitude'), 'Longitude')
        azimuth = _require_number(data.get('azimuth'), 'Azimuth', int)
        tilt = _require_number(data.get('tilt'), 'Tilt', int)
        monthly_spend = _require_number(data.get('monthlySpend'), 'Monthly spend', minimum=0)
        system_size_kw = _require_number(data.get('systemSizeKW'), 'System size (kW)', minimum=0)
        monthly_kwh = _require_number(data.get('monthlyKWh'), 'Monthly usage (kWh)', minimum=0)
        yearly_production = _require_number(data.get('yearlyProduction'), 'Yearly production', minimum=0)
        co2_savings = _require_number(data.get('co2Savings'), 'CO₂ savings', minimum=0)
        panels_needed = _require_number(data.get('panelsNeeded'), 'Panels needed', int, minimum=1)
        system_cost = _require_number(data.get('systemCost'), 'System cost', minimum=0)

        location = data.get('location', 'Unknown')

        # Create a new calculation record
        calculation = SolarCalculation(
            location=location,
            latitude=latitude,
            longitude=longitude,
            azimuth=azimuth,
            tilt=tilt,
            monthly_spend=monthly_spend,
            system_size_kw=system_size_kw,
            monthly_kwh=monthly_kwh,
            yearly_production=yearly_production,
            co2_savings=co2_savings,
            panels_needed=panels_needed,
            system_cost=system_cost,
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
        limit_param = request.args.get('limit', 10, type=int)

        if limit_param is None:
            return jsonify({
                'success': False,
                'error': 'Limit must be a valid integer'
            }), 400

        # Clamp limit between 1 and 100 to avoid excessive responses
        limit = max(1, min(limit_param, 100))
        
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
