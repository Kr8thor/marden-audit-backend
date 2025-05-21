# Marden SEO Audit Tool - API Documentation

## Overview

The Marden SEO Audit Tool API provides comprehensive SEO analysis functionality including basic page analysis, structured data validation, mobile-friendliness testing, and full site crawling. This document outlines the available endpoints, parameters, and response formats.

## Base URL

- Production: `https://marden-audit-backend-production.up.railway.app`
- Development: `http://localhost:3000`

## Authentication

The API currently does not require authentication and is available for public use.

## Endpoints

### Health Check

Verifies the API and its components are functioning correctly.

```
GET /health
```

#### Response

```json
{
  "status": "ok",
  "version": "v2.1",
  "message": "Marden SEO Audit API is operational",
  "components": {
    "api": {
      "status": "ok"
    },
    "redis": {
      "status": "ok",
      "message": "Connected"
    }
  },
  "memory": {
    "rss": "120MB",
    "heapUsed": "80MB",
    "heapTotal": "150MB"
  },
  "concurrency": {
    "activeRequests": 1,
    "pendingRequests": 0,
    "limit": 3
  },
  "timestamp": "2023-04-15T12:34:56.789Z"
}
```

### API Information

Returns information about the API and available endpoints.

```
GET /
```

#### Response

```json
{
  "service": "Marden SEO Audit API",
  "status": "running",
  "endpoints": [
    "/health",
    "/seo-analyze",
    "/basic-audit",
    "/enhanced-seo-analyze",
    "/schema-analyze",
    "/mobile-analyze"
  ],
  "documentation": "https://github.com/Kr8thor/marden-audit-backend"
}
```

### Basic SEO Analysis

Analyzes a single URL for basic SEO factors.

```
POST /seo-analyze
```

#### Request Body

```json
{
  "url": "https://example.com",
  "options": {
    "enhanced": true
  }
}
```

#### Request Parameters

- `url` (required): The URL to analyze
- `options` (optional): Analysis options
  - `enhanced` (boolean): Use enhanced analysis mode

#### Alternative GET Method

```
GET /seo-analyze?url=https://example.com&enhanced=true
```

#### Response

```json
{
  "status": "ok",
  "message": "SEO analysis completed",
  "url": "https://example.com",
  "cached": false,
  "timestamp": "2023-04-15T12:34:56.789Z",
  "data": {
    "url": "https://example.com",
    "score": 85,
    "status": "good",
    "criticalIssuesCount": 0,
    "totalIssuesCount": 3,
    "categories": {
      "metadata": { "score": 90, "issues": [] },
      "content": { "score": 80, "issues": [] },
      "technical": { "score": 95, "issues": [] },
      "userExperience": { "score": 85, "issues": [] }
    },
    "recommendations": [],
    "pageData": {
      "title": {
        "text": "Example Domain",
        "length": 14
      },
      "metaDescription": {
        "text": "This domain is for use in illustrative examples in documents.",
        "length": 62
      },
      "headings": {
        "h1Count": 1,
        "h1Texts": ["Example Domain"],
        "h2Count": 0,
        "h2Texts": [],
        "h3Count": 0
      },
      "content": {
        "wordCount": 28,
        "contentLength": 200,
        "textSample": "This domain is for use in illustrative examples..."
      },
      "links": {
        "internalCount": 0,
        "externalCount": 1,
        "totalCount": 1
      },
      "images": {
        "total": 0,
        "withoutAlt": 0,
        "samples": []
      },
      "technical": {
        "hasCanonical": true,
        "canonicalUrl": "https://example.com/"
      }
    },
    "performanceMetrics": {
      "lcp": {
        "value": 1.2,
        "unit": "s",
        "score": 95
      },
      "cls": {
        "value": 0.05,
        "score": 98
      },
      "fid": {
        "value": 80,
        "unit": "ms",
        "score": 95
      }
    },
    "metadata": {
      "analysisTime": 850,
      "htmlSize": "2 KB"
    },
    "analyzedAt": "2023-04-15T12:34:56.789Z",
    "analyzedWith": "improved-lightweight"
  }
}
```

### Schema Analysis

Analyzes structured data (schema.org markup) on a webpage.

```
GET /schema-analyze?url=https://example.com
```

#### Request Parameters

- `url` (required): The URL to analyze

#### Response

```json
{
  "status": "ok",
  "message": "Schema analysis completed",
  "url": "https://example.com",
  "cached": false,
  "timestamp": "2023-04-15T12:34:56.789Z",
  "data": {
    "url": "https://example.com",
    "structuredData": {
      "present": true,
      "count": 2,
      "types": ["Organization", "WebPage"],
      "formats": {
        "jsonLd": 2,
        "microdata": 0
      },
      "status": "good",
      "invalidCount": 0,
      "errors": [],
      "warnings": [],
      "recommendations": []
    },
    "schemas": [
      {
        "type": "Organization",
        "format": "json-ld",
        "valid": true,
        "errors": [],
        "warnings": [],
        "data": {}
      }
    ]
  }
}
```

