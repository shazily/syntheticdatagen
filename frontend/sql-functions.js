// SQL Import/Export Functions for Synthetic Data Generator

// Parse PostgreSQL CREATE TABLE statement and extract schema
function parseSQLCreateTable(sqlStatement) {
    try {
        // Remove comments and extra whitespace
        let cleanSQL = sqlStatement
            .replace(/--.*$/gm, '')  // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove multi-line comments
            .trim();

        // Extract table name (optional, for display)
        const tableNameMatch = cleanSQL.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?(\w+)(?:`|")?/i);
        const tableName = tableNameMatch ? tableNameMatch[1] : 'imported_table';

        // Extract column definitions between parentheses
        const columnsMatch = cleanSQL.match(/\(([\s\S]+)\)/);
        if (!columnsMatch) {
            throw new Error('Could not find column definitions in CREATE TABLE statement');
        }

        const columnsBlock = columnsMatch[1];
        
        // Split by comma, but be careful of commas inside function calls
        const columnLines = columnsBlock.split(/,(?![^()]*\))/);
        
        const fields = [];
        
        for (let line of columnLines) {
            line = line.trim();
            
            // Skip constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, etc.)
            if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(line)) {
                continue;
            }
            
            // Parse column definition: column_name data_type [constraints]
            const columnMatch = line.match(/^(?:`|")?(\w+)(?:`|")?\s+(\w+)/i);
            if (!columnMatch) continue;
            
            const columnName = columnMatch[1];
            const dataType = columnMatch[2].toUpperCase();
            
            // Map SQL data types to our field types
            let fieldType = mapSQLTypeToFieldType(dataType, columnName);
            
            // Check for NOT NULL constraint
            const isNullable = !/NOT\s+NULL/i.test(line);
            const blankPercentage = isNullable ? 10 : 0;
            
            fields.push({
                name: columnName,
                type: fieldType,
                blankPercentage: blankPercentage
            });
        }
        
        if (fields.length === 0) {
            throw new Error('No valid columns found in CREATE TABLE statement');
        }
        
        return {
            success: true,
            tableName: tableName,
            fields: fields
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Map SQL data types to our field types
function mapSQLTypeToFieldType(sqlType, columnName = '') {
    const lowerName = columnName.toLowerCase();
    
    // Smart mapping based on column name
    if (lowerName.includes('email') || lowerName.includes('e_mail')) return 'Email Address';
    if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('tel')) return 'Phone Number';
    if (lowerName.includes('first') && lowerName.includes('name')) return 'First Name';
    if (lowerName.includes('last') && lowerName.includes('name')) return 'Last Name';
    if (lowerName.includes('company') || lowerName.includes('organization')) return 'Company';
    if (lowerName.includes('job') || lowerName.includes('title') || lowerName.includes('position')) return 'Job Title';
    if (lowerName.includes('department') || lowerName.includes('dept')) return 'Department';
    if (lowerName.includes('address') || lowerName.includes('street')) return 'Address';
    if (lowerName.includes('city')) return 'City';
    if (lowerName.includes('country')) return 'Country';
    if (lowerName.includes('state') || lowerName.includes('province')) return 'State';
    if (lowerName.includes('zip') || lowerName.includes('postal')) return 'Zip Code';
    if (lowerName.includes('url') || lowerName.includes('website') || lowerName.includes('link')) return 'URL';
    if (lowerName.includes('username') || lowerName.includes('user_name')) return 'Username';
    if (lowerName.includes('password') || lowerName.includes('pwd')) return 'Password';
    if (lowerName.includes('birthdate') || lowerName.includes('dob') || lowerName.includes('birth_date')) return 'Birthdate';
    if (lowerName.includes('age')) return 'Age';
    if (lowerName.includes('gender') || lowerName.includes('sex')) return 'Gender';
    if (lowerName.includes('invoice')) return 'Invoice Number';
    if (lowerName.includes('transaction') && lowerName.includes('id')) return 'Transaction ID';
    if (lowerName.includes('account') && lowerName.includes('number')) return 'Account Number';
    if (lowerName.includes('balance') || lowerName.includes('amount')) return 'Amount';
    if (lowerName.includes('currency')) return 'Currency';
    if (lowerName.includes('credit') && lowerName.includes('card')) return 'Credit Card';
    if (lowerName.includes('tax') && lowerName.includes('id')) return 'Tax ID';
    if (lowerName.includes('uuid') || lowerName.includes('guid')) return 'UUID';
    if (lowerName.includes('ip') || lowerName.includes('ipaddress')) return 'IP Address v4';
    
    // Type-based mapping
    const typeMap = {
        // Number types
        'INTEGER': 'Integer',
        'INT': 'Integer',
        'BIGINT': 'Integer',
        'SMALLINT': 'Integer',
        'SERIAL': 'Row Number',
        'BIGSERIAL': 'Row Number',
        'DECIMAL': 'Decimal',
        'NUMERIC': 'Decimal',
        'REAL': 'Decimal',
        'DOUBLE': 'Decimal',
        'FLOAT': 'Decimal',
        'MONEY': 'Amount',
        
        // Date/Time types
        'DATE': 'Date',
        'TIMESTAMP': 'DateTime',
        'TIMESTAMPTZ': 'DateTime',
        'TIME': 'Time',
        'DATETIME': 'DateTime',
        
        // Boolean
        'BOOLEAN': 'Boolean',
        'BOOL': 'Boolean',
        
        // UUID
        'UUID': 'UUID',
        
        // JSON
        'JSON': 'Custom',
        'JSONB': 'Custom',
        
        // String types (default to Custom to let user choose)
        'VARCHAR': 'Custom',
        'CHAR': 'Custom',
        'TEXT': 'Custom',
        'STRING': 'Custom'
    };
    
    return typeMap[sqlType] || 'Custom';
}

