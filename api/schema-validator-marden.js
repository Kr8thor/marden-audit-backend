const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Marden SEO Audit Tool - Schema Markup Validator
 * This module analyzes and validates schema.org structured data
 */

/**
 * Extract schema.org structured data from HTML
 * @param {string} html - HTML content
 * @returns {Array} - Array of parsed schema objects
 */
function extractSchemaData(html) {
  const schemas = [];
  const $ = cheerio.load(html);
  
  // Find all JSON-LD schema markup
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const schemaText = $(el).html();
      const schemaData = JSON.parse(schemaText);
      schemas.push(schemaData);
    } catch (error) {
      console.warn(`Error parsing schema markup #${i + 1}:`, error.message);
      // Add the invalid schema with error information
      schemas.push({
        _error: true,
        _errorMessage: error.message,
        _rawData: $(el).html().substring(0, 200) + '...' // First 200 chars for debugging
      });
    }
  });
  
  // Find microdata schemas (basic support)
  $('[itemscope]').each((i, el) => {
    try {
      const $element = $(el);
      const itemType = $element.attr('itemtype') || '';
      
      // Only process if itemtype is present and contains schema.org
      if (itemType && itemType.includes('schema.org')) {
        const itemProps = {};
        
        // Extract all itemprops
        $element.find('[itemprop]').each((j, prop) => {
          const $prop = $(prop);
          const propName = $prop.attr('itemprop');
          
          if (propName) {
            // Extract value based on element type
            let propValue = '';
            
            if ($prop.is('meta')) {
              propValue = $prop.attr('content') || '';
            } else if ($prop.is('img')) {
              propValue = $prop.attr('src') || '';
            } else if ($prop.is('a')) {
              propValue = $prop.attr('href') || '';
            } else if ($prop.is('time')) {
              propValue = $prop.attr('datetime') || $prop.text().trim();
            } else {
              propValue = $prop.text().trim();
            }
            
            itemProps[propName] = propValue;
          }
        });
        
        schemas.push({
          '@type': itemType.split('/').pop(),
          '@context': 'https://schema.org',
          _microdata: true,
          ...itemProps
        });
      }
    } catch (error) {
      console.warn(`Error parsing microdata schema #${i + 1}:`, error.message);
    }
  });
  
  return schemas;
}

/**
 * Process and categorize schema markups
 * @param {Array} schemas - Array of schema objects
 * @returns {Object} - Categorized schema data
 */
function categorizeSchemas(schemas) {
  const result = {
    total: schemas.length,
    invalid: schemas.filter(s => s._error).length,
    types: {},
    microdataCount: schemas.filter(s => s._microdata).length,
    jsonLdCount: schemas.filter(s => !s._microdata && !s._error).length,
    schemas: schemas
  };
  
  // Categorize by type
  schemas.forEach(schema => {
    if (schema._error) return;
    
    // Handle nested schema structures
    const processSchema = (schema, parent = null) => {
      let type = schema['@type'];
      
      if (!type) return;
      
      // Handle array of types
      if (Array.isArray(type)) {
        type.forEach(t => {
          if (!result.types[t]) {
            result.types[t] = { count: 0, parents: [] };
          }
          result.types[t].count++;
          if (parent) {
            result.types[t].parents.push(parent);
          }
        });
      } else {
        // Single type
        if (!result.types[type]) {
          result.types[type] = { count: 0, parents: [] };
        }
        result.types[type].count++;
        if (parent) {
          result.types[type].parents.push(parent);
        }
      }
      
      // Process nested schemas
      Object.keys(schema).forEach(key => {
        const value = schema[key];
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          if (value['@type']) {
            processSchema(value, type);
          }
        } else if (Array.isArray(value)) {
          value.forEach(item => {
            if (typeof item === 'object' && item !== null && item['@type']) {
              processSchema(item, type);
            }
          });
        }
      });
    };
    
    processSchema(schema);
  });
  
  return result;
}

/**
 * Validate schema based on common requirements and best practices
 * @param {Object} schema - Schema markup to validate
 * @returns {Object} - Validation results
 */
