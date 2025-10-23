"""
Enhanced Ollama Integration Service
Provides advanced AI-powered data generation capabilities
"""

import requests
import json
import time
import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class FieldDefinition:
    name: str
    type: str
    description: str
    constraints: Optional[Dict[str, Any]] = None
    examples: Optional[List[str]] = None

class OllamaService:
    def __init__(self, host: str = "http://localhost:11434", model: str = "llama2"):
        self.host = host
        self.model = model
        self.available_models = []
        self._load_available_models()
    
    def _load_available_models(self):
        """Load available Ollama models"""
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.available_models = [model['name'] for model in data.get('models', [])]
                logger.info(f"Available models: {self.available_models}")
        except Exception as e:
            logger.warning(f"Could not load available models: {e}")
            self.available_models = [self.model]
    
    def is_available(self) -> bool:
        """Check if Ollama service is available"""
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def generate_schema_from_request(self, user_request: str, context: Optional[str] = None) -> List[Dict]:
        """
        Generate a comprehensive data schema from user request using Ollama
        
        Args:
            user_request: User's description of desired data
            context: Additional context about the data domain
            
        Returns:
            List of field definitions
        """
        if not self.is_available():
            logger.warning("Ollama not available, using fallback schema")
            return self._generate_fallback_schema(user_request)
        
        prompt = self._build_schema_prompt(user_request, context)
        
        try:
            response = requests.post(
                f"{self.host}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "max_tokens": 2000
                    }
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                schema_text = result.get('response', '')
                schema = self._parse_schema_response(schema_text)
                
                if schema:
                    logger.info(f"Generated schema with {len(schema)} fields")
                    return schema
            
        except Exception as e:
            logger.error(f"Error generating schema with Ollama: {e}")
        
        return self._generate_fallback_schema(user_request)
    
    def generate_data_samples(self, schema: List[Dict], num_samples: int = 5) -> List[Dict]:
        """
        Generate sample data for a schema using Ollama
        
        Args:
            schema: Field definitions
            num_samples: Number of sample records to generate
            
        Returns:
            List of sample records
        """
        if not self.is_available():
            return self._generate_fallback_samples(schema, num_samples)
        
        prompt = self._build_sample_data_prompt(schema, num_samples)
        
        try:
            response = requests.post(
                f"{self.host}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.8,
                        "top_p": 0.9
                    }
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                samples_text = result.get('response', '')
                samples = self._parse_samples_response(samples_text)
                
                if samples:
                    logger.info(f"Generated {len(samples)} sample records")
                    return samples
        
        except Exception as e:
            logger.error(f"Error generating samples with Ollama: {e}")
        
        return self._generate_fallback_samples(schema, num_samples)
    
    def validate_schema(self, schema: List[Dict]) -> Dict[str, Any]:
        """
        Validate and enhance a schema using Ollama
        
        Args:
            schema: Field definitions to validate
            
        Returns:
            Validation results with suggestions
        """
        if not self.is_available():
            return self._validate_schema_fallback(schema)
        
        prompt = self._build_validation_prompt(schema)
        
        try:
            response = requests.post(
                f"{self.host}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.8
                    }
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                validation_text = result.get('response', '')
                return self._parse_validation_response(validation_text)
        
        except Exception as e:
            logger.error(f"Error validating schema with Ollama: {e}")
        
        return self._validate_schema_fallback(schema)
    
    def _build_schema_prompt(self, user_request: str, context: Optional[str] = None) -> str:
        """Build a comprehensive prompt for schema generation"""
        
        available_types = [
            "first_name", "last_name", "email", "phone", "address", "company", "job_title",
            "credit_card", "date", "datetime", "uuid", "number", "decimal", "boolean",
            "country", "city", "state", "zip_code", "url", "text", "sentence", "word",
            "color", "currency", "language", "ip_address", "mac_address", "user_agent",
            "password", "ssn", "vin", "license_plate", "iban", "bic", "bank_account",
            "product_name", "price", "category", "description", "tags", "rating",
            "latitude", "longitude", "timezone", "gender", "age", "income", "education"
        ]
        
        context_info = f"\nAdditional Context: {context}\n" if context else ""
        
        prompt = f"""
You are an expert data architect. Generate a comprehensive JSON schema for synthetic data generation based on the user's request.

User Request: "{user_request}"{context_info}

Available field types: {', '.join(available_types)}

Requirements:
1. Create a realistic schema that captures the user's intent
2. Use appropriate field types from the available list
3. Include relationships between fields where relevant
4. Consider data privacy and realistic constraints
5. Provide meaningful field descriptions
6. Include 5-15 fields depending on the request complexity

Response Format (JSON array only, no additional text):
[
    {{
        "name": "field_name",
        "type": "field_type",
        "description": "Clear description of the field",
        "constraints": {{
            "min_length": 5,
            "max_length": 50,
            "required": true,
            "unique": false
        }},
        "examples": ["example1", "example2"]
    }}
]

Generate the schema now:
"""
        return prompt
    
    def _build_sample_data_prompt(self, schema: List[Dict], num_samples: int) -> str:
        """Build prompt for generating sample data"""
        
        schema_info = json.dumps(schema, indent=2)
        
        prompt = f"""
Generate {num_samples} realistic sample records based on this schema:

{schema_info}

Requirements:
1. Generate realistic, varied data
2. Follow field constraints and types
3. Ensure data consistency and relationships
4. Use diverse but appropriate values

Response Format (JSON array only):
[
    {{
        "field1": "value1",
        "field2": "value2",
        ...
    }}
]

Generate the sample data:
"""
        return prompt
    
    def _build_validation_prompt(self, schema: List[Dict]) -> str:
        """Build prompt for schema validation"""
        
        schema_info = json.dumps(schema, indent=2)
        
        prompt = f"""
Analyze this data schema and provide validation feedback:

{schema_info}

Evaluate:
1. Field type appropriateness
2. Missing important fields
3. Data consistency issues
4. Privacy/security concerns
5. Suggested improvements

Response Format (JSON):
{{
    "valid": true/false,
    "issues": ["issue1", "issue2"],
    "suggestions": ["suggestion1", "suggestion2"],
    "missing_fields": ["field1", "field2"],
    "privacy_concerns": ["concern1", "concern2"],
    "score": 85
}}
"""
        return prompt
    
    def _parse_schema_response(self, response_text: str) -> Optional[List[Dict]]:
        """Parse schema from Ollama response"""
        try:
            # Find JSON array in response
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_text = response_text[start_idx:end_idx]
                schema = json.loads(json_text)
                
                # Validate schema structure
                if isinstance(schema, list) and all(
                    isinstance(field, dict) and 
                    'name' in field and 
                    'type' in field and 
                    'description' in field
                    for field in schema
                ):
                    return schema
                    
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Error parsing schema response: {e}")
        
        return None
    
    def _parse_samples_response(self, response_text: str) -> Optional[List[Dict]]:
        """Parse sample data from Ollama response"""
        try:
            # Find JSON array in response
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_text = response_text[start_idx:end_idx]
                samples = json.loads(json_text)
                
                if isinstance(samples, list) and all(isinstance(sample, dict) for sample in samples):
                    return samples
                    
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Error parsing samples response: {e}")
        
        return None
    
    def _parse_validation_response(self, response_text: str) -> Dict[str, Any]:
        """Parse validation response from Ollama"""
        try:
            # Find JSON object in response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_text = response_text[start_idx:end_idx]
                validation = json.loads(json_text)
                
                if isinstance(validation, dict):
                    return validation
                    
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Error parsing validation response: {e}")
        
        return self._validate_schema_fallback([])
    
    def _generate_fallback_schema(self, user_request: str) -> List[Dict]:
        """Generate basic schema when Ollama is not available"""
        # Simple keyword-based schema generation
        keywords = user_request.lower()
        
        schema = [
            {"name": "id", "type": "uuid", "description": "Unique identifier"}
        ]
        
        if any(word in keywords for word in ['customer', 'user', 'person', 'client']):
            schema.extend([
                {"name": "first_name", "type": "first_name", "description": "First name"},
                {"name": "last_name", "type": "last_name", "description": "Last name"},
                {"name": "email", "type": "email", "description": "Email address"}
            ])
        
        if any(word in keywords for word in ['company', 'business', 'organization']):
            schema.extend([
                {"name": "company_name", "type": "company", "description": "Company name"},
                {"name": "industry", "type": "word", "description": "Industry type"}
            ])
        
        if any(word in keywords for word in ['address', 'location', 'place']):
            schema.extend([
                {"name": "address", "type": "address", "description": "Full address"},
                {"name": "city", "type": "city", "description": "City name"},
                {"name": "country", "type": "country", "description": "Country name"}
            ])
        
        if any(word in keywords for word in ['product', 'item', 'goods']):
            schema.extend([
                {"name": "product_name", "type": "product_name", "description": "Product name"},
                {"name": "price", "type": "decimal", "description": "Product price"},
                {"name": "category", "type": "word", "description": "Product category"}
            ])
        
        if any(word in keywords for word in ['order', 'transaction', 'payment']):
            schema.extend([
                {"name": "order_date", "type": "datetime", "description": "Order date"},
                {"name": "amount", "type": "decimal", "description": "Transaction amount"},
                {"name": "status", "type": "word", "description": "Order status"}
            ])
        
        # Add timestamp if not already present
        if not any('date' in field['name'] for field in schema):
            schema.append({
                "name": "created_at", 
                "type": "datetime", 
                "description": "Creation timestamp"
            })
        
        return schema
    
    def _generate_fallback_samples(self, schema: List[Dict], num_samples: int) -> List[Dict]:
        """Generate basic sample data when Ollama is not available"""
        from faker import Faker
        import random
        
        fake = Faker()
        samples = []
        
        for _ in range(num_samples):
            sample = {}
            for field in schema:
                field_type = field.get('type', 'text')
                
                if field_type == 'uuid':
                    sample[field['name']] = str(uuid.uuid4())
                elif field_type in ['first_name', 'last_name']:
                    sample[field['name']] = getattr(fake, field_type)()
                elif field_type == 'email':
                    sample[field['name']] = fake.email()
                elif field_type == 'decimal':
                    sample[field['name']] = round(random.uniform(1.0, 1000.0), 2)
                elif field_type == 'number':
                    sample[field['name']] = random.randint(1, 1000)
                elif field_type == 'boolean':
                    sample[field['name']] = random.choice([True, False])
                elif field_type == 'datetime':
                    sample[field['name']] = fake.date_time().isoformat()
                else:
                    sample[field['name']] = f"sample_{field_type}_{random.randint(1, 100)}"
            
            samples.append(sample)
        
        return samples
    
    def _validate_schema_fallback(self, schema: List[Dict]) -> Dict[str, Any]:
        """Basic schema validation when Ollama is not available"""
        issues = []
        suggestions = []
        
        if not schema:
            issues.append("Empty schema")
            return {"valid": False, "issues": issues, "suggestions": suggestions, "score": 0}
        
        # Check for required fields
        field_names = [field.get('name', '') for field in schema]
        if not any('id' in name.lower() for name in field_names):
            suggestions.append("Consider adding an ID field for unique identification")
        
        # Check for data types
        for field in schema:
            if not field.get('type'):
                issues.append(f"Field '{field.get('name', 'unknown')}' missing type")
        
        # Check for descriptions
        missing_descriptions = [f for f in schema if not f.get('description')]
        if missing_descriptions:
            suggestions.append("Add descriptions to all fields for better documentation")
        
        score = max(0, 100 - len(issues) * 20 - len(missing_descriptions) * 5)
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "suggestions": suggestions,
            "missing_fields": [],
            "privacy_concerns": [],
            "score": score
        }
