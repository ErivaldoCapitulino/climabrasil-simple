from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import os
import requests
import google.generativeai as genai
from datetime import datetime

load_dotenv()

app = Flask(__name__)

# Configurações (mantenha o restante do seu código igual)
WEATHER_API_KEY = os.getenv('WEATHER_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

# Cidades com risco conhecido
HIGH_RISK_CITIES = {
    'São Paulo': {'state': 'SP', 'risk': 'high'},
    'Petrópolis': {'state': 'RJ', 'risk': 'high'},
    'Recife': {'state': 'PE', 'risk': 'medium'},
    'Blumenau': {'state': 'SC', 'risk': 'high'},
    'Rio de Janeiro': {'state': 'RJ', 'risk': 'medium'},
    'Salvador': {'state': 'BA', 'risk': 'medium'}
}

# Configura Gemini
genai.configure(api_key=GOOGLE_API_KEY)
gemini = genai.GenerativeModel('gemini-1.5-flash')

def get_weather_data(city):
    """Obtém dados meteorológicos da WeatherAPI com tratamento robusto de erros"""
    try:
        url = f"http://api.weatherapi.com/v1/current.json?key={WEATHER_API_KEY}&q={city}&aqi=no"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # Verifica se a estrutura de dados está completa
        if not data.get('location') or not data.get('current'):
            print("Estrutura de dados incompleta da API")
            return None
            
        return data
    except requests.exceptions.RequestException as e:
        print(f"Erro na API Weather: {str(e)}")
        return None
    except ValueError as e:
        print(f"Erro ao decodificar JSON: {str(e)}")
        return None

def generate_risk_alert(weather_data):
    """Gera alertas de risco com verificações robustas"""
    if not weather_data:
        return None
    
    try:
        location = weather_data.get('location', {})
        current = weather_data.get('current', {})
        condition = current.get('condition', {})
        
        # Dados essenciais com fallback
        city_name = location.get('name', 'Cidade desconhecida')
        region = location.get('region', 'Região desconhecida')
        risk_info = HIGH_RISK_CITIES.get(city_name, {'risk': 'low', 'state': ''})
        
        alert = {
            'city': city_name,
            'region': region,
            'state': risk_info.get('state', ''),
            'country': location.get('country', ''),
            'localtime': location.get('localtime', datetime.now().strftime('%Y-%m-%d %H:%M')),
            'temp_c': current.get('temp_c', 'N/A'),
            'feelslike_c': current.get('feelslike_c', 'N/A'),
            'condition': condition.get('text', 'Condição desconhecida'),
            'wind_kph': current.get('wind_kph', 'N/A'),
            'wind_dir': current.get('wind_dir', 'N/A'),
            'humidity': current.get('humidity', 'N/A'),
            'precip_mm': current.get('precip_mm', 0),
            'pressure_mb': current.get('pressure_mb', 'N/A'),
            'vis_km': current.get('vis_km', 'N/A'),
            'uv': current.get('uv', 'N/A'),
            'risk_level': risk_info['risk']
        }
        
        # Lógica de alerta com fallbacks
        precip = alert['precip_mm']
        risk = alert['risk_level']
        
        if risk == 'high' and precip > 50:
            alert.update({
                'alert_level': 'danger',
                'message': f"ALERTA VERMELHO: Risco extremo de enchentes em {city_name}",
                'actions': [
                    "Evite áreas baixas e próximas a rios",
                    "Prepare um kit de emergência",
                    "Monitore canais oficiais"
                ]
            })
        elif risk == 'high' and precip > 30 or risk == 'medium' and precip > 40:
            alert.update({
                'alert_level': 'warning',
                'message': f"ALERTA LARANJA: Risco de enchentes em {city_name}",
                'actions': [
                    "Fique atento a sinais de alagamento",
                    "Proteja seus pertences",
                    "Evite áreas de risco"
                ]
            })
        else:
            alert.update({
                'alert_level': 'info',
                'message': f"Condições em {city_name}",
                'actions': [
                    "Mantenha-se informado",
                    "Tenha um plano de emergência"
                ]
            })
        
        return alert
    
    except Exception as e:
        print(f"Erro ao gerar alerta: {str(e)}")
        return None

@app.route('/')
def home():
    return render_template('index.html', cities=list(HIGH_RISK_CITIES.keys()))

@app.route('/get-weather', methods=['POST'])
def get_weather():
    city = request.form.get('city', '').strip()
    if not city:
        return jsonify({'error': 'Por favor, informe uma cidade'}), 400
    
    weather_data = get_weather_data(city)
    if not weather_data:
        return jsonify({'error': 'Não foi possível obter dados para esta cidade'}), 500
    
    alert_data = generate_risk_alert(weather_data)
    if not alert_data:
        return jsonify({'error': 'Erro ao processar dados meteorológicos'}), 500
    
    return jsonify(alert_data)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        question = data.get('question', '').strip()
        context = data.get('context', {})
        
        if not question:
            return jsonify({'error': 'Por favor, digite sua pergunta'}), 400
        
        prompt = f"""
        Você é o assistente do ClimaBrasil. Siga estas regras:
        1. Responda em português
        2. Seja conciso (1-3 frases)
        3. Pergunta: "{question}"
        """
        
        response = gemini.generate_content(prompt)
        return jsonify({'answer': response.text})
    
    except Exception as e:
        print(f"Erro no chat: {str(e)}")
        return jsonify({'error': 'Erro ao processar sua mensagem'}), 500

if __name__ == '__main__':
    app.run(debug=True)