function validateSchema(schema) {
  if (schema._error) {
    return {
      valid: false,
      errors: [{
        severity: 'critical',
        message: `Invalid JSON: ${schema._errorMessage}`
      }],
      warnings: []
    };
  }
  
  const errors = [];
  const warnings = [];
  const type = schema['@type'];
  
  // Check for required context
  if (!schema['@context'] && !schema._microdata) {
    errors.push({
      severity: 'critical',
      message: 'Missing @context property'
    });
  }
  
  // Check for type
  if (!type) {
    errors.push({
      severity: 'critical',
      message: 'Missing @type property'
    });
  }
  
  // Type-specific validations
  if (type) {
    // Organization validation
    if (type === 'Organization') {
      if (!schema.name) {
        errors.push({
          severity: 'critical',
          message: 'Organization schema missing required "name" property'
        });
      }
      
      if (!schema.url) {
        warnings.push({
          severity: 'warning',
          message: 'Organization schema missing recommended "url" property'
        });
      }
      
      if (!schema.logo) {
        warnings.push({
          severity: 'warning',
          message: 'Organization schema missing recommended "logo" property'
        });
      }
    }
    
    // Product validation
    else if (type === 'Product') {
      if (!schema.name) {
        errors.push({
          severity: 'critical',
          message: 'Product schema missing required "name" property'
        });
      }
      
      if (!schema.offers) {
        warnings.push({
          severity: 'warning',
          message: 'Product schema missing recommended "offers" property'
        });
      }
    }
    
    // Article validation
    else if (type === 'Article' || type === 'BlogPosting' || type === 'NewsArticle') {
      if (!schema.headline) {
        errors.push({
          severity: 'critical',
          message: `${type} schema missing required "headline" property`
        });
      }
      
      if (!schema.author) {
        warnings.push({
          severity: 'warning',
          message: `${type} schema missing recommended "author" property`
        });
      }
      
      if (!schema.datePublished) {
        warnings.push({
          severity: 'warning',
          message: `${type} schema missing recommended "datePublished" property`
        });
      }
    }
    
    // LocalBusiness validation
    else if (type === 'LocalBusiness') {
      if (!schema.name) {
        errors.push({
          severity: 'critical',
          message: 'LocalBusiness schema missing required "name" property'
        });
      }
      
      if (!schema.address) {
        errors.push({
          severity: 'critical',
          message: 'LocalBusiness schema missing required "address" property'
        });
      }
      
      if (!schema.telephone) {
        warnings.push({
          severity: 'warning',
          message: 'LocalBusiness schema missing recommended "telephone" property'
        });
      }
    }
    
    // Person validation
    else if (type === 'Person') {
      if (!schema.name) {
        errors.push({
          severity: 'critical',
          message: 'Person schema missing required "name" property'
        });
      }
    }
    
    // WebPage validation
    else if (type === 'WebPage') {
      if (!schema.name && !schema.headline) {
        warnings.push({
          severity: 'warning',
          message: 'WebPage schema missing recommended "name" or "headline" property'
        });
      }
    }
    
    // FAQ validation
    else if (type === 'FAQPage') {
      if (!schema.mainEntity || (Array.isArray(schema.mainEntity) && schema.mainEntity.length === 0)) {
        errors.push({
          severity: 'critical',
          message: 'FAQPage schema missing required "mainEntity" property'
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Analyze all structured data on a page
 * @param {string} url - URL to analyze
 * @param {string} html - HTML content (optional, will be fetched if not provided)
 * @returns {Promise<Object>} - Structured data analysis
 */
async function analyzeStructuredData(url, html = null) {
  try {
    // Fetch HTML if not provided
    if (!html) {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'MardenSEO-Audit/1.0 (https://audit.mardenseo.com)'
        }
      });
      html = response.data;
    }
    
    // Extract schemas
    const schemas = extractSchemaData(html);
    
    // Categorize schemas
    const categorized = categorizeSchemas(schemas);
    
    // Validate each schema
    const validations = schemas.map(schema => validateSchema(schema));
    
    // Calculate overall status
    const criticalErrors = validations.flatMap(v => v.errors.filter(e => e.severity === 'critical'));
    const allWarnings = validations.flatMap(v => v.warnings);
    
    let status = 'good';
    if (criticalErrors.length > 0) {
      status = 'error';
    } else if (allWarnings.length > 0) {
      status = 'warning';
    } else if (schemas.length === 0) {
      status = 'missing';
    }
    
    // Generate recommendations
    const recommendations = [];
    
    if (schemas.length === 0) {
      recommendations.push('Add schema.org structured data to improve search engine visibility.');
    }
    
    if (criticalErrors.length > 0) {
      recommendations.push('Fix validation errors in structured data to ensure proper indexing.');
    }
    
    if (categorized.jsonLdCount === 0 && categorized.microdataCount > 0) {
      recommendations.push('Consider using JSON-LD format instead of microdata for better compatibility.');
    }
    
    // Common schema recommendations
    const hasOrganization = !!categorized.types['Organization'];
    const hasWebSite = !!categorized.types['WebSite'];
    const hasWebPage = !!categorized.types['WebPage'];
    const hasBreadcrumbs = !!categorized.types['BreadcrumbList'];
    
    if (!hasOrganization) {
      recommendations.push('Add Organization schema to improve brand visibility in search results.');
    }
    
    if (!hasWebSite) {
      recommendations.push('Add WebSite schema to help search engines understand site structure.');
    }
    
    if (!hasWebPage) {
      recommendations.push('Add WebPage schema to provide context about the current page.');
    }
    
    if (!hasBreadcrumbs) {
      recommendations.push('Add BreadcrumbList schema to improve navigation display in search results.');
    }
    
    return {
      url,
      structuredData: {
        present: schemas.length > 0,
        count: schemas.length,
        types: Object.keys(categorized.types),
        formats: {
          jsonLd: categorized.jsonLdCount,
          microdata: categorized.microdataCount
        },
        status,
        invalidCount: categorized.invalid,
        errors: criticalErrors,
        warnings: allWarnings,
        recommendations: recommendations.slice(0, 5) // Top 5 recommendations
      },
      schemas: schemas.map((schema, index) => ({
        type: schema['@type'] || 'Unknown',
        format: schema._microdata ? 'microdata' : 'json-ld',
        valid: validations[index].valid,
        errors: validations[index].errors,
        warnings: validations[index].warnings,
        data: schema._error ? { error: schema._errorMessage } : schema
      }))
    };
  } catch (error) {
    console.error(`Error analyzing structured data for ${url}:`, error);
    return {
      url,
      structuredData: {
        present: false,
        count: 0,
        status: 'error',
        errors: [{
          severity: 'critical',
          message: `Failed to analyze structured data: ${error.message}`
        }],
        recommendations: ['Add schema.org structured data to improve search engine visibility.']
      },
      error: error.message
    };
  }
}

module.exports = {
  analyzeStructuredData,
  extractSchemaData,
  validateSchema
};