### Mobile-Friendliness Analysis

Analyzes mobile-friendliness factors for a webpage.

```
GET /mobile-analyze?url=https://example.com
```

#### Request Parameters

- `url` (required): The URL to analyze

#### Response

```json
{
  "status": "ok",
  "message": "Mobile-friendliness analysis completed",
  "url": "https://example.com",
  "cached": false,
  "timestamp": "2023-04-15T12:34:56.789Z",
  "data": {
    "url": "https://example.com",
    "mobileFriendliness": {
      "score": 85,
      "status": "good",
      "issues": 1,
      "criticalIssues": 0,
      "factors": {
        "viewport": {
          "present": true,
          "hasWidth": true,
          "hasInitialScale": true,
          "value": "width=device-width, initial-scale=1"
        },
        "textSize": {
          "minFontSize": 14
        },
        "tapTargets": {
          "smallTargetsCount": 2
        },
        "responsiveDesign": {
          "mediaQueryCount": 3,
          "hasFixedWidth": false,
          "hasHorizontalScroll": false
        },
        "compatibility": {
          "usesFlash": false,
          "hasAmpVersion": false,
          "hasMobileVersion": false
        }
      },
      "issues": [
        {
          "type": "few_small_tap_targets",
          "severity": "info",
          "impact": "low",
          "recommendation": "Consider increasing size of some smaller buttons and links for better mobile usability"
        }
      ],
      "recommendations": [
        "Consider increasing size of some smaller buttons and links for better mobile usability"
      ],
      "positiveAspects": [
        "Proper viewport configuration",
        "Good use of responsive media queries",
        "Font size is readable on mobile devices"
      ]
    }
  }
}
```

### Enhanced SEO Analysis

Performs comprehensive SEO analysis with multiple components.

```
POST /enhanced-seo-analyze
```

#### Request Body

```json
{
  "url": "https://example.com",
  "options": {
    "mobileAnalysis": true,
    "schemaAnalysis": true,
    "siteCrawl": false,
    "maxPages": 10,
    "maxDepth": 2
  }
}
```

#### Request Parameters

- `url` (required): The URL to analyze
- `options` (optional): Analysis options
  - `mobileAnalysis` (boolean): Include mobile-friendliness analysis
  - `schemaAnalysis` (boolean): Include structured data analysis
  - `siteCrawl` (boolean): Perform site crawl instead of single page analysis
  - `maxPages` (number): Maximum pages to crawl (only with siteCrawl)
  - `maxDepth` (number): Maximum crawl depth (only with siteCrawl)

#### Response

```json
{
  "status": "ok",
  "message": "Enhanced SEO analysis completed",
  "url": "https://example.com",
  "cached": false,
  "timestamp": "2023-04-15T12:34:56.789Z",
  "data": {
    "url": "https://example.com",
    "analysisType": "page",
    "score": 80,
    "status": "good",
    "components": {
      "mobileFriendliness": {
        // Mobile-friendliness analysis results (same format as /mobile-analyze)
      },
      "structuredData": {
        // Structured data analysis results (same format as /schema-analyze)
      }
    },
    "recommendations": [
      "Add schema.org structured data to improve search engine visibility",
      "Increase minimum font size to at least 12px for mobile readability"
    ],
    "timestamp": "2023-04-15T12:34:56.789Z"
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "status": "error",
  "message": "Human-readable error message",
  "error": "Technical error details (non-production only)",
  "timestamp": "2023-04-15T12:34:56.789Z",
  "code": "ERROR_CODE" // Optional error code
}
```

### Common Error Codes

- `INVALID_URL`: URL is malformed or invalid
- `MISSING_PARAMETER`: Required parameter is missing
- `FETCH_ERROR`: Failed to fetch target URL
- `TIMEOUT_ERROR`: Request timed out
- `REDIS_ERROR`: Redis operation failed
- `MEMORY_LIMIT`: Memory limit exceeded
- `CONCURRENCY_LIMIT`: Too many concurrent requests
- `INTERNAL_ERROR`: Unspecified internal error

## Rate Limiting

The API currently implements a concurrency limit of 3 simultaneous requests, with a queue length of 10. Additional requests beyond this limit will receive a `CONCURRENCY_LIMIT` error.

## Caching

The API implements a two-tier caching system:

1. **Memory cache**: 1-hour TTL, limited to 100 entries
2. **Redis cache**: 24-hour TTL

Cached responses will have `cached: true` and include a `cachedAt` timestamp.

## Contact & Support

- Maintainer: Leo Mardenborough
- GitHub: [@Kr8thor](https://github.com/Kr8thor)
- Email: [support@mardenseo.com](mailto:support@mardenseo.com)