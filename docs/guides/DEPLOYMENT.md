# Deployment Guide

## Docker Deployment

### Development

```bash
docker-compose up -d
```

### Production

```bash
# Build and run
docker-compose -f docker-compose.yml up -d

# With PostgreSQL
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Environment Configuration

### Required Variables

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### Optional Features

- BankID integration
- Payment processing
- Email/SMS services

## Health Checks

- App: `http://localhost:3000/api/health`
- Database: Built-in connection check
- Redis: Container health check

## Scaling Considerations

- Use PostgreSQL for production
- Enable Redis for session storage
- Configure CDN for static assets
- Set up load balancer for multiple instances

## Security

- Enable HTTPS in production
- Use environment-specific secrets
- Regular security audits
- Database encryption at rest
