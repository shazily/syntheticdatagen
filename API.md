# Synthetic Data Generator API Documentation

## Overview

The Synthetic Data Generator provides a RESTful API for generating synthetic data with AI-powered schema generation. This document describes all available endpoints and their usage.

## Base URL

- Local: `http://localhost:8080`
- Production: `https://your-domain.com`

## Authentication

Currently, no authentication is required. Rate limiting is applied to prevent abuse.

## Rate Limits

- General API: 10 requests/second
- Data Generation: 2 requests/second
- Burst allowance: 20 requests for general API, 5 for data generation

## Endpoints

### 1. Generate Schema

Generate a data schema from a natural language description using AI.

**Endpoint:** `POST /api/generate-schema`

**Request Body:**
```json
{
  "request": "I need customer data with names, emails, phone numbers, and addresses. Also include order history with product names, quantities, and prices."
}
```

**Response:**
```json
{
  "schema": [
    {
      "name": "customer_id",
      "type": "uuid",
      "description": "Unique customer identifier",
      "constraints": {
        "required": true,
        "unique": true
      },
      "examples": ["123e4567-e89b-12d3-a456-426614174000"]
    },
    {
      "name": "first_name",
      "type": "first_name",
      "description": "Customer's first name",
      "constraints": {
        "required": true,
        "min_length": 2,
        "max_length": 50
      },
      "examples": ["John", "Jane", "Michael"]
    }
  ],
  "user_request": "I need customer data with names, emails, phone numbers, and addresses..."
}
```

**Status Codes:**
- `200 OK`: Schema generated successfully
- `400 Bad Request`: Invalid request body
- `500 Internal Server Error`: Server error

### 2. Generate Data

Generate synthetic data based on a schema.

**Endpoint:** `POST /api/generate-data`

**Request Body:**
```json
{
  "schema": [
    {
      "name": "customer_id",
      "type": "uuid",
      "description": "Unique customer identifier"
    },
    {
      "name": "first_name",
      "type": "first_name",
      "description": "Customer's first name"
    }
  ],
  "num_rows": 1000,
  "format": "csv"
}
```

**Parameters:**
- `schema` (array): Array of field definitions
- `num_rows` (integer): Number of records to generate (1-10000)
- `format` (string): Output format - "csv", "json", or "python"

**Response:**

For CSV format:
```json
{
  "data": "customer_id,first_name\n123e4567-e89b-12d3-a456-426614174000,John\n...",
  "format": "csv",
  "filename": "synthetic_data_20240101_120000.csv"
}
```

For JSON format:
```json
{
  "data": [
    {
      "customer_id": "123e4567-e89b-12d3-a456-426614174000",
      "first_name": "John"
    }
  ],
  "format": "json",
  "filename": "synthetic_data_20240101_120000.json"
}
```

For Python format:
```json
{
  "data": "import psycopg2\nfrom faker import Faker\n...",
  "format": "python",
  "filename": "data_generator_20240101_120000.py"
}
```

**Status Codes:**
- `200 OK`: Data generated successfully
- `400 Bad Request`: Invalid schema or parameters
- `500 Internal Server Error`: Generation error

### 3. Save Schema

Save a schema for future use.

**Endpoint:** `POST /api/save-schema`

**Request Body:**
```json
{
  "name": "Customer Data Schema",
  "schema": [
    {
      "name": "customer_id",
      "type": "uuid",
      "description": "Unique customer identifier"
    }
  ],
  "user_request": "Customer data with orders and products"
}
```

**Response:**
```json
{
  "message": "Schema saved successfully",
  "id": 123
}
```

**Status Codes:**
- `200 OK`: Schema saved successfully
- `400 Bad Request`: Missing required fields
- `500 Internal Server Error`: Database error

### 4. Get Saved Schemas

Retrieve all saved schemas.

**Endpoint:** `GET /api/schemas`

**Response:**
```json
[
  {
    "id": 123,
    "name": "Customer Data Schema",
    "schema_data": [
      {
        "name": "customer_id",
        "type": "uuid",
        "description": "Unique customer identifier"
      }
    ],
    "created_at": "2024-01-01T12:00:00Z",
    "user_request": "Customer data with orders and products"
  }
]
```

