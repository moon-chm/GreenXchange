import streamlit as st
import pandas as pd
import joblib
import time
import requests

# Initialize session state for air quality and weather inputs
if 'api_aqi' not in st.session_state: st.session_state.api_aqi = 50
if 'api_pm25' not in st.session_state: st.session_state.api_pm25 = 50.0
if 'api_no2' not in st.session_state: st.session_state.api_no2 = 20.0
if 'api_co' not in st.session_state: st.session_state.api_co = 0.5
if 'api_pm10' not in st.session_state: st.session_state.api_pm10 = 60.0
if 'api_so2' not in st.session_state: st.session_state.api_so2 = 10.0
if 'api_o3' not in st.session_state: st.session_state.api_o3 = 25.0
if 'api_temp' not in st.session_state: st.session_state.api_temp = 25.0
if 'api_humidity' not in st.session_state: st.session_state.api_humidity = 60
if 'api_windspeed' not in st.session_state: st.session_state.api_windspeed = 5.0

# Set page config for wider layout and better tab title
st.set_page_config(page_title="Plant Recommendation System", page_icon="🌿", layout="wide")

# Custom CSS for better aesthetics
st.markdown("""
    <style>
    .stButton>button {
        background-color: #2e7d32;
        color: white;
        font-weight: bold;
        border-radius: 8px;
        padding: 10px 24px;
        transition: all 0.3s ease 0s;
    }
    .stButton>button:hover {
        background-color: #1b5e20;
        box-shadow: 0px 8px 15px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }
    </style>
""", unsafe_allow_html=True)

# Load model & encoder
@st.cache_resource
def load_models():
    model = joblib.load("plant_model.pkl")
    le = joblib.load("label_encoder.pkl")
    return model, le

model, le = load_models()

st.title("🌱 Intelligent Plant Recommendation System")
st.markdown("### Discover the perfect plant for your environment based on AI!")
st.write("---")

# Use tabs to organize inputs logically
tab1, tab2, tab3 = st.tabs(["🌍 Environment & Location", "🌤️ Climate & Soil", "🏡 Space & Preferences"])

with tab1:
    st.header("Environment & Air Quality")
    
    st.write("### 📍 Auto-Fill Location Data")
    st.caption("Enter your latitude and longitude to automatically fetch current air quality and weather data.")
    loc_col1, loc_col2, loc_col3 = st.columns([1, 1, 1])
    with loc_col1:
        lat_input = st.text_input("Latitude", value="16.6914")
    with loc_col2:
        lon_input = st.text_input("Longitude", value="74.4605")
    with loc_col3:
        st.write("") # spacing
        st.write("") # spacing
        if st.button("🌦️ Fetch Location Data", use_container_width=True):
            try:
                # Fetch APIs
                api_key = "d1913f17a61bb965905d3bed69aa4713"
                url_aqi = f"https://api.openweathermap.org/data/2.5/air_pollution?lat={lat_input}&lon={lon_input}&appid={api_key}"
                url_weather = f"https://api.openweathermap.org/data/2.5/weather?lat={lat_input}&lon={lon_input}&appid={api_key}&units=metric"
                
                response_aqi = requests.get(url_aqi)
                response_weather = requests.get(url_weather)
                
                success_count = 0
                
                if response_aqi.status_code == 200:
                    data = response_aqi.json()
                    if "list" in data and len(data["list"]) > 0:
                        comp = data["list"][0]["components"]
                        main_aqi = data["list"][0]["main"]["aqi"]
                        
                        # Mapping OpenWeather API AQI (1-5) to a numerical scale compatible with the app
                        aqi_map = {1: 50, 2: 100, 3: 150, 4: 200, 5: 300}#1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very
                        st.session_state.api_aqi = int(aqi_map.get(main_aqi, 50))
                        st.session_state.api_pm25 = float(comp.get("pm2_5", 50.0))
                        st.session_state.api_no2 = float(comp.get("no2", 20.0))
                        
                        # Convert CO approximately to match the ppm scale (roughly divided by 1145)
                        st.session_state.api_co = round(float(comp.get("co", 500)) / 1145, 2)
                        st.session_state.api_pm10 = float(comp.get("pm10", 60.0))
                        st.session_state.api_so2 = float(comp.get("so2", 10.0))
                        st.session_state.api_o3 = float(comp.get("o3", 25.0))
                        success_count += 1
                        
                if response_weather.status_code == 200:
                    w_data = response_weather.json()
                    st.session_state.api_temp = float(w_data["main"]["temp"])
                    st.session_state.api_humidity = int(w_data["main"]["humidity"])
                    
                    speed_ms = float(w_data["wind"]["speed"])
                    st.session_state.api_windspeed = round(speed_ms * 3.6, 2)
                    success_count += 1

                if success_count == 2:
                    st.success("Air Quality & Weather data successfully fetched and updated!")
                elif success_count == 1:
                    st.warning("Only partial data was fetched successfully.")
                else:
                    st.error("Failed to fetch data from APIs (check Lat/Lon).")
                    
            except Exception as e:
                st.error(f"Error: {e}")

    st.write("---")
    
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Location Details")
        AreaType = st.selectbox("Area Type", ['Rural', 'Urban', 'Residential'])
        TrafficDensity = st.radio("Traffic Density", ['Low', 'Medium', 'High'], horizontal=True)
        RoadDistance = st.slider("Distance from Road (m)", 5, 100, 25)
    
    with col2:
        st.subheader("Air Quality Data")
        AQI = st.slider("Overall AQI", 0, 500, key='api_aqi')
        col2_1, col2_2 = st.columns(2)
        with col2_1:
            PM25 = st.number_input("PM2.5", min_value=0.0, key='api_pm25')
            NO2 = st.number_input("NO2", min_value=0.0, key='api_no2')
            CO = st.number_input("CO (ppm)", min_value=0.0, step=0.1, key='api_co')
        with col2_2:
            PM10 = st.number_input("PM10", min_value=0.0, key='api_pm10')
            SO2 = st.number_input("SO2", min_value=0.0, key='api_so2')
            O3 = st.number_input("O3", min_value=0.0, key='api_o3')
        DustIndex = st.slider("Dust Index", 10, 100, 40)

