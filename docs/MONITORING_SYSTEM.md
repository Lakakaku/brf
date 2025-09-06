# BRF Portal Performance Monitoring System

## Overview

The BRF Portal includes a comprehensive performance monitoring system specifically designed for Swedish cooperative housing management (Bostadsrättsföreningar). The system provides real-time insights into system performance, database efficiency, and BRF-specific business metrics while maintaining zero-cost development principles.

## Architecture

### Core Components

1. **Performance Collector** (`/lib/monitoring/collector.ts`)
   - Lightweight metrics collection with minimal overhead
   - Batched database writes for optimal performance
   - Support for counters, gauges, histograms, and timers

2. **Database Monitoring** (`/lib/monitoring/database-middleware.ts`)
   - Query performance tracking with SQLite integration
   - Slow query detection and optimization insights
   - Connection pool monitoring

3. **BRF Metrics Collector** (`/lib/monitoring/brf-metrics.ts`)
   - Swedish BRF-specific KPIs and compliance metrics
   - Financial health indicators
   - Energy efficiency tracking
   - Governance and regulatory compliance

4. **Alert Engine** (`/lib/monitoring/alert-engine.ts`)
   - Configurable threshold, anomaly, and trend detection
   - Multi-channel notifications (email, SMS, webhooks)
   - Smart suppression and rate limiting

5. **Dashboard Components**
   - Real-time performance visualization
   - Swedish language interface
   - BRF-focused metrics and charts

## Key Features

### Swedish BRF-Specific Metrics

- **Financial Health**
  - Monthly fee collection rate (Månadsavgift inbetalningsgrad)
  - Overdue payment ratios (Förfallna betalningar)
  - Budget variance tracking (Budgetavvikelser)

- **Operational Efficiency**
  - Case resolution times (Ärendehantering)
  - Maintenance backlog (Underhållsköer)
  - Energy efficiency trends (Energieffektivitet)
  - Member satisfaction scores (Medlemsnöjdhet)

- **Compliance & Governance**
  - Board meeting attendance (Styrelsemöten närvarande)
  - Annual report compliance (Årsredovisning)
  - GDPR compliance scoring
  - Energy certificate monitoring

### Performance Monitoring

- **System Metrics**
  - CPU and memory usage
  - Event loop lag monitoring
  - Uptime tracking
  - Container health checks

- **Database Performance**
  - Query execution times
  - Slow query detection
  - Connection monitoring
  - SQLite-specific optimizations

- **API Performance**
  - Response time tracking
  - Error rate monitoring
  - Endpoint-specific metrics
  - Status code distribution

## Installation & Setup

### Development Environment

1. **Start the monitoring stack:**
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

2. **Initialize performance schema:**
```bash
npm run db:init
```

3. **Start the application with monitoring enabled:**
```bash
MONITORING_ENABLED=true npm run dev
```

### Production Deployment

1. **Configure environment variables:**
```bash
NODE_ENV=production
MONITORING_ENABLED=true
ALERT_ENGINE_ENABLED=true
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
```

2. **Deploy monitoring stack:**
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

3. **Configure alerts:**
   - Set up email/SMS credentials in AlertManager
   - Configure webhook endpoints for Slack/Teams
   - Define cooperative-specific alert thresholds

## Accessing Monitoring Tools

### Web Interfaces

- **BRF Portal Monitoring Dashboard**: http://localhost:3000/admin/monitoring
- **Grafana Dashboards**: http://localhost:3001 (admin/admin123)
- **Prometheus Metrics**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **SQLite Web Interface**: http://localhost:8081

### API Endpoints

- **Dashboard Data**: `GET /api/monitoring/dashboard?cooperativeId=<id>`
- **Record Metrics**: `POST /api/monitoring/dashboard`
- **Manage Alerts**: `GET|POST /api/monitoring/alerts`
- **Alert Operations**: `PUT|DELETE /api/monitoring/alerts/<id>`

## Configuration

### Alert Configuration

Create performance alerts through the admin interface or API:

```javascript
{
  "alertName": "High Payment Default Rate",
  "alertType": "threshold",
  "metricName": "overdue_payment_ratio",
  "metricCategory": "brf_operations",
  "thresholdValue": 15.0,
  "thresholdOperator": ">",
  "thresholdDurationMinutes": 30,
  "severity": "high",
  "notificationChannels": ["email", "sms"],
  "notifyRoles": ["board", "treasurer"],
  "notifyEmails": ["styrelse@brf.se"]
}
```

### Custom Metrics

Record custom metrics programmatically:

```javascript
import { performanceCollector } from '@/lib/monitoring/collector';

performanceCollector.recordMetric({
  name: 'member_satisfaction_survey',
  category: 'brf_operations',
  type: 'gauge',
  value: 8.5,
  unit: 'score',
  cooperativeId: 'brf-123',
  tags: { survey_type: 'annual' }
});
```

