# ADR-002: Multi-Tenancy Architecture Strategy

**Date**: January 2025  
**Status**: Accepted  
**Deciders**: Solo Developer/Founder  
**Tags**: #architecture #database #security #critical

## Context

The BRF Portal must support thousands of housing cooperatives, each with strict requirements for data isolation. Swedish law requires complete data separation between cooperatives, especially for:

- Personal data (GDPR compliance)
- Financial records
- Legal documents
- Member communications

Key requirements:

- Support 10,000+ cooperatives at scale
- Complete data isolation between tenants
- Cost-effective for small BRFs (20-60 apartments)
- Simple backup and disaster recovery
- Ability to extract single cooperative's data
- Performance must not degrade with tenant count

Current constraints:

- Solo developer (maintenance simplicity critical)
- Bootstrap budget (minimize infrastructure costs)
- Swedish regulatory compliance mandatory

## Decision

We will implement **Shared Database with Row-Level Security (RLS)** using Supabase's PostgreSQL.

### Architecture Details

```sql
-- Every table includes cooperative_id
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cooperative_id UUID NOT NULL,
    -- other columns
);

-- RLS policy using Supabase Auth
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy uses Supabase's auth.uid() function
CREATE POLICY tenant_isolation ON documents
    FOR ALL
    USING (
        cooperative_id IN (
            SELECT cooperative_id FROM members
            WHERE user_id = auth.uid()
        )
    );
```

### Tenant Identification with Supabase

- **Subdomain-based routing**: `{brf-name}.brfportal.se`
- **Middleware extraction**: Next.js middleware identifies tenant
- **Supabase Auth**: JWT contains user context
- **Automatic RLS**: Supabase applies policies based on auth.uid()
- **Real-time isolation**: Subscriptions respect RLS automatically

## Rationale

### Why Shared Database over Database-per-Tenant?

**Pros of Shared Database**:

- **Cost**: Single database instance (~$20/month vs $20/tenant)
- **Maintenance**: One database to backup, upgrade, migrate
- **Deployment**: No complex routing or connection pooling
- **Cross-tenant**: Easy to build admin tools and analytics
- **Onboarding**: New tenant ready in seconds

**Cons considered**:

- **Risk**: Data leak if RLS fails (mitigated by testing)
- **Noisy neighbor**: One tenant affects others (mitigated by indexing)
- **Compliance**: Some enterprises want physical isolation (not our market)

### Why Row-Level Security over Application-Level?

**Pros of RLS**:

- **Security**: Database enforces isolation, not application
- **Simplicity**: No need to add WHERE clauses everywhere
- **Performance**: Database optimizes tenant filtering
- **Audit**: Database logs show access attempts
- **Reliability**: Cannot forget to filter by tenant

**Cons considered**:

- **PostgreSQL specific**: Vendor lock-in (acceptable)
- **Complexity**: RLS policies can be tricky (good documentation exists)

### Why Subdomains over Path-Based?

**Pros of Subdomains**:

- **Clarity**: Clear tenant identification
- **Security**: Cookie isolation between subdomains
- **Vanity**: BRFs like having "their own" site
- **SSL**: Wildcard certificate covers all
- **SEO**: Each BRF can have own SEO presence

**Cons considered**:

- **DNS**: Need wildcard DNS (easy with Cloudflare)
- **SSL**: Need wildcard certificate (Let's Encrypt supports)

## Consequences

### Positive

- **Low cost**: ~$20/month serves hundreds of BRFs
- **Simple operations**: Single database to manage
- **Fast onboarding**: New BRF ready in minutes
- **Shared improvements**: Schema updates benefit all
- **Easy analytics**: Cross-tenant insights possible

### Negative

- **Scaling limits**: Eventually need sharding (>10,000 tenants)
- **Performance coupling**: Bad query affects all tenants
- **Backup granularity**: Must restore all or nothing
- **Vendor lock-in**: PostgreSQL RLS specific

### Risks

- **Data breach**: RLS failure exposes all tenants
  - Mitigation: Extensive testing, security audits
- **Performance**: Large tenant impacts others
  - Mitigation: Query timeout, resource limits
- **Compliance**: Some enterprises need physical isolation
  - Mitigation: Offer private instance at premium

## Implementation Strategy

### Phase 1: MVP (1-50 cooperatives)

```javascript
// Simple middleware
export async function middleware(request) {
  const hostname = request.headers.get('host');
  const subdomain = hostname.split('.')[0];

  const cooperative = await getCooperativeBySubdomain(subdomain);
  request.headers.set('X-Cooperative-ID', cooperative.id);
}
```

### Phase 2: Growth (50-500 cooperatives)

- Add Redis caching for tenant lookup
- Implement query performance monitoring
- Add tenant-specific rate limiting

### Phase 3: Scale (500-5000 cooperatives)

- Consider read replicas per region
- Implement automatic tenant size monitoring
- Plan for horizontal sharding

### Phase 4: Enterprise (5000+ cooperatives)

- Offer dedicated instances for large cooperatives
- Implement cross-database queries for analytics
- Consider Citus for horizontal scaling

## Alternatives Considered

### Alternative 1: Database per Tenant

```
tenant1.db, tenant2.db, tenant3.db...
```

- Pros: Complete isolation, easy compliance
- Cons: Expensive, complex management
- Rejected: Too expensive for small BRFs

### Alternative 2: Schema per Tenant

```sql
CREATE SCHEMA tenant_001;
CREATE SCHEMA tenant_002;
```

- Pros: Good isolation, single database
- Cons: Schema explosion, migration complexity
- Rejected: Difficult to manage at scale

### Alternative 3: Shared Tables with Tenant Column

```sql
SELECT * FROM documents WHERE cooperative_id = ?
```

- Pros: Simple to implement
- Cons: Easy to forget filter, no database enforcement
- Rejected: Too risky for financial data

### Alternative 4: Microservices per Tenant

- Pros: Complete isolation, independent scaling
- Cons: Massive complexity, expensive
- Rejected: Impossible for solo developer

## Migration Path

If we need to migrate to database-per-tenant later:

1. **Identify large tenants** (>1000 members)
2. **Export their data** using cooperative_id filter
3. **Create dedicated database**
4. **Update routing** to point to new database
5. **Maintain shared database** for small tenants

## Security Measures

1. **RLS Testing**: Unit tests verify isolation
2. **Audit Logging**: All queries logged with tenant context
3. **Penetration Testing**: Quarterly security audits
4. **Data Encryption**: Encrypt PII at column level
5. **Access Control**: Implement RBAC on top of RLS

## Monitoring

- **Tenant Size**: Alert if tenant >10% of database
- **Query Performance**: Track slow queries by tenant
- **RLS Violations**: Log any policy violations
- **Storage Growth**: Monitor per-tenant storage
- **Connection Pools**: Track connections per tenant

## Review Triggers

Reconsider this decision if:

- Any tenant exceeds 1000 apartments
- Total tenants exceed 5000
- Compliance requires physical isolation
- Performance degradation >20%
- Security breach occurs

---

_Decision made by: Solo Developer_  
_Review date: July 2025_