with tab2:
    st.header("Climate & Soil Conditions")
    col3, col4 = st.columns(2)
    with col3:
        st.subheader("Weather Details")
        Temperature = st.slider("Temperature (°C)", -10.0, 60.0, key="api_temp")
        Humidity = st.slider("Humidity (%)", 0, 100, key="api_humidity")
        Rainfall = st.slider("Annual Rainfall (mm)", 0, 400, 150)
        WindSpeed = st.slider("Wind Speed (km/h)", 0.0, 200.0, key="api_windspeed")
        Sunlight = st.selectbox("Sunlight Availability", ['Full Shade', 'Partial Shade', 'Full Sun'])

    with col4:
        st.subheader("Soil Characteristics")
        SoilType = st.selectbox("Soil Type", ['Sandy', 'Loamy', 'Clay'])
        SoilPH = st.slider("Soil pH Level", 4.0, 9.0, 6.5, step=0.1)
        Drainage = st.radio("Water Drainage Quality", ['Poor', 'Moderate', 'Good'], horizontal=True)

with tab3:
    st.header("Space Setup & User Preferences")
    col5, col6 = st.columns(2)
    with col5:
        st.subheader("Space Details")
        SpaceType = st.selectbox("Type of Space", ['Indoor', 'Balcony', 'Outdoor'])
        AreaSize = st.radio("Available Area Size", ['Small', 'Medium', 'Large'], horizontal=True)
    
    with col6:
        st.subheader("Plant Preferences")
        MaintenanceLevel = st.selectbox("Acceptable Maintenance Level", ['Low', 'Medium', 'High'])
        WateringPreference = st.selectbox("Watering Frequency", ['Rare', 'Regular', 'Frequent'])
        Purpose = st.selectbox("Primary Purpose", ['Shade', 'Air Purification', 'Edible', 'Decoration'])

st.write("---")

# ---- Prediction ----
col_btn1, col_btn2, col_btn3 = st.columns([1, 2, 1])

with col_btn2:
    submit_button = st.button("🔮 Discover My Perfect Plant", use_container_width=True)

if submit_button:
    with st.spinner('Analyzing environmental data and generating recommendation...'):
        # Simulate a slight delay for better UX
        time.sleep(1)
        
        input_dict = {
            "AreaType": AreaType,
            "AQI": AQI,
            "PM2.5": PM25,
            "PM10": PM10,
            "NO2": NO2,
            "SO2": SO2,
            "CO": CO,
            "O3": O3,
            "TrafficDensity": TrafficDensity,
            "RoadDistance": RoadDistance,
            "DustIndex": DustIndex,
            "Temperature": Temperature,
            "Humidity": Humidity,
            "Rainfall": Rainfall,
            "WindSpeed": WindSpeed,
            "Sunlight": Sunlight,
            "SoilType": SoilType,
            "SoilPH": SoilPH,
            "Drainage": Drainage,
            "SpaceType": SpaceType,
            "AreaSize": AreaSize,
            "MaintenanceLevel": MaintenanceLevel,
            "WateringPreference": WateringPreference,
            "Purpose": Purpose
        }

        input_df = pd.DataFrame([input_dict])

        # Convert to same format as training
        input_df = pd.get_dummies(input_df)

        # Align columns with training data
        model_columns = model.feature_names_in_
        input_df = input_df.reindex(columns=model_columns, fill_value=0)

        # Prediction
        pred = model.predict(input_df)
        plant = le.inverse_transform(pred)[0]

        st.success(f"### 🎉 We recommend planting a: **{plant}**!")
        st.balloons()