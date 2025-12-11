import math
from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field, validator


class RoofFacet(BaseModel):
    """Represents a single roof facet being simulated."""

    name: Optional[str] = None
    capacity_kwp: float = Field(..., gt=0, description="Installed capacity on this roof facet in kWp")
    monthly_kwh: Optional[List[float]] = Field(
        default=None, description="Monthly energy output values for this facet (12 numbers)"
    )
    annual_kwh: Optional[float] = Field(
        default=None, description="Annual energy output for this facet if monthly data is absent"
    )

    @validator("monthly_kwh")
    def validate_monthly(cls, value: Optional[List[float]]):
        if value is not None and len(value) != 12:
            raise ValueError("monthly_kwh must contain 12 monthly values")
        return value


class Appliance(BaseModel):
    name: str
    wattage: float  # W
    quantity: int
    hours_per_day: float


class StorageConfig(BaseModel):
    enabled: bool = False
    appliances: List[Appliance] = []


class SimulationRequest(BaseModel):
    facets: List[RoofFacet]
    storage: Optional[StorageConfig] = None


app = FastAPI()


def simulate_energy(request: SimulationRequest):
    results = []
    total_annual = 0.0
    total_capacity = 0.0

    # ========== STORAGE CALCULATION ==========
    storage_results = None
    if request.storage and request.storage.enabled:
        daily_load = 0
        for ap in request.storage.appliances:
            daily_load += (ap.wattage * ap.quantity * ap.hours_per_day) / 1000  # convert Wh → kWh

        # Battery size needed
        autonomy_days = 1
        DOD = 0.8
        efficiency = 0.9
        required_battery_kwh = (daily_load * autonomy_days) / (DOD * efficiency)

        module_size_kwh = 5
        battery_count = math.ceil(required_battery_kwh / module_size_kwh)

        storage_results = {
            "daily_load_kwh": round(daily_load, 2),
            "required_battery_kwh": round(required_battery_kwh, 2),
            "battery_module_size_kwh": module_size_kwh,
            "battery_count": battery_count,
        }

    system_monthly_kwh = [0.0] * 12
    system_monthly_savings = [0.0] * 12

    for facet in request.facets:
        if facet.monthly_kwh is not None:
            monthly = facet.monthly_kwh
            annual = sum(monthly)
        elif facet.annual_kwh is not None:
            monthly = [facet.annual_kwh / 12.0] * 12
            annual = facet.annual_kwh
        else:
            # Basic fallback: assume 120 kWh/month per installed kW if no production data is provided
            monthly = [facet.capacity_kwp * 10.0] * 12
            annual = sum(monthly)

        total_capacity += facet.capacity_kwp
        total_annual += annual
        system_monthly_kwh = [a + b for a, b in zip(system_monthly_kwh, monthly)]

        results.append(
            {
                "name": facet.name or f"Facet {len(results) + 1}",
                "capacity_kwp": round(facet.capacity_kwp, 3),
                "annual_kwh": round(annual, 2),
                "monthly_kwh": [round(m, 2) for m in monthly],
            }
        )

    # Simple savings estimation using a flat rate
    tariff_rate = 2.32
    system_monthly_savings = [kwh * tariff_rate for kwh in system_monthly_kwh]
    system_annual_savings = sum(system_monthly_savings)
    system_lifetime_savings = system_annual_savings * 25

    response = {
        "system_total_capacity_kwp": round(total_capacity, 3),
        "system_total_annual_kwh": round(total_annual, 2),
        "details": results,
    }

    # Only include monthly savings if storage is enabled
    if request.storage and request.storage.enabled:
        response["system_financials"] = {
            "monthly_kwh": [round(m, 2) for m in system_monthly_kwh],
            "monthly_savings_ghs": [round(m, 2) for m in system_monthly_savings],
            "annual_savings_ghs": round(system_annual_savings, 2),
            "lifetime_savings_ghs": round(system_lifetime_savings, 2),
        }
        response["storage"] = storage_results

    else:
        response["system_financials"] = None
        response["storage"] = None

    return response


@app.post("/simulate")
async def simulate(request: SimulationRequest):
    return simulate_energy(request)