// Map field type to PostgreSQL data type
function mapFieldTypeToSQL(fieldType) {
    const typeMap = {
        'First Name': 'VARCHAR(100)',
        'Last Name': 'VARCHAR(100)',
        'Email Address': 'VARCHAR(255)',
        'Phone Number': 'VARCHAR(20)',
        'Address': 'TEXT',
        'Gender': 'VARCHAR(20)',
        'Birthdate': 'DATE',
        'Age': 'INTEGER',
        
        'Company': 'VARCHAR(200)',
        'Job Title': 'VARCHAR(100)',
        'Department': 'VARCHAR(100)',
        'Industry': 'VARCHAR(100)',
        'Website': 'VARCHAR(255)',
        
        'Credit Card': 'VARCHAR(19)',
        'Currency': 'VARCHAR(3)',
        'Amount': 'DECIMAL(15,2)',
        'IBAN': 'VARCHAR(34)',
        'Account Number': 'VARCHAR(20)',
        'Invoice Number': 'VARCHAR(50)',
        'Tax ID': 'VARCHAR(50)',
        'Ledger Code': 'VARCHAR(20)',
        'Cost Center': 'VARCHAR(20)',
        'Transaction ID': 'VARCHAR(50)',
        'Transaction Amount': 'DECIMAL(15,2)',
        'Payment Status': 'VARCHAR(20)',
        
        'UUID': 'UUID',
        'IP Address v4': 'INET',
        'IP Address v6': 'INET',
        'URL': 'VARCHAR(255)',
        'Username': 'VARCHAR(50)',
        'Password': 'VARCHAR(255)',
        'MAC Address': 'VARCHAR(17)',
        'User Agent': 'TEXT',
        
        'Date': 'DATE',
        'DateTime': 'TIMESTAMP',
        'Time': 'TIME',
        'Timestamp': 'TIMESTAMP',
        'Future Date': 'DATE',
        'Past Date': 'DATE',
        
        'Integer': 'INTEGER',
        'Decimal': 'DECIMAL(10,2)',
        'Percentage': 'DECIMAL(5,2)',
        'Row Number': 'SERIAL',
        'Boolean': 'BOOLEAN',
        
        'Latitude': 'DECIMAL(10,8)',
        'Longitude': 'DECIMAL(11,8)',
        'Country': 'VARCHAR(100)',
        'City': 'VARCHAR(100)',
        'State': 'VARCHAR(100)',
        'Zip Code': 'VARCHAR(10)',
        'Street Name': 'VARCHAR(100)',
        'Building Number': 'VARCHAR(10)',
        
        'Custom': 'TEXT'
    };
    
    return typeMap[fieldType] || 'TEXT';
}