**Status Codes:**
- `200 OK`: Schemas retrieved successfully
- `500 Internal Server Error`: Database error

### 5. Get Field Types

Get available field types for data generation.

**Endpoint:** `GET /api/field-types`

**Response:**
```json
[
  {
    "type": "first_name",
    "description": "Generate first name data",
    "example": "John"
  },
  {
    "type": "email",
    "description": "Generate email address data",
    "example": "john.doe@example.com"
  }
]
```

**Status Codes:**
- `200 OK`: Field types retrieved successfully

## Field Types Reference

### Personal Information
- `first_name`: First names
- `last_name`: Last names
- `email`: Email addresses
- `phone`: Phone numbers
- `ssn`: Social Security Numbers
- `gender`: Gender values
- `age`: Age values

### Business Information
- `company`: Company names
- `job_title`: Job titles
- `industry`: Industry types
- `website`: Website URLs

### Geographic Information
- `address`: Full addresses
- `city`: City names
- `state`: State/province names
- `country`: Country names
- `zip_code`: ZIP/postal codes
- `latitude`: Latitude coordinates
- `longitude`: Longitude coordinates

### Financial Information
- `credit_card`: Credit card numbers
- `iban`: International Bank Account Numbers
- `bic`: Bank Identifier Codes
- `currency`: Currency codes
- `price`: Price values
- `decimal`: Decimal numbers

### Technical Information
- `uuid`: Universally Unique Identifiers
- `ip_address`: IP addresses
- `mac_address`: MAC addresses
- `user_agent`: User agent strings
- `url`: URLs

### Temporal Information
- `date`: Dates
- `datetime`: Date and time
- `time`: Time values

### Text Information
- `text`: Random text
- `sentence`: Sentences
- `word`: Words
- `paragraph`: Paragraphs

### Other
- `boolean`: True/false values
- `number`: Integer numbers
- `color`: Color names
- `language`: Language names
- `password`: Passwords

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common Error Codes:**
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Endpoint not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Examples

### Complete Workflow

1. **Generate Schema:**
```bash
curl -X POST http://localhost:8080/api/generate-schema \
  -H "Content-Type: application/json" \
  -d '{"request": "Customer data with orders and products"}'
```

2. **Save Schema:**
```bash
curl -X POST http://localhost:8080/api/save-schema \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Schema",
    "schema": [...],
    "user_request": "Customer data with orders and products"
  }'
```

3. **Generate Data:**
```bash
curl -X POST http://localhost:8080/api/generate-data \
  -H "Content-Type: application/json" \
  -d '{
    "schema": [...],
    "num_rows": 1000,
    "format": "csv"
  }'
```

### Python Integration

```python
import requests
import json

# Generate schema
response = requests.post('http://localhost:8080/api/generate-schema', 
                        json={'request': 'Customer data with orders'})
schema = response.json()['schema']

# Generate data
response = requests.post('http://localhost:8080/api/generate-data',
                        json={'schema': schema, 'num_rows': 1000, 'format': 'json'})
data = response.json()['data']

# Process data
for record in data:
    print(record)
```

### JavaScript Integration

```javascript
// Generate schema
const schemaResponse = await fetch('/api/generate-schema', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ request: 'Customer data with orders' })
});
const { schema } = await schemaResponse.json();

// Generate data
const dataResponse = await fetch('/api/generate-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ schema, num_rows: 1000, format: 'json' })
});
const { data } = await dataResponse.json();
```

## Rate Limiting Headers

When rate limiting is active, the following headers are included in responses:

- `X-RateLimit-Limit`: Request limit per time window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Webhook Support

Currently, webhooks are not supported. All operations are synchronous. Future versions may include webhook support for large data generation jobs.

## Versioning

The API is currently at version 1.0. Future versions will be accessible via URL path versioning (e.g., `/api/v2/`).

## Support

For API support and questions:
- Check the main README.md for setup instructions
- Review Docker logs: `docker-compose logs`
- Open an issue on the project repository