### Database Query Monitoring

Wrap database operations with performance tracking:

```javascript
import { withDatabasePerformanceMonitoring } from '@/lib/monitoring/database-middleware';

export default withDatabasePerformanceMonitoring(
  async (req, res) => {
    // Your API handler with automatic query monitoring
    const members = await req.monitoredDb.prepare(`
      SELECT * FROM members WHERE cooperative_id = ?
    `).all(req.cooperative.id);
    
    res.json(members);
  },
  'get_members' // Operation name
);
```

## Swedish BRF Compliance Features

### Regulatory Compliance Monitoring

The system automatically tracks compliance with Swedish BRF regulations:

- **Annual Report Filing** (Årsredovisning)
  - Deadline monitoring (typically July 31st)
  - Filing status tracking
  - Automatic reminders

- **Energy Certificate Compliance** (Energideklaration)
  - Certificate expiration monitoring
  - Energy class tracking (A-G scale)
  - Renewal notifications

- **Board Meeting Requirements** (Styrelseprotokoll)
  - Quorum tracking (Beslutförhet)
  - Meeting frequency compliance
  - Protocol completion monitoring

### Financial Health Metrics

- **Payment Collection Efficiency**
  - Real-time collection rates
  - Member payment behavior analysis
  - Overdue payment trends

- **Budget Variance Analysis**
  - Monthly budget vs. actual spending
  - Category-wise variance tracking
  - Forecast accuracy metrics

### Energy Management

- **Consumption Tracking**
  - kWh per square meter monitoring
  - Cost efficiency analysis
  - Weather-adjusted comparisons

- **Sustainability Metrics**
  - CO2 emissions per square meter
  - Renewable energy ratio tracking
  - Energy efficiency improvements

## Zero-Cost Development Philosophy

### Local Development
- SQLite database (no external database required)
- In-memory metrics collection
- File-based logging and storage

### Production Scaling
- Container-based deployment
- Horizontal scaling support
- Cloud-native monitoring integration

### Cost Optimization
- Configurable data retention policies
- Metric sampling and aggregation
- Efficient storage using SQLite compression

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check metric collection buffer sizes
   - Verify data retention settings
   - Monitor SQLite database growth

2. **Missing Metrics**
   - Verify monitoring is enabled
   - Check database schema migration
   - Validate metric collection points

3. **Alert Delivery Issues**
   - Confirm SMTP configuration
   - Check notification channel settings
   - Verify rate limiting settings

### Performance Optimization

1. **Database Optimization**
   - Regular VACUUM operations for SQLite
   - Index optimization for monitoring tables
   - Query performance analysis

2. **Metric Collection Tuning**
   - Adjust batch sizes for high-volume metrics
   - Configure appropriate sampling rates
   - Optimize metric retention policies

## Integration Examples

### Grafana Dashboard Configuration

```yaml
# grafana/provisioning/dashboards/brf-overview.json
{
  "dashboard": {
    "title": "BRF Overview",
    "panels": [
      {
        "title": "Payment Collection Rate",
        "targets": [
          {
            "expr": "brf_payment_collection_rate",
            "legendFormat": "Collection Rate %"
          }
        ]
      }
    ]
  }
}
```

### Prometheus Alert Rules

```yaml
# prometheus/rules/brf-alerts.yml
- alert: LowPaymentCollectionRate
  expr: brf_payment_collection_rate < 85
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "Payment collection rate below 85%"
    description: "BRF payment collection rate has been below 85% for 1 hour"
```

## Security Considerations

- **Data Privacy**: Personal data is anonymized in metrics
- **Access Control**: Role-based access to monitoring interfaces
- **GDPR Compliance**: Configurable data retention and deletion
- **Audit Logging**: Comprehensive activity tracking

## Support & Maintenance

### Regular Maintenance Tasks

1. **Weekly**
   - Review alert effectiveness
   - Check system resource usage
   - Verify backup operations

2. **Monthly**
   - Analyze performance trends
   - Update alert thresholds
   - Review compliance metrics

3. **Quarterly**
   - Conduct capacity planning
   - Update monitoring documentation
   - Review and optimize alert rules

### Monitoring the Monitors

- **Health checks for monitoring components**
- **Self-monitoring and alerting**
- **Automatic failover configurations**
- **Monitoring data integrity checks**

## Roadmap

### Future Enhancements

- **Machine Learning Integration**
  - Anomaly detection algorithms
  - Predictive maintenance alerts
  - Automated threshold optimization

- **Mobile Monitoring App**
  - Real-time notifications
  - Key metrics dashboard
  - Emergency response features

- **Advanced Analytics**
  - Comparative BRF benchmarking
  - Seasonal trend analysis
  - Predictive financial modeling

For detailed technical documentation, see the individual component README files in the `/lib/monitoring/` directory.