// Generate PostgreSQL CREATE TABLE statement from schema
function generateSQLCreateTable(schema, tableName = 'synthetic_data') {
    if (!schema || schema.length === 0) {
        throw new Error('Schema is empty');
    }
    
    // Sanitize table name
    const safeName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    let sql = `CREATE TABLE ${safeName} (\n`;
    
    const columnDefs = schema.map((field, index) => {
        const columnName = field.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        
        // Find the display name from fieldTypes if field.type is a code
        let fieldTypeName = field.type;
        if (typeof fieldTypes !== 'undefined') {
            const fieldTypeEntry = Object.entries(fieldTypes).find(([name, data]) => data.type === field.type);
            if (fieldTypeEntry) {
                fieldTypeName = fieldTypeEntry[0];
            }
        }
        
        const dataType = mapFieldTypeToSQL(fieldTypeName);
        const nullable = field.blankPercentage > 0 ? '' : ' NOT NULL';
        
        return `    ${columnName} ${dataType}${nullable}`;
    });
    
    sql += columnDefs.join(',\n');
    sql += '\n);';
    
    return sql;
}

// Download SQL file
function downloadSQL(sqlContent, filename = 'schema.sql') {
    const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Open SQL Import Modal
function openSQLImportModal() {
    const modalContent = `
        <div class="modal-header">
            <div class="modal-title-section">
                <h2 class="modal-title">Import from SQL</h2>
                <p class="modal-subtitle">Paste a PostgreSQL CREATE TABLE statement to generate schema</p>
            </div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="sql-import-section">
                <label for="sql-input">CREATE TABLE Statement:</label>
                <textarea 
                    id="sql-input" 
                    class="sql-textarea" 
                    rows="15"
                    placeholder="CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"
                ></textarea>
                <p class="help-text">Supports PostgreSQL syntax. Column constraints (PRIMARY KEY, FOREIGN KEY, etc.) will be ignored.</p>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="closeModal()">CANCEL</button>
            <button class="btn-primary" onclick="importFromSQL()">IMPORT SCHEMA</button>
        </div>
    `;
    
    openModal(modalContent);
}

// Import schema from SQL
function importFromSQL() {
    const sqlInput = document.getElementById('sql-input');
    if (!sqlInput || !sqlInput.value.trim()) {
        showToast('error', 'Empty Input', 'Please paste a CREATE TABLE statement');
        return;
    }
    
    const result = parseSQLCreateTable(sqlInput.value);
    
    if (!result.success) {
        showToast('error', 'Parse Error', result.error);
        return;
    }
    
    // Clear existing schema
    schemaBuilder.schema = [];
    
    // Add parsed fields to schema
    result.fields.forEach(field => {
        const fieldTypeData = Object.entries(fieldTypes).find(([name, data]) => 
            name === field.type
        );
        
        const fieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        if (fieldTypeData) {
            // Use the matching field type
            schemaBuilder.schema.push({
                id: fieldId,
                name: field.name,
                type: fieldTypeData[1].type,
                blankPercentage: field.blankPercentage
            });
        } else {
            // Use custom type
            schemaBuilder.schema.push({
                id: fieldId,
                name: field.name,
                type: 'custom',
                blankPercentage: field.blankPercentage
            });
        }
    });
    
    schemaBuilder.renderSchema();
    closeModal();
    showToast('success', 'SQL Imported', `Successfully imported ${result.fields.length} fields from ${result.tableName}`);
}

// Generate and download SQL for current schema
function generateAndDownloadSQL() {
    if (schemaBuilder.schema.length === 0) {
        showToast('error', 'No Schema', 'Please add fields to your schema first');
        return;
    }
    
    try {
        const sqlContent = generateSQLCreateTable(schemaBuilder.schema);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        downloadSQL(sqlContent, `schema_${timestamp}.sql`);
        showToast('success', 'SQL Downloaded', 'CREATE TABLE statement has been downloaded');
    } catch (error) {
        showToast('error', 'Generation Error', error.message);
    }
}

