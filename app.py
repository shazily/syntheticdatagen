from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from faker import Faker
import pandas as pd
import json
import uuid
import random
import requests
import os
from datetime import datetime
import io
import zipfile
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/synthetic_data')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

db = SQLAlchemy(app)
fake = Faker()

# Ollama configuration
OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'http://localhost:11434')

class DataSchema(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    schema_data = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_request = db.Column(db.Text)

# Initialize database
with app.app_context():
    db.create_all()

class DataGenerator:
    def __init__(self):
        self.fake = Faker()
        self.field_generators = {
            'first_name': lambda: self.fake.first_name(),
            'last_name': lambda: self.fake.last_name(),
            'email': lambda: self.fake.email(),
            'phone': lambda: self.fake.phone_number(),
            'address': lambda: self.fake.address(),
            'company': lambda: self.fake.company(),
            'job_title': lambda: self.fake.job(),
            'credit_card': lambda: self.fake.credit_card_number(),
            'date': lambda: self.fake.date(),
            'datetime': lambda: self.fake.date_time(),
            'uuid': lambda: str(uuid.uuid4()),
            'number': lambda: random.randint(1, 1000),
            'decimal': lambda: round(random.uniform(1.0, 1000.0), 2),
            'boolean': lambda: random.choice([True, False]),
            'country': lambda: self.fake.country(),
            'city': lambda: self.fake.city(),
            'state': lambda: self.fake.state(),
            'zip_code': lambda: self.fake.zipcode(),
            'url': lambda: self.fake.url(),
            'text': lambda: self.fake.text(max_nb_chars=200),
            'sentence': lambda: self.fake.sentence(),
            'word': lambda: self.fake.word(),
            'color': lambda: self.fake.color_name(),
            'currency': lambda: self.fake.currency_code(),
            'language': lambda: self.fake.language_name(),
            'ip_address': lambda: self.fake.ipv4(),
            'mac_address': lambda: self.fake.mac_address(),
            'user_agent': lambda: self.fake.user_agent(),
            'password': lambda: self.fake.password(),
            'ssn': lambda: self.fake.ssn(),
            'vin': lambda: self.fake.vin(),
            'license_plate': lambda: self.fake.license_plate(),
            'iban': lambda: self.fake.iban(),
            'bic': lambda: self.fake.swift(),
        }

    def generate_data(self, schema, num_rows):
        """Generate data based on schema"""
        data = []
        
        for _ in range(num_rows):
            row = {}
            for field in schema:
                field_name = field['name']
                field_type = field['type']
                
                if field_type in self.field_generators:
                    row[field_name] = self.field_generators[field_type]()
                else:
                    # Fallback for custom types
                    row[field_name] = f"custom_{field_type}_{random.randint(1, 100)}"
            
            data.append(row)
        
        return data

class OllamaIntegration:
    def __init__(self, host=OLLAMA_HOST):
        self.host = host
    
    def generate_schema_from_request(self, user_request):
        """Use Ollama to generate a data schema from user request"""
        prompt = f"""
        Based on the following user request for synthetic data generation, create a JSON schema with appropriate field types.
        
        User Request: "{user_request}"
        
        Please respond with a JSON array of fields, where each field has:
        - name: field name (string)
        - type: data type from this list: {list(DataGenerator().field_generators.keys())}
        - description: brief description of the field
        
        Example response:
        [
            {{"name": "customer_id", "type": "uuid", "description": "Unique customer identifier"}},
            {{"name": "first_name", "type": "first_name", "description": "Customer's first name"}},
            {{"name": "email", "type": "email", "description": "Customer's email address"}},
            {{"name": "registration_date", "type": "datetime", "description": "When customer registered"}}
        ]
        
        Only respond with the JSON array, no additional text.
        """
        
        try:
            response = requests.post(
                f"{self.host}/api/generate",
                json={
                    "model": "llama2",  # Adjust model as needed
                    "prompt": prompt,
                    "stream": False
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                schema_text = result.get('response', '')
                
                # Try to extract JSON from response
                try:
                    # Find JSON array in response
                    start_idx = schema_text.find('[')
                    end_idx = schema_text.rfind(']') + 1
                    if start_idx != -1 and end_idx != 0:
                        json_text = schema_text[start_idx:end_idx]
                        schema = json.loads(json_text)
                        return schema
                except json.JSONDecodeError:
                    pass
                
                # Fallback: generate basic schema
                return self._generate_fallback_schema(user_request)
            
        except Exception as e:
            print(f"Ollama integration error: {e}")
        
        return self._generate_fallback_schema(user_request)
    
    def _generate_fallback_schema(self, user_request):
        """Generate a basic schema when Ollama is not available"""
        return [
            {"name": "id", "type": "uuid", "description": "Unique identifier"},
            {"name": "name", "type": "first_name", "description": "Name field"},
            {"name": "email", "type": "email", "description": "Email address"},
            {"name": "created_at", "type": "datetime", "description": "Creation timestamp"}
        ]

# Initialize services
data_generator = DataGenerator()
ollama = OllamaIntegration()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate-schema', methods=['POST'])
def generate_schema():
    """Generate schema using Ollama based on user request"""
    try:
        data = request.get_json()
        user_request = data.get('request', '')
        
        if not user_request:
            return jsonify({'error': 'User request is required'}), 400
        
        schema = ollama.generate_schema_from_request(user_request)
        
        return jsonify({
            'schema': schema,
            'user_request': user_request
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-data', methods=['POST'])
def generate_data():
    """Generate data based on schema"""
    try:
        data = request.get_json()
        schema = data.get('schema', [])
        num_rows = data.get('num_rows', 100)
        format_type = data.get('format', 'csv')
        
        if not schema:
            return jsonify({'error': 'Schema is required'}), 400
        
        # Generate data
        generated_data = data_generator.generate_data(schema, num_rows)
        
        # Convert to requested format
        if format_type == 'csv':
            df = pd.DataFrame(generated_data)
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False)
            csv_content = csv_buffer.getvalue()
            
            return jsonify({
                'data': csv_content,
                'format': 'csv',
                'filename': f'synthetic_data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            })
        
        elif format_type == 'json':
            return jsonify({
                'data': generated_data,
                'format': 'json',
                'filename': f'synthetic_data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            })
        
        elif format_type == 'python':
            # Generate Python code similar to your provided script
            python_code = generate_python_code(schema, generated_data)
            return jsonify({
                'data': python_code,
                'format': 'python',
                'filename': f'data_generator_{datetime.now().strftime("%Y%m%d_%H%M%S")}.py'
            })
        
        else:
            return jsonify({'error': 'Unsupported format'}), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save-schema', methods=['POST'])
def save_schema():
    """Save schema to database"""
    try:
        data = request.get_json()
        name = data.get('name', '')
        schema_data = data.get('schema', [])
        user_request = data.get('user_request', '')
        
        if not name or not schema_data:
            return jsonify({'error': 'Name and schema are required'}), 400
        
        schema_record = DataSchema(
            name=name,
            schema_data=json.dumps(schema_data),
            user_request=user_request
        )
        
        db.session.add(schema_record)
        db.session.commit()
        
        return jsonify({'message': 'Schema saved successfully', 'id': schema_record.id})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/schemas', methods=['GET'])
def get_schemas():
    """Get all saved schemas"""
    try:
        schemas = DataSchema.query.all()
        result = []
        
        for schema in schemas:
            result.append({
                'id': schema.id,
                'name': schema.name,
                'schema_data': json.loads(schema.schema_data),
                'created_at': schema.created_at.isoformat(),
                'user_request': schema.user_request
            })
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/field-types', methods=['GET'])
def get_field_types():
    """Get available field types"""
    field_types = []
    for field_type, generator in data_generator.field_generators.items():
        field_types.append({
            'type': field_type,
            'description': f'Generate {field_type.replace("_", " ")} data',
            'example': str(generator())
        })
    
    return jsonify(field_types)

def generate_python_code(schema, sample_data):
    """Generate Python code for data generation"""
    code = '''import psycopg2
from faker import Faker
import uuid
import json
import random
from datetime import datetime

# Initialize Faker
fake = Faker()

# Database connection details
DB_HOST = 'localhost'
DB_PORT = '5432'
DB_NAME = 'your_database'
DB_USER = 'your_username'
DB_PASS = 'your_password'

def generate_data(num_records):
    """Generate synthetic data based on schema"""
    data = []
    
    for _ in range(num_records):
        record = {}'''
    
    # Add field generation logic
    for field in schema:
        field_name = field['name']
        field_type = field['type']
        
        if field_type == 'uuid':
            code += f'\n        record["{field_name}"] = str(uuid.uuid4())'
        elif field_type == 'first_name':
            code += f'\n        record["{field_name}"] = fake.first_name()'
        elif field_type == 'last_name':
            code += f'\n        record["{field_name}"] = fake.last_name()'
        elif field_type == 'email':
            code += f'\n        record["{field_name}"] = fake.email()'
        elif field_type == 'datetime':
            code += f'\n        record["{field_name}"] = fake.date_time()'
        elif field_type == 'number':
            code += f'\n        record["{field_name}"] = random.randint(1, 1000)'
        elif field_type == 'decimal':
            code += f'\n        record["{field_name}"] = round(random.uniform(1.0, 1000.0), 2)'
        elif field_type == 'boolean':
            code += f'\n        record["{field_name}"] = random.choice([True, False])'
        else:
            code += f'\n        record["{field_name}"] = fake.{field_type}()'
    
    code += '''
        
        data.append(record)
    
    return data

def insert_to_database(data):
    """Insert generated data to database"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )
        cursor = conn.cursor()
        
        # Create table if not exists
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS synthetic_data (
            id SERIAL PRIMARY KEY,'''
    
    for field in schema:
        field_name = field['name']
        if field['type'] in ['number', 'decimal']:
            code += f'\n            {field_name} NUMERIC,'
        elif field['type'] == 'boolean':
            code += f'\n            {field_name} BOOLEAN,'
        elif field['type'] == 'datetime':
            code += f'\n            {field_name} TIMESTAMP,'
        else:
            code += f'\n            {field_name} TEXT,'
    
    code += '''
        );
        """
        cursor.execute(create_table_sql)
        
        # Insert data
        for record in data:
            placeholders = ', '.join(['%s'] * len(record))
            columns = ', '.join(record.keys())
            insert_sql = f"INSERT INTO synthetic_data ({columns}) VALUES ({placeholders})"
            cursor.execute(insert_sql, list(record.values()))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"Successfully inserted {len(data)} records")
        
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    # Generate data
    num_records = 1000
    data = generate_data(num_records)
    
    # Insert to database
    insert_to_database(data)
    
    print("Data generation completed!")
'''
    
    return code

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
