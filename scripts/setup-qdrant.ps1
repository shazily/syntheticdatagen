# Qdrant Collection Setup Script
# Creates collections for schema library, SQL patterns, and field mappings

$QDRANT_URL = "http://localhost:6333"

Write-Host "🚀 Setting up Qdrant collections..." -ForegroundColor Cyan

# Collection 1: Successful Schemas (for RAG)
Write-Host "`n📚 Creating 'successful_schemas' collection..." -ForegroundColor Yellow

$collection1 = @{
    vectors = @{
        size = 384
        distance = "Cosine"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$QDRANT_URL/collections/successful_schemas" -Method Put -Body $collection1 -ContentType "application/json"
    Write-Host "✅ successful_schemas created successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Error creating successful_schemas: $($_.Exception.Message)" -ForegroundColor Red
}

# Collection 2: SQL Patterns (for SQL import/export enhancement)
Write-Host "`n🗄️  Creating 'sql_patterns' collection..." -ForegroundColor Yellow

$collection2 = @{
    vectors = @{
        size = 384
        distance = "Cosine"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$QDRANT_URL/collections/sql_patterns" -Method Put -Body $collection2 -ContentType "application/json"
    Write-Host "✅ sql_patterns created successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Error creating sql_patterns: $($_.Exception.Message)" -ForegroundColor Red
}

# Collection 3: Field Type Mappings (for intelligent type inference)
Write-Host "`n🏷️  Creating 'field_type_mappings' collection..." -ForegroundColor Yellow

$collection3 = @{
    vectors = @{
        size = 384
        distance = "Cosine"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$QDRANT_URL/collections/field_type_mappings" -Method Put -Body $collection3 -ContentType "application/json"
    Write-Host "✅ field_type_mappings created successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Error creating field_type_mappings: $($_.Exception.Message)" -ForegroundColor Red
}

# Verify collections
Write-Host "`n🔍 Verifying collections..." -ForegroundColor Cyan

try {
    $collections = Invoke-RestMethod -Uri "$QDRANT_URL/collections" -Method Get
    Write-Host "`n✅ Total collections created: $($collections.result.collections.Count)" -ForegroundColor Green
    
    foreach ($col in $collections.result.collections) {
        Write-Host "  - $($col.name): $($col.vectors_count) vectors" -ForegroundColor White
    }
} catch {
    Write-Host "⚠️  Error verifying collections: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Qdrant setup complete!" -ForegroundColor Green
Write-Host "📊 Access Qdrant UI at: http://localhost:6333/dashboard" -ForegroundColor Cyan

