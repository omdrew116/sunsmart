from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class SolarCalculation(db.Model):
    """Model for storing solar calculation history"""
    id = db.Column(db.Integer, primary_key=True)
    
    # User input data
    location = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    azimuth = db.Column(db.Integer, nullable=False)  # Compass direction
    tilt = db.Column(db.Integer, nullable=False)  # Roof angle
    monthly_spend = db.Column(db.Float, nullable=False)  # GHS per month
    includes_battery = db.Column(db.Boolean, default=False)  # Whether batteries are included
    
    # Calculated values
    system_size_kw = db.Column(db.Float, nullable=False)  # Peak power in kW
    monthly_kwh = db.Column(db.Float, nullable=False)  # Monthly electricity usage
    
    # Results from API or fallback calculation
    yearly_production = db.Column(db.Float, nullable=True)  # kWh per year
    co2_savings = db.Column(db.Float, nullable=True)  # kg per year
    panels_needed = db.Column(db.Integer, nullable=True)  # Number of 400W panels
    system_cost = db.Column(db.Float, nullable=True)  # Total cost in GHS
    battery_cost = db.Column(db.Float, nullable=True)  # Battery cost in GHS
    total_cost = db.Column(db.Float, nullable=True)  # Total system cost with batteries
    
    # Savings calculations
    yearly_savings = db.Column(db.Float, nullable=True)  # GHS saved per year
    lifetime_savings = db.Column(db.Float, nullable=True)  # GHS saved over 25 years
    payback_years = db.Column(db.Float, nullable=True)  # Years to payback
    
    # Used fallback calculation instead of API
    is_fallback = db.Column(db.Boolean, default=False)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    client_ip = db.Column(db.String(45), nullable=True)  # Store IP for rate limiting
    
    def __init__(self, location, latitude, longitude, azimuth, tilt, monthly_spend, 
                 system_size_kw, monthly_kwh, yearly_production, co2_savings, 
                 panels_needed, system_cost, is_fallback=False, client_ip=None,
                 includes_battery=False, battery_cost=0, total_cost=None,
                 yearly_savings=None, lifetime_savings=None, payback_years=None):
        self.location = location
        self.latitude = latitude
        self.longitude = longitude
        self.azimuth = azimuth
        self.tilt = tilt
        self.monthly_spend = monthly_spend
        self.system_size_kw = system_size_kw
        self.monthly_kwh = monthly_kwh
        self.yearly_production = yearly_production
        self.co2_savings = co2_savings
        self.panels_needed = panels_needed
        self.system_cost = system_cost
        self.is_fallback = is_fallback
        self.client_ip = client_ip
        self.includes_battery = includes_battery
        self.battery_cost = battery_cost
        self.total_cost = total_cost if total_cost is not None else system_cost
        self.yearly_savings = yearly_savings if yearly_savings is not None else monthly_spend * 12
        self.lifetime_savings = lifetime_savings if lifetime_savings is not None else self.yearly_savings * 25
        self.payback_years = payback_years if payback_years is not None else self.total_cost / self.yearly_savings
    
    def __repr__(self):
        return f"<SolarCalculation {self.id} - {self.location}>"
    
    def to_dict(self):
        """Convert the model to a dictionary for API responses"""
        return {
            'id': self.id,
            'location': self.location,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'azimuth': self.azimuth,
            'tilt': self.tilt,
            'monthly_spend': self.monthly_spend,
            'includes_battery': self.includes_battery,
            'system_size_kw': self.system_size_kw,
            'monthly_kwh': self.monthly_kwh,
            'yearly_production': self.yearly_production,
            'co2_savings': self.co2_savings,
            'panels_needed': self.panels_needed,
            'system_cost': self.system_cost,
            'battery_cost': self.battery_cost,
            'total_cost': self.total_cost,
            'yearly_savings': self.yearly_savings,
            'lifetime_savings': self.lifetime_savings,
            'payback_years': self.payback_years,
            'is_fallback': self.is_fallback,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
