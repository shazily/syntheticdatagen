/**
 * SQL Generator Module
 * Generates SQL statements from schema and data using Knex.js
 */

// Simple SQL generation without external dependencies
class SQLGenerator {
    constructor() {
        this.tableName = 'generated_data';
    }

    /**
     * Generate complete SQL statements
     * @param {Array} schema - Array of field objects
     * @param {Array} data - Array of data objects
     * @param {string} tableName - Optional table name
     * @returns {string} Complete SQL statements
     */
    generateSQL(schema, data, tableName = 'generated_data') {
        this.tableName = tableName;
        
        let sql = this.generateHeader(tableName, data.length);
        sql += this.generateCreateTable(schema);
        sql += this.generateInserts(schema, data);
        
        return sql;
    }

    /**
     * Generate SQL header with metadata
     */
    generateHeader(tableName, recordCount) {
        const timestamp = new Date().toISOString();
        return `-- Table: ${tableName}\n-- Generated: ${timestamp}\n-- Records: ${recordCount}\n\n`;
    }

    /**
     * Generate CREATE TABLE statement
     */
    generateCreateTable(schema) {
        let sql = `CREATE TABLE "${this.tableName}" (\n`;
        sql += `    "id" SERIAL PRIMARY KEY,\n`;
        
        schema.forEach(field => {
            const sqlType = this.mapToSQLType(field.type);
            sql += `    "${field.name}" ${sqlType},\n`;
        });
        
        sql += `    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
        sql += `    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
        sql += `);\n\n`;
        
        return sql;
    }

    /**
     * Generate INSERT statements
     */
    generateInserts(schema, data) {
        if (data.length === 0) return '-- No data to insert\n';
        
        const columns = schema.map(field => `"${field.name}"`).join(', ');
        let sql = `INSERT INTO "${this.tableName}" (${columns}) VALUES\n`;
        
        const values = data.map(record => {
            const recordValues = schema.map(field => {
                const value = record[field.name];
                return this.escapeSQL(value);
            }).join(', ');
            
            return `(${recordValues})`;
        });
        
        sql += values.join(',\n') + ';\n';
        return sql;
    }

    /**
     * Map field types to SQL column types
     */
    mapToSQLType(fieldType) {
        const typeMap = {
            'varchar': 'VARCHAR(255)',
            'text': 'TEXT',
            'int': 'INTEGER',
            'integer': 'INTEGER',
            'decimal': 'DECIMAL(10,2)',
            'float': 'REAL',
            'date': 'DATE',
            'datetime': 'TIMESTAMP',
            'timestamp': 'TIMESTAMP',
            'boolean': 'BOOLEAN',
            'email': 'VARCHAR(255)',
            'phone': 'VARCHAR(20)',
            'url': 'VARCHAR(500)',
            'uuid': 'UUID'
        };
        
        return typeMap[fieldType] || 'VARCHAR(255)';
    }

    /**
     * Escape SQL values to prevent injection
     */
    escapeSQL(value) {
        if (value === null || value === undefined) return 'NULL';
        
        // Convert to string and escape
        let str = value.toString();
        
        // Escape single quotes
        str = str.replace(/'/g, "''");
        
        // Escape backslashes
        str = str.replace(/\\/g, "\\\\");
        
        return `'${str}'`;
    }

    /**
     * Generate SQL for specific database types
     */
    generateForDatabase(schema, data, dbType = 'postgresql') {
        switch (dbType) {
            case 'mysql':
                return this.generateMySQL(schema, data);
            case 'sqlite':
                return this.generateSQLite(schema, data);
            case 'postgresql':
            default:
                return this.generateSQL(schema, data);
        }
    }

    /**
     * Generate MySQL specific SQL
     */
    generateMySQL(schema, data) {
        // MySQL uses AUTO_INCREMENT instead of SERIAL
        let sql = this.generateHeader(this.tableName, data.length);
        sql += `CREATE TABLE \`${this.tableName}\` (\n`;
        sql += `    \`id\` INT AUTO_INCREMENT PRIMARY KEY,\n`;
        
        schema.forEach(field => {
            const sqlType = this.mapToMySQLType(field.type);
            sql += `    \`${field.name}\` ${sqlType},\n`;
        });
        
        sql += `    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
        sql += `    \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP\n`;
        sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;
        
        sql += this.generateInserts(schema, data);
        return sql;
    }

    /**
     * Map types for MySQL
     */
    mapToMySQLType(fieldType) {
        const typeMap = {
            'varchar': 'VARCHAR(255)',
            'text': 'TEXT',
            'int': 'INT',
            'integer': 'INT',
            'decimal': 'DECIMAL(10,2)',
            'float': 'FLOAT',
            'date': 'DATE',
            'datetime': 'DATETIME',
            'timestamp': 'TIMESTAMP',
            'boolean': 'BOOLEAN',
            'email': 'VARCHAR(255)',
            'phone': 'VARCHAR(20)',
            'url': 'VARCHAR(500)',
            'uuid': 'VARCHAR(36)'
        };
        
        return typeMap[fieldType] || 'VARCHAR(255)';
    }

    /**
     * Generate SQLite specific SQL
     */
    generateSQLite(schema, data) {
        let sql = this.generateHeader(this.tableName, data.length);
        sql += `CREATE TABLE "${this.tableName}" (\n`;
        sql += `    "id" INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
        
        schema.forEach(field => {
            const sqlType = this.mapToSQLiteType(field.type);
            sql += `    "${field.name}" ${sqlType},\n`;
        });
        
        sql += `    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,\n`;
        sql += `    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP\n`;
        sql += `);\n\n`;
        
        sql += this.generateInserts(schema, data);
        return sql;
    }

    /**
     * Map types for SQLite
     */
    mapToSQLiteType(fieldType) {
        const typeMap = {
            'varchar': 'TEXT',
            'text': 'TEXT',
            'int': 'INTEGER',
            'integer': 'INTEGER',
            'decimal': 'REAL',
            'float': 'REAL',
            'date': 'TEXT',
            'datetime': 'TEXT',
            'timestamp': 'TEXT',
            'boolean': 'INTEGER',
            'email': 'TEXT',
            'phone': 'TEXT',
            'url': 'TEXT',
            'uuid': 'TEXT'
        };
        
        return typeMap[fieldType] || 'TEXT';
    }
}

// Create global instance
window.sqlGenerator = new SQLGenerator();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SQLGenerator;
}
