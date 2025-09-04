from flask import Flask, render_template, request, jsonify
import os
import requests
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

OWM_API_KEY = os.getenv("OWM_API_KEY")

app = Flask(__name__)

def kelvin_to_c(k):
    return k-273.15

def format_weather(w):
    return {
        "city":w.get("name"),
        "country": w.get("sys", {}).get("country"),
        "coord":w.get("coord"),
        "timezone":w.get("timezone", 0),
        "dt": w.get("dt"),
        "temp":w.get("main", {}).get("temp"),
        "feels_like": w.get("main", {}).get("feels_like"),
        "humidity": w.get("main", {}).get("humidity"),
        "pressure": w.get("main", {}).get("pressure"),
        "wind_speed": w.get("wind", {}).get("speed"),
        "wind_deg": w.get("wind", {}).get("deg"),
        "weather_main": (w.get("weather") or [{}])[0].get("main"),
        "weather_desc": (w.get("weather") or [{}])[0].get("description"),
        "icon": (w.get("weather") or [{}])[0].get("icon"),
        "sunrise": w.get("sys", {}).get("sunrise"),
        "sunset": w.get("sys", {}).get("sunset"),
    }

def get_current_by_city(city):
    if not OWM_API_KEY:
        raise RuntimeError("Missing OWM_API_KEY. Add it to .env")
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q":city,"appid":OWM_API_KEY, "units": "metric"}
    r = requests.get(url , params=params, timeout=15)
    r.raise_for_status()
    return r.json()

def get_current_by_coords(lat, lon):
    if not OWM_API_KEY:
        raise RuntimeError("Missing OWM_API_KEY. Add it to .env")
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": "metric"}
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    return r.json()

def get_forecast_5d3h_by_city(city):
    if not OWM_API_KEY:
        raise RuntimeError("Missing OWM_API_KEY. Add it to .env")
    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"q": city, "appid": OWM_API_KEY, "units": "metric"}
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    return r.json()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/weather")
def api_weather():
    city = request.args.get("city")
    if not city:
        return jsonify({"error": "Missing 'city' parameter"}), 400
    try:
        raw = get_current_by_city(city)
        return jsonify({"ok": True, "data": format_weather(raw)})
    except requests.HTTPError as e:
        status = e.response.status_code if e.response else 500
        try:
            msg = e.response.json().get("message")
        except Exception:
            msg = str(e)
        return jsonify({"ok": False, "error": msg}), status
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/weather_by_coords")
def api_weather_by_coords():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not lat or not lon:
        return jsonify({"error": "Missing 'lat' or 'lon' parameter"}), 400
    try:
        raw = get_current_by_coords(lat, lon)
        return jsonify({"ok": True, "data": format_weather(raw)})
    except requests.HTTPError as e:
        status = e.response.status_code if e.response else 500
        try:
            msg = e.response.json().get("message")
        except Exception:
            msg = str(e)
        return jsonify({"ok": False, "error": msg}), status
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/forecast")
def api_forecast():
    city = request.args.get("city")
    if not city:
        return jsonify({"error": "Missing 'city' parameter"}), 400
    try:
        raw = get_forecast_5d3h_by_city(city)

        hourly = []
        for item in raw.get("list", [])[:8]:
            hourly.append({
                "dt": item.get("dt"),
                "temp": item.get("main", {}).get("temp"),
                "feels_like": item.get("main", {}).get("feels_like"),
                "humidity": item.get("main", {}).get("humidity"),
                "wind_speed": item.get("wind", {}).get("speed"),
                "icon": (item.get("weather") or [{}])[0].get("icon"),
                "desc": (item.get("weather") or [{}])[0].get("description"),
            })
        
        from collections import defaultdict, Counter
        groups = defaultdict(list)
        city_timezone = raw.get("city", {}).get("timezone", 0)
        for item in raw.get("list", []):
            dt = item.get("dt", 0)
        
            ts = datetime.fromtimestamp(dt + city_timezone, tz=timezone.utc)
            day_key = ts.strftime("%Y-%m-%d")
            groups[day_key].append(item)

        daily = []
        for day_key, items in list(groups.items())[:5]:
            temps = [i.get("main", {}).get("temp") for i in items if i.get("main")]
            min_t = min(temps) if temps else None
            max_t = max(temps) if temps else None
            icons = [ (i.get("weather") or [{}])[0].get("icon") for i in items ]
            icon = Counter(icons).most_common(1)[0][0] if icons else None
            daily.append({
                "day": day_key,
                "min": min_t,
                "max": max_t,
                "icon": icon
            })

        return jsonify({
            "ok": True,
            "city": raw.get("city", {}).get("name"),
            "country": raw.get("city", {}).get("country"),
            "timezone": raw.get("city", {}).get("timezone", 0),
            "hourly": hourly,
            "daily": daily
        })
    except requests.HTTPError as e:
        status = e.response.status_code if e.response else 500
        try:
            msg = e.response.json().get("message")
        except Exception:
            msg = str(e)
        return jsonify({"ok": False, "error": msg}), status